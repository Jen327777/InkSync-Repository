<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');


if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);
    exit;
}


$data = json_decode(
    file_get_contents('php://input'),
    true
);


if (
    !is_array($data) ||
    !is_string($data['username'] ?? null) ||
    !is_string($data['password'] ?? null)
) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Username and password are required.'
    ]);
    exit;
}

$username = trim($data['username']);
$password = $data['password'];

if ($username === '' || $password === '') {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Username and password are required.'
    ]);
    exit;
}


require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/csrf.php';

try {
   
    $pdo = getDatabaseConnection();

  
$sql = "SELECT id, username, full_name, password_hash,
               role, is_active
        FROM users
        WHERE username = :username
        LIMIT 1";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        'username' => $username
    ]);

    $user = $stmt->fetch();

   
    if (
        !$user ||
        !password_verify($password, $user['password_hash']) ||
        !(bool) $user['is_active']
    ) {
        http_response_code(401);

        echo json_encode([
            'success' => false,
            'message' => 'Invalid username or password.'
        ]);
        exit;
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');

    session_set_cookie_params([
        'httponly' => true,
        'secure' => !empty($_SERVER['HTTPS'])
            && $_SERVER['HTTPS'] !== 'off',
        'samesite' => 'Lax',
        'path' => '/'
    ]);


    if (!session_start()) {
        throw new RuntimeException(
            'Session could not start.'
        );
    }

    if (!session_regenerate_id(true)) {
        throw new RuntimeException(
            'Session ID could not be regenerated.'
        );
    }

    
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['role'] = $user['role'];

    unset($_SESSION['csrf_token']);
    $csrfToken = getCsrfToken();

  
    http_response_code(200);

    echo json_encode([
        'success' => true,
        'message' => 'Login successful.',
       
'user' => [
    'id' => (int) $user['id'],
    'full_name' => $user['full_name'],
    'username' => $user['username'],
    'role' => $user['role']
],

        'csrf_token' => $csrfToken
    ]);

} catch (Throwable $error) {
    error_log($error->getMessage());

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Internal server error.'
    ]);
}
