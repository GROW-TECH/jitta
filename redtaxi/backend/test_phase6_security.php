<?php
/**
 * RedTaxi Phase 6 - Comprehensive Security & Authorization Test Suite
 * Directly verifies the 10 required security scenarios specified in MVP PRD:
 * 1. Customer calls Admin API -> must fail (403)
 * 2. Driver calls Admin API -> must fail (403)
 * 3. Customer accesses another customer's booking -> must fail (403/404)
 * 4. Driver accesses another driver's ride -> must fail (403/404)
 * 5. Unapproved driver accepts ride -> must fail (403)
 * 6. Invalid booking status transition -> must fail (400)
 * 7. Invalid rating -> must fail (400/422)
 * 8. Duplicate rating -> must fail (400)
 * 9. SQL injection-style input -> safely handled
 * 10. Invalid authentication token/session -> must fail (401)
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/utils/Security.php';

$baseUrl = 'http://127.0.0.1:8001/api/v1';

function httpCall($method, $endpoint, $payload = null, $token = null)
{
    global $baseUrl;
    $url = $baseUrl . $endpoint;
    $ch = curl_init($url);

    $headers = array('Content-Type: application/json');
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return array(
        'code' => $httpCode,
        'body' => json_decode($response, true)
    );
}

$db = Database::getInstance()->getConnection();

$testsPassed = 0;
$testsFailed = 0;

function assertSecurity($scenarioNumber, $title, $conditionMet, $details = '')
{
    global $testsPassed, $testsFailed;
    if ($conditionMet) {
        echo "  [PASS] Scenario {$scenarioNumber}: {$title}\n";
        $testsPassed++;
    } else {
        echo "  [FAIL] Scenario {$scenarioNumber}: {$title}\n";
        if ($details) {
            echo "         Details: {$details}\n";
        }
        $testsFailed++;
    }
}

echo "\n=======================================================\n";
echo "  RED TAXI - PHASE 6: SECURITY & AUTHORIZATION TEST SUITE\n";
echo "=======================================================\n\n";

// Setup Test Users
$custAId = Security::generateUUID();
$custBId = Security::generateUUID();
$db->prepare("INSERT INTO customers (id, name, phone, email, password_hash, status, created_at) VALUES (?, 'Customer A', '9700000001', 'custA@sec.com', 'hash', 'ACTIVE', NOW())")->execute(array($custAId));
$db->prepare("INSERT INTO customers (id, name, phone, email, password_hash, status, created_at) VALUES (?, 'Customer B', '9700000002', 'custB@sec.com', 'hash', 'ACTIVE', NOW())")->execute(array($custBId));

$driverAId = Security::generateUUID();
$driverBId = Security::generateUUID();
$unapprovedDriverId = Security::generateUUID();

$db->prepare("INSERT INTO drivers (id, name, phone, approval_status, is_online, rating, trips_count, created_at) VALUES (?, 'Driver Alpha', '9800000001', 'APPROVED', 1, 5.0, 10, NOW())")->execute(array($driverAId));
$db->prepare("INSERT INTO drivers (id, name, phone, approval_status, is_online, rating, trips_count, created_at) VALUES (?, 'Driver Beta', '9800000002', 'APPROVED', 1, 5.0, 10, NOW())")->execute(array($driverBId));
$db->prepare("INSERT INTO drivers (id, name, phone, approval_status, is_online, rating, trips_count, created_at) VALUES (?, 'Driver Unapproved', '9800000003', 'PENDING', 0, 5.0, 0, NOW())")->execute(array($unapprovedDriverId));

// Generate tokens
$tokenCustA = Security::generateToken($custAId, 'customer', array('name' => 'Customer A'));
$tokenCustB = Security::generateToken($custBId, 'customer', array('name' => 'Customer B'));
$tokenDriverA = Security::generateToken($driverAId, 'driver', array('name' => 'Driver Alpha'));
$tokenDriverB = Security::generateToken($driverBId, 'driver', array('name' => 'Driver Beta'));
$tokenUnapprovedDriver = Security::generateToken($unapprovedDriverId, 'driver', array('name' => 'Driver Unapproved'));

$adminRow = $db->query("SELECT id, email, role FROM admin_users WHERE email = 'admin@redtaxi.in'")->fetch();
$tokenAdmin = Security::generateToken($adminRow['id'], 'admin', array('email' => $adminRow['email'], 'role' => $adminRow['role']));

// --- Scenario 1: Customer calls Admin API -> must fail (403) ---
$res = httpCall('GET', '/admin/dashboard', null, $tokenCustA);
assertSecurity(1, 'Customer calls Admin API (/admin/dashboard) -> HTTP 403 Forbidden', $res['code'] === 403, "Got HTTP {$res['code']}");

// --- Scenario 2: Driver calls Admin API -> must fail (403) ---
$res = httpCall('GET', '/admin/customers', null, $tokenDriverA);
assertSecurity(2, 'Driver calls Admin API (/admin/customers) -> HTTP 403 Forbidden', $res['code'] === 403, "Got HTTP {$res['code']}");

// --- Create a Booking for Customer A ---
$bookingAId = Security::generateUUID();
$db->prepare("INSERT INTO bookings (id, customer_id, driver_id, city_id, ride_type, vehicle_category, status, start_otp, distance_km, duration_min, total_fare, payment_method, payment_status, created_at) 
    VALUES (?, ?, ?, 1, 'CITY', 'Red Sedan', 'IN_PROGRESS', '7788', 10.0, 20.0, 250.00, 'CASH', 'PENDING', NOW())")
    ->execute(array($bookingAId, $custAId, $driverAId));

// --- Scenario 3: Customer B accesses Customer A's booking -> must fail (403 / 404) ---
$res = httpCall('GET', "/booking/{$bookingAId}", null, $tokenCustB);
assertSecurity(3, "Customer accesses another customer's booking -> Access Denied (HTTP 403/404)", in_array($res['code'], array(403, 404), true), "Got HTTP {$res['code']}");

// --- Scenario 4: Driver B modifies Driver A's ride status -> must fail (404 / 403) ---
$res = httpCall('PATCH', "/driver/rides/{$bookingAId}/status", array('status' => 'COMPLETED'), $tokenDriverB);
assertSecurity(4, "Driver modifies another driver's active ride -> Rejected (HTTP 404/403)", in_array($res['code'], array(403, 404), true), "Got HTTP {$res['code']}");

// --- Create a fresh SEARCHING booking for acceptance test ---
$bookingSearchId = Security::generateUUID();
$db->prepare("INSERT INTO bookings (id, customer_id, city_id, ride_type, vehicle_category, status, start_otp, distance_km, duration_min, total_fare, payment_method, payment_status, created_at) 
    VALUES (?, ?, 1, 'CITY', 'Red Sedan', 'SEARCHING', '1234', 5.0, 15.0, 150.00, 'CASH', 'PENDING', NOW())")
    ->execute(array($bookingSearchId, $custAId));

// --- Scenario 5: Unapproved driver accepts ride -> must fail (403) ---
$res = httpCall('POST', "/driver/rides/{$bookingSearchId}/accept", null, $tokenUnapprovedDriver);
assertSecurity(5, 'Unapproved driver accepts ride -> HTTP 403 Forbidden', $res['code'] === 403, "Got HTTP {$res['code']}");

// --- Scenario 6: Invalid booking status transition -> must fail (400) ---
// Attempting to jump directly from SEARCHING to COMPLETED via driver status
$res = httpCall('PATCH', "/driver/rides/{$bookingSearchId}/status", array('status' => 'COMPLETED'), $tokenDriverA);
assertSecurity(6, 'Invalid booking status transition (SEARCHING -> COMPLETED) -> Rejected', in_array($res['code'], array(400, 404, 422), true), "Got HTTP {$res['code']}");

// Also test illegal transition: COMPLETED -> IN_PROGRESS on booking A
$db->prepare("UPDATE bookings SET status = 'COMPLETED' WHERE id = ?")->execute(array($bookingAId));
$res = httpCall('PATCH', "/driver/rides/{$bookingAId}/status", array('status' => 'IN_PROGRESS'), $tokenDriverA);
assertSecurity(6, 'Invalid transition (COMPLETED -> IN_PROGRESS) -> Rejected (HTTP 400)', $res['code'] === 400, "Got HTTP {$res['code']}");

// --- Scenario 7: Invalid rating (rating < 1 or > 5) -> must fail (400 / 422) ---
$res = httpCall('POST', '/booking/rate', array(
    'booking_id' => $bookingAId,
    'rating'     => 10
), $tokenCustA);
assertSecurity(7, 'Invalid rating (10 stars) -> Rejected with HTTP 422/400', in_array($res['code'], array(400, 422), true), "Got HTTP {$res['code']}");

// Rate booking A legitimately
$resRate = httpCall('POST', '/booking/rate', array(
    'booking_id'  => $bookingAId,
    'rating'      => 5,
    'review_text' => 'Flawless ride'
), $tokenCustA);
$firstRateOk = ($resRate['code'] === 200);

// --- Scenario 8: Duplicate rating -> must fail (400 Conflict/Bad Request) ---
$resDup = httpCall('POST', '/booking/rate', array(
    'booking_id'  => $bookingAId,
    'rating'      => 4,
    'review_text' => 'Second review attempt'
), $tokenCustA);
assertSecurity(8, 'Duplicate rating on already rated ride -> Rejected (HTTP 400)', $resDup['code'] === 400 && $firstRateOk, "Got HTTP {$resDup['code']}");

// --- Scenario 9: SQL injection-style input -> safely handled ---
$injectionPayload = "' OR '1'='1' -- ";
$resSql = httpCall('GET', '/admin/customers?search=' . urlencode($injectionPayload), null, $tokenAdmin);
$sqlSafe = ($resSql['code'] === 200 && is_array($resSql['body']['data']));
assertSecurity(9, 'SQL injection search input (\' OR \'1\'=\'1\' --) handled safely with prepared statements', $sqlSafe, "Got HTTP {$resSql['code']}");

// Also test injection in customer login identifier
$resSqlLogin = httpCall('POST', '/auth/customer/login', array(
    'identifier' => "admin@redtaxi.in' OR '1'='1",
    'password'   => "' OR '1'='1"
));
$loginSafe = in_array($resSqlLogin['code'], array(400, 401, 422), true);
assertSecurity(9, 'SQL injection in login payload safely rejected by password verify & PDO', $loginSafe, "Got HTTP {$resSqlLogin['code']}");

// --- Scenario 10: Invalid authentication token/session -> must fail (401) ---
$resForged = httpCall('GET', '/customer/profile', null, 'forged.jwt.token123');
assertSecurity(10, 'Forged authentication token -> HTTP 401 Unauthorized', $resForged['code'] === 401, "Got HTTP {$resForged['code']}");

$resNoToken = httpCall('GET', '/customer/profile', null, null);
assertSecurity(10, 'Missing authentication token -> HTTP 401 Unauthorized', $resNoToken['code'] === 401, "Got HTTP {$resNoToken['code']}");

// Cleanup test rows
$db->prepare("DELETE FROM bookings WHERE id IN (?, ?)")->execute(array($bookingAId, $bookingSearchId));
$db->prepare("DELETE FROM drivers WHERE id IN (?, ?, ?)")->execute(array($driverAId, $driverBId, $unapprovedDriverId));
$db->prepare("DELETE FROM customers WHERE id IN (?, ?)")->execute(array($custAId, $custBId));

echo "\n=======================================================\n";
echo "  SECURITY SUITE SUMMARY: {$testsPassed} PASSED, {$testsFailed} FAILED\n";
echo "=======================================================\n\n";

if ($testsFailed > 0) {
    exit(1);
}
exit(0);
