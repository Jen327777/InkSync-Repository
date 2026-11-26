<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function updateOrderError(int $status, string $message): never
{
    http_response_code($status);

    echo json_encode([
        'success' => false,
        'message' => $message
    ]);

    exit;
}

function updateMoneyToCents(mixed $value): ?int
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

function updateFormatMoney(int $cents): string
{
    return sprintf(
        '%d.%02d',
        intdiv($cents, 100),
        $cents % 100
    );
}

// POST only.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    updateOrderError(405, 'Method not allowed.');
}

require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../middleware/csrf.php';

// Only logged-in Admin and Staff users.
requireAllowedRoles(['admin', 'staff']);

// Protect this database-changing request.
requireValidCsrfToken();

$data = json_decode(
    file_get_contents('php://input'),
    true
);

if (!is_array($data)) {
    updateOrderError(400, 'Invalid JSON request body.');
}

// Validate order ID.
$rawId = $data['id'] ?? null;

if (!is_int($rawId) && !is_string($rawId)) {
    updateOrderError(422, 'A valid order ID is required.');
}

$orderId = filter_var(
    $rawId,
    FILTER_VALIDATE_INT,
    ['options' => ['min_range' => 1]]
);

if ($orderId === false) {
    updateOrderError(422, 'A valid order ID is required.');
}

// Validate required fields.
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
        updateOrderError(
            422,
            "Invalid or missing field: $field."
        );
    }

    $data[$field] = trim($data[$field]);
}

// Validate printing service.
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
    'Magnetic Signages'
];

$service = $data['service_type'];

if ($service === 'Others') {
    $other = $data['other_service_type'] ?? null;

    if (
        !is_string($other) ||
        trim($other) === '' ||
        strlen(trim($other)) > 72
    ) {
        updateOrderError(
            422,
            'Please specify the other printing service.'
        );
    }

    $data['service_type'] = 'Others: ' . trim($other);

} elseif (str_starts_with($service, 'Others: ')) {
    // Also accept an existing stored Others value.
    $other = trim(substr($service, 8));

    if ($other === '' || strlen($other) > 72) {
        updateOrderError(422, 'Invalid other printing service.');
    }

    $data['service_type'] = 'Others: ' . $other;

} elseif (!in_array($service, $allowedServices, true)) {
    updateOrderError(422, 'Invalid printing service type.');
}

// Validate optional fields.
$optionalFields = [
    'customer_email' => 150,
    'customer_phone' => 30,
    'description' => 2000,
    'delivery_address' => 2000
];

foreach ($optionalFields as $field => $maxLength) {
    $value = $data[$field] ?? null;

    if ($value !== null && !is_string($value)) {
        updateOrderError(422, "Invalid field: $field.");
    }

    $value = $value === null ? null : trim($value);

    if ($value !== null && strlen($value) > $maxLength) {
        updateOrderError(422, "Field too long: $field.");
    }

    $data[$field] = $value === '' ? null : $value;
}

if (
    $data['customer_email'] !== null &&
    !filter_var($data['customer_email'], FILTER_VALIDATE_EMAIL)
) {
    updateOrderError(422, 'Invalid customer email.');
}

// Validate quantity.
$rawQuantity = $data['quantity'] ?? null;

if (!is_int($rawQuantity) && !is_string($rawQuantity)) {
    updateOrderError(422, 'Invalid quantity.');
}

$quantity = filter_var(
    $rawQuantity,
    FILTER_VALIDATE_INT,
    [
        'options' => [
            'min_range' => 1,
            'max_range' => 100000
        ]
    ]
);

if ($quantity === false) {
    updateOrderError(422, 'Invalid quantity.');
}

// Calculate the price on the server.
$unitPrice = updateMoneyToCents(
    $data['unit_price'] ?? null
);

$discount = updateMoneyToCents(
    $data['discount_amount'] ?? 0
);

if ($unitPrice === null || $unitPrice <= 0) {
    updateOrderError(422, 'Invalid unit price.');
}

if ($discount === null) {
    updateOrderError(422, 'Invalid discount amount.');
}

$subtotal = $quantity * $unitPrice;

if ($discount > $subtotal) {
    updateOrderError(422, 'Discount exceeds subtotal.');
}

$total = $subtotal - $discount;

if ($subtotal > 999999999999) {
    updateOrderError(422, 'Order amount is too large.');
}

// Validate due date.
$dueDate = DateTimeImmutable::createFromFormat(
    '!Y-m-d',
    $data['due_date']
);

if (
    $dueDate === false ||
    $dueDate->format('Y-m-d') !== $data['due_date']
) {
    updateOrderError(422, 'Invalid due date.');
}

// Validate pickup or delivery.
if (!in_array(
    $data['fulfillment_method'],
    ['pickup', 'delivery'],
    true
)) {
    updateOrderError(422, 'Invalid fulfillment method.');
}

// Delivery address is optional.
if ($data['fulfillment_method'] === 'pickup') {
    $data['delivery_address'] = null;
}

$pdo = null;

try {
    $pdo = getDatabaseConnection();

    // Lock this order while checking and updating it.
    // This prevents another request from completing it
    // between our check and the update.
    $pdo->beginTransaction();

    $check = $pdo->prepare(
        "SELECT status
         FROM orders
         WHERE id = :id
         FOR UPDATE"
    );

    $check->bindValue(':id', $orderId, PDO::PARAM_INT);
    $check->execute();

    $order = $check->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        $pdo->rollBack();
        updateOrderError(404, 'Order not found.');
    }

    if ($order['status'] === 'completed') {
        $pdo->rollBack();

        updateOrderError(
            409,
            'Completed orders cannot be modified.'
        );
    }

    // Update order details only.
    // Status and completed_at are never changed here.
    $sql = "
        UPDATE orders
        SET
            customer_name = :customer_name,
            customer_email = :customer_email,
            customer_phone = :customer_phone,
            order_channel = :order_channel,
            service_type = :service_type,
            description = :description,
            quantity = :quantity,
            unit_price = :unit_price,
            discount_amount = :discount_amount,
            total_amount = :total_amount,
            due_date = :due_date,
            fulfillment_method = :fulfillment_method,
            delivery_address = :delivery_address
        WHERE id = :id
          AND status <> 'completed'
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        'id' => $orderId,
        'customer_name' => $data['customer_name'],
        'customer_email' => $data['customer_email'],
        'customer_phone' => $data['customer_phone'],
        'order_channel' => $data['order_channel'],
        'service_type' => $data['service_type'],
        'description' => $data['description'],
        'quantity' => $quantity,
        'unit_price' => updateFormatMoney($unitPrice),
        'discount_amount' => updateFormatMoney($discount),
        'total_amount' => updateFormatMoney($total),
        'due_date' => $data['due_date'],
        'fulfillment_method' => $data['fulfillment_method'],
        'delivery_address' => $data['delivery_address']
    ]);

    // An unchanged order may produce rowCount() = 0.
    // The locked SELECT already verified it exists
    // and is not completed.
    $pdo->commit();

    http_response_code(200);

    echo json_encode([
        'success' => true,
        'message' => 'Order updated successfully.',
        'order' => [
            'id' => $orderId,
            'status' => $order['status'],
            'total_amount' => updateFormatMoney($total)
        ]
    ]);

} catch (Throwable $error) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log($error->getMessage());

    updateOrderError(500, 'Internal server error.');
}
