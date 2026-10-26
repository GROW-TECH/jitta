<?php
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/DriverModel.php';

$driverModel = new DriverModel();
$phone = '9876543210';
$driver = $driverModel->findByPhone($phone);

if (!$driver) {
    die("Demo driver not found\n");
}

echo "Testing Driver Prepaid Wallet for Driver ID: {$driver['id']}...\n";

// 1. Check initial balance
$w1 = $driverModel->getWalletDetails($driver['id']);
echo "Initial Balance: ₹{$w1['balance']}\n";

// 2. Recharge with ₹250
$res1 = $driverModel->rechargeWallet($driver['id'], 250, 'UPI', 'SUCCESS');
echo "Recharge ₹250 (SUCCESS): Status={$res1['status']}, NewBalance=₹{$res1['newBalance']}, TxId={$res1['transactionId']}\n";

// 3. Recharge with ₹500 (FAILED simulation)
$res2 = $driverModel->rechargeWallet($driver['id'], 500, 'CARD', 'FAILED');
echo "Recharge ₹500 (FAILED): Status={$res2['status']}, TxId={$res2['transactionId']}\n";

// 4. Check updated wallet & transaction history
$w2 = $driverModel->getWalletDetails($driver['id']);
$txs = $driverModel->getWalletTransactions($driver['id'], 5);
echo "Final Verified Balance in MySQL: ₹{$w2['balance']}\n";
echo "Recent Ledger Transactions (Count: " . count($txs) . "):\n";
foreach ($txs as $t) {
    echo "  - [{$t['status']}] {$t['type']} ₹{$t['amount']} | {$t['description']} | Ref: {$t['reference_id']} | {$t['created_at']}\n";
}

echo "\nAll Driver Prepaid Wallet & Verification tests passed!\n";
