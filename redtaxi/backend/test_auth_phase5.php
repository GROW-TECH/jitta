<?php
/**
 * RedTaxi - Phase 5 Authorization Testing
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/utils/Security.php';

$pdo = Database::getInstance()->getConnection();

function httpPost($url, $data = null, $token = null) {
    $ch = curl_init('http://127.0.0.1:8001' . $url);
    $headers = array('Content-Type: application/json');
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return array('code' => $httpCode, 'body' => json_decode($res, true));
}

function httpGet($url, $token = null) {
    $ch = curl_init('http://127.0.0.1:8001' . $url);
    $headers = array();
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return array('code' => $httpCode, 'body' => json_decode($res, true));
}

echo "=== Testing Authorization ===\n";

// Register/Reset Customer
$testCustPass = password_hash('Pass123!', PASSWORD_BCRYPT);
$pdo->prepare("INSERT INTO customers (id, name, phone, email, password_hash, status, created_at, updated_at)
               VALUES ('cust-auth-test-id', 'Auth Test Customer', '9800000001', 'authtest@test.com', ?, 'ACTIVE', NOW(), NOW())
               ON DUPLICATE KEY UPDATE password_hash = ?, status = 'ACTIVE'")
    ->execute(array($testCustPass, $testCustPass));

// Login Customer
$custLogin = httpPost('/api/v1/auth/customer/login', array('identifier' => '9800000001', 'password' => 'Pass123!'));
$customerToken = isset($custLogin['body']['data']['token']) ? $custLogin['body']['data']['token'] : null;

// Login Driver
$driverLogin = httpPost('/api/v1/auth/driver/login', array('phone' => '9876543210', 'otp' => '4821'));
$driverToken = isset($driverLogin['body']['data']['token']) ? $driverLogin['body']['data']['token'] : null;

// Login Admin
$adminLogin = httpPost('/api/v1/auth/admin/login', array('email' => 'admin@redtaxi.in', 'password' => 'admin123'));
$adminToken = isset($adminLogin['body']['data']['token']) ? $adminLogin['body']['data']['token'] : null;

echo "Customer Token: " . ($customerToken ? "YES" : "NO") . "\n";
echo "Driver Token: " . ($driverToken ? "YES" : "NO") . "\n";
echo "Admin Token: " . ($adminToken ? "YES" : "NO") . "\n\n";

// 1. Customer cannot access Admin dashboard
$r1 = httpGet('/api/v1/admin/dashboard', $customerToken);
echo "[TEST] Customer accessing Admin API: HTTP " . $r1['code'] . " - " . ($r1['code'] === 403 ? "PASS" : "FAIL") . "\n";

// 2. Customer cannot access Driver profile
$r2 = httpGet('/api/v1/driver/profile', $customerToken);
echo "[TEST] Customer accessing Driver API: HTTP " . $r2['code'] . " - " . ($r2['code'] === 403 ? "PASS" : "FAIL") . "\n";

// 3. Driver cannot access Admin dashboard
$r3 = httpGet('/api/v1/admin/dashboard', $driverToken);
echo "[TEST] Driver accessing Admin API: HTTP " . $r3['code'] . " - " . ($r3['code'] === 403 ? "PASS" : "FAIL") . "\n";

// 4. Admin cannot access Driver profile
$r4 = httpGet('/api/v1/driver/profile', $adminToken);
echo "[TEST] Admin accessing Driver API: HTTP " . $r4['code'] . " - " . ($r4['code'] === 403 ? "PASS" : "FAIL") . "\n";

// 5. Unauthenticated request to protected endpoint
$r5 = httpGet('/api/v1/booking/active');
echo "[TEST] Unauthenticated request to active booking: HTTP " . $r5['code'] . " - " . ($r5['code'] === 401 ? "PASS" : "FAIL") . "\n";

// 6. Admin accessing Admin API
$r6 = httpGet('/api/v1/admin/dashboard', $adminToken);
echo "[TEST] Admin accessing Admin API: HTTP " . $r6['code'] . " - " . ($r6['code'] === 200 ? "PASS" : "FAIL") . "\n";
