<?php
/**
 * REAPERZ Members JSON API Endpoint (PHP/MySQL)
 */
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/db.php";

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $search = trim($_GET['search'] ?? '');
        $role = trim($_GET['role'] ?? '');

        $sql = "SELECT id, name, role, game, discord, status, avatar, joined_at FROM members WHERE 1=1";
        $params = [];

        if ($search !== '') {
            $sql .= " AND (name LIKE :search OR game LIKE :search OR discord LIKE :search)";
            $params[':search'] = "%{$search}%";
        }
        if ($role !== '' && strtolower($role) !== 'all') {
            $sql .= " AND role = :role";
            $params[':role'] = $role;
        }
        $sql .= " ORDER BY id DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);

        echo json_encode([
            'success' => true,
            'count' => $stmt->rowCount(),
            'members' => $stmt->fetchAll()
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Unable to query members.']);
    }
    exit;
}

if ($method === 'POST') {
    try {
        $input = json_decode(file_get_contents("php://input"), true) ?: $_POST;
        $name = trim($input['name'] ?? '');
        $role = trim($input['role'] ?? 'Member');
        $game = trim($input['game'] ?? 'GTA V / FiveM');
        $discord = trim($input['discord'] ?? '');
        $status = trim($input['status'] ?? 'Online');

        if ($name === '') {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'Member name is required.']);
            exit;
        }

        $stmt = $conn->prepare("INSERT INTO members (name, role, game, discord, status) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$name, $role, $game, $discord, $status]);

        echo json_encode([
            'success' => true,
            'id' => $conn->lastInsertId(),
            'message' => 'Member added successfully.'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to add member.']);
    }
    exit;
}
?>
