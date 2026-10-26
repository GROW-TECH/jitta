<?php
/**
 * Jittadrives - Phase 8 Driver MVP Gap Fix Verification Test
 * Tests:
 * 1. Driver Login & Session JWT Token
 * 2. Offline Available Rides Gating (Empty array [] when offline)
 * 3. Driver Online Status Toggle
 * 4. Available Rides Detection
 * 5. Driver Accept Ride -> EN_ROUTE
 * 6. Driver Arrived at Pickup -> ARRIVED
 * 7. Driver Start Trip with OTP -> IN_PROGRESS
 * 8. Driver Complete Trip -> COMPLETED & Server-Side 85% Earnings Calculation
 * 9. Driver Wallet & Today Earnings Verification
 * 10. Driver Ride History (GET /driver/rides/history) with Customer Name, Route & Driver Earnings
 * 11. Offline Gating Re-Verification
 */

function http_req($method, $path, $data = null, $token = null) {
    $url = "http://127.0.0.1:8001/api/v1" . $path;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    $headers = array('Content-Type: application/json');
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return array('code' => $httpCode, 'body' => json_decode($response, true));
}

echo "============================================================\n";
echo "Jittadrives - PHASE 8 DRIVER MVP GAP FIX TEST SUITE\n";
echo "============================================================\n\n";

$passCount = 0;
$failCount = 0;

function assertTest($description, $condition) {
    global $passCount, $failCount;
    if ($condition) {
        echo "  [PASS] $description\n";
        $passCount++;
    } else {
        echo "  [FAIL] $description\n";
        $failCount++;
    }
}

// -------------------------------------------------------------
// 1. Customer Login
// -------------------------------------------------------------
echo "[1] Customer Login & Session...\n";
$custLogin = http_req('POST', '/auth/customer/login', array('phone' => '7373863641', 'password' => 'giri234'));
assertTest("Customer login successful (HTTP 200)", $custLogin['code'] === 200);
$custToken = isset($custLogin['body']['data']['token']) ? $custLogin['body']['data']['token'] : null;
$customerId = isset($custLogin['body']['data']['customer']['id']) ? $custLogin['body']['data']['customer']['id'] : null;
assertTest("Customer token received", !empty($custToken));

// -------------------------------------------------------------
// 2. Driver Login
// -------------------------------------------------------------
echo "\n[2] Driver Login & Session...\n";
$driverLogin = http_req('POST', '/auth/driver/login', array('phone' => '9876543210', 'otp' => '4821'));
assertTest("Driver login successful (HTTP 200)", $driverLogin['code'] === 200);
$driverToken = isset($driverLogin['body']['data']['token']) ? $driverLogin['body']['data']['token'] : null;
assertTest("Driver token received", !empty($driverToken));
$driverData = isset($driverLogin['body']['data']['driver']) ? $driverLogin['body']['data']['driver'] : array();
$driverId = isset($driverData['id']) ? $driverData['id'] : null;
assertTest("Driver ID present in payload", !empty($driverId));

// Clean up stale active bookings
require_once __DIR__ . '/config/Database.php';
$db = Database::getInstance()->getConnection();
$db->exec("UPDATE bookings SET status = 'CANCELLED' WHERE customer_id = '$customerId' AND status IN ('SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS')");
$db->exec("UPDATE bookings SET status = 'CANCELLED' WHERE driver_id = '$driverId' AND status IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS')");

// -------------------------------------------------------------
// 3. Driver Offline Gating for Available Rides
// -------------------------------------------------------------
echo "\n[3] Driver Offline Gating for Available Rides...\n";
// Force offline first
$statusOff = http_req('PATCH', '/driver/status', array('is_online' => false), $driverToken);
assertTest("Set driver offline (HTTP 200)", $statusOff['code'] === 200);

$availOff = http_req('GET', '/driver/rides/available', null, $driverToken);
assertTest("Available rides while offline returns HTTP 200", $availOff['code'] === 200);
assertTest("Available rides while offline is strictly empty array []", isset($availOff['body']['data']) && is_array($availOff['body']['data']) && count($availOff['body']['data']) === 0);

// -------------------------------------------------------------
// 4. Toggle Driver Online
// -------------------------------------------------------------
echo "\n[4] Driver Status Toggle to Online...\n";
$statusOn = http_req('PATCH', '/driver/status', array('is_online' => true, 'lat' => 11.0168, 'lng' => 76.9558), $driverToken);
assertTest("Set driver online (HTTP 200)", $statusOn['code'] === 200);
assertTest("Status updated to ONLINE in response", isset($statusOn['body']['data']['is_online']) && $statusOn['body']['data']['is_online'] == 1);

// -------------------------------------------------------------
// 5. Customer Creates a Ride Booking
// -------------------------------------------------------------
echo "\n[5] Customer Booking Creation...\n";
$bookingPayload = array(
    'pickup' => array(
        'name' => 'Brookefields Mall Coimbatore',
        'address' => 'Dr Krishnasamy Mudaliar Rd, Brookefields, Coimbatore',
        'lat' => 11.0125,
        'lng' => 76.9558
    ),
    'drop' => array(
        'name' => 'Tidel Park Coimbatore',
        'address' => 'Civil Aerodrome Post, Peelamedu, Coimbatore',
        'lat' => 11.0287,
        'lng' => 77.0264
    ),
    'vehicle_type'   => 'Red Sedan',
    'distance_km'    => 9.5,
    'duration_min'   => 22,
    'payment_method' => 'CASH'
);
$createBooking = http_req('POST', '/booking/create', $bookingPayload, $custToken);
assertTest("Booking created successfully (HTTP 201)", $createBooking['code'] === 201);
$bookingId = isset($createBooking['body']['data']['id']) ? $createBooking['body']['data']['id'] : null;
$startOtp  = isset($createBooking['body']['data']['start_otp']) ? $createBooking['body']['data']['start_otp'] : null;
$totalFare = isset($createBooking['body']['data']['total_fare']) ? (float)$createBooking['body']['data']['total_fare'] : 0.0;
assertTest("Booking ID generated ($bookingId)", !empty($bookingId));
assertTest("Start OTP generated ($startOtp)", !empty($startOtp));
assertTest("Total fare is positive (₹$totalFare)", $totalFare > 0);

// -------------------------------------------------------------
// 6. Driver Sees Available Ride in Pool
// -------------------------------------------------------------
echo "\n[6] Driver Polls Available Rides Online...\n";
$availOn = http_req('GET', '/driver/rides/available', null, $driverToken);
assertTest("Available rides while online returns HTTP 200", $availOn['code'] === 200);
$foundBooking = false;
if (isset($availOn['body']['data']) && is_array($availOn['body']['data'])) {
    foreach ($availOn['body']['data'] as $r) {
        if ($r['id'] === $bookingId) {
            $foundBooking = true;
            break;
        }
    }
}
assertTest("Created booking $bookingId visible in available rides", $foundBooking);

// -------------------------------------------------------------
// 7. Driver Accepts Ride
// -------------------------------------------------------------
echo "\n[7] Driver Accepts Ride...\n";
$acceptRes = http_req('POST', "/driver/rides/{$bookingId}/accept", null, $driverToken);
assertTest("Ride accepted successfully (HTTP 200)", $acceptRes['code'] === 200);
assertTest("Ride status updated to EN_ROUTE upon accept", isset($acceptRes['body']['data']['status']) && $acceptRes['body']['data']['status'] === 'EN_ROUTE');

// -------------------------------------------------------------
// 8. Driver Arrives at Pickup
// -------------------------------------------------------------
echo "\n[8] Driver Arrives at Pickup...\n";
$arrivedRes = http_req('PATCH', "/driver/rides/{$bookingId}/status", array('status' => 'ARRIVED'), $driverToken);
assertTest("Driver arrived at pickup (HTTP 200)", $arrivedRes['code'] === 200);
assertTest("Ride status is ARRIVED", isset($arrivedRes['body']['data']['status']) && $arrivedRes['body']['data']['status'] === 'ARRIVED');

// -------------------------------------------------------------
// 9. Driver Starts Trip with OTP
// -------------------------------------------------------------
echo "\n[9] Driver Starts Trip with Customer OTP...\n";
// First try wrong OTP
$wrongOtpRes = http_req('PATCH', "/driver/rides/{$bookingId}/status", array('status' => 'STARTED', 'otp' => '0000'), $driverToken);
assertTest("Wrong OTP rejected with HTTP 401", $wrongOtpRes['code'] === 401);

// Correct OTP
$startRes = http_req('PATCH', "/driver/rides/{$bookingId}/status", array('status' => 'STARTED', 'otp' => $startOtp), $driverToken);
assertTest("Trip started with valid OTP (HTTP 200)", $startRes['code'] === 200);
assertTest("Ride status is IN_PROGRESS", isset($startRes['body']['data']['status']) && $startRes['body']['data']['status'] === 'IN_PROGRESS');

// -------------------------------------------------------------
// 10. Driver Completes Trip & Server Earnings Calculation
// -------------------------------------------------------------
echo "\n[10] Driver Completes Trip & Earnings Calculation...\n";
$initialWallet = http_req('GET', '/driver/wallet', null, $driverToken);
$initialBalance = isset($initialWallet['body']['data']['balance']) ? (float)$initialWallet['body']['data']['balance'] : 0.0;

$completeRes = http_req('PATCH', "/driver/rides/{$bookingId}/status", array('status' => 'COMPLETED'), $driverToken);
assertTest("Trip completed successfully (HTTP 200)", $completeRes['code'] === 200);
$expectedEarnings = round($totalFare * 0.85, 2);
$expectedCommission = round($totalFare * 0.15, 2);
$reportedEarnings = isset($completeRes['body']['data']['driver_earnings']) ? (float)$completeRes['body']['data']['driver_earnings'] : 0.0;
$reportedCommission = isset($completeRes['body']['data']['commission']) ? (float)$completeRes['body']['data']['commission'] : 0.0;
assertTest("Driver net earnings reported as 85% (₹$reportedEarnings == ₹$expectedEarnings)", abs($reportedEarnings - $expectedEarnings) < 0.05);
assertTest("Platform commission reported as 15% (₹$reportedCommission == ₹$expectedCommission)", abs($reportedCommission - $expectedCommission) < 0.05);

// -------------------------------------------------------------
// 11. Driver Wallet Ledger Verification
// -------------------------------------------------------------
echo "\n[11] Driver Wallet Ledger & Balance Check...\n";
$newWallet = http_req('GET', '/driver/wallet', null, $driverToken);
assertTest("Driver wallet fetched (HTTP 200)", $newWallet['code'] === 200);
$newBalance = isset($newWallet['body']['data']['balance']) ? (float)$newWallet['body']['data']['balance'] : 0.0;
assertTest("Wallet balance increased by driver earnings", abs(($newBalance - $initialBalance) - $expectedEarnings) < 0.05);

// -------------------------------------------------------------
// 12. Driver Ride History (GET /driver/rides/history)
// -------------------------------------------------------------
echo "\n[12] Driver Ride History Verification...\n";
$histRes = http_req('GET', '/driver/rides/history?limit=10', null, $driverToken);
assertTest("Driver ride history fetched (HTTP 200)", $histRes['code'] === 200);
assertTest("Driver ride history is array", isset($histRes['body']['data']) && is_array($histRes['body']['data']));

$foundInHistory = null;
if (isset($histRes['body']['data']) && is_array($histRes['body']['data'])) {
    foreach ($histRes['body']['data'] as $h) {
        if ($h['id'] === $bookingId) {
            $foundInHistory = $h;
            break;
        }
    }
}
assertTest("Completed ride $bookingId present in driver ride history", !empty($foundInHistory));
if ($foundInHistory) {
    assertTest("History contains customer_name", !empty($foundInHistory['customer_name']));
    assertTest("History contains pickup location", !empty($foundInHistory['pickup']['name']));
    assertTest("History contains drop location", !empty($foundInHistory['drop']['name']));
    assertTest("History contains total_fare (₹{$foundInHistory['total_fare']})", (float)$foundInHistory['total_fare'] === $totalFare);
    assertTest("History contains driver_earnings (₹{$foundInHistory['driver_earnings']})", (float)$foundInHistory['driver_earnings'] === $expectedEarnings);
    assertTest("History status is COMPLETED", $foundInHistory['status'] === 'COMPLETED');
}

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
echo "\n============================================================\n";
echo "TEST RESULTS: {$passCount} PASSED, {$failCount} FAILED\n";
echo "============================================================\n";

if ($failCount > 0) {
    exit(1);
}
exit(0);

