<?php
declare(strict_types=1);


if (PHP_SAPI !== 'cli') {
    exit("Command-line access only.\n");
}

require_once __DIR__ . '/../backend/config/database.php';


$role = $argv[1] ?? '';

if (!in_array($role, ['admin', 'staff'], true)) {
    exit("Specify admin or staff.\n");
}


$username = trim((string) fgets(STDIN));
$password = rtrim((string) fgets(STDIN), "\r\n");


if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $username)) {
    exit("Invalid username. Use 3-50 letters, numbers, dots, underscores or hyphens.\n");
}

if (strlen($password) < 12) {
    exit("Password must contain at least 12 characters.\n");
}

try {
    
    $pdo = getDatabaseConnection();

    
    $hashedPassword = password_hash(
        $password,
        PASSWORD_DEFAULT
    );

    
    $sql = "INSERT INTO users
            (username, password_hash, role, is_active)
            VALUES (:username, :password_hash, :role, 1)";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        'username' => $username,
        'password_hash' => $hashedPassword,
        'role' => $role
    ]);

    echo "Account created successfully for: $username ($role)\n";

} catch (PDOException $error) {
    if ($error->getCode() === '23000') {
        exit("Username already exists or violates a database constraint.\n");
    }

    error_log($error->getMessage());
    exit("Unable to create account. Check the local PHP error log.\n");
}
