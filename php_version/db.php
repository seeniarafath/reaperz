<?php
/**
 * REAPERZ Community - MySQL PDO Connection
 */

$host = getenv('DB_HOST') ?: 'localhost';
$dbname = getenv('DB_NAME') ?: 'reaperz';
$username = getenv('DB_USER') ?: 'root';
$password = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';

try {
    $conn = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    if (php_sapi_name() === 'cli' || headers_sent()) {
        die("Database connection failed: " . $e->getMessage());
    } else {
        header('Content-Type: application/json; charset=utf-8');
        die(json_encode([
            'success' => false,
            'message' => 'Database connection failed. Please verify MySQL configuration.'
        ]));
    }
}
?>
