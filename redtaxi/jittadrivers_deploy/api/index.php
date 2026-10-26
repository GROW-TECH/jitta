<?php
/**
 * RedTaxi Backend - Main Application Front Controller
 * Handles incoming HTTP traffic and forwards to the API v1 router.
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);

if (php_sapi_name() === 'cli-server') {
    $urlPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if ($urlPath !== '/' && file_exists(__DIR__ . $urlPath) && !is_dir(__DIR__ . $urlPath)) {
        return false;
    }
}

require_once __DIR__ . '/config/env.php';
Env::load();

if (Env::get('APP_DEBUG', true)) {
    ini_set('display_errors', 1);
}

// Load router with API v1 routes
/** @var Router $router */
$router = require_once __DIR__ . '/routes/api.php';

// If requested URL is the root '/', direct to /api/v1
$requestUri = isset($_SERVER['REQUEST_URI']) ? parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) : '/';
if ($requestUri === '' || $requestUri === '/') {
    $_SERVER['REQUEST_URI'] = '/api/v1';
}

// Dispatch to router with clean JSON error handling
try {
    $router->dispatch();
} catch (\Throwable $e) {
    $msg = $e->getMessage();
    if (stripos($msg, 'Database connection') !== false || stripos($msg, 'SQLSTATE') !== false || stripos($msg, 'PDOException') !== false) {
        Response::serviceUnavailable('Database connection failed. Please verify your database credentials in api/.env or open api/setup.php in your browser to configure.', array(
            'setup_url' => 'setup.php',
            'detail'    => $msg
        ));
    } else {
        Response::serverError($msg);
    }
}
