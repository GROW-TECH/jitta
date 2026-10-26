<?php
/**
 * RedTaxi — DRIVER ONLY Feature Migration
 * Run in your browser: http://localhost:8001/migrate_driver_only.php
 *
 * Adds:
 *   1. `DRIVER_ONLY` value to `bookings.ride_type` enum
 *   2. `bookings.customer_vehicle_details` JSON column (customer-owned vehicle)
 *   3. `system_settings` key `driver_only_rate_per_hour` (default ₹200/hr)
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: text/html; charset=utf-8');

$envPath = __DIR__ . '/.env';
$config = array(
    'DB_HOST' => 'localhost',
    'DB_PORT' => '3306',
    'DB_NAME' => 'redtaxi_db',
    'DB_USER' => 'root',
    'DB_PASS' => ''
);

if (file_exists($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
        list($k, $v) = explode('=', $line, 2);
        $k = trim($k);
        $v = trim($v, " \t\n\r\0\x0B\"'");
        if (array_key_exists($k, $config)) {
            $config[$k] = $v;
        }
    }
}

echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Driver Only Migration</title>';
echo '<style>body{font-family:monospace;background:#0f172a;color:#e2e8f0;padding:30px}span{display:block;padding:4px 0}.ok{color:#34d399}.err{color:#f87171}.warn{color:#fbbf24}</style></head><body>';

try {
    $dsn = "mysql:host={$config['DB_HOST']};port={$config['DB_PORT']};dbname={$config['DB_NAME']};charset=utf8mb4";
    $pdo = new PDO($dsn, $config['DB_USER'], $config['DB_PASS'], array(
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ));
    echo "<span class='ok'>Connected to {$config['DB_NAME']}</span>";
} catch (PDOException $e) {
    echo "<span class='err'>Connection failed: " . htmlspecialchars($e->getMessage()) . "</span></body></html>";
    exit;
}

function runSql($pdo, $label, $sql) {
    try {
        $pdo->exec($sql);
        echo "<span class='ok'>{$label}</span>";
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate column') !== false || strpos($e->getMessage(), 'already exists') !== false) {
            echo "<span class='warn'>{$label} (already applied, skipping)</span>";
        } else {
            echo "<span class='err'>{$label} FAILED: " . htmlspecialchars($e->getMessage()) . "</span>";
        }
    }
}

// 1. Extend ride_type enum
runSql($pdo, 'Extending bookings.ride_type enum with DRIVER_ONLY', "
    ALTER TABLE `bookings`
    MODIFY COLUMN `ride_type` enum('CITY','RENTAL','OUTSTATION','AIRPORT','DRIVER_ONLY') NOT NULL
");

// 2. Add customer_vehicle_details JSON column
runSql($pdo, 'Adding bookings.customer_vehicle_details column', "
    ALTER TABLE `bookings`
    ADD COLUMN `customer_vehicle_details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
    COMMENT 'Driver-only mode: customer-owned vehicle details' AFTER `airport_details`
");

// 3. Ensure system_settings table and seed driver-only hourly rate
runSql($pdo, 'Creating system_settings table', "
    CREATE TABLE IF NOT EXISTS `system_settings` (
        `k` varchar(100) NOT NULL PRIMARY KEY,
        `v` text,
        `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

try {
    $pdo->exec("INSERT INTO `system_settings` (`k`, `v`, `updated_at`) VALUES ('driver_only_rate_per_hour', '200', NOW())
                ON DUPLICATE KEY UPDATE `v` = VALUES(`v`), `updated_at` = NOW()");
    echo "<span class='ok'>Seeded driver_only_rate_per_hour = 200</span>";
} catch (PDOException $e) {
    echo "<span class='err'>Seed failed: " . htmlspecialchars($e->getMessage()) . "</span>";
}

echo "<span class='ok'>Migration complete.</span></body></html>";