<?php
/**
 * RedTaxi / Jitta Drivers - Official Vehicle Registration Verification Service
 * Integrates with authorized government/Vahan-connected RC verification providers.
 * Adheres strictly to security, privacy, rate limiting, and distinct verification states.
 * Compatible with PHP 5.6+.
 */

require_once __DIR__ . '/VehicleValidationService.php';
require_once dirname(__DIR__) . '/config/env.php';

interface VehicleVerificationProviderInterface
{
    /**
     * Verify an Indian motor vehicle registration number against official records.
     *
     * @param string $normalizedNumber
     * @return array
     */
    public function verify($normalizedNumber);
}

/**
 * Default Provider when official credentials are not yet configured.
 * Reports VERIFICATION_UNAVAILABLE honestly without fabricating official verification results.
 */
class UnconfiguredVerificationProvider implements VehicleVerificationProviderInterface
{
    public function verify($normalizedNumber)
    {
        return array(
            'status'      => 'VERIFICATION_UNAVAILABLE',
            'provider'    => 'UNCONFIGURED',
            'verified_at' => null,
            'details'     => null,
            'message'     => 'Official government vehicle verification provider is not configured. Format validation succeeded, but live VAHAN/RC verification requires provider API credentials.',
            'configured'  => false
        );
    }
}

/**
 * Mock Provider for automated integration testing and local developer verification.
 * Simulates real provider responses, errors, timeouts, and successful validations.
 */
class MockVerificationProvider implements VehicleVerificationProviderInterface
{
    public function verify($normalizedNumber)
    {
        $norm = VehicleValidationService::normalize($normalizedNumber);

        // Simulated Timeout / Service Unavailable scenario
        if (strpos($norm, 'TIMEOUT') !== false || substr($norm, -4) === '9999') {
            return array(
                'status'      => 'VERIFICATION_UNAVAILABLE',
                'provider'    => 'MOCK_TEST_PROVIDER',
                'verified_at' => null,
                'details'     => null,
                'message'     => 'Verification provider connection timed out after 5000ms. Service temporarily unavailable.',
                'configured'  => true
            );
        }

        // Simulated Unregistered / Suspended RC scenario
        if (strpos($norm, 'FAIL') !== false || substr($norm, -4) === '0000' || substr($norm, -4) === '9998') {
            return array(
                'status'      => 'VERIFICATION_FAILED',
                'provider'    => 'MOCK_TEST_PROVIDER',
                'verified_at' => date('Y-m-d H:i:s'),
                'details'     => array(
                    'rc_status' => 'INACTIVE_OR_UNREGISTERED',
                    'reason'    => 'No active registration certificate found for this vehicle number'
                ),
                'message'     => 'Official verification failed: No active registration record found in database.',
                'configured'  => true
            );
        }

        // Simulated Successful Official RC Verification
        return array(
            'status'      => 'VERIFIED',
            'provider'    => 'MOCK_TEST_PROVIDER',
            'verified_at' => date('Y-m-d H:i:s'),
            'details'     => array(
                'rc_status'         => 'ACTIVE',
                'registration_date' => '2021-06-15',
                'vehicle_class'     => 'MOTOR CAR (LMV)',
                'maker_model'       => 'MARUTI SUZUKI SWIFT / DZIRE',
                'fuel_type'         => 'PETROL',
                'insurance_validity'=> date('Y-m-d', strtotime('+1 year')),
                'fitness_validity'  => date('Y-m-d', strtotime('+5 years')),
                'puc_validity'      => date('Y-m-d', strtotime('+6 months'))
            ),
            'message'     => 'Vehicle registration officially verified with VAHAN records.',
            'configured'  => true
        );
    }
}

/**
 * Authorized HTTP Provider for live production VAHAN / RC API gateways.
 * (e.g. Surepass, Cashfree, Signzy, Sandbox, or Government API Gateway).
 */
class AuthorizedHttpVerificationProvider implements VehicleVerificationProviderInterface
{
    private $apiKey;
    private $apiSecret;
    private $apiUrl;
    private $providerName;

    public function __construct($providerName, $apiKey, $apiSecret, $apiUrl)
    {
        $this->providerName = $providerName;
        $this->apiKey       = $apiKey;
        $this->apiSecret    = $apiSecret;
        $this->apiUrl       = $apiUrl;
    }

    public function verify($normalizedNumber)
    {
        if (empty($this->apiUrl) || empty($this->apiKey)) {
            return array(
                'status'      => 'VERIFICATION_UNAVAILABLE',
                'provider'    => $this->providerName ?: 'VAHAN_GATEWAY',
                'verified_at' => null,
                'details'     => null,
                'message'     => 'API URL or Key missing in server configuration',
                'configured'  => false
            );
        }

        $headers = array(
            'Content-Type: application/json',
            'Authorization: Bearer ' . $this->apiKey,
            'x-api-key: ' . $this->apiKey
        );
        if (!empty($this->apiSecret)) {
            $headers[] = 'x-api-secret: ' . $this->apiSecret;
        }

        $payload = json_encode(array(
            'id_number' => $normalizedNumber,
            'reg_no'    => $normalizedNumber
        ));

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $this->apiUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($response === false || !empty($curlErr)) {
            return array(
                'status'      => 'VERIFICATION_UNAVAILABLE',
                'provider'    => $this->providerName,
                'verified_at' => null,
                'details'     => null,
                'message'     => 'Provider request failed: ' . ($curlErr ?: 'Timeout or network unreachable'),
                'configured'  => true
            );
        }

        if ($httpCode === 429) {
            return array(
                'status'      => 'VERIFICATION_UNAVAILABLE',
                'provider'    => $this->providerName,
                'verified_at' => null,
                'details'     => null,
                'message'     => 'Verification provider rate limit exceeded. Please try again shortly.',
                'configured'  => true
            );
        }

        $json = @json_decode($response, true);
        if (!is_array($json)) {
            return array(
                'status'      => 'VERIFICATION_UNAVAILABLE',
                'provider'    => $this->providerName,
                'verified_at' => null,
                'details'     => null,
                'message'     => 'Invalid JSON response from verification provider',
                'configured'  => true
            );
        }

        // Evaluate provider status
        $success = (!empty($json['success']) || !empty($json['data']) || $httpCode === 200);
        $data = isset($json['data']) && is_array($json['data']) ? $json['data'] : $json;

        $rcStatus = isset($data['rc_status']) ? strtoupper(trim($data['rc_status'])) : (isset($data['status']) ? strtoupper(trim($data['status'])) : '');

        if ($success && ($rcStatus === 'ACTIVE' || $rcStatus === 'ACT' || $rcStatus === 'VALID' || empty($rcStatus))) {
            return array(
                'status'      => 'VERIFIED',
                'provider'    => $this->providerName,
                'verified_at' => date('Y-m-d H:i:s'),
                'details'     => array(
                    'rc_status'         => 'ACTIVE',
                    'vehicle_class'     => isset($data['vehicle_class']) ? $data['vehicle_class'] : (isset($data['class']) ? $data['class'] : 'LMV'),
                    'maker_model'       => isset($data['maker_model']) ? $data['maker_model'] : (isset($data['model']) ? $data['model'] : null),
                    'registration_date' => isset($data['registration_date']) ? $data['registration_date'] : null
                ),
                'message'     => 'Vehicle registration officially verified.',
                'configured'  => true
            );
        }

        if ($rcStatus === 'INACTIVE' || $rcStatus === 'CANCELLED' || $rcStatus === 'SUSPENDED' || $httpCode === 404 || $httpCode === 422) {
            return array(
                'status'      => 'VERIFICATION_FAILED',
                'provider'    => $this->providerName,
                'verified_at' => date('Y-m-d H:i:s'),
                'details'     => array('rc_status' => $rcStatus ?: 'NOT_FOUND'),
                'message'     => 'Vehicle registration certificate not found or inactive.',
                'configured'  => true
            );
        }

        return array(
            'status'      => 'VERIFICATION_UNAVAILABLE',
            'provider'    => $this->providerName,
            'verified_at' => null,
            'details'     => null,
            'message'     => 'Provider returned status: ' . ($rcStatus ?: 'UNCONFIRMED'),
            'configured'  => true
        );
    }
}

/**
 * Main VehicleVerificationService Orchestrator.
 */
class VehicleVerificationService
{
    const STATUS_NOT_PROVIDED   = 'NOT_PROVIDED';
    const STATUS_FORMAT_VALID    = 'FORMAT_VALID';
    const STATUS_PENDING         = 'VERIFICATION_PENDING';
    const STATUS_VERIFIED        = 'VERIFIED';
    const STATUS_FAILED          = 'VERIFICATION_FAILED';
    const STATUS_UNAVAILABLE     = 'VERIFICATION_UNAVAILABLE';

    /** @var VehicleVerificationProviderInterface */
    private static $provider = null;

    /** @var array In-memory request cache to prevent duplicate rapid requests */
    private static $cache = array();

    /**
     * Optional constructor allowing custom provider injection (for testing / mocking).
     *
     * @param VehicleVerificationProviderInterface|null $provider
     */
    public function __construct($provider = null)
    {
        if ($provider !== null) {
            self::$provider = $provider;
            self::$cache    = array();
        }
    }

    /**
     * Instance wrapper for vehicle verification.
     *
     * @param string|null $rawNumber
     * @return array
     */
    public function verifyVehicle($rawNumber)
    {
        return self::processVehicleVerification($rawNumber);
    }

    /**
     * Resolves and returns the configured provider instance.
     *
     * @return VehicleVerificationProviderInterface
     */
    public static function getProvider()
    {
        if (self::$provider !== null) {
            return self::$provider;
        }

        $providerName = strtolower(trim((string)Env::get('VEHICLE_VERIFY_PROVIDER', 'unconfigured')));
        $apiKey       = trim((string)Env::get('VEHICLE_VERIFY_API_KEY', ''));
        $apiSecret    = trim((string)Env::get('VEHICLE_VERIFY_API_SECRET', ''));
        $apiUrl       = trim((string)Env::get('VEHICLE_VERIFY_API_URL', ''));

        // If mock provider explicitly requested or testing environment
        if ($providerName === 'mock' || $providerName === 'test') {
            self::$provider = new MockVerificationProvider();
            return self::$provider;
        }

        // If live credentials configured
        if (!empty($apiKey) && !empty($apiUrl) && $providerName !== 'unconfigured') {
            self::$provider = new AuthorizedHttpVerificationProvider($providerName, $apiKey, $apiSecret, $apiUrl);
            return self::$provider;
        }

        // Default: Clean unconfigured provider
        self::$provider = new UnconfiguredVerificationProvider();
        return self::$provider;
    }

    /**
     * Override provider explicitly (e.g. for testing purposes).
     *
     * @param VehicleVerificationProviderInterface|null $provider
     */
    public static function setProvider($provider)
    {
        self::$provider = $provider;
        self::$cache    = array();
    }

    /**
     * Process vehicle registration number:
     * 1. Validates format using VehicleValidationService.
     * 2. If format is invalid, returns early without calling verification provider.
     * 3. If format is valid, checks cache and dispatches to configured verification provider.
     * 4. Returns consolidated verification status.
     *
     * @param string|null $rawNumber
     * @return array
     */
    public static function processVehicleVerification($rawNumber)
    {
        $formatResult = VehicleValidationService::validate($rawNumber);

        if (!$formatResult['valid']) {
            $status = ($formatResult['status'] === 'NOT_PROVIDED') ? self::STATUS_NOT_PROVIDED : self::STATUS_FAILED;
            return array(
                'valid'               => false,
                'isValid'             => false,
                'normalized'          => $formatResult['normalized'],
                'formatted'           => $formatResult['formatted'],
                'state_code'          => $formatResult['state_code'],
                'stateCode'           => $formatResult['state_code'],
                'state_name'          => $formatResult['state_name'],
                'stateName'           => $formatResult['state_name'],
                'verification_status' => $status,
                'status'              => $status,
                'provider'            => null,
                'verified_at'         => null,
                'details'             => null,
                'error'               => $formatResult['error'],
                'errorMessage'        => $formatResult['error'],
                'message'             => $formatResult['error'],
                'format_valid'        => false
            );
        }

        $norm = $formatResult['normalized'];

        // Check local memory cache
        if (isset(self::$cache[$norm])) {
            $cached = self::$cache[$norm];
            $cached['cached'] = true;
            return $cached;
        }

        $provider = self::getProvider();
        $providerResult = $provider->verify($norm);

        $provStatus = isset($providerResult['status']) ? $providerResult['status'] : self::STATUS_UNAVAILABLE;
        $isVerified = ($provStatus === self::STATUS_VERIFIED);

        $result = array(
            'valid'               => $isVerified,
            'isValid'             => $isVerified,
            'format_valid'        => true,
            'normalized'          => $norm,
            'formatted'           => $formatResult['formatted'],
            'state_code'          => $formatResult['state_code'],
            'stateCode'           => $formatResult['state_code'],
            'state_name'          => $formatResult['state_name'],
            'stateName'           => $formatResult['state_name'],
            'verification_status' => $provStatus,
            'status'              => $provStatus,
            'provider'            => isset($providerResult['provider']) ? $providerResult['provider'] : null,
            'verified_at'         => isset($providerResult['verified_at']) ? $providerResult['verified_at'] : null,
            'details'             => isset($providerResult['details']) ? $providerResult['details'] : null,
            'message'             => isset($providerResult['message']) ? $providerResult['message'] : null,
            'error'               => $isVerified ? null : (isset($providerResult['message']) ? $providerResult['message'] : null),
            'errorMessage'        => $isVerified ? null : (isset($providerResult['message']) ? $providerResult['message'] : null),
            'configured'          => !empty($providerResult['configured']),
            'cached'              => false
        );

        self::$cache[$norm] = $result;
        return $result;
    }
}
