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

// Load authentication middleware.
require_once __DIR__ . '/../../middleware/auth.php';

// Only Admins can view staff accounts.
requireAllowedRoles(['admin']);

try {
    // Connect to the InkSync database.
    $pdo = getDatabaseConnection();

    // Retrieve staff accounts only.
    // Password hashes are never included.
    $sql = "
        SELECT
            id,
            full_name,
            username,
            role,
            is_active,
            created_at
        FROM users
        WHERE role = 'staff'
        ORDER BY created_at DESC, id DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();

    $staffAccounts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Format the returned data.
    foreach ($staffAccounts as &$staff) {
        $staff['id'] = (int) $staff['id'];
        $staff['is_active'] = (bool) $staff['is_active'];
    }

    unset($staff);

    // Return the staff accounts as JSON.
    http_response_code(200);

    echo json_encode([
        'success' => true,
        'message' => 'Staff accounts retrieved successfully.',
        'count' => count($staffAccounts),
        'staff' => $staffAccounts
    ]);

} catch (Throwable $error) {
    error_log($error->getMessage());

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Internal server error.'
    ]);
}
