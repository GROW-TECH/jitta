<?php
/**
 * Seed Default Administrator Account
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/utils/Security.php';

try {
    $db = Database::getInstance()->getConnection();

    // Check table structure
    $stmt = $db->query("DESCRIBE admin_users");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "Columns in admin_users: " . implode(', ', $columns) . "\n";

    $email = 'admin@redtaxi.in';
    $password = 'admin123';
    $hash = Security::hashPassword($password);

    $checkStmt = $db->prepare("SELECT id FROM admin_users WHERE email = ?");
    $checkStmt->execute(array($email));
    $existing = $checkStmt->fetch();

    if ($existing) {
        $update = $db->prepare("UPDATE admin_users SET password_hash = ?, is_active = 1, role = 'SUPER_ADMIN' WHERE email = ?");
        $update->execute(array($hash, $email));
        echo "Admin account updated: {$email} (Password: {$password})\n";
    } else {
        $id = Security::generateUUID();
        $insert = $db->prepare("INSERT INTO admin_users (id, name, email, password_hash, phone, role, is_active, created_at, updated_at) VALUES (?, 'System Administrator', ?, ?, '9000000000', 'SUPER_ADMIN', 1, NOW(), NOW())");
        $insert->execute(array($id, $email, $hash));
        echo "Admin account created: {$email} (Password: {$password})\n";
    }

    $verify = $db->prepare("SELECT id, name, email, role, is_active FROM admin_users WHERE email = ?");
    $verify->execute(array($email));
    $user = $verify->fetch();
    echo "Verification: " . json_encode($user) . "\n";

} catch (Exception $e) {
    echo "Error seeding admin: " . $e->getMessage() . "\n";
    exit(1);
}
