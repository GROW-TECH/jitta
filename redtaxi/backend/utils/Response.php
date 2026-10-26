<?php
/**
 * RedTaxi Backend - JSON Response Helper
 * Provides consistent, structured API responses across all endpoints.
 */

require_once dirname(__DIR__) . '/config/env.php';

class Response
{
    public static function json($data = null, $statusCode = 200, $message = null, $meta = null)
    {
        // Clear any previous output buffers to avoid broken JSON
        if (ob_get_level() > 0) {
            ob_clean();
        }

        if (function_exists('http_response_code')) {
            http_response_code($statusCode);
        } else {
            header('HTTP/1.1 ' . $statusCode, true, $statusCode);
        }
        header('Content-Type: application/json; charset=utf-8');

        $isSuccess = ($statusCode >= 200 && $statusCode < 300);

        $response = array(
            'success'    => $isSuccess,
            'statusCode' => $statusCode,
            'message'    => $message ? $message : ($isSuccess ? 'Success' : 'An error occurred'),
            'data'       => $data,
            'timestamp'  => gmdate('Y-m-d\TH:i:s\Z')
        );

        if ($meta !== null) {
            $response['meta'] = $meta;
        }

        $jsonFlags = 0;
        if (defined('JSON_UNESCAPED_SLASHES')) {
            $jsonFlags |= JSON_UNESCAPED_SLASHES;
        }
        if (defined('JSON_UNESCAPED_UNICODE')) {
            $jsonFlags |= JSON_UNESCAPED_UNICODE;
        }

        echo json_encode($response, $jsonFlags);
        exit(0);
    }

    public static function success($data = null, $message = 'Operation successful', $statusCode = 200, $meta = null)
    {
        return self::json($data, $statusCode, $message, $meta);
    }

    public static function created($data = null, $message = 'Resource created successfully')
    {
        return self::json($data, 201, $message);
    }

    public static function error($message = 'An error occurred', $statusCode = 400, $errors = null)
    {
        if (ob_get_level() > 0) {
            ob_clean();
        }

        if (function_exists('http_response_code')) {
            http_response_code($statusCode);
        } else {
            header('HTTP/1.1 ' . $statusCode, true, $statusCode);
        }
        header('Content-Type: application/json; charset=utf-8');

        $response = array(
            'success'    => false,
            'statusCode' => $statusCode,
            'message'    => $message,
            'errors'     => $errors,
            'timestamp'  => gmdate('Y-m-d\TH:i:s\Z')
        );

        $jsonFlags = 0;
        if (defined('JSON_UNESCAPED_SLASHES')) {
            $jsonFlags |= JSON_UNESCAPED_SLASHES;
        }
        if (defined('JSON_UNESCAPED_UNICODE')) {
            $jsonFlags |= JSON_UNESCAPED_UNICODE;
        }

        echo json_encode($response, $jsonFlags);
        exit(0);
    }

    public static function badRequest($message = 'Bad request', $errors = null)
    {
        return self::error($message, 400, $errors);
    }

    public static function unauthorized($message = 'Authentication required')
    {
        return self::error($message, 401);
    }

    public static function forbidden($message = 'Access denied')
    {
        return self::error($message, 403);
    }

    public static function notFound($message = 'Resource not found')
    {
        return self::error($message, 404);
    }

    public static function methodNotAllowed($message = 'HTTP method not allowed')
    {
        return self::error($message, 405);
    }

    public static function unprocessableEntity($message = 'Validation failed', $errors = null)
    {
        return self::error($message, 422, $errors);
    }

    public static function conflict($message = 'Resource conflict', $errors = null)
    {
        return self::error($message, 409, $errors);
    }

    public static function serviceUnavailable($message = 'Service temporarily unavailable', $errors = null)
    {
        return self::error($message, 503, $errors);
    }

    public static function serverError($message = 'Internal server error', $errors = null)
    {
        // Always log raw error internally
        error_log("[SERVER_ERROR] " . (is_string($message) ? $message : json_encode($message)));

        // Mask technical internal errors in non-debug mode
        $isDebug = class_exists('Env') && Env::get('APP_DEBUG', false);
        $safeMessage = 'An internal server error occurred. Please try again later.';

        if (!$isDebug) {
            // Check if message looks like internal code/SQL leak
            if (stripos($message, 'SQLSTATE') !== false || stripos($message, 'PDOException') !== false || stripos($message, 'database') !== false || stripos($message, 'Stack trace') !== false) {
                $message = $safeMessage;
                $errors = null;
            }
        }

        return self::error($message, 500, $errors);
    }
}
