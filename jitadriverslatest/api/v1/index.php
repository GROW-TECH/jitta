<?php
/**
 * RedTaxi Backend - Main API Entry Point for /api/v1/
 */

// Error reporting settings based on environment
error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once dirname(dirname(__DIR__)) . '/config/env.php';
Env::load();

if (Env::get('APP_DEBUG', true)) {
    ini_set('display_errors', 1);
}

/** @var Router $router */
$router = require_once dirname(dirname(__DIR__)) . '/routes/api.php';

// Dispatch incoming request with clean JSON error handling
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
