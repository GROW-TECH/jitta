<?php
/**
 * RedTaxi Phase 9 — Complete Booking & Fare System Automated Test Suite
 * Tests all endpoints and lifecycle states for Phase 9:
 * 1. Booking Creation (POST /api/v1/booking/create)
 * 2. Active Booking Lookup (GET /api/v1/booking/active)
 * 3. Booking Details (GET /api/v1/booking/{id})
 * 4. Driver Dispatch & Matching (available -> accept -> en-route)
 * 5. Ride Status Transitions (ASSIGNED -> EN_ROUTE -> ARRIVED -> STARTED -> COMPLETED)
 * 6. OTP Verification (start_otp & demo OTP 4821)
 * 7. Payment Record Generation on Completion
 * 8. Customer Total Rides Increment
 * 9. Driver Earnings & Wallet Credit
 * 10. Rate & Review Booking (POST /api/v1/booking/rate, rating recalculation)
 * 11. Ride Cancellation & Fees (POST /api/v1/booking/cancel)
 * 12. SOS Emergency Alerts (POST /api/v1/booking/sos)
 * 13. In-App Notifications on Lifecycle Milestones
 * 14. Authentication and Role Enforcement (401 / 403)
 *
 * Compatible with PHP 5.6+.
 */

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/CustomerModel.php';
require_once __DIR__ . '/models/DriverModel.php';
require_once __DIR__ . '/models/BookingModel.php';
require_once __DIR__ . '/utils/Security.php';

echo "=======================================================\n";
echo "RedTaxi Phase 9 — Complete Booking System Test Suite\n";
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

    $runnerScript = tempnam(sys_get_temp_dir(), 'rt_book_') . '.php';
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

    $cmd = escapeshellarg($phpBinary) . ' ' . escapeshellarg($runnerScript);
    $output = shell_exec($cmd);

    @unlink($runnerScript);

    return json_decode($output, true);
}

// -------------------------------------------------------------
// Database Setup & Fixtures
// -------------------------------------------------------------
$db = Database::getInstance()->getConnection();
$customerModel = new CustomerModel();
$driverModel   = new DriverModel();
$bookingModel  = new BookingModel();

// 1. Primary Test Customer
$phone1 = '97001' . mt_rand(10000, 99999);
$customer1 = $customerModel->createCustomer(array(
    'name'  => 'Aarav Patel',
    'phone' => $phone1,
    'email' => 'aarav_' . $phone1 . '@example.com'
));
$token1 = Security::generateToken($customer1['id'], 'customer');

// 2. Secondary Customer (for permission testing)
$phone2 = '97002' . mt_rand(10000, 99999);
$customer2 = $customerModel->createCustomer(array(
    'name'  => 'Pooja Iyer',
    'phone' => $phone2,
    'email' => 'pooja_' . $phone2 . '@example.com'
));
$token2 = Security::generateToken($customer2['id'], 'customer');

// 3. Primary Test Driver (Approved + Active Vehicle)
$driverPhone1 = '97003' . mt_rand(10000, 99999);
$driver1 = $driverModel->createDriver(array(
    'name'           => 'Ramesh Kumar',
    'phone'          => $driverPhone1,
    'vehicle_model'  => 'Maruti Suzuki WagonR',
    'vehicle_number' => 'TN 37 AB ' . mt_rand(1000, 9999),
    'vehicle_type'   => 'Mini'
));
$driverToken1 = Security::generateToken($driver1['id'], 'driver');

// Ensure driver is approved and online
$db->query("UPDATE `drivers` SET `approval_status` = 'APPROVED', `is_online` = 1, `commission_percent` = 15.00 WHERE `id` = '{$driver1['id']}'");

// Ensure driver has a wallet
$walletCheck = $db->query("SELECT id FROM `driver_wallets` WHERE `driver_id` = '{$driver1['id']}'")->fetch();
if (!$walletCheck) {
    $walletId = Security::generateUUID();
    $db->query("INSERT INTO `driver_wallets` (`id`, `driver_id`, `balance`, `today_earnings`, `today_trips`, `is_active`)
               VALUES ('{$walletId}', '{$driver1['id']}', 0.00, 0.00, 0, 1)");
}

// 4. Secondary Test Driver
$driverPhone2 = '97004' . mt_rand(10000, 99999);
$driver2 = $driverModel->createDriver(array(
    'name'           => 'Suresh Babu',
    'phone'          => $driverPhone2,
    'vehicle_model'  => 'Hyundai Aura',
    'vehicle_number' => 'TN 38 CD ' . mt_rand(1000, 9999),
    'vehicle_type'   => 'Sedan'
));
$driverToken2 = Security::generateToken($driver2['id'], 'driver');
$db->query("UPDATE `drivers` SET `approval_status` = 'APPROVED', `is_online` = 1 WHERE `id` = '{$driver2['id']}'");

// 5. Seed test coupon if not exists
$couponStmt = $db->prepare("SELECT id FROM `coupons` WHERE `code` = 'PHASE9TEST'");
$couponStmt->execute();
if (!$couponStmt->fetch()) {
    $cId = Security::generateUUID();
    $db->query("INSERT INTO `coupons` (`id`, `code`, `discount_type`, `discount_amount`, `min_booking`, `description`, `expiry_date`, `is_active`)
                VALUES ('{$cId}', 'PHASE9TEST', 'FLAT', 35.00, 100.00, 'Phase 9 Test Discount ₹35', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1)");
}

echo "Fixtures loaded successfully.\n\n";

// =============================================================
// SECTION 1: Booking Creation Validations (POST /api/v1/booking/create)
// =============================================================
echo "--- Section 1: Booking Creation Validations ---\n";

// Test 1: No auth token
$res = runApi('/api/v1/booking/create', 'POST', array('vehicle_type' => 'Red Mini'));
assertTest('Create booking without token returns 401', isset($res['statusCode']) && $res['statusCode'] === 401);

// Test 2: Driver token (role restriction)
$res = runApi('/api/v1/booking/create', 'POST', array('vehicle_type' => 'Red Mini'), $driverToken1);
assertTest('Create booking with driver token returns 403', isset($res['statusCode']) && $res['statusCode'] === 403);

// Test 3: Missing pickup
$res = runApi('/api/v1/booking/create', 'POST', array(
    'drop'           => 'Airport',
    'vehicle_type'   => 'Red Mini',
    'distance_km'    => 10,
    'duration_min'   => 20,
    'payment_method' => 'UPI'
), $token1);
assertTest('Create booking without pickup returns 400', isset($res['statusCode']) && $res['statusCode'] === 400);

// Test 4: Missing drop
$res = runApi('/api/v1/booking/create', 'POST', array(
    'pickup'         => 'Gandhipuram',
    'vehicle_type'   => 'Red Mini',
    'distance_km'    => 10,
    'duration_min'   => 20,
    'payment_method' => 'UPI'
), $token1);
assertTest('Create booking without drop returns 400', isset($res['statusCode']) && $res['statusCode'] === 400);

// Test 5: Missing vehicle type
$res = runApi('/api/v1/booking/create', 'POST', array(
    'pickup'         => 'Gandhipuram',
    'drop'           => 'Airport',
    'distance_km'    => 10,
    'duration_min'   => 20,
    'payment_method' => 'UPI'
), $token1);
assertTest('Create booking without vehicle type returns 400', isset($res['statusCode']) && $res['statusCode'] === 400);

// Test 6: Invalid vehicle type
$res = runApi('/api/v1/booking/create', 'POST', array(
    'pickup'         => 'Gandhipuram',
    'drop'           => 'Airport',
    'vehicle_type'   => 'Helicopter Prime',
    'distance_km'    => 10,
    'duration_min'   => 20,
    'payment_method' => 'UPI'
), $token1);
assertTest('Create booking with invalid vehicle type returns 400', isset($res['statusCode']) && $res['statusCode'] === 400);

// Test 7: Missing payment method
$res = runApi('/api/v1/booking/create', 'POST', array(
    'pickup'       => 'Gandhipuram',
    'drop'         => 'Airport',
    'vehicle_type' => 'Red Mini',
    'distance_km'  => 10,
    'duration_min' => 20
), $token1);
assertTest('Create booking without payment method returns 400', isset($res['statusCode']) && $res['statusCode'] === 400);

// Test 8: Invalid payment method
$res = runApi('/api/v1/booking/create', 'POST', array(
    'pickup'         => 'Gandhipuram',
    'drop'           => 'Airport',
    'vehicle_type'   => 'Red Mini',
    'distance_km'    => 10,
    'duration_min'   => 20,
    'payment_method' => 'BITCOIN'
), $token1);
assertTest('Create booking with invalid payment method returns 400', isset($res['statusCode']) && $res['statusCode'] === 400);

// Test 9: Zero or negative distance
$res = runApi('/api/v1/booking/create', 'POST', array(
    'pickup'         => 'Gandhipuram',
    'drop'           => 'Airport',
    'vehicle_type'   => 'Red Mini',
    'distance_km'    => 0,
    'duration_min'   => 20,
    'payment_method' => 'CASH'
), $token1);
assertTest('Create booking with 0 km distance returns 400', isset($res['statusCode']) && $res['statusCode'] === 400);

// =============================================================
// SECTION 2: Successful Booking Creation & Fare Authoritative Recalculation
// =============================================================
echo "\n--- Section 2: Successful Booking Creation ---\n";

// Test 10: Valid Booking Creation
$createPayload = array(
    'pickup' => array(
        'name'    => 'Gandhipuram Bus Stand',
        'address' => 'Cross Cut Road, Gandhipuram, Coimbatore',
        'lat'     => 11.0168,
        'lng'     => 76.9682
    ),
    'drop' => array(
        'name'    => 'Coimbatore International Airport',
        'address' => 'Avinashi Road, Peelamedu, Coimbatore',
        'lat'     => 11.0300,
        'lng'     => 77.0434
    ),
    'vehicle_type'   => 'Red Mini',
    'distance_km'    => 12.5,
    'duration_min'   => 28,
    'payment_method' => 'UPI',
    'ride_type'      => 'CITY'
);

$createRes = runApi('/api/v1/booking/create', 'POST', $createPayload, $token1);
assertTest('Create booking returns HTTP 201 Created', isset($createRes['statusCode']) && $createRes['statusCode'] === 201);
assertTest('Create booking returns booking ID (UUID)', isset($createRes['data']['id']) && strlen($createRes['data']['id']) === 36);
assertTest('Initial status is SEARCHING', isset($createRes['data']['status']) && $createRes['data']['status'] === 'SEARCHING');
assertTest('Generates 4-digit start OTP', isset($createRes['data']['start_otp']) && strlen((string)$createRes['data']['start_otp']) === 4);
assertTest('Total fare is recalculated server-side (> 0)', isset($createRes['data']['total_fare']) && (float)$createRes['data']['total_fare'] > 0);
assertTest('Booking locations include PICKUP and DROP', isset($createRes['data']['locations']) && count($createRes['data']['locations']) === 2);

$activeBookingId = isset($createRes['data']['id']) ? $createRes['data']['id'] : null;
$startOtp = isset($createRes['data']['start_otp']) ? $createRes['data']['start_otp'] : null;

// Test 11: Booking creation with intermediate stops
$stopsPayload = array(
    'pickup' => 'RS Puram Head Post Office',
    'stops'  => array(
        array('name' => 'Brookefields Mall', 'address' => 'Sukrawar Pettai', 'lat' => 11.0080, 'lng' => 76.9580)
    ),
    'drop'           => 'Tidel Park Coimbatore',
    'vehicle_type'   => 'Red Sedan',
    'distance_km'    => 15.0,
    'duration_min'   => 35,
    'payment_method' => 'CASH'
);
$stopsRes = runApi('/api/v1/booking/create', 'POST', $stopsPayload, $token2);
assertTest('Create booking with stops returns 201', isset($stopsRes['statusCode']) && $stopsRes['statusCode'] === 201);
assertTest('Locations include PICKUP, STOP, and DROP (3 total)', isset($stopsRes['data']['locations']) && count($stopsRes['data']['locations']) === 3);

// Test 12: Booking creation with coupon discount
$couponPayload = array(
    'pickup'         => 'Gandhipuram',
    'drop'           => 'Saravanampatti',
    'vehicle_type'   => 'Red Mini',
    'distance_km'    => 14.0,
    'duration_min'   => 30,
    'payment_method' => 'WALLET',
    'coupon_code'    => 'PHASE9TEST'
);
$couponRes = runApi('/api/v1/booking/create', 'POST', $couponPayload, $token2);
assertTest('Booking with coupon applies discount', isset($couponRes['data']['discount']) && (float)$couponRes['data']['discount'] === 35.00);

// Verify coupon_usage table record
$couponUseCheck = $db->query("SELECT * FROM `coupon_usage` WHERE `booking_id` = '{$couponRes['data']['id']}'")->fetch();
assertTest('Coupon usage recorded in coupon_usage table', !empty($couponUseCheck));

// Test 13: Scheduled booking (future date)
$futureTime = date('Y-m-d H:i:s', time() + 86400); // 24 hours from now
$schedPayload = array(
    'pickup'         => 'Race Course Road',
    'drop'           => 'Railway Station',
    'vehicle_type'   => 'Red Mini',
    'distance_km'    => 6.0,
    'duration_min'   => 15,
    'payment_method' => 'CASH',
    'scheduled_time' => $futureTime
);
$schedRes = runApi('/api/v1/booking/create', 'POST', $schedPayload, $token2);
assertTest('Scheduled booking has status SCHEDULED', isset($schedRes['data']['status']) && $schedRes['data']['status'] === 'SCHEDULED');

// =============================================================
// SECTION 3: Active Booking & Booking Details
// =============================================================
echo "\n--- Section 3: Active Booking & Booking Details ---\n";

// Test 14: GET /api/v1/booking/active for customer 1 (should return $activeBookingId)
$actRes = runApi('/api/v1/booking/active', 'GET', null, $token1);
assertTest('Get active booking returns 200', isset($actRes['statusCode']) && $actRes['statusCode'] === 200);
assertTest('Active booking matches created booking ID', isset($actRes['data']['id']) && $actRes['data']['id'] === $activeBookingId);
assertTest('Active booking includes start_otp', isset($actRes['data']['start_otp']) && $actRes['data']['start_otp'] === $startOtp);

// Test 15: GET /api/v1/booking/{id} by owner
$detailRes = runApi('/api/v1/booking/' . $activeBookingId, 'GET', null, $token1);
assertTest('Get booking by ID returns 200 for owner', isset($detailRes['statusCode']) && $detailRes['statusCode'] === 200);
assertTest('Booking detail includes fare breakdown', isset($detailRes['data']['fare_breakdown']['base_fare']));

// Test 16: GET /api/v1/booking/{id} by non-owner customer (forbidden)
$forbiddenRes = runApi('/api/v1/booking/' . $activeBookingId, 'GET', null, $token2);
assertTest('Other customer cannot access booking (403)', isset($forbiddenRes['statusCode']) && $forbiddenRes['statusCode'] === 403);

// Test 17: GET /api/v1/booking/{id} with non-existent ID
$notfoundRes = runApi('/api/v1/booking/00000000-0000-0000-0000-000000000000', 'GET', null, $token1);
assertTest('Non-existent booking ID returns 404', isset($notfoundRes['statusCode']) && $notfoundRes['statusCode'] === 404);

// =============================================================
// SECTION 4: Driver Dispatch, En Route, and Status Transitions
// =============================================================
echo "\n--- Section 4: Driver Ride Lifecycle Transitions ---\n";

// Test 18: Driver checks available rides
$availRes = runApi('/api/v1/driver/rides/available', 'GET', null, $driverToken1);
assertTest('Driver sees available SEARCHING rides', isset($availRes['data']) && is_array($availRes['data']) && count($availRes['data']) >= 1);

// Test 19: Driver accepts ride
$acceptRes = runApi('/api/v1/driver/rides/' . $activeBookingId . '/accept', 'POST', null, $driverToken1);
assertTest('Driver accepts ride (status ASSIGNED)', isset($acceptRes['data']['status']) && $acceptRes['data']['status'] === 'ASSIGNED');
assertTest('Driver ID assigned to booking', isset($acceptRes['data']['driver_id']) && $acceptRes['data']['driver_id'] === $driver1['id']);

// Test 20: Notification generated for customer on driver assignment
$notifsCustomer = $db->query("SELECT * FROM `notifications` WHERE `user_id` = '{$customer1['id']}' AND `title` = 'Driver Assigned'")->fetch();
assertTest('Customer receives "Driver Assigned" notification', !empty($notifsCustomer));

// Test 21: Customer active booking now shows assigned driver and vehicle
$actAfterAccept = runApi('/api/v1/booking/active', 'GET', null, $token1);
assertTest('Customer active booking shows assigned driver', isset($actAfterAccept['data']['driver']['id']) && $actAfterAccept['data']['driver']['id'] === $driver1['id']);
assertTest('Customer active booking shows vehicle details', isset($actAfterAccept['data']['vehicle']['vehicle_number']));

// Test 22: Driver sets EN_ROUTE (Step 9N)
$enRouteRes = runApi('/api/v1/driver/rides/' . $activeBookingId . '/en-route', 'POST', null, $driverToken1);
assertTest('Driver transitions to EN_ROUTE via dedicated endpoint', isset($enRouteRes['data']['status']) && $enRouteRes['data']['status'] === 'EN_ROUTE');

// Verify customer notification for EN_ROUTE
$notifsEnRoute = $db->query("SELECT * FROM `notifications` WHERE `user_id` = '{$customer1['id']}' AND `title` = 'Driver En Route'")->fetch();
assertTest('Customer receives "Driver En Route" notification', !empty($notifsEnRoute));

// Test 23: Driver transitions to ARRIVED from EN_ROUTE
$arrivedRes = runApi('/api/v1/driver/rides/' . $activeBookingId . '/status', 'PATCH', array('status' => 'ARRIVED'), $driverToken1);
assertTest('Driver transitions to ARRIVED', isset($arrivedRes['data']['status']) && $arrivedRes['data']['status'] === 'ARRIVED');

// Verify customer notification for ARRIVED
$notifsArrived = $db->query("SELECT * FROM `notifications` WHERE `user_id` = '{$customer1['id']}' AND `title` = 'Driver Arrived'")->fetch();
assertTest('Customer receives "Driver Arrived" notification with OTP instructions', !empty($notifsArrived));

// =============================================================
// SECTION 5: Trip Start, OTP Verification, and Completion
// =============================================================
echo "\n--- Section 5: Trip Start, OTP Verification & Completion ---\n";

// Test 24: Start trip without OTP -> 400
$noOtpRes = runApi('/api/v1/driver/rides/' . $activeBookingId . '/status', 'PATCH', array('status' => 'STARTED'), $driverToken1);
assertTest('Start trip without OTP returns 400', isset($noOtpRes['statusCode']) && $noOtpRes['statusCode'] === 400);

// Test 25: Start trip with wrong OTP -> 401
$wrongOtpRes = runApi('/api/v1/driver/rides/' . $activeBookingId . '/status', 'PATCH', array(
    'status' => 'STARTED',
    'otp'    => '9999'
), $driverToken1);
assertTest('Start trip with invalid OTP returns 401', isset($wrongOtpRes['statusCode']) && $wrongOtpRes['statusCode'] === 401);

// Test 26: Start trip with valid start_otp -> 200, status IN_PROGRESS
$startRes = runApi('/api/v1/driver/rides/' . $activeBookingId . '/status', 'PATCH', array(
    'status' => 'STARTED',
    'otp'    => $startOtp
), $driverToken1);
assertTest('Start trip with valid OTP succeeds (status IN_PROGRESS)', isset($startRes['data']['status']) && $startRes['data']['status'] === 'IN_PROGRESS');

// Verify customer notification for STARTED
$notifsStarted = $db->query("SELECT * FROM `notifications` WHERE `user_id` = '{$customer1['id']}' AND `title` = 'Trip Started'")->fetch();
assertTest('Customer receives "Trip Started" notification', !empty($notifsStarted));

// Test 27: Driver completes the trip
$initialCustomerRides = (int)$db->query("SELECT total_rides FROM `customers` WHERE `id` = '{$customer1['id']}'")->fetchColumn();
$initialWallet = (float)$db->query("SELECT balance FROM `driver_wallets` WHERE `driver_id` = '{$driver1['id']}'")->fetchColumn();

$completeRes = runApi('/api/v1/driver/rides/' . $activeBookingId . '/status', 'PATCH', array('status' => 'COMPLETED'), $driverToken1);
assertTest('Driver completes trip (status COMPLETED)', isset($completeRes['data']['status']) && $completeRes['data']['status'] === 'COMPLETED');
assertTest('Completion returns driver earnings', isset($completeRes['data']['driver_earnings']) && (float)$completeRes['data']['driver_earnings'] > 0);

// Test 28: Payment record automatically created in `payments` table (Step 9P)
$paymentCheck = $db->query("SELECT * FROM `payments` WHERE `booking_id` = '{$activeBookingId}'")->fetch();
assertTest('Payment record created in payments table', !empty($paymentCheck));
assertTest('Payment status is SUCCESS', isset($paymentCheck['status']) && $paymentCheck['status'] === 'SUCCESS');
assertTest('Payment amount matches booking total_fare', (float)$paymentCheck['amount'] === (float)$createRes['data']['total_fare']);

// Test 29: Customer total_rides incremented (Step 9H enhancement)
$newCustomerRides = (int)$db->query("SELECT total_rides FROM `customers` WHERE `id` = '{$customer1['id']}'")->fetchColumn();
assertTest('Customer total_rides incremented by 1', $newCustomerRides === ($initialCustomerRides + 1));

// Test 30: Driver wallet credited
$newWallet = (float)$db->query("SELECT balance FROM `driver_wallets` WHERE `driver_id` = '{$driver1['id']}'")->fetchColumn();
assertTest('Driver wallet credited with earnings', $newWallet > $initialWallet);

// Test 31: Customer receives "Ride Completed" notification
$notifsCompleted = $db->query("SELECT * FROM `notifications` WHERE `user_id` = '{$customer1['id']}' AND `title` = 'Ride Completed'")->fetch();
assertTest('Customer receives "Ride Completed" notification', !empty($notifsCompleted));

// Test 32: Active booking query now returns null (trip finished)
$actAfterComplete = runApi('/api/v1/booking/active', 'GET', null, $token1);
assertTest('Customer has no active booking after completion', $actAfterComplete['data'] === null);

// =============================================================
// SECTION 6: Rate & Review Booking (POST /api/v1/booking/rate)
// =============================================================
echo "\n--- Section 6: Rate & Review Booking ---\n";

// Test 33: Rate without booking ID
$noIdRate = runApi('/api/v1/booking/rate', 'POST', array('rating' => 5), $token1);
assertTest('Rate without booking ID returns 400', isset($noIdRate['statusCode']) && $noIdRate['statusCode'] === 400);

// Test 34: Rating out of bounds (0 or 6)
$badRate = runApi('/api/v1/booking/' . $activeBookingId . '/rate', 'POST', array('rating' => 6), $token1);
assertTest('Rating > 5 returns 400', isset($badRate['statusCode']) && $badRate['statusCode'] === 400);

// Test 35: Rate by non-owner customer
$otherRate = runApi('/api/v1/booking/' . $activeBookingId . '/rate', 'POST', array('rating' => 5), $token2);
assertTest('Other customer cannot rate someone else\'s ride (404)', isset($otherRate['statusCode']) && $otherRate['statusCode'] === 404);

// Test 36: Rate completed booking with valid rating & review
$rateRes = runApi('/api/v1/booking/' . $activeBookingId . '/rate', 'POST', array(
    'rating'      => 5,
    'review_text' => 'Excellent service! Driver was polite and car was spotless.'
), $token1);
assertTest('Rate completed booking returns 200', isset($rateRes['statusCode']) && $rateRes['statusCode'] === 200);
assertTest('Booking rating updated in database', isset($rateRes['data']['rating']) && $rateRes['data']['rating'] === 5);

// Test 37: Driver overall rating recalculated
$driverRating = (float)$db->query("SELECT rating FROM `drivers` WHERE `id` = '{$driver1['id']}'")->fetchColumn();
assertTest('Driver average rating updated in drivers table', $driverRating > 0.0);

// Test 38: Cannot rate a non-completed booking
$newBookingForRate = runApi('/api/v1/booking/create', 'POST', array(
    'pickup'         => 'Gandhipuram',
    'drop'           => 'Singanallur',
    'vehicle_type'   => 'Red Mini',
    'distance_km'    => 8.0,
    'duration_min'   => 20,
    'payment_method' => 'CASH'
), $token1);
$nonCompletedId = $newBookingForRate['data']['id'];

$rateSearching = runApi('/api/v1/booking/' . $nonCompletedId . '/rate', 'POST', array('rating' => 4), $token1);
assertTest('Cannot rate a ride that is not COMPLETED (400)', isset($rateSearching['statusCode']) && $rateSearching['statusCode'] === 400);

// =============================================================
// SECTION 7: Booking Cancellation & Fees (POST /api/v1/booking/cancel)
// =============================================================
echo "\n--- Section 7: Booking Cancellation & Fees ---\n";

// Test 39: Customer cancels SEARCHING ride (fee = 0.00)
$cancelSearching = runApi('/api/v1/booking/' . $nonCompletedId . '/cancel', 'POST', array('reason' => 'Changed my travel plans'), $token1);
assertTest('Cancel SEARCHING ride returns 200', isset($cancelSearching['statusCode']) && $cancelSearching['statusCode'] === 200);
assertTest('Cancellation fee is ₹0 when driver not yet assigned', (float)$cancelSearching['data']['cancellation_fee'] === 0.00);
assertTest('Status updated to CANCELLED', $cancelSearching['data']['status'] === 'CANCELLED');

// Verify cancellations table record
$cancelRecord = $db->query("SELECT * FROM `cancellations` WHERE `booking_id` = '{$nonCompletedId}'")->fetch();
assertTest('Cancellation record inserted in cancellations table', !empty($cancelRecord));

// Test 40: Cannot cancel an already cancelled ride
$reCancel = runApi('/api/v1/booking/' . $nonCompletedId . '/cancel', 'POST', null, $token1);
assertTest('Cannot re-cancel already cancelled ride (400)', isset($reCancel['statusCode']) && $reCancel['statusCode'] === 400);

// Test 41: Cannot cancel a COMPLETED ride
$cancelCompleted = runApi('/api/v1/booking/' . $activeBookingId . '/cancel', 'POST', null, $token1);
assertTest('Cannot cancel a completed ride (400)', isset($cancelCompleted['statusCode']) && $cancelCompleted['statusCode'] === 400);

// Test 42: Cancellation after driver is assigned (cancellation fee applies)
$bookingWithFee = runApi('/api/v1/booking/create', 'POST', array(
    'pickup'         => 'R.S. Puram',
    'drop'           => 'Airport',
    'vehicle_type'   => 'Red Mini',
    'distance_km'    => 12.0,
    'duration_min'   => 25,
    'payment_method' => 'UPI'
), $token1);
$feeBookingId = $bookingWithFee['data']['id'];

// Driver accepts it
runApi('/api/v1/driver/rides/' . $feeBookingId . '/accept', 'POST', null, $driverToken2);

// Customer cancels after driver assigned
$cancelAssigned = runApi('/api/v1/booking/' . $feeBookingId . '/cancel', 'POST', array('reason' => 'Driver took too long to arrive'), $token1);
assertTest('Cancel ASSIGNED ride returns 200', isset($cancelAssigned['statusCode']) && $cancelAssigned['statusCode'] === 200);
assertTest('Cancellation fee applied (> 0) when driver was assigned', (float)$cancelAssigned['data']['cancellation_fee'] > 0);
assertTest('Fee charged to CUSTOMER', $cancelAssigned['data']['fee_charged_to'] === 'CUSTOMER');

// Verify driver received notification that customer cancelled
$notifDriverCancelled = $db->query("SELECT * FROM `notifications` WHERE `user_id` = '{$driver2['id']}' AND `title` = 'Ride Cancelled'")->fetch();
assertTest('Driver received notification that ride was cancelled', !empty($notifDriverCancelled));

// =============================================================
// SECTION 8: Real-Time SOS Alerts (POST /api/v1/booking/sos)
// =============================================================
echo "\n--- Section 8: Real-Time SOS Emergency Alerts ---\n";

// Create an active ride for SOS test
$sosBooking = runApi('/api/v1/booking/create', 'POST', array(
    'pickup'         => 'Gandhipuram',
    'drop'           => 'Avinashi Road',
    'vehicle_type'   => 'Red Sedan',
    'distance_km'    => 10.0,
    'duration_min'   => 20,
    'payment_method' => 'CASH'
), $token1);
$sosBookingId = $sosBooking['data']['id'];
$sosOtp = $sosBooking['data']['start_otp'];

// Driver 1 accepts, arrives, and starts trip
runApi('/api/v1/driver/rides/' . $sosBookingId . '/accept', 'POST', null, $driverToken1);
runApi('/api/v1/driver/rides/' . $sosBookingId . '/status', 'PATCH', array('status' => 'ARRIVED'), $driverToken1);
runApi('/api/v1/driver/rides/' . $sosBookingId . '/status', 'PATCH', array('status' => 'STARTED', 'otp' => $sosOtp), $driverToken1);

// Test 43: Trigger SOS during active IN_PROGRESS trip
$sosRes = runApi('/api/v1/booking/' . $sosBookingId . '/sos', 'POST', array(
    'lat' => 11.0250,
    'lng' => 76.9950
), $token1);
assertTest('Trigger SOS returns 201 Created', isset($sosRes['statusCode']) && $sosRes['statusCode'] === 201);
assertTest('SOS status is ACTIVE', isset($sosRes['data']['status']) && $sosRes['data']['status'] === 'ACTIVE');
assertTest('Returns emergency contact numbers', isset($sosRes['data']['emergency_contacts']['police']));

// Verify sos_alerts table record
$sosRecord = $db->query("SELECT * FROM `sos_alerts` WHERE `booking_id` = '{$sosBookingId}'")->fetch();
assertTest('SOS record inserted into sos_alerts table', !empty($sosRecord));
assertTest('SOS triggered_by is CUSTOMER', $sosRecord['triggered_by'] === 'CUSTOMER');

// Test 44: SOS alert generates emergency notification
$sosNotif = $db->query("SELECT * FROM `notifications` WHERE `type` = 'SYSTEM' AND `title` LIKE '%SOS%'")->fetch();
assertTest('Emergency SOS notification generated', !empty($sosNotif));

// Test 45: Cannot trigger SOS on a CANCELLED or non-active ride
$cancelSosTest = runApi('/api/v1/booking/create', 'POST', array(
    'pickup'         => 'Gandhipuram',
    'drop'           => 'Town Hall',
    'vehicle_type'   => 'Red Mini',
    'distance_km'    => 4.0,
    'duration_min'   => 12,
    'payment_method' => 'CASH'
), $token2);
$searchBookingId = $cancelSosTest['data']['id'];

$sosBadStatus = runApi('/api/v1/booking/' . $searchBookingId . '/sos', 'POST', null, $token2);
assertTest('Cannot trigger SOS on SEARCHING ride (must be in-trip) (400)', isset($sosBadStatus['statusCode']) && $sosBadStatus['statusCode'] === 400);

// Cleanup: complete SOS ride
runApi('/api/v1/driver/rides/' . $sosBookingId . '/status', 'PATCH', array('status' => 'COMPLETED'), $driverToken1);

// =============================================================
// Test Summary
// =============================================================
echo "\n=======================================================\n";
echo "Phase 9 Test Execution Summary\n";
echo "Total Tests Run: " . ($passedCount + $failedCount) . "\n";
echo "Passed:          {$passedCount}\n";
echo "Failed:          {$failedCount}\n";
echo "=======================================================\n";

if ($failedCount === 0) {
    echo "\n>>> ALL PHASE 9 BOOKING TESTS PASSED (100%) <<<\n";
    exit(0);
} else {
    echo "\n>>> SOME TESTS FAILED <<<\n";
    exit(1);
}
