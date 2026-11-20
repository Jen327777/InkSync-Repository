<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Return a JSON error response.
function volumeError(int $status, string $message): never
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
    volumeError(405, 'Method not allowed.');
}

// Load authentication middleware.
require_once __DIR__ . '/../../middleware/auth.php';

// Admin and Staff can view order counts.
requireAllowedRoles(['admin', 'staff']);

// Accept either a date OR a month, not both.
$hasDate = array_key_exists('date', $_GET);
$hasMonth = array_key_exists('month', $_GET);

if ($hasDate === $hasMonth) {
    volumeError(
        400,
        'Provide either date=YYYY-MM-DD or month=YYYY-MM.'
    );
}

// Determine the requested reporting period.
$period = $hasDate ? 'day' : 'month';
$input = $hasDate ? $_GET['date'] : $_GET['month'];

if (!is_string($input)) {
    volumeError(422, 'Invalid reporting period.');
}

$format = $hasDate ? '!Y-m-d' : '!Y-m';
$expectedFormat = $hasDate ? 'Y-m-d' : 'Y-m';

$selectedDate = DateTimeImmutable::createFromFormat(
    $format,
    $input
);

if (
    $selectedDate === false ||
    $selectedDate->format($expectedFormat) !== $input
) {
    volumeError(422, 'Invalid date or month format.');
}

// Set the start and end of the period.
$startDate = $selectedDate->format('Y-m-d') . ' 00:00:00';

$endDate = $selectedDate
    ->modify($hasDate ? '+1 day' : '+1 month')
    ->format('Y-m-d') . ' 00:00:00';

try {
    $pdo = getDatabaseConnection();

    // Count orders created during the selected period.
    $sql = "
        SELECT
            COUNT(*) AS total_orders,

            COUNT(CASE
                WHEN status = 'pending'
                THEN 1 END
            ) AS pending,

            COUNT(CASE
                WHEN status = 'approved'
                THEN 1 END
            ) AS approved,

            COUNT(CASE
                WHEN status = 'in_production'
                THEN 1 END
            ) AS in_production,

            COUNT(CASE
                WHEN status = 'completed'
                THEN 1 END
            ) AS completed

        FROM orders

        WHERE created_at >= :start_date
          AND created_at < :end_date
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        'start_date' => $startDate,
        'end_date' => $endDate
    ]);

    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    // Prepare the report for the frontend.
    $report = [
        'period' => $period,
        'total_orders' => (int) $result['total_orders'],
        'pending' => (int) $result['pending'],
        'approved' => (int) $result['approved'],
        'in_production' => (int) $result['in_production'],
        'completed' => (int) $result['completed']
    ];

    if ($hasDate) {
        $report['date'] = $input;
    } else {
        $report['month'] = $input;
    }

    http_response_code(200);

    echo json_encode([
        'success' => true,
        'message' => 'Order volume retrieved successfully.',
        'report' => $report
    ]);

} catch (Throwable $error) {
    error_log($error->getMessage());

    volumeError(500, 'Internal server error.');
}
