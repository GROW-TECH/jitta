-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Sep 17, 2026 at 02:22 AM
-- Server version: 10.11.19-MariaDB-cll-lve
-- PHP Version: 8.4.24

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `redtaxi_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin_users`
--

CREATE TABLE `admin_users` (
  `id` char(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `role` enum('SUPER_ADMIN','ADMIN') NOT NULL DEFAULT 'ADMIN',
  `city_id` int(10) UNSIGNED DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `admin_users`
--

INSERT INTO `admin_users` (`id`, `name`, `email`, `password_hash`, `phone`, `role`, `city_id`, `is_active`, `last_login_at`, `created_at`, `updated_at`) VALUES
('2a4e34a7-d24c-4003-9cfa-9eb4e157b6d2', 'System Administrator', 'admin@redtaxi.in', '$2y$10$.QF/U8KWeltS4/epW.j0euy1VbZST9OiDzgzjE4HKKeqSzs9JoDXq', '9000000000', 'SUPER_ADMIN', NULL, 1, NULL, '2026-09-11 16:23:21', '2026-09-11 16:23:21');

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

CREATE TABLE `bookings` (
  `id` char(36) NOT NULL,
  `customer_id` char(36) NOT NULL,
  `driver_id` char(36) DEFAULT NULL,
  `vehicle_category_id` int(10) UNSIGNED DEFAULT NULL,
  `status` enum('SEARCHING','ASSIGNED','EN_ROUTE','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'SEARCHING',
  `pickup_address` varchar(500) NOT NULL,
  `pickup_lat` decimal(10,7) NOT NULL,
  `pickup_lng` decimal(10,7) NOT NULL,
  `dropoff_address` varchar(500) NOT NULL,
  `dropoff_lat` decimal(10,7) NOT NULL,
  `dropoff_lng` decimal(10,7) NOT NULL,
  `estimated_distance_km` decimal(8,2) DEFAULT NULL,
  `estimated_duration_min` int(11) DEFAULT NULL,
  `estimated_fare` decimal(10,2) DEFAULT NULL,
  `actual_distance_km` decimal(8,2) DEFAULT NULL,
  `actual_duration_min` int(11) DEFAULT NULL,
  `final_fare` decimal(10,2) DEFAULT NULL,
  `payment_method` enum('CASH','WALLET','UPI','CARD') NOT NULL DEFAULT 'CASH',
  `payment_status` enum('PENDING','PAID','REFUNDED','FAILED') NOT NULL DEFAULT 'PENDING',
  `otp` varchar(6) DEFAULT NULL,
  `coupon_id` char(36) DEFAULT NULL,
  `discount_amount` decimal(8,2) NOT NULL DEFAULT 0.00,
  `surge_multiplier` decimal(3,2) NOT NULL DEFAULT 1.00,
  `driver_rating` tinyint(4) DEFAULT NULL,
  `driver_feedback` text DEFAULT NULL,
  `customer_rating` tinyint(4) DEFAULT NULL,
  `customer_feedback` text DEFAULT NULL,
  `scheduled_at` timestamp NULL DEFAULT NULL,
  `accepted_at` timestamp NULL DEFAULT NULL,
  `arrived_at` timestamp NULL DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `booking_locations`
--

CREATE TABLE `booking_locations` (
  `id` char(36) NOT NULL,
  `booking_id` char(36) NOT NULL,
  `type` enum('PICKUP','DROPOFF','WAYPOINT','DRIVER_LOCATION') NOT NULL,
  `address` varchar(500) DEFAULT NULL,
  `lat` decimal(10,7) NOT NULL,
  `lng` decimal(10,7) NOT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cancellations`
--

CREATE TABLE `cancellations` (
  `id` char(36) NOT NULL,
  `booking_id` char(36) NOT NULL,
  `cancelled_by` enum('CUSTOMER','DRIVER','ADMIN','SYSTEM') NOT NULL,
  `cancelled_by_id` char(36) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `penalty_amount` decimal(8,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `chat_messages`
--

CREATE TABLE `chat_messages` (
  `id` char(36) NOT NULL,
  `booking_id` char(36) NOT NULL,
  `sender_type` enum('CUSTOMER','DRIVER') NOT NULL,
  `sender_id` char(36) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cities`
--

CREATE TABLE `cities` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `state` varchar(100) NOT NULL,
  `country` varchar(50) NOT NULL DEFAULT 'India',
  `lat` decimal(10,7) NOT NULL,
  `lng` decimal(10,7) NOT NULL,
  `radius_km` decimal(6,2) NOT NULL DEFAULT 50.00,
  `timezone` varchar(50) NOT NULL DEFAULT 'Asia/Kolkata',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `cities`
--

INSERT INTO `cities` (`id`, `name`, `state`, `country`, `lat`, `lng`, `radius_km`, `timezone`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Chennai', 'Tamil Nadu', 'India', 13.0827000, 80.2707000, 50.00, 'Asia/Kolkata', 1, '2026-09-11 16:23:20', '2026-09-11 16:23:20');

-- --------------------------------------------------------

--
-- Table structure for table `coupons`
--

CREATE TABLE `coupons` (
  `id` char(36) NOT NULL,
  `code` varchar(30) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `discount_type` enum('PERCENTAGE','FLAT') NOT NULL DEFAULT 'FLAT',
  `discount_value` decimal(8,2) NOT NULL,
  `max_discount` decimal(8,2) DEFAULT NULL,
  `min_order_amount` decimal(8,2) NOT NULL DEFAULT 0.00,
  `max_uses` int(11) DEFAULT NULL,
  `used_count` int(11) NOT NULL DEFAULT 0,
  `max_uses_per_user` int(11) NOT NULL DEFAULT 1,
  `valid_from` timestamp NULL DEFAULT NULL,
  `valid_until` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `coupons`
--

INSERT INTO `coupons` (`id`, `code`, `description`, `discount_type`, `discount_value`, `max_discount`, `min_order_amount`, `max_uses`, `used_count`, `max_uses_per_user`, `valid_from`, `valid_until`, `is_active`, `created_at`) VALUES
('ab1c7252-7e60-4857-bdfd-5476ab078e57', 'WELCOME50', 'Flat ₹50 off on your first ride', 'FLAT', 50.00, 50.00, 99.00, 1000, 0, 1, NULL, NULL, 1, '2026-09-11 16:23:21'),
('b9a13242-cd03-4ccd-9028-3956fd16fdcb', 'RIDE20', '20% off up to ₹100', 'PERCENTAGE', 20.00, 100.00, 150.00, 500, 0, 2, NULL, NULL, 1, '2026-09-11 16:23:21');

-- --------------------------------------------------------

--
-- Table structure for table `coupon_usage`
--

CREATE TABLE `coupon_usage` (
  `id` char(36) NOT NULL,
  `coupon_id` char(36) NOT NULL,
  `customer_id` char(36) NOT NULL,
  `booking_id` char(36) DEFAULT NULL,
  `discount_amount` decimal(8,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` char(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(15) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `city_id` int(10) UNSIGNED DEFAULT NULL,
  `status` enum('ACTIVE','BLOCKED','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  `total_rides` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `name`, `phone`, `email`, `password_hash`, `avatar_url`, `city_id`, `status`, `total_rides`, `created_at`, `updated_at`) VALUES
('2f2684bf-ac55-4d62-810e-51c75ab4b8ea', 'Kowshika V.S', '8787878745', 'vskowshika1@gmail.com', '$2y$10$LNCqYPiJts7P20cIUO0cA.Tz/ndGjJcyelcu/jgtUpcGKJbDvJHde', NULL, NULL, 'ACTIVE', 0, '2026-09-15 05:19:06', '2026-09-15 05:19:06'),
('abc793ea-54ef-48a6-8a80-037f183205d9', 'Grow', '7904819181', 'vskowshika@gmail.com', '$2y$10$rNufz0DhCbDZzKTEPByK/.Hki3bqP2NOArvcS3KsFqZq75/TKPafW', NULL, NULL, 'ACTIVE', 0, '2026-09-12 01:40:58', '2026-09-12 01:40:58'),
('dcc27037-2429-49ea-8b0d-308dc655c775', 'girt', '9342968996', 'giridharan032006@gmail.com', '$2y$10$gCtWszWdAwyZJ9GAJit7kuUNxtg8zEJC7qm4XyucDhiLqTPuW6hFm', NULL, NULL, 'ACTIVE', 0, '2026-09-11 16:31:42', '2026-09-11 16:31:42');

-- --------------------------------------------------------

--
-- Table structure for table `customer_saved_places`
--

CREATE TABLE `customer_saved_places` (
  `id` char(36) NOT NULL,
  `customer_id` char(36) NOT NULL,
  `label` varchar(30) NOT NULL DEFAULT 'Other',
  `custom_label` varchar(100) DEFAULT NULL,
  `address` varchar(500) NOT NULL,
  `lat` decimal(10,7) NOT NULL,
  `lng` decimal(10,7) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_wallets`
--

CREATE TABLE `customer_wallets` (
  `id` char(36) NOT NULL,
  `customer_id` char(36) NOT NULL,
  `balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customer_wallets`
--

INSERT INTO `customer_wallets` (`id`, `customer_id`, `balance`, `is_active`, `updated_at`) VALUES
('91642b25-e13e-4864-9ca8-b79cfdb33a18', 'dcc27037-2429-49ea-8b0d-308dc655c775', 0.00, 1, '2026-09-11 16:31:42'),
('93f831db-519e-492a-906e-30111c293e7f', 'abc793ea-54ef-48a6-8a80-037f183205d9', 0.00, 1, '2026-09-12 01:40:58'),
('fbff4c51-2add-4c52-a4c8-dc03f65d44cb', '2f2684bf-ac55-4d62-810e-51c75ab4b8ea', 0.00, 1, '2026-09-15 05:19:06');

-- --------------------------------------------------------

--
-- Table structure for table `customer_wallet_transactions`
--

CREATE TABLE `customer_wallet_transactions` (
  `id` char(36) NOT NULL,
  `customer_id` char(36) NOT NULL,
  `type` enum('CREDIT','DEBIT') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `reference_id` char(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `drivers`
--

CREATE TABLE `drivers` (
  `id` char(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(15) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `city_id` int(10) UNSIGNED DEFAULT NULL,
  `approval_status` enum('PENDING','APPROVED','SUSPENDED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `is_online` tinyint(1) NOT NULL DEFAULT 0,
  `is_on_ride` tinyint(1) NOT NULL DEFAULT 0,
  `current_lat` decimal(10,7) DEFAULT NULL,
  `current_lng` decimal(10,7) DEFAULT NULL,
  `rating_avg` decimal(3,2) NOT NULL DEFAULT 0.00,
  `total_rides` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `total_earnings` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `drivers`
--

INSERT INTO `drivers` (`id`, `name`, `phone`, `email`, `password_hash`, `avatar_url`, `city_id`, `approval_status`, `is_online`, `is_on_ride`, `current_lat`, `current_lng`, `rating_avg`, `total_rides`, `total_earnings`, `created_at`, `updated_at`) VALUES
('b15f4ee5-bde8-4648-9d9a-30629186ff54', 'Suresh Kumar', '9876500001', 'suresh@redtaxi.in', '$2y$10$Tv1H1CAr6wGhKuoTe9PG6eBABd6owddAJQCEfSBbuidt1Dpl27Ufm', NULL, 1, 'APPROVED', 1, 0, 13.0827000, 80.2707000, 4.50, 120, 0.00, '2026-09-11 16:23:21', '2026-09-11 16:23:21'),
('fba8073b-7867-4d06-bcf1-13e0b0f887e8', 'Ramesh Babu', '9876500002', 'ramesh@redtaxi.in', '$2y$10$Tv1H1CAr6wGhKuoTe9PG6eBABd6owddAJQCEfSBbuidt1Dpl27Ufm', NULL, 1, 'APPROVED', 1, 0, 13.0827000, 80.2707000, 4.50, 120, 0.00, '2026-09-11 16:23:21', '2026-09-11 16:23:21');

-- --------------------------------------------------------

--
-- Table structure for table `driver_documents`
--

CREATE TABLE `driver_documents` (
  `id` char(36) NOT NULL,
  `driver_id` char(36) NOT NULL,
  `document_type` varchar(50) NOT NULL,
  `document_number` varchar(50) DEFAULT NULL,
  `file_url` varchar(500) DEFAULT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `expiry_date` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `driver_vehicles`
--

CREATE TABLE `driver_vehicles` (
  `id` char(36) NOT NULL,
  `driver_id` char(36) NOT NULL,
  `vehicle_category_id` int(10) UNSIGNED DEFAULT NULL,
  `vehicle_make` varchar(50) DEFAULT NULL,
  `vehicle_model` varchar(100) NOT NULL,
  `vehicle_number` varchar(20) NOT NULL,
  `vehicle_color` varchar(30) DEFAULT NULL,
  `vehicle_year` year(4) DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 1,
  `is_verified` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `driver_vehicles`
--

INSERT INTO `driver_vehicles` (`id`, `driver_id`, `vehicle_category_id`, `vehicle_make`, `vehicle_model`, `vehicle_number`, `vehicle_color`, `vehicle_year`, `is_primary`, `is_verified`, `created_at`, `updated_at`) VALUES
('cfc0c979-2405-4662-9844-40d37aaf1680', 'fba8073b-7867-4d06-bcf1-13e0b0f887e8', 2, NULL, 'Hyundai Verna', 'TN 09 CD 7721', 'Silver', NULL, 1, 1, '2026-09-11 16:23:21', '2026-09-11 16:23:21'),
('fb8f81a7-9ff7-4e0b-b3fa-9ded668df093', 'b15f4ee5-bde8-4648-9d9a-30629186ff54', 1, NULL, 'Maruti Suzuki Dzire', 'TN 15 AB 4863', 'White', NULL, 1, 1, '2026-09-11 16:23:21', '2026-09-11 16:23:21');

-- --------------------------------------------------------

--
-- Table structure for table `driver_wallets`
--

CREATE TABLE `driver_wallets` (
  `id` char(36) NOT NULL,
  `driver_id` char(36) NOT NULL,
  `balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `driver_wallets`
--

INSERT INTO `driver_wallets` (`id`, `driver_id`, `balance`, `is_active`, `updated_at`) VALUES
('6599d8d1-17e7-4ded-a815-8c38576091e2', 'fba8073b-7867-4d06-bcf1-13e0b0f887e8', 500.00, 1, '2026-09-11 16:23:21'),
('e63dabaa-0dec-40e9-9938-cef5b0e2648d', 'b15f4ee5-bde8-4648-9d9a-30629186ff54', 500.00, 1, '2026-09-11 16:23:21');

-- --------------------------------------------------------

--
-- Table structure for table `driver_wallet_transactions`
--

CREATE TABLE `driver_wallet_transactions` (
  `id` char(36) NOT NULL,
  `driver_id` char(36) NOT NULL,
  `type` enum('CREDIT','DEBIT') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `reference_id` char(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `fare_rules`
--

CREATE TABLE `fare_rules` (
  `id` int(10) UNSIGNED NOT NULL,
  `city_id` int(10) UNSIGNED DEFAULT NULL,
  `vehicle_category_id` int(10) UNSIGNED NOT NULL,
  `base_fare` decimal(8,2) NOT NULL,
  `per_km_fare` decimal(6,2) NOT NULL,
  `per_min_fare` decimal(6,2) NOT NULL DEFAULT 0.00,
  `minimum_fare` decimal(8,2) NOT NULL DEFAULT 0.00,
  `surge_multiplier` decimal(3,2) NOT NULL DEFAULT 1.00,
  `night_surge_multiplier` decimal(3,2) NOT NULL DEFAULT 1.00,
  `cancellation_fee` decimal(8,2) NOT NULL DEFAULT 50.00,
  `waiting_charge_per_min` decimal(6,2) NOT NULL DEFAULT 2.00,
  `free_waiting_minutes` int(11) NOT NULL DEFAULT 5,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `fare_rules`
--

INSERT INTO `fare_rules` (`id`, `city_id`, `vehicle_category_id`, `base_fare`, `per_km_fare`, `per_min_fare`, `minimum_fare`, `surge_multiplier`, `night_surge_multiplier`, `cancellation_fee`, `waiting_charge_per_min`, `free_waiting_minutes`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 99.00, 14.00, 2.00, 99.00, 1.00, 1.25, 25.00, 2.00, 5, 1, '2026-09-11 16:23:20', '2026-09-11 16:23:20'),
(2, 1, 2, 149.00, 18.00, 2.50, 149.00, 1.00, 1.25, 50.00, 2.50, 5, 1, '2026-09-11 16:23:20', '2026-09-11 16:23:20'),
(3, 1, 3, 249.00, 22.00, 3.00, 249.00, 1.00, 1.50, 75.00, 3.00, 5, 1, '2026-09-11 16:23:20', '2026-09-11 16:23:20'),
(4, 1, 4, 999.00, 12.00, 0.00, 999.00, 1.00, 1.00, 200.00, 0.00, 0, 1, '2026-09-11 16:23:20', '2026-09-11 16:23:20');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` char(36) NOT NULL,
  `user_id` char(36) DEFAULT NULL,
  `user_type` enum('CUSTOMER','DRIVER','ADMIN') DEFAULT NULL,
  `audience` enum('ALL','CUSTOMERS','DRIVERS') DEFAULT NULL,
  `title` varchar(150) NOT NULL,
  `message` text NOT NULL,
  `type` enum('RIDE_UPDATE','PAYMENT','PROMO','SYSTEM','ALERT') NOT NULL DEFAULT 'SYSTEM',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `data_payload` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `offers`
--

CREATE TABLE `offers` (
  `id` char(36) NOT NULL,
  `title` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `offer_type` enum('BANNER','POPUP','INLINE') NOT NULL DEFAULT 'BANNER',
  `target_audience` enum('ALL','NEW_USERS','RETURNING') NOT NULL DEFAULT 'ALL',
  `action_url` varchar(500) DEFAULT NULL,
  `coupon_id` char(36) DEFAULT NULL,
  `priority` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `starts_at` timestamp NULL DEFAULT NULL,
  `ends_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `otp_verifications`
--

CREATE TABLE `otp_verifications` (
  `id` char(36) NOT NULL,
  `phone` varchar(15) NOT NULL,
  `otp` varchar(10) NOT NULL,
  `purpose` enum('LOGIN','REGISTRATION','RESET') NOT NULL DEFAULT 'LOGIN',
  `is_used` tinyint(1) NOT NULL DEFAULT 0,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` char(36) NOT NULL,
  `booking_id` char(36) NOT NULL,
  `customer_id` char(36) NOT NULL,
  `driver_id` char(36) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `method` enum('CASH','WALLET','UPI','CARD') NOT NULL DEFAULT 'CASH',
  `status` enum('PENDING','COMPLETED','REFUNDED','FAILED') NOT NULL DEFAULT 'PENDING',
  `gateway_txn_id` varchar(100) DEFAULT NULL,
  `metadata` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sos_alerts`
--

CREATE TABLE `sos_alerts` (
  `id` char(36) NOT NULL,
  `booking_id` char(36) NOT NULL,
  `triggered_by` enum('CUSTOMER','DRIVER') NOT NULL,
  `triggered_by_id` char(36) NOT NULL,
  `lat` decimal(10,7) DEFAULT NULL,
  `lng` decimal(10,7) DEFAULT NULL,
  `status` enum('ACTIVE','RESOLVED','FALSE_ALARM') NOT NULL DEFAULT 'ACTIVE',
  `notes` text DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `support_messages`
--

CREATE TABLE `support_messages` (
  `id` char(36) NOT NULL,
  `ticket_id` char(36) NOT NULL,
  `sender_type` enum('USER','ADMIN') NOT NULL,
  `sender_id` char(36) DEFAULT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `support_tickets`
--

CREATE TABLE `support_tickets` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `user_type` enum('CUSTOMER','DRIVER') NOT NULL,
  `booking_id` char(36) DEFAULT NULL,
  `subject` varchar(200) NOT NULL,
  `status` enum('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  `priority` enum('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `vehicle_categories`
--

CREATE TABLE `vehicle_categories` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(50) NOT NULL,
  `code` varchar(20) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `icon_url` varchar(500) DEFAULT NULL,
  `seat_capacity` tinyint(3) UNSIGNED NOT NULL DEFAULT 4,
  `base_fare` decimal(8,2) NOT NULL DEFAULT 0.00,
  `per_km_fare` decimal(6,2) NOT NULL DEFAULT 0.00,
  `per_min_fare` decimal(6,2) NOT NULL DEFAULT 0.00,
  `minimum_fare` decimal(8,2) NOT NULL DEFAULT 0.00,
  `cancellation_fee` decimal(8,2) NOT NULL DEFAULT 0.00,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `vehicle_categories`
--

INSERT INTO `vehicle_categories` (`id`, `name`, `code`, `description`, `icon_url`, `seat_capacity`, `base_fare`, `per_km_fare`, `per_min_fare`, `minimum_fare`, `cancellation_fee`, `is_active`, `sort_order`, `created_at`, `updated_at`) VALUES
(1, 'Red Mini', 'MINI', 'Budget-friendly compact rides', NULL, 4, 99.00, 14.00, 2.00, 99.00, 25.00, 1, 1, '2026-09-11 16:23:20', '2026-09-11 16:23:20'),
(2, 'Red Sedan', 'SEDAN', 'Comfortable sedan rides', NULL, 4, 149.00, 18.00, 2.50, 149.00, 50.00, 1, 2, '2026-09-11 16:23:20', '2026-09-11 16:23:20'),
(3, 'Red SUV', 'SUV', 'Premium SUV experience', NULL, 6, 249.00, 22.00, 3.00, 249.00, 75.00, 1, 3, '2026-09-11 16:23:20', '2026-09-11 16:23:20'),
(4, 'Red Outstation', 'OUTSTATION', 'Long-distance inter-city travel', NULL, 4, 999.00, 12.00, 0.00, 999.00, 200.00, 1, 4, '2026-09-11 16:23:20', '2026-09-11 16:23:20');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin_users`
--
ALTER TABLE `admin_users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_admin_email` (`email`),
  ADD KEY `idx_admin_active` (`is_active`);

--
-- Indexes for table `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_b_customer` (`customer_id`),
  ADD KEY `idx_b_driver` (`driver_id`),
  ADD KEY `idx_b_status` (`status`),
  ADD KEY `idx_b_created` (`created_at`),
  ADD KEY `idx_b_payment` (`payment_status`);

--
-- Indexes for table `booking_locations`
--
ALTER TABLE `booking_locations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_bl_booking` (`booking_id`);

--
-- Indexes for table `cancellations`
--
ALTER TABLE `cancellations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_canc_booking` (`booking_id`);

--
-- Indexes for table `chat_messages`
--
ALTER TABLE `chat_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_chat_booking` (`booking_id`);

--
-- Indexes for table `cities`
--
ALTER TABLE `cities`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_cities_name` (`name`),
  ADD KEY `idx_cities_active` (`is_active`);

--
-- Indexes for table `coupons`
--
ALTER TABLE `coupons`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_coupons_code` (`code`),
  ADD KEY `idx_coupons_active` (`is_active`);

--
-- Indexes for table `coupon_usage`
--
ALTER TABLE `coupon_usage`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_cu_coupon` (`coupon_id`),
  ADD KEY `idx_cu_customer` (`customer_id`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_customers_phone` (`phone`),
  ADD KEY `idx_customers_email` (`email`),
  ADD KEY `idx_customers_status` (`status`),
  ADD KEY `idx_customers_city` (`city_id`);

--
-- Indexes for table `customer_saved_places`
--
ALTER TABLE `customer_saved_places`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_saved_customer` (`customer_id`);

--
-- Indexes for table `customer_wallets`
--
ALTER TABLE `customer_wallets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_cw_customer` (`customer_id`);

--
-- Indexes for table `customer_wallet_transactions`
--
ALTER TABLE `customer_wallet_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_cwt_customer` (`customer_id`),
  ADD KEY `idx_cwt_type` (`type`);

--
-- Indexes for table `drivers`
--
ALTER TABLE `drivers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_drivers_phone` (`phone`),
  ADD KEY `idx_drivers_status` (`approval_status`),
  ADD KEY `idx_drivers_online` (`is_online`),
  ADD KEY `idx_drivers_city` (`city_id`);

--
-- Indexes for table `driver_documents`
--
ALTER TABLE `driver_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_dd_driver` (`driver_id`);

--
-- Indexes for table `driver_vehicles`
--
ALTER TABLE `driver_vehicles`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_dv_driver` (`driver_id`),
  ADD KEY `idx_dv_number` (`vehicle_number`);

--
-- Indexes for table `driver_wallets`
--
ALTER TABLE `driver_wallets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_dw_driver` (`driver_id`);

--
-- Indexes for table `driver_wallet_transactions`
--
ALTER TABLE `driver_wallet_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_dwt_driver` (`driver_id`);

--
-- Indexes for table `fare_rules`
--
ALTER TABLE `fare_rules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_fr_city` (`city_id`),
  ADD KEY `idx_fr_vehicle` (`vehicle_category_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notif_user` (`user_id`,`user_type`),
  ADD KEY `idx_notif_audience` (`audience`);

--
-- Indexes for table `offers`
--
ALTER TABLE `offers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_offers_active` (`is_active`);

--
-- Indexes for table `otp_verifications`
--
ALTER TABLE `otp_verifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_otp_phone` (`phone`,`purpose`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pay_booking` (`booking_id`),
  ADD KEY `idx_pay_customer` (`customer_id`);

--
-- Indexes for table `sos_alerts`
--
ALTER TABLE `sos_alerts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sos_booking` (`booking_id`),
  ADD KEY `idx_sos_status` (`status`);

--
-- Indexes for table `support_messages`
--
ALTER TABLE `support_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sm_ticket` (`ticket_id`);

--
-- Indexes for table `support_tickets`
--
ALTER TABLE `support_tickets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_st_user` (`user_id`,`user_type`),
  ADD KEY `idx_st_status` (`status`);

--
-- Indexes for table `vehicle_categories`
--
ALTER TABLE `vehicle_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_vc_code` (`code`),
  ADD KEY `idx_vc_active` (`is_active`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `cities`
--
ALTER TABLE `cities`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `fare_rules`
--
ALTER TABLE `fare_rules`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `vehicle_categories`
--
ALTER TABLE `vehicle_categories`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
