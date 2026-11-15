<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

function requireAuthenticatedUser(): array
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');


    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');

    session_set_cookie_params([
        'httponly' => true,
        'secure' => !empty($_SERVER['HTTPS'])
            && $_SERVER['HTTPS'] !== 'off',
        'samesite' => 'Lax',
        'path' => '/'
    ]);

    try {
        if (
            session_status() !== PHP_SESSION_ACTIVE
            && !session_start()
        ) {
            throw new RuntimeException(
                'Session could not start.'
            );
        }

       
        $userId = $_SESSION['user_id'] ?? null;

        if (!is_int($userId) || $userId <= 0) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Not authenticated.'
            ]);
            exit;
        }

     
        $pdo = getDatabaseConnection();

        $stmt = $pdo->prepare(
            "SELECT id, username, role
             FROM users
             WHERE id = :id AND is_active = 1
             LIMIT 1"
        );

        $stmt->execute(['id' => $userId]);
        $user = $stmt->fetch();

        if (!$user) {
            unset($_SESSION['user_id'], $_SESSION['role']);

            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Not authenticated.'
            ]);
            exit;
        }

        
        return [
            'id' => (int) $user['id'],
            'username' => $user['username'],
            'role' => $user['role']
        ];

    } catch (Throwable $error) {
        error_log($error->getMessage());

        http_response_code(500);

        echo json_encode([
            'success' => false,
            'message' => 'Internal server error.'
        ]);
        exit;
    }
}
