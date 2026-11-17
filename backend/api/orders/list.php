<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Only allow GET requests.
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Allow: GET');

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}

// Load authentication middleware.
require_once __DIR__ . '/../../middleware/auth.php';

// Only logged-in Admin and Staff can view orders.
requireAllowedRoles(['admin', 'staff']);

try {
    // Connect to the database.
    $pdo = getDatabaseConnection();

    // Retrieve the 50 newest orders.
    $sql = "
        SELECT
            o.id,
            o.customer_name,
            o.customer_email,
            o.customer_phone,
            o.order_channel,
            o.service_type,
            o.description,
            o.quantity,
            o.unit_price,
            o.discount_amount,
            o.total_amount,
            o.due_date,
            o.fulfillment_method,
            o.delivery_address,
            o.status,
            o.created_by,
            u.username AS created_by_username,
            o.created_at,
            o.updated_at
        FROM orders AS o
        INNER JOIN users AS u
            ON o.created_by = u.id
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT 50
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();

    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Return the orders as JSON.
    http_response_code(200);

    echo json_encode([
        'success' => true,
        'message' => 'Orders retrieved successfully.',
        'count' => count($orders),
        'orders' => $orders
    ]);

} catch (Throwable $error) {
    error_log($error->getMessage());

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Internal server error.'
    ]);
}
