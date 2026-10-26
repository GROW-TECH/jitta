<?php
/**
 * CLI Request Runner for Integration Testing
 */
if ($argc < 3) {
    echo json_encode(array('error' => 'Usage: php cli_request.php <URI> <METHOD> [JSON_PAYLOAD] [BEARER_TOKEN]'));
    exit(1);
}

$uri = $argv[1];
$method = strtoupper($argv[2]);
$payload = isset($argv[3]) && $argv[3] !== '' ? $argv[3] : null;
$token = isset($argv[4]) && $argv[4] !== '' ? $argv[4] : null;

$_SERVER['REQUEST_METHOD'] = $method;
$_SERVER['REQUEST_URI'] = $uri;

if ($token !== null) {
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
}

if ($payload !== null) {
    $GLOBALS['MOCK_JSON_INPUT'] = $payload;
}

require __DIR__ . '/api/v1/index.php';
