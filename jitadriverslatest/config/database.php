<?php
/**
 * RedTaxi Backend - Database Connection Manager
 * Manages PDO instance with UTF-8, connection pooling/singleton pattern,
 * and robust error handling.
 */

require_once __DIR__ . '/env.php';

class Database
{
    private static $instance = null;
    private $pdo = null;

    private $host;
    private $port;
    private $dbName;
    private $user;
    private $pass;
    private $charset;

    private function __construct()
    {
        $this->host    = Env::get('DB_HOST', '127.0.0.1');
        $this->port    = Env::get('DB_PORT', '3306');
        $this->dbName  = Env::get('DB_NAME', 'redtaxi_db');
        $this->user    = Env::get('DB_USER', 'root');
        $this->pass    = Env::get('DB_PASS', '');
        $this->charset = Env::get('DB_CHARSET', 'utf8mb4');

        $this->connect();
    }

    private function connect()
    {
        $dsn = "mysql:host={$this->host};port={$this->port};dbname={$this->dbName};charset={$this->charset}";

        $options = array(
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$this->charset} COLLATE utf8mb4_unicode_ci"
        );

        try {
            date_default_timezone_set('Asia/Kolkata');
            $this->pdo = new PDO($dsn, $this->user, $this->pass, $options);
            try {
                $this->pdo->exec("SET time_zone = '+05:30'");
            } catch (Exception $tzEx) {}
        } catch (PDOException $e) {
            error_log("Database connection failed: " . $e->getMessage());
            throw new Exception("Database connection failed for user '{$this->user}' on database '{$this->dbName}'. Please check api/.env or open api/setup.php in your browser to configure credentials. Technical error: " . $e->getMessage());
        }
    }

    public static function getInstance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection()
    {
        if ($this->pdo === null) {
            $this->connect();
        }
        return $this->pdo;
    }

    public function testConnection()
    {
        try {
            $stmt = $this->pdo->query("SELECT 1 AS connected, DATABASE() AS database_name, VERSION() AS mysql_version");
            return $stmt->fetch();
        } catch (PDOException $e) {
            return false;
        }
    }

    // Prevent cloning and unserialization of singleton
    private function __clone() {}
    public function __wakeup()
    {
        throw new Exception("Cannot unserialize singleton");
    }
}
