<?php
/**
 * RedTaxi Backend - Security & Token Utility
 * Handles password hashing (BCRYPT), HMAC-SHA256 token generation,
 * and verification. Compatible with PHP 5.6+.
 */

require_once dirname(__DIR__) . '/config/env.php';

class Security
{
    /**
     * Hashes a plain-text password using PHP's native BCRYPT algorithm.
     *
     * @param string $password
     * @return string
     */
    public static function hashPassword($password)
    {
        return password_hash($password, PASSWORD_BCRYPT, array('cost' => 10));
    }

    /**
     * Verifies a password against a stored bcrypt hash.
     *
     * @param string $password
     * @param string $hash
     * @return bool
     */
    public static function verifyPassword($password, $hash)
    {
        if (empty($hash)) {
            return false;
        }
        return password_verify($password, $hash);
    }

    /**
     * Generates a signed, stateless authentication token (HMAC-SHA256).
     *
     * @param string $userId User ID (UUID)
     * @param string $role 'customer' or 'driver' or 'admin'
     * @param array $extra Optional extra payload data
     * @param int $ttlSeconds Time to live (default: 30 days)
     * @return string Token in format: base64(header).base64(payload).signature
     */
    public static function generateToken($userId, $role, $extra = array(), $ttlSeconds = 2592000)
    {
        $secret = Env::get('JWT_SECRET', 'redtaxi_secret_key_change_in_production_2026');

        $header = array(
            'typ' => 'JWT',
            'alg' => 'HS256'
        );

        $now = time();
        $payload = array_merge(array(
            'sub'  => (string)$userId,
            'role' => (string)$role,
            'iat'  => $now,
            'exp'  => $now + $ttlSeconds
        ), $extra);

        $base64Header  = self::base64UrlEncode(json_encode($header));
        $base64Payload = self::base64UrlEncode(json_encode($payload));

        $signature = hash_hmac('sha256', $base64Header . '.' . $base64Payload, $secret, true);
        $base64Signature = self::base64UrlEncode($signature);

        return $base64Header . '.' . $base64Payload . '.' . $base64Signature;
    }

    /**
     * Validates and decodes a signed authentication token.
     *
     * @param string $token
     * @return array|false Payload array if valid, false if invalid or expired
     */
    public static function verifyToken($token)
    {
        if (empty($token) || !is_string($token)) {
            return false;
        }

        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return false;
        }

        list($base64Header, $base64Payload, $base64Signature) = $parts;

        $secret = Env::get('JWT_SECRET', 'redtaxi_secret_key_change_in_production_2026');
        $expectedSignature = self::base64UrlEncode(
            hash_hmac('sha256', $base64Header . '.' . $base64Payload, $secret, true)
        );

        // Timing-attack safe comparison (hash_equals available in PHP 5.6+)
        if (function_exists('hash_equals')) {
            if (!hash_equals($expectedSignature, $base64Signature)) {
                return false;
            }
        } else {
            if ($expectedSignature !== $base64Signature) {
                return false;
            }
        }

        $payloadJson = self::base64UrlDecode($base64Payload);
        $payload = json_decode($payloadJson, true);

        if (!is_array($payload) || !isset($payload['exp']) || !isset($payload['sub'])) {
            return false;
        }

        // Expiration check
        if ($payload['exp'] < time()) {
            return false;
        }

        return $payload;
    }

    /**
     * Generates a UUID v4 string.
     *
     * @param string $prefix Optional prefix (e.g. 'CUST-')
     * @return string
     */
    public static function generateUUID($prefix = '')
    {
        if (function_exists('openssl_random_pseudo_bytes')) {
            $data = openssl_random_pseudo_bytes(16);
            $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // set version to 0100
            $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // set bits 6-7 to 10
            $uuid = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
        } else {
            $uuid = sprintf(
                '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );
        }

        return $prefix ? $prefix . substr($uuid, strlen($prefix)) : $uuid;
    }

    /**
     * Generates a numeric OTP code.
     *
     * @param int $digits Length of OTP (default: 4)
     * @return string
     */
    public static function generateOtp($digits = 4)
    {
        $min = pow(10, $digits - 1);
        $max = pow(10, $digits) - 1;
        return (string)mt_rand($min, $max);
    }

    public static function base64UrlEncode($data)
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    public static function base64UrlDecode($data)
    {
        return base64_decode(str_pad(strtr($data, '-_', '+/'), strlen($data) % 4, '=', STR_PAD_RIGHT));
    }
}
