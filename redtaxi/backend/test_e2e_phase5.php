<?php
/**
 * RedTaxi - Phase 5 Full Customer -> Admin -> Driver End-to-End Verification
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/utils/Security.php';
require_once __DIR__ . '/models/CustomerModel.php';
require_once __DIR__ . '/models/DriverModel.php';
require_once __DIR__ . '/models/AdminModel.php';
require_once __DIR__ . '/models/BookingModel.php';

echo "========================================================\n";
echo "RED TAXI - PHASE 5 FULL INTEGRATION E2E TEST\n";
echo "========================================================\n\n";

$pdo = Database::getInstance()->getConnection();
$customerModel = new CustomerModel();
$driverModel = new DriverModel();
$adminModel = new AdminModel();
$bookingModel = new BookingModel();

$testPassed = 0;
$testFailed = 0;

function assertCondition($desc, $cond) {
    global $testPassed, $testFailed;
    if ($cond) {
        echo "[PASS] $desc\n";
        $testPassed++;
    } else {
        echo "[FAIL] $desc\n";
        $testFailed++;
    }
}

function dbFetchOne($pdo, $sql, $params = array()) {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $res = $stmt->fetch();
    return $res !== false ? $res : null;
}

function dbExecute($pdo, $sql, $params = array()) {
    $stmt = $pdo->prepare($sql);
    return $stmt->execute($params);
}

// ---------------------------------------------------------
// STEP 1: Verify Approved & Eligible Driver
// ---------------------------------------------------------
echo "--- Step 1: Verify Driver ---\n";
$driver = $driverModel->findByPhone('9876543210');
if (!$driver) {
    echo "Creating demo driver Karthik Raja...\n";
    $driverRes = $driverModel->register(array(
        'name' => 'Karthik Raja',
        'phone' => '9876543210',
        'email' => 'karthik@redtaxi.in',
        'city_id' => 1,
        'license_number' => 'TN3820200001234',
        'vehicle_model' => 'Maruti Swift Dzire',
        'vehicle_number' => 'TN 38 BR 1234',
        'vehicle_type' => 'Sedan'
    ));
    $driver = $driverModel->findByPhone('9876543210');
}

// Ensure driver is approved and online
dbExecute($pdo, "UPDATE `drivers` SET `approval_status` = 'APPROVED', `is_online` = 1 WHERE `id` = ?", array($driver['id']));
$driver = $driverModel->findById($driver['id']);
assertCondition("Driver exists and is APPROVED", $driver && $driver['approval_status'] === 'APPROVED');
assertCondition("Driver is ONLINE", $driver && (int)$driver['is_online'] === 1);

// Ensure driver has an active vehicle
$activeVeh = $driverModel->getActiveVehicle($driver['id']);
if (!$activeVeh) {
    $vehId = Security::generateUUID();
    dbExecute($pdo, "INSERT INTO `driver_vehicles` (`id`, `driver_id`, `vehicle_category_id`, `vehicle_model`, `vehicle_number`, `vehicle_type`, `color`, `is_active`, `is_approved`, `created_at`)
                     VALUES (?, ?, 2, 'Maruti Swift Dzire', 'TN 38 BR 1234', 'Sedan', 'White', 1, 'APPROVED', NOW())",
        array($vehId, $driver['id'])
    );
    $activeVeh = $driverModel->getActiveVehicle($driver['id']);
}
assertCondition("Driver has active approved vehicle", !empty($activeVeh));

// ---------------------------------------------------------
// STEP 2: Customer Account
// ---------------------------------------------------------
echo "\n--- Step 2: Customer Account ---\n";
$customerPhone = '9800232708';
$customer = $customerModel->findByPhone($customerPhone);
if (!$customer) {
    $custRes = $customerModel->register(array(
        'name' => 'Giri Customer',
        'phone' => $customerPhone,
        'email' => 'giri_e2e@test.com',
        'password' => password_hash('giri234', PASSWORD_BCRYPT)
    ));
    $customer = $customerModel->findByPhone($customerPhone);
}
assertCondition("Customer exists", !empty($customer));

// ---------------------------------------------------------
// STEP 3: Customer Creates Booking
// ---------------------------------------------------------
echo "\n--- Step 3: Customer Creates Booking ---\n";
$category = $bookingModel->findVehicleCategory('Red Sedan');
$estimate = $bookingModel->calculateFareEstimate($category, 11.5, 28, 1);

$bookingData = array(
    'city_id' => 1,
    'ride_type' => 'CITY',
    'vehicle_category' => $category['name'],
    'pickup' => array(
        'name' => 'Coimbatore Railway Station',
        'address' => 'Station Road, Gopalapuram, Coimbatore',
        'lat' => 11.0018,
        'lng' => 76.9629
    ),
    'drop' => array(
        'name' => 'Coimbatore International Airport',
        'address' => 'Airport Road, Civil Aerodrome Post, Peelamedu',
        'lat' => 11.0300,
        'lng' => 77.0434
    ),
    'distance_km' => 11.5,
    'duration_min' => 28,
    'payment_method' => 'CASH',
    'fare_breakdown' => $estimate,
);

$createRes = $bookingModel->createBooking($customer['id'], $bookingData);
assertCondition("Booking created successfully", !empty($createRes['id']));
$bookingId = $createRes['id'];
$startOtp = $createRes['start_otp'];

echo "Created Booking ID: $bookingId\n";
echo "Start OTP: $startOtp\n";

// Verify directly in MySQL
$dbBooking = dbFetchOne($pdo, "SELECT * FROM `bookings` WHERE `id` = ?", array($bookingId));
assertCondition("Booking found in MySQL", !empty($dbBooking));
assertCondition("Booking initial status is SEARCHING", $dbBooking['status'] === 'SEARCHING');
assertCondition("Customer ID matches", $dbBooking['customer_id'] === $customer['id']);
assertCondition("Start OTP matches", $dbBooking['start_otp'] === $startOtp);

// ---------------------------------------------------------
// STEP 4: Admin Views and Assigns Driver
// ---------------------------------------------------------
echo "\n--- Step 4: Admin Views & Assigns Driver ---\n";
$adminBooking = $adminModel->getBookingDetail($bookingId);
assertCondition("Admin can retrieve the exact same booking record", $adminBooking && $adminBooking['id'] === $bookingId);
assertCondition("Admin sees customer name", !empty($adminBooking['customer_name']));
assertCondition("Admin sees SEARCHING status", $adminBooking['status'] === 'SEARCHING');

// Admin assigns driver
$assignRes = $adminModel->assignDriver($bookingId, $driver['id']);
assertCondition("Admin driver assignment succeeded", !empty($assignRes['success']));

$assignedBooking = dbFetchOne($pdo, "SELECT status, driver_id FROM `bookings` WHERE `id` = ?", array($bookingId));
assertCondition("MySQL booking status updated to ASSIGNED", $assignedBooking['status'] === 'ASSIGNED');
assertCondition("MySQL driver_id matches Karthik Raja", $assignedBooking['driver_id'] === $driver['id']);

// ---------------------------------------------------------
// STEP 5: Driver Receives & Accepts Ride
// ---------------------------------------------------------
echo "\n--- Step 5: Driver Receives & Accepts ---\n";
// Available rides includes assigned ride
$availRides = $driverModel->getAvailableRides($driver['id'], 1);
$foundInAvail = false;
foreach ($availRides as $ar) {
    if ($ar['id'] === $bookingId) {
        $foundInAvail = true;
        break;
    }
}
assertCondition("Driver receives assigned ride in available rides", $foundInAvail);

// Driver accepts ride -> moves to EN_ROUTE
$acceptRes = $driverModel->acceptRide($driver['id'], $bookingId);
assertCondition("Driver accepts ride", !empty($acceptRes) && empty($acceptRes['error']));

$enRouteBooking = dbFetchOne($pdo, "SELECT status FROM `bookings` WHERE `id` = ?", array($bookingId));
assertCondition("MySQL booking status is EN_ROUTE", $enRouteBooking['status'] === 'EN_ROUTE');

// ---------------------------------------------------------
// STEP 6: Driver Arrived at Pickup
// ---------------------------------------------------------
echo "\n--- Step 6: Driver Arrived at Pickup ---\n";
$arrivedRes = $driverModel->updateRideStatus($driver['id'], $bookingId, 'ARRIVED');
assertCondition("Driver transitions status to ARRIVED", !empty($arrivedRes) && empty($arrivedRes['error']));

$arrivedBooking = dbFetchOne($pdo, "SELECT status FROM `bookings` WHERE `id` = ?", array($bookingId));
assertCondition("MySQL booking status is ARRIVED", $arrivedBooking['status'] === 'ARRIVED');

// ---------------------------------------------------------
// STEP 7: Status Transition Guards (Error Testing)
// ---------------------------------------------------------
echo "\n--- Step 7: Error Testing & Validation Guards ---\n";
// Cannot complete before starting
$earlyComplete = $driverModel->updateRideStatus($driver['id'], $bookingId, 'COMPLETED');
assertCondition("Cannot complete ride before starting", isset($earlyComplete['error']));

// Cannot start without OTP
$noOtpStart = $driverModel->updateRideStatus($driver['id'], $bookingId, 'STARTED', '');
assertCondition("Cannot start ride without OTP", isset($noOtpStart['error']));

// Cannot start with incorrect OTP
$wrongOtpStart = $driverModel->updateRideStatus($driver['id'], $bookingId, 'STARTED', '9999');
assertCondition("Cannot start ride with wrong OTP", isset($wrongOtpStart['error']));

// Another driver cannot modify this ride
$otherDriverStart = $driverModel->updateRideStatus('some-other-driver-uuid', $bookingId, 'STARTED', $startOtp);
assertCondition("Other driver cannot modify this ride", isset($otherDriverStart['error']));

// ---------------------------------------------------------
// STEP 8: Driver Starts Ride with Correct OTP
// ---------------------------------------------------------
echo "\n--- Step 8: Driver Starts Ride ---\n";
$startRes = $driverModel->updateRideStatus($driver['id'], $bookingId, 'STARTED', $startOtp);
assertCondition("Driver starts ride with real OTP", !empty($startRes) && empty($startRes['error']));

$startedBooking = dbFetchOne($pdo, "SELECT status, started_at FROM `bookings` WHERE `id` = ?", array($bookingId));
assertCondition("MySQL booking status is IN_PROGRESS", $startedBooking['status'] === 'IN_PROGRESS');
assertCondition("started_at timestamp recorded", !empty($startedBooking['started_at']));

// ---------------------------------------------------------
// STEP 9: Driver Completes Ride
// ---------------------------------------------------------
echo "\n--- Step 9: Driver Completes Ride ---\n";
$completeRes = $driverModel->updateRideStatus($driver['id'], $bookingId, 'COMPLETED');
assertCondition("Driver completes ride", !empty($completeRes) && empty($completeRes['error']));
assertCondition("Earnings returned in response", !empty($completeRes['driver_earnings']));

$completedBooking = dbFetchOne($pdo, "SELECT status, payment_status, completed_at FROM `bookings` WHERE `id` = ?", array($bookingId));
assertCondition("MySQL booking status is COMPLETED", $completedBooking['status'] === 'COMPLETED');
assertCondition("MySQL payment_status is PAID", $completedBooking['payment_status'] === 'PAID');
assertCondition("completed_at timestamp recorded", !empty($completedBooking['completed_at']));

// Verify payment record in MySQL
$payment = dbFetchOne($pdo, "SELECT * FROM `payments` WHERE `booking_id` = ?", array($bookingId));
assertCondition("Payment record created in MySQL", !empty($payment) && $payment['status'] === 'SUCCESS');

// Verify driver wallet updated
$wallet = $driverModel->getWalletDetails($driver['id']);
assertCondition("Driver wallet balance updated", (float)$wallet['balance'] > 0);

// ---------------------------------------------------------
// STEP 10: Customer Submits 1-5 Star Rating & Review
// ---------------------------------------------------------
echo "\n--- Step 10: Customer Rating & Review ---\n";
// Attempt duplicate or invalid ratings
$invalidRating = $bookingModel->rateBooking($bookingId, $customer['id'], 6, 'Too high');
assertCondition("Invalid star rating (6 stars) rejected", isset($invalidRating['error']));

// Valid rating
$rateRes = $bookingModel->rateBooking($bookingId, $customer['id'], 5, 'Exceptional ride, very clean cab and punctual!');
assertCondition("Customer submits 5-star rating and review", !empty($rateRes) && empty($rateRes['error']));

// Verify rating saved in MySQL
$ratedBooking = dbFetchOne($pdo, "SELECT rating, review_text FROM `bookings` WHERE `id` = ?", array($bookingId));
assertCondition("MySQL booking rating is 5", (int)$ratedBooking['rating'] === 5);
assertCondition("MySQL review_text matches", strpos($ratedBooking['review_text'], 'Exceptional') !== false);

// Attempt duplicate rating
$dupRating = $bookingModel->rateBooking($bookingId, $customer['id'], 5, 'Second attempt');
assertCondition("Duplicate rating rejected by backend", isset($dupRating['error']));

// ---------------------------------------------------------
// STEP 11: Customer and Driver Ride History
// ---------------------------------------------------------
echo "\n--- Step 11: History Verification ---\n";
$customerHistory = $bookingModel->getCustomerBookings($customer['id'], null, 10, 0);
$foundInCustomerHistory = false;
foreach ($customerHistory as $ch) {
    if ($ch['id'] === $bookingId) {
        $foundInCustomerHistory = true;
        assertCondition("Customer history contains completed booking", $ch['status'] === 'COMPLETED');
        assertCondition("Customer history contains 5-star rating", (int)$ch['rating'] === 5);
        break;
    }
}
assertCondition("Completed booking found in Customer History", $foundInCustomerHistory);

$driverHistory = $driverModel->getRideHistory($driver['id'], 10, 0);
$foundInDriverHistory = false;
foreach ($driverHistory as $dh) {
    if ($dh['id'] === $bookingId) {
        $foundInDriverHistory = true;
        assertCondition("Driver history contains completed booking", $dh['status'] === 'COMPLETED');
        break;
    }
}
assertCondition("Completed booking found in Driver History", $foundInDriverHistory);

// ---------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------
echo "\n========================================================\n";
echo "TEST RESULTS: $testPassed PASSED, $testFailed FAILED\n";
echo "========================================================\n";

if ($testFailed === 0) {
    echo "ALL PHASE 5 BACKEND E2E CHECKS PASSED!\n";
    exit(0);
} else {
    echo "SOME E2E CHECKS FAILED!\n";
    exit(1);
}
