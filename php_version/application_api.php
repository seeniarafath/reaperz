<?php
/**
 * REAPERZ Join Applications API Endpoint (PHP/MySQL)
 */
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/db.php";

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $stmt = $conn->query("SELECT * FROM applications ORDER BY id DESC");
        echo json_encode([
            'success' => true,
            'applications' => $stmt->fetchAll()
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to load applications.']);
    }
    exit;
}

if ($method === 'POST') {
    try {
        $data = json_decode(file_get_contents("php://input"), true) ?: $_POST;
        $name = trim($data["name"] ?? "");
        $discord = trim($data["discord"] ?? "");
        $age = (int)($data["age"] ?? 0);
        $game = trim($data["game"] ?? "");
        $role = trim($data["role"] ?? "Member");
        $timezone = trim($data["timezone"] ?? "IST");
        $about = trim($data["about"] ?? "");

        if ($name === "" || $discord === "" || $age < 13 || $age > 80 || $game === "") {
            http_response_code(422);
            echo json_encode(["success" => false, "message" => "Please fill all required application fields."]);
            exit;
        }

        $stmt = $conn->prepare("INSERT INTO applications (name, discord, age, game, role, timezone, about) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$name, $discord, $age, $game, $role, $timezone, $about]);

        echo json_encode([
            "success" => true,
            "application_id" => $conn->lastInsertId(),
            "message" => "Application submitted successfully."
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Database error saving application."]);
    }
    exit;
}

if ($method === 'PATCH') {
    try {
        $data = json_decode(file_get_contents("php://input"), true);
        $id = (int)($data['id'] ?? $_GET['id'] ?? 0);
        $status = trim($data['status'] ?? '');

        if (!$id || !in_array($status, ['Pending', 'Approved', 'Rejected'])) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'Invalid ID or status value.']);
            exit;
        }

        $stmt = $conn->prepare("UPDATE applications SET status = ? WHERE id = ?");
        $stmt->execute([$status, $id]);

        echo json_encode(['success' => true, 'message' => "Application marked as $status."]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error updating status.']);
    }
    exit;
}
?>
