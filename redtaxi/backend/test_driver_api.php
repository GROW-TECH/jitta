<?php
/**
 * RedTaxi Driver API Automated Test Suite
 * Validates all 14 Driver API requirements:
 * 1. Get driver profile
 * 2. Update driver profile
 * 3. Get driver vehicle details
 * 4. Update driver vehicle details
 * 5. Driver online/offline status
 * 6. Get available ride requests
 * 7. Accept ride request
 * 8. Reject ride request
 * 9. Get current/active ride
 * 10. Update ride status: ARRIVED, STARTED, COMPLETED
 * 11. Get driver ride history
 * 12. Get driver wallet and transactions
 * 13. Get driver notifications
 * 14. Driver document/status information
 *
 * Enforces:
 * - Driver Bearer authentication
 * - Customer tokens receive 403 Forbidden
 * - Unauthenticated requests receive 401 Unauthorized
 * - Validates input validation and error states
 * - PHP 5.6-compatible syntax
 */

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/DriverModel.php';
require_once __DIR__ . '/models/CustomerModel.php';
require_once __DIR__ . '/utils/Security.php';

echo "=======================================================\n";
echo "RedTaxi Driver API Test Suite (PHP 5.6+)\n";
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

    $runnerScript = tempnam(sys_get_temp_dir(), 'rt_drv_') . '.php';
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
// Fixture Setup: Database connection & test records
// -------------------------------------------------------------
$db = Database::getInstance()->getConnection();
$driverModel = new DriverModel();
$customerModel = new CustomerModel();

// 1. Ensure a valid city exists
$cityStmt = $db->query("SELECT id FROM `cities` LIMIT 1");
$city = $cityStmt->fetch();
if (!$city) {
    $db->query("INSERT INTO `cities` (`name`, `state`, `country`, `lat`, `lng`, `radius_km`, `is_active`)
                VALUES ('Coimbatore', 'Tamil Nadu', 'India', 11.0168, 76.9558, 50, 1)");
    $cityId = (int)$db->lastInsertId();
} else {
    $cityId = (int)$city['id'];
}

// 2. Create primary test driver partner (Approved)
$driverPhone1 = '97001' . mt_rand(10000, 99999);
$driver1 = $driverModel->createDriver(array(
    'name'            => 'Karthik Raja',
    'phone'           => $driverPhone1,
    'email'           => 'karthik_' . $driverPhone1 . '@example.com',
    'city_id'         => $cityId,
    'approval_status' => 'APPROVED',
    'vehicle_model'   => 'Maruti Dzire',
    'vehicle_number'  => 'TN 38 BR ' . mt_rand(1000, 9999),
    'vehicle_type'    => 'Sedan'
));
$driverToken1 = Security::generateToken($driver1['id'], 'driver');
$db->query("UPDATE driver_wallets SET balance = 1000.00 WHERE driver_id = '{$driver1['id']}'");

// 3. Create secondary test driver partner for collision / multi-driver tests
$driverPhone2 = '97002' . mt_rand(10000, 99999);
$driver2 = $driverModel->createDriver(array(
    'name'            => 'Murugan S',
    'phone'           => $driverPhone2,
    'email'           => 'murugan_' . $driverPhone2 . '@example.com',
    'city_id'         => $cityId,
    'approval_status' => 'APPROVED',
    'vehicle_model'   => 'Toyota Innova',
    'vehicle_number'  => 'TN 38 KM ' . mt_rand(1000, 9999),
    'vehicle_type'    => 'SUV'
));
$driverToken2 = Security::generateToken($driver2['id'], 'driver');
$db->query("UPDATE driver_wallets SET balance = 1000.00 WHERE driver_id = '{$driver2['id']}'");

// 4. Create pending driver partner (to verify approval gating)
$pendingPhone = '97003' . mt_rand(10000, 99999);
$pendingDriver = $driverModel->createDriver(array(
    'name'            => 'Suresh Kumar',
    'phone'           => $pendingPhone,
    'email'           => 'suresh_' . $pendingPhone . '@example.com',
    'city_id'         => $cityId,
    'approval_status' => 'PENDING',
    'vehicle_model'   => 'Tata Tigor',
    'vehicle_number'  => 'TN 38 ZZ ' . mt_rand(1000, 9999)
));
$pendingDriverToken = Security::generateToken($pendingDriver['id'], 'driver');

// 5. Create customer for role restriction check
$custPhone = '97004' . mt_rand(10000, 99999);
$customer = $customerModel->createCustomer(array(
    'name'  => 'Divya N',
    'phone' => $custPhone,
    'email' => 'divya_' . $custPhone . '@example.com'
));
$customerToken = Security::generateToken($customer['id'], 'customer');

// -------------------------------------------------------------
// Security & Role Authorization Tests
// -------------------------------------------------------------
echo "0. Testing Role Authorization & Guard Rails...\n";

$unauthRes = runApi('/api/v1/driver/profile', 'GET', null, null);
assertTest('Unauthenticated request to /driver/profile returns 401', isset($unauthRes['statusCode']) && $unauthRes['statusCode'] === 401);

$custProfileRes = runApi('/api/v1/driver/profile', 'GET', null, $customerToken);
assertTest('Customer token to /driver/profile returns 403 Forbidden', isset($custProfileRes['statusCode']) && $custProfileRes['statusCode'] === 403);

$custStatusRes = runApi('/api/v1/driver/status', 'PATCH', array('is_online' => true), $customerToken);
assertTest('Customer token to /driver/status returns 403 Forbidden', isset($custStatusRes['statusCode']) && $custStatusRes['statusCode'] === 403);

$custWalletRes = runApi('/api/v1/driver/wallet', 'GET', null, $customerToken);
assertTest('Customer token to /driver/wallet returns 403 Forbidden', isset($custWalletRes['statusCode']) && $custWalletRes['statusCode'] === 403);
echo "\n";

// -------------------------------------------------------------
// 1. Get Driver Profile
// -------------------------------------------------------------
echo "1. Testing Get Driver Profile (GET /api/v1/driver/profile)...\n";
$profRes = runApi('/api/v1/driver/profile', 'GET', null, $driverToken1);
assertTest('Profile retrieved successfully', isset($profRes['success']) && $profRes['success'] === true && $profRes['statusCode'] === 200);
assertTest('Profile contains expected driver name', isset($profRes['data']['name']) && $profRes['data']['name'] === 'Karthik Raja');
assertTest('Password hash is omitted from profile response', !isset($profRes['data']['password_hash']));
assertTest('Profile includes vehicle information', isset($profRes['data']['vehicle_model']) && $profRes['data']['vehicle_model'] === 'Maruti Dzire');
assertTest('Profile includes wallet summary', isset($profRes['data']['wallet_balance']));
echo "\n";

// -------------------------------------------------------------
// 2. Update Driver Profile
// -------------------------------------------------------------
echo "2. Testing Update Driver Profile (PUT /api/v1/driver/profile)...\n";
$updProfRes = runApi('/api/v1/driver/profile', 'PUT', array(
    'name'      => 'Karthik Raja K',
    'photo_url' => 'https://images.unsplash.com/photo-karthik.jpg'
), $driverToken1);
assertTest('Profile updated successfully', isset($updProfRes['success']) && $updProfRes['success'] === true);
assertTest('Updated profile name matches', isset($updProfRes['data']['name']) && $updProfRes['data']['name'] === 'Karthik Raja K');
assertTest('Updated photo_url matches', isset($updProfRes['data']['photo_url']) && strpos($updProfRes['data']['photo_url'], 'photo-karthik') !== false);

// Name validation: too short
$shortNameRes = runApi('/api/v1/driver/profile', 'PUT', array('name' => 'K'), $driverToken1);
assertTest('Short name returns 400 Bad Request', isset($shortNameRes['statusCode']) && $shortNameRes['statusCode'] === 400);

// Email collision with driver2
$dupEmailRes = runApi('/api/v1/driver/profile', 'PUT', array('email' => $driver2['email']), $driverToken1);
assertTest('Duplicate driver email returns 409 Conflict', isset($dupEmailRes['statusCode']) && $dupEmailRes['statusCode'] === 409);
echo "\n";

// -------------------------------------------------------------
// 3. Get Driver Vehicle Details
// -------------------------------------------------------------
echo "3. Testing Get Driver Vehicle Details (GET /api/v1/driver/vehicle)...\n";
$vehRes = runApi('/api/v1/driver/vehicle', 'GET', null, $driverToken1);
assertTest('Get vehicle details returns 200', isset($vehRes['success']) && $vehRes['success'] === true);
assertTest('Active vehicle model matches fixture', isset($vehRes['data']['active_vehicle']['vehicle_model']) && $vehRes['data']['active_vehicle']['vehicle_model'] === 'Maruti Dzire');
assertTest('All vehicles array is returned', isset($vehRes['data']['all_vehicles']) && count($vehRes['data']['all_vehicles']) >= 1);

$vehPluralRes = runApi('/api/v1/driver/vehicles', 'GET', null, $driverToken1);
assertTest('GET /api/v1/driver/vehicles also returns vehicle details', isset($vehPluralRes['data']['active_vehicle']['id']));
$activeVehId = $vehRes['data']['active_vehicle']['id'];
echo "\n";

// -------------------------------------------------------------
// 4. Update Driver Vehicle Details
// -------------------------------------------------------------
echo "4. Testing Update Driver Vehicle Details (PUT /api/v1/driver/vehicles/{id})...\n";
$updVehRes = runApi('/api/v1/driver/vehicles/' . $activeVehId, 'PUT', array(
    'vehicle_model' => 'Maruti Dzire ZXi+',
    'color'         => 'Pearl White',
    'year'          => 2023
), $driverToken1);
assertTest('Vehicle details updated successfully', isset($updVehRes['success']) && $updVehRes['success'] === true);
assertTest('Updated vehicle model matches', isset($updVehRes['data']['vehicle_model']) && $updVehRes['data']['vehicle_model'] === 'Maruti Dzire ZXi+');
assertTest('Updated color matches', isset($updVehRes['data']['color']) && $updVehRes['data']['color'] === 'Pearl White');
assertTest('Updated year matches', isset($updVehRes['data']['year']) && (int)$updVehRes['data']['year'] === 2023);

// Non-existent vehicle ID update
$fakeVehRes = runApi('/api/v1/driver/vehicles/' . Security::generateUUID(), 'PUT', array('color' => 'Blue'), $driverToken1);
assertTest('Updating non-existent vehicle returns 404', isset($fakeVehRes['statusCode']) && $fakeVehRes['statusCode'] === 404);
echo "\n";

// -------------------------------------------------------------
// 5. Driver Online/Offline Status & GPS
// -------------------------------------------------------------
echo "5. Testing Driver Online/Offline Status (PATCH /api/v1/driver/status)...\n";
$onlineRes = runApi('/api/v1/driver/status', 'PATCH', array(
    'is_online' => true,
    'lat'       => 11.0168445,
    'lng'       => 76.9558321
), $driverToken1);
assertTest('Approved driver successfully goes ONLINE', isset($onlineRes['success']) && $onlineRes['success'] === true);
assertTest('Driver status response is_online is true', isset($onlineRes['data']['is_online']) && $onlineRes['data']['is_online'] === true);
assertTest('Driver status updates GPS lat/lng', isset($onlineRes['data']['current_lat']) && abs($onlineRes['data']['current_lat'] - 11.0168445) < 0.0001);

// Pending driver cannot go online
$pendingOnlineRes = runApi('/api/v1/driver/status', 'PATCH', array('is_online' => true), $pendingDriverToken);
assertTest('Pending driver attempting to go online returns 403 Forbidden', isset($pendingOnlineRes['statusCode']) && $pendingOnlineRes['statusCode'] === 403);

// Toggle back offline
$offlineRes = runApi('/api/v1/driver/status', 'PATCH', array('is_online' => false), $driverToken1);
assertTest('Driver successfully goes OFFLINE', isset($offlineRes['data']['is_online']) && $offlineRes['data']['is_online'] === false);

// Put driver back online for ride workflows
runApi('/api/v1/driver/status', 'PATCH', array('is_online' => true, 'lat' => 11.0168, 'lng' => 76.9558), $driverToken1);
echo "\n";

// -------------------------------------------------------------
// 6. Get Available Ride Requests
// -------------------------------------------------------------
echo "6. Testing Get Available Ride Requests (GET /api/v1/driver/rides/available)...\n";

// Seed a booking in SEARCHING state
$availBookingId = 'TXI-' . mt_rand(100000, 999999);
$db->query("INSERT INTO `bookings` (
    `id`, `customer_id`, `city_id`, `ride_type`, `vehicle_category`,
    `status`, `start_otp`, `distance_km`, `duration_min`,
    `base_fare`, `distance_fare`, `time_fare`, `platform_fee`, `tax`, `discount`, `total_fare`,
    `payment_method`, `payment_status`, `created_at`
) VALUES (
    '{$availBookingId}', '{$customer['id']}', {$cityId}, 'CITY', 'Red Sedan',
    'SEARCHING', '7732', 8.50, 22.00,
    100.00, 110.00, 25.00, 10.00, 12.25, 0.00, 257.25,
    'UPI', 'PENDING', NOW()
)");

$db->query("INSERT INTO `booking_locations` (`id`, `booking_id`, `type`, `sequence_order`, `name`, `address`, `lat`, `lng`, `category`) VALUES
    ('" . Security::generateUUID() . "', '{$availBookingId}', 'PICKUP', 0, 'Gandhipuram Bus Stand', 'Cross Cut Road, Coimbatore', 11.0183, 76.9644, 'OTHER'),
    ('" . Security::generateUUID() . "', '{$availBookingId}', 'DROP', 1, 'Brookefields Mall', 'Dr Krishnasamy Rd, Coimbatore', 11.0116, 76.9587, 'OTHER')
");

$availRes = runApi('/api/v1/driver/rides/available', 'GET', null, $driverToken1);
assertTest('Get available rides returns 200', isset($availRes['success']) && $availRes['success'] === true);
assertTest('Available rides list includes seeded ride', count($availRes['data']) >= 1);
$foundBooking = null;
foreach ($availRes['data'] as $r) {
    if ($r['id'] === $availBookingId) {
        $foundBooking = $r;
        break;
    }
}
assertTest('Found newly created booking in available rides', $foundBooking !== null);
assertTest('Ride includes pickup details', isset($foundBooking['pickup']['name']) && $foundBooking['pickup']['name'] === 'Gandhipuram Bus Stand');
assertTest('Ride includes drop details', isset($foundBooking['drop']['name']) && $foundBooking['drop']['name'] === 'Brookefields Mall');
assertTest('Ride includes passenger name', isset($foundBooking['customer_name']) && $foundBooking['customer_name'] === 'Divya N');
echo "\n";

// -------------------------------------------------------------
// 7. Accept Ride Request
// -------------------------------------------------------------
echo "7. Testing Accept Ride Request (POST /api/v1/driver/rides/{id}/accept)...\n";
$acceptRes = runApi('/api/v1/driver/rides/' . $availBookingId . '/accept', 'POST', null, $driverToken1);
assertTest('Driver 1 accepts ride successfully', isset($acceptRes['success']) && $acceptRes['success'] === true);
assertTest('Accepted ride status is EN_ROUTE or ASSIGNED', isset($acceptRes['data']['status']) && in_array($acceptRes['data']['status'], array('ASSIGNED', 'EN_ROUTE')));
assertTest('Accepted ride assigned to driver 1', isset($acceptRes['data']['driver_id']) && $acceptRes['data']['driver_id'] === $driver1['id']);

// Conflict 1: Second driver tries to accept the already assigned ride
$conflictDriver2 = runApi('/api/v1/driver/rides/' . $availBookingId . '/accept', 'POST', null, $driverToken2);
assertTest('Second driver accepting already assigned ride returns 409 Conflict', isset($conflictDriver2['statusCode']) && $conflictDriver2['statusCode'] === 409);

// Conflict 2: Driver 1 already in active ride tries to accept another ride
$secondBookingId = 'TXI-' . mt_rand(100000, 999999);
$db->query("INSERT INTO `bookings` (`id`, `customer_id`, `city_id`, `ride_type`, `vehicle_category`, `status`, `start_otp`, `total_fare`, `payment_method`, `created_at`)
            VALUES ('{$secondBookingId}', '{$customer['id']}', {$cityId}, 'CITY', 'Red Sedan', 'SEARCHING', '1122', 150.00, 'CASH', NOW())");
$busyRes = runApi('/api/v1/driver/rides/' . $secondBookingId . '/accept', 'POST', null, $driverToken1);
assertTest('Driver with active ride accepting another ride returns 409 Conflict', isset($busyRes['statusCode']) && $busyRes['statusCode'] === 409);
echo "\n";

// -------------------------------------------------------------
// 8. Reject Ride Request
// -------------------------------------------------------------
echo "8. Testing Reject Ride Request (POST /api/v1/driver/rides/{id}/reject)...\n";
$rejectRes = runApi('/api/v1/driver/rides/' . $availBookingId . '/reject', 'POST', null, $driverToken1);
assertTest('Reject ride returns success', isset($rejectRes['success']) && $rejectRes['success'] === true);
assertTest('Reject response flags rejected true', isset($rejectRes['data']['rejected']) && $rejectRes['data']['rejected'] === true);

// Verify booking released back to SEARCHING pool
$recheckStmt = $db->query("SELECT status, driver_id FROM `bookings` WHERE id = '{$availBookingId}'");
$recheck = $recheckStmt->fetch();
assertTest('Booking released back to SEARCHING status', $recheck['status'] === 'SEARCHING' && $recheck['driver_id'] === null);

// Clean up the dummy second booking
$db->query("DELETE FROM `bookings` WHERE id = '{$secondBookingId}'");
echo "\n";

// -------------------------------------------------------------
// 9. Get Current/Active Ride
// -------------------------------------------------------------
echo "9. Testing Get Current/Active Ride (GET /api/v1/driver/rides/current)...\n";

// Initially after reject, driver has no active ride
$noActiveRes = runApi('/api/v1/driver/rides/current', 'GET', null, $driverToken1);
assertTest('No active ride returns data: null', array_key_exists('data', $noActiveRes) && $noActiveRes['data'] === null);

// Driver 1 accepts the ride again
$reAcceptRes = runApi('/api/v1/driver/rides/' . $availBookingId . '/accept', 'POST', null, $driverToken1);
assertTest('Re-accepting ride succeeds', isset($reAcceptRes['success']) && $reAcceptRes['success'] === true);

// Now query active ride
$currRes = runApi('/api/v1/driver/rides/current', 'GET', null, $driverToken1);
assertTest('Active ride retrieved successfully', isset($currRes['data']['id']) && $currRes['data']['id'] === $availBookingId);
assertTest('Active ride includes customer name', isset($currRes['data']['customer_name']) && $currRes['data']['customer_name'] === 'Divya N');
assertTest('Active ride includes pickup and drop locations', isset($currRes['data']['locations']) && count($currRes['data']['locations']) >= 2);
echo "\n";

// -------------------------------------------------------------
// 10. Update Ride Status (ARRIVED, STARTED, COMPLETED)
// -------------------------------------------------------------
echo "10. Testing Update Ride Status Transitions (ARRIVED, STARTED, COMPLETED)...\n";

// 10A. Transition to ARRIVED
$arrivedRes = runApi('/api/v1/driver/rides/' . $availBookingId . '/status', 'PATCH', array(
    'status' => 'ARRIVED'
), $driverToken1);
assertTest('Status transition to ARRIVED succeeds', isset($arrivedRes['success']) && $arrivedRes['success'] === true);
assertTest('Current status is now ARRIVED', isset($arrivedRes['data']['status']) && $arrivedRes['data']['status'] === 'ARRIVED');

// 10B. Invalid transition: Cannot jump straight to COMPLETED
$skipRes = runApi('/api/v1/driver/rides/' . $availBookingId . '/status', 'PATCH', array(
    'status' => 'COMPLETED'
), $driverToken1);
assertTest('Jumping from ARRIVED to COMPLETED returns 400 Bad Request', isset($skipRes['statusCode']) && $skipRes['statusCode'] === 400);

// 10C. Transition to STARTED: Missing OTP
$noOtpRes = runApi('/api/v1/driver/rides/' . $availBookingId . '/status', 'PATCH', array(
    'status' => 'STARTED'
), $driverToken1);
assertTest('Starting ride without OTP returns 400 Bad Request', isset($noOtpRes['statusCode']) && $noOtpRes['statusCode'] === 400);

// 10D. Transition to STARTED: Wrong OTP
$wrongOtpRes = runApi('/api/v1/driver/rides/' . $availBookingId . '/status', 'PATCH', array(
    'status' => 'STARTED',
    'otp'    => '9999'
), $driverToken1);
assertTest('Starting ride with incorrect OTP returns 401 Unauthorized', isset($wrongOtpRes['statusCode']) && $wrongOtpRes['statusCode'] === 401);

// 10E. Transition to STARTED: Valid OTP ('7732')
$startRes = runApi('/api/v1/driver/rides/' . $availBookingId . '/status', 'PATCH', array(
    'status' => 'STARTED',
    'otp'    => '7732'
), $driverToken1);
assertTest('Starting ride with correct OTP succeeds', isset($startRes['success']) && $startRes['success'] === true);
assertTest('Ride status is now IN_PROGRESS', isset($startRes['data']['status']) && $startRes['data']['status'] === 'IN_PROGRESS');
assertTest('Ride started_at timestamp is set', isset($startRes['data']['started_at']) && !empty($startRes['data']['started_at']));

// 10F. Transition to COMPLETED
$compRes = runApi('/api/v1/driver/rides/' . $availBookingId . '/status', 'PATCH', array(
    'status' => 'COMPLETED'
), $driverToken1);
assertTest('Completing ride succeeds', isset($compRes['success']) && $compRes['success'] === true);
assertTest('Completed response contains driver earnings', isset($compRes['data']['driver_earnings']) && (float)$compRes['data']['driver_earnings'] > 0);
assertTest('Completed response contains commission deduction', isset($compRes['data']['commission']) && (float)$compRes['data']['commission'] > 0);

// Verify database state after ride completion
$dbCheck = $db->query("SELECT status, completed_at FROM `bookings` WHERE id = '{$availBookingId}'")->fetch();
assertTest('Booking status in DB is COMPLETED', $dbCheck['status'] === 'COMPLETED');
assertTest('Booking completed_at is populated', !empty($dbCheck['completed_at']));

$driverCheck = $db->query("SELECT trips_count FROM `drivers` WHERE id = '{$driver1['id']}'")->fetch();
assertTest('Driver trips_count incremented', (int)$driverCheck['trips_count'] >= 1);
echo "\n";

// -------------------------------------------------------------
// 11. Get Driver Ride History
// -------------------------------------------------------------
echo "11. Testing Get Driver Ride History (GET /api/v1/driver/rides/history)...\n";
$histRes = runApi('/api/v1/driver/rides/history', 'GET', null, $driverToken1);
assertTest('Ride history returns 200', isset($histRes['success']) && $histRes['success'] === true);
assertTest('Ride history contains completed ride', isset($histRes['data']) && count($histRes['data']) >= 1);
assertTest('History ride contains customer name', isset($histRes['data'][0]['customer_name']) && $histRes['data'][0]['customer_name'] === 'Divya N');
assertTest('History ride contains pickup address', isset($histRes['data'][0]['pickup']['name']) && $histRes['data'][0]['pickup']['name'] === 'Gandhipuram Bus Stand');
assertTest('History ride contains total fare', isset($histRes['data'][0]['total_fare']) && (float)$histRes['data'][0]['total_fare'] == 257.25);
assertTest('History contains pagination meta', isset($histRes['meta']['page']) && isset($histRes['meta']['limit']));
echo "\n";

// -------------------------------------------------------------
// 12. Get Driver Wallet and Transactions
// -------------------------------------------------------------
echo "12. Testing Get Driver Wallet and Transactions (GET /api/v1/driver/wallet)...\n";
$walletRes = runApi('/api/v1/driver/wallet', 'GET', null, $driverToken1);
assertTest('Wallet endpoint returns 200', isset($walletRes['success']) && $walletRes['success'] === true);
assertTest('Wallet balance is credited with ride earnings', isset($walletRes['data']['balance']) && (float)$walletRes['data']['balance'] > 0);
assertTest('Today earnings is populated', isset($walletRes['data']['todayEarnings']) && (float)$walletRes['data']['todayEarnings'] > 0);
assertTest('Today trips equals 1', isset($walletRes['data']['todayTrips']) && (int)$walletRes['data']['todayTrips'] === 1);
assertTest('Total commission paid recorded', isset($walletRes['data']['totalCommissionPaid']) && (float)$walletRes['data']['totalCommissionPaid'] > 0);
assertTest('Wallet contains ledger transaction record', isset($walletRes['data']['transactions']) && count($walletRes['data']['transactions']) >= 1);
assertTest('Ledger transaction is of type CREDIT', isset($walletRes['data']['transactions'][0]['type']) && $walletRes['data']['transactions'][0]['type'] === 'CREDIT');
assertTest('Ledger transaction reference matches completed booking', isset($walletRes['data']['transactions'][0]['reference_id']) && $walletRes['data']['transactions'][0]['reference_id'] === $availBookingId);
echo "\n";

// -------------------------------------------------------------
// 13. Get Driver Notifications
// -------------------------------------------------------------
echo "13. Testing Get Driver Notifications (GET /api/v1/driver/notifications)...\n";

// Seed driver-specific notification and broadcast notification
$db->query("INSERT INTO `notifications` (`id`, `user_id`, `user_type`, `title`, `message`, `type`, `is_read`, `audience`, `created_at`) VALUES
    ('" . Security::generateUUID() . "', '{$driver1['id']}', 'DRIVER', 'Trip Earnings Credited', '₹218.66 has been credited for ride {$availBookingId}', 'PAYMENT', 0, 'INDIVIDUAL', NOW()),
    ('" . Security::generateUUID() . "', NULL, NULL, 'Peak Hours Bonus', 'Earn 20% extra on trips between 6 PM and 9 PM today!', 'OFFER', 0, 'DRIVERS', NOW())
");

$notifRes = runApi('/api/v1/driver/notifications', 'GET', null, $driverToken1);
assertTest('Notifications endpoint returns 200', isset($notifRes['success']) && $notifRes['success'] === true);
assertTest('Returns both personal and broadcast driver notifications', count($notifRes['data']) >= 2);
assertTest('Meta includes unreadCount', isset($notifRes['meta']['unreadCount']) && $notifRes['meta']['unreadCount'] >= 2);
echo "\n";

// -------------------------------------------------------------
// 14. Driver Document / Status Information
// -------------------------------------------------------------
echo "14. Testing Driver Document & Verification Status (GET /api/v1/driver/documents)...\n";

// Seed driver verification documents
$db->query("INSERT INTO `driver_documents` (`id`, `driver_id`, `document_type`, `document_number`, `file_url`, `verification_status`, `expiry_date`, `created_at`) VALUES
    ('" . Security::generateUUID() . "', '{$driver1['id']}', 'LICENSE', 'DL-TN38-201800912', 'https://storage.example.com/dl.pdf', 'VERIFIED', '2030-05-15', NOW()),
    ('" . Security::generateUUID() . "', '{$driver1['id']}', 'RC', 'RC-TN38BR9123', 'https://storage.example.com/rc.pdf', 'VERIFIED', '2028-11-20', NOW()),
    ('" . Security::generateUUID() . "', '{$driver1['id']}', 'INSURANCE', 'INS-HDFC-99120', 'https://storage.example.com/ins.pdf', 'PENDING', '2027-01-10', NOW())
");

$docsRes = runApi('/api/v1/driver/documents', 'GET', null, $driverToken1);
assertTest('Documents endpoint returns 200', isset($docsRes['success']) && $docsRes['success'] === true);
assertTest('Driver approval_status is APPROVED', isset($docsRes['data']['approval_status']) && $docsRes['data']['approval_status'] === 'APPROVED');
assertTest('Documents array contains 3 submitted documents', isset($docsRes['data']['documents']) && count($docsRes['data']['documents']) === 3);
$docTypes = array();
foreach ($docsRes['data']['documents'] as $d) {
    $docTypes[] = $d['document_type'];
}
assertTest('Documents include LICENSE, RC, and INSURANCE', in_array('LICENSE', $docTypes) && in_array('RC', $docTypes) && in_array('INSURANCE', $docTypes));
echo "\n";

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
echo "=======================================================\n";
echo "Test Execution Summary\n";
echo "=======================================================\n";
echo "Total Tests Passed: {$passedCount}\n";
echo "Total Tests Failed: {$failedCount}\n";
echo "Success Rate: " . round(($passedCount / ($passedCount + $failedCount)) * 100, 2) . "%\n";

if ($failedCount === 0) {
    echo "\nAll RedTaxi Driver API tests passed successfully!\n";
    exit(0);
} else {
    echo "\nSome tests failed. Please review errors above.\n";
    exit(1);
}
