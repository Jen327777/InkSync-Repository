<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Return a JSON error and stop execution.
function orderError(int $status, string $message): never
{
    http_response_code($status);

    echo json_encode([
        'success' => false,
        'message' => $message
    ]);

    exit;
}

// Convert a money value into whole cents.
// This avoids floating-point errors in price calculations.
function moneyToCents(mixed $value): ?int
{
    if (
        !is_string($value) &&
        !is_int($value) &&
        !is_float($value)
    ) {
        return null;
    }

    $value = (string) $value;

    if (!preg_match(
        '/^([0-9]{1,10})(?:\.([0-9]{1,2}))?$/',
        $value,
        $matches
    )) {
        return null;
    }

    $whole = (int) $matches[1];
    $fraction = str_pad($matches[2] ?? '', 2, '0');

    return ($whole * 100) + (int) $fraction;
}

// Format cents for MySQL DECIMAL(12,2).
function centsToMoney(int $cents): string
{
    return sprintf(
        '%d.%02d',
        intdiv($cents, 100),
        $cents % 100
    );
}

// Accept POST only.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    orderError(405, 'Method not allowed.');
}

// Load security helpers.
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../middleware/csrf.php';

// Only authenticated Admin and Staff users can create orders.
$user = requireAllowedRoles(['admin', 'staff']);

// Validate CSRF token before modifying the database.
requireValidCsrfToken();

// Read submitted JSON.
$data = json_decode(
    file_get_contents('php://input'),
    true
);

if (!is_array($data)) {
    orderError(400, 'Invalid JSON request body.');
}

// Validate required text fields.
$requiredFields = [
    'customer_name' => 120,
    'order_channel' => 50,
    'service_type' => 80,
    'due_date' => 10,
    'fulfillment_method' => 8
];

foreach ($requiredFields as $field => $maxLength) {
    if (
        !isset($data[$field]) ||
        !is_string($data[$field]) ||
        trim($data[$field]) === '' ||
        strlen(trim($data[$field])) > $maxLength
    ) {
        orderError(422, "Invalid or missing field: $field.");
    }

    $data[$field] = trim($data[$field]);
}

 // Validate printing service type.
$allowedServices = [
    'Tarpaulin',
    'Acrylic Signages',
    'Panaflex Signages',
    'Wall Mural Sticker',
    'Sticker Label',
    'Standee',
    'Sticker on Sintra',
    'Board Up Tarpaulin',
    'Lampost Banner',
    'Railing Streamer',
    'Luminous Signage',
    'Magnetic Signages',
    'Others'
];

if (!in_array($data['service_type'], $allowedServices, true)) {
    orderError(422, 'Invalid printing service type.');
}

// For "Others", require the user to specify the service.
if ($data['service_type'] === 'Others') {
    $otherService = $data['other_service_type'] ?? null;

    if (
        !is_string($otherService) ||
        trim($otherService) === '' ||
        strlen(trim($otherService)) > 72
    ) {
        orderError(
            422,
            'Please specify the other printing service (maximum 72 bytes).'
        );
    }

    // Store the description in the existing service_type column.
    $data['service_type'] = 'Others: ' . trim($otherService);
}


// Validate optional text fields.
$optionalFields = [
    'customer_email' => 150,
    'customer_phone' => 30,
    'description' => 2000,
    'delivery_address' => 2000
];

foreach ($optionalFields as $field => $maxLength) {
    $value = $data[$field] ?? null;

    if ($value !== null && !is_string($value)) {
        orderError(422, "Invalid field: $field.");
    }

    $value = $value === null ? null : trim($value);

    if ($value !== null && strlen($value) > $maxLength) {
        orderError(422, "Field too long: $field.");
    }

    $data[$field] = $value === '' ? null : $value;
}

// Validate email if provided.
if (
    $data['customer_email'] !== null &&
    !filter_var($data['customer_email'], FILTER_VALIDATE_EMAIL)
) {
    orderError(422, 'Invalid customer email.');
}

// Validate quantity.
$quantity = filter_var(
    $data['quantity'] ?? null,
    FILTER_VALIDATE_INT,
    [
        'options' => [
            'min_range' => 1,
            'max_range' => 100000
        ]
    ]
);

if ($quantity === false) {
    orderError(422, 'Quantity must be a positive whole number.');
}

// Validate monetary values.
$unitPrice = moneyToCents($data['unit_price'] ?? null);
$discount = moneyToCents($data['discount_amount'] ?? 0);

if ($unitPrice === null || $unitPrice <= 0) {
    orderError(422, 'Invalid unit price.');
}

if ($discount === null) {
    orderError(422, 'Invalid discount amount.');
}

// Calculate the total on the server.
$subtotal = $quantity * $unitPrice;

if ($discount > $subtotal) {
    orderError(422, 'Discount exceeds subtotal.');
}

$total = $subtotal - $discount;

// DECIMAL(12,2) supports up to 9,999,999,999.99.
if ($subtotal > 999999999999 || $total > 999999999999) {
    orderError(422, 'Order amount is too large.');
}

// Validate the due date.
$dueDate = DateTimeImmutable::createFromFormat(
    '!Y-m-d',
    $data['due_date']
);

if (
    !$dueDate ||
    $dueDate->format('Y-m-d') !== $data['due_date']
) {
    orderError(422, 'Invalid due date.');
}

// Validate pickup or delivery.
if (!in_array(
    $data['fulfillment_method'],
    ['pickup', 'delivery'],
    true
)) {
    orderError(422, 'Invalid fulfillment method.');
}



if ($data['fulfillment_method'] === 'pickup') {
    $data['delivery_address'] = null;
}

try {
    $pdo = getDatabaseConnection();

    // Status defaults to pending in MySQL.
    // created_by comes from the authenticated session.
    $sql = "INSERT INTO orders (
                customer_name,
                customer_email,
                customer_phone,
                order_channel,
                service_type,
                description,
                quantity,
                unit_price,
                discount_amount,
                total_amount,
                due_date,
                fulfillment_method,
                delivery_address,
                created_by
            ) VALUES (
                :customer_name,
                :customer_email,
                :customer_phone,
                :order_channel,
                :service_type,
                :description,
                :quantity,
                :unit_price,
                :discount_amount,
                :total_amount,
                :due_date,
                :fulfillment_method,
                :delivery_address,
                :created_by
            )";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        'customer_name' => $data['customer_name'],
        'customer_email' => $data['customer_email'],
        'customer_phone' => $data['customer_phone'],
        'order_channel' => $data['order_channel'],
        'service_type' => $data['service_type'],
        'description' => $data['description'],
        'quantity' => $quantity,
        'unit_price' => centsToMoney($unitPrice),
        'discount_amount' => centsToMoney($discount),
        'total_amount' => centsToMoney($total),
        'due_date' => $data['due_date'],
        'fulfillment_method' => $data['fulfillment_method'],
        'delivery_address' => $data['delivery_address'],
        'created_by' => $user['id']
    ]);

    http_response_code(201);

    echo json_encode([
        'success' => true,
        'message' => 'Order created successfully.',
        'order' => [
            'id' => (int) $pdo->lastInsertId(),
            'status' => 'pending',
            'total_amount' => centsToMoney($total)
        ]
    ]);

} catch (Throwable $error) {
    error_log($error->getMessage());

    orderError(500, 'Internal server error.');
}
