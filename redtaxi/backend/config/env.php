<?php
/**
 * RedTaxi Backend - Environment Loader
 * Loads key-value pairs from .env into getenv() and $_ENV
 */

class Env
{
    private static $loaded = false;

    public static function load($path = null)
    {
        if (self::$loaded) {
            return;
        }

        if ($path === null) {
            $path = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
        }

        if (!file_exists($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            return;
        }

        foreach ($lines as $line) {
            $line = trim($line);

            // Skip comments
            if (empty($line) || strpos($line, '#') === 0) {
                continue;
            }

            // Parse key=value
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);

                // Strip surrounding quotes
                if (preg_match('/^(["\'])(.*)\1$/', $value, $matches)) {
                    $value = $matches[2];
                }

                if (!array_key_exists($key, $_ENV)) {
                    $_ENV[$key] = $value;
                }
                if (!array_key_exists($key, $_SERVER)) {
                    $_SERVER[$key] = $value;
                }
                putenv("{$key}={$value}");
            }
        }

        self::$loaded = true;
    }

    public static function get($key, $default = null)
    {
        self::load();

        $val = getenv($key);
        if ($val !== false) {
            return self::parseValue($val);
        }

        if (isset($_ENV[$key])) {
            return self::parseValue($_ENV[$key]);
        }

        if (isset($_SERVER[$key])) {
            return self::parseValue($_SERVER[$key]);
        }

        return $default;
    }

    private static function parseValue($value)
    {
        switch (strtolower($value)) {
            case 'true':
            case '(true)':
                return true;
            case 'false':
            case '(false)':
                return false;
            case 'empty':
            case '(empty)':
                return '';
            case 'null':
            case '(null)':
                return null;
        }
        return $value;
    }
}
