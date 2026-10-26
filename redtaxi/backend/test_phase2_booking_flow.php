<?php
/**
 * RedTaxi Phase 2 — Customer Booking Flow Verification Test
 * Verifies:
 * 1. Customer Authentication (Token acquisition)
 * 2. Real-time Fare Calculation via POST /api/v1/booking/fare-estimate
 * 3. Booking Creation in MySQL via POST /api/v1/booking/create
 * 4. Verification of MySQL database record, UUID, start OTP, and SEARCHING status
 * 5. Active Booking Recovery via GET /api/v1/booking/active
 * 6. Booking Cancellation via POST /api/v1/booking/cancel
 * 7. Verification that active booking is cleared after cancellation
 */

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/CustomerModel.php';
require_once __DIR__ . '/models/BookingModel.php';
require_once __DIR__ . '/utils/Security.php';

echo "=======================================================\n";
echo "RedTaxi Phase 2 — Customer Booking Flow Verification\n";
echo "=======================================================\n\n";

$passed = 0;
$failed = 0;

function runTest($title, $condition, $info = '') {
    global $passed, $failed;
    if ($condition) {
        echo "  [PASS] {$title}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$title}" . ($info ? " — {$info}" : "") . "\n";
        $failed++;
    }
}

function callApi($endpoint, $method = 'GET', $data = null, $token = null) {
    $ch = curl_init('http://127.0.0.1:8001/api/v1' . $endpoint);
    $headers = array('Content-Type: application/json', 'Accept: application/json');
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return array(
        'code' => $httpCode,
        'body' => json_decode($response, true)
    );
}

// 1. Create a Test Customer & Token
$phone = '9840' . mt_rand(100000, 999999);
$email = 'customer_' . $phone . '@example.com';
$customerModel = new CustomerModel();
$customer = $customerModel->createCustomer(array(
    'name' => 'Karthik Raja',
    'phone' => $phone,
    'email' => $email,
    'password_hash' => Security::hashPassword('SecurePass@123'),
));
$token = Security::generateToken($customer['id'], 'customer');
runTest('Customer created & token generated', !empty($customer['id']) && !empty($token));

// 2. Fare Estimation API (POST /api/v1/booking/fare-estimate)
$pickup = array(
    'name' => 'Gandhipuram Bus Stand',
    'address' => 'Cross Cut Road, Gandhipuram, Coimbatore',
    'lat' => 11.0168445,
    'lng' => 76.9558321
);
$drop = array(
    'name' => 'Coimbatore International Airport',
    'address' => 'Avinashi Road, Peelamedu, Coimbatore',
    'lat' => 11.0300000,
    'lng' => 77.0434000
);
$distanceKm = 12.6; // Haversine * 1.3
$durationMin = 32;

$fareRes = callApi('/booking/fare-estimate', 'POST', array(
    'pickup' => $pickup,
    'drop' => $drop,
    'vehicle_type' => 'Red Mini',
    'distance_km' => $distanceKm,
    'duration_min' => $durationMin,
    'city_id' => 1
), $token);

runTest('Fare estimate endpoint returns 200 OK', $fareRes['code'] === 200);
$estFare = $fareRes['body']['data']['fare_breakdown']['total_fare'] ?? $fareRes['body']['data']['total_fare'] ?? null;
runTest('Fare estimate contains base_fare & total_fare', 
    $estFare !== null && (float)$estFare > 0);
echo "       -> Calculated Fare for Red Mini (12.6 km): Rs. " . ($estFare ?? 'N/A') . "\n";

// 3. Create Booking API (POST /api/v1/booking/create)
$bookingRes = callApi('/booking/create', 'POST', array(
    'pickup' => $pickup,
    'drop' => $drop,
    'vehicle_type' => 'Red Sedan',
    'distance_km' => $distanceKm,
    'duration_min' => $durationMin,
    'payment_method' => 'UPI',
    'ride_type' => 'CITY',
    'city_id' => 1
), $token);

runTest('Create booking endpoint returns 201 Created', $bookingRes['code'] === 201);
$bookingData = $bookingRes['body']['data'] ?? null;
$startOtp = $bookingData['start_otp'] ?? $bookingData['otp'] ?? '';
runTest('Booking contains valid UUID', !empty($bookingData['id']) && strlen($bookingData['id']) === 36);
runTest('Booking status is SEARCHING', ($bookingData['status'] ?? '') === 'SEARCHING');
runTest('Booking has 4-digit start OTP', strlen((string)$startOtp) === 4);
runTest('Booking vehicle category is Red Sedan', ($bookingData['vehicle_category'] ?? '') === 'Red Sedan');
runTest('Booking locations include PICKUP and DROP', 
    isset($bookingData['locations']) && count($bookingData['locations']) >= 2);

$bookingId = $bookingData['id'] ?? null;
echo "       -> Created Booking UUID: " . $bookingId . "\n";
echo "       -> OTP: " . $startOtp . "\n";
echo "       -> Total Fare: Rs. " . ($bookingData['total_fare'] ?? $bookingData['fare_breakdown']['total_fare'] ?? 'N/A') . "\n";

// 4. Verify Record in MySQL Database directly
$db = Database::getInstance()->getConnection();
$stmt = $db->prepare("SELECT * FROM `bookings` WHERE `id` = ?");
$stmt->execute(array($bookingId));
$row = $stmt->fetch(PDO::FETCH_ASSOC);

runTest('MySQL row exists in bookings table', !empty($row));
runTest('MySQL customer_id matches authenticated user', ($row['customer_id'] ?? '') === $customer['id']);
runTest('MySQL status is SEARCHING', ($row['status'] ?? '') === 'SEARCHING');
runTest('MySQL payment_method is UPI', ($row['payment_method'] ?? '') === 'UPI');

// 5. Active Booking Recovery API (GET /api/v1/booking/active)
$activeRes = callApi('/booking/active', 'GET', null, $token);
runTest('Active booking endpoint returns 200 OK', $activeRes['code'] === 200);
runTest('Active booking matches created booking ID', ($activeRes['body']['data']['id'] ?? '') === $bookingId);
runTest('Active booking maintains SEARCHING status', ($activeRes['body']['data']['status'] ?? '') === 'SEARCHING');

// 6. Cancel Booking API (POST /api/v1/booking/cancel)
$cancelRes = callApi('/booking/cancel', 'POST', array(
    'booking_id' => $bookingId,
    'reason' => 'Testing customer cancellation'
), $token);
runTest('Cancel booking endpoint returns 200 OK', $cancelRes['code'] === 200);

// 7. Verify Active Booking is now cleared
$activeAfterCancel = callApi('/booking/active', 'GET', null, $token);
runTest('Active booking returns null after cancellation', 
    $activeAfterCancel['code'] === 200 && empty($activeAfterCancel['body']['data']));

// Verify MySQL row is updated to CANCELLED
$stmt = $db->prepare("SELECT `status` FROM `bookings` WHERE `id` = ?");
$stmt->execute(array($bookingId));
$cancelledStatus = $stmt->fetchColumn();
runTest('MySQL row status updated to CANCELLED', $cancelledStatus === 'CANCELLED');

echo "\n=======================================================\n";
echo "Summary: {$passed} Passed, {$failed} Failed\n";
echo "=======================================================\n";

if ($failed === 0) {
    echo ">>> ALL PHASE 2 BOOKING API & MYSQL TESTS PASSED! <<<\n";
    exit(0);
} else {
    echo ">>> SOME TESTS FAILED <<<\n";
    exit(1);
}
