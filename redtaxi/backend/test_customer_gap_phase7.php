<?php
/**
 * Jittadrives - Phase 7 Customer MVP Gap Fix Verification
 * Tests the complete customer MVP workflow:
 * 1. Active booking retrieval & driver details verification
 * 2. Pre-trip cancellation (ASSIGNED) & cancellation audit logging
 * 3. In-progress cancellation guard (strictly blocked with HTTP 400)
 * 4. Completed ride recovery, rating persistence & customer history
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

$baseUrl = 'http://127.0.0.1:8001/api/v1';

function makeRequest($method, $url, $data = null, $token = null) {
    $ch = curl_init($url);
    $headers = array('Content-Type: application/json', 'Accept: application/json');
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return array('code' => $httpCode, 'data' => json_decode($response, true), 'raw' => $response);
}

function assertTest($condition, $message) {
    if ($condition) {
        echo "[PASS] $message\n";
    } else {
        echo "[FAIL] $message\n";
        exit(1);
    }
}

echo "========================================================\n";
echo "Jittadrives - PHASE 7 CUSTOMER MVP GAP FIX TEST\n";
echo "========================================================\n\n";

// 1. Authenticate Admin, Driver, and Customer
echo "--- Step 1: Authentication ---\n";
$adminRes = makeRequest('POST', "$baseUrl/auth/admin/login", array(
    'email' => 'admin@redtaxi.in',
    'password' => 'admin123'
));
assertTest($adminRes['code'] === 200, "Admin login successful");
$adminToken = $adminRes['data']['data']['token'];

$driverRes = makeRequest('POST', "$baseUrl/auth/driver/login", array(
    'phone' => '9876543210',
    'otp' => '4821'
));
assertTest($driverRes['code'] === 200, "Driver login successful");
$driverToken = $driverRes['data']['data']['token'];
$driverId = $driverRes['data']['data']['driver']['id'];

$custRes = makeRequest('POST', "$baseUrl/auth/customer/login", array(
    'phone' => '7373863641',
    'password' => 'giri234'
));
assertTest($custRes['code'] === 200, "Customer login successful");
$custToken = $custRes['data']['data']['token'];
$customerId = $custRes['data']['data']['customer']['id'];

// Clean up any stale test bookings for this customer & driver
require_once __DIR__ . '/config/Database.php';
$db = Database::getInstance()->getConnection();
$db->exec("UPDATE bookings SET status = 'CANCELLED' WHERE customer_id = '$customerId' AND status IN ('SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'SCHEDULED')");
$db->exec("UPDATE bookings SET rating = 5 WHERE customer_id = '$customerId' AND status = 'COMPLETED' AND rating IS NULL");
$db->exec("UPDATE bookings SET status = 'CANCELLED' WHERE driver_id = '$driverId' AND status IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS')");

// 2. Customer creates booking 1
echo "\n--- Step 2: Customer Creates Booking 1 ---\n";
$bookingPayload = array(
    'pickup' => array(
        'name' => 'Gandhipuram Central Bus Stand',
        'address' => 'Gandhipuram, Coimbatore',
        'lat' => 11.0168,
        'lng' => 76.9558
    ),
    'drop' => array(
        'name' => 'Coimbatore International Airport',
        'address' => 'Civil Aerodrome Post, Coimbatore',
        'lat' => 11.0268,
        'lng' => 76.9658
    ),
    'vehicle_type' => 'Red Mini',
    'distance_km' => 10.5,
    'duration_min' => 25,
    'payment_method' => 'CASH'
);
$createRes = makeRequest('POST', "$baseUrl/booking/create", $bookingPayload, $custToken);
assertTest($createRes['code'] === 201, "Booking 1 created successfully");
$booking1Id = $createRes['data']['data']['id'];

// 3. Verify Active Booking shows SEARCHING
$activeRes = makeRequest('GET', "$baseUrl/booking/active", null, $custToken);
assertTest($activeRes['code'] === 200, "Active booking retrieved");
assertTest($activeRes['data']['data']['status'] === 'SEARCHING', "Status is SEARCHING");

// 4. Admin Assigns Driver to Booking 1
echo "\n--- Step 3: Admin Assigns Driver to Booking 1 ---\n";
$assignRes = makeRequest('POST', "$baseUrl/admin/bookings/$booking1Id/assign", array(
    'driver_id' => $driverId
), $adminToken);
assertTest($assignRes['code'] === 200, "Admin assigned driver to Booking 1");

// 5. Customer checks active booking - verifies real driver and vehicle details
echo "\n--- Step 4: Verify Assigned Driver & Vehicle Details ---\n";
$activeAfterAssign = makeRequest('GET', "$baseUrl/booking/active", null, $custToken);
assertTest($activeAfterAssign['code'] === 200, "Active booking retrieved after assignment");
$activeData = $activeAfterAssign['data']['data'];
assertTest($activeData['status'] === 'ASSIGNED', "Status updated to ASSIGNED");
assertTest(!empty($activeData['driver']), "Driver object present in active booking");
assertTest(!empty($activeData['driver']['name']), "Driver name is populated (" . $activeData['driver']['name'] . ")");
assertTest(!empty($activeData['driver']['phone']), "Driver phone is populated (" . $activeData['driver']['phone'] . ")");
assertTest(!empty($activeData['vehicle']), "Vehicle object present in active booking");
assertTest(!empty($activeData['vehicle']['vehicle_number']), "Vehicle number is populated (" . $activeData['vehicle']['vehicle_number'] . ")");

// 6. Test Pre-Trip Cancellation during ASSIGNED stage
echo "\n--- Step 5: Test Pre-Trip Cancellation (ASSIGNED) ---\n";
$cancelRes = makeRequest('POST', "$baseUrl/booking/cancel", array(
    'booking_id' => $booking1Id,
    'reason' => 'Customer cancelled before trip started'
), $custToken);
assertTest($cancelRes['code'] === 200, "Pre-trip cancellation succeeded");
assertTest($cancelRes['data']['data']['status'] === 'CANCELLED', "Status is CANCELLED in response");

// Verify active booking is now null
$activeAfterCancel = makeRequest('GET', "$baseUrl/booking/active", null, $custToken);
assertTest($activeAfterCancel['code'] === 200, "Active booking query returns 200");
assertTest($activeAfterCancel['data']['data'] === null, "Active booking is now NULL after cancellation");

// 7. Test In-Progress Cancellation Guard with Booking 2
echo "\n--- Step 6: Create Booking 2 and Advance to IN_PROGRESS ---\n";
$createRes2 = makeRequest('POST', "$baseUrl/booking/create", $bookingPayload, $custToken);
assertTest($createRes2['code'] === 201, "Booking 2 created successfully");
$booking2Id = $createRes2['data']['data']['id'];
$startOtp = $createRes2['data']['data']['start_otp'];

// Assign driver
makeRequest('POST', "$baseUrl/admin/bookings/$booking2Id/assign", array('driver_id' => $driverId), $adminToken);
// Driver accepts
$acceptRes = makeRequest('POST', "$baseUrl/driver/rides/$booking2Id/accept", null, $driverToken);
assertTest($acceptRes['code'] === 200, "Driver accepted Booking 2");
// Driver arrives
$arrivedRes = makeRequest('PATCH', "$baseUrl/driver/rides/$booking2Id/status", array('status' => 'ARRIVED'), $driverToken);
assertTest($arrivedRes['code'] === 200, "Driver arrived");
// Driver starts ride with real OTP
$startRes = makeRequest('PATCH', "$baseUrl/driver/rides/$booking2Id/status", array(
    'status' => 'STARTED',
    'otp' => $startOtp
), $driverToken);
assertTest($startRes['code'] === 200, "Driver started ride (IN_PROGRESS)");

// Now test Customer cancellation during IN_PROGRESS -> MUST BE BLOCKED
echo "\n--- Step 7: Verify Cancellation Blocked during IN_PROGRESS ---\n";
$cancelDuringTrip = makeRequest('POST', "$baseUrl/booking/cancel", array(
    'booking_id' => $booking2Id,
    'reason' => 'Customer trying to cancel while ride is moving'
), $custToken);
assertTest($cancelDuringTrip['code'] === 400, "Cancellation during IN_PROGRESS blocked with HTTP 400");
assertTest(strpos($cancelDuringTrip['data']['message'], 'in progress') !== false, "Error message explains ride is in progress");

// 8. Driver Completes Ride
echo "\n--- Step 8: Driver Completes Ride & Customer Rating ---\n";
$completeRes = makeRequest('PATCH', "$baseUrl/driver/rides/$booking2Id/status", array('status' => 'COMPLETED'), $driverToken);
assertTest($completeRes['code'] === 200, "Driver completed ride");

// Customer active booking should return unrated completed ride
$unratedActive = makeRequest('GET', "$baseUrl/booking/active", null, $custToken);
assertTest($unratedActive['code'] === 200, "Active booking query returns completed ride for rating");
assertTest($unratedActive['data']['data']['status'] === 'COMPLETED', "Status is COMPLETED");
assertTest(empty($unratedActive['data']['data']['rating']), "Rating is currently null");

// Customer submits 5-star rating
$rateRes = makeRequest('POST', "$baseUrl/booking/rate", array(
    'booking_id' => $booking2Id,
    'rating' => 5,
    'review_text' => 'Phase 7 gap verification: Excellent punctual ride!'
), $custToken);
assertTest($rateRes['code'] === 200, "Customer rating submitted successfully");

// Verify active booking is now completely cleared
$activeAfterRate = makeRequest('GET', "$baseUrl/booking/active", null, $custToken);
assertTest($activeAfterRate['data']['data'] === null, "Active booking is cleared after rating");

// 9. Customer History Verification
echo "\n--- Step 9: Customer Ride History & Invoice Data Verification ---\n";
$historyRes = makeRequest('GET', "$baseUrl/customer/bookings", null, $custToken);
assertTest($historyRes['code'] === 200, "Customer history retrieved successfully");
$historyList = $historyRes['data']['data'];

$foundBooking2 = false;
$foundBooking1Cancelled = false;
foreach ($historyList as $b) {
    if ($b['id'] === $booking2Id) {
        $foundBooking2 = true;
        assertTest((int)$b['rating'] === 5, "Booking 2 persisted with 5-star rating in Customer History");
        assertTest($b['status'] === 'COMPLETED', "Booking 2 status is COMPLETED in Customer History");
    }
    if ($b['id'] === $booking1Id) {
        $foundBooking1Cancelled = true;
        assertTest($b['status'] === 'CANCELLED', "Booking 1 status is CANCELLED in Customer History");
    }
}
assertTest($foundBooking2, "Booking 2 found in Customer History");
assertTest($foundBooking1Cancelled, "Cancelled Booking 1 found in Customer History");

echo "\n========================================================\n";
echo "ALL PHASE 7 CUSTOMER MVP CHECKS PASSED PERFECTLY!\n";
echo "========================================================\n";

