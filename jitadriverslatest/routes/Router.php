<?php
/**
 * RedTaxi Backend - REST Router
 * Supports HTTP methods, route parameters, prefixing, and middleware execution.
 */

require_once dirname(__DIR__) . '/utils/Response.php';

class Router
{
    private $routes = array();
    private $prefix = '';
    private $middlewares = array();

    public function __construct($prefix = '')
    {
        $this->prefix = rtrim($prefix, '/');
    }

    public function addMiddleware($middleware)
    {
        $this->middlewares[] = $middleware;
    }

    public function get($path, $handler)
    {
        $this->addRoute('GET', $path, $handler);
    }

    public function post($path, $handler)
    {
        $this->addRoute('POST', $path, $handler);
    }

    public function put($path, $handler)
    {
        $this->addRoute('PUT', $path, $handler);
    }

    public function patch($path, $handler)
    {
        $this->addRoute('PATCH', $path, $handler);
    }

    public function delete($path, $handler)
    {
        $this->addRoute('DELETE', $path, $handler);
    }

    private function addRoute($method, $path, $handler)
    {
        $fullPath = $this->prefix . '/' . ltrim($path, '/');
        $fullPath = rtrim($fullPath, '/');
        if (empty($fullPath)) {
            $fullPath = '/';
        }

        $this->routes[] = array(
            'method'  => strtoupper($method),
            'path'    => $fullPath,
            'pattern' => $this->convertPathToRegex($fullPath),
            'handler' => $handler
        );
    }

    private function convertPathToRegex($path)
    {
        // Replace {param} with named capturing group or regex pattern
        $pattern = preg_replace('/\{([a-zA-Z0-9_]+)\}/', '(?P<$1>[^/]+)', $path);
        return '#^' . $pattern . '$#';
    }

    public function dispatch($requestMethod = null, $requestUri = null)
    {
        // Run global router middlewares
        foreach ($this->middlewares as $mw) {
            if (is_callable($mw)) {
                call_user_func($mw);
            } elseif (is_string($mw) && class_exists($mw) && method_exists($mw, 'handle')) {
                call_user_func(array($mw, 'handle'));
            }
        }

        if ($requestMethod === null) {
            $requestMethod = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
        }

        if ($requestUri === null) {
            $requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
        }

        // Parse path without query string
        $path = parse_url($requestUri, PHP_URL_PATH);
        $path = rtrim($path, '/');
        if (empty($path)) {
            $path = '/';
        }

        // Normalize subfolder paths (e.g. /redtaxi/api/v1/... -> /api/v1/...)
        if (strpos($path, '/api/v1') !== false) {
            $path = substr($path, strpos($path, '/api/v1'));
        } elseif (strpos($path, '/v1/') !== false) {
            $path = '/api' . substr($path, strpos($path, '/v1/'));
        }

        $methodMatched = false;

        foreach ($this->routes as $route) {
            if (preg_match($route['pattern'], $path, $matches)) {
                if ($route['method'] === $requestMethod) {
                    // Extract named parameters
                    $params = array();
                    foreach ($matches as $key => $value) {
                        if (!is_int($key)) {
                            $params[$key] = $value;
                        }
                    }

                    $this->invokeHandler($route['handler'], $params);
                    return;
                } else {
                    $methodMatched = true;
                }
            }
        }

        if ($methodMatched) {
            Response::methodNotAllowed("HTTP {$requestMethod} is not supported on {$path}");
        } else {
            Response::notFound("Endpoint not found: {$requestMethod} {$path}");
        }
    }

    private function invokeHandler($handler, $params)
    {
        try {
            if (is_array($handler) && count($handler) === 2) {
                list($class, $method) = $handler;

                if (is_string($class)) {
                    if (!class_exists($class)) {
                        Response::serverError("Controller class '{$class}' not found");
                    }
                    $instance = new $class();
                } else {
                    $instance = $class;
                }

                if (!method_exists($instance, $method)) {
                    Response::serverError("Controller method '{$method}' does not exist on class");
                }

                call_user_func_array(array($instance, $method), array($params));
                return;
            }

            if (is_callable($handler)) {
                call_user_func_array($handler, array($params));
                return;
            }

            Response::serverError("Invalid route handler configured");
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
    }
}
