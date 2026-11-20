<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Send a JSON error response.
function revenueError(int $status, string $message): never
{
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
    revenueError(405, 'Method not allowed.');
}

// Load authentication middleware.
require_once __DIR__ . '/../../middleware/auth.php';

// Only Admins can view financial reports.
requireAllowedRoles(['admin']);

// Read the requested date from the URL.
$dateInput = $_GET['date'] ?? null;

if (!is_string($dateInput)) {
    revenueError(400, 'A date is required.');
}

// Validate the YYYY-MM-DD date format.
$date = DateTimeImmutable::createFromFormat(
    '!Y-m-d',
    $dateInput
);

if (
    $date === false ||
    $date->format('Y-m-d') !== $dateInput
) {
    revenueError(
        422,
        'Invalid date. Use YYYY-MM-DD format.'
    );
}

// Start and end of the selected day.
$startDate = $date->format('Y-m-d') . ' 00:00:00';

$endDate = $date
    ->modify('+1 day')
    ->format('Y-m-d') . ' 00:00:00';

try {
    // Connect to MySQL.
    $pdo = getDatabaseConnection();

    // Count and total Completed orders only.
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

    // Return the revenue report as JSON.
    http_response_code(200);

    echo json_encode([
        'success' => true,
        'message' => 'Daily revenue retrieved successfully.',
        'report' => [
            'date' => $dateInput,
            'completed_orders' => (int) $result['completed_orders'],
            'total_revenue' => (string) $result['total_revenue']
        ]
    ]);

} catch (Throwable $error) {
    error_log($error->getMessage());

    revenueError(500, 'Internal server error.');
}
