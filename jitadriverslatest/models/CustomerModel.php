<?php
/**
 * RedTaxi Backend - Customer Model
 * Handles customer queries, profile updates, saved places,
 * wallet transactions, and notifications. Compatible with PHP 5.6+.
 */

require_once __DIR__ . '/BaseModel.php';
require_once dirname(__DIR__) . '/utils/Security.php';

class CustomerModel extends BaseModel
{
    public function findByPhone($phone)
    {
        $sql = "SELECT c.*, ci.name AS city_name, w.balance AS wallet_balance, w.id AS wallet_id
                FROM `customers` c
                LEFT JOIN `cities` ci ON ci.id = c.city_id
                LEFT JOIN `customer_wallets` w ON w.customer_id = c.id
                WHERE c.phone = ? AND (c.status IS NULL OR c.status != 'DELETED') AND c.phone NOT LIKE 'DEL_%'
                LIMIT 1";
        return $this->fetchOne($sql, array($phone));
    }

    public function findById($id)
    {
        $sql = "SELECT c.*, ci.name AS city_name, w.balance AS wallet_balance, w.id AS wallet_id
                FROM `customers` c
                LEFT JOIN `cities` ci ON ci.id = c.city_id
                LEFT JOIN `customer_wallets` w ON w.customer_id = c.id
                WHERE c.id = ? AND (c.status IS NULL OR c.status != 'DELETED') AND c.phone NOT LIKE 'DEL_%'
                LIMIT 1";
        return $this->fetchOne($sql, array($id));
    }

    public function findLatestCustomer()
    {
        $sql = "SELECT c.*, ci.name AS city_name, w.balance AS wallet_balance, w.id AS wallet_id
                FROM `customers` c
                LEFT JOIN `cities` ci ON ci.id = c.city_id
                LEFT JOIN `customer_wallets` w ON w.customer_id = c.id
                ORDER BY c.created_at DESC
                LIMIT 1";
        return $this->fetchOne($sql);
    }

    public function findByEmail($email)
    {
        if (empty($email)) {
            return null;
        }
        $sql = "SELECT c.*, ci.name AS city_name, w.balance AS wallet_balance, w.id AS wallet_id
                FROM `customers` c
                LEFT JOIN `cities` ci ON ci.id = c.city_id
                LEFT JOIN `customer_wallets` w ON w.customer_id = c.id
                WHERE c.email = ? AND (c.status IS NULL OR c.status != 'DELETED') AND c.email NOT LIKE 'del_%'
                LIMIT 1";
        return $this->fetchOne($sql, array($email));
    }

    public function createCustomer($data)
    {
        $id = isset($data['id']) ? $data['id'] : Security::generateUUID();
        $name = $data['name'];
        $phone = $data['phone'];
        $email = isset($data['email']) && !empty($data['email']) ? $data['email'] : null;
        $passwordHash = isset($data['password_hash']) ? $data['password_hash'] : null;
        $avatarUrl = isset($data['avatar_url']) ? $data['avatar_url'] : null;
        $cityId = isset($data['city_id']) ? (int)$data['city_id'] : null;

        $this->beginTransaction();

        try {
            // Clear any prior deleted customer row holding this phone or email
            try {
                $this->query("UPDATE `customers` SET `phone` = CONCAT('DEL_', UNIX_TIMESTAMP(), '_', `phone`), `email` = CONCAT('del_', UNIX_TIMESTAMP(), '_', COALESCE(`email`, 'u@jitta.com')) WHERE (`phone` = ? OR (`email` IS NOT NULL AND `email` = ?)) AND `status` = 'DELETED'", array($phone, $email));
            } catch (Exception $delEx) {}

            $sql = "INSERT INTO `customers` (`id`, `name`, `phone`, `email`, `password_hash`, `avatar_url`, `city_id`, `status`, `total_rides`, `created_at`)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0, NOW())";
            $this->query($sql, array($id, $name, $phone, $email, $passwordHash, $avatarUrl, $cityId));

            // Initialize customer wallet with ₹500 starter balance for instant testing
            $walletId = Security::generateUUID();
            $walletSql = "INSERT INTO `customer_wallets` (`id`, `customer_id`, `balance`, `is_active`)
                          VALUES (?, ?, 500.00, 1)";
            $this->query($walletSql, array($walletId, $id));

            $this->commit();

            return $this->findById($id);
        } catch (Exception $e) {
            $this->rollBack();
            throw $e;
        }
    }

    public function updateProfile($id, $data)
    {
        $fields = array();
        $params = array();

        if (array_key_exists('name', $data) && $data['name'] !== null) {
            $fields[] = "`name` = ?";
            $params[] = trim($data['name']);
        }

        if (array_key_exists('email', $data)) {
            $fields[] = "`email` = ?";
            $params[] = !empty($data['email']) ? trim($data['email']) : null;
        }

        if (array_key_exists('avatar_url', $data)) {
            $fields[] = "`avatar_url` = ?";
            $params[] = !empty($data['avatar_url']) ? trim($data['avatar_url']) : null;
        }

        if (array_key_exists('city_id', $data)) {
            $fields[] = "`city_id` = ?";
            $params[] = !empty($data['city_id']) ? (int)$data['city_id'] : null;
        }

        if (empty($fields)) {
            return $this->findById($id);
        }

        $params[] = $id;
        $sql = "UPDATE `customers` SET " . implode(', ', $fields) . ", `updated_at` = NOW() WHERE `id` = ?";
        $this->execute($sql, $params);

        return $this->findById($id);
    }

    // -------------------------------------------------------------
    // Saved Places (Home / Work / Other)
    // -------------------------------------------------------------

    public function getSavedPlaces($customerId)
    {
        $sql = "SELECT `id`, `label`, `custom_label`, `address`, `lat`, `lng`, `created_at`
                FROM `customer_saved_places`
                WHERE `customer_id` = ?
                ORDER BY
                    CASE `label`
                        WHEN 'Home' THEN 1
                        WHEN 'Work' THEN 2
                        ELSE 3
                    END,
                    `created_at` DESC";
        return $this->fetchAll($sql, array($customerId));
    }

    public function findSavedPlace($customerId, $placeId)
    {
        $sql = "SELECT * FROM `customer_saved_places` WHERE `customer_id` = ? AND `id` = ? LIMIT 1";
        return $this->fetchOne($sql, array($customerId, $placeId));
    }

    public function addSavedPlace($customerId, $data)
    {
        $id = Security::generateUUID();
        $label = $data['label'];
        $customLabel = isset($data['custom_label']) ? trim($data['custom_label']) : null;
        $address = trim($data['address']);
        $lat = (float)$data['lat'];
        $lng = (float)$data['lng'];

        $sql = "INSERT INTO `customer_saved_places` (`id`, `customer_id`, `label`, `custom_label`, `address`, `lat`, `lng`, `created_at`)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW())";
        $this->query($sql, array($id, $customerId, $label, $customLabel, $address, $lat, $lng));

        return $this->findSavedPlace($customerId, $id);
    }

    public function updateSavedPlace($customerId, $placeId, $data)
    {
        $existing = $this->findSavedPlace($customerId, $placeId);
        if (!$existing) {
            return null;
        }

        $label = isset($data['label']) ? $data['label'] : $existing['label'];
        $customLabel = array_key_exists('custom_label', $data) ? $data['custom_label'] : $existing['custom_label'];
        $address = isset($data['address']) ? trim($data['address']) : $existing['address'];
        $lat = isset($data['lat']) ? (float)$data['lat'] : (float)$existing['lat'];
        $lng = isset($data['lng']) ? (float)$data['lng'] : (float)$existing['lng'];

        $sql = "UPDATE `customer_saved_places`
                SET `label` = ?, `custom_label` = ?, `address` = ?, `lat` = ?, `lng` = ?
                WHERE `id` = ? AND `customer_id` = ?";
        $this->execute($sql, array($label, $customLabel, $address, $lat, $lng, $placeId, $customerId));

        return $this->findSavedPlace($customerId, $placeId);
    }

    public function deleteSavedPlace($customerId, $placeId)
    {
        $sql = "DELETE FROM `customer_saved_places` WHERE `id` = ? AND `customer_id` = ?";
        return $this->execute($sql, array($placeId, $customerId));
    }

    // -------------------------------------------------------------
    // Wallet & Transactions
    // -------------------------------------------------------------

    public function getWalletDetails($customerId)
    {
        $sql = "SELECT `id`, `balance`, `is_active`, `updated_at`
                FROM `customer_wallets`
                WHERE `customer_id` = ?
                LIMIT 1";
        $wallet = $this->fetchOne($sql, array($customerId));

        if (!$wallet) {
            // Auto-create wallet if missing
            $walletId = Security::generateUUID();
            $this->query("INSERT INTO `customer_wallets` (`id`, `customer_id`, `balance`, `is_active`) VALUES (?, ?, 0.00, 1)", array($walletId, $customerId));
            return array(
                'id'         => $walletId,
                'balance'    => '0.00',
                'is_active'  => 1,
                'updated_at' => date('Y-m-d H:i:s')
            );
        }

        return $wallet;
    }

    public function getWalletTransactions($customerId, $limit = 50, $offset = 0)
    {
        $sql = "SELECT `id`, `type`, `amount`, `description`, `reference_id`, `created_at`
                FROM `customer_wallet_transactions`
                WHERE `customer_id` = ?
                ORDER BY `created_at` DESC
                LIMIT ? OFFSET ?";

        // In PDO emulated prepares false, integer limits must be bound as ints
        $stmt = $this->db->prepare($sql);
        $stmt->bindValue(1, $customerId, PDO::PARAM_STR);
        $stmt->bindValue(2, (int)$limit, PDO::PARAM_INT);
        $stmt->bindValue(3, (int)$offset, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    // -------------------------------------------------------------
    // Notifications
    // -------------------------------------------------------------

    public function getNotifications($customerId, $limit = 30)
    {
        $sql = "SELECT `id`, `title`, `message`, `type`, `is_read`, `data_payload`, `created_at`
                FROM `notifications`
                WHERE (`user_id` = ? AND `user_type` = 'CUSTOMER')
                   OR (`audience` IN ('ALL', 'CUSTOMERS') AND `user_id` IS NULL)
                ORDER BY `created_at` DESC
                LIMIT ?";

        $stmt = $this->db->prepare($sql);
        $stmt->bindValue(1, $customerId, PDO::PARAM_STR);
        $stmt->bindValue(2, (int)$limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['is_read'] = (bool)$row['is_read'];
            if (!empty($row['data_payload'])) {
                $row['data_payload'] = json_decode($row['data_payload'], true);
            }
        }

        return $rows;
    }

    public function markNotificationRead($customerId, $notificationId)
    {
        $sql = "UPDATE `notifications`
                SET `is_read` = 1
                WHERE `id` = ? AND (`user_id` = ? OR `user_id` IS NULL)";
        return $this->execute($sql, array($notificationId, $customerId));
    }
}
