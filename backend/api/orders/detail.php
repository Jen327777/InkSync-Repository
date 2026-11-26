<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');


if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Allow: GET');

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}


require_once __DIR__ . '/../../middleware/auth.php';


requireAllowedRoles(['admin', 'staff']);


$rawId = $_GET['id'] ?? null;

$orderId = is_string($rawId)
    ? filter_var(
        $rawId,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 1]]
    )
    : false;

if ($orderId === false) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'A valid order ID is required.'
    ]);

    exit;
}

try {
  
    $pdo = getDatabaseConnection();

   
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
        WHERE o.id = :id
        LIMIT 1
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->bindValue(
        ':id',
        $orderId,
        PDO::PARAM_INT
    );

    $stmt->execute();

    $order = $stmt->fetch(PDO::FETCH_ASSOC);


    if (!$order) {
        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Order not found.'
        ]);

        exit;
    }


    http_response_code(200);

    echo json_encode([
        'success' => true,
        'message' => 'Order retrieved successfully.',
        'order' => $order
    ]);

} catch (Throwable $error) {
    error_log($error->getMessage());

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Internal server error.'
    ]);
}
