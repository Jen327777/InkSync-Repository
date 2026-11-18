<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Return a JSON error and stop execution.
function deactivateStaffError(
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

// Allow POST requests only.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');

    deactivateStaffError(
        405,
        'Method not allowed.'
    );
}

// Load authentication and CSRF middleware.
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../middleware/csrf.php';

// Admin access only.
requireAllowedRoles(['admin']);

// Verify the CSRF token.
requireValidCsrfToken();

// Read JSON request body.
$data = json_decode(
    file_get_contents('php://input'),
    true
);

if (!is_array($data)) {
    deactivateStaffError(
        400,
        'Invalid JSON request body.'
    );
}

// Get and validate the Staff account ID.
$rawId = $data['id'] ?? null;

if (!is_int($rawId) && !is_string($rawId)) {
    deactivateStaffError(
        422,
        'A valid Staff ID is required.'
    );
}

$staffId = filter_var(
    $rawId,
    FILTER_VALIDATE_INT,
    [
        'options' => [
            'min_range' => 1
        ]
    ]
);

if ($staffId === false) {
    deactivateStaffError(
        422,
        'A valid Staff ID is required.'
    );
}

try {
    // Connect to the InkSync database.
    $pdo = getDatabaseConnection();

    // Deactivate only an ACTIVE Staff account.
    // Admin accounts cannot be affected.
    $sql = "
        UPDATE users
        SET is_active = 0
        WHERE id = :id
          AND role = 'staff'
          AND is_active = 1
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->bindValue(
        ':id',
        $staffId,
        PDO::PARAM_INT
    );

    $stmt->execute();

    // Check whether an account was deactivated.
    if ($stmt->rowCount() === 1) {
        http_response_code(200);

        echo json_encode([
            'success' => true,
            'message' => 'Staff account deactivated successfully.',
            'user' => [
                'id' => $staffId,
                'is_active' => false
            ]
        ]);

        exit;
    }

    // Check why no account was updated.
    $check = $pdo->prepare(
        "SELECT is_active
         FROM users
         WHERE id = :id
           AND role = 'staff'
         LIMIT 1"
    );

    $check->bindValue(
        ':id',
        $staffId,
        PDO::PARAM_INT
    );

    $check->execute();

    $staff = $check->fetch(PDO::FETCH_ASSOC);

    if (!$staff) {
        deactivateStaffError(
            404,
            'Staff account not found.'
        );
    }

    if ((int) $staff['is_active'] === 0) {
        deactivateStaffError(
            409,
            'Staff account is already deactivated.'
        );
    }

    deactivateStaffError(
        409,
        'Staff account could not be deactivated. Try again.'
    );

} catch (Throwable $error) {
    error_log($error->getMessage());

    deactivateStaffError(
        500,
        'Internal server error.'
    );
}
