-- Run this in phpMyAdmin on your cPanel live database to clean all fake starter balances
UPDATE `driver_wallets` SET `balance` = 0.00 WHERE `driver_id` IN (SELECT id FROM `drivers` WHERE `phone` = '9655247872');
-- Optional: if you want all existing test drivers on cPanel reset to 0:
-- UPDATE `driver_wallets` SET `balance` = 0.00;
-- UPDATE `customer_wallets` SET `balance` = 0.00;

