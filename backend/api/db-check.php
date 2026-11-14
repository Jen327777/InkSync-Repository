<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';

try {

    $pdo = getDatabaseConnection();

   
    $result = $pdo->query(
        'SELECT DATABASE() AS database_name'
    )->fetch();


    $userCount = $pdo->query(
        'SELECT COUNT(*) FROM users'
    )->fetchColumn();


    echo json_encode([
        'success' => true,
        'message' => 'Database connection successful!',
        'database' => $result['database_name'],
        'users_table' => 'accessible',
        'user_count' => (int) $userCount
    ]);

} catch (Throwable $error) {
    error_log($error->getMessage());

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed.'
    ]);
}
