<?php
/**
 * Razorpay Payment Gateway Service
 * Handles Order Creation and Signature Verification for Razorpay Standard Checkout.
 * Uses cURL directly for maximum reliability and PHP 5.6+ / 7.x / 8.x compatibility without third-party bloat.
 */

class RazorpayService
{
    private static function getKeyId()
    {
        $val = getenv('RAZORPAY_KEY_ID');
        if (!$val && isset($_ENV['RAZORPAY_KEY_ID'])) $val = $_ENV['RAZORPAY_KEY_ID'];
        if (!$val && isset($_SERVER['RAZORPAY_KEY_ID'])) $val = $_SERVER['RAZORPAY_KEY_ID'];
        return trim($val, "\"' \t\n\r\0\x0B");
    }

    private static function getKeySecret()
    {
        $val = getenv('RAZORPAY_KEY_SECRET');
        if (!$val && isset($_ENV['RAZORPAY_KEY_SECRET'])) $val = $_ENV['RAZORPAY_KEY_SECRET'];
        if (!$val && isset($_SERVER['RAZORPAY_KEY_SECRET'])) $val = $_SERVER['RAZORPAY_KEY_SECRET'];
        return trim($val, "\"' \t\n\r\0\x0B");
    }

    /**
     * Create Razorpay Order
     * @param float $amount Amount in Rupees (e.g. 1.00 for ₹1)
     * @param string $receipt Unique receipt reference ID
     * @param array $notes Custom metadata key-values
     * @return array Order data from Razorpay or error
     */
    public static function createOrder($amount, $receipt, $notes = array())
    {
        $keyId = self::getKeyId();
        $keySecret = self::getKeySecret();

        if (empty($keyId) || empty($keySecret)) {
            return array('success' => false, 'error' => 'Razorpay API credentials not configured');
        }

        // Amount in Paise (e.g. ₹1.00 = 100 paise)
        $amountPaise = (int)round($amount * 100);
        if ($amountPaise < 100) { // Razorpay minimum is ₹1.00
            $amountPaise = 100;
        }

        $payload = array(
            'amount'   => $amountPaise,
            'currency' => 'INR',
            'receipt'  => substr($receipt, 0, 40),
            'notes'    => $notes,
            'payment_capture' => 1
        );

        $ch = curl_init('https://api.razorpay.com/v1/orders');
        curl_setopt($ch, CURLOPT_USERPWD, $keyId . ':' . $keySecret);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            return array('success' => false, 'error' => 'Razorpay connection failed: ' . $curlErr);
        }

        $result = json_decode($response, true);
        if ($httpCode >= 200 && $httpCode < 300 && isset($result['id'])) {
            return array(
                'success'  => true,
                'order_id' => $result['id'],
                'amount'   => $amount,
                'currency' => $result['currency'],
                'key_id'   => $keyId
            );
        }

        $errorMsg = isset($result['error']['description']) ? $result['error']['description'] : 'Failed to create Razorpay order';
        return array('success' => false, 'error' => $errorMsg, 'raw' => $result);
    }

    /**
     * Create Razorpay Hosted Payment Link (Works with UPI Intent on all mobile browsers & app wrappers)
     * @param float $amount Amount in Rupees
     * @param string $referenceId Internal Reference / Receipt ID
     * @param array $customer Customer/Driver details array('name', 'contact', 'email')
     * @param string $callbackUrl URL to redirect after payment
     * @param array $notes Custom metadata key-values
     * @return array
     */
    public static function createPaymentLink($amount, $referenceId, $customer = array(), $callbackUrl = '', $notes = array())
    {
        $keyId = self::getKeyId();
        $keySecret = self::getKeySecret();

        if (empty($keyId) || empty($keySecret)) {
            return array('success' => false, 'error' => 'Razorpay API credentials not configured');
        }

        $amountPaise = (int)round($amount * 100);
        if ($amountPaise < 100) {
            $amountPaise = 100;
        }

        $payload = array(
            'amount'          => $amountPaise,
            'currency'        => 'INR',
            'accept_partial'  => false,
            'reference_id'    => substr($referenceId, 0, 40),
            'description'     => 'Jitta Drives - Driver Wallet Recharge',
            'customer'        => array(
                'name'    => !empty($customer['name']) ? $customer['name'] : 'Jitta Captain',
                'contact' => !empty($customer['contact']) ? $customer['contact'] : '',
                'email'   => !empty($customer['email']) ? $customer['email'] : 'driver@jittadrives.com'
            ),
            'notify'          => array('sms' => false, 'email' => false),
            'reminder_enable' => false,
            'notes'           => $notes
        );

        if (!empty($callbackUrl)) {
            $payload['callback_url'] = $callbackUrl;
            $payload['callback_method'] = 'get';
        }

        $ch = curl_init('https://api.razorpay.com/v1/payment_links/');
        curl_setopt($ch, CURLOPT_USERPWD, $keyId . ':' . $keySecret);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            return array('success' => false, 'error' => 'Razorpay connection failed: ' . $curlErr);
        }

        $result = json_decode($response, true);
        if ($httpCode >= 200 && $httpCode < 300 && isset($result['short_url'])) {
            return array(
                'success'         => true,
                'payment_link_id' => $result['id'],
                'short_url'       => $result['short_url'],
                'amount'          => $amount,
                'key_id'          => $keyId
            );
        }

        $errorMsg = isset($result['error']['description']) ? $result['error']['description'] : 'Failed to create payment link';
        return array('success' => false, 'error' => $errorMsg, 'raw' => $result);
    }

    /**
     * Verify Razorpay Payment Signature
     * @param string $orderId Razorpay Order ID (order_xxx)
     * @param string $paymentId Razorpay Payment ID (pay_xxx)
     * @param string $signature Razorpay Signature received from frontend
     * @return bool True if valid, false otherwise
     */
    public static function verifySignature($orderId, $paymentId, $signature)
    {
        $keySecret = self::getKeySecret();
        if (empty($keySecret)) {
            return false;
        }

        $expectedSignature = hash_hmac('sha256', $orderId . '|' . $paymentId, $keySecret);
        return hash_equals($expectedSignature, $signature);
    }
}

