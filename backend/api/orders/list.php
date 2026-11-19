<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// GET requests only.
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}

require_once __DIR__ . '/../../middleware/auth.php';

// Admin and Staff can view orders.
requireAllowedRoles(['admin', 'staff']);

// Optional order status filter.
$status = $_GET['status'] ?? null;

$allowedStatuses = [
    'pending',
    'approved',
    'in_production',
    'completed',
    'unfinished'
];

if (
    $status !== null &&
    (
        !is_string($status) ||
        !in_array($status, $allowedStatuses, true)
    )
) {
    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Invalid order status filter.'
    ]);

    exit;
}

// Pagination: 50 orders per request.
$rawOffset = $_GET['offset'] ?? '0';

$offset = is_string($rawOffset)
    ? filter_var(
        $rawOffset,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 0]]
    )
    : false;

if ($offset === false) {
    http_response_code(422);

    echo json_encode([
        'success' => false,
        'message' => 'Invalid offset.'
    ]);

    exit;
}

$pageSize = 50;

try {
    $pdo = getDatabaseConnection();

    // Build the optional status condition safely.
    $where = '';

    if ($status === 'unfinished') {
        $where = "WHERE o.status <> 'completed'";
    } elseif ($status !== null) {
        $where = "WHERE o.status = :status";
    }

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
            o.completed_at,
            o.created_by,
            u.username AS created_by_username,
            o.created_at,
            o.updated_at
        FROM orders AS o
        INNER JOIN users AS u
            ON o.created_by = u.id
        $where
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT :limit OFFSET :offset
    ";

    $stmt = $pdo->prepare($sql);

    if ($status !== null && $status !== 'unfinished') {
        $stmt->bindValue(
            ':status',
            $status,
            PDO::PARAM_STR
        );
    }

    // Retrieve one extra row to detect another page.
    $stmt->bindValue(
        ':limit',
        $pageSize + 1,
        PDO::PARAM_INT
    );

    $stmt->bindValue(
        ':offset',
        $offset,
        PDO::PARAM_INT
    );

    $stmt->execute();

    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $hasMore = count($orders) > $pageSize;

    if ($hasMore) {
        array_pop($orders);
    }

    http_response_code(200);

    echo json_encode([
        'success' => true,
        'message' => 'Orders retrieved successfully.',
        'count' => count($orders),
        'status_filter' => $status,
        'offset' => $offset,
        'has_more' => $hasMore,
        'next_offset' => $hasMore
            ? $offset + $pageSize
            : null,
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
