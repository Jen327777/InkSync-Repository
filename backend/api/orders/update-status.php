<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Send a JSON error response.
function statusError(int $code, string $message): never
{
    http_response_code($code);

    echo json_encode([
        'success' => false,
        'message' => $message
    ]);
    
    exit;
}

// Accept POST requests only.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    statusError(405, 'Method not allowed.');
}

// Load authentication and CSRF middleware.
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../middleware/csrf.php';

// Only authenticated Admin and Staff can update orders.
requireAllowedRoles(['admin', 'staff']);

// Validate the CSRF token.
requireValidCsrfToken();

// Read JSON request body.
$data = json_decode(
    file_get_contents('php://input'),
    true
);

if (!is_array($data)) {
    statusError(400, 'Invalid JSON request body.');
}

// Validate order ID.
$rawId = $data['id'] ?? null;

if (!is_int($rawId) && !is_string($rawId)) {
    statusError(422, 'A valid order ID is required.');
}

$orderId = filter_var(
    $rawId,
    FILTER_VALIDATE_INT,
    ['options' => ['min_range' => 1]]
);

if ($orderId === false) {
    statusError(422, 'A valid order ID is required.');
}

// Validate the requested status.
$newStatus = $data['status'] ?? null;

$allowedStatuses = [
    'pending',
    'approved',
    'in_production',
    'completed'
];

if (
    !is_string($newStatus) ||
    !in_array($newStatus, $allowedStatuses, true)
) {
    statusError(422, 'Invalid order status.');
}

// Define the only permitted transitions.
$nextStatuses = [
    'pending' => 'approved',
    'approved' => 'in_production',
    'in_production' => 'completed'
];

try {
    $pdo = getDatabaseConnection();

    // Find the order's current status.
    $stmt = $pdo->prepare(
        "SELECT status
         FROM orders
         WHERE id = :id
         LIMIT 1"
    );

    $stmt->bindValue(':id', $orderId, PDO::PARAM_INT);
    $stmt->execute();

    $order = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        statusError(404, 'Order not found.');
    }

    $currentStatus = $order['status'];

    // Completed orders are permanently locked.
    if ($currentStatus === 'completed') {
        statusError(
            409,
            'Completed orders cannot be modified.'
        );
    }

    // Check the next allowed status.
    $expectedStatus = $nextStatuses[$currentStatus] ?? null;

    if ($newStatus !== $expectedStatus) {
        statusError(
            422,
            'Invalid status transition. The next allowed status is: '
            . ($expectedStatus ?? 'none')
        );
    }

    // Update only if the status has not changed
    // since we retrieved it.
    $update = $pdo->prepare(
        "UPDATE orders
         SET status = :new_status
         WHERE id = :id
           AND status = :current_status"
    );

    $update->bindValue(
        ':new_status',
        $newStatus,
        PDO::PARAM_STR
    );

    $update->bindValue(
        ':id',
        $orderId,
        PDO::PARAM_INT
    );

    $update->bindValue(
        ':current_status',
        $currentStatus,
        PDO::PARAM_STR
    );

    $update->execute();

    // Another user may have updated the order first.
    if ($update->rowCount() !== 1) {
        statusError(
            409,
            'Order status changed. Refresh and try again.'
        );
    }

    http_response_code(200);

    echo json_encode([
        'success' => true,
        'message' => 'Order status updated successfully.',
        'order' => [
            'id' => $orderId,
            'previous_status' => $currentStatus,
            'status' => $newStatus
        ]
    ]);

} catch (Throwable $error) {
    error_log($error->getMessage());

    statusError(500, 'Internal server error.');
}
