<?php
/**
 * Test Suite for Phase 4: Admin Workflow APIs
 */

$baseUrl = 'http://127.0.0.1:8001/api/v1';

function makeRequest($method, $url, $data = null, $token = null) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    $headers = array('Content-Type: application/json');
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($data) ? $data : json_encode($data));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return array(
        'code' => $httpCode,
        'body' => json_decode($response, true),
        'raw'  => $response
    );
}

function testAssert($condition, $testName, $details = '') {
    if ($condition) {
        echo " [PASS] $testName\n";
    } else {
        echo "![FAIL] $testName. $details\n";
        exit(1);
    }
}

echo "==================================================\n";
echo "RED TAXI - PHASE 4 ADMIN API INTEGRATION TESTS\n";
echo "==================================================\n\n";

// 1. Admin Login
echo "1. Testing Admin Login...\n";
$loginRes = makeRequest('POST', $baseUrl . '/auth/admin/login', array(
    'email'    => 'admin@redtaxi.in',
    'password' => 'admin123'
));

testAssert($loginRes['code'] === 200, "Admin login response code is 200", "Got: {$loginRes['code']}");
testAssert(isset($loginRes['body']['data']['token']), "Admin token returned");
testAssert($loginRes['body']['data']['admin']['email'] === 'admin@redtaxi.in', "Admin email matches");
$adminToken = $loginRes['body']['data']['token'];
echo "   Admin Token: " . substr($adminToken, 0, 20) . "...\n";

// 2. Auth Me with Admin Token
echo "\n2. Testing /auth/me with Admin Token...\n";
$meRes = makeRequest('GET', $baseUrl . '/auth/me', null, $adminToken);
testAssert($meRes['code'] === 200, "/auth/me returns 200", "Got: {$meRes['code']}");
testAssert($meRes['body']['data']['role'] === 'admin', "Role is admin");

// 3. Security Check: Customer Token Cannot Access Admin Endpoints
echo "\n3. Testing Security Protection (Customer cannot access Admin API)...\n";
// Create customer token
require_once __DIR__ . '/utils/Security.php';
$custToken = Security::generateToken('fake-cust-id', 'customer', array('name' => 'Fake Customer'));
$secRes = makeRequest('GET', $baseUrl . '/admin/dashboard', null, $custToken);
testAssert($secRes['code'] === 403, "Customer token forbidden on /admin/dashboard (403)", "Got: {$secRes['code']}");

// 4. Admin Dashboard Stats
echo "\n4. Testing /admin/dashboard...\n";
$dashRes = makeRequest('GET', $baseUrl . '/admin/dashboard', null, $adminToken);
testAssert($dashRes['code'] === 200, "Dashboard stats return 200");
testAssert(isset($dashRes['body']['data']['kpis']), "KPIs object present");
$kpis = $dashRes['body']['data']['kpis'];
echo "   Total Bookings: {$kpis['total_bookings']}\n";
echo "   Total Customers: {$kpis['total_customers']}\n";
echo "   Total Drivers: {$kpis['total_drivers']}\n";
echo "   Total Revenue: Rs. {$kpis['total_revenue']}\n";
testAssert($kpis['total_customers'] > 0, "Customers count > 0");

// 5. Admin Customers List & Status Toggle
echo "\n5. Testing /admin/customers and status update...\n";
$custsRes = makeRequest('GET', $baseUrl . '/admin/customers?limit=10', null, $adminToken);
testAssert($custsRes['code'] === 200, "Get customers returns 200");
testAssert(count($custsRes['body']['data']['customers']) > 0, "Customers list not empty");
$targetCust = $custsRes['body']['data']['customers'][0];
echo "   First Customer: {$targetCust['name']} ({$targetCust['phone']}) - Status: {$targetCust['status']}\n";

// Toggle status
$newCustStatus = $targetCust['status'] === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
$patchCust = makeRequest('PATCH', $baseUrl . '/admin/customers/' . $targetCust['id'] . '/status', array(
    'status' => $newCustStatus
), $adminToken);
testAssert($patchCust['code'] === 200, "Update customer status returns 200");

// Revert status
makeRequest('PATCH', $baseUrl . '/admin/customers/' . $targetCust['id'] . '/status', array(
    'status' => $targetCust['status']
), $adminToken);
echo "   Customer status verified & reverted.\n";

// 6. Admin Drivers List & Approval Update
echo "\n6. Testing /admin/drivers and approval update...\n";
$driversRes = makeRequest('GET', $baseUrl . '/admin/drivers', null, $adminToken);
testAssert($driversRes['code'] === 200, "Get drivers returns 200");
testAssert(count($driversRes['body']['data']['drivers']) > 0, "Drivers list not empty");
$targetDriver = $driversRes['body']['data']['drivers'][0];
echo "   Driver: {$targetDriver['name']} ({$targetDriver['phone']}) - Approval: {$targetDriver['approval_status']}\n";

// Update approval
$patchAppr = makeRequest('PATCH', $baseUrl . '/admin/drivers/' . $targetDriver['id'] . '/approval', array(
    'approval_status' => 'APPROVED'
), $adminToken);
testAssert($patchAppr['code'] === 200, "Update driver approval returns 200");

// 7. Admin Vehicles Fleet & Category Toggle
echo "\n7. Testing /admin/vehicles and toggle...\n";
$vehRes = makeRequest('GET', $baseUrl . '/admin/vehicles', null, $adminToken);
testAssert($vehRes['code'] === 200, "Get vehicles returns 200");
testAssert(count($vehRes['body']['data']['categories']) > 0, "Vehicle categories returned");
$targetCategory = $vehRes['body']['data']['categories'][0];
echo "   Vehicle Category: {$targetCategory['name']} (Base: Rs. {$targetCategory['base_price']}, Per KM: Rs. {$targetCategory['per_km_rate']})\n";

// 8. Admin Bookings List & Assignment
echo "\n8. Testing /admin/bookings and driver assignment...\n";
$bookRes = makeRequest('GET', $baseUrl . '/admin/bookings?limit=20', null, $adminToken);
testAssert($bookRes['code'] === 200, "Get bookings returns 200");
testAssert(count($bookRes['body']['data']['bookings']) > 0, "Bookings list not empty");

// Find or reset a booking to SEARCHING
$testBooking = null;
foreach ($bookRes['body']['data']['bookings'] as $b) {
    if ($b['status'] === 'SEARCHING' || $b['status'] === 'ASSIGNED') {
        $testBooking = $b;
        break;
    }
}

if (!$testBooking) {
    // Pick the first booking and reset status to SEARCHING for test
    $first = $bookRes['body']['data']['bookings'][0];
    makeRequest('PATCH', $baseUrl . '/admin/bookings/' . $first['id'] . '/status', array('status' => 'SEARCHING'), $adminToken);
    $testBooking = $first;
    $testBooking['status'] = 'SEARCHING';
}

echo "   Booking ID: " . substr($testBooking['id'], 0, 8) . "... (Status: {$testBooking['status']})\n";

$assignRes = makeRequest('POST', $baseUrl . '/admin/bookings/' . $testBooking['id'] . '/assign', array(
    'driver_id' => $targetDriver['id']
), $adminToken);
testAssert($assignRes['code'] === 200, "Assign driver returns 200", "Got: {$assignRes['code']} - " . json_encode($assignRes['body']));
testAssert($assignRes['body']['data']['driver_id'] === $targetDriver['id'], "Driver assigned to booking");
testAssert($assignRes['body']['data']['status'] === 'ASSIGNED', "Booking status changed to ASSIGNED");
echo "   Driver {$targetDriver['name']} successfully assigned to booking!\n";

// 9. Admin Fare Rules & Update
echo "\n9. Testing /admin/fare-rules and rule update...\n";
$fareRes = makeRequest('GET', $baseUrl . '/admin/fare-rules', null, $adminToken);
testAssert($fareRes['code'] === 200, "Get fare rules returns 200");
testAssert(count($fareRes['body']['data']['fare_rules']) > 0, "Fare rules returned");
$targetRule = $fareRes['body']['data']['fare_rules'][0];
echo "   Fare Rule for: {$targetRule['category_name']} (Base: Rs. {$targetRule['base_fare']}, Per KM: Rs. {$targetRule['per_km']})\n";

$updateFare = makeRequest('PUT', $baseUrl . '/admin/fare-rules/' . $targetRule['id'], array(
    'base_fare'            => $targetRule['base_fare'],
    'free_km'              => $targetRule['free_km'],
    'per_km'               => $targetRule['per_km'],
    'per_minute'           => $targetRule['per_minute'],
    'waiting_per_min'      => $targetRule['waiting_per_min'],
    'night_charge_percent' => $targetRule['night_charge_percent'],
    'platform_fee'         => $targetRule['platform_fee'],
    'tax_percent'          => $targetRule['tax_percent'],
    'cancellation_fee'     => $targetRule['cancellation_fee'],
    'is_active'            => 1
), $adminToken);
testAssert($updateFare['code'] === 200, "Update fare rule returns 200");

echo "\n==================================================\n";
echo "ALL PHASE 4 ADMIN API TESTS PASSED SUCCESSFULLY!\n";
echo "==================================================\n";
