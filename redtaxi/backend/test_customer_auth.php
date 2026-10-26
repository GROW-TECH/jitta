<?php
/**
 * RedTaxi Phase 1 - Step 1: Customer Authentication Automated Test Suite
 * Tests all 14 PRD requirements (A through N) via full API request pipeline
 */

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/utils/Security.php';

echo "=======================================================\n";
echo "RedTaxi Step 1: Customer Authentication Test Suite\n";
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
        echo "  [FAIL] {$name}";
        if ($details) {
            echo " ({$details})";
        }
        echo "\n";
        $failedCount++;
    }
}

function runApi($uri, $method, $payload = null, $bearerToken = null)
{
    $phpBinary = 'C:\\xampp\\php\\php.exe';

    $runnerScript = tempnam(sys_get_temp_dir(), 'rt_auth_') . '.php';
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

// Clean up test customers
$db = Database::getInstance()->getConnection();
$testPhone = '9998887766';
$testEmail = 'redtaxi_authtest@example.com';
$db->exec("DELETE FROM customer_wallets WHERE customer_id IN (SELECT id FROM customers WHERE phone = '{$testPhone}' OR email = '{$testEmail}')");
$db->exec("DELETE FROM customers WHERE phone = '{$testPhone}' OR email = '{$testEmail}'");

echo "--- Group 1: Registration Validations ---\n";

// Case B1: Missing name
$resB1 = runApi('/api/v1/auth/customer/register', 'POST', array(
    'name' => '',
    'phone' => $testPhone,
    'email' => $testEmail,
    'password' => 'Pass@123',
    'confirm_password' => 'Pass@123'
));
assertTest("Case B1: Missing name returns 400 Bad Request", isset($resB1['statusCode']) && $resB1['statusCode'] === 400 && $resB1['success'] === false);

// Case B2: Missing phone
$resB2 = runApi('/api/v1/auth/customer/register', 'POST', array(
    'name' => 'John Doe',
    'phone' => '',
    'email' => $testEmail,
    'password' => 'Pass@123',
    'confirm_password' => 'Pass@123'
));
assertTest("Case B2: Missing phone returns 400 Bad Request", isset($resB2['statusCode']) && $resB2['statusCode'] === 400 && $resB2['success'] === false);

// Case B3: Missing email
$resB3 = runApi('/api/v1/auth/customer/register', 'POST', array(
    'name' => 'John Doe',
    'phone' => $testPhone,
    'email' => '',
    'password' => 'Pass@123',
    'confirm_password' => 'Pass@123'
));
assertTest("Case B3: Missing email returns 400 Bad Request", isset($resB3['statusCode']) && $resB3['statusCode'] === 400 && $resB3['success'] === false);

// Case B4: Missing password
$resB4 = runApi('/api/v1/auth/customer/register', 'POST', array(
    'name' => 'John Doe',
    'phone' => $testPhone,
    'email' => $testEmail,
    'password' => '',
    'confirm_password' => 'Pass@123'
));
assertTest("Case B4: Missing password returns 400 Bad Request", isset($resB4['statusCode']) && $resB4['statusCode'] === 400 && $resB4['success'] === false);

// Case B5: Missing confirm_password
$resB5 = runApi('/api/v1/auth/customer/register', 'POST', array(
    'name' => 'John Doe',
    'phone' => $testPhone,
    'email' => $testEmail,
    'password' => 'Pass@123',
    'confirm_password' => ''
));
assertTest("Case B5: Missing confirm_password returns 400 Bad Request", isset($resB5['statusCode']) && $resB5['statusCode'] === 400 && $resB5['success'] === false);

// Case C: Invalid email format
$resC = runApi('/api/v1/auth/customer/register', 'POST', array(
    'name' => 'John Doe',
    'phone' => $testPhone,
    'email' => 'invalid-email-format',
    'password' => 'Pass@123',
    'confirm_password' => 'Pass@123'
));
assertTest("Case C: Invalid email format returns 400 Bad Request", isset($resC['statusCode']) && $resC['statusCode'] === 400 && strpos($resC['message'], 'email') !== false);

// Case D: Mismatched passwords
$resD = runApi('/api/v1/auth/customer/register', 'POST', array(
    'name' => 'John Doe',
    'phone' => $testPhone,
    'email' => $testEmail,
    'password' => 'Pass@123',
    'confirm_password' => 'Different@456'
));
assertTest("Case D: Mismatched passwords returns 400 Bad Request", isset($resD['statusCode']) && $resD['statusCode'] === 400 && strpos($resD['message'], 'match') !== false);

// Password length < 6 characters
$resShort = runApi('/api/v1/auth/customer/register', 'POST', array(
    'name' => 'John Doe',
    'phone' => $testPhone,
    'email' => $testEmail,
    'password' => '123',
    'confirm_password' => '123'
));
assertTest("Password < 6 chars returns 400 Bad Request", isset($resShort['statusCode']) && $resShort['statusCode'] === 400);

echo "\n--- Group 2: Successful Registration & Duplicates ---\n";

// Case A: Customer Registration with all valid fields
$resA = runApi('/api/v1/auth/customer/register', 'POST', array(
    'name' => 'Ravi Shankar',
    'phone' => $testPhone,
    'email' => $testEmail,
    'password' => 'SecurePass123',
    'confirm_password' => 'SecurePass123'
));

assertTest("Case A1: Registration returns HTTP 201 Created", isset($resA['statusCode']) && $resA['statusCode'] === 201);
assertTest("Case A2: Registration response contains success=true", isset($resA['success']) && $resA['success'] === true);
assertTest("Case A3: Registration returns JWT auth token", !empty($resA['data']['token']));
assertTest("Case A4: Registration returns tokenType Bearer", isset($resA['data']['tokenType']) && $resA['data']['tokenType'] === 'Bearer');
assertTest("Case A5: Registration returns customer data object", !empty($resA['data']['customer']['id']));
assertTest("Case A6: Registration response excludes password_hash", !isset($resA['data']['customer']['password_hash']));

$registeredToken = isset($resA['data']['token']) ? $resA['data']['token'] : null;

// Case E: Duplicate email registration
$resE = runApi('/api/v1/auth/customer/register', 'POST', array(
    'name' => 'Another User',
    'phone' => '9990001122',
    'email' => $testEmail, // duplicate
    'password' => 'SecurePass123',
    'confirm_password' => 'SecurePass123'
));
assertTest("Case E: Duplicate email returns 409 Conflict", isset($resE['statusCode']) && $resE['statusCode'] === 409 && strpos($resE['message'], 'email') !== false);

// Case F: Duplicate mobile registration
$resF = runApi('/api/v1/auth/customer/register', 'POST', array(
    'name' => 'Another User',
    'phone' => $testPhone, // duplicate
    'email' => 'unique_email@example.com',
    'password' => 'SecurePass123',
    'confirm_password' => 'SecurePass123'
));
assertTest("Case F: Duplicate mobile returns 409 Conflict", isset($resF['statusCode']) && $resF['statusCode'] === 409 && strpos($resF['message'], 'mobile') !== false);

echo "\n--- Group 3: Customer Login Cases ---\n";

// Case G: Login with valid email + password
$resG = runApi('/api/v1/auth/customer/login', 'POST', array(
    'identifier' => $testEmail,
    'password' => 'SecurePass123'
));
assertTest("Case G1: Login with email returns HTTP 200", isset($resG['statusCode']) && $resG['statusCode'] === 200 && $resG['success'] === true);
assertTest("Case G2: Login with email returns valid JWT token", !empty($resG['data']['token']));
assertTest("Case G3: Login with email returns sanitized customer object", !empty($resG['data']['customer']['name']) && !isset($resG['data']['customer']['password_hash']));

// Case H: Login with valid mobile + password
$resH = runApi('/api/v1/auth/customer/login', 'POST', array(
    'identifier' => $testPhone,
    'password' => 'SecurePass123'
));
assertTest("Case H1: Login with mobile returns HTTP 200", isset($resH['statusCode']) && $resH['statusCode'] === 200 && $resH['success'] === true);
assertTest("Case H2: Login with mobile returns valid JWT token", !empty($resH['data']['token']));
assertTest("Case H3: Login with mobile returns customer data", isset($resH['data']['customer']['phone']) && $resH['data']['customer']['phone'] === $testPhone);

// Case I: Login with invalid password
$resI = runApi('/api/v1/auth/customer/login', 'POST', array(
    'identifier' => $testEmail,
    'password' => 'WrongPassword!'
));
assertTest("Case I: Login with invalid password returns 401 Unauthorized", isset($resI['statusCode']) && $resI['statusCode'] === 401 && $resI['success'] === false);

// Case J: Login with non-existent user
$resJ = runApi('/api/v1/auth/customer/login', 'POST', array(
    'identifier' => 'nonexistent_user@example.com',
    'password' => 'AnyPassword123'
));
assertTest("Case J: Login with non-existent user returns 401 Unauthorized", isset($resJ['statusCode']) && $resJ['statusCode'] === 401 && $resJ['success'] === false);

echo "\n--- Group 4: Protected Routes & Authorization ---\n";

// Case K: Accessing protected customer route without token
$resK = runApi('/api/v1/customer/profile', 'GET', null, null);
assertTest("Case K: Protected customer route without token returns 401 Unauthorized", isset($resK['statusCode']) && $resK['statusCode'] === 401 && $resK['success'] === false);

// Case L: Accessing protected customer route with valid token
$resL = runApi('/api/v1/customer/profile', 'GET', null, $registeredToken);
assertTest("Case L1: Protected customer route with valid token returns 200 OK", isset($resL['statusCode']) && $resL['statusCode'] === 200 && $resL['success'] === true);
assertTest("Case L2: Protected customer route returns correct user profile", isset($resL['data']['phone']) && $resL['data']['phone'] === $testPhone);

echo "\n--- Group 5: Logout & Password Security ---\n";

// Case M: Logout functionality
$resM = runApi('/api/v1/auth/logout', 'POST', null, $registeredToken);
assertTest("Case M: Logout endpoint returns 200 OK", isset($resM['statusCode']) && $resM['statusCode'] === 200 && isset($resM['data']['loggedOut']) && $resM['data']['loggedOut'] === true);

// Case N: Password is securely hashed in database (bcrypt)
$stmt = $db->prepare("SELECT password_hash FROM customers WHERE phone = ?");
$stmt->execute(array($testPhone));
$row = $stmt->fetch(PDO::FETCH_ASSOC);

$isHashed = !empty($row['password_hash']) && strpos($row['password_hash'], '$2y$') === 0;
$isNotPlaintext = $row['password_hash'] !== 'SecurePass123';
$verifiesWithBcrypt = password_verify('SecurePass123', $row['password_hash']);

assertTest("Case N1: Stored password is not plaintext", $isNotPlaintext);
assertTest("Case N2: Stored password uses bcrypt (\$2y\$)", $isHashed);
assertTest("Case N3: password_verify succeeds with original password", $verifiesWithBcrypt);

// Clean up test customer
$db->exec("DELETE FROM customer_wallets WHERE customer_id IN (SELECT id FROM customers WHERE phone = '{$testPhone}' OR email = '{$testEmail}')");
$db->exec("DELETE FROM customers WHERE phone = '{$testPhone}' OR email = '{$testEmail}'");

echo "\n=======================================================\n";
echo "Customer Authentication Test Execution Summary\n";
echo "Total Tests Run: " . ($passedCount + $failedCount) . "\n";
echo "Passed:          {$passedCount}\n";
echo "Failed:          {$failedCount}\n";
echo "=======================================================\n";

if ($failedCount === 0) {
    echo "\n>>> ALL 14 CUSTOMER AUTHENTICATION REQUIREMENTS PASSED (100%) <<<\n\n";
} else {
    echo "\n>>> SOME TESTS FAILED <<<\n\n";
    exit(1);
}
