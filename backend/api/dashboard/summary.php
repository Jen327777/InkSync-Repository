<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Allow GET requests only.
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Allow: GET');

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}

// Load existing authentication middleware.
require_once __DIR__ . '/../../middleware/auth.php';

// Only authenticated Admin and Staff can view
// order tracking statistics.
requireAllowedRoles(['admin', 'staff']);

try {
    $pdo = getDatabaseConnection();

    // Calculate order counts by status.
    $sql = "
        SELECT
            COUNT(*) AS total_orders,

            COUNT(
                CASE WHEN status = 'pending'
                THEN 1 END
            ) AS pending,

            COUNT(
                CASE WHEN status = 'approved'
                THEN 1 END
            ) AS approved,

            COUNT(
                CASE WHEN status = 'in_production'
                THEN 1 END
            ) AS in_production,

            COUNT(
                CASE WHEN status = 'completed'
                THEN 1 END
            ) AS completed

        FROM orders
    ";

    $stmt = $pdo->query($sql);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    // Convert database counts to integers.
    $summary = [
        'total_orders' => (int) $result['total_orders'],
        'pending' => (int) $result['pending'],
        'approved' => (int) $result['approved'],
        'in_production' => (int) $result['in_production'],
        'completed' => (int) $result['completed']
    ];

    http_response_code(200);

    echo json_encode([
        'success' => true,
        'message' => 'Dashboard summary retrieved successfully.',
        'summary' => $summary
    ]);

} catch (Throwable $error) {
    error_log($error->getMessage());

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Internal server error.'
    ]);
}
