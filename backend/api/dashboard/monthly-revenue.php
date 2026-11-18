<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Send a JSON error response.
function monthlyRevenueError(
    int $status,
    string $message
): never {
    http_response_code($status);

    echo json_encode([
        'success' => false,
        'message' => $message
    ]);

    exit;
}

// Allow GET requests only.
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    monthlyRevenueError(405, 'Method not allowed.');
}

// Load authentication middleware.
require_once __DIR__ . '/../../middleware/auth.php';

// Financial reports are for Admins only.
requireAllowedRoles(['admin']);

// Read the requested month from the URL.
$monthInput = $_GET['month'] ?? null;

if (!is_string($monthInput)) {
    monthlyRevenueError(400, 'A month is required.');
}

// Validate YYYY-MM format.
$month = DateTimeImmutable::createFromFormat(
    '!Y-m',
    $monthInput
);

if (
    $month === false ||
    $month->format('Y-m') !== $monthInput
) {
    monthlyRevenueError(
        422,
        'Invalid month. Use YYYY-MM format.'
    );
}

// Beginning of the selected month.
$startDate = $month->format('Y-m-d') . ' 00:00:00';

// Beginning of the following month.
$endDate = $month
    ->modify('+1 month')
    ->format('Y-m-d') . ' 00:00:00';

try {
    // Connect to the InkSync database.
    $pdo = getDatabaseConnection();

    // Calculate revenue from Completed orders only.
    $sql = "
        SELECT
            COUNT(*) AS completed_orders,

            CAST(
                COALESCE(SUM(total_amount), 0.00)
                AS DECIMAL(20,2)
            ) AS total_revenue

        FROM orders

        WHERE status = 'completed'
          AND completed_at >= :start_date
          AND completed_at < :end_date
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        'start_date' => $startDate,
        'end_date' => $endDate
    ]);

    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    // Return the monthly report.
    http_response_code(200);

    echo json_encode([
        'success' => true,
        'message' => 'Monthly revenue retrieved successfully.',
        'report' => [
            'month' => $monthInput,
            'completed_orders' =>
                (int) $result['completed_orders'],
            'total_revenue' =>
                (string) $result['total_revenue']
        ]
    ]);

} catch (Throwable $error) {
    error_log($error->getMessage());

    monthlyRevenueError(
        500,
        'Internal server error.'
    );
}
