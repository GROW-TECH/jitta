<?php
require_once __DIR__ . '/config/database.php';
$db = Database::getInstance()->getConnection();

$tables = array(
    'cities',
    'system_settings',
    'vehicle_categories',
    'fare_rules',
    'admin_users',
    'customers',
    'customer_wallets',
    'customer_saved_places',
    'customer_wallet_transactions',
    'drivers',
    'driver_vehicles',
    'driver_documents',
    'driver_wallets',
    'driver_wallet_transactions',
    'coupons',
    'offers',
    'bookings',
    'booking_locations',
    'payments',
    'cancellations',
    'coupon_usage',
    'notifications',
    'support_tickets',
    'support_messages',
    'sos_alerts',
    'otp_verifications',
    'chat_messages'
);

$sql = "-- RedTaxi Complete Production Database Dump\n";
$sql .= "-- Compatible with phpMyAdmin, MySQL 5.7+, MySQL 8.0+, MariaDB 10.x\n\n";
$sql .= "SET FOREIGN_KEY_CHECKS = 0;\n";
$sql .= "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n";
$sql .= "SET AUTOCOMMIT = 0;\n";
$sql .= "START TRANSACTION;\n";
$sql .= "SET time_zone = '+00:00';\n\n";

// 1. Drop all tables
foreach ($tables as $t) {
    $sql .= "DROP TABLE IF EXISTS `" . $t . "`;\n";
}
$sql .= "\n";

// 2. Create tables & insert data in exact dependency order
foreach ($tables as $t) {
    $stmt = $db->query("SHOW CREATE TABLE `" . $t . "`");
    $create = $stmt->fetch(PDO::FETCH_ASSOC);
    $createSql = $create['Create Table'];
    $sql .= "-- Table structure for `" . $t . "`\n";
    $sql .= $createSql . ";\n\n";

    $rows = $db->query("SELECT * FROM `" . $t . "`")->fetchAll(PDO::FETCH_ASSOC);
    if (!empty($rows)) {
        $sql .= "-- Data for `" . $t . "`\n";
        $cols = array_keys($rows[0]);
        $colNames = implode("`, `", $cols);
        $sql .= "INSERT INTO `" . $t . "` (`" . $colNames . "`) VALUES\n";
        $valStrings = array();
        foreach ($rows as $row) {
            $vals = array();
            foreach ($row as $val) {
                if ($val === null) {
                    $vals[] = 'NULL';
                } else {
                    $vals[] = $db->quote($val);
                }
            }
            $valStrings[] = "  (" . implode(', ', $vals) . ")";
        }
        $sql .= implode(",\n", $valStrings) . ";\n\n";
    }
}

$sql .= "COMMIT;\n";
$sql .= "SET FOREIGN_KEY_CHECKS = 1;\n";

file_put_contents(__DIR__ . '/../database/redtaxi_complete_production.sql', $sql);
echo "Export completed successfully: " . strlen($sql) . " bytes written.\n";
