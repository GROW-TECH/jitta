<?php
/**
 * RedTaxi Customer API Automated Test Suite
 * Tests all 10 Customer API feature sets:
 * 1. Get profile
 * 2. Update profile
 * 3. Get saved places
 * 4. Add/update/delete saved places
 * 5. Get booking history
 * 6. Get notifications & mark read
 * 7. Get wallet & transactions
 * 8. Create support ticket
 * 9. Get support tickets & reply
 * 10. Get booking detail
 *
 * Compatible with PHP 5.6+.
 */

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/CustomerModel.php';
require_once __DIR__ . '/models/DriverModel.php';
require_once __DIR__ . '/utils/Security.php';

echo "=======================================================\n";
echo "RedTaxi Customer API Test Suite (PHP 5.6+)\n";
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

    $runnerScript = tempnam(sys_get_temp_dir(), 'rt_cust_') . '.php';
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
// Setup Test Fixtures: Customer & Driver
// -------------------------------------------------------------
$db = Database::getInstance()->getConnection();
$customerModel = new CustomerModel();
$driverModel = new DriverModel();

// Create primary test customer
$phone1 = '98001' . mt_rand(10000, 99999);
$cust1 = $customerModel->createCustomer(array(
    'name'  => 'Priya Sundaram',
    'phone' => $phone1,
    'email' => 'priya_' . $phone1 . '@example.com'
));
$token1 = Security::generateToken($cust1['id'], 'customer');

// Create secondary customer for conflict test
$phone2 = '98002' . mt_rand(10000, 99999);
$cust2 = $customerModel->createCustomer(array(
    'name'  => 'Anand Kumar',
    'phone' => $phone2,
    'email' => 'anand_' . $phone2 . '@example.com'
));

// Create driver partner for role restriction test
$driverPhone = '98003' . mt_rand(10000, 99999);
$driver = $driverModel->createDriver(array(
    'name'           => 'Ravi V',
    'phone'          => $driverPhone,
    'vehicle_model'  => 'Toyota Etios',
    'vehicle_number' => 'TN 37 CD ' . mt_rand(1000, 9999)
));
$driverToken = Security::generateToken($driver['id'], 'driver');

// -------------------------------------------------------------
// 1. Get Customer Profile
// -------------------------------------------------------------
echo "1. Testing Get Customer Profile (GET /api/v1/customer/profile)...\n";
$res1 = runApi('/api/v1/customer/profile', 'GET', null, $token1);
assertTest('Profile retrieved successfully', isset($res1['success']) && $res1['success'] === true && $res1['statusCode'] === 200);
assertTest('Profile contains expected name and phone', isset($res1['data']['name']) && $res1['data']['name'] === 'Priya Sundaram');
assertTest('Profile contains wallet balance', isset($res1['data']['wallet_balance']));

$unauthRes = runApi('/api/v1/customer/profile', 'GET', null, null);
assertTest('Profile without token returns 401 Unauthorized', isset($unauthRes['statusCode']) && $unauthRes['statusCode'] === 401);

$driverRes = runApi('/api/v1/customer/profile', 'GET', null, $driverToken);
assertTest('Profile with Driver token returns 403 Forbidden', isset($driverRes['statusCode']) && $driverRes['statusCode'] === 403);
echo "\n";

// -------------------------------------------------------------
// 2. Update Customer Profile
// -------------------------------------------------------------
echo "2. Testing Update Customer Profile (PUT /api/v1/customer/profile)...\n";
$updateRes = runApi('/api/v1/customer/profile', 'PUT', array(
    'name'  => 'Priya S. Kumar',
    'email' => 'priya.kumar.' . $phone1 . '@example.com'
), $token1);
assertTest('Profile updated successfully', isset($updateRes['success']) && $updateRes['success'] === true);
assertTest('Updated name reflects in profile', isset($updateRes['data']['name']) && $updateRes['data']['name'] === 'Priya S. Kumar');

// Duplicate email test
$dupEmailRes = runApi('/api/v1/customer/profile', 'PUT', array(
    'email' => $cust2['email']
), $token1);
assertTest('Duplicate email returns 409 Conflict', isset($dupEmailRes['statusCode']) && $dupEmailRes['statusCode'] === 409);

// Invalid email format test
$badEmailRes = runApi('/api/v1/customer/profile', 'PUT', array(
    'email' => 'invalid-email-string'
), $token1);
assertTest('Invalid email format returns 400 Bad Request', isset($badEmailRes['statusCode']) && $badEmailRes['statusCode'] === 400);
echo "\n";

// -------------------------------------------------------------
// 3 & 4. Saved Places (Get, Add, Update, Delete)
// -------------------------------------------------------------
echo "3 & 4. Testing Saved Places CRUD (/api/v1/customer/places)...\n";

// 4A. Add Home Place
$addHomeRes = runApi('/api/v1/customer/places', 'POST', array(
    'label'   => 'Home',
    'address' => '42, Race Course Road, Coimbatore, Tamil Nadu',
    'lat'     => 11.0168,
    'lng'     => 76.9558
), $token1);
assertTest('Add Home place returns 201 Created', isset($addHomeRes['success']) && $addHomeRes['success'] === true && $addHomeRes['statusCode'] === 201);
assertTest('Home place contains coordinates and address', isset($addHomeRes['data']['id']) && $addHomeRes['data']['label'] === 'Home');
$homeId = isset($addHomeRes['data']['id']) ? $addHomeRes['data']['id'] : null;

// 4B. Add Work Place
$addWorkRes = runApi('/api/v1/customer/places', 'POST', array(
    'label'   => 'Work',
    'address' => 'Tidel Park, Avinashi Road, Coimbatore',
    'lat'     => 11.0285,
    'lng'     => 77.0276
), $token1);
assertTest('Add Work place returns 201 Created', isset($addWorkRes['success']) && $addWorkRes['success'] === true);
$workId = isset($addWorkRes['data']['id']) ? $addWorkRes['data']['id'] : null;

// 4C. Add Other Place (Gym)
$addOtherRes = runApi('/api/v1/customer/places', 'POST', array(
    'label'        => 'Other',
    'custom_label' => 'Gold Gym',
    'address'      => 'RS Puram, Coimbatore',
    'lat'          => 11.0080,
    'lng'          => 76.9460
), $token1);
assertTest('Add Other place returns 201 Created', isset($addOtherRes['data']['custom_label']) && $addOtherRes['data']['custom_label'] === 'Gold Gym');

// 3. Get Places
$getPlacesRes = runApi('/api/v1/customer/places', 'GET', null, $token1);
assertTest('Get saved places returns array of places', isset($getPlacesRes['data']) && count($getPlacesRes['data']) >= 3);

// 4D. Update Home Place
$updatePlaceRes = runApi('/api/v1/customer/places/' . $homeId, 'PUT', array(
    'address' => '42B, New Race Course Road, Coimbatore'
), $token1);
assertTest('Update saved place returns updated address', isset($updatePlaceRes['data']['address']) && strpos($updatePlaceRes['data']['address'], '42B') !== false);

// 4E. Delete Place (Work)
$delPlaceRes = runApi('/api/v1/customer/places/' . $workId, 'DELETE', null, $token1);
assertTest('Delete saved place returns success', isset($delPlaceRes['success']) && $delPlaceRes['success'] === true);

// Verify deleted
$afterDelRes = runApi('/api/v1/customer/places', 'GET', null, $token1);
$foundDeleted = false;
foreach ($afterDelRes['data'] as $p) {
    if ($p['id'] === $workId) {
        $foundDeleted = true;
    }
}
assertTest('Deleted place is absent in list', !$foundDeleted);
echo "\n";

// -------------------------------------------------------------
// 5 & 10. Bookings History & Booking Detail
// -------------------------------------------------------------
echo "5 & 10. Testing Customer Bookings History & Details...\n";

// Seed a city if needed
$cityStmt = $db->query("SELECT id FROM cities LIMIT 1");
$city = $cityStmt->fetch();
if (!$city) {
    $db->query("INSERT INTO cities (name, state, country, lat, lng, radius_km, is_active) VALUES ('Coimbatore', 'Tamil Nadu', 'India', 11.0168, 76.9558, 50, 1)");
    $cityId = (int)$db->lastInsertId();
} else {
    $cityId = (int)$city['id'];
}

// Seed a test booking for this customer
$testBookingId = 'TXI-' . mt_rand(100000, 999999);
$db->query("INSERT INTO bookings (
    id, customer_id, driver_id, vehicle_id, city_id, ride_type, vehicle_category,
    status, start_otp, distance_km, duration_min,
    base_fare, distance_fare, time_fare, platform_fee, tax, discount, total_fare,
    payment_method, payment_status, created_at, completed_at
) VALUES (
    '{$testBookingId}', '{$cust1['id']}', '{$driver['id']}', '{$driver['vehicle_id']}', {$cityId}, 'CITY', 'Red Sedan',
    'COMPLETED', '4821', 12.50, 28.00,
    100.00, 150.00, 30.00, 10.00, 14.50, 20.00, 284.50,
    'UPI', 'PAID', NOW() - INTERVAL 1 HOUR, NOW()
)");

// Seed pickup & drop locations
$db->query("INSERT INTO booking_locations (id, booking_id, type, sequence_order, name, address, lat, lng, category) VALUES
    ('" . Security::generateUUID() . "', '{$testBookingId}', 'PICKUP', 0, 'Railway Station', 'Coimbatore Junction', 11.0016, 76.9628, 'STATION'),
    ('" . Security::generateUUID() . "', '{$testBookingId}', 'DROP', 1, 'Airport', 'Coimbatore International Airport', 11.0300, 77.0434, 'AIRPORT')
");

// Seed payment record
$db->query("INSERT INTO payments (id, booking_id, customer_id, method, type, amount, status, gateway_txn_id, paid_at, created_at) VALUES
    ('" . Security::generateUUID() . "', '{$testBookingId}', '{$cust1['id']}', 'UPI', 'PAYMENT', 284.50, 'SUCCESS', 'TXN_UPI_" . mt_rand(10000, 99999) . "', NOW(), NOW())
");

// 5. Get Booking History
$bookingsRes = runApi('/api/v1/customer/bookings', 'GET', null, $token1);
assertTest('Get booking history returns list of rides', isset($bookingsRes['data']) && count($bookingsRes['data']) >= 1);
assertTest('Booking item includes pickup and drop locations', isset($bookingsRes['data'][0]['pickup']['name']) && isset($bookingsRes['data'][0]['drop']['name']));
assertTest('Booking item includes driver & vehicle details', isset($bookingsRes['data'][0]['driver_name']) && isset($bookingsRes['data'][0]['vehicle_number']));

// 10. Get Booking Details
$detailRes = runApi('/api/v1/customer/bookings/' . $testBookingId, 'GET', null, $token1);
assertTest('Get booking detail returns 200 Success', isset($detailRes['success']) && $detailRes['success'] === true);
assertTest('Detail includes full fare breakdown', isset($detailRes['data']['fare_breakdown']['total_fare']) && (float)$detailRes['data']['fare_breakdown']['total_fare'] === 284.50);
assertTest('Detail includes all route locations', isset($detailRes['data']['locations']) && count($detailRes['data']['locations']) >= 2);
assertTest('Detail includes payment records', isset($detailRes['data']['payments']) && count($detailRes['data']['payments']) >= 1);

// Non-existent booking
$noBookingRes = runApi('/api/v1/customer/bookings/NON-EXISTENT-ID', 'GET', null, $token1);
assertTest('Non-existent booking returns 404 Not Found', isset($noBookingRes['statusCode']) && $noBookingRes['statusCode'] === 404);
echo "\n";

// -------------------------------------------------------------
// 6. Notifications
// -------------------------------------------------------------
echo "6. Testing Notifications (/api/v1/customer/notifications)...\n";

// Seed a notification for customer
$notifId = Security::generateUUID();
$db->query("INSERT INTO notifications (id, user_id, user_type, title, message, type, is_read, audience, created_at) VALUES
    ('{$notifId}', '{$cust1['id']}', 'CUSTOMER', 'Ride Completed!', 'Your ride TXI-102939 has been completed.', 'RIDE', 0, 'INDIVIDUAL', NOW())
");

$notifsRes = runApi('/api/v1/customer/notifications', 'GET', null, $token1);
assertTest('Get notifications returns list', isset($notifsRes['data']) && count($notifsRes['data']) >= 1);
assertTest('Notifications includes unreadCount in metadata', isset($notifsRes['meta']['unreadCount']) && $notifsRes['meta']['unreadCount'] >= 1);

// Mark read
$markReadRes = runApi('/api/v1/customer/notifications/' . $notifId . '/read', 'PATCH', null, $token1);
assertTest('Mark notification read returns success', isset($markReadRes['success']) && $markReadRes['success'] === true);
echo "\n";

// -------------------------------------------------------------
// 7. Wallet & Transactions
// -------------------------------------------------------------
echo "7. Testing Wallet & Transactions (GET /api/v1/customer/wallet)...\n";

// Seed a transaction in wallet
$wallet = $customerModel->getWalletDetails($cust1['id']);
$db->query("UPDATE customer_wallets SET balance = 500.00 WHERE id = '{$wallet['id']}'");
$txId = Security::generateUUID();
$db->query("INSERT INTO customer_wallet_transactions (id, wallet_id, customer_id, type, amount, description, reference_id, created_at) VALUES
    ('{$txId}', '{$wallet['id']}', '{$cust1['id']}', 'CREDIT', 500.00, 'Top-up via UPI', 'UPI_REF_99', NOW())
");

$walletRes = runApi('/api/v1/customer/wallet', 'GET', null, $token1);
assertTest('Get wallet returns 200 Success', isset($walletRes['success']) && $walletRes['success'] === true);
assertTest('Wallet returns balance of 500', isset($walletRes['data']['balance']) && (float)$walletRes['data']['balance'] === 500.0);
assertTest('Wallet returns transactions array', isset($walletRes['data']['transactions']) && count($walletRes['data']['transactions']) >= 1);
echo "\n";

// -------------------------------------------------------------
// 8 & 9. Support Tickets & Messages
// -------------------------------------------------------------
echo "8 & 9. Testing Support Tickets (/api/v1/customer/support/tickets)...\n";

// 8. Create Support Ticket
$createTicketRes = runApi('/api/v1/customer/support/tickets', 'POST', array(
    'category'    => 'Billing',
    'subject'     => 'Charged twice for ride',
    'description' => 'I was deducted twice for my booking TXI-102939. Kindly refund.',
    'booking_id'  => $testBookingId,
    'priority'    => 'HIGH'
), $token1);
assertTest('Create support ticket returns 201 Created', isset($createTicketRes['statusCode']) && $createTicketRes['statusCode'] === 201);
assertTest('Ticket has status OPEN and priority HIGH', isset($createTicketRes['data']['status']) && $createTicketRes['data']['status'] === 'OPEN' && $createTicketRes['data']['priority'] === 'HIGH');
assertTest('Ticket contains initial threaded message', isset($createTicketRes['data']['messages']) && count($createTicketRes['data']['messages']) >= 1);
$ticketId = isset($createTicketRes['data']['id']) ? $createTicketRes['data']['id'] : null;

// 9A. Get Tickets List
$ticketsRes = runApi('/api/v1/customer/support/tickets', 'GET', null, $token1);
assertTest('Get tickets returns list', isset($ticketsRes['data']) && count($ticketsRes['data']) >= 1);

// 9B. Get Ticket Detail
$ticketDetailRes = runApi('/api/v1/customer/support/tickets/' . $ticketId, 'GET', null, $token1);
assertTest('Get ticket detail returns 200 with messages', isset($ticketDetailRes['data']['messages']) && count($ticketDetailRes['data']['messages']) >= 1);

// 9C. Reply to Ticket
$replyRes = runApi('/api/v1/customer/support/tickets/' . $ticketId . '/reply', 'POST', array(
    'message' => 'Here is my transaction reference: UPI-102948201'
), $token1);
assertTest('Reply to ticket returns updated messages list', isset($replyRes['data']['messages']) && count($replyRes['data']['messages']) >= 2);

echo "\n=======================================================\n";
echo "Customer API Test Summary: {$passedCount} Passed, {$failedCount} Failed.\n";
echo "=======================================================\n";

if ($failedCount > 0) {
    exit(1);
}
