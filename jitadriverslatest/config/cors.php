<?php
/**
 * RedTaxi Backend - CORS Configuration
 * Manages Cross-Origin Resource Sharing headers and preflight requests.
 */

require_once __DIR__ . '/env.php';

class Cors
{
    public static function handle()
    {
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
        $allowedOrigins = Env::get('CORS_ALLOWED_ORIGINS', '*');
        $allowedMethods = Env::get('CORS_ALLOWED_METHODS', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        $allowedHeaders = Env::get('CORS_ALLOWED_HEADERS', 'Content-Type, Authorization, X-Requested-With, X-Admin-Token, X-Driver-Token, x-admin-token, x-driver-token, X-Auth-Token, x-auth-token, X-Customer-Token, x-customer-token');
        $allowCredentials = Env::get('CORS_ALLOW_CREDENTIALS', true);
        $maxAge = Env::get('CORS_MAX_AGE', 86400);

        header('Vary: Origin');

        // Origin check
        if ($allowedOrigins === '*') {
            header('Access-Control-Allow-Origin: *');
        } else {
            $originsList = array_map('trim', explode(',', $allowedOrigins));
            if (in_array($origin, $originsList, true)) {
                header("Access-Control-Allow-Origin: {$origin}");
            }
        }

        header("Access-Control-Allow-Methods: {$allowedMethods}");
        header("Access-Control-Allow-Headers: {$allowedHeaders}");
        header("Access-Control-Max-Age: {$maxAge}");

        if ($allowCredentials && $allowedOrigins !== '*') {
            header('Access-Control-Allow-Credentials: true');
        }

        // Handle preflight OPTIONS request
        if (isset($_SERVER['REQUEST_METHOD']) && strtoupper($_SERVER['REQUEST_METHOD']) === 'OPTIONS') {
            if (function_exists('http_response_code')) {
                http_response_code(204);
            } else {
                header('HTTP/1.1 204 No Content', true, 204);
            }
            exit(0);
        }
    }
}
