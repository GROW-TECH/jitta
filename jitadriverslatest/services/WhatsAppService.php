<?php
/**
 * Meta WhatsApp Cloud API Service
 * Sends non-blocking ride lifecycle WhatsApp notifications via Graph API.
 * Compatible with both Meta Test Number (+1 555 166 8055) and Production WABA numbers.
 */

require_once dirname(__DIR__) . '/config/database.php';

class WhatsAppService
{
    /**
     * Read configuration value cleanly from Env, $_ENV, $_SERVER, or getenv().
     */
    private static function getConfigValue($key, $default = '')
    {
        if (class_exists('Env')) {
            $val = Env::get($key, null);
            if ($val !== null) {
                return is_string($val) ? trim($val, "\"' \t\n\r\0\x0B") : $val;
            }
        }

        $val = getenv($key);
        if ($val === false && isset($_ENV[$key])) {
            $val = $_ENV[$key];
        }
        if ($val === false && isset($_SERVER[$key])) {
            $val = $_SERVER[$key];
        }
        if ($val === false || $val === null) {
            return $default;
        }
        return is_string($val) ? trim($val, "\"' \t\n\r\0\x0B") : $val;
    }

    /**
     * Check whether WhatsApp messaging is enabled and configured.
     */
    public static function isEnabled()
    {
        $enabled = self::getConfigValue('WHATSAPP_ENABLED', 'false');
        if ($enabled === false || $enabled === 'false' || $enabled === '0' || $enabled === '') {
            return false;
        }
        $token = self::getConfigValue('WHATSAPP_ACCESS_TOKEN', '');
        $phoneId = self::getConfigValue('WHATSAPP_PHONE_NUMBER_ID', '');
        return !empty($token) && !empty($phoneId);
    }

    /**
     * Format an Indian or international phone number to Meta digits-only E.164 format (e.g. 919876543210).
     */
    public static function formatPhone($phone)
    {
        $digits = preg_replace('/\D/', '', (string)$phone);
        if (empty($digits)) {
            return null;
        }
        if (strlen($digits) === 11 && strpos($digits, '0') === 0) {
            $digits = '91' . substr($digits, 1);
        } elseif (strlen($digits) === 10) {
            $digits = '91' . $digits;
        }
        if (strlen($digits) < 10 || strlen($digits) > 15) {
            return null;
        }
        return $digits;
    }

    /**
     * Send a free-form WhatsApp text message (requires active 24h customer conversation window).
     */
    public static function sendText($toPhone, $messageBody)
    {
        $recipient = self::formatPhone($toPhone);
        if (!$recipient) {
            return array('success' => false, 'error' => 'Invalid recipient phone number');
        }

        $payload = array(
            'messaging_product' => 'whatsapp',
            'recipient_type'    => 'individual',
            'to'                => $recipient,
            'type'              => 'text',
            'text'              => array(
                'preview_url' => false,
                'body'        => (string)$messageBody
            )
        );

        return self::dispatchPayload($payload);
    }

    /**
     * Send an approved WhatsApp Template message (works anytime, including outside 24h window).
     */
    public static function sendTemplate($toPhone, $templateName, $languageCode = 'en', $bodyParams = array())
    {
        $recipient = self::formatPhone($toPhone);
        if (!$recipient) {
            return array('success' => false, 'error' => 'Invalid recipient phone number');
        }
        if (empty($templateName)) {
            return array('success' => false, 'error' => 'Template name is required');
        }

        $templateObj = array(
            'name'     => (string)$templateName,
            'language' => array('code' => !empty($languageCode) ? (string)$languageCode : 'en')
        );

        if (!empty($bodyParams) && is_array($bodyParams)) {
            $paramsList = array();
            foreach ($bodyParams as $paramVal) {
                $cleanText = str_replace(array("\r", "\n", "\t"), ' ', trim((string)$paramVal));
                if ($cleanText === '') {
                    $cleanText = '-';
                }
                $paramsList[] = array(
                    'type' => 'text',
                    'text' => $cleanText
                );
            }
            $templateObj['components'] = array(
                array(
                    'type'       => 'body',
                    'parameters' => $paramsList
                )
            );
        }

        $payload = array(
            'messaging_product' => 'whatsapp',
            'to'                => $recipient,
            'type'              => 'template',
            'template'          => $templateObj
        );

        return self::dispatchPayload($payload);
    }

    /**
     * Notify customer via WhatsApp about a ride lifecycle event.
     * Fails gracefully without throwing or interrupting API booking workflows.
     *
     * Supported events: ACCEPTED, ARRIVED, STARTED, COMPLETED, CANCELLED
     */
    public static function notifyBookingEvent($bookingId, $event, $extra = array())
    {
        try {
            if (!self::isEnabled()) {
                return array('success' => false, 'skipped' => true, 'reason' => 'WhatsApp integration disabled');
            }

            $eventKey = strtoupper(trim((string)$event));
            $context = self::fetchBookingContext($bookingId);
            if (!$context) {
                self::writeLog("[$eventKey][$bookingId] Skipped: booking context not found");
                return array('success' => false, 'error' => 'Booking context not found');
            }

            $overrideTo = self::getConfigValue('WHATSAPP_TEST_TO_OVERRIDE', '');
            $targetPhone = !empty($overrideTo) ? $overrideTo : $context['customer_phone'];
            if (empty($targetPhone)) {
                self::writeLog("[$eventKey][$bookingId] Skipped: customer phone missing");
                return array('success' => false, 'error' => 'Customer phone missing');
            }

            $messageSpec = self::buildEventMessageSpec($eventKey, $context, $extra);
            if (!$messageSpec) {
                return array('success' => false, 'error' => "Unsupported WhatsApp event: {$eventKey}");
            }

            $sendMode = strtolower((string)self::getConfigValue('WHATSAPP_SEND_MODE', 'auto'));
            $templateName = !empty($messageSpec['template_env']) ? self::getConfigValue($messageSpec['template_env'], '') : '';
            $templateLang = self::getConfigValue('WHATSAPP_TEMPLATE_LANG', 'en');

            $result = null;
            if (!empty($templateName) && $sendMode !== 'text') {
                $result = self::sendTemplate($targetPhone, $templateName, $templateLang, $messageSpec['params']);
            } elseif ($sendMode === 'template') {
                // Force template mode requested without custom template configured -> use Meta hello_world test template
                $result = self::sendTemplate($targetPhone, 'hello_world', 'en_US', array());
            } else {
                $result = self::sendText($targetPhone, $messageSpec['text']);

                // If outside 24h customer service window (#131047) and fallback test template is enabled
                $fallbackHello = self::getConfigValue('WHATSAPP_FALLBACK_HELLO_WORLD', 'false');
                if (
                    empty($result['success']) &&
                    isset($result['error_code']) &&
                    (int)$result['error_code'] === 131047 &&
                    ($fallbackHello === true || $fallbackHello === 'true' || $fallbackHello === '1')
                ) {
                    self::writeLog("[$eventKey][$bookingId] 24h window closed (#131047); falling back to hello_world template for {$targetPhone}");
                    $result = self::sendTemplate($targetPhone, 'hello_world', 'en_US', array());
                }
            }

            $logStatus = !empty($result['success']) ? 'SENT' : 'FAILED';
            $logDetail = !empty($result['message_id']) ? $result['message_id'] : (isset($result['error']) ? $result['error'] : 'unknown');
            self::writeLog("[$eventKey][$bookingId] {$logStatus} to {$targetPhone} ({$logDetail})");

            return $result;
        } catch (Exception $e) {
            self::writeLog("[{$event}][{$bookingId}] Exception: " . $e->getMessage());
            return array('success' => false, 'error' => $e->getMessage());
        }
    }

    /**
     * Declaratively map ride lifecycle events to WhatsApp text + template parameters.
     */
    private static function buildEventMessageSpec($eventKey, $ctx, $extra = array())
    {
        $customerName = !empty($ctx['customer_name']) ? $ctx['customer_name'] : 'Customer';
        $driverName   = !empty($ctx['driver_name']) ? $ctx['driver_name'] : 'Jitta Captain';
        $driverPhone  = !empty($ctx['driver_phone']) ? $ctx['driver_phone'] : '';
        $pickup       = !empty($ctx['pickup_address']) ? $ctx['pickup_address'] : 'Pickup Point';
        $dropoff      = !empty($ctx['dropoff_address']) ? $ctx['dropoff_address'] : 'Destination';
        $startOtp     = !empty($ctx['start_otp']) ? $ctx['start_otp'] : '----';
        $fareVal      = isset($ctx['total_fare']) ? number_format((float)$ctx['total_fare'], 2, '.', '') : '0.00';
        $payMethod    = !empty($ctx['payment_method']) ? strtoupper($ctx['payment_method']) : 'CASH';
        $shortId      = strtoupper(substr($ctx['booking_id'], 0, 8));

        $reason = !empty($extra['reason']) ? $extra['reason'] : 'Cancelled on request';

        $specs = array(
            'ACCEPTED' => array(
                'template_env' => 'WHATSAPP_TEMPLATE_ACCEPTED',
                'params'       => array($customerName, $driverName, $pickup, $startOtp),
                'text'         => "*Jitta Drives - Ride Confirmed!*\n"
                                . "Hello {$customerName}, Captain {$driverName}"
                                . (!empty($driverPhone) ? " ({$driverPhone})" : '')
                                . " has accepted your booking!\n"
                                . "Booking: #{$shortId}\n"
                                . "Pickup: {$pickup}\n"
                                . "Start Ride OTP: *{$startOtp}*\n"
                                . "Your Captain is on the way!"
            ),
            'ARRIVED' => array(
                'template_env' => 'WHATSAPP_TEMPLATE_ARRIVED',
                'params'       => array($customerName, $driverName, $pickup, $startOtp),
                'text'         => "*Jitta Drives - Captain Arrived!*\n"
                                . "Hello {$customerName}, Captain {$driverName} has arrived at {$pickup}.\n"
                                . "Share Start OTP *{$startOtp}* with your Captain to begin the trip."
            ),
            'STARTED' => array(
                'template_env' => 'WHATSAPP_TEMPLATE_STARTED',
                'params'       => array($customerName, $dropoff, $driverName, $fareVal),
                'text'         => "*Jitta Drives - Trip Started!*\n"
                                . "Hello {$customerName}, your trip (#{$shortId}) to {$dropoff} has begun with Captain {$driverName}.\n"
                                . "Estimated Fare: Rs. {$fareVal}\n"
                                . "Have a safe journey!"
            ),
            'COMPLETED' => array(
                'template_env' => 'WHATSAPP_TEMPLATE_COMPLETED',
                'params'       => array($customerName, $shortId, $dropoff, $fareVal, $payMethod),
                'text'         => "*Jitta Drives - Ride Completed!*\n"
                                . "Hello {$customerName}, your ride (#{$shortId}) is completed.\n"
                                . "Drop: {$dropoff}\n"
                                . "Total Fare: *Rs. {$fareVal}* ({$payMethod})\n"
                                . "Thank you for riding with Jitta Drives!"
            ),
            'CANCELLED' => array(
                'template_env' => 'WHATSAPP_TEMPLATE_CANCELLED',
                'params'       => array($customerName, $shortId, $reason),
                'text'         => "*Jitta Drives - Ride Cancelled*\n"
                                . "Hello {$customerName}, your booking (#{$shortId}) has been cancelled.\n"
                                . "Reason: {$reason}"
            )
        );

        return isset($specs[$eventKey]) ? $specs[$eventKey] : null;
    }

    /**
     * Fetch unified booking + customer + driver + vehicle + pickup/drop details
     * safely supporting both local normalized and cPanel flat schemas.
     */
    private static function fetchBookingContext($bookingId)
    {
        $pdo = Database::getInstance()->getConnection();

        $stmt = $pdo->prepare(
            "SELECT b.*,
                    c.name AS customer_name, c.phone AS customer_phone,
                    d.name AS driver_name, d.phone AS driver_phone
             FROM `bookings` b
             LEFT JOIN `customers` c ON c.id = b.customer_id
             LEFT JOIN `drivers` d ON d.id = b.driver_id
             WHERE b.id = ?
             LIMIT 1"
        );
        $stmt->execute(array($bookingId));
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }

        // Resolve pickup & dropoff addresses across booking_locations (local) or flat bookings columns (cPanel)
        $pickupAddr = !empty($row['pickup_address']) ? $row['pickup_address'] : '';
        $dropAddr   = !empty($row['dropoff_address']) ? $row['dropoff_address'] : (!empty($row['drop_address']) ? $row['drop_address'] : '');

        if ($pickupAddr === '' || $dropAddr === '') {
            try {
                $locCheck = $pdo->query("SHOW TABLES LIKE 'booking_locations'");
                if ($locCheck && $locCheck->fetch()) {
                    $locStmt = $pdo->prepare(
                        "SELECT `type`, `name`, `address`
                         FROM `booking_locations`
                         WHERE `booking_id` = ?
                         ORDER BY `sequence_order` ASC"
                    );
                    $locStmt->execute(array($bookingId));
                    $locs = $locStmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($locs as $loc) {
                        $label = !empty($loc['name']) ? $loc['name'] : (!empty($loc['address']) ? $loc['address'] : '');
                        $typeUpper = strtoupper((string)$loc['type']);
                        if ($typeUpper === 'PICKUP' && $pickupAddr === '' && $label !== '') {
                            $pickupAddr = $label;
                        } elseif (($typeUpper === 'DROPOFF' || $typeUpper === 'DROP') && $label !== '') {
                            $dropAddr = $label;
                        }
                    }
                }
            } catch (Exception $e) {
                // Keep fallback empty string if table missing
            }
        }

        $startOtp = !empty($row['start_otp']) ? $row['start_otp'] : (!empty($row['otp']) ? $row['otp'] : '');
        $totalFare = isset($row['total_fare']) && (float)$row['total_fare'] > 0
            ? (float)$row['total_fare']
            : (isset($row['estimated_fare']) ? (float)$row['estimated_fare'] : 0.0);

        return array(
            'booking_id'      => $row['id'],
            'ride_type'       => isset($row['ride_type']) ? $row['ride_type'] : 'RIDE',
            'customer_name'   => isset($row['customer_name']) ? $row['customer_name'] : 'Customer',
            'customer_phone'  => isset($row['customer_phone']) ? $row['customer_phone'] : '',
            'driver_name'     => isset($row['driver_name']) ? $row['driver_name'] : 'Jitta Captain',
            'driver_phone'    => isset($row['driver_phone']) ? $row['driver_phone'] : '',
            'pickup_address'  => $pickupAddr,
            'dropoff_address' => $dropAddr,
            'start_otp'       => $startOtp,
            'total_fare'      => $totalFare,
            'payment_method'  => !empty($row['payment_method']) ? $row['payment_method'] : 'CASH'
        );
    }

    /**
     * Send JSON payload to Meta WhatsApp Cloud API endpoint using cURL.
     */
    private static function dispatchPayload($payload)
    {
        $token      = self::getConfigValue('WHATSAPP_ACCESS_TOKEN', '');
        $phoneId    = self::getConfigValue('WHATSAPP_PHONE_NUMBER_ID', '');
        $apiVersion = self::getConfigValue('WHATSAPP_API_VERSION', 'v22.0');

        if (empty($token) || empty($phoneId)) {
            return array('success' => false, 'error' => 'Meta WhatsApp credentials are not configured');
        }

        if (!function_exists('curl_init')) {
            return array('success' => false, 'error' => 'PHP cURL extension is not available');
        }

        $url = "https://graph.facebook.com/{$apiVersion}/{$phoneId}/messages";
        $jsonBody = json_encode($payload);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonBody);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json'
        ));
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            return array('success' => false, 'error' => 'WhatsApp HTTP request failed: ' . $curlErr);
        }

        $decoded = json_decode($response, true);
        if ($httpCode >= 200 && $httpCode < 300 && isset($decoded['messages'][0]['id'])) {
            return array(
                'success'    => true,
                'http_code'  => $httpCode,
                'message_id' => $decoded['messages'][0]['id'],
                'to'         => isset($payload['to']) ? $payload['to'] : '',
                'raw'        => $decoded
            );
        }

        $errMsg  = isset($decoded['error']['message']) ? $decoded['error']['message'] : 'Meta API returned HTTP ' . $httpCode;
        $errCode = isset($decoded['error']['code']) ? $decoded['error']['code'] : $httpCode;
        return array(
            'success'    => false,
            'http_code'  => $httpCode,
            'error_code' => $errCode,
            'error'      => $errMsg,
            'raw'        => $decoded
        );
    }

    /**
     * Append diagnostic trace line to protected logs/whatsapp.log.
     */
    private static function writeLog($line)
    {
        try {
            $logDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'logs';
            if (!is_dir($logDir)) {
                @mkdir($logDir, 0755, true);
            }
            $htaccess = $logDir . DIRECTORY_SEPARATOR . '.htaccess';
            if (!file_exists($htaccess)) {
                @file_put_contents($htaccess, "<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n    Order allow,deny\n    Deny from all\n</IfModule>\n");
            }
            $logFile = $logDir . DIRECTORY_SEPARATOR . 'whatsapp.log';
            $entry = '[' . date('Y-m-d H:i:s') . '] ' . $line . PHP_EOL;
            @file_put_contents($logFile, $entry, FILE_APPEND);
        } catch (Exception $e) {
            // Never fail app execution if logging fails
        }
    }
}

