<?php
/**
 * RedTaxi Backend - Health & System Controller
 * Provides system status, API information, and database health verification.
 */

require_once __DIR__ . '/BaseController.php';
require_once dirname(__DIR__) . '/config/database.php';
require_once dirname(__DIR__) . '/config/env.php';

class HealthController extends BaseController
{
    public function index()
    {
        $data = array(
            'service'     => Env::get('APP_NAME', 'RedTaxi API'),
            'environment' => Env::get('APP_ENV', 'development'),
            'version'     => '1.0.0',
            'api_root'    => '/api/v1',
            'status'      => 'ONLINE',
            'server_time' => gmdate('Y-m-d\TH:i:s\Z')
        );

        Response::success($data, 'RedTaxi API v1 is operational');
    }

    public function health()
    {
        $dbStatus = 'DISCONNECTED';
        $dbDetails = null;
        $tableCount = 0;

        try {
            $db = Database::getInstance();
            $test = $db->testConnection();

            if ($test) {
                $dbStatus = 'CONNECTED';

                $pdo = $db->getConnection();
                $currentDb = isset($test['database_name']) ? $test['database_name'] : Env::get('DB_NAME', 'redtaxi_db');
                $countStmt = $pdo->prepare("SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ?");
                $countStmt->execute(array($currentDb));
                $countRow = $countStmt->fetch();
                $tableCount = $countRow ? (int)$countRow['total'] : 0;

                $dbDetails = array(
                    'database'      => $currentDb,
                    'mysql_version' => isset($test['mysql_version']) ? $test['mysql_version'] : 'Unknown',
                    'tables_found'  => $tableCount
                );
            }
        } catch (Exception $e) {
            $dbStatus = 'ERROR: ' . $e->getMessage();
        }

        $isHealthy = ($dbStatus === 'CONNECTED');

        $payload = array(
            'status'   => $isHealthy ? 'HEALTHY' : 'DEGRADED',
            'api'      => 'ONLINE',
            'database' => array(
                'status'  => $dbStatus,
                'details' => $dbDetails
            ),
            'system'   => array(
                'php_version'    => PHP_VERSION,
                'server_time_utc' => gmdate('Y-m-d\TH:i:s\Z')
            )
        );

        Response::json($payload, $isHealthy ? 200 : 503, $isHealthy ? 'All systems functional' : 'System degraded');
    }
}
