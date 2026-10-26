<?php
/**
 * RedTaxi — Server Database Migration Script
 * Run this in your browser: https://yoursite.com/redtaxi/api/migrate.php
 * 
 * What it does:
 *   1. Reads DB credentials from .env
 *   2. Connects to your MySQL database
 *   3. Creates all 26 RedTaxi tables
 *   4. Seeds essential data (admin, cities, vehicles, fare rules, demo drivers)
 *   5. Verifies everything is working
 *
 * Compatible with PHP 5.6+ and MySQL 5.5+ / MariaDB 10.x
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: text/html; charset=utf-8');

// ─── Load .env ──────────────────────────────────────────────────────────────
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

$dbHost = $config['DB_HOST'];
$dbPort = $config['DB_PORT'];
$dbName = $config['DB_NAME'];
$dbUser = $config['DB_USER'];
$dbPass = $config['DB_PASS'];

// ─── HTML Output Start ──────────────────────────────────────────────────────
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RedTaxi — Database Migration</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0f172a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 30px 15px; display: flex; justify-content: center; }
  .wrap { max-width: 760px; width: 100%; background: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155; box-shadow: 0 20px 25px rgba(0,0,0,0.5); }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .sub { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
  .logo { display: inline-block; background: #dc2626; color: #fff; font-weight: 900; font-size: 20px; padding: 8px 16px; border-radius: 10px; margin-bottom: 16px; }
  .step { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px; font-size: 14px; line-height: 1.6; }
  .ok { color: #34d399; } .ok::before { content: '✓ '; }
  .fail { color: #f87171; } .fail::before { content: '✗ '; }
  .info { color: #60a5fa; } .info::before { content: 'ℹ '; }
  .warn { color: #fbbf24; } .warn::before { content: '⚠ '; }
  .summary { margin-top: 20px; padding: 18px; border-radius: 12px; font-size: 15px; }
  .summary-ok { background: #064e3b; border: 1px solid #059669; color: #a7f3d0; }
  .summary-fail { background: #450a0a; border: 1px solid #dc2626; color: #fecaca; }
  a.btn { display: inline-block; background: #dc2626; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 12px; margin-right: 10px; }
  a.btn:hover { background: #b91c1c; }
  a.btn-green { background: #059669; } a.btn-green:hover { background: #047857; }
  code { background: #334155; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
</style>
</head>
<body>
<div class="wrap">
<div class="logo">REDTAXI</div>
<h1>Database Migration</h1>
<p class="sub">Creating all 26 tables and seeding essential data into <code><?php echo htmlspecialchars($dbName); ?></code></p>

<?php
// ─── Connect ────────────────────────────────────────────────────────────────
echo '<div class="step">';
echo '<strong>Step 1: Connecting to MySQL...</strong><br>';
echo "<span class='info'>Host: {$dbHost}:{$dbPort} | Database: {$dbName} | User: {$dbUser}</span><br>";

try {
    $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
    $pdo = new PDO($dsn, $dbUser, $dbPass, array(
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ));
    echo "<span class='ok'>Connected successfully to MySQL</span>";
} catch (PDOException $e) {
    echo "<span class='fail'>Connection failed: " . htmlspecialchars($e->getMessage()) . "</span><br>";
    echo "<span class='warn'>Please fix your credentials in <code>api/.env</code> or run <a href='setup.php' style='color:#60a5fa'>setup.php</a> first.</span>";
    echo '</div></div></body></html>';
    exit;
}
echo '</div>';

// ─── Create Tables ──────────────────────────────────────────────────────────
echo '<div class="step">';
echo '<strong>Step 2: Creating all 26 tables...</strong><br>';

$tableErrors = 0;

// Helper to run SQL and report
function runSQL($pdo, $label, $sql, &$errors) {
    try {
        $pdo->exec($sql);
        echo "<span class='ok'>{$label}</span><br>";
    } catch (PDOException $e) {
        // Ignore "already exists" errors
        if (strpos($e->getMessage(), 'already exists') !== false) {
            echo "<span class='info'>{$label} (already exists, skipping)</span><br>";
        } else {
            echo "<span class='fail'>{$label}: " . htmlspecialchars($e->getMessage()) . "</span><br>";
            $errors++;
        }
    }
}

$pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

// ── 1. cities
runSQL($pdo, 'Table: cities', "
CREATE TABLE IF NOT EXISTS `cities` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `state` VARCHAR(100) NOT NULL,
  `country` VARCHAR(50) NOT NULL DEFAULT 'India',
  `lat` DECIMAL(10,7) NOT NULL,
  `lng` DECIMAL(10,7) NOT NULL,
  `radius_km` DECIMAL(6,2) NOT NULL DEFAULT 50.00,
  `timezone` VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cities_name` (`name`),
  INDEX `idx_cities_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 2. customers
runSQL($pdo, 'Table: customers', "
CREATE TABLE IF NOT EXISTS `customers` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(15) NOT NULL,
  `email` VARCHAR(150) NULL,
  `password_hash` VARCHAR(255) NULL,
  `avatar_url` VARCHAR(500) NULL,
  `city_id` INT UNSIGNED NULL,
  `status` ENUM('ACTIVE','BLOCKED','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  `total_rides` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customers_phone` (`phone`),
  INDEX `idx_customers_email` (`email`),
  INDEX `idx_customers_status` (`status`),
  INDEX `idx_customers_city` (`city_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 3. customer_saved_places
runSQL($pdo, 'Table: customer_saved_places', "
CREATE TABLE IF NOT EXISTS `customer_saved_places` (
  `id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `label` VARCHAR(30) NOT NULL DEFAULT 'Other',
  `custom_label` VARCHAR(100) NULL,
  `address` VARCHAR(500) NOT NULL,
  `lat` DECIMAL(10,7) NOT NULL,
  `lng` DECIMAL(10,7) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_saved_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 4. customer_wallets
runSQL($pdo, 'Table: customer_wallets', "
CREATE TABLE IF NOT EXISTS `customer_wallets` (
  `id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cw_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 5. customer_wallet_transactions
runSQL($pdo, 'Table: customer_wallet_transactions', "
CREATE TABLE IF NOT EXISTS `customer_wallet_transactions` (
  `id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `type` ENUM('CREDIT','DEBIT') NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `description` VARCHAR(255) NULL,
  `reference_id` CHAR(36) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_cwt_customer` (`customer_id`),
  INDEX `idx_cwt_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 6. vehicle_categories
runSQL($pdo, 'Table: vehicle_categories', "
CREATE TABLE IF NOT EXISTS `vehicle_categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `description` VARCHAR(255) NULL,
  `icon_url` VARCHAR(500) NULL,
  `seat_capacity` TINYINT UNSIGNED NOT NULL DEFAULT 4,
  `base_fare` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `per_km_fare` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `per_min_fare` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `minimum_fare` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `cancellation_fee` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_vc_code` (`code`),
  INDEX `idx_vc_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 7. fare_rules
runSQL($pdo, 'Table: fare_rules', "
CREATE TABLE IF NOT EXISTS `fare_rules` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `city_id` INT UNSIGNED NULL,
  `vehicle_category_id` INT UNSIGNED NOT NULL,
  `base_fare` DECIMAL(8,2) NOT NULL,
  `per_km_fare` DECIMAL(6,2) NOT NULL,
  `per_min_fare` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `minimum_fare` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `surge_multiplier` DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  `night_surge_multiplier` DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  `cancellation_fee` DECIMAL(8,2) NOT NULL DEFAULT 50.00,
  `waiting_charge_per_min` DECIMAL(6,2) NOT NULL DEFAULT 2.00,
  `free_waiting_minutes` INT NOT NULL DEFAULT 5,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_fr_city` (`city_id`),
  INDEX `idx_fr_vehicle` (`vehicle_category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 8. drivers
runSQL($pdo, 'Table: drivers', "
CREATE TABLE IF NOT EXISTS `drivers` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(15) NOT NULL,
  `email` VARCHAR(150) NULL,
  `password_hash` VARCHAR(255) NULL,
  `avatar_url` VARCHAR(500) NULL,
  `city_id` INT UNSIGNED NULL,
  `approval_status` ENUM('PENDING','APPROVED','SUSPENDED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `is_online` TINYINT(1) NOT NULL DEFAULT 0,
  `is_on_ride` TINYINT(1) NOT NULL DEFAULT 0,
  `current_lat` DECIMAL(10,7) NULL,
  `current_lng` DECIMAL(10,7) NULL,
  `rating_avg` DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  `total_rides` INT UNSIGNED NOT NULL DEFAULT 0,
  `total_earnings` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_drivers_phone` (`phone`),
  INDEX `idx_drivers_status` (`approval_status`),
  INDEX `idx_drivers_online` (`is_online`),
  INDEX `idx_drivers_city` (`city_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 9. driver_vehicles
runSQL($pdo, 'Table: driver_vehicles', "
CREATE TABLE IF NOT EXISTS `driver_vehicles` (
  `id` CHAR(36) NOT NULL,
  `driver_id` CHAR(36) NOT NULL,
  `vehicle_category_id` INT UNSIGNED NULL,
  `vehicle_make` VARCHAR(50) NULL,
  `vehicle_model` VARCHAR(100) NOT NULL,
  `vehicle_number` VARCHAR(20) NOT NULL,
  `vehicle_color` VARCHAR(30) NULL,
  `vehicle_year` YEAR NULL,
  `is_primary` TINYINT(1) NOT NULL DEFAULT 1,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_dv_driver` (`driver_id`),
  INDEX `idx_dv_number` (`vehicle_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 10. admin_users
runSQL($pdo, 'Table: admin_users', "
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(15) NULL,
  `role` ENUM('SUPER_ADMIN','ADMIN') NOT NULL DEFAULT 'ADMIN',
  `city_id` INT UNSIGNED NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_login_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_email` (`email`),
  INDEX `idx_admin_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 11. driver_documents
runSQL($pdo, 'Table: driver_documents', "
CREATE TABLE IF NOT EXISTS `driver_documents` (
  `id` CHAR(36) NOT NULL,
  `driver_id` CHAR(36) NOT NULL,
  `document_type` VARCHAR(50) NOT NULL,
  `document_number` VARCHAR(50) NULL,
  `file_url` VARCHAR(500) NULL,
  `status` ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `expiry_date` DATE NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_dd_driver` (`driver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 12. driver_wallets
runSQL($pdo, 'Table: driver_wallets', "
CREATE TABLE IF NOT EXISTS `driver_wallets` (
  `id` CHAR(36) NOT NULL,
  `driver_id` CHAR(36) NOT NULL,
  `balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dw_driver` (`driver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 13. driver_wallet_transactions
runSQL($pdo, 'Table: driver_wallet_transactions', "
CREATE TABLE IF NOT EXISTS `driver_wallet_transactions` (
  `id` CHAR(36) NOT NULL,
  `driver_id` CHAR(36) NOT NULL,
  `type` ENUM('CREDIT','DEBIT') NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `description` VARCHAR(255) NULL,
  `reference_id` CHAR(36) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_dwt_driver` (`driver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 14. coupons
runSQL($pdo, 'Table: coupons', "
CREATE TABLE IF NOT EXISTS `coupons` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(30) NOT NULL,
  `description` VARCHAR(255) NULL,
  `discount_type` ENUM('PERCENTAGE','FLAT') NOT NULL DEFAULT 'FLAT',
  `discount_value` DECIMAL(8,2) NOT NULL,
  `max_discount` DECIMAL(8,2) NULL,
  `min_order_amount` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `max_uses` INT NULL,
  `used_count` INT NOT NULL DEFAULT 0,
  `max_uses_per_user` INT NOT NULL DEFAULT 1,
  `valid_from` TIMESTAMP NULL,
  `valid_until` TIMESTAMP NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_coupons_code` (`code`),
  INDEX `idx_coupons_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 15. offers
runSQL($pdo, 'Table: offers', "
CREATE TABLE IF NOT EXISTS `offers` (
  `id` CHAR(36) NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `image_url` VARCHAR(500) NULL,
  `offer_type` ENUM('BANNER','POPUP','INLINE') NOT NULL DEFAULT 'BANNER',
  `target_audience` ENUM('ALL','NEW_USERS','RETURNING') NOT NULL DEFAULT 'ALL',
  `action_url` VARCHAR(500) NULL,
  `coupon_id` CHAR(36) NULL,
  `priority` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `starts_at` TIMESTAMP NULL,
  `ends_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_offers_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 16. bookings
runSQL($pdo, 'Table: bookings', "
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `driver_id` CHAR(36) NULL,
  `vehicle_category_id` INT UNSIGNED NULL,
  `status` ENUM('SEARCHING','ASSIGNED','EN_ROUTE','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'SEARCHING',
  `pickup_address` VARCHAR(500) NOT NULL,
  `pickup_lat` DECIMAL(10,7) NOT NULL,
  `pickup_lng` DECIMAL(10,7) NOT NULL,
  `dropoff_address` VARCHAR(500) NOT NULL,
  `dropoff_lat` DECIMAL(10,7) NOT NULL,
  `dropoff_lng` DECIMAL(10,7) NOT NULL,
  `estimated_distance_km` DECIMAL(8,2) NULL,
  `estimated_duration_min` INT NULL,
  `estimated_fare` DECIMAL(10,2) NULL,
  `actual_distance_km` DECIMAL(8,2) NULL,
  `actual_duration_min` INT NULL,
  `final_fare` DECIMAL(10,2) NULL,
  `payment_method` ENUM('CASH','WALLET','UPI','CARD') NOT NULL DEFAULT 'CASH',
  `payment_status` ENUM('PENDING','PAID','REFUNDED','FAILED') NOT NULL DEFAULT 'PENDING',
  `otp` VARCHAR(6) NULL,
  `coupon_id` CHAR(36) NULL,
  `discount_amount` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `surge_multiplier` DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  `driver_rating` TINYINT NULL,
  `driver_feedback` TEXT NULL,
  `customer_rating` TINYINT NULL,
  `customer_feedback` TEXT NULL,
  `scheduled_at` TIMESTAMP NULL,
  `accepted_at` TIMESTAMP NULL,
  `arrived_at` TIMESTAMP NULL,
  `started_at` TIMESTAMP NULL,
  `completed_at` TIMESTAMP NULL,
  `cancelled_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_b_customer` (`customer_id`),
  INDEX `idx_b_driver` (`driver_id`),
  INDEX `idx_b_status` (`status`),
  INDEX `idx_b_created` (`created_at`),
  INDEX `idx_b_payment` (`payment_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 17. booking_locations
runSQL($pdo, 'Table: booking_locations', "
CREATE TABLE IF NOT EXISTS `booking_locations` (
  `id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NOT NULL,
  `type` ENUM('PICKUP','DROPOFF','WAYPOINT','DRIVER_LOCATION') NOT NULL,
  `address` VARCHAR(500) NULL,
  `lat` DECIMAL(10,7) NOT NULL,
  `lng` DECIMAL(10,7) NOT NULL,
  `recorded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_bl_booking` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 18. payments
runSQL($pdo, 'Table: payments', "
CREATE TABLE IF NOT EXISTS `payments` (
  `id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `driver_id` CHAR(36) NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `method` ENUM('CASH','WALLET','UPI','CARD') NOT NULL DEFAULT 'CASH',
  `status` ENUM('PENDING','COMPLETED','REFUNDED','FAILED') NOT NULL DEFAULT 'PENDING',
  `gateway_txn_id` VARCHAR(100) NULL,
  `metadata` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pay_booking` (`booking_id`),
  INDEX `idx_pay_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 19. cancellations
runSQL($pdo, 'Table: cancellations', "
CREATE TABLE IF NOT EXISTS `cancellations` (
  `id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NOT NULL,
  `cancelled_by` ENUM('CUSTOMER','DRIVER','ADMIN','SYSTEM') NOT NULL,
  `cancelled_by_id` CHAR(36) NULL,
  `reason` VARCHAR(255) NULL,
  `penalty_amount` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_canc_booking` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 20. coupon_usage
runSQL($pdo, 'Table: coupon_usage', "
CREATE TABLE IF NOT EXISTS `coupon_usage` (
  `id` CHAR(36) NOT NULL,
  `coupon_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NULL,
  `discount_amount` DECIMAL(8,2) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_cu_coupon` (`coupon_id`),
  INDEX `idx_cu_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 21. notifications
runSQL($pdo, 'Table: notifications', "
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `user_type` ENUM('CUSTOMER','DRIVER','ADMIN') NULL,
  `audience` ENUM('ALL','CUSTOMERS','DRIVERS') NULL,
  `title` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `type` ENUM('RIDE_UPDATE','PAYMENT','PROMO','SYSTEM','ALERT') NOT NULL DEFAULT 'SYSTEM',
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `data_payload` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_notif_user` (`user_id`, `user_type`),
  INDEX `idx_notif_audience` (`audience`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 22. support_tickets
runSQL($pdo, 'Table: support_tickets', "
CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `user_type` ENUM('CUSTOMER','DRIVER') NOT NULL,
  `booking_id` CHAR(36) NULL,
  `subject` VARCHAR(200) NOT NULL,
  `status` ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  `priority` ENUM('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_st_user` (`user_id`, `user_type`),
  INDEX `idx_st_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 23. support_messages
runSQL($pdo, 'Table: support_messages', "
CREATE TABLE IF NOT EXISTS `support_messages` (
  `id` CHAR(36) NOT NULL,
  `ticket_id` CHAR(36) NOT NULL,
  `sender_type` ENUM('USER','ADMIN') NOT NULL,
  `sender_id` CHAR(36) NULL,
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_sm_ticket` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 24. sos_alerts
runSQL($pdo, 'Table: sos_alerts', "
CREATE TABLE IF NOT EXISTS `sos_alerts` (
  `id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NOT NULL,
  `triggered_by` ENUM('CUSTOMER','DRIVER') NOT NULL,
  `triggered_by_id` CHAR(36) NOT NULL,
  `lat` DECIMAL(10,7) NULL,
  `lng` DECIMAL(10,7) NULL,
  `status` ENUM('ACTIVE','RESOLVED','FALSE_ALARM') NOT NULL DEFAULT 'ACTIVE',
  `notes` TEXT NULL,
  `resolved_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_sos_booking` (`booking_id`),
  INDEX `idx_sos_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 25. otp_verifications
runSQL($pdo, 'Table: otp_verifications', "
CREATE TABLE IF NOT EXISTS `otp_verifications` (
  `id` CHAR(36) NOT NULL,
  `phone` VARCHAR(15) NOT NULL,
  `otp` VARCHAR(10) NOT NULL,
  `purpose` ENUM('LOGIN','REGISTRATION','RESET') NOT NULL DEFAULT 'LOGIN',
  `is_used` TINYINT(1) NOT NULL DEFAULT 0,
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_otp_phone` (`phone`, `purpose`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

// ── 26. chat_messages
runSQL($pdo, 'Table: chat_messages', "
CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NOT NULL,
  `sender_type` ENUM('CUSTOMER','DRIVER') NOT NULL,
  `sender_id` CHAR(36) NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_chat_booking` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", $tableErrors);

$pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

echo '</div>';

// ─── Seed Essential Data ────────────────────────────────────────────────────
echo '<div class="step">';
echo '<strong>Step 3: Seeding essential data...</strong><br>';

$seedErrors = 0;

// Helper for UUID
function generateUUID() {
    $data = openssl_random_pseudo_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

// Seed city
$cityCount = $pdo->query("SELECT COUNT(*) FROM cities")->fetchColumn();
if ((int)$cityCount === 0) {
    runSQL($pdo, 'Seed: Default City (Chennai)', "
        INSERT INTO `cities` (`name`, `state`, `country`, `lat`, `lng`, `radius_km`) 
        VALUES ('Chennai', 'Tamil Nadu', 'India', 13.0827000, 80.2707000, 50.00)
    ", $seedErrors);
} else {
    echo "<span class='info'>Cities already seeded ({$cityCount} found)</span><br>";
}

// Seed vehicle categories
$vcCount = $pdo->query("SELECT COUNT(*) FROM vehicle_categories")->fetchColumn();
if ((int)$vcCount === 0) {
    runSQL($pdo, 'Seed: Vehicle Categories (4 types)', "
        INSERT INTO `vehicle_categories` (`name`, `code`, `description`, `seat_capacity`, `base_fare`, `per_km_fare`, `per_min_fare`, `minimum_fare`, `cancellation_fee`, `is_active`, `sort_order`) VALUES
        ('Red Mini', 'MINI', 'Budget-friendly compact rides', 4, 99.00, 14.00, 2.00, 99.00, 25.00, 1, 1),
        ('Red Sedan', 'SEDAN', 'Comfortable sedan rides', 4, 149.00, 18.00, 2.50, 149.00, 50.00, 1, 2),
        ('Red SUV', 'SUV', 'Premium SUV experience', 6, 249.00, 22.00, 3.00, 249.00, 75.00, 1, 3),
        ('Red Outstation', 'OUTSTATION', 'Long-distance inter-city travel', 4, 999.00, 12.00, 0.00, 999.00, 200.00, 1, 4)
    ", $seedErrors);
} else {
    echo "<span class='info'>Vehicle categories already seeded ({$vcCount} found)</span><br>";
}

// Seed fare rules
$frCount = $pdo->query("SELECT COUNT(*) FROM fare_rules")->fetchColumn();
if ((int)$frCount === 0) {
    runSQL($pdo, 'Seed: Fare Rules (linked to vehicle categories)', "
        INSERT INTO `fare_rules` (`city_id`, `vehicle_category_id`, `base_fare`, `per_km_fare`, `per_min_fare`, `minimum_fare`, `surge_multiplier`, `night_surge_multiplier`, `cancellation_fee`, `waiting_charge_per_min`, `free_waiting_minutes`) VALUES
        (1, 1, 99.00, 14.00, 2.00, 99.00, 1.00, 1.25, 25.00, 2.00, 5),
        (1, 2, 149.00, 18.00, 2.50, 149.00, 1.00, 1.25, 50.00, 2.50, 5),
        (1, 3, 249.00, 22.00, 3.00, 249.00, 1.00, 1.50, 75.00, 3.00, 5),
        (1, 4, 999.00, 12.00, 0.00, 999.00, 1.00, 1.00, 200.00, 0.00, 0)
    ", $seedErrors);
} else {
    echo "<span class='info'>Fare rules already seeded ({$frCount} found)</span><br>";
}

// Seed admin user
$adminCount = $pdo->query("SELECT COUNT(*) FROM admin_users")->fetchColumn();
if ((int)$adminCount === 0) {
    $adminId = generateUUID();
    // Password: Admin@123
    $adminHash = password_hash('Admin@123', PASSWORD_BCRYPT, array('cost' => 10));
    $stmt = $pdo->prepare("INSERT INTO `admin_users` (`id`, `name`, `email`, `password_hash`, `phone`, `role`, `is_active`) VALUES (?, 'System Administrator', 'admin@redtaxi.in', ?, '9000000000', 'SUPER_ADMIN', 1)");
    $stmt->execute(array($adminId, $adminHash));
    echo "<span class='ok'>Seed: Admin User (admin@redtaxi.in / Admin@123)</span><br>";
} else {
    echo "<span class='info'>Admin user already exists ({$adminCount} found)</span><br>";
}

// Seed 2 demo drivers
$driverCount = $pdo->query("SELECT COUNT(*) FROM drivers")->fetchColumn();
if ((int)$driverCount === 0) {
    $driverHash = password_hash('Driver@123', PASSWORD_BCRYPT, array('cost' => 10));
    
    $d1 = generateUUID();
    $d2 = generateUUID();
    $dv1 = generateUUID();
    $dv2 = generateUUID();
    $dw1 = generateUUID();
    $dw2 = generateUUID();

    $stmt = $pdo->prepare("INSERT INTO `drivers` (`id`, `name`, `phone`, `email`, `password_hash`, `city_id`, `approval_status`, `is_online`, `current_lat`, `current_lng`, `rating_avg`, `total_rides`) VALUES (?, ?, ?, ?, ?, 1, 'APPROVED', 1, 13.0827000, 80.2707000, 4.50, 120)");
    $stmt->execute(array($d1, 'Suresh Kumar', '9876500001', 'suresh@redtaxi.in', $driverHash));
    $stmt->execute(array($d2, 'Ramesh Babu', '9876500002', 'ramesh@redtaxi.in', $driverHash));
    echo "<span class='ok'>Seed: 2 Demo Drivers (9876500001, 9876500002 / Driver@123)</span><br>";

    // Driver vehicles
    $stmt = $pdo->prepare("INSERT INTO `driver_vehicles` (`id`, `driver_id`, `vehicle_category_id`, `vehicle_model`, `vehicle_number`, `vehicle_color`, `is_primary`, `is_verified`) VALUES (?, ?, ?, ?, ?, ?, 1, 1)");
    $stmt->execute(array($dv1, $d1, 1, 'Maruti Suzuki Dzire', 'TN 15 AB 4863', 'White'));
    $stmt->execute(array($dv2, $d2, 2, 'Hyundai Verna', 'TN 09 CD 7721', 'Silver'));
    echo "<span class='ok'>Seed: Driver Vehicles (TN 15 AB 4863, TN 09 CD 7721)</span><br>";

    // Driver wallets
    $stmt = $pdo->prepare("INSERT INTO `driver_wallets` (`id`, `driver_id`, `balance`) VALUES (?, ?, 500.00)");
    $stmt->execute(array($dw1, $d1));
    $stmt->execute(array($dw2, $d2));
    echo "<span class='ok'>Seed: Driver Wallets (₹500 each)</span><br>";
} else {
    echo "<span class='info'>Drivers already exist ({$driverCount} found)</span><br>";
}

// Seed 2 coupons
$couponCount = $pdo->query("SELECT COUNT(*) FROM coupons")->fetchColumn();
if ((int)$couponCount === 0) {
    $c1 = generateUUID();
    $c2 = generateUUID();
    $pdo->exec("INSERT INTO `coupons` (`id`, `code`, `description`, `discount_type`, `discount_value`, `max_discount`, `min_order_amount`, `max_uses`, `max_uses_per_user`, `is_active`) VALUES 
        ('{$c1}', 'WELCOME50', 'Flat ₹50 off on your first ride', 'FLAT', 50.00, 50.00, 99.00, 1000, 1, 1),
        ('{$c2}', 'RIDE20', '20% off up to ₹100', 'PERCENTAGE', 20.00, 100.00, 150.00, 500, 2, 1)
    ");
    echo "<span class='ok'>Seed: 2 Coupons (WELCOME50, RIDE20)</span><br>";
} else {
    echo "<span class='info'>Coupons already exist ({$couponCount} found)</span><br>";
}

echo '</div>';

// ─── Verify ─────────────────────────────────────────────────────────────────
echo '<div class="step">';
echo '<strong>Step 4: Verifying tables...</strong><br>';

$stmt = $pdo->query("SHOW TABLES");
$tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
$tableCount = count($tables);

if ($tableCount >= 26) {
    echo "<span class='ok'>All {$tableCount} tables created successfully!</span><br>";
} else {
    echo "<span class='warn'>Found {$tableCount} tables (expected 26). Missing tables may need manual review.</span><br>";
}

// Quick data summary
$counts = array(
    'cities' => 'Cities',
    'customers' => 'Customers',
    'drivers' => 'Drivers',
    'vehicle_categories' => 'Vehicle Categories',
    'fare_rules' => 'Fare Rules',
    'admin_users' => 'Admin Users',
    'bookings' => 'Bookings',
    'coupons' => 'Coupons'
);

foreach ($counts as $tbl => $label) {
    try {
        $cnt = $pdo->query("SELECT COUNT(*) FROM `{$tbl}`")->fetchColumn();
        echo "<span class='info'>{$label}: {$cnt} rows</span><br>";
    } catch (Exception $e) {
        echo "<span class='fail'>{$label}: Error</span><br>";
    }
}

echo '</div>';

// ─── Summary ────────────────────────────────────────────────────────────────
$totalErrors = $tableErrors + $seedErrors;

if ($totalErrors === 0) {
    echo '<div class="summary summary-ok">';
    echo '<strong>✓ Migration Completed Successfully!</strong><br><br>';
    echo 'All 26 tables created and essential data seeded.<br>';
    echo '<strong>Admin Login:</strong> admin@redtaxi.in / Admin@123<br>';
    echo '<strong>Demo Drivers:</strong> 9876500001, 9876500002 / Driver@123<br>';
    echo '<strong>Coupons:</strong> WELCOME50, RIDE20<br><br>';
    echo '<a class="btn" href="../">🚀 Open RedTaxi App</a>';
    echo '<a class="btn btn-green" href="../admin">🛡️ Open Admin Panel</a>';
    echo '</div>';
} else {
    echo '<div class="summary summary-fail">';
    echo "<strong>Migration completed with {$totalErrors} errors.</strong><br>";
    echo 'Please check the messages above and fix any issues.';
    echo '</div>';
}
?>

<div style="text-align: center; font-size: 12px; color: #64748b; margin-top: 20px;">
    RedTaxi Database Migration &bull; PHP <?php echo PHP_VERSION; ?> &bull; MySQL <?php echo $pdo->getAttribute(PDO::ATTR_SERVER_VERSION); ?>
</div>

</div>
</body>
</html>
