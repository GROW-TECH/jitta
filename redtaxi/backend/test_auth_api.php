<?php
/**
 * RedTaxi Authentication API Automated Test Suite
 * Compatible with PHP 5.6+
 */

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/DriverModel.php';
require_once __DIR__ . '/utils/Security.php';

echo "=======================================================\n";
echo "RedTaxi Auth API Test Suite (PHP 5.6+)\n";
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

function runTestEndpoint($uri, $method, $payload = null, $bearerToken = null)
{
    $phpBinary = 'C:\\xampp\\php\\php.exe';
    $cliScript = __DIR__ . DIRECTORY_SEPARATOR . 'cli_request.php';

    $payloadArg = '';
    if ($payload !== null) {
        // Write payload to temp file to completely avoid shell escaping bugs on Windows
        $tempFile = tempnam(sys_get_temp_dir(), 'rt_test_');
        file_put_contents($tempFile, json_encode($payload));
        $payloadArg = file_get_contents($tempFile);
        unlink($tempFile);
    }

    $tokenArg = $bearerToken !== null ? $bearerToken : '';

    $descriptors = array(
        0 => array('pipe', 'r'),
        1 => array('pipe', 'w'),
        2 => array('pipe', 'w')
    );

    $cmd = '"' . $phpBinary . '" "' . $cliScript . '" "' . $uri . '" "' . $method . '"';
    if ($payloadArg !== '') {
        // Pass via environment or argv
    }

    // Using a reliable temporary script for each call
    $runnerScript = tempnam(sys_get_temp_dir(), 'rt_run_') . '.php';
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
// Test 1: Customer Registration
// -------------------------------------------------------------
echo "1. Testing Customer Registration (POST /api/v1/auth/customer/register)...\n";
$testPhone = '98765' . mt_rand(10000, 99999);
$regPayload = array(
    'name'     => 'Karthik Raja',
    'phone'    => $testPhone,
    'email'    => 'karthik_' . $testPhone . '@example.com',
    'password' => 'SecurePass123'
);

$res = runTestEndpoint('/api/v1/auth/customer/register', 'POST', $regPayload);
assertTest('Register new customer returns 201 success', isset($res['success']) && $res['success'] === true && $res['statusCode'] === 201, json_encode($res));
assertTest('Registration returns valid Bearer token', isset($res['data']['token']) && !empty($res['data']['token']));
assertTest('Registration returns customer profile without password_hash', isset($res['data']['customer']['id']) && !isset($res['data']['customer']['password_hash']));
assertTest('Registration initializes customer wallet with 0.00 balance', isset($res['data']['customer']['wallet_balance']) && (float)$res['data']['customer']['wallet_balance'] === 0.0);

$customerToken = isset($res['data']['token']) ? $res['data']['token'] : null;
$customerId    = isset($res['data']['customer']['id']) ? $res['data']['customer']['id'] : null;

// Test Duplicate Registration
$dupRes = runTestEndpoint('/api/v1/auth/customer/register', 'POST', $regPayload);
assertTest('Duplicate phone registration returns 409 Conflict', isset($dupRes['statusCode']) && $dupRes['statusCode'] === 409);

// Test Input Validation (Short password & invalid phone)
$badRes = runTestEndpoint('/api/v1/auth/customer/register', 'POST', array(
    'name'     => 'A',
    'phone'    => '123',
    'password' => '12'
));
assertTest('Invalid input returns 400 Bad Request', isset($badRes['statusCode']) && $badRes['statusCode'] === 400);

echo "\n";

// -------------------------------------------------------------
// Test 2: Customer Login (Password & OTP)
// -------------------------------------------------------------
echo "2. Testing Customer Login (POST /api/v1/auth/customer/login)...\n";

// 2A. Valid password login
$loginPassRes = runTestEndpoint('/api/v1/auth/customer/login', 'POST', array(
    'phone'    => $testPhone,
    'password' => 'SecurePass123'
));
assertTest('Password login returns 200 Success & token', isset($loginPassRes['success']) && $loginPassRes['success'] === true && isset($loginPassRes['data']['token']));

// 2B. Wrong password login
$badPassRes = runTestEndpoint('/api/v1/auth/customer/login', 'POST', array(
    'phone'    => $testPhone,
    'password' => 'WrongPassword!'
));
assertTest('Wrong password login returns 401 Unauthorized', isset($badPassRes['statusCode']) && $badPassRes['statusCode'] === 401);

// 2C. Request OTP
$reqOtpRes = runTestEndpoint('/api/v1/auth/customer/login', 'POST', array(
    'phone' => $testPhone
));
assertTest('Empty credentials triggers OTP generation', isset($reqOtpRes['data']['otpSent']) && $reqOtpRes['data']['otpSent'] === true);

// 2D. Login with valid master OTP 4821
$loginOtpRes = runTestEndpoint('/api/v1/auth/customer/login', 'POST', array(
    'phone' => $testPhone,
    'otp'   => '4821'
));
assertTest('OTP login with valid code returns 200 & token', isset($loginOtpRes['success']) && $loginOtpRes['success'] === true);

// 2E. Login with invalid OTP
$badOtpRes = runTestEndpoint('/api/v1/auth/customer/login', 'POST', array(
    'phone' => $testPhone,
    'otp'   => '0000'
));
assertTest('Invalid OTP returns 401 Unauthorized', isset($badOtpRes['statusCode']) && $badOtpRes['statusCode'] === 401);

echo "\n";

// -------------------------------------------------------------
// Test 3: Driver Login (Password & OTP)
// -------------------------------------------------------------
echo "3. Testing Driver Partner Login (POST /api/v1/auth/driver/login)...\n";

// Ensure a test driver exists
$driverPhone = '98700' . mt_rand(10000, 99999);
$driverModel = new DriverModel();
$createdDriver = $driverModel->createDriver(array(
    'name'            => 'Suresh Kumar',
    'phone'           => $driverPhone,
    'email'           => 'suresh_' . $driverPhone . '@example.com',
    'password_hash'   => Security::hashPassword('DriverPass123'),
    'vehicle_model'   => 'Maruti Suzuki Dzire',
    'vehicle_number'  => 'TN ' . mt_rand(10, 99) . ' AB ' . mt_rand(1000, 9999),
    'vehicle_type'    => 'Sedan',
    'approval_status' => 'APPROVED'
));

// 3A. Driver password login
$driverPassRes = runTestEndpoint('/api/v1/auth/driver/login', 'POST', array(
    'phone'    => $driverPhone,
    'password' => 'DriverPass123'
));
assertTest('Driver password login returns 200 & token', isset($driverPassRes['success']) && $driverPassRes['success'] === true && isset($driverPassRes['data']['token']));
assertTest('Driver login returns vehicle info & wallet balance', isset($driverPassRes['data']['driver']['vehicle_model']) && isset($driverPassRes['data']['driver']['wallet_balance']));

$driverToken = isset($driverPassRes['data']['token']) ? $driverPassRes['data']['token'] : null;

// 3B. Driver OTP login
$driverOtpRes = runTestEndpoint('/api/v1/auth/driver/login', 'POST', array(
    'phone' => $driverPhone,
    'otp'   => '4821'
));
assertTest('Driver OTP login returns 200 Success', isset($driverOtpRes['success']) && $driverOtpRes['success'] === true);

// 3C. Non-existent driver
$noDriverRes = runTestEndpoint('/api/v1/auth/driver/login', 'POST', array(
    'phone' => '9999999999',
    'otp'   => '4821'
));
assertTest('Non-existent driver returns 404 Not Found', isset($noDriverRes['statusCode']) && $noDriverRes['statusCode'] === 404);

echo "\n";

// -------------------------------------------------------------
// Test 4: Current User Profile (GET /api/v1/auth/me)
// -------------------------------------------------------------
echo "4. Testing Current Profile (GET /api/v1/auth/me)...\n";

// 4A. With Customer Token
$meCustomer = runTestEndpoint('/api/v1/auth/me', 'GET', null, $customerToken);
assertTest('GET /api/v1/auth/me with Customer token returns customer profile', isset($meCustomer['data']['role']) && $meCustomer['data']['role'] === 'customer');

// 4B. With Driver Token
$meDriver = runTestEndpoint('/api/v1/auth/me', 'GET', null, $driverToken);
assertTest('GET /api/v1/auth/me with Driver token returns driver profile', isset($meDriver['data']['role']) && $meDriver['data']['role'] === 'driver');

// 4C. Without Token
$meNoToken = runTestEndpoint('/api/v1/auth/me', 'GET', null, null);
assertTest('GET /api/v1/auth/me without token returns 401 Unauthorized', isset($meNoToken['statusCode']) && $meNoToken['statusCode'] === 401);

// 4D. With Invalid Token
$meBadToken = runTestEndpoint('/api/v1/auth/me', 'GET', null, 'invalid.token.here');
assertTest('GET /api/v1/auth/me with bad token returns 401 Unauthorized', isset($meBadToken['statusCode']) && $meBadToken['statusCode'] === 401);

echo "\n";

// -------------------------------------------------------------
// Test 5: Logout & Standalone OTP
// -------------------------------------------------------------
echo "5. Testing Logout & Send OTP...\n";

// 5A. Logout
$logoutRes = runTestEndpoint('/api/v1/auth/logout', 'POST', null, $customerToken);
assertTest('POST /api/v1/auth/logout returns 200 Success', isset($logoutRes['success']) && $logoutRes['success'] === true);

// 5B. Standalone Send OTP
$sendOtpRes = runTestEndpoint('/api/v1/auth/send-otp', 'POST', array(
    'phone'   => '9876543210',
    'purpose' => 'LOGIN'
));
assertTest('POST /api/v1/auth/send-otp generates valid OTP record', isset($sendOtpRes['data']['otpDebug']) && strlen($sendOtpRes['data']['otpDebug']) === 4);

echo "\n=======================================================\n";
echo "Test Summary: {$passedCount} Passed, {$failedCount} Failed.\n";
echo "=======================================================\n";

if ($failedCount > 0) {
    exit(1);
}
