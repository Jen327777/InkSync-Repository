<?php
declare(strict_types=1);


function getCsrfToken(): string
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        throw new RuntimeException('Session is not active.');
    }

    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}


function requireValidCsrfToken(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        throw new RuntimeException('Session is not active.');
    }

    $expected = $_SESSION['csrf_token'] ?? null;
    $received = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;

    if (
        !is_string($expected) ||
        !is_string($received) ||
        !hash_equals($expected, $received)
    ) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');

        http_response_code(403);

        echo json_encode([
            'success' => false,
            'message' => 'Invalid CSRF token.'
        ]);

        exit;
    }
}
