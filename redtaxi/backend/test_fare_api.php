<?php
/**
 * RedTaxi Fare Estimate API Automated Test Suite
 * Tests POST /api/v1/booking/fare-estimate:
 * - Customer authentication & role enforcement (401 / 403)
 * - Input validations (pickup, drop, vehicle type, distance, duration, city_id)
 * - Database pricing rules & vehicle categories lookup
 * - Exact breakdown calculation (base fare, distance fare, time fare, platform fee, tax, total)
 * - Short trips within free_km
 * - Case-insensitive category slugs ('mini', 'sedan', 'suv', 'outstation')
 * - Location formats (object, string, flat)
 * - Coupon discounts
 * - HTTP method restriction
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
echo "RedTaxi Fare Estimate API Test Suite (PHP 5.6+)\n";
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

    $runnerScript = tempnam(sys_get_temp_dir(), 'rt_fare_') . '.php';
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
// Setup Test Fixtures: Seed Database, Customer & Driver Tokens
// -------------------------------------------------------------
require_once __DIR__ . '/seed_fare_data.php';

$db = Database::getInstance()->getConnection();
$customerModel = new CustomerModel();
$driverModel = new DriverModel();

// Create primary test customer
$phone = '98005' . mt_rand(10000, 99999);
$customer = $customerModel->createCustomer(array(
    'name'  => 'Deepak Sharma',
    'phone' => $phone,
    'email' => 'deepak_' . $phone . '@example.com'
));
$customerToken = Security::generateToken($customer['id'], 'customer');

// Create driver partner for 403 test
$driverPhone = '98006' . mt_rand(10000, 99999);
$driver = $driverModel->createDriver(array(
    'name'           => 'Murugan K',
    'phone'          => $driverPhone,
    'vehicle_model'  => 'Maruti Swift Dzire',
    'vehicle_number' => 'TN 38 XY ' . mt_rand(1000, 9999)
));
$driverToken = Security::generateToken($driver['id'], 'driver');

// Optional: seed a sample coupon for testing coupon discounts
$couponStmt = $db->prepare("SELECT id FROM coupons WHERE code = 'SAVE50'");
$couponStmt->execute();
if (!$couponStmt->fetch()) {
    $insCoupon = $db->prepare("INSERT INTO coupons (id, code, discount_type, discount_amount, min_booking, max_discount, description, expiry_date, is_active)
                               VALUES ('cpn-save50', 'SAVE50', 'FLAT', 50.00, 200.00, 50.00, 'Flat 50 OFF', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1)");
    $insCoupon->execute();
}

// =============================================================
// Section 1: Authentication & Authorization Tests
// =============================================================
echo "1. Testing Authentication & Role Authorization...\n";

// 1A. Missing token -> 401
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram',
    'drop' => 'Peelamedu',
    'vehicle_type' => 'Red Mini',
    'distance_km' => 10,
    'duration_min' => 20
), null);
assertTest('Missing Bearer token returns 401 Unauthorized', isset($res['statusCode']) && $res['statusCode'] === 401);
assertTest('Error message clarifies token requirement', isset($res['message']) && strpos(strtolower($res['message']), 'token required') !== false);

// 1B. Invalid token -> 401
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram',
    'drop' => 'Peelamedu',
    'vehicle_type' => 'Red Mini',
    'distance_km' => 10,
    'duration_min' => 20
), 'invalid_token_xyz_123');
assertTest('Invalid Bearer token returns 401 Unauthorized', isset($res['statusCode']) && $res['statusCode'] === 401);

// 1C. Driver token -> 403
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram',
    'drop' => 'Peelamedu',
    'vehicle_type' => 'Red Mini',
    'distance_km' => 10,
    'duration_min' => 20
), $driverToken);
assertTest('Driver token returns 403 Forbidden (Customer required)', isset($res['statusCode']) && $res['statusCode'] === 403);
assertTest('Forbidden message notes customer access', isset($res['message']) && strpos(strtolower($res['message']), 'customer access required') !== false);

// =============================================================
// Section 2: Input Validation Tests (Negative & Edge Cases)
// =============================================================
echo "\n2. Testing Input Validation Rules (400 Bad Request)...\n";

// 2A. Empty request payload
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(), $customerToken);
assertTest('Empty payload returns 400 Bad Request', isset($res['statusCode']) && $res['statusCode'] === 400);

// 2B. Missing pickup location
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'drop' => 'Coimbatore Airport',
    'vehicle_type' => 'Red Mini',
    'distance_km' => 10,
    'duration_min' => 20
), $customerToken);
assertTest('Missing pickup returns 400 Bad Request', isset($res['statusCode']) && $res['statusCode'] === 400);
assertTest('Message indicates pickup location is required', isset($res['message']) && strpos(strtolower($res['message']), 'pickup') !== false);

// 2C. Missing drop location
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram Bus Stand',
    'vehicle_type' => 'Red Mini',
    'distance_km' => 10,
    'duration_min' => 20
), $customerToken);
assertTest('Missing drop returns 400 Bad Request', isset($res['statusCode']) && $res['statusCode'] === 400);
assertTest('Message indicates drop location is required', isset($res['message']) && strpos(strtolower($res['message']), 'drop') !== false);

// 2D. Missing vehicle type
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram',
    'drop' => 'Peelamedu',
    'distance_km' => 10,
    'duration_min' => 20
), $customerToken);
assertTest('Missing vehicle type returns 400 Bad Request', isset($res['statusCode']) && $res['statusCode'] === 400);
assertTest('Message indicates vehicle type is required', isset($res['message']) && strpos(strtolower($res['message']), 'vehicle type') !== false);

// 2E. Invalid vehicle type
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram',
    'drop' => 'Peelamedu',
    'vehicle_type' => 'RocketShip Luxury',
    'distance_km' => 10,
    'duration_min' => 20
), $customerToken);
assertTest('Invalid vehicle type returns 400 Bad Request', isset($res['statusCode']) && $res['statusCode'] === 400);
assertTest('Error includes available category suggestions', isset($res['errors']['available_categories']) && count($res['errors']['available_categories']) >= 4);

// 2F. Missing distance
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram',
    'drop' => 'Peelamedu',
    'vehicle_type' => 'Red Mini',
    'duration_min' => 20
), $customerToken);
assertTest('Missing distance_km returns 400 Bad Request', isset($res['statusCode']) && $res['statusCode'] === 400);

// 2G. Non-numeric distance
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram',
    'drop' => 'Peelamedu',
    'vehicle_type' => 'Red Mini',
    'distance_km' => 'ten_kilometers',
    'duration_min' => 20
), $customerToken);
assertTest('Non-numeric distance returns 400 Bad Request', isset($res['statusCode']) && $res['statusCode'] === 400);

// 2H. Zero distance
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram',
    'drop' => 'Peelamedu',
    'vehicle_type' => 'Red Mini',
    'distance_km' => 0,
    'duration_min' => 20
), $customerToken);
assertTest('Zero distance (0 km) returns 400 Bad Request', isset($res['statusCode']) && $res['statusCode'] === 400);

// 2I. Negative distance
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram',
    'drop' => 'Peelamedu',
    'vehicle_type' => 'Red Mini',
    'distance_km' => -12.5,
    'duration_min' => 20
), $customerToken);
assertTest('Negative distance returns 400 Bad Request', isset($res['statusCode']) && $res['statusCode'] === 400);

// 2J. Excessive distance (> 5000 km)
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram',
    'drop' => 'Peelamedu',
    'vehicle_type' => 'Red Mini',
    'distance_km' => 99999,
    'duration_min' => 20
), $customerToken);
assertTest('Excessive distance (>5000 km) returns 400 Bad Request', isset($res['statusCode']) && $res['statusCode'] === 400);

// 2K. Missing duration
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram',
    'drop' => 'Peelamedu',
    'vehicle_type' => 'Red Mini',
    'distance_km' => 10
), $customerToken);
assertTest('Missing duration_min returns 400 Bad Request', isset($res['statusCode']) && $res['statusCode'] === 400);

// 2L. Non-numeric duration
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram',
    'drop' => 'Peelamedu',
    'vehicle_type' => 'Red Mini',
    'distance_km' => 10,
    'duration_min' => 'twenty_minutes'
), $customerToken);
assertTest('Non-numeric duration returns 400 Bad Request', isset($res['statusCode']) && $res['statusCode'] === 400);

// 2M. Negative duration
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram',
    'drop' => 'Peelamedu',
    'vehicle_type' => 'Red Mini',
    'distance_km' => 10,
    'duration_min' => -5
), $customerToken);
assertTest('Negative duration returns 400 Bad Request', isset($res['statusCode']) && $res['statusCode'] === 400);

// 2N. Excessive duration (> 7 days)
$res = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gandhipuram',
    'drop' => 'Peelamedu',
    'vehicle_type' => 'Red Mini',
    'distance_km' => 10,
    'duration_min' => 20000
), $customerToken);
assertTest('Excessive duration (>7 days) returns 400 Bad Request', isset($res['statusCode']) && $res['statusCode'] === 400);

// 2O. Invalid HTTP Method (GET instead of POST)
$res = runApi('/api/v1/booking/fare-estimate', 'GET', null, $customerToken);
assertTest('GET method on POST-only endpoint returns 404/405 error', isset($res['statusCode']) && in_array($res['statusCode'], array(404, 405), true));

// =============================================================
// Section 3: Valid Calculations for All Vehicle Categories
// =============================================================
echo "\n3. Testing Valid Fare Estimations & Mathematical Accuracy...\n";

// 3A. Red Mini Calculation: 10 km, 20 minutes
// Rates: base=99, free_km=2, per_km=14, per_min=2, platform=10, tax=5%
// billable_km = 10 - 2 = 8 km -> distance_fare = 8 * 14 = 112.00
// time_fare = 20 * 2 = 40.00
// subtotal = 99 + 112 + 40 + 10 = 261.00
// tax = 261 * 0.05 = 13.05
// total = 261 + 13.05 = 274.05
$payloadMini = array(
    'pickup' => array(
        'name'    => 'Gandhipuram Central Bus Stand',
        'address' => 'Cross Cut Rd, Gandhipuram, Coimbatore',
        'lat'     => 11.0168,
        'lng'     => 76.9656
    ),
    'drop' => array(
        'name'    => 'Coimbatore International Airport',
        'address' => 'Avinashi Rd, Peelamedu, Coimbatore',
        'lat'     => 11.0300,
        'lng'     => 77.0434
    ),
    'vehicle_type' => 'Red Mini',
    'distance_km'  => 10.0,
    'duration_min' => 20.0
);
$resMini = runApi('/api/v1/booking/fare-estimate', 'POST', $payloadMini, $customerToken);
assertTest('Red Mini API returns 200 OK', isset($resMini['statusCode']) && $resMini['statusCode'] === 200);
$fbMini = isset($resMini['data']['fare_breakdown']) ? $resMini['data']['fare_breakdown'] : array();
assertTest('Red Mini base fare is 99.00', isset($fbMini['base_fare']) && (float)$fbMini['base_fare'] === 99.00);
assertTest('Red Mini distance fare is 112.00 (8 km @ 14/km)', isset($fbMini['distance_fare']) && (float)$fbMini['distance_fare'] === 112.00);
assertTest('Red Mini time fare is 40.00 (20 min @ 2/min)', isset($fbMini['time_fare']) && (float)$fbMini['time_fare'] === 40.00);
assertTest('Red Mini platform fee is 10.00', isset($fbMini['platform_fee']) && (float)$fbMini['platform_fee'] === 10.00);
assertTest('Red Mini subtotal is 261.00', isset($fbMini['subtotal']) && (float)$fbMini['subtotal'] === 261.00);
assertTest('Red Mini tax (5%) is 13.05', isset($fbMini['tax']) && (float)$fbMini['tax'] === 13.05);
assertTest('Red Mini total fare is 274.05', isset($fbMini['total_fare']) && (float)$fbMini['total_fare'] === 274.05);
assertTest('Red Mini camelCase totalFare matches total_fare', isset($fbMini['totalFare']) && (float)$fbMini['totalFare'] === 274.05);

// 3B. Red Sedan Calculation: 15 km, 30 minutes
// Rates: base=149, free_km=2, per_km=18, per_min=2.50, platform=10, tax=5%
// billable_km = 15 - 2 = 13 km -> distance_fare = 13 * 18 = 234.00
// time_fare = 30 * 2.50 = 75.00
// subtotal = 149 + 234 + 75 + 10 = 468.00
// tax = 468 * 0.05 = 23.40
// total = 468 + 23.40 = 491.40
$payloadSedan = array(
    'pickup' => 'RS Puram DB Road, Coimbatore',
    'drop' => 'Tidel Park, Peelamedu, Coimbatore',
    'vehicle_type' => 'Red Sedan',
    'distance_km'  => 15.0,
    'duration_min' => 30.0
);
$resSedan = runApi('/api/v1/booking/fare-estimate', 'POST', $payloadSedan, $customerToken);
assertTest('Red Sedan API returns 200 OK', isset($resSedan['statusCode']) && $resSedan['statusCode'] === 200);
$fbSedan = isset($resSedan['data']['fare_breakdown']) ? $resSedan['data']['fare_breakdown'] : array();
assertTest('Red Sedan base fare is 149.00', isset($fbSedan['base_fare']) && (float)$fbSedan['base_fare'] === 149.00);
assertTest('Red Sedan distance fare is 234.00 (13 km @ 18/km)', isset($fbSedan['distance_fare']) && (float)$fbSedan['distance_fare'] === 234.00);
assertTest('Red Sedan time fare is 75.00 (30 min @ 2.50/min)', isset($fbSedan['time_fare']) && (float)$fbSedan['time_fare'] === 75.00);
assertTest('Red Sedan platform fee is 10.00', isset($fbSedan['platform_fee']) && (float)$fbSedan['platform_fee'] === 10.00);
assertTest('Red Sedan subtotal is 468.00', isset($fbSedan['subtotal']) && (float)$fbSedan['subtotal'] === 468.00);
assertTest('Red Sedan tax is 23.40', isset($fbSedan['tax']) && (float)$fbSedan['tax'] === 23.40);
assertTest('Red Sedan total fare is 491.40', isset($fbSedan['total_fare']) && (float)$fbSedan['total_fare'] === 491.40);

// 3C. Red SUV Prime Calculation: 25 km, 45 minutes
// Rates: base=199, free_km=3, per_km=24, per_min=3.00, platform=15, tax=5%
// billable_km = 25 - 3 = 22 km -> distance_fare = 22 * 24 = 528.00
// time_fare = 45 * 3.00 = 135.00
// subtotal = 199 + 528 + 135 + 15 = 877.00
// tax = 877 * 0.05 = 43.85
// total = 877 + 43.85 = 920.85
$payloadSuv = array(
    'pickup' => 'Brookefields Mall, Coimbatore',
    'drop' => 'Eachanari Temple, Coimbatore',
    'vehicle_type' => 'Red SUV Prime',
    'distance_km'  => 25.0,
    'duration_min' => 45.0
);
$resSuv = runApi('/api/v1/booking/fare-estimate', 'POST', $payloadSuv, $customerToken);
assertTest('Red SUV Prime API returns 200 OK', isset($resSuv['statusCode']) && $resSuv['statusCode'] === 200);
$fbSuv = isset($resSuv['data']['fare_breakdown']) ? $resSuv['data']['fare_breakdown'] : array();
assertTest('Red SUV Prime base fare is 199.00', isset($fbSuv['base_fare']) && (float)$fbSuv['base_fare'] === 199.00);
assertTest('Red SUV Prime distance fare is 528.00 (22 km @ 24/km)', isset($fbSuv['distance_fare']) && (float)$fbSuv['distance_fare'] === 528.00);
assertTest('Red SUV Prime time fare is 135.00 (45 min @ 3/min)', isset($fbSuv['time_fare']) && (float)$fbSuv['time_fare'] === 135.00);
assertTest('Red SUV Prime platform fee is 15.00', isset($fbSuv['platform_fee']) && (float)$fbSuv['platform_fee'] === 15.00);
assertTest('Red SUV Prime subtotal is 877.00', isset($fbSuv['subtotal']) && (float)$fbSuv['subtotal'] === 877.00);
assertTest('Red SUV Prime tax is 43.85', isset($fbSuv['tax']) && (float)$fbSuv['tax'] === 43.85);
assertTest('Red SUV Prime total fare is 920.85', isset($fbSuv['total_fare']) && (float)$fbSuv['total_fare'] === 920.85);

// 3D. Red Outstation Calculation: 86 km, 180 minutes
// Rates: base=499, free_km=0, per_km=16, per_min=1.00, platform=20, tax=5%
// billable_km = 86 km -> distance_fare = 86 * 16 = 1376.00
// time_fare = 180 * 1.00 = 180.00
// subtotal = 499 + 1376 + 180 + 20 = 2075.00
// tax = 2075 * 0.05 = 103.75
// total = 2075 + 103.75 = 2178.75
$payloadOutstation = array(
    'pickup' => 'Coimbatore Junction Railway Station',
    'drop' => 'Commercial Road, Ooty',
    'vehicle_type' => 'Red Outstation',
    'distance_km'  => 86.0,
    'duration_min' => 180.0
);
$resOutstation = runApi('/api/v1/booking/fare-estimate', 'POST', $payloadOutstation, $customerToken);
assertTest('Red Outstation API returns 200 OK', isset($resOutstation['statusCode']) && $resOutstation['statusCode'] === 200);
$fbOut = isset($resOutstation['data']['fare_breakdown']) ? $resOutstation['data']['fare_breakdown'] : array();
assertTest('Red Outstation base fare is 499.00', isset($fbOut['base_fare']) && (float)$fbOut['base_fare'] === 499.00);
assertTest('Red Outstation distance fare is 1376.00', isset($fbOut['distance_fare']) && (float)$fbOut['distance_fare'] === 1376.00);
assertTest('Red Outstation time fare is 180.00', isset($fbOut['time_fare']) && (float)$fbOut['time_fare'] === 180.00);
assertTest('Red Outstation platform fee is 20.00', isset($fbOut['platform_fee']) && (float)$fbOut['platform_fee'] === 20.00);
assertTest('Red Outstation total fare is 2178.75', isset($fbOut['total_fare']) && (float)$fbOut['total_fare'] === 2178.75);

// =============================================================
// Section 4: Flexibility & Edge Cases
// =============================================================
echo "\n4. Testing Flexibility (Slugs, Free KM, Formats & Coupons)...\n";

// 4A. Short ride <= free_km (distance = 1.5 km in Red Mini)
// Free km = 2.0 km -> billable km = 0 -> distance_fare = 0.00
// time_fare = 5 * 2 = 10.00, subtotal = 99 + 0 + 10 + 10 = 119.00
// tax = 119 * 0.05 = 5.95 -> total = 124.95
$resShort = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Gopalapuram',
    'drop' => 'Railway Station',
    'vehicle_type' => 'mini', // lowercase slug
    'distance_km' => 1.5,
    'duration_min' => 5.0
), $customerToken);
assertTest('Short trip <= free_km succeeds', isset($resShort['statusCode']) && $resShort['statusCode'] === 200);
assertTest('Lowercase slug "mini" resolves to Red Mini', isset($resShort['data']['vehicle']['name']) && $resShort['data']['vehicle']['name'] === 'Red Mini');
assertTest('Distance fare is 0.00 when distance <= free_km', isset($resShort['data']['fare_breakdown']['distance_fare']) && (float)$resShort['data']['fare_breakdown']['distance_fare'] === 0.00);
assertTest('Total fare calculated accurately for short trip', isset($resShort['data']['fare_breakdown']['total_fare']) && (float)$resShort['data']['fare_breakdown']['total_fare'] === 124.95);

// 4B. Slugs 'sedan' and 'suv'
$resSlugSedan = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Cross Cut Rd',
    'drop' => 'Avinashi Rd',
    'vehicle_type' => 'sedan',
    'distance_km' => 8,
    'duration_min' => 15
), $customerToken);
assertTest('Slug "sedan" resolves to Red Sedan', isset($resSlugSedan['data']['vehicle']['name']) && $resSlugSedan['data']['vehicle']['name'] === 'Red Sedan');

$resSlugSuv = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup' => 'Cross Cut Rd',
    'drop' => 'Avinashi Rd',
    'vehicle_type' => 'suv',
    'distance_km' => 8,
    'duration_min' => 15
), $customerToken);
assertTest('Slug "suv" resolves to Red SUV Prime', isset($resSlugSuv['data']['vehicle']['name']) && $resSlugSuv['data']['vehicle']['name'] === 'Red SUV Prime');

// 4C. Flat fields format (pickup_address, drop_address)
$resFlat = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup_address' => 'Saravanampatti Tech Hub',
    'drop_address'   => 'Tidel Park Coimbatore',
    'vehicle_type'   => 'Red Mini',
    'distance_km'    => 12.0,
    'duration_min'   => 25.0
), $customerToken);
assertTest('Flat pickup_address / drop_address parameters supported', isset($resFlat['statusCode']) && $resFlat['statusCode'] === 200);
assertTest('Flat address parsed in trip info', isset($resFlat['data']['trip']['pickup']['address']) && $resFlat['data']['trip']['pickup']['address'] === 'Saravanampatti Tech Hub');

// 4D. Coupon Discount Application
// Mini: 10 km, 20 min -> subtotal = 261.00, coupon SAVE50 (flat 50 off) -> discount = 50.00
// tax on 261 = 13.05, total = 261 + 13.05 - 50 = 224.05
$resCoupon = runApi('/api/v1/booking/fare-estimate', 'POST', array(
    'pickup'       => 'Gandhipuram',
    'drop'         => 'Peelamedu',
    'vehicle_type' => 'Red Mini',
    'distance_km'  => 10.0,
    'duration_min' => 20.0,
    'coupon_code'  => 'SAVE50'
), $customerToken);
assertTest('Valid coupon SAVE50 applied successfully', isset($resCoupon['statusCode']) && $resCoupon['statusCode'] === 200);
assertTest('Discount is 50.00', isset($resCoupon['data']['fare_breakdown']['discount']) && (float)$resCoupon['data']['fare_breakdown']['discount'] === 50.00);
assertTest('Total fare reflects discount: 224.05', isset($resCoupon['data']['fare_breakdown']['total_fare']) && (float)$resCoupon['data']['fare_breakdown']['total_fare'] === 224.05);
assertTest('Applied coupon details included in response', isset($resCoupon['data']['applied_coupon']['code']) && $resCoupon['data']['applied_coupon']['code'] === 'SAVE50');

// =============================================================
// Test Results Summary
// =============================================================
echo "\n=======================================================\n";
echo "Test Execution Summary:\n";
echo "  Total Tests: " . ($passedCount + $failedCount) . "\n";
echo "  Passed:      {$passedCount}\n";
echo "  Failed:      {$failedCount}\n";
echo "=======================================================\n";

if ($failedCount === 0) {
    echo "SUCCESS: All Fare Estimate API tests PASSED!\n";
    exit(0);
} else {
    echo "FAILURE: {$failedCount} test(s) FAILED!\n";
    exit(1);
}
