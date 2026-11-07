SET FOREIGN_KEY_CHECKS = 0;

-- 1. Wipe all ride history & related logs
DELETE FROM `payments`;
DELETE FROM `cancellations`;
DELETE FROM `coupon_usage`;
DELETE FROM `booking_locations`;
DELETE FROM `chat_messages`;
DELETE FROM `bookings`;

-- 2. Wipe transaction histories & notifications
DELETE FROM `driver_wallet_transactions`;
DELETE FROM `customer_wallet_transactions`;
DELETE FROM `notifications`;

-- 3. Remove all other drivers except Siva P (9655247872)
DELETE FROM `driver_documents` WHERE `driver_id` NOT IN (SELECT `id` FROM `drivers` WHERE `phone` LIKE '%9655247872%');
DELETE FROM `driver_vehicles` WHERE `driver_id` NOT IN (SELECT `id` FROM `drivers` WHERE `phone` LIKE '%9655247872%');
DELETE FROM `driver_wallets` WHERE `driver_id` NOT IN (SELECT `id` FROM `drivers` WHERE `phone` LIKE '%9655247872%');
DELETE FROM `drivers` WHERE `phone` NOT LIKE '%9655247872%';

-- 4. Remove all other customers except 9025148564
DELETE FROM `customer_saved_places` WHERE `customer_id` NOT IN (SELECT `id` FROM `customers` WHERE `phone` LIKE '%9025148564%');
DELETE FROM `customer_wallets` WHERE `customer_id` NOT IN (SELECT `id` FROM `customers` WHERE `phone` LIKE '%9025148564%');
DELETE FROM `customers` WHERE `phone` NOT LIKE '%9025148564%';

-- 5. Reset Siva P's wallet & earnings stats to completely fresh 0.00
UPDATE `driver_wallets`
SET `balance` = 0.00,
    `today_earnings` = 0.00,
    `today_trips` = 0,
    `total_commission_paid` = 0.00,
    `total_earned` = 0.00,
    `total_trips` = 0;

UPDATE `drivers`
SET `total_rides` = 0,
    `total_earnings` = 0.00;

-- 6. Reset customer wallet to 0.00
UPDATE `customer_wallets`
SET `balance` = 0.00;

SET FOREIGN_KEY_CHECKS = 1;
