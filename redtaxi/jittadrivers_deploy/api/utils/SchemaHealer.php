<?php
/**
 * JittaDrives / RedTaxi Database Schema Self-Healer
 * Automatically detects and adds any missing columns across all tables.
 * Safe to run multiple times (idempotent).
 * Compatible with PHP 5.6+ and MySQL 5.5+ / MariaDB 10.x.
 */

class SchemaHealer
{
    private static $healed = false;

    /**
     * Inspects active database tables and adds missing columns automatically.
     *
     * @param PDO $pdo
     * @param array $logs Optional array passed by reference to collect change logs
     * @return array List of actions performed
     */
    public static function heal($pdo, &$logs = array(), $force = false)
    {
        if (self::$healed && empty($logs) && !$force) {
            return $logs;
        }

        // 1. Ensure essential missing support tables exist
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS `coupon_usage` (
              `id` CHAR(36) NOT NULL PRIMARY KEY,
              `coupon_id` CHAR(36) NOT NULL,
              `customer_id` CHAR(36) NOT NULL,
              `booking_id` CHAR(36) NOT NULL,
              `discount_applied` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
              `used_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              INDEX `idx_cu_cust` (`customer_id`),
              INDEX `idx_cu_book` (`booking_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $pdo->exec("CREATE TABLE IF NOT EXISTS `cancellations` (
              `id` CHAR(36) NOT NULL PRIMARY KEY,
              `booking_id` CHAR(36) NOT NULL,
              `cancelled_by` VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER',
              `cancelled_by_id` CHAR(36) NULL,
              `reason` TEXT NULL,
              `cancellation_fee` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
              `fee_charged_to` VARCHAR(50) NOT NULL DEFAULT 'NONE',
              `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              INDEX `idx_canc_book` (`booking_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $pdo->exec("CREATE TABLE IF NOT EXISTS `ride_location_logs` (
              `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
              `booking_id` CHAR(36) NOT NULL,
              `driver_id` CHAR(36) NOT NULL,
              `lat` DECIMAL(10,7) NOT NULL,
              `lng` DECIMAL(10,7) NOT NULL,
              `heading` DECIMAL(5,2) NULL,
              `speed_kmh` DECIMAL(5,2) NULL,
              `accuracy_m` DECIMAL(6,2) NULL,
              `recorded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              INDEX `idx_rll_book` (`booking_id`),
              INDEX `idx_rll_driver` (`driver_id`),
              INDEX `idx_rll_time` (`recorded_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        } catch (Exception $e) {}

        $definitions = array(
            'vehicle_categories' => array(
                'category'     => "VARCHAR(50) NULL DEFAULT NULL",
                'capacity'     => "INT NOT NULL DEFAULT 4",
                'base_price'   => "DECIMAL(8,2) NOT NULL DEFAULT 0.00",
                'per_km_rate'  => "DECIMAL(6,2) NOT NULL DEFAULT 0.00",
                'eta_min'      => "INT NOT NULL DEFAULT 5",
                'tagline'      => "VARCHAR(255) NULL DEFAULT NULL",
                'image_url'    => "VARCHAR(500) NULL DEFAULT NULL",
            ),
            'offers' => array(
                'discount_tag'    => "VARCHAR(50) NULL DEFAULT NULL",
                'bg_gradient'     => "VARCHAR(100) NULL DEFAULT NULL",
                'validity'        => "VARCHAR(100) NULL DEFAULT NULL",
                'sort_order'      => "INT NOT NULL DEFAULT 0",
                'start_date'      => "DATE NULL DEFAULT NULL",
                'end_date'        => "DATE NULL DEFAULT NULL",
            ),
            'chat_messages' => array(
                'sender'          => "VARCHAR(50) NULL DEFAULT 'CUSTOMER'",
                'sender_type'     => "VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER'",
                'sender_id'       => "CHAR(36) NULL DEFAULT NULL",
                'message'         => "TEXT NULL DEFAULT NULL",
            ),
            'support_tickets' => array(
                'category'        => "VARCHAR(100) NOT NULL DEFAULT 'General'",
                'description'     => "TEXT NULL DEFAULT NULL",
                'resolved_at'     => "TIMESTAMP NULL DEFAULT NULL",
            ),
            'support_messages' => array(
                'sender_type'     => "VARCHAR(50) NOT NULL DEFAULT 'USER'",
                'sender_id'       => "CHAR(36) NULL DEFAULT NULL",
                'message'         => "TEXT NULL DEFAULT NULL",
            ),
            'bookings' => array(
                'city_id'             => 'INT UNSIGNED NULL DEFAULT 1',
                'ride_type'           => "VARCHAR(50) NOT NULL DEFAULT 'DAILY'",
                'vehicle_category'    => "VARCHAR(50) NOT NULL DEFAULT 'Sedan'",
                'vehicle_category_id' => 'INT UNSIGNED NULL DEFAULT NULL',
                'vehicle_id'          => 'CHAR(36) NULL DEFAULT NULL',
                'driver_id'           => 'CHAR(36) NULL DEFAULT NULL',
                'start_otp'           => 'VARCHAR(10) NULL DEFAULT NULL',
                'otp_code'            => 'VARCHAR(10) NULL DEFAULT NULL',
                'assigned_at'         => 'TIMESTAMP NULL DEFAULT NULL',
                'accepted_at'         => 'TIMESTAMP NULL DEFAULT NULL',
                'arrived_at'          => 'TIMESTAMP NULL DEFAULT NULL',
                'started_at'          => 'TIMESTAMP NULL DEFAULT NULL',
                'completed_at'        => 'TIMESTAMP NULL DEFAULT NULL',
                'cancelled_at'        => 'TIMESTAMP NULL DEFAULT NULL',
                'distance_km'         => 'DECIMAL(8,2) NOT NULL DEFAULT 0.00',
                'duration_min'        => 'INT NOT NULL DEFAULT 0',
                'base_fare'           => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
                'distance_fare'       => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
                'time_fare'           => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
                'waiting_fare'        => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
                'platform_fee'        => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
                'tax'                 => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
                'discount'            => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
                'total_fare'          => 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
                'rating'              => 'TINYINT NULL DEFAULT NULL',
                'scheduled_time'      => 'TIMESTAMP NULL DEFAULT NULL',
                'outstation_details'  => 'TEXT NULL DEFAULT NULL',
                'rental_details'      => 'TEXT NULL DEFAULT NULL',
                'airport_details'     => 'TEXT NULL DEFAULT NULL',
                'customer_vehicle_details' => 'TEXT NULL DEFAULT NULL',
                'vehicle_reg_no'           => 'VARCHAR(20) NULL DEFAULT NULL',
                'vehicle_reg_normalized'    => 'VARCHAR(20) NULL DEFAULT NULL',
                'vehicle_verification_status' => "ENUM('NOT_PROVIDED','FORMAT_VALID','VERIFICATION_PENDING','VERIFIED','VERIFICATION_FAILED','VERIFICATION_UNAVAILABLE') NOT NULL DEFAULT 'NOT_PROVIDED'",
                'vehicle_verified_at'      => 'DATETIME NULL DEFAULT NULL',
                'vehicle_verification_provider' => 'VARCHAR(50) NULL DEFAULT NULL',
                'vehicle_verification_details' => 'TEXT NULL DEFAULT NULL',
                'driver_vehicle_confirmed' => 'TINYINT(1) NOT NULL DEFAULT 0',
                'driver_vehicle_confirmed_at' => 'DATETIME NULL DEFAULT NULL',
                'driver_mismatch_reported' => 'TINYINT(1) NOT NULL DEFAULT 0',
                'driver_mismatch_reason'   => 'VARCHAR(255) NULL DEFAULT NULL',
                'dispatched_driver_ids'    => 'TEXT NULL DEFAULT NULL',
                'rejected_driver_ids'      => 'TEXT NULL DEFAULT NULL',
            ),
            'booking_locations' => array(
                'sequence_order'      => 'INT NOT NULL DEFAULT 1',
                'name'                => 'VARCHAR(255) NULL DEFAULT NULL',
                'category'            => "VARCHAR(50) NOT NULL DEFAULT 'OTHER'",
            ),
            'driver_wallets' => array(
                'today_earnings'        => 'DECIMAL(12,2) NOT NULL DEFAULT 0.00',
                'today_trips'           => 'INT NOT NULL DEFAULT 0',
                'total_commission_paid' => 'DECIMAL(12,2) NOT NULL DEFAULT 0.00',
                'total_earned'          => 'DECIMAL(12,2) NOT NULL DEFAULT 0.00',
                'total_trips'           => 'INT NOT NULL DEFAULT 0',
                'last_reset_date'       => 'DATE NULL DEFAULT NULL',
                'is_active'             => 'TINYINT(1) NOT NULL DEFAULT 1',
            ),
            'drivers' => array(
                'photo_url'           => 'VARCHAR(500) NULL DEFAULT NULL',
                'rating'              => 'DECIMAL(3,2) NOT NULL DEFAULT 5.00',
                'trips_count'         => 'INT NOT NULL DEFAULT 0',
                'commission_percent'  => 'DECIMAL(5,2) NOT NULL DEFAULT 15.00',
                'is_online'           => 'TINYINT(1) NOT NULL DEFAULT 0',
                'is_on_ride'          => 'TINYINT(1) NOT NULL DEFAULT 0',
                'last_location_lat'   => 'DECIMAL(10,7) NULL DEFAULT NULL',
                'last_location_lng'   => 'DECIMAL(10,7) NULL DEFAULT NULL',
                'current_lat'         => 'DECIMAL(10,7) NULL DEFAULT NULL',
                'current_lng'         => 'DECIMAL(10,7) NULL DEFAULT NULL',
                'last_location_at'    => 'TIMESTAMP NULL DEFAULT NULL',
                'last_seen_at'        => 'TIMESTAMP NULL DEFAULT NULL',
                'rejection_count'     => 'INT NOT NULL DEFAULT 0',
                'approval_status'     => "VARCHAR(50) NOT NULL DEFAULT 'APPROVED'",
                'avatar_url'          => 'VARCHAR(500) NULL DEFAULT NULL',
                'rating_avg'          => 'DECIMAL(3,2) NOT NULL DEFAULT 5.00',
                'total_rides'         => 'INT NOT NULL DEFAULT 0',
                'total_earnings'      => 'DECIMAL(12,2) NOT NULL DEFAULT 0.00',
            ),
            'driver_vehicles' => array(
                'vehicle_model'       => "VARCHAR(100) NOT NULL DEFAULT 'Sedan'",
                'vehicle_number'      => "VARCHAR(20) NOT NULL DEFAULT 'TN 38 BK 9021'",
                'vehicle_type'        => "VARCHAR(50) NOT NULL DEFAULT 'Sedan'",
                'is_active'           => 'TINYINT(1) NOT NULL DEFAULT 1',
                'color'               => 'VARCHAR(30) NULL DEFAULT NULL',
                'vehicle_color'       => 'VARCHAR(30) NULL DEFAULT NULL',
                'vehicle_make'        => 'VARCHAR(50) NULL DEFAULT NULL',
                'vehicle_year'        => 'INT NULL DEFAULT NULL',
                'is_primary'          => 'TINYINT(1) NOT NULL DEFAULT 1',
                'is_verified'         => 'TINYINT(1) NOT NULL DEFAULT 1',
            ),
            'driver_documents' => array(
                'verification_status' => "VARCHAR(50) NOT NULL DEFAULT 'PENDING'",
                'status'              => "VARCHAR(50) NOT NULL DEFAULT 'PENDING'",
                'verified_at'         => 'TIMESTAMP NULL DEFAULT NULL',
                'document_number'     => 'VARCHAR(50) NULL DEFAULT NULL',
                'file_url'            => 'VARCHAR(500) NULL DEFAULT NULL',
                'expiry_date'         => 'DATE NULL DEFAULT NULL',
                'notes'               => 'TEXT NULL DEFAULT NULL',
            ),
            'notifications' => array(
                'user_id'             => 'CHAR(36) NULL DEFAULT NULL',
                'user_type'           => "VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER'",
                'title'               => "VARCHAR(255) NOT NULL DEFAULT ''",
                'message'             => "TEXT NULL DEFAULT NULL",
                'type'                => "VARCHAR(50) NOT NULL DEFAULT 'SYSTEM'",
                'is_read'             => "TINYINT(1) NOT NULL DEFAULT 0",
                'audience'            => 'VARCHAR(50) NULL DEFAULT NULL',
                'data_payload'        => 'TEXT NULL DEFAULT NULL',
            ),
            'driver_wallet_transactions' => array(
                'status'              => "VARCHAR(50) NOT NULL DEFAULT 'COMPLETED'",
                'reference_id'        => 'CHAR(36) NULL DEFAULT NULL',
            ),
            'fare_rules' => array(
                'category_id'             => "VARCHAR(50) NULL DEFAULT NULL",
                'vehicle_category_id'     => "INT UNSIGNED NULL DEFAULT NULL",
                'base_fare'               => "DECIMAL(10,2) NOT NULL DEFAULT 50.00",
                'free_km'                 => "DECIMAL(5,2) NOT NULL DEFAULT 0.00",
                'per_km'                  => "DECIMAL(10,2) NOT NULL DEFAULT 15.00",
                'per_km_fare'             => "DECIMAL(10,2) NOT NULL DEFAULT 15.00",
                'per_minute'              => "DECIMAL(10,2) NOT NULL DEFAULT 2.00",
                'per_min_fare'            => "DECIMAL(10,2) NOT NULL DEFAULT 2.00",
                'waiting_per_min'         => "DECIMAL(10,2) NOT NULL DEFAULT 2.00",
                'waiting_charge_per_min'  => "DECIMAL(10,2) NOT NULL DEFAULT 2.00",
                'night_charge_percent'    => "DECIMAL(5,2) NOT NULL DEFAULT 0.00",
                'night_surge_multiplier'  => "DECIMAL(3,2) NOT NULL DEFAULT 1.00",
                'platform_fee'            => "DECIMAL(10,2) NOT NULL DEFAULT 10.00",
                'tax_percent'             => "DECIMAL(5,2) NOT NULL DEFAULT 5.00",
                'cancellation_fee'        => "DECIMAL(10,2) NOT NULL DEFAULT 30.00",
            ),
            'payments' => array(
                'type'                    => "VARCHAR(50) NOT NULL DEFAULT 'RIDE_FARE'",
                'paid_at'                 => "TIMESTAMP NULL DEFAULT NULL",
            ),
        );

        foreach ($definitions as $table => $columns) {
            try {
                $checkTable = $pdo->query("SHOW TABLES LIKE '{$table}'");
                $tRow = $checkTable ? $checkTable->fetch() : null;
                if (!$tRow) {
                    continue;
                }
            } catch (Exception $e) {
                continue;
            }

            $existing = array();
            try {
                $colQuery = $pdo->query("SHOW COLUMNS FROM `{$table}`");
                while ($row = $colQuery->fetch(PDO::FETCH_ASSOC)) {
                    $existing[strtolower($row['Field'])] = true;
                }
            } catch (Exception $e) {
                continue;
            }

            foreach ($columns as $column => $def) {
                if (!isset($existing[strtolower($column)])) {
                    try {
                        $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$def}");
                        $logs[] = "Added column `{$column}` to `{$table}`";
                    } catch (Exception $e) {
                        $logs[] = "Failed to add `{$column}` to `{$table}`: " . $e->getMessage();
                    }
                }
            }
        }

        // 2. Sync category values in vehicle_categories if needed
        try {
            $pdo->exec("UPDATE `vehicle_categories` SET `category` = `code` WHERE (`category` IS NULL OR `category` = '') AND `code` IS NOT NULL");
            $pdo->exec("UPDATE `vehicle_categories` SET `capacity` = `seat_capacity` WHERE (`capacity` IS NULL OR `capacity` = 0) AND `seat_capacity` IS NOT NULL");
            $pdo->exec("UPDATE `vehicle_categories` SET `base_price` = `base_fare` WHERE (`base_price` IS NULL OR `base_price` = 0.00) AND `base_fare` IS NOT NULL");
            $pdo->exec("UPDATE `vehicle_categories` SET `per_km_rate` = `per_km_fare` WHERE (`per_km_rate` IS NULL OR `per_km_rate` = 0.00) AND `per_km_fare` IS NOT NULL");
            $pdo->exec("UPDATE `vehicle_categories` SET `image_url` = `icon_url` WHERE (`image_url` IS NULL OR `image_url` = '') AND `icon_url` IS NOT NULL");
            $pdo->exec("UPDATE `vehicle_categories` SET `tagline` = `description` WHERE (`tagline` IS NULL OR `tagline` = '') AND `description` IS NOT NULL");
            $pdo->exec("UPDATE `chat_messages` SET `sender` = `sender_type` WHERE (`sender` IS NULL OR `sender` = '') AND `sender_type` IS NOT NULL");
            $pdo->exec("UPDATE `chat_messages` SET `sender_type` = `sender` WHERE (`sender_type` IS NULL OR `sender_type` = '') AND `sender` IS NOT NULL");
            $pdo->exec("UPDATE `offers` SET `sort_order` = `priority` WHERE (`sort_order` IS NULL OR `sort_order` = 0) AND `priority` IS NOT NULL");
            $pdo->exec("UPDATE `offers` SET `start_date` = DATE(`starts_at`) WHERE `start_date` IS NULL AND `starts_at` IS NOT NULL");
            $pdo->exec("UPDATE `offers` SET `end_date` = DATE(`ends_at`) WHERE `end_date` IS NULL AND `ends_at` IS NOT NULL");
        } catch (Exception $e) {}

        // 3. Widen ENUMs that cause strict mode truncation during ride booking
        try {
            $pdo->exec("ALTER TABLE `booking_locations` MODIFY COLUMN `type` VARCHAR(50) NOT NULL");
            $pdo->exec("ALTER TABLE `bookings` MODIFY COLUMN `status` VARCHAR(50) NOT NULL DEFAULT 'SEARCHING'");
        } catch (Exception $e) {}

        self::$healed = true;
        return $logs;
    }
}
