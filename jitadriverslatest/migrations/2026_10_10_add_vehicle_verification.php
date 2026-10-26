<?php
/**
 * Migration: Add Vehicle Verification columns to `bookings` table.
 * Preserves all existing records, idempotent, and backfills existing customer_vehicle_details.
 * Compatible with PHP 5.6+ and MariaDB/MySQL.
 */

require_once __DIR__ . '/../config/database.php';

try {
    $db = Database::getInstance()->getConnection();
    echo "[MIGRATION] Checking bookings table schema...\n";

    // 1. Get existing columns
    $stmt = $db->query("SHOW COLUMNS FROM `bookings`");
    $existing = array();
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $existing[strtolower($row['Field'])] = true;
    }

    $colDefs = array(
        'vehicle_reg_no'               => "VARCHAR(20) NULL DEFAULT NULL AFTER `customer_vehicle_details`",
        'vehicle_reg_normalized'        => "VARCHAR(20) NULL DEFAULT NULL AFTER `vehicle_reg_no`",
        'vehicle_verification_status'  => "ENUM('NOT_PROVIDED','FORMAT_VALID','VERIFICATION_PENDING','VERIFIED','VERIFICATION_FAILED','VERIFICATION_UNAVAILABLE') NOT NULL DEFAULT 'NOT_PROVIDED' AFTER `vehicle_reg_normalized`",
        'vehicle_verified_at'          => "DATETIME NULL DEFAULT NULL AFTER `vehicle_verification_status`",
        'vehicle_verification_provider' => "VARCHAR(50) NULL DEFAULT NULL AFTER `vehicle_verified_at`",
        'vehicle_verification_details' => "TEXT NULL DEFAULT NULL AFTER `vehicle_verification_provider`",
        'driver_vehicle_confirmed'     => "TINYINT(1) NOT NULL DEFAULT 0 AFTER `vehicle_verification_details`",
        'driver_vehicle_confirmed_at'  => "DATETIME NULL DEFAULT NULL AFTER `driver_vehicle_confirmed`",
        'driver_mismatch_reported'     => "TINYINT(1) NOT NULL DEFAULT 0 AFTER `driver_vehicle_confirmed_at`",
        'driver_mismatch_reason'       => "VARCHAR(255) NULL DEFAULT NULL AFTER `driver_mismatch_reported`"
    );

    foreach ($colDefs as $colName => $def) {
        if (!isset($existing[$colName])) {
            $sql = "ALTER TABLE `bookings` ADD COLUMN `{$colName}` {$def}";
            $db->exec($sql);
            echo "  + Added column `{$colName}`\n";
        } else {
            echo "  = Column `{$colName}` already exists\n";
        }
    }

    // 2. Add indexes safely
    $idxStmt = $db->query("SHOW INDEX FROM `bookings`");
    $existingIndexes = array();
    while ($row = $idxStmt->fetch(PDO::FETCH_ASSOC)) {
        $existingIndexes[strtolower($row['Key_name'])] = true;
    }

    if (!isset($existingIndexes['idx_bookings_veh_reg_norm'])) {
        $db->exec("ALTER TABLE `bookings` ADD INDEX `idx_bookings_veh_reg_norm` (`vehicle_reg_normalized`)");
        echo "  + Added index `idx_bookings_veh_reg_norm`\n";
    }

    if (!isset($existingIndexes['idx_bookings_veh_verif_status'])) {
        $db->exec("ALTER TABLE `bookings` ADD INDEX `idx_bookings_veh_verif_status` (`vehicle_verification_status`)");
        echo "  + Added index `idx_bookings_veh_verif_status`\n";
    }

    // 3. Backfill existing records from customer_vehicle_details JSON
    echo "[MIGRATION] Backfilling existing records...\n";
    $backfillQuery = $db->query("SELECT `id`, `customer_vehicle_details` FROM `bookings` WHERE `customer_vehicle_details` IS NOT NULL AND `vehicle_reg_no` IS NULL");
    $updatedCount = 0;
    while ($bRow = $backfillQuery->fetch(PDO::FETCH_ASSOC)) {
        $json = @json_decode($bRow['customer_vehicle_details'], true);
        if (is_array($json) && !empty($json['number'])) {
            $rawNo = trim((string)$json['number']);
            $normNo = strtoupper(preg_replace('/[^A-Z0-9]/', '', $rawNo));
            $uStmt = $db->prepare("UPDATE `bookings` SET `vehicle_reg_no` = ?, `vehicle_reg_normalized` = ?, `vehicle_verification_status` = 'FORMAT_VALID' WHERE `id` = ?");
            $uStmt->execute(array($rawNo, $normNo, $bRow['id']));
            $updatedCount++;
        }
    }
    echo "  * Backfilled {$updatedCount} existing booking records.\n";

    echo "[MIGRATION] Completed successfully!\n";
} catch (Exception $e) {
    echo "[MIGRATION ERROR] " . $e->getMessage() . "\n";
    exit(1);
}
