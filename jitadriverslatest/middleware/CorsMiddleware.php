<?php
/**
 * RedTaxi Backend - CORS Middleware
 * Applies CORS policy to all API requests.
 */

require_once dirname(__DIR__) . '/config/cors.php';

class CorsMiddleware
{
    public static function handle()
    {
        Cors::handle();
    }
}
