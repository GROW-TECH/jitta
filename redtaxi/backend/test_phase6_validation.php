<?php
/**
 * RedTaxi Phase 6 - Comprehensive Input Validation Test Suite
 * Tests invalid, boundary, and malicious input handling across all key endpoints.
 * Validates that PHP rejects invalid data with HTTP 422 (Unprocessable Entity) or 400 (Bad Request).
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/utils/Security.php';

$baseUrl = 'http://127.0.0.1:8001/api/v1';

function callApi($method, $endpoint, $payload = null, $token = null)
{
    global $baseUrl;
    $url = $baseUrl . $endpoint;
    $ch = curl_init($url);

    $headers = array('Content-Type: application/json');
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return array(
        'code' => $httpCode,
        'body' => json_decode($response, true)
    );
}

$db = Database::getInstance()->getConnection();

// Setup fresh test actors
$testCustPhone = '9777111001';
$db->prepare("DELETE FROM customers WHERE phone = ?")->execute(array($testCustPhone));

// Get admin and driver tokens
$adminRow = $db->query("SELECT id, email, role FROM admin_users WHERE email = 'admin@redtaxi.in'")->fetch();
$adminToken = Security::generateToken($adminRow['id'], 'admin', array('email' => $adminRow['email'], 'role' => $adminRow['role']));

$driverRow = $db->query("SELECT id, phone, name FROM drivers WHERE approval_status = 'APPROVED' LIMIT 1")->fetch();
$driverToken = Security::generateToken($driverRow['id'], 'driver', array('phone' => $driverRow['phone'], 'name' => $driverRow['name']));

$testsPassed = 0;
$testsFailed = 0;

function assertValidation($testName, $actualCode, $expectedCode, $hasErrorField = null, $response = null)
{
    global $testsPassed, $testsFailed;
    $codeOk = ($actualCode === $expectedCode);
    $fieldOk = true;

    if ($hasErrorField !== null && isset($response['errors'])) {
        $fieldOk = isset($response['errors'][$hasErrorField]) || array_key_exists($hasErrorField, $response['errors']);
    }

    if ($codeOk && $fieldOk) {
        echo "  [PASS] {$testName} (HTTP {$actualCode})\n";
        $testsPassed++;
    } else {
        echo "  [FAIL] {$testName} - Expected HTTP {$expectedCode}, got HTTP {$actualCode}\n";
        if (!$fieldOk) {
            echo "         Missing error field: {$hasErrorField}\n";
        }
        if (isset($response['message'])) {
            echo "         Message: {$response['message']}\n";
        }
        $testsFailed++;
    }
}

echo "\n=======================================================\n";
echo "  RED TAXI - PHASE 6: INPUT VALIDATION TEST SUITE\n";
echo "=======================================================\n\n";

// --- Group 1: Registration Validation ---
echo "--- Group 1: Registration Input Validation ---\n";

// 1.1 Invalid short name
$res = callApi('POST', '/auth/customer/register', array(
    'name' => 'A',
    'phone' => '9876543210',
    'email' => 'valid@test.com',
    'password' => 'secret123',
    'confirm_password' => 'secret123'
));
assertValidation('Reject name < 2 characters', $res['code'], 422, 'name', $res['body']);

// 1.2 Invalid phone number (letters)
$res = callApi('POST', '/auth/customer/register', array(
    'name' => 'John Doe',
    'phone' => 'not-a-number',
    'email' => 'valid@test.com',
    'password' => 'secret123',
    'confirm_password' => 'secret123'
));
assertValidation('Reject non-numeric mobile number', $res['code'], 422, 'phone', $res['body']);

// 1.3 Invalid phone number (too short)
$res = callApi('POST', '/auth/customer/register', array(
    'name' => 'John Doe',
    'phone' => '98765',
    'email' => 'valid@test.com',
    'password' => 'secret123',
    'confirm_password' => 'secret123'
));
assertValidation('Reject short mobile number', $res['code'], 422, 'phone', $res['body']);

// 1.4 Invalid email format
$res = callApi('POST', '/auth/customer/register', array(
    'name' => 'John Doe',
    'phone' => '9876543210',
    'email' => 'invalid-email-format',
    'password' => 'secret123',
    'confirm_password' => 'secret123'
));
assertValidation('Reject invalid email format', $res['code'], 422, 'email', $res['body']);

// 1.5 Short password (< 6 chars)
$res = callApi('POST', '/auth/customer/register', array(
    'name' => 'John Doe',
    'phone' => '9876543210',
    'email' => 'valid@test.com',
    'password' => '123',
    'confirm_password' => '123'
));
assertValidation('Reject short password (< 6 chars)', $res['code'], 422, 'password', $res['body']);

// 1.6 Passwords do not match
$res = callApi('POST', '/auth/customer/register', array(
    'name' => 'John Doe',
    'phone' => '9876543210',
    'email' => 'valid@test.com',
    'password' => 'secret123',
    'confirm_password' => 'different456'
));
assertValidation('Reject mismatching confirm password', $res['code'], 422, 'confirm_password', $res['body']);

// Create a valid customer for subsequent tests
$res = callApi('POST', '/auth/customer/register', array(
    'name' => 'Valid Test Rider',
    'phone' => $testCustPhone,
    'email' => 'phase6rider@redtaxi.in',
    'password' => 'securePassword123',
    'confirm_password' => 'securePassword123'
));
$customerToken = $res['body']['data']['token'];
$customerId = $res['body']['data']['customer']['id'];

// --- Group 2: Booking Fare Estimate & Creation Validation ---
echo "\n--- Group 2: Fare Estimate & Booking Validation ---\n";

// 2.1 Out of bounds latitude in pickup (> 90 deg)
$res = callApi('POST', '/booking/fare-estimate', array(
    'pickup' => array('name' => 'Coimbatore Airport', 'lat' => 110.5, 'lng' => 77.0),
    'drop'   => array('name' => 'Gandhipuram', 'lat' => 11.0, 'lng' => 76.9),
    'vehicle_type' => 'Red Sedan',
    'distance_km'  => 12.5,
    'duration_min' => 25.0
), $customerToken);
assertValidation('Reject invalid pickup latitude (> 90)', $res['code'], 422, 'pickup.lat', $res['body']);

// 2.2 Out of bounds longitude in drop (> 180 deg)
$res = callApi('POST', '/booking/fare-estimate', array(
    'pickup' => array('name' => 'Coimbatore Airport', 'lat' => 11.0, 'lng' => 77.0),
    'drop'   => array('name' => 'Gandhipuram', 'lat' => 11.0, 'lng' => 250.0),
    'vehicle_type' => 'Red Sedan',
    'distance_km'  => 12.5,
    'duration_min' => 25.0
), $customerToken);
assertValidation('Reject invalid drop longitude (> 180)', $res['code'], 422, 'drop.lng', $res['body']);

// 2.3 Negative distance_km
$res = callApi('POST', '/booking/fare-estimate', array(
    'pickup' => 'Coimbatore Airport',
    'drop'   => 'Gandhipuram',
    'vehicle_type' => 'Red Sedan',
    'distance_km'  => -15.0,
    'duration_min' => 25.0
), $customerToken);
assertValidation('Reject negative distance (-15 km)', $res['code'], 422, 'distance_km', $res['body']);

// 2.4 Unrealistic distance (> 5000 km)
$res = callApi('POST', '/booking/fare-estimate', array(
    'pickup' => 'Coimbatore Airport',
    'drop'   => 'Gandhipuram',
    'vehicle_type' => 'Red Sedan',
    'distance_km'  => 99999.0,
    'duration_min' => 25.0
), $customerToken);
assertValidation('Reject excessive distance (> 5000 km)', $res['code'], 422, 'distance_km', $res['body']);

// 2.5 Negative duration
$res = callApi('POST', '/booking/create', array(
    'pickup' => 'Coimbatore Airport',
    'drop'   => 'Gandhipuram',
    'vehicle_type'   => 'Red Sedan',
    'distance_km'    => 10.0,
    'duration_min'   => -5.0,
    'payment_method' => 'CASH'
), $customerToken);
assertValidation('Reject negative duration (-5 min)', $res['code'], 422, 'duration_min', $res['body']);

// 2.6 Invalid payment method
$res = callApi('POST', '/booking/create', array(
    'pickup' => 'Coimbatore Airport',
    'drop'   => 'Gandhipuram',
    'vehicle_type'   => 'Red Sedan',
    'distance_km'    => 10.0,
    'duration_min'   => 20.0,
    'payment_method' => 'BITCOIN_UNSUPPORTED'
), $customerToken);
assertValidation('Reject unsupported payment method', $res['code'], 422, 'payment_method', $res['body']);

// 2.7 Invalid vehicle category
$res = callApi('POST', '/booking/create', array(
    'pickup' => 'Coimbatore Airport',
    'drop'   => 'Gandhipuram',
    'vehicle_type'   => 'Flying Saucer Prime',
    'distance_km'    => 10.0,
    'duration_min'   => 20.0,
    'payment_method' => 'CASH'
), $customerToken);
assertValidation('Reject non-existent vehicle category', $res['code'], 400, null, $res['body']);

// --- Group 3: Rating & Review Validation ---
echo "\n--- Group 3: Rating & Review Validation ---\n";

// 3.1 Invalid rating (rating = 0)
$res = callApi('POST', '/booking/rate', array(
    'booking_id' => 'fake-booking-id',
    'rating'     => 0
), $customerToken);
assertValidation('Reject rating = 0 (< 1)', $res['code'], 422, 'rating', $res['body']);

// 3.2 Invalid rating (rating = 7)
$res = callApi('POST', '/booking/rate', array(
    'booking_id' => 'fake-booking-id',
    'rating'     => 7
), $customerToken);
assertValidation('Reject rating = 7 (> 5)', $res['code'], 422, 'rating', $res['body']);

// 3.3 Excessive review length (> 500 chars)
$veryLongReview = str_repeat('Great taxi ride experience! ', 30); // ~840 chars
$res = callApi('POST', '/booking/rate', array(
    'booking_id'  => 'fake-booking-id',
    'rating'      => 5,
    'review_text' => $veryLongReview
), $customerToken);
assertValidation('Reject review exceeding 500 characters', $res['code'], 422, 'review_text', $res['body']);

// --- Group 4: Admin Fare Rules & Status Validation ---
echo "\n--- Group 4: Admin Fare Rules & Status Validation ---\n";

// 4.1 Negative base fare in Admin update
$res = callApi('PUT', '/admin/fare-rules/1', array(
    'base_fare' => -50.00,
    'per_km'    => 14.00
), $adminToken);
assertValidation('Reject negative base_fare in admin update', $res['code'], 422, 'base_fare', $res['body']);

// 4.2 Negative per_km in Admin update
$res = callApi('PUT', '/admin/fare-rules/1', array(
    'base_fare' => 50.00,
    'per_km'    => -10.00
), $adminToken);
assertValidation('Reject negative per_km rate in admin update', $res['code'], 422, 'per_km', $res['body']);

// 4.3 Tax percent > 100
$res = callApi('PUT', '/admin/fare-rules/1', array(
    'base_fare'   => 50.00,
    'per_km'      => 14.00,
    'tax_percent' => 125.00
), $adminToken);
assertValidation('Reject tax_percent > 100 in admin update', $res['code'], 422, 'tax_percent', $res['body']);

// 4.4 Invalid customer status enum
$res = callApi('PATCH', "/admin/customers/{$customerId}/status", array(
    'status' => 'SUPER_BLOCKED_INVALID'
), $adminToken);
assertValidation('Reject invalid customer status enum', $res['code'], 422, 'status', $res['body']);

// 4.5 Invalid driver approval status enum
$res = callApi('PATCH', "/admin/drivers/{$driverRow['id']}/approval", array(
    'approval_status' => 'SUPER_APPROVED_INVALID'
), $adminToken);
assertValidation('Reject invalid driver approval status enum', $res['code'], 422, 'approval_status', $res['body']);

// 4.6 Invalid driver ride status update
$res = callApi('PATCH', '/driver/rides/fake-booking-id/status', array(
    'status' => 'TELEPORTED'
), $driverToken);
assertValidation('Reject invalid driver ride status enum', $res['code'], 422, 'status', $res['body']);

// Clean up
$db->prepare("DELETE FROM customers WHERE id = ?")->execute(array($customerId));

echo "\n=======================================================\n";
echo "  VALIDATION SUITE SUMMARY: {$testsPassed} PASSED, {$testsFailed} FAILED\n";
echo "=======================================================\n\n";

if ($testsFailed > 0) {
    exit(1);
}
exit(0);
