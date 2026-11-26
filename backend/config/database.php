<?php
declare(strict_types=1);

function getDatabaseConnection(): PDO
{
    $config = require __DIR__ . '/database.local.php';

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['host'],
        $config['port'],
        $config['database']
    );

    $pdo = new PDO(
        $dsn,
        $config['username'],
        $config['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );

    // Use Philippine time (UTC+8) so NOW(), order dates and revenue
    // reports match the business day, whatever the server's own time zone is.
    $pdo->exec("SET time_zone = '+08:00'");

    return $pdo;
}
