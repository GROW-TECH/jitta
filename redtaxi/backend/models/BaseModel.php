<?php
/**
 * RedTaxi Backend - Base Model
 * Provides database connection abstraction and common query execution utilities.
 */

require_once dirname(__DIR__) . '/config/database.php';
require_once dirname(__DIR__) . '/utils/SchemaHealer.php';

abstract class BaseModel
{
    /** @var PDO */
    protected $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
        // Automatically check and heal missing schema columns
        SchemaHealer::heal($this->db);
    }

    public function beginTransaction()
    {
        return $this->db->beginTransaction();
    }

    public function commit()
    {
        return $this->db->commit();
    }

    public function rollBack()
    {
        return $this->db->rollBack();
    }

    public function lastInsertId()
    {
        return $this->db->lastInsertId();
    }

    protected function query($sql, $params = array())
    {
        try {
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            return $stmt;
        } catch (PDOException $e) {
            // Auto-heal missing columns (Error 1054 / 42S22) and retry
            if ($e->getCode() == '42S22' || strpos($e->getMessage(), '1054') !== false || strpos($e->getMessage(), 'Unknown column') !== false) {
                $healLogs = array();
                SchemaHealer::heal($this->db, $healLogs, true);
                $stmt = $this->db->prepare($sql);
                $stmt->execute($params);
                return $stmt;
            }
            throw $e;
        }
    }

    protected function fetchOne($sql, $params = array())
    {
        $stmt = $this->query($sql, $params);
        $result = $stmt->fetch();
        return $result !== false ? $result : null;
    }

    protected function fetchAll($sql, $params = array())
    {
        $stmt = $this->query($sql, $params);
        return $stmt->fetchAll();
    }

    protected function execute($sql, $params = array())
    {
        $stmt = $this->query($sql, $params);
        return $stmt->rowCount();
    }
}
