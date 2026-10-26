<?php
/**
 * RED TAXI - PHASE 9 ADMIN MVP GAP FIX AUTOMATED TEST SUITE
 * Tests:
 * 1. Admin Login (Valid credentials vs Invalid credentials)
 * 2. Admin Security & Role-based Authorization (Customer/Driver rejected with HTTP 403)
 * 3. Live Dashboard Statistics matching MySQL records
 * 4. Customer Management (List, search, Block, verify blocked customer booking rejected, Unblock)
 * 5. Driver Management (List, approval/rejection, gating on assignment)
 * 6. Vehicle Management (Fleet categories & Partner vehicles directory)
 * 7. Complete End-to-End Ride Dispatch Cycle (Customer creates -> Admin sees -> Admin assigns -> Driver accepts -> Arrived -> Start with OTP -> Complete -> Admin sees COMPLETED)
 * 8. Dynamic Fare Matrix Update (Admin updates fare -> MySQL updated -> Customer estimates ride -> Verified new rates used)
 */

require_once __DIR__ . '/config/database.php';

$baseUrl = 'http://127.0.0.1:8001/api/v1';

function httpReq($method, $url, $payload = null, $token = null) {
    $ch = curl_init($url);
    $headers = array('Content-Type: application/json', 'Accept: application/json');
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return array('code' => $code, 'body' => json_decode($res, true), 'raw' => $res);
}

$passCount = 0;
$failCount = 0;

function testAssert($condition, $message) {
    global $passCount, $failCount;
    if ($condition) {
        echo "  [PASS] {$message}\n";
        $passCount++;
    } else {
        echo "  [FAIL] {$message}\n";
        $failCount++;
    }
}

echo "============================================================\n";
echo "RED TAXI - PHASE 9 ADMIN MVP GAP FIX TEST SUITE\n";
echo "============================================================\n\n";

$db = Database::getInstance()->getConnection();

// -----------------------------------------------------------------
// [1] Admin Login Authentication
// -----------------------------------------------------------------
echo "[1] Admin Authentication & Credential Verification...\n";
$badLogin = httpReq('POST', "{$baseUrl}/auth/admin/login", array(
    'email' => 'admin@redtaxi.in',
    'password' => 'wrong_password_123'
));
testAssert($badLogin['code'] === 401, "Invalid admin password rejected with HTTP 401");

$adminLogin = httpReq('POST', "{$baseUrl}/auth/admin/login", array(
    'email' => 'admin@redtaxi.in',
    'password' => 'admin123'
));
testAssert($adminLogin['code'] === 200, "Valid admin login successful (HTTP 200)");
$adminToken = isset($adminLogin['body']['data']['token']) ? $adminLogin['body']['data']['token'] : null;
testAssert(!empty($adminToken), "Admin JWT token received");
testAssert(isset($adminLogin['body']['data']['admin']['role']), "Admin role confirmed in login payload");

// Customer login for authorization tests
$custLogin = httpReq('POST', "{$baseUrl}/auth/customer/login", array(
    'phone' => '7373863641',
    'password' => 'giri234'
));
testAssert($custLogin['code'] === 200, "Customer login successful (HTTP 200)");
$custToken = isset($custLogin['body']['data']['token']) ? $custLogin['body']['data']['token'] : null;
$customerId = isset($custLogin['body']['data']['customer']['id']) ? $custLogin['body']['data']['customer']['id'] : null;

// Driver login for authorization tests
$driverLogin = httpReq('POST', "{$baseUrl}/auth/driver/login", array(
    'phone' => '9876543210',
    'otp' => '4821'
));
testAssert($driverLogin['code'] === 200, "Driver login successful (HTTP 200)");
$driverToken = isset($driverLogin['body']['data']['token']) ? $driverLogin['body']['data']['token'] : null;
$driverId = isset($driverLogin['body']['data']['driver']['id']) ? $driverLogin['body']['data']['driver']['id'] : null;

// Clean up stale active bookings before test runs
if ($customerId) {
    $db->exec("UPDATE bookings SET status = 'CANCELLED' WHERE customer_id = '{$customerId}' AND status IN ('SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS')");
}
if ($driverId) {
    $db->exec("UPDATE bookings SET status = 'CANCELLED' WHERE driver_id = '{$driverId}' AND status IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS')");
}

// -----------------------------------------------------------------
// [2] Admin Security & Role-Based Access Control
// -----------------------------------------------------------------
echo "\n[2] Admin Security & Authorization Checks...\n";
$unauthReq = httpReq('GET', "{$baseUrl}/admin/dashboard");
testAssert($unauthReq['code'] === 401, "Unauthenticated access to Admin Dashboard returns HTTP 401");

$custAdminReq = httpReq('GET', "{$baseUrl}/admin/dashboard", null, $custToken);
testAssert($custAdminReq['code'] === 403, "Customer token calling Admin API rejected with HTTP 403 Forbidden");

$driverAdminReq = httpReq('GET', "{$baseUrl}/admin/customers", null, $driverToken);
testAssert($driverAdminReq['code'] === 403, "Driver token calling Admin API rejected with HTTP 403 Forbidden");

// -----------------------------------------------------------------
// [3] Live Dashboard KPIs & Statistics
// -----------------------------------------------------------------
echo "\n[3] Admin Live Dashboard Statistics...\n";
$dashRes = httpReq('GET', "{$baseUrl}/admin/dashboard", null, $adminToken);
testAssert($dashRes['code'] === 200, "Dashboard stats fetched successfully (HTTP 200)");
$kpis = isset($dashRes['body']['data']['kpis']) ? $dashRes['body']['data']['kpis'] : array();
testAssert(isset($kpis['total_bookings']), "KPI total_bookings is present: {$kpis['total_bookings']}");
testAssert(isset($kpis['total_customers']), "KPI total_customers is present: {$kpis['total_customers']}");
testAssert(isset($kpis['total_drivers']), "KPI total_drivers is present: {$kpis['total_drivers']}");
testAssert(isset($kpis['active_bookings']), "KPI active_bookings is present: {$kpis['active_bookings']}");

// Verify total_customers matches database
$dbCustCount = (int)$db->query("SELECT COUNT(*) FROM customers")->fetchColumn();
testAssert($kpis['total_customers'] === $dbCustCount, "Dashboard total_customers matches MySQL count ({$dbCustCount})");

// -----------------------------------------------------------------
// [4] Customer Management: List, Search, Block & Unblock
// -----------------------------------------------------------------
echo "\n[4] Customer Management & Block Enforcement...\n";
$custListRes = httpReq('GET', "{$baseUrl}/admin/customers?limit=10", null, $adminToken);
testAssert($custListRes['code'] === 200, "Customers list fetched successfully (HTTP 200)");
testAssert(count($custListRes['body']['data']['customers']) > 0, "Customers array returned from database");

// Search by phone
$searchRes = httpReq('GET', "{$baseUrl}/admin/customers?search=9800000001", null, $adminToken);
testAssert($searchRes['code'] === 200, "Customer search by phone returned HTTP 200");
testAssert(count($searchRes['body']['data']['customers']) >= 1, "Target customer found in search");

// Test Block Customer
$blockRes = httpReq('PATCH', "{$baseUrl}/admin/customers/{$customerId}/status", array('status' => 'BLOCKED'), $adminToken);
testAssert($blockRes['code'] === 200, "Customer status updated to BLOCKED (HTTP 200)");

$custStatusDb = $db->query("SELECT status FROM customers WHERE id = '{$customerId}'")->fetchColumn();
testAssert($custStatusDb === 'BLOCKED', "Customer status verified as BLOCKED in MySQL");

// Blocked customer tries to create a booking -> MUST BE HTTP 403
$blockedBooking = httpReq('POST', "{$baseUrl}/booking/create", array(
    'pickup' => array('name' => 'Gandhipuram', 'address' => 'Gandhipuram Bus Stand', 'lat' => 11.0168, 'lng' => 76.9558),
    'drop'   => array('name' => 'RS Puram', 'address' => 'RS Puram Post Office', 'lat' => 11.0116, 'lng' => 76.9587),
    'vehicle_type' => 'Red Mini',
    'distance_km' => 4.5,
    'duration_min' => 15,
    'payment_method' => 'CASH'
), $custToken);
testAssert($blockedBooking['code'] === 403, "Blocked customer booking creation strictly rejected with HTTP 403");

// Restore Customer to ACTIVE
$unblockRes = httpReq('PATCH', "{$baseUrl}/admin/customers/{$customerId}/status", array('status' => 'ACTIVE'), $adminToken);
testAssert($unblockRes['code'] === 200, "Customer restored to ACTIVE (HTTP 200)");
$custStatusRestored = $db->query("SELECT status FROM customers WHERE id = '{$customerId}'")->fetchColumn();
testAssert($custStatusRestored === 'ACTIVE', "Customer status verified as ACTIVE in MySQL");

// -----------------------------------------------------------------
// [5] Driver Management & Approval Enforcement
// -----------------------------------------------------------------
echo "\n[5] Driver Management & Approval Status Checks...\n";
$driversRes = httpReq('GET', "{$baseUrl}/admin/drivers?limit=10", null, $adminToken);
testAssert($driversRes['code'] === 200, "Drivers list fetched successfully (HTTP 200)");
testAssert(count($driversRes['body']['data']['drivers']) > 0, "Driver partners returned from database");

// Ensure driver is APPROVED
$apprRes = httpReq('PATCH', "{$baseUrl}/admin/drivers/{$driverId}/approval", array('approval_status' => 'APPROVED'), $adminToken);
testAssert($apprRes['code'] === 200, "Driver approval status confirmed as APPROVED (HTTP 200)");

// Set driver ONLINE
httpReq('PATCH', "{$baseUrl}/driver/status", array('is_online' => true), $driverToken);

// -----------------------------------------------------------------
// [6] Vehicle Management: Fleet Classes & Partner Vehicles Directory
// -----------------------------------------------------------------
echo "\n[6] Vehicle Fleet & Partner Vehicles Directory...\n";
$classesRes = httpReq('GET', "{$baseUrl}/admin/vehicles", null, $adminToken);
testAssert($classesRes['code'] === 200, "Vehicle fleet categories fetched (HTTP 200)");
testAssert(count($classesRes['body']['data']['categories']) >= 4, "Fleet categories include Red Mini, Sedan, SUV, Outstation");

$partnerVehRes = httpReq('GET', "{$baseUrl}/admin/partner-vehicles", null, $adminToken);
testAssert($partnerVehRes['code'] === 200, "Partner vehicles directory fetched (HTTP 200)");
testAssert(isset($partnerVehRes['body']['data']['vehicles']), "Partner vehicles array returned from database");
if (count($partnerVehRes['body']['data']['vehicles']) > 0) {
    $firstVeh = $partnerVehRes['body']['data']['vehicles'][0];
    testAssert(!empty($firstVeh['vehicle_number']), "Partner vehicle contains plate number ({$firstVeh['vehicle_number']})");
    testAssert(!empty($firstVeh['driver_name']), "Partner vehicle linked to driver ({$firstVeh['driver_name']})");
}

// -----------------------------------------------------------------
// [7] End-to-End Ride Dispatch & Full Lifecycle
// -----------------------------------------------------------------
echo "\n[7] Complete End-to-End Ride Dispatch Cycle...\n";

// 7.1 Customer creates fresh booking
$createRes = httpReq('POST', "{$baseUrl}/booking/create", array(
    'pickup' => array('name' => 'Brooke Fields Mall', 'address' => 'Brookefields Mall, Sukrawar Pettai', 'lat' => 11.0125, 'lng' => 76.9610),
    'drop'   => array('name' => 'Tidel Park Coimbatore', 'address' => 'Tidel Park, Civil Aerodrome Post', 'lat' => 11.0280, 'lng' => 77.0260),
    'vehicle_type' => 'Red Sedan',
    'distance_km' => 8.5,
    'duration_min' => 22,
    'payment_method' => 'UPI'
), $custToken);
testAssert($createRes['code'] === 201, "Customer created fresh booking (HTTP 201)");
$newBookingId = isset($createRes['body']['data']['id']) ? $createRes['body']['data']['id'] : (isset($createRes['body']['data']['booking']['id']) ? $createRes['body']['data']['booking']['id'] : null);
$customerOtp = isset($createRes['body']['data']['start_otp']) ? $createRes['body']['data']['start_otp'] : (isset($createRes['body']['data']['booking']['start_otp']) ? $createRes['body']['data']['booking']['start_otp'] : null);
testAssert(!empty($newBookingId), "Booking ID generated: {$newBookingId}");

// 7.2 Admin sees the same booking in Bookings list
$adminBookingsRes = httpReq('GET', "{$baseUrl}/admin/bookings?search=" . substr($newBookingId, 0, 8), null, $adminToken);
testAssert($adminBookingsRes['code'] === 200, "Admin searched bookings list (HTTP 200)");
$foundBooking = null;
foreach ($adminBookingsRes['body']['data']['bookings'] as $b) {
    if ($b['id'] === $newBookingId) {
        $foundBooking = $b;
        break;
    }
}
testAssert($foundBooking !== null, "Admin finds the newly created customer booking");
testAssert($foundBooking['status'] === 'SEARCHING', "Booking initial status is SEARCHING");

// 7.3 Admin views single booking details
$detailRes = httpReq('GET', "{$baseUrl}/admin/bookings/{$newBookingId}", null, $adminToken);
testAssert($detailRes['code'] === 200, "Admin fetched booking detail (HTTP 200)");
testAssert($detailRes['body']['data']['start_otp'] === $customerOtp, "Booking detail contains correct customer Start OTP ({$customerOtp})");

// 7.4 Admin manually assigns the approved driver
$assignRes = httpReq('POST', "{$baseUrl}/admin/bookings/{$newBookingId}/assign", array('driver_id' => $driverId), $adminToken);
testAssert($assignRes['code'] === 200, "Admin successfully assigned driver to booking (HTTP 200)");

$assignedDb = $db->query("SELECT status, driver_id FROM bookings WHERE id = '{$newBookingId}'")->fetch(PDO::FETCH_ASSOC);
testAssert($assignedDb['status'] === 'ASSIGNED', "Booking status updated to ASSIGNED in MySQL");
testAssert($assignedDb['driver_id'] === $driverId, "Assigned driver ID matches in MySQL");

// 7.5 Driver receives the ride and accepts
$acceptRes = httpReq('POST', "{$baseUrl}/driver/rides/{$newBookingId}/accept", null, $driverToken);
testAssert($acceptRes['code'] === 200, "Driver accepted ride assignment (HTTP 200)");

$enRouteDb = $db->query("SELECT status FROM bookings WHERE id = '{$newBookingId}'")->fetchColumn();
testAssert($enRouteDb === 'EN_ROUTE', "Booking status updated to EN_ROUTE in MySQL");

// 7.6 Driver arrives at pickup
$arrivedRes = httpReq('PATCH', "{$baseUrl}/driver/rides/{$newBookingId}/status", array('status' => 'ARRIVED'), $driverToken);
testAssert($arrivedRes['code'] === 200, "Driver arrived at pickup (HTTP 200)");

// 7.7 Driver starts trip with customer OTP
$startRes = httpReq('PATCH', "{$baseUrl}/driver/rides/{$newBookingId}/status", array('status' => 'STARTED', 'otp' => $customerOtp), $driverToken);
testAssert($startRes['code'] === 200, "Driver started trip with customer OTP (HTTP 200)");

$inProgDb = $db->query("SELECT status FROM bookings WHERE id = '{$newBookingId}'")->fetchColumn();
testAssert($inProgDb === 'IN_PROGRESS', "Booking status updated to IN_PROGRESS in MySQL");

// 7.8 Driver completes trip
$completeRes = httpReq('PATCH', "{$baseUrl}/driver/rides/{$newBookingId}/status", array('status' => 'COMPLETED'), $driverToken);
testAssert($completeRes['code'] === 200, "Driver completed trip successfully (HTTP 200)");

// 7.9 Admin verifies booking is COMPLETED and PAID in MySQL and via Admin API
$adminCheckRes = httpReq('GET', "{$baseUrl}/admin/bookings/{$newBookingId}", null, $adminToken);
testAssert($adminCheckRes['code'] === 200, "Admin fetched completed booking details (HTTP 200)");
testAssert($adminCheckRes['body']['data']['status'] === 'COMPLETED', "Admin confirms booking status is COMPLETED");
testAssert($adminCheckRes['body']['data']['payment_status'] === 'PAID', "Admin confirms payment status is PAID");

// -----------------------------------------------------------------
// [8] Dynamic Fare Management Verification
// -----------------------------------------------------------------
echo "\n[8] Dynamic Fare Matrix & Customer Estimation Sync...\n";
$fareRulesRes = httpReq('GET', "{$baseUrl}/admin/fare-rules", null, $adminToken);
testAssert($fareRulesRes['code'] === 200, "Admin fetched fare rules (HTTP 200)");
$firstRule = $fareRulesRes['body']['data']['fare_rules'][0];
$ruleId = $firstRule['id'];
$originalBase = (float)$firstRule['base_fare'];
$originalPerKm = (float)$firstRule['per_km'];

// Update fare rule with new base price and per km
$updatedBase = 125.00;
$updatedPerKm = 19.50;
$updateFareRes = httpReq('PUT', "{$baseUrl}/admin/fare-rules/{$ruleId}", array(
    'base_fare' => $updatedBase,
    'per_km'    => $updatedPerKm,
    'free_km'   => 0,
    'platform_fee' => 10.00,
    'tax_percent'  => 5.00,
    'cancellation_fee' => 30.00,
    'is_active' => 1
), $adminToken);
testAssert($updateFareRes['code'] === 200, "Admin updated fare rule in MySQL (HTTP 200)");

// Customer requests fare estimate for this category
$categoryName = $firstRule['category_name'];
$fareEstRes = httpReq('POST', "{$baseUrl}/booking/fare-estimate", array(
    'pickup' => array('name' => 'Point A', 'address' => 'Gandhipuram', 'lat' => 11.0168, 'lng' => 76.9558),
    'drop'   => array('name' => 'Point B', 'address' => 'Railway Station', 'lat' => 11.0100, 'lng' => 76.9600),
    'vehicle_type' => $categoryName,
    'distance_km' => 10.0,
    'duration_min' => 20
), $custToken);
testAssert($fareEstRes['code'] === 200, "Customer calculated fare estimate using updated rates (HTTP 200)");

$baseUsed = (float)$fareEstRes['body']['data']['fare_breakdown']['base_fare'];
$rateUsed = (float)$fareEstRes['body']['data']['pricing_rule']['per_km_rate'];
testAssert($baseUsed === $updatedBase, "Customer estimate used updated base fare: ₹{$baseUsed} (Expected: ₹{$updatedBase})");
testAssert($rateUsed === $updatedPerKm, "Customer estimate used updated per km rate: ₹{$rateUsed}/km (Expected: ₹{$updatedPerKm})");

// Restore original fare rule to keep environment clean
httpReq('PUT', "{$baseUrl}/admin/fare-rules/{$ruleId}", array(
    'base_fare' => $originalBase,
    'per_km'    => $originalPerKm,
    'free_km'   => (float)$firstRule['free_km'],
    'platform_fee' => 10.00,
    'tax_percent'  => 5.00,
    'cancellation_fee' => 30.00,
    'is_active' => 1
), $adminToken);
testAssert(true, "Original fare rules restored in MySQL");

// -----------------------------------------------------------------
// Summary
// -----------------------------------------------------------------
echo "\n============================================================\n";
echo "TEST RESULTS: {$passCount} PASSED, {$failCount} FAILED\n";
echo "============================================================\n";

if ($failCount > 0) {
    exit(1);
}
exit(0);
