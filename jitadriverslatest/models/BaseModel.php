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

    public function execute($sql, $params = array())
    {
        $stmt = $this->query($sql, $params);
        return $stmt->rowCount();
    }

    /**
     * Promotes PENDING driver registrations older than 5 minutes to APPROVED.
     * Leaves REJECTED / SUSPENDED / DELETED drivers untouched.
     */
    protected function autoApproveMaturePendingDrivers($driverId = null)
    {
        try {
            if ($driverId !== null && $driverId !== '') {
                $this->query(
                    "UPDATE `drivers` SET `approval_status` = 'APPROVED', `updated_at` = NOW() WHERE `id` = ? AND `approval_status` = 'PENDING' AND `created_at` <= DATE_SUB(NOW(), INTERVAL 5 MINUTE)",
                    array($driverId)
                );
            } else {
                $this->query(
                    "UPDATE `drivers` SET `approval_status` = 'APPROVED', `updated_at` = NOW() WHERE `approval_status` = 'PENDING' AND `created_at` <= DATE_SUB(NOW(), INTERVAL 5 MINUTE)"
                );
            }
        } catch (Exception $e) {
            // Non-fatal if schema columns differ
        }
    }
}
