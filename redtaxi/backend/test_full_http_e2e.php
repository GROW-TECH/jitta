<?php
/**
 * RedTaxi - Phase 5 Full HTTP E2E Verification across Real REST APIs
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
echo "RED TAXI - FULL HTTP REST API E2E FLOW VERIFICATION\n";
echo "========================================================\n\n";

// 1. Authenticate All 3 Roles
echo "1. Authenticating Roles...\n";
// Admin
$resAdmin = makeRequest('POST', '/auth/admin/login', array('email' => 'admin@redtaxi.in', 'password' => 'admin123'));
if ($resAdmin['code'] !== 200 || empty($resAdmin['data']['data']['token'])) {
    die("FAIL: Admin login failed: " . $resAdmin['raw'] . "\n");
}
$adminToken = $resAdmin['data']['data']['token'];
echo "   - Admin logged in. Token acquired.\n";

// Driver
$resDriver = makeRequest('POST', '/auth/driver/login', array('phone' => '9876543210', 'otp' => '4821'));
if ($resDriver['code'] !== 200 || empty($resDriver['data']['data']['token'])) {
    die("FAIL: Driver login failed: " . $resDriver['raw'] . "\n");
}
$driverToken = $resDriver['data']['data']['token'];
$driverId = $resDriver['data']['data']['driver']['id'];
echo "   - Driver logged in (ID: $driverId). Token acquired.\n";

// Driver Go Online
$resOnline = makeRequest('PATCH', '/driver/status', array('is_online' => 1, 'lat' => 11.0183, 'lng' => 76.9644), $driverToken);
echo "   - Driver set to Online (HTTP {$resOnline['code']}).\n";

// Customer
$resCust = makeRequest('POST', '/auth/customer/login', array('identifier' => '9800000001', 'password' => 'Pass123!'));
if ($resCust['code'] !== 200 || empty($resCust['data']['data']['token'])) {
    die("FAIL: Customer login failed: " . $resCust['raw'] . "\n");
}
$customerToken = $resCust['data']['data']['token'];
$customerId = $resCust['data']['data']['customer']['id'];
echo "   - Customer logged in (ID: $customerId). Token acquired.\n";

// 2. Customer creates booking
echo "\n2. Customer Creating Booking via POST /booking/create...\n";
$bookingPayload = array(
    'pickup' => array(
        'name' => 'Gandhipuram Central Bus Stand',
        'address' => 'Cross Cut Road, Gandhipuram, Coimbatore',
        'lat' => 11.0183,
        'lng' => 76.9644
    ),
    'drop' => array(
        'name' => 'Coimbatore Airport (CJB)',
        'address' => 'Peelamedu, Coimbatore',
        'lat' => 11.0300,
        'lng' => 77.0434
    ),
    'vehicle_type' => 'Red Sedan',
    'distance_km' => 9.2,
    'duration_min' => 22,
    'payment_method' => 'CASH',
    'ride_type' => 'CITY',
    'city_id' => 1
);
$resCreate = makeRequest('POST', '/booking/create', $bookingPayload, $customerToken);
if ($resCreate['code'] !== 201 || empty($resCreate['data']['data']['id'])) {
    die("FAIL: Customer create booking failed: " . $resCreate['raw'] . "\n");
}
$booking = $resCreate['data']['data'];
$bookingId = $booking['id'];
$startOtp = $booking['start_otp'];
echo "   - Booking Created: ID = $bookingId\n";
echo "   - Start OTP = $startOtp\n";
echo "   - Status = {$booking['status']}\n";

// 3. Customer checks active booking
echo "\n3. Customer Polls Active Booking (GET /booking/active)...\n";
$resActive1 = makeRequest('GET', '/booking/active', null, $customerToken);
echo "   - Status: " . ($resActive1['data']['data']['status'] ?? 'NONE') . " (Expected: SEARCHING)\n";
if (($resActive1['data']['data']['status'] ?? '') !== 'SEARCHING') {
    die("FAIL: Expected SEARCHING status\n");
}

// 4. Admin sees booking and assigns driver
echo "\n4. Admin Views Booking and Assigns Driver via POST /admin/bookings/{id}/assign...\n";
$resAssign = makeRequest('POST', "/admin/bookings/$bookingId/assign", array('driver_id' => $driverId), $adminToken);
if ($resAssign['code'] !== 200 || empty($resAssign['data']['success'])) {
    die("FAIL: Admin assign driver failed: " . $resAssign['raw'] . "\n");
}
echo "   - Admin assigned Driver $driverId to Booking $bookingId successfully.\n";

// 5. Customer polls active booking -> ASSIGNED
echo "\n5. Customer Polls Active Booking -> should be ASSIGNED...\n";
$resActive2 = makeRequest('GET', '/booking/active', null, $customerToken);
echo "   - Status: " . ($resActive2['data']['data']['status'] ?? 'NONE') . "\n";
echo "   - Assigned Driver: " . ($resActive2['data']['data']['driver']['name'] ?? 'NONE') . "\n";
if (($resActive2['data']['data']['status'] ?? '') !== 'ASSIGNED') {
    die("FAIL: Expected ASSIGNED status\n");
}

// 6. Driver checks available rides
echo "\n6. Driver Checks Available Rides (GET /driver/rides/available)...\n";
$resAvail = makeRequest('GET', '/driver/rides/available', null, $driverToken);
$foundRide = false;
foreach ($resAvail['data']['data'] as $r) {
    if ($r['id'] === $bookingId) {
        $foundRide = true;
        break;
    }
}
echo "   - Driver found assigned ride in available list: " . ($foundRide ? "YES" : "NO") . "\n";

// 7. Driver accepts ride -> EN_ROUTE
echo "\n7. Driver Accepts Ride (POST /driver/rides/{id}/accept)...\n";
$resAccept = makeRequest('POST', "/driver/rides/$bookingId/accept", null, $driverToken);
if ($resAccept['code'] !== 200) {
    die("FAIL: Driver accept failed: " . $resAccept['raw'] . "\n");
}
echo "   - Ride accepted. Status is now: " . ($resAccept['data']['data']['status'] ?? 'UNKNOWN') . "\n";

// 8. Customer polls active booking -> EN_ROUTE
echo "\n8. Customer Polls Active Booking -> should be EN_ROUTE...\n";
$resActive3 = makeRequest('GET', '/booking/active', null, $customerToken);
echo "   - Customer sees Status: " . ($resActive3['data']['data']['status'] ?? 'NONE') . "\n";
if (($resActive3['data']['data']['status'] ?? '') !== 'EN_ROUTE') {
    die("FAIL: Expected EN_ROUTE status\n");
}

// 9. Driver arrives at pickup
echo "\n9. Driver Updates Status to ARRIVED (PATCH /driver/rides/{id}/status)...\n";
$resArrived = makeRequest('PATCH', "/driver/rides/$bookingId/status", array('status' => 'ARRIVED'), $driverToken);
if ($resArrived['code'] !== 200) {
    die("FAIL: Driver arrived status update failed: " . $resArrived['raw'] . "\n");
}
echo "   - Driver marked ARRIVED. Status: " . ($resArrived['data']['data']['status'] ?? '') . "\n";

// 10. Customer polls active booking -> ARRIVED
echo "\n10. Customer Polls Active Booking -> should be ARRIVED...\n";
$resActive4 = makeRequest('GET', '/booking/active', null, $customerToken);
echo "   - Customer sees Status: " . ($resActive4['data']['data']['status'] ?? 'NONE') . "\n";
echo "   - Customer Start OTP: " . ($resActive4['data']['data']['start_otp'] ?? '') . "\n";
if (($resActive4['data']['data']['status'] ?? '') !== 'ARRIVED') {
    die("FAIL: Expected ARRIVED status\n");
}

// 11. Driver starts ride with customer's OTP
echo "\n11. Driver Starts Ride with OTP (PATCH /driver/rides/{id}/status)...\n";
$resStarted = makeRequest('PATCH', "/driver/rides/$bookingId/status", array('status' => 'STARTED', 'otp' => $startOtp), $driverToken);
if ($resStarted['code'] !== 200) {
    die("FAIL: Driver start ride failed: " . $resStarted['raw'] . "\n");
}
echo "   - Driver started ride. Status: " . ($resStarted['data']['data']['status'] ?? '') . "\n";

// 12. Customer polls active booking -> IN_PROGRESS
echo "\n12. Customer Polls Active Booking -> should be IN_PROGRESS...\n";
$resActive5 = makeRequest('GET', '/booking/active', null, $customerToken);
echo "   - Customer sees Status: " . ($resActive5['data']['data']['status'] ?? 'NONE') . "\n";
if (($resActive5['data']['data']['status'] ?? '') !== 'IN_PROGRESS') {
    die("FAIL: Expected IN_PROGRESS status\n");
}

// 13. Driver completes ride
echo "\n13. Driver Completes Ride (PATCH /driver/rides/{id}/status)...\n";
$resComplete = makeRequest('PATCH', "/driver/rides/$bookingId/status", array('status' => 'COMPLETED'), $driverToken);
if ($resComplete['code'] !== 200) {
    die("FAIL: Driver complete ride failed: " . $resComplete['raw'] . "\n");
}
echo "   - Driver completed ride. Earnings: ₹" . ($resComplete['data']['data']['driver_earnings'] ?? '0') . "\n";

// 14. Customer polls active booking -> COMPLETED (unrated)
echo "\n14. Customer Polls Active Booking -> should be COMPLETED...\n";
$resActive6 = makeRequest('GET', '/booking/active', null, $customerToken);
echo "   - Customer sees Status: " . ($resActive6['data']['data']['status'] ?? 'NONE') . "\n";
if (($resActive6['data']['data']['status'] ?? '') !== 'COMPLETED') {
    die("FAIL: Expected COMPLETED status\n");
}

// 15. Customer submits 5-star rating & review
echo "\n15. Customer Rates Completed Ride (POST /booking/rate)...\n";
$ratePayload = array(
    'booking_id' => $bookingId,
    'rating' => 5,
    'review' => 'Excellent chauffeur, prompt arrival and very smooth ride!'
);
$resRate = makeRequest('POST', '/booking/rate', $ratePayload, $customerToken);
if ($resRate['code'] !== 200) {
    die("FAIL: Rate booking failed: " . $resRate['raw'] . "\n");
}
echo "   - Rating submitted: 5 stars. Message: " . ($resRate['data']['message'] ?? '') . "\n";

// 16. Customer History contains completed ride with 5 stars
echo "\n16. Verifying Customer History (GET /customer/bookings)...\n";
$resCustHistory = makeRequest('GET', '/customer/bookings', null, $customerToken);
$foundCustHistory = false;
foreach ($resCustHistory['data']['data'] as $b) {
    if ($b['id'] === $bookingId) {
        $foundCustHistory = true;
        echo "   - Found in Customer History: ID = {$b['id']}, Status = {$b['status']}, Rating = {$b['rating']}\n";
        break;
    }
}
if (!$foundCustHistory) {
    die("FAIL: Booking not found in Customer History\n");
}

// 17. Driver History contains completed ride
echo "\n17. Verifying Driver History (GET /driver/rides/history)...\n";
$resDriverHistory = makeRequest('GET', '/driver/rides/history', null, $driverToken);
$foundDriverHistory = false;
foreach ($resDriverHistory['data']['data'] as $b) {
    if ($b['id'] === $bookingId) {
        $foundDriverHistory = true;
        echo "   - Found in Driver History: ID = {$b['id']}, Status = {$b['status']}, Fare = ₹{$b['total_fare']}\n";
        break;
    }
}
if (!$foundDriverHistory) {
    die("FAIL: Booking not found in Driver History\n");
}

// 18. Admin verifies completed booking
echo "\n18. Admin Verifies Completed Booking (GET /admin/bookings/{id})...\n";
$resAdminDetail = makeRequest('GET', "/admin/bookings/$bookingId", null, $adminToken);
$ad = $resAdminDetail['data']['data'];
echo "   - Admin sees Booking: ID = {$ad['id']}, Status = {$ad['status']}, Rating = {$ad['rating']}, Driver = {$ad['driver_name']}\n";

echo "\n========================================================\n";
echo "SUCCESS: COMPLETE END-TO-END HTTP WORKFLOW VERIFIED!\n";
echo "========================================================\n";
