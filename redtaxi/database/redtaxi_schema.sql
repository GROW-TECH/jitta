-- =============================================================================
-- RedTaxi — Multi-City Taxi Booking Platform Database Schema
-- Version: 1.0
-- Generated from approved DATABASE_DESIGN.md
-- Target Engine: MySQL 8.0+ / MariaDB 10.4+ (InnoDB, utf8mb4)
-- Total Tables: 26
-- =============================================================================

-- (Uncomment below only if creating a brand new local database with root privileges)
-- CREATE DATABASE IF NOT EXISTS `redtaxi_db`
--   DEFAULT CHARACTER SET utf8mb4
--   DEFAULT COLLATE utf8mb4_unicode_ci;
-- USE `redtaxi_db`;

-- Disable foreign key checks during schema creation / drop
SET FOREIGN_KEY_CHECKS = 0;

-- Drop existing tables if re-running
DROP TABLE IF EXISTS `chat_messages`;
DROP TABLE IF EXISTS `otp_verifications`;
DROP TABLE IF EXISTS `sos_alerts`;
DROP TABLE IF EXISTS `support_messages`;
DROP TABLE IF EXISTS `support_tickets`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `coupon_usage`;
DROP TABLE IF EXISTS `offers`;
DROP TABLE IF EXISTS `coupons`;
DROP TABLE IF EXISTS `cancellations`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `booking_locations`;
DROP TABLE IF EXISTS `bookings`;
DROP TABLE IF EXISTS `driver_wallet_transactions`;
DROP TABLE IF EXISTS `driver_wallets`;
DROP TABLE IF EXISTS `driver_documents`;
DROP TABLE IF EXISTS `admin_users`;
DROP TABLE IF EXISTS `driver_vehicles`;
DROP TABLE IF EXISTS `drivers`;
DROP TABLE IF EXISTS `fare_rules`;
DROP TABLE IF EXISTS `vehicle_categories`;
DROP TABLE IF EXISTS `customer_wallet_transactions`;
DROP TABLE IF EXISTS `customer_wallets`;
DROP TABLE IF EXISTS `customer_saved_places`;
DROP TABLE IF EXISTS `customers`;
DROP TABLE IF EXISTS `cities`;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 1. cities
-- Operational regions for multi-city coverage
-- =============================================================================
CREATE TABLE `cities` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. customers
-- Customer passenger profiles
-- =============================================================================
CREATE TABLE `customers` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(15) NOT NULL,
  `email` VARCHAR(150) NULL,
  `password_hash` VARCHAR(255) NULL,
  `avatar_url` VARCHAR(500) NULL,
  `city_id` INT UNSIGNED NULL,
  `status` ENUM('ACTIVE','BLOCKED','DELETED') NOT NULL DEFAULT 'ACTIVE',
  `total_rides` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customers_phone` (`phone`),
  UNIQUE KEY `uk_customers_email` (`email`),
  INDEX `idx_customers_status` (`status`),
  INDEX `idx_customers_city` (`city_id`),
  CONSTRAINT `fk_customers_city` FOREIGN KEY (`city_id`) REFERENCES `cities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. customer_saved_places
-- Saved customer addresses (Home, Work, Other)
-- =============================================================================
CREATE TABLE `customer_saved_places` (
  `id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `label` ENUM('Home','Work','Other') NOT NULL,
  `custom_label` VARCHAR(50) NULL,
  `address` VARCHAR(300) NOT NULL,
  `lat` DECIMAL(10,7) NOT NULL,
  `lng` DECIMAL(10,7) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_saved_places_customer` (`customer_id`),
  CONSTRAINT `fk_saved_places_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. customer_wallets
-- 1:1 wallet account for customer rides
-- =============================================================================
CREATE TABLE `customer_wallets` (
  `id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_wallets_customer` (`customer_id`),
  CONSTRAINT `fk_customer_wallets_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 5. customer_wallet_transactions
-- Immutable ledger for customer wallet credits and debits
-- =============================================================================
CREATE TABLE `customer_wallet_transactions` (
  `id` CHAR(36) NOT NULL,
  `wallet_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `type` ENUM('CREDIT','DEBIT') NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `description` VARCHAR(300) NOT NULL,
  `reference_id` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_cwt_wallet` (`wallet_id`),
  INDEX `idx_cwt_customer` (`customer_id`),
  INDEX `idx_cwt_created` (`created_at`),
  CONSTRAINT `fk_cwt_wallet` FOREIGN KEY (`wallet_id`) REFERENCES `customer_wallets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cwt_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 6. vehicle_categories
-- Master vehicle types (Red Mini, Red Sedan, Red SUV, etc.)
-- =============================================================================
CREATE TABLE `vehicle_categories` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `category` VARCHAR(50) NOT NULL,
  `capacity` TINYINT UNSIGNED NOT NULL,
  `base_price` DECIMAL(10,2) NOT NULL,
  `per_km_rate` DECIMAL(10,2) NOT NULL,
  `eta_min` TINYINT UNSIGNED NOT NULL DEFAULT 5,
  `tagline` VARCHAR(150) NULL,
  `image_url` VARCHAR(500) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_vehicle_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 7. fare_rules
-- Per-city, per-vehicle-category pricing matrix
-- =============================================================================
CREATE TABLE `fare_rules` (
  `id` CHAR(36) NOT NULL,
  `city_id` INT UNSIGNED NOT NULL,
  `category_id` CHAR(36) NOT NULL,
  `base_fare` DECIMAL(10,2) NOT NULL,
  `free_km` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `per_km` DECIMAL(10,2) NOT NULL,
  `per_minute` DECIMAL(10,2) NOT NULL,
  `waiting_per_min` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `night_charge_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `platform_fee` DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  `tax_percent` DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  `cancellation_fee` DECIMAL(10,2) NOT NULL DEFAULT 30.00,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fare_city_category` (`city_id`, `category_id`),
  INDEX `idx_fr_city` (`city_id`),
  INDEX `idx_fr_category` (`category_id`),
  CONSTRAINT `fk_fare_rules_city` FOREIGN KEY (`city_id`) REFERENCES `cities` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_fare_rules_category` FOREIGN KEY (`category_id`) REFERENCES `vehicle_categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 8. drivers
-- Driver accounts and real-time status
-- =============================================================================
CREATE TABLE `drivers` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(15) NOT NULL,
  `email` VARCHAR(150) NULL,
  `password_hash` VARCHAR(255) NULL,
  `photo_url` VARCHAR(500) NULL,
  `city_id` INT UNSIGNED NULL,
  `rating` DECIMAL(3,2) NOT NULL DEFAULT 5.00,
  `trips_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_online` TINYINT(1) NOT NULL DEFAULT 0,
  `approval_status` ENUM('PENDING','APPROVED','REJECTED','SUSPENDED') NOT NULL DEFAULT 'PENDING',
  `commission_percent` DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  `current_lat` DECIMAL(10,7) NULL,
  `current_lng` DECIMAL(10,7) NULL,
  `last_location_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_drivers_phone` (`phone`),
  UNIQUE KEY `uk_drivers_email` (`email`),
  INDEX `idx_drivers_status` (`approval_status`),
  INDEX `idx_drivers_online` (`is_online`, `city_id`),
  INDEX `idx_drivers_city` (`city_id`),
  INDEX `idx_drivers_location` (`current_lat`, `current_lng`),
  CONSTRAINT `fk_drivers_city` FOREIGN KEY (`city_id`) REFERENCES `cities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 9. driver_vehicles
-- Driver vehicles (supports multiple vehicles per driver)
-- =============================================================================
CREATE TABLE `driver_vehicles` (
  `id` CHAR(36) NOT NULL,
  `driver_id` CHAR(36) NOT NULL,
  `vehicle_model` VARCHAR(100) NOT NULL,
  `vehicle_number` VARCHAR(20) NOT NULL,
  `vehicle_type` VARCHAR(30) NOT NULL,
  `category_id` CHAR(36) NULL,
  `color` VARCHAR(30) NULL,
  `year` SMALLINT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dv_number` (`vehicle_number`),
  INDEX `idx_dv_driver` (`driver_id`),
  INDEX `idx_dv_category` (`category_id`),
  CONSTRAINT `fk_dv_driver` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_dv_category` FOREIGN KEY (`category_id`) REFERENCES `vehicle_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 10. admin_users
-- Platform administrator and staff accounts
-- =============================================================================
CREATE TABLE `admin_users` (
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
  INDEX `idx_admin_active` (`is_active`),
  CONSTRAINT `fk_admin_users_city` FOREIGN KEY (`city_id`) REFERENCES `cities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 11. driver_documents
-- Verification documents (License, RC, Insurance, Permit)
-- =============================================================================
CREATE TABLE `driver_documents` (
  `id` CHAR(36) NOT NULL,
  `driver_id` CHAR(36) NOT NULL,
  `document_type` ENUM('LICENSE','RC','INSURANCE','PERMIT') NOT NULL,
  `document_number` VARCHAR(50) NOT NULL,
  `file_url` VARCHAR(500) NULL,
  `verification_status` ENUM('PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `verified_by` CHAR(36) NULL,
  `verified_at` TIMESTAMP NULL,
  `expiry_date` DATE NULL,
  `rejection_reason` VARCHAR(300) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_driver_doc` (`driver_id`, `document_type`),
  INDEX `idx_dd_driver` (`driver_id`),
  INDEX `idx_dd_status` (`verification_status`),
  INDEX `idx_dd_verified_by` (`verified_by`),
  CONSTRAINT `fk_dd_driver` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_dd_verified_by` FOREIGN KEY (`verified_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 12. driver_wallets
-- 1:1 wallet for driver earnings and payouts
-- =============================================================================
CREATE TABLE `driver_wallets` (
  `id` CHAR(36) NOT NULL,
  `driver_id` CHAR(36) NOT NULL,
  `balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `today_earnings` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `today_trips` INT UNSIGNED NOT NULL DEFAULT 0,
  `total_commission_paid` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_driver_wallets_driver` (`driver_id`),
  CONSTRAINT `fk_driver_wallets_driver` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 13. driver_wallet_transactions
-- Driver earnings, commissions, and payout ledger
-- =============================================================================
CREATE TABLE `driver_wallet_transactions` (
  `id` CHAR(36) NOT NULL,
  `wallet_id` CHAR(36) NOT NULL,
  `driver_id` CHAR(36) NOT NULL,
  `type` ENUM('CREDIT','DEBIT') NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `description` VARCHAR(300) NOT NULL,
  `reference_id` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_dwt_wallet` (`wallet_id`),
  INDEX `idx_dwt_driver` (`driver_id`),
  INDEX `idx_dwt_created` (`created_at`),
  CONSTRAINT `fk_dwt_wallet` FOREIGN KEY (`wallet_id`) REFERENCES `driver_wallets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_dwt_driver` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 14. coupons
-- Promotional discounts and coupon rules
-- =============================================================================
CREATE TABLE `coupons` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(30) NOT NULL,
  `discount_type` ENUM('FLAT','PERCENT') NOT NULL,
  `discount_amount` DECIMAL(10,2) NOT NULL,
  `min_booking` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `max_discount` DECIMAL(10,2) NULL,
  `max_uses_total` INT UNSIGNED NULL,
  `max_uses_per_user` INT UNSIGNED NOT NULL DEFAULT 1,
  `applicable_ride_types` JSON NULL,
  `applicable_cities` JSON NULL,
  `description` VARCHAR(300) NOT NULL,
  `expiry_date` DATE NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_coupons_code` (`code`),
  INDEX `idx_coupons_active` (`is_active`, `expiry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 15. offers
-- Marketing banners displayed on Customer App
-- =============================================================================
CREATE TABLE `offers` (
  `id` CHAR(36) NOT NULL,
  `coupon_id` CHAR(36) NULL,
  `title` VARCHAR(100) NOT NULL,
  `description` VARCHAR(300) NOT NULL,
  `discount_tag` VARCHAR(50) NULL,
  `bg_gradient` VARCHAR(100) NULL,
  `image_url` VARCHAR(500) NULL,
  `validity` VARCHAR(100) NULL,
  `target_audience` ENUM('ALL','CUSTOMERS','DRIVERS','NEW_USERS') NOT NULL DEFAULT 'ALL',
  `applicable_cities` JSON NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_offers_active` (`is_active`, `start_date`, `end_date`),
  INDEX `idx_offers_coupon` (`coupon_id`),
  CONSTRAINT `fk_offers_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 16. bookings
-- Master ride bookings table with inline fare breakdown
-- =============================================================================
CREATE TABLE `bookings` (
  `id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `driver_id` CHAR(36) NULL,
  `vehicle_id` CHAR(36) NULL,
  `city_id` INT UNSIGNED NOT NULL,
  `ride_type` ENUM('CITY','RENTAL','OUTSTATION','AIRPORT') NOT NULL,
  `vehicle_category` VARCHAR(50) NOT NULL,
  `status` ENUM('SEARCHING','ASSIGNED','EN_ROUTE','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED','SCHEDULED') NOT NULL DEFAULT 'SEARCHING',
  `start_otp` CHAR(4) NOT NULL,
  `distance_km` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `duration_min` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `base_fare` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `distance_fare` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `time_fare` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `waiting_fare` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `platform_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `tax` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `total_fare` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `payment_method` ENUM('UPI','CASH','WALLET','CARD') NOT NULL,
  `payment_status` ENUM('PENDING','PAID','REFUNDED','FAILED') NOT NULL DEFAULT 'PENDING',
  `coupon_id` CHAR(36) NULL,
  `rating` TINYINT UNSIGNED NULL,
  `review_text` TEXT NULL,
  `scheduled_time` DATETIME NULL,
  `outstation_details` JSON NULL,
  `rental_details` JSON NULL,
  `airport_details` JSON NULL,
  `assigned_at` TIMESTAMP NULL,
  `started_at` TIMESTAMP NULL,
  `completed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_bookings_customer` (`customer_id`),
  INDEX `idx_bookings_driver` (`driver_id`),
  INDEX `idx_bookings_vehicle` (`vehicle_id`),
  INDEX `idx_bookings_status` (`status`),
  INDEX `idx_bookings_city` (`city_id`),
  INDEX `idx_bookings_ride_type` (`ride_type`),
  INDEX `idx_bookings_created` (`created_at`),
  INDEX `idx_bookings_scheduled` (`scheduled_time`),
  INDEX `idx_bookings_payment` (`payment_status`),
  INDEX `idx_bookings_coupon` (`coupon_id`),
  CONSTRAINT `fk_bookings_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_bookings_driver` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_bookings_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `driver_vehicles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_bookings_city` FOREIGN KEY (`city_id`) REFERENCES `cities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_bookings_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 17. booking_locations
-- Pickup, intermediate stops, and drop destination
-- =============================================================================
CREATE TABLE `booking_locations` (
  `id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NOT NULL,
  `type` ENUM('PICKUP','DROP','STOP') NOT NULL,
  `sequence_order` TINYINT UNSIGNED NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `address` VARCHAR(300) NOT NULL,
  `lat` DECIMAL(10,7) NOT NULL,
  `lng` DECIMAL(10,7) NOT NULL,
  `category` ENUM('AIRPORT','STATION','WORK','HOME','POPULAR','OTHER') NOT NULL DEFAULT 'OTHER',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_booking_sequence` (`booking_id`, `sequence_order`),
  INDEX `idx_bl_booking` (`booking_id`),
  INDEX `idx_bl_type` (`booking_id`, `type`),
  CONSTRAINT `fk_bl_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 18. payments
-- Payment gateway transactions and settlement records
-- =============================================================================
CREATE TABLE `payments` (
  `id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `method` ENUM('UPI','CASH','WALLET','CARD') NOT NULL,
  `type` ENUM('PAYMENT','REFUND') NOT NULL DEFAULT 'PAYMENT',
  `amount` DECIMAL(12,2) NOT NULL,
  `status` ENUM('INITIATED','SUCCESS','FAILED','REFUNDED') NOT NULL DEFAULT 'INITIATED',
  `gateway_txn_id` VARCHAR(100) NULL,
  `gateway_response` JSON NULL,
  `paid_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pay_booking` (`booking_id`),
  INDEX `idx_pay_customer` (`customer_id`),
  INDEX `idx_pay_status` (`status`),
  INDEX `idx_pay_created` (`created_at`),
  INDEX `idx_pay_gateway_txn` (`gateway_txn_id`),
  CONSTRAINT `fk_pay_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_pay_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 19. cancellations
-- Booking cancellations audit and fees
-- =============================================================================
CREATE TABLE `cancellations` (
  `id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NOT NULL,
  `cancelled_by` ENUM('CUSTOMER','DRIVER','SYSTEM') NOT NULL,
  `reason` VARCHAR(300) NULL,
  `cancellation_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `fee_charged_to` ENUM('CUSTOMER','DRIVER') NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cancel_booking` (`booking_id`),
  INDEX `idx_cancel_booking` (`booking_id`),
  CONSTRAINT `fk_cancel_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 20. coupon_usage
-- Customer coupon redemption audit
-- =============================================================================
CREATE TABLE `coupon_usage` (
  `id` CHAR(36) NOT NULL,
  `coupon_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NOT NULL,
  `discount_applied` DECIMAL(10,2) NOT NULL,
  `used_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_coupon_booking` (`coupon_id`, `booking_id`),
  INDEX `idx_cu_coupon_customer` (`coupon_id`, `customer_id`),
  INDEX `idx_cu_customer` (`customer_id`),
  INDEX `idx_cu_booking` (`booking_id`),
  CONSTRAINT `fk_cu_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cu_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cu_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 21. notifications
-- Targeted and broadcast notifications
-- =============================================================================
CREATE TABLE `notifications` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `user_type` ENUM('CUSTOMER','DRIVER','ADMIN') NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `type` ENUM('RIDE','OFFER','SYSTEM','PAYMENT') NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `audience` ENUM('ALL','CUSTOMERS','DRIVERS','INDIVIDUAL') NOT NULL DEFAULT 'INDIVIDUAL',
  `data_payload` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_notif_user` (`user_id`, `user_type`),
  INDEX `idx_notif_read` (`user_id`, `is_read`),
  INDEX `idx_notif_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 22. support_tickets
-- Helpdesk inquiries and issue tracking
-- =============================================================================
CREATE TABLE `support_tickets` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `user_type` ENUM('CUSTOMER','DRIVER') NOT NULL,
  `booking_id` CHAR(36) NULL,
  `category` VARCHAR(50) NOT NULL,
  `subject` VARCHAR(200) NOT NULL,
  `description` TEXT NOT NULL,
  `status` ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  `priority` ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `assigned_to` CHAR(36) NULL,
  `resolved_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_st_user` (`user_id`, `user_type`),
  INDEX `idx_st_status` (`status`),
  INDEX `idx_st_priority` (`priority`),
  INDEX `idx_st_assigned` (`assigned_to`),
  INDEX `idx_st_created` (`created_at`),
  INDEX `idx_st_booking` (`booking_id`),
  CONSTRAINT `fk_st_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_st_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 23. support_messages
-- Threaded message responses on support tickets
-- =============================================================================
CREATE TABLE `support_messages` (
  `id` CHAR(36) NOT NULL,
  `ticket_id` CHAR(36) NOT NULL,
  `sender_type` ENUM('CUSTOMER','DRIVER','ADMIN') NOT NULL,
  `sender_id` CHAR(36) NOT NULL,
  `message` TEXT NOT NULL,
  `attachments` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_sm_ticket` (`ticket_id`),
  INDEX `idx_sm_created` (`ticket_id`, `created_at`),
  CONSTRAINT `fk_sm_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 24. sos_alerts
-- Real-time emergency alerts from active trips
-- =============================================================================
CREATE TABLE `sos_alerts` (
  `id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NOT NULL,
  `triggered_by` ENUM('CUSTOMER','DRIVER') NOT NULL,
  `triggered_user_id` CHAR(36) NOT NULL,
  `lat` DECIMAL(10,7) NULL,
  `lng` DECIMAL(10,7) NULL,
  `status` ENUM('ACTIVE','RESOLVED','ESCALATED','FALSE_ALARM') NOT NULL DEFAULT 'ACTIVE',
  `resolution_notes` TEXT NULL,
  `resolved_by` CHAR(36) NULL,
  `resolved_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_sos_status` (`status`),
  INDEX `idx_sos_booking` (`booking_id`),
  INDEX `idx_sos_created` (`created_at`),
  INDEX `idx_sos_resolved_by` (`resolved_by`),
  CONSTRAINT `fk_sos_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sos_resolved_by` FOREIGN KEY (`resolved_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 25. otp_verifications
-- Transient phone verification codes for auth
-- =============================================================================
CREATE TABLE `otp_verifications` (
  `id` CHAR(36) NOT NULL,
  `phone` VARCHAR(15) NOT NULL,
  `otp` CHAR(6) NOT NULL,
  `purpose` ENUM('LOGIN','REGISTRATION','RESET') NOT NULL DEFAULT 'LOGIN',
  `is_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_otp_phone` (`phone`, `purpose`),
  INDEX `idx_otp_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 26. chat_messages
-- In-ride live chat between passenger and driver
-- =============================================================================
CREATE TABLE `chat_messages` (
  `id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NOT NULL,
  `sender` ENUM('CUSTOMER','DRIVER') NOT NULL,
  `sender_id` CHAR(36) NOT NULL,
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_chat_booking` (`booking_id`),
  INDEX `idx_chat_created` (`booking_id`, `created_at`),
  CONSTRAINT `fk_chat_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
