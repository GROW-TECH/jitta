<?php
/**
 * Migration for Tamil Nadu Places & Landmarks Database
 * redtaxi_db -> `places` table
 */

require_once __DIR__ . '/config/database.php';

try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    echo "Verifying and updating `places` table schema in redtaxi_db...\n";

    // 1. Create base table if not exists
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `places` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `place_id` VARCHAR(100) UNIQUE,
            `source_id` VARCHAR(100) NULL,
            `primary_text` VARCHAR(150) NOT NULL,
            `secondary_text` VARCHAR(250) NOT NULL,
            `full_text` VARCHAR(350) NOT NULL,
            `locality` VARCHAR(120) NULL,
            `city` VARCHAR(80) NOT NULL DEFAULT 'Salem',
            `district` VARCHAR(80) NOT NULL DEFAULT 'Salem',
            `state` VARCHAR(50) NOT NULL DEFAULT 'Tamil Nadu',
            `pincode` VARCHAR(10) NULL,
            `category` VARCHAR(50) NOT NULL DEFAULT 'LOCALITY',
            `place_type` VARCHAR(50) NOT NULL DEFAULT 'LOCALITY',
            `normalized_name` VARCHAR(150) NULL,
            `lat` DECIMAL(10, 7) NOT NULL,
            `lng` DECIMAL(10, 7) NOT NULL,
            `search_weight` INT NOT NULL DEFAULT 10
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 2. Add any missing columns to existing table
    $existingCols = [];
    $stmt = $pdo->query("SHOW COLUMNS FROM `places`");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $existingCols[$row['Field']] = true;
    }

    if (!isset($existingCols['source_id'])) {
        $pdo->exec("ALTER TABLE `places` ADD COLUMN `source_id` VARCHAR(100) NULL AFTER `place_id`");
        echo " - Added column `source_id`\n";
    }
    if (!isset($existingCols['locality'])) {
        $pdo->exec("ALTER TABLE `places` ADD COLUMN `locality` VARCHAR(120) NULL AFTER `full_text`");
        echo " - Added column `locality`\n";
    }
    if (!isset($existingCols['place_type'])) {
        $pdo->exec("ALTER TABLE `places` ADD COLUMN `place_type` VARCHAR(50) NOT NULL DEFAULT 'LOCALITY' AFTER `category`");
        echo " - Added column `place_type`\n";
    }
    if (!isset($existingCols['normalized_name'])) {
        $pdo->exec("ALTER TABLE `places` ADD COLUMN `normalized_name` VARCHAR(150) NULL AFTER `place_type`");
        echo " - Added column `normalized_name`\n";
    }

    // 3. Verify and create indexes
    $existingIndexes = [];
    $idxStmt = $pdo->query("SHOW INDEX FROM `places`");
    while ($row = $idxStmt->fetch(PDO::FETCH_ASSOC)) {
        $existingIndexes[$row['Key_name']] = true;
    }

    if (!isset($existingIndexes['idx_source_id'])) {
        $pdo->exec("ALTER TABLE `places` ADD INDEX `idx_source_id` (`source_id`)");
        echo " - Created index `idx_source_id`\n";
    }
    if (!isset($existingIndexes['idx_primary_prefix'])) {
        $pdo->exec("ALTER TABLE `places` ADD INDEX `idx_primary_prefix` (`primary_text`(50))");
        echo " - Created index `idx_primary_prefix`\n";
    }
    if (!isset($existingIndexes['idx_normalized_name'])) {
        $pdo->exec("ALTER TABLE `places` ADD INDEX `idx_normalized_name` (`normalized_name`(50))");
        echo " - Created index `idx_normalized_name`\n";
    }
    if (!isset($existingIndexes['idx_place_type'])) {
        $pdo->exec("ALTER TABLE `places` ADD INDEX `idx_place_type` (`place_type`)");
        echo " - Created index `idx_place_type`\n";
    }
    if (!isset($existingIndexes['idx_locality'])) {
        $pdo->exec("ALTER TABLE `places` ADD INDEX `idx_locality` (`locality`)");
        echo " - Created index `idx_locality`\n";
    }
    if (!isset($existingIndexes['ft_places_search'])) {
        $pdo->exec("ALTER TABLE `places` ADD FULLTEXT `ft_places_search` (`primary_text`, `secondary_text`, `full_text`)");
        echo " - Created fulltext index `ft_places_search`\n";
    }

    echo "Table `places` schema and indexes verified successfully!\n";

} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
