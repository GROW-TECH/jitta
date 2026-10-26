<?php
/**
 * RedTaxi Backend - Base Controller
 * Base controller providing request body parsers, validation helpers,
 * and standardized response integration.
 */

require_once dirname(__DIR__) . '/utils/Response.php';

abstract class BaseController
{
    /**
     * Reads and parses raw JSON from the php://input request stream.
     *
     * @param bool $assoc Return associative array if true
     * @return array|null
     */
    protected function getJsonInput($assoc = true)
    {
        $raw = isset($GLOBALS['MOCK_JSON_INPUT']) ? $GLOBALS['MOCK_JSON_INPUT'] : file_get_contents('php://input');
        if (empty($raw)) {
            return array();
        }

        $decoded = json_decode($raw, $assoc);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $msg = function_exists('json_last_error_msg') ? json_last_error_msg() : 'Syntax error';
            Response::badRequest('Malformed JSON payload: ' . $msg);
        }

        return $decoded;
    }

    /**
     * Safely get a query parameter from $_GET.
     *
     * @param string $key
     * @param mixed $default
     * @return mixed
     */
    protected function getQueryParam($key, $default = null)
    {
        return isset($_GET[$key]) ? trim($_GET[$key]) : $default;
    }

    /**
     * Validates that required keys exist and are not empty in array data.
     *
     * @param array $data
     * @param array $requiredFields
     * @return array List of missing field names (empty if valid)
     */
    protected function validateRequired($data, $requiredFields)
    {
        $missing = array();
        foreach ($requiredFields as $field) {
            if (!isset($data[$field]) || (is_string($data[$field]) && trim($data[$field]) === '')) {
                $missing[] = $field;
            }
        }
        return $missing;
    }

    /**
     * Assert required fields exist or exit with 400 Bad Request.
     *
     * @param array $data
     * @param array $requiredFields
     */
    protected function requireFields($data, $requiredFields)
    {
        $missing = $this->validateRequired($data, $requiredFields);
        if (!empty($missing)) {
            Response::badRequest('Missing required fields: ' . implode(', ', $missing), array('missing' => $missing));
        }
    }

    /**
     * Exit with 422 Unprocessable Entity for input validation errors.
     *
     * @param string $message
     * @param array|null $errors
     */
    protected function validationError($message, $errors = null)
    {
        Response::unprocessableEntity($message, $errors);
    }

    /**
     * Cleans and validates Indian phone numbers.
     * Strips non-digits, leading country code (+91/91), and verifies 10-digit format starting with 6-9.
     *
     * @param string $phone
     * @return string|false Cleaned 10-digit number or false if invalid
     */
    protected function cleanAndValidatePhone($phone)
    {
        if (empty($phone) || !is_string($phone)) {
            return false;
        }

        $cleaned = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($cleaned) === 12 && substr($cleaned, 0, 2) === '91') {
            $cleaned = substr($cleaned, 2);
        } elseif (strlen($cleaned) === 11 && substr($cleaned, 0, 1) === '0') {
            $cleaned = substr($cleaned, 1);
        }

        if (preg_match('/^[6-9]\d{9}$/', $cleaned)) {
            return $cleaned;
        }

        return false;
    }

    /**
     * Validates email address format and length.
     *
     * @param string $email
     * @return bool
     */
    protected function validateEmail($email)
    {
        if (empty($email) || !is_string($email) || strlen($email) > 150) {
            return false;
        }
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Validates password strength & limits.
     *
     * @param string $password
     * @param int $min
     * @param int $max
     * @return bool
     */
    protected function validatePassword($password, $min = 6, $max = 128)
    {
        if (!is_string($password)) {
            return false;
        }
        $len = strlen($password);
        return ($len >= $min && $len <= $max);
    }

    /**
     * Validates geographic coordinates (latitude and longitude).
     *
     * @param mixed $lat
     * @param mixed $lng
     * @return bool
     */
    protected function validateCoordinates($lat, $lng)
    {
        if (!is_numeric($lat) || !is_numeric($lng)) {
            return false;
        }
        $latVal = (float)$lat;
        $lngVal = (float)$lng;
        return ($latVal >= -90.0 && $latVal <= 90.0 && $lngVal >= -180.0 && $lngVal <= 180.0);
    }
}
