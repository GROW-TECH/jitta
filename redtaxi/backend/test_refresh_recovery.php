<?php
/**
 * RedTaxi - Phase 5 Refresh and Recovery Test at Every Stage
 */

function makeRequest($method, $path, $data = null, $token = null) {
    $url = 'http://127.0.0.1:8001/api/v1' . $path;
    $ch = curl_init($url);
    $headers = array('Content-Type: application/json', 'Accept: application/json');
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($data) ? $data : json_encode($data));
    }
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode($raw, true);
    return array('code' => $code, 'data' => $json, 'raw' => $raw);
}

echo "========================================================\n";
echo "RED TAXI - PHASE 5 REFRESH / RECOVERY VERIFICATION\n";
echo "========================================================\n\n";

$adminLogin = makeRequest('POST', '/auth/admin/login', array('email' => 'admin@redtaxi.in', 'password' => 'admin123'));
$adminToken = $adminLogin['data']['data']['token'];

$driverLogin = makeRequest('POST', '/auth/driver/login', array('phone' => '9876543210', 'otp' => '4821'));
$driverToken = $driverLogin['data']['data']['token'];
$driverId = $driverLogin['data']['data']['driver']['id'];

$custLogin = makeRequest('POST', '/auth/customer/login', array('identifier' => '9800000001', 'password' => 'Pass123!'));
$customerToken = $custLogin['data']['data']['token'];

// Create fresh booking
$create = makeRequest('POST', '/booking/create', array(
    'pickup' => array('name' => 'RS Puram', 'address' => 'DB Road, RS Puram, Coimbatore', 'lat' => 11.0116, 'lng' => 76.9500),
    'drop' => array('name' => 'Tidel Park', 'address' => 'Avinashi Road, Peelamedu, Coimbatore', 'lat' => 11.0250, 'lng' => 77.0120),
    'vehicle_type' => 'Red Sedan',
    'distance_km' => 7.8,
    'duration_min' => 18,
    'payment_method' => 'CASH',
    'ride_type' => 'CITY',
    'city_id' => 1
), $customerToken);
$bookingId = $create['data']['data']['id'];
$startOtp = $create['data']['data']['start_otp'];

// STAGE 1: After Booking Created (Simulate Customer Browser Refresh)
echo "Stage 1: Customer Refresh after Booking Creation (SEARCHING)...\n";
$c1 = makeRequest('GET', '/booking/active', null, $customerToken);
assert($c1['data']['data']['id'] === $bookingId, 'Booking ID recovered');
assert($c1['data']['data']['status'] === 'SEARCHING', 'Status is SEARCHING');
echo "  [PASS] Customer recovered active booking #$bookingId with status SEARCHING\n";

// STAGE 2: After Admin Assignment (Simulate Customer & Driver Refresh)
echo "\nStage 2: Refresh after Admin Assignment (ASSIGNED)...\n";
makeRequest('POST', "/admin/bookings/$bookingId/assign", array('driver_id' => $driverId), $adminToken);

$c2 = makeRequest('GET', '/booking/active', null, $customerToken);
assert($c2['data']['data']['status'] === 'ASSIGNED', 'Customer status is ASSIGNED');
assert($c2['data']['data']['driver']['id'] === $driverId, 'Customer sees assigned driver');
echo "  [PASS] Customer recovered booking in ASSIGNED status with assigned driver\n";

$d2 = makeRequest('GET', '/driver/rides/current', null, $driverToken);
assert($d2['data']['data']['id'] === $bookingId, 'Driver recovered assigned ride');
assert($d2['data']['data']['status'] === 'ASSIGNED', 'Driver sees status ASSIGNED');
echo "  [PASS] Driver recovered current ride #$bookingId in ASSIGNED status\n";

// STAGE 3: After Driver Acceptance (Simulate Refresh on EN_ROUTE)
echo "\nStage 3: Refresh after Driver Acceptance (EN_ROUTE)...\n";
makeRequest('POST', "/driver/rides/$bookingId/accept", null, $driverToken);

$c3 = makeRequest('GET', '/booking/active', null, $customerToken);
assert($c3['data']['data']['status'] === 'EN_ROUTE', 'Customer status is EN_ROUTE');
echo "  [PASS] Customer recovered booking in EN_ROUTE status\n";

$d3 = makeRequest('GET', '/driver/rides/current', null, $driverToken);
assert($d3['data']['data']['status'] === 'EN_ROUTE', 'Driver status is EN_ROUTE');
echo "  [PASS] Driver recovered booking in EN_ROUTE status\n";

// STAGE 4: After Driver Arrived (Simulate Refresh on ARRIVED)
echo "\nStage 4: Refresh after Driver Arrived (ARRIVED)...\n";
makeRequest('PATCH', "/driver/rides/$bookingId/status", array('status' => 'ARRIVED'), $driverToken);

$c4 = makeRequest('GET', '/booking/active', null, $customerToken);
assert($c4['data']['data']['status'] === 'ARRIVED', 'Customer status is ARRIVED');
assert($c4['data']['data']['start_otp'] === $startOtp, 'Customer Start OTP recovered');
echo "  [PASS] Customer recovered booking in ARRIVED status with OTP $startOtp\n";

$d4 = makeRequest('GET', '/driver/rides/current', null, $driverToken);
assert($d4['data']['data']['status'] === 'ARRIVED', 'Driver status is ARRIVED');
echo "  [PASS] Driver recovered booking in ARRIVED status\n";

// STAGE 5: During Trip (Simulate Refresh on IN_PROGRESS)
echo "\nStage 5: Refresh during Trip (IN_PROGRESS)...\n";
makeRequest('PATCH', "/driver/rides/$bookingId/status", array('status' => 'STARTED', 'otp' => $startOtp), $driverToken);

$c5 = makeRequest('GET', '/booking/active', null, $customerToken);
assert($c5['data']['data']['status'] === 'IN_PROGRESS', 'Customer status is IN_PROGRESS');
echo "  [PASS] Customer recovered active booking in IN_PROGRESS status\n";

$d5 = makeRequest('GET', '/driver/rides/current', null, $driverToken);
assert($d5['data']['data']['status'] === 'IN_PROGRESS', 'Driver status is IN_PROGRESS');
echo "  [PASS] Driver recovered active booking in IN_PROGRESS status\n";

// STAGE 6: After Trip Completed (Simulate Refresh on COMPLETED)
echo "\nStage 6: Refresh after Trip Completed (COMPLETED)...\n";
makeRequest('PATCH', "/driver/rides/$bookingId/status", array('status' => 'COMPLETED'), $driverToken);

$c6 = makeRequest('GET', '/booking/active', null, $customerToken);
assert($c6['data']['data']['status'] === 'COMPLETED', 'Customer status is COMPLETED');
echo "  [PASS] Customer recovered completed ride ready for rating\n";

$d6 = makeRequest('GET', '/driver/rides/current', null, $driverToken);
assert($d6['data']['data'] === null, 'Driver current ride is cleared');
echo "  [PASS] Driver current ride is null (cleared from active duty)\n";

$ad6 = makeRequest('GET', "/admin/bookings/$bookingId", null, $adminToken);
assert($ad6['data']['data']['status'] === 'COMPLETED', 'Admin sees COMPLETED');
echo "  [PASS] Admin verifies status is COMPLETED\n";

// STAGE 7: After Rating Submitted (Simulate Refresh after Review)
echo "\nStage 7: Refresh after Rating Submitted...\n";
makeRequest('POST', '/booking/rate', array('booking_id' => $bookingId, 'rating' => 5, 'review' => 'Great trip!'), $customerToken);

$c7 = makeRequest('GET', '/booking/active', null, $customerToken);
assert($c7['data']['data'] === null, 'Active booking is cleared after rating');
echo "  [PASS] Customer active booking is now null (completely cleared)\n";

$ch7 = makeRequest('GET', '/customer/bookings', null, $customerToken);
$foundInCustHist = false;
foreach ($ch7['data']['data'] as $b) {
    if ($b['id'] === $bookingId) {
        $foundInCustHist = true;
        assert((int)$b['rating'] === 5, 'Customer history has 5-star rating');
    }
}
assert($foundInCustHist, 'Found in Customer History');
echo "  [PASS] Booking persisted in Customer History with 5 stars\n";

echo "\n========================================================\n";
echo "ALL 7 REFRESH / RECOVERY STAGES SUCCESSFULLY VERIFIED!\n";
echo "========================================================\n";
