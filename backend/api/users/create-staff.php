<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Send an error response and stop execution.
function staffError(int $status, string $message): never
{
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
    staffError(405, 'Method not allowed.');
}

// Load authentication and CSRF middleware.
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../middleware/csrf.php';

// Admin access only.
requireAllowedRoles(['admin']);

// Check CSRF token.
requireValidCsrfToken();

// Read JSON request data.
$data = json_decode(
    file_get_contents('php://input'),
    true
);

if (!is_array($data)) {
    staffError(400, 'Invalid JSON request body.');
}

// Get form values.
$fullName = $data['full_name'] ?? null;
$username = $data['username'] ?? null;
$password = $data['password'] ?? null;
$confirmPassword = $data['confirm_password'] ?? null;
$accountStatus = $data['account_status'] ?? 'active';

// Validate full name.
if (!is_string($fullName)) {
    staffError(422, 'Full name is required.');
}

$fullName = trim($fullName);

if ($fullName === '' || strlen($fullName) > 120) {
    staffError(422, 'Invalid full name.');
}

// Validate username.
if (!is_string($username)) {
    staffError(422, 'Username is required.');
}

$username = trim($username);

if (!preg_match('/^[a-zA-Z0-9_]{3,50}$/', $username)) {
    staffError(
        422,
        'Username must be 3 to 50 characters and contain only letters, numbers, or underscores.'
    );
}

// Validate password.
if (
    !is_string($password) ||
    strlen($password) < 8 ||
    strlen($password) > 72
) {
    staffError(
        422,
        'Password must be 8 to 72 bytes long.'
    );
}

// Confirm password.
if (
    !is_string($confirmPassword) ||
    !hash_equals($password, $confirmPassword)
) {
    staffError(422, 'Passwords do not match.');
}

// Validate account status.
if (
    !is_string($accountStatus) ||
    !in_array(
        $accountStatus,
        ['active', 'inactive'],
        true
    )
) {
    staffError(422, 'Invalid account status.');
}

// Convert account status into a database value.
$isActive = $accountStatus === 'active' ? 1 : 0;

try {
    // Hash the password before saving.
    $passwordHash = password_hash(
        $password,
        PASSWORD_DEFAULT
    );

    if ($passwordHash === false) {
        throw new RuntimeException(
            'Password hashing failed.'
        );
    }

    // Connect to MySQL.
    $pdo = getDatabaseConnection();

    // The role is always STAFF.
    // The frontend cannot assign Admin privileges.
    $sql = "
        INSERT INTO users (
            username,
            full_name,
            password_hash,
            role,
            is_active
        )
        VALUES (
            :username,
            :full_name,
            :password_hash,
            'staff',
            :is_active
        )
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->bindValue(
        ':username',
        $username,
        PDO::PARAM_STR
    );

    $stmt->bindValue(
        ':full_name',
        $fullName,
        PDO::PARAM_STR
    );

    $stmt->bindValue(
        ':password_hash',
        $passwordHash,
        PDO::PARAM_STR
    );

    $stmt->bindValue(
        ':is_active',
        $isActive,
        PDO::PARAM_INT
    );

    $stmt->execute();

    // Return the new staff account details.
    http_response_code(201);

    echo json_encode([
        'success' => true,
        'message' => 'Staff account created successfully.',
        'user' => [
            'id' => (int) $pdo->lastInsertId(),
            'full_name' => $fullName,
            'username' => $username,
            'role' => 'staff',
            'is_active' => (bool) $isActive
        ]
    ]);

} catch (PDOException $error) {
    // MySQL duplicate username error.
    if (
        (int) ($error->errorInfo[1] ?? 0) === 1062
    ) {
        staffError(409, 'Username already exists.');
    }

    error_log($error->getMessage());

    staffError(500, 'Internal server error.');

} catch (Throwable $error) {
    error_log($error->getMessage());

    staffError(500, 'Internal server error.');
}
