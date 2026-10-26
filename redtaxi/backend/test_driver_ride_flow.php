<?php
/**
 * RedTaxi Phase 3 — Complete Driver Ride Workflow Verification Test
 * Tests end-to-end driver lifecycle with real MySQL database:
 * 1. Driver Login & JWT Token issuance
 * 2. Get Driver Profile & Active Vehicle
 * 3. Driver Status Toggle (ONLINE/OFFLINE & GPS)
 * 4. Customer Booking Creation (SEARCHING status)
 * 5. Driver Fetch Available Rides (finds created booking)
 * 6. Driver Accepts Ride (transitions to ASSIGNED)
 * 7. Driver Updates Status to ARRIVED
 * 8. Driver Starts Trip with invalid OTP (fails 401)
 * 9. Driver Starts Trip with correct OTP (transitions to IN_PROGRESS)
 * 10. Driver Completes Ride (calculates fare, commission, earnings, creates payment)
 * 11. Driver Wallet Ledger Verification (balance credited, today_earnings updated)
 * 12. Driver Ride History Verification (completed ride present)
 */

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/CustomerModel.php';
require_once __DIR__ . '/models/DriverModel.php';
require_once __DIR__ . '/models/BookingModel.php';
require_once __DIR__ . '/utils/Security.php';

echo "=======================================================\n";
echo "RedTaxi Phase 3 — Driver Ride Workflow Test Suite\n";
echo "=======================================================\n\n";

$passedCount = 0;
$failedCount = 0;

function assertTest($name, $condition, $details = '')
{
    global $passedCount, $failedCount;
    if ($condition) {
        echo "  [PASS] {$name}\n";
        $passedCount++;
    } else {
        echo "  [FAIL] {$name}" . ($details ? " - {$details}" : "") . "\n";
        $failedCount++;
    }
}

function runApi($uri, $method, $payload = null, $bearerToken = null)
{
    $phpBinary = 'C:\\xampp\\php\\php.exe';

    $runnerScript = tempnam(sys_get_temp_dir(), 'rt_flow_') . '.php';
    $runnerContent = '<?php
        $_SERVER["REQUEST_METHOD"] = "' . $method . '";
        $_SERVER["REQUEST_URI"] = "' . $uri . '";
    ';
    if ($bearerToken !== null) {
        $runnerContent .= '$_SERVER["HTTP_AUTHORIZATION"] = "Bearer ' . addslashes($bearerToken) . '";' . "\n";
    }
    if ($payload !== null) {
        $runnerContent .= '$GLOBALS["MOCK_JSON_INPUT"] = \'' . addcslashes(json_encode($payload), "'\\") . '\';' . "\n";
    }
    $runnerContent .= 'require "' . addslashes(__DIR__ . '/api/v1/index.php') . '";';

    file_put_contents($runnerScript, $runnerContent);

    $output = shell_exec('"' . $phpBinary . '" "' . $runnerScript . '"');
    unlink($runnerScript);

    return json_decode($output, true);
}

// -------------------------------------------------------------
// Step 1: Driver Authentication
// -------------------------------------------------------------
echo "1. Testing Driver Login...\n";
$loginRes = runApi('/api/v1/auth/driver/login', 'POST', array(
    'phone' => '9876543210',
    'otp'   => '4821'
));

assertTest('Driver login returns 200', isset($loginRes['statusCode']) && $loginRes['statusCode'] === 200);
assertTest('Driver login provides JWT token', !empty($loginRes['data']['token']));
$driverToken = $loginRes['data']['token'];
$driverId = $loginRes['data']['driver']['id'];

// -------------------------------------------------------------
// Step 2: Driver Profile & Vehicle
// -------------------------------------------------------------
echo "\n2. Testing Driver Profile & Vehicle Details...\n";
$profRes = runApi('/api/v1/driver/profile', 'GET', null, $driverToken);
assertTest('Get driver profile returns 200', isset($profRes['statusCode']) && $profRes['statusCode'] === 200);
assertTest('Profile matches phone 9876543210', isset($profRes['data']['phone']) && $profRes['data']['phone'] === '9876543210');

$vehRes = runApi('/api/v1/driver/vehicle', 'GET', null, $driverToken);
assertTest('Get driver vehicle returns active vehicle', !empty($vehRes['data']['active_vehicle']));

// -------------------------------------------------------------
// Step 3: Driver Goes Online
// -------------------------------------------------------------
echo "\n3. Testing Driver Online Toggle...\n";
$statusRes = runApi('/api/v1/driver/status', 'PATCH', array(
    'is_online' => true,
    'lat'       => 11.0168,
    'lng'       => 76.9558
), $driverToken);

assertTest('Driver successfully goes ONLINE', isset($statusRes['statusCode']) && $statusRes['statusCode'] === 200);
assertTest('Driver status response is_online is true', isset($statusRes['data']['is_online']) && $statusRes['data']['is_online'] === true);

// -------------------------------------------------------------
// Step 4: Create a Customer Booking in MySQL (SEARCHING)
// -------------------------------------------------------------
echo "\n4. Creating Customer Booking...\n";
$customerModel = new CustomerModel();
$custPhone = '9800' . mt_rand(100000, 999999);
$customer = $customerModel->createCustomer(array(
    'name'  => 'Priya Soundar',
    'phone' => $custPhone,
    'email' => 'priya_' . $custPhone . '@redtaxi.test'
));
$customerToken = Security::generateToken($customer['id'], 'customer');

$bookingRes = runApi('/api/v1/booking/create', 'POST', array(
    'pickup' => array(
        'name'    => 'Brookefields Mall, Coimbatore',
        'address' => 'Dr Krishnasamy Mudaliar Rd, Brookefields, Coimbatore',
        'lat'     => 11.0086,
        'lng'     => 76.9602
    ),
    'drop' => array(
        'name'    => 'Coimbatore International Airport (CJB)',
        'address' => 'Civil Aerodrome Post, Peelamedu, Coimbatore',
        'lat'     => 11.0298,
        'lng'     => 77.0434
    ),
    'vehicle_type'   => 'Red Sedan',
    'distance_km'    => 11.2,
    'duration_min'   => 28,
    'payment_method' => 'CASH',
    'ride_type'      => 'CITY'
), $customerToken);

assertTest('Customer booking created successfully', isset($bookingRes['statusCode']) && $bookingRes['statusCode'] === 201);
$bookingId = $bookingRes['data']['id'];
$startOtp  = $bookingRes['data']['start_otp'];
assertTest('Booking has SEARCHING status', $bookingRes['data']['status'] === 'SEARCHING');
assertTest('Booking generated start OTP', !empty($startOtp));

// -------------------------------------------------------------
// Step 5: Driver Available Rides Poll
// -------------------------------------------------------------
echo "\n5. Driver Polling Available Rides...\n";
$availRes = runApi('/api/v1/driver/rides/available', 'GET', null, $driverToken);
assertTest('Available rides returns 200', isset($availRes['statusCode']) && $availRes['statusCode'] === 200);

$foundRide = null;
if (isset($availRes['data']) && is_array($availRes['data'])) {
    foreach ($availRes['data'] as $r) {
        if ($r['id'] === $bookingId) {
            $foundRide = $r;
            break;
        }
    }
}
assertTest('Created booking found in available rides', $foundRide !== null);
if ($foundRide) {
    assertTest('Ride includes customer name', $foundRide['customer_name'] === 'Priya Soundar');
    assertTest('Ride includes pickup location', isset($foundRide['pickup']['name']));
    assertTest('Ride includes drop location', isset($foundRide['drop']['name']));
    assertTest('Ride includes total fare', floatval($foundRide['total_fare']) > 0);
}

// -------------------------------------------------------------
// Step 6: Driver Accepts Ride
// -------------------------------------------------------------
echo "\n6. Driver Accepting Ride...\n";
$acceptRes = runApi("/api/v1/driver/rides/{$bookingId}/accept", 'POST', null, $driverToken);
assertTest('Accept ride returns 200', isset($acceptRes['statusCode']) && $acceptRes['statusCode'] === 200);
assertTest('Accepted ride status is ASSIGNED', isset($acceptRes['data']['status']) && $acceptRes['data']['status'] === 'ASSIGNED');
assertTest('Accepted ride assigned to driver', isset($acceptRes['data']['driver_id']) && $acceptRes['data']['driver_id'] === $driverId);

// -------------------------------------------------------------
// Step 7: Driver Sets En Route & Arrived
// -------------------------------------------------------------
echo "\n7. Driver Navigating & Arriving at Pickup...\n";
$arrivedRes = runApi("/api/v1/driver/rides/{$bookingId}/status", 'PATCH', array(
    'status' => 'ARRIVED'
), $driverToken);

assertTest('Update status to ARRIVED returns 200', isset($arrivedRes['statusCode']) && $arrivedRes['statusCode'] === 200);
assertTest('Current status is ARRIVED', isset($arrivedRes['data']['status']) && $arrivedRes['data']['status'] === 'ARRIVED');

// -------------------------------------------------------------
// Step 8: OTP Verification & Trip Start
// -------------------------------------------------------------
echo "\n8. Testing Start Trip with OTP...\n";
// 8a: Invalid OTP must fail
$badOtpRes = runApi("/api/v1/driver/rides/{$bookingId}/status", 'PATCH', array(
    'status' => 'STARTED',
    'otp'    => '9999'
), $driverToken);
assertTest('Invalid OTP returns 401 Unauthorized', isset($badOtpRes['statusCode']) && $badOtpRes['statusCode'] === 401);

// 8b: Correct OTP succeeds
$goodOtpRes = runApi("/api/v1/driver/rides/{$bookingId}/status", 'PATCH', array(
    'status' => 'STARTED',
    'otp'    => $startOtp
), $driverToken);
assertTest('Correct OTP starts ride (200 OK)', isset($goodOtpRes['statusCode']) && $goodOtpRes['statusCode'] === 200);
assertTest('Ride status is now IN_PROGRESS', isset($goodOtpRes['data']['status']) && $goodOtpRes['data']['status'] === 'IN_PROGRESS');

// -------------------------------------------------------------
// Step 9: Driver Completes Trip
// -------------------------------------------------------------
echo "\n9. Completing Trip & Fare Calculation...\n";
// Initial wallet snapshot
$preWallet = runApi('/api/v1/driver/wallet', 'GET', null, $driverToken);
$preBal = floatval($preWallet['data']['balance']);

$compRes = runApi("/api/v1/driver/rides/{$bookingId}/status", 'PATCH', array(
    'status' => 'COMPLETED'
), $driverToken);

assertTest('Complete ride returns 200', isset($compRes['statusCode']) && $compRes['statusCode'] === 200);
assertTest('Complete returns COMPLETED status', isset($compRes['data']['status']) && $compRes['data']['status'] === 'COMPLETED');
assertTest('Complete returns total fare', floatval($compRes['data']['total_fare']) > 0);
assertTest('Complete returns driver earnings', floatval($compRes['data']['driver_earnings']) > 0);
assertTest('Complete returns commission deduction', floatval($compRes['data']['commission']) > 0);

// Total fare should equal driver_earnings + commission
$totFare = floatval($compRes['data']['total_fare']);
$drvEarn = floatval($compRes['data']['driver_earnings']);
$comm    = floatval($compRes['data']['commission']);
assertTest('Earnings + Commission == Total Fare', abs($totFare - ($drvEarn + $comm)) < 0.05);

// -------------------------------------------------------------
// Step 10: Driver Wallet & Ledger Verification
// -------------------------------------------------------------
echo "\n10. Verifying Driver Wallet & Earnings Ledger...\n";
$postWallet = runApi('/api/v1/driver/wallet', 'GET', null, $driverToken);
$postBal = floatval($postWallet['data']['balance']);
assertTest('Driver wallet balance credited with earnings', abs(($postBal - $preBal) - $drvEarn) < 0.05);
assertTest('Today trips incremented', intval($postWallet['data']['todayTrips']) >= 1);
assertTest('Today earnings credited', floatval($postWallet['data']['todayEarnings']) >= $drvEarn);
assertTest('Wallet contains ledger transaction for booking', !empty($postWallet['data']['transactions']));

// -------------------------------------------------------------
// Step 11: Driver Ride History Verification
// -------------------------------------------------------------
echo "\n11. Verifying Ride History...\n";
$histRes = runApi('/api/v1/driver/rides/history', 'GET', null, $driverToken);
assertTest('Ride history returns 200', isset($histRes['statusCode']) && $histRes['statusCode'] === 200);
$foundInHistory = false;
if (isset($histRes['data']) && is_array($histRes['data'])) {
    foreach ($histRes['data'] as $hr) {
        if ($hr['id'] === $bookingId) {
            $foundInHistory = true;
            break;
        }
    }
}
assertTest('Completed ride present in driver history', $foundInHistory);

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
echo "\n=======================================================\n";
echo "Test Execution Summary\n";
echo "=======================================================\n";
echo "Total Tests Passed: {$passedCount}\n";
echo "Total Tests Failed: {$failedCount}\n";
$rate = round(($passedCount / ($passedCount + $failedCount)) * 100, 1);
echo "Success Rate: {$rate}%\n\n";

if ($failedCount === 0) {
    echo "SUCCESS: All Driver Ride Workflow integration tests PASSED!\n";
    exit(0);
} else {
    echo "FAILURE: Some tests failed.\n";
    exit(1);
}
