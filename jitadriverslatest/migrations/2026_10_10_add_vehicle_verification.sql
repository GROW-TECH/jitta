-- Migration: Add vehicle verification columns and indexes to bookings
-- Date: 2026-10-10
-- Compatibility: MariaDB 10.4+ / MySQL 5.7+

ALTER TABLE `bookings`
  ADD COLUMN IF NOT EXISTS `vehicle_reg_no` VARCHAR(20) NULL DEFAULT NULL AFTER `customer_vehicle_details`,
  ADD COLUMN IF NOT EXISTS `vehicle_reg_normalized` VARCHAR(20) NULL DEFAULT NULL AFTER `vehicle_reg_no`,
  ADD COLUMN IF NOT EXISTS `vehicle_verification_status` ENUM('NOT_PROVIDED','FORMAT_VALID','VERIFICATION_PENDING','VERIFIED','VERIFICATION_FAILED','VERIFICATION_UNAVAILABLE') NOT NULL DEFAULT 'NOT_PROVIDED' AFTER `vehicle_reg_normalized`,
  ADD COLUMN IF NOT EXISTS `vehicle_verified_at` DATETIME NULL DEFAULT NULL AFTER `vehicle_verification_status`,
  ADD COLUMN IF NOT EXISTS `vehicle_verification_provider` VARCHAR(50) NULL DEFAULT NULL AFTER `vehicle_verified_at`,
  ADD COLUMN IF NOT EXISTS `vehicle_verification_details` TEXT NULL DEFAULT NULL AFTER `vehicle_verification_provider`,
  ADD COLUMN IF NOT EXISTS `driver_vehicle_confirmed` TINYINT(1) NOT NULL DEFAULT 0 AFTER `vehicle_verification_details`,
  ADD COLUMN IF NOT EXISTS `driver_vehicle_confirmed_at` DATETIME NULL DEFAULT NULL AFTER `driver_vehicle_confirmed`,
  ADD COLUMN IF NOT EXISTS `driver_mismatch_reported` TINYINT(1) NOT NULL DEFAULT 0 AFTER `driver_vehicle_confirmed_at`,
  ADD COLUMN IF NOT EXISTS `driver_mismatch_reason` VARCHAR(255) NULL DEFAULT NULL AFTER `driver_mismatch_reported`;

ALTER TABLE `bookings`
  ADD INDEX IF NOT EXISTS `idx_bookings_veh_reg_norm` (`vehicle_reg_normalized`),
  ADD INDEX IF NOT EXISTS `idx_bookings_veh_verif_status` (`vehicle_verification_status`);
