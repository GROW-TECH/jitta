<?php
/**
 * RedTaxi Backend - Driver Model
 * Handles Driver Profile, Fleet/Vehicle Details, Online Status,
 * Ride Matching (Accept/Reject/Active/Status transitions), Earnings Wallet,
 * Notifications, and Document Verifications.
 * Compatible with PHP 5.6+.
 */

require_once __DIR__ . '/BaseModel.php';
require_once dirname(__DIR__) . '/config/env.php';
require_once dirname(__DIR__) . '/utils/Security.php';

class DriverModel extends BaseModel
{
    private static $cachedColumns = array();

    private function getExistingColumns($table)
    {
        if (isset(self::$cachedColumns[$table])) {
            return self::$cachedColumns[$table];
        }
        $cols = array();
        try {
            $stmt = $this->db->query("SHOW COLUMNS FROM `{$table}`");
            if ($stmt) {
                while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $cols[strtolower($r['Field'])] = true;
                }
            }
        } catch (Exception $e) {}
        self::$cachedColumns[$table] = $cols;
        return $cols;
    }

    public function checkAndResetDailyWallet($driverId = null)
    {
        $todayStr = date('Y-m-d');
        $wCols = $this->getExistingColumns('driver_wallets');
        if (isset($wCols['last_reset_date'])) {
            if ($driverId) {
                $this->execute("UPDATE `driver_wallets` SET `today_earnings` = 0.00, `today_trips` = 0, `last_reset_date` = ? WHERE `driver_id` = ? AND (`last_reset_date` IS NULL OR `last_reset_date` != ?)", array($todayStr, $driverId, $todayStr));
            } else {
                $this->execute("UPDATE `driver_wallets` SET `today_earnings` = 0.00, `today_trips` = 0, `last_reset_date` = ? WHERE `last_reset_date` IS NULL OR `last_reset_date` != ?", array($todayStr, $todayStr));
            }
        }
    }

    public function findByPhone($phone)
    {
        $this->checkAndResetDailyWallet();
        $wCols = $this->getExistingColumns('driver_wallets');
        $vCols = $this->getExistingColumns('driver_vehicles');

        $earningsCol = isset($wCols['today_earnings']) ? "w.today_earnings" : "0.00 AS today_earnings";
        $tripsCol = isset($wCols['today_trips']) ? "w.today_trips" : "0 AS today_trips";
        $commCol = isset($wCols['total_commission_paid']) ? "w.total_commission_paid" : "0.00 AS total_commission_paid";
        
        $vTypeCol = isset($vCols['vehicle_type']) ? "v.vehicle_type" : "'Sedan' AS vehicle_type";
        $vColorCol = isset($vCols['color']) ? "v.color AS vehicle_color" : (isset($vCols['vehicle_color']) ? "v.vehicle_color" : "NULL AS vehicle_color");
        $vActiveJoin = isset($vCols['is_active']) ? "AND v.is_active = 1" : "";

        $sql = "SELECT d.*, ci.name AS city_name,
                       w.id AS wallet_id, w.balance AS wallet_balance, {$earningsCol}, {$tripsCol}, {$commCol},
                       v.id AS vehicle_id, v.vehicle_model, v.vehicle_number, {$vTypeCol}, {$vColorCol}
                FROM `drivers` d
                LEFT JOIN `cities` ci ON ci.id = d.city_id
                LEFT JOIN `driver_wallets` w ON w.driver_id = d.id
                LEFT JOIN `driver_vehicles` v ON v.driver_id = d.id {$vActiveJoin}
                WHERE d.phone = ? AND (d.approval_status IS NULL OR d.approval_status != 'DELETED') AND d.phone NOT LIKE 'DEL_%'
                LIMIT 1";
        return $this->fetchOne($sql, array($phone));
    }

    /**
     * Finds a driver by either mobile number or email address.
     * Used by password login where users may sign in with either identifier.
     *
     * @param string $identifier Mobile number or email address
     * @return array|null
     */
    public function findByIdentifier($identifier)
    {
        $identifier = trim((string)$identifier);
        if (empty($identifier)) {
            return null;
        }

        // Email login
        if (strpos($identifier, '@') !== false) {
            return $this->findByEmail($identifier);
        }

        // Mobile number login
        $phone = preg_replace('/[^0-9]/', '', $identifier);
        if (strlen($phone) === 12 && substr($phone, 0, 2) === '91') {
            $phone = substr($phone, 2);
        } elseif (strlen($phone) === 11 && substr($phone, 0, 1) === '0') {
            $phone = substr($phone, 1);
        }

        if (strlen($phone) < 10) {
            return null;
        }

        return $this->findByPhone(substr($phone, -10));
    }

    public function findById($id)
    {
        $this->checkAndResetDailyWallet($id);
        $wCols = $this->getExistingColumns('driver_wallets');
        $vCols = $this->getExistingColumns('driver_vehicles');

        $earningsCol = isset($wCols['today_earnings']) ? "w.today_earnings" : "0.00 AS today_earnings";
        $tripsCol = isset($wCols['today_trips']) ? "w.today_trips" : "0 AS today_trips";
        $commCol = isset($wCols['total_commission_paid']) ? "w.total_commission_paid" : "0.00 AS total_commission_paid";
        
        $vTypeCol = isset($vCols['vehicle_type']) ? "v.vehicle_type" : "'Sedan' AS vehicle_type";
        $vColorCol = isset($vCols['color']) ? "v.color AS vehicle_color" : (isset($vCols['vehicle_color']) ? "v.vehicle_color" : "NULL AS vehicle_color");
        $vActiveJoin = isset($vCols['is_active']) ? "AND v.is_active = 1" : "";

        $sql = "SELECT d.*, ci.name AS city_name,
                       w.id AS wallet_id, w.balance AS wallet_balance, {$earningsCol}, {$tripsCol}, {$commCol},
                       v.id AS vehicle_id, v.vehicle_model, v.vehicle_number, {$vTypeCol}, {$vColorCol}
                FROM `drivers` d
                LEFT JOIN `cities` ci ON ci.id = d.city_id
                LEFT JOIN `driver_wallets` w ON w.driver_id = d.id
                LEFT JOIN `driver_vehicles` v ON v.driver_id = d.id {$vActiveJoin}
                WHERE d.id = ? AND (d.approval_status IS NULL OR d.approval_status != 'DELETED') AND d.phone NOT LIKE 'DEL_%'
                LIMIT 1";
        return $this->fetchOne($sql, array($id));
    }

    public function findByEmail($email)
    {
        if (empty($email)) {
            return null;
        }
        $sql = "SELECT * FROM `drivers` WHERE email = ? AND (approval_status IS NULL OR approval_status != 'DELETED') AND email NOT LIKE 'del_%' LIMIT 1";
        return $this->fetchOne($sql, array($email));
    }

    public function createDriver($data)
    {
        $id = isset($data['id']) ? $data['id'] : Security::generateUUID();
        $name = $data['name'];
        $phone = $data['phone'];
        $email = isset($data['email']) && !empty($data['email']) ? $data['email'] : null;
        $passwordHash = isset($data['password_hash']) ? $data['password_hash'] : null;
        $photoUrl = isset($data['photo_url']) ? $data['photo_url'] : null;
        $cityId = isset($data['city_id']) ? (int)$data['city_id'] : null;
        $approvalStatus = isset($data['approval_status']) ? $data['approval_status'] : 'APPROVED';

        $this->beginTransaction();

        try {
            // Check driver columns dynamically
            $dCols = $this->getExistingColumns('drivers');
            $driverData = array(
                'id' => $id,
                'name' => $name,
                'phone' => $phone,
                'email' => $email,
                'password_hash' => $passwordHash,
                'city_id' => $cityId,
                'approval_status' => $approvalStatus,
                'is_online' => 0,
            );
            if (isset($dCols['photo_url'])) $driverData['photo_url'] = $photoUrl;
            if (isset($dCols['avatar_url'])) $driverData['avatar_url'] = $photoUrl;
            if (isset($dCols['rating'])) $driverData['rating'] = 5.00;
            if (isset($dCols['rating_avg'])) $driverData['rating_avg'] = 5.00;
            if (isset($dCols['trips_count'])) $driverData['trips_count'] = 0;
            if (isset($dCols['total_rides'])) $driverData['total_rides'] = 0;
            if (isset($dCols['commission_percent'])) $driverData['commission_percent'] = 15.00;
            if (isset($dCols['total_earnings'])) $driverData['total_earnings'] = 0.00;

            // Only insert columns that exist
            $insertFields = array();
            $placeholders = array();
            $values = array();
            foreach ($driverData as $k => $v) {
                if (isset($dCols[$k])) {
                    $insertFields[] = "`$k`";
                    $placeholders[] = "?";
                    $values[] = $v;
                }
            }
            if (isset($dCols['created_at'])) {
                $insertFields[] = "`created_at`";
                $placeholders[] = "NOW()";
            }

            // Clear any prior deleted driver row holding this phone or email
            try {
                $this->query("UPDATE `drivers` SET `phone` = CONCAT('DEL_', UNIX_TIMESTAMP(), '_', `phone`), `email` = CONCAT('del_', UNIX_TIMESTAMP(), '_', COALESCE(`email`, 'd@jitta.com')) WHERE (`phone` = ? OR (`email` IS NOT NULL AND `email` = ?)) AND (`approval_status` = 'DELETED' OR `phone` LIKE 'DEL_%')", array($phone, $email));
            } catch (Exception $delEx) {}

            $sql = "INSERT INTO `drivers` (" . implode(', ', $insertFields) . ") VALUES (" . implode(', ', $placeholders) . ")";
            $this->query($sql, $values);

            // Initialize driver wallet with welcome balance (allows immediate ride acceptance)
            $wCols = $this->getExistingColumns('driver_wallets');
            $walletId = Security::generateUUID();
            $initialBalance = isset($data['balance']) ? (float)$data['balance'] : 500.00;
            $wData = array(
                'id' => $walletId,
                'driver_id' => $id,
                'balance' => $initialBalance,
            );
            if (isset($wCols['today_earnings'])) $wData['today_earnings'] = 0.00;
            if (isset($wCols['today_trips'])) $wData['today_trips'] = 0;
            if (isset($wCols['total_commission_paid'])) $wData['total_commission_paid'] = 0.00;
            if (isset($wCols['total_earned'])) $wData['total_earned'] = 0.00;
            if (isset($wCols['is_active'])) $wData['is_active'] = 1;

            $wFields = array();
            $wPlaceholders = array();
            $wValues = array();
            foreach ($wData as $k => $v) {
                if (isset($wCols[$k])) {
                    $wFields[] = "`$k`";
                    $wPlaceholders[] = "?";
                    $wValues[] = $v;
                }
            }
            $wSql = "INSERT INTO `driver_wallets` (" . implode(', ', $wFields) . ") VALUES (" . implode(', ', $wPlaceholders) . ")";
            $this->query($wSql, $wValues);

            // Ensure every driver has an active vehicle registered
            $vCols = $this->getExistingColumns('driver_vehicles');
            $vehId = Security::generateUUID();
            $vType = !empty($data['vehicle_type']) ? $data['vehicle_type'] : 'TAXI';
            $isActing = ($vType === 'ACTING_DRIVER' || stripos($vType, 'acting') !== false);
            $vModel = !empty($data['vehicle_model']) ? $data['vehicle_model'] : ($isActing ? 'Customer Vehicle' : 'Maruti Suzuki Dzire');
            $vNum = !empty($data['vehicle_number'])
                ? $data['vehicle_number']
                : ($isActing ? ('ACTING-' . strtoupper(substr(str_replace('-', '', Security::generateUUID()), 0, 8))) : ('TN ' . mt_rand(10, 99) . ' AB ' . mt_rand(1000, 9999)));
            $vData = array(
                'id' => $vehId,
                'driver_id' => $id,
                'vehicle_model' => $vModel,
                'vehicle_number' => $vNum,
            );
            if (isset($vCols['vehicle_type'])) $vData['vehicle_type'] = $vType;
            if (isset($vCols['color'])) $vData['color'] = isset($data['color']) ? $data['color'] : (isset($data['vehicle_color']) ? $data['vehicle_color'] : 'White');
            if (isset($vCols['vehicle_color'])) $vData['vehicle_color'] = isset($data['color']) ? $data['color'] : (isset($data['vehicle_color']) ? $data['vehicle_color'] : 'White');
            if (isset($vCols['is_active'])) $vData['is_active'] = 1;
            if (isset($vCols['is_primary'])) $vData['is_primary'] = 1;
            if (isset($vCols['is_verified'])) $vData['is_verified'] = 1;

            $vFields = array();
            $vPlaceholders = array();
            $vValues = array();
            foreach ($vData as $k => $v) {
                if (isset($vCols[$k])) {
                    $vFields[] = "`$k`";
                    $vPlaceholders[] = "?";
                    $vValues[] = $v;
                }
            }
            $vSql = "INSERT INTO `driver_vehicles` (" . implode(', ', $vFields) . ") VALUES (" . implode(', ', $vPlaceholders) . ")";
            $this->query($vSql, $vValues);

            $this->commit();

            return $this->findById($id);
        } catch (Exception $e) {
            $this->rollBack();
            throw $e;
        }
    }

    /**
     * Inserts verification documents for a driver during registration.
     * Supported types: LICENSE, RC, INSURANCE, PERMIT.
     *
     * @param string $driverId
     * @param array $documents Map like array('LICENSE' => 'number', ...)
     * @return void
     */
    public function createDriverDocuments($driverId, $documents)
    {
        $cols = $this->getExistingColumns('driver_documents');
        $statusCol = isset($cols['verification_status']) ? 'verification_status' : (isset($cols['status']) ? 'status' : null);

        foreach ($documents as $type => $number) {
            $number = trim((string)$number);
            if ($number === '') {
                continue;
            }

            $type = strtoupper(trim($type));
            if (!in_array($type, array('LICENSE', 'RC', 'INSURANCE', 'PERMIT'), true)) {
                continue;
            }

            $exists = $this->fetchOne(
                "SELECT `id` FROM `driver_documents` WHERE `driver_id` = ? AND `document_type` = ? LIMIT 1",
                array($driverId, $type)
            );

            if ($exists) {
                if ($statusCol) {
                    $this->execute(
                        "UPDATE `driver_documents` SET `document_number` = ?, `{$statusCol}` = 'PENDING', `updated_at` = NOW() WHERE `id` = ?",
                        array($number, $exists['id'])
                    );
                } else {
                    $this->execute(
                        "UPDATE `driver_documents` SET `document_number` = ?, `updated_at` = NOW() WHERE `id` = ?",
                        array($number, $exists['id'])
                    );
                }
            } else {
                $docId = Security::generateUUID();
                $insertCols = array('`id`', '`driver_id`', '`document_type`', '`document_number`');
                $placeholders = array('?', '?', '?', '?');
                $vals = array($docId, $driverId, $type, $number);

                if (isset($cols['verification_status'])) {
                    $insertCols[] = '`verification_status`';
                    $placeholders[] = "'PENDING'";
                }
                if (isset($cols['status'])) {
                    $insertCols[] = '`status`';
                    $placeholders[] = "'PENDING'";
                }
                if (isset($cols['created_at'])) {
                    $insertCols[] = '`created_at`';
                    $placeholders[] = 'NOW()';
                }

                $this->execute(
                    "INSERT INTO `driver_documents` (" . implode(', ', $insertCols) . ") VALUES (" . implode(', ', $placeholders) . ")",
                    $vals
                );
            }
        }
    }

    public function updateDriverDocumentFile($driverId, $documentType, $fileUrl)
    {
        $cols = $this->getExistingColumns('driver_documents');
        if (!isset($cols['file_url'])) {
            return false;
        }

        $exists = $this->fetchOne(
            "SELECT `id` FROM `driver_documents` WHERE `driver_id` = ? AND `document_type` = ? LIMIT 1",
            array($driverId, $documentType)
        );

        if ($exists) {
            $this->execute(
                "UPDATE `driver_documents` SET `file_url` = ?, `updated_at` = NOW() WHERE `id` = ?",
                array($fileUrl, $exists['id'])
            );
        } else {
            $docId = Security::generateUUID();
            $this->execute(
                "INSERT INTO `driver_documents` (`id`, `driver_id`, `document_type`, `file_url`, `created_at`) VALUES (?, ?, ?, ?, NOW())",
                array($docId, $driverId, $documentType, $fileUrl)
            );
        }
        return true;
    }

    public function updateProfile($driverId, $data)
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

        if (array_key_exists('photo_url', $data) || array_key_exists('avatar_url', $data)) {
            $pVal = !empty($data['photo_url']) ? trim($data['photo_url']) : (!empty($data['avatar_url']) ? trim($data['avatar_url']) : null);
            $fields[] = "`photo_url` = ?";
            $params[] = $pVal;
            $fields[] = "`avatar_url` = ?";
            $params[] = $pVal;
        }

        if (array_key_exists('city_id', $data)) {
            $fields[] = "`city_id` = ?";
            $params[] = !empty($data['city_id']) ? (int)$data['city_id'] : null;
        }

        if (empty($fields)) {
            return $this->findById($driverId);
        }

        $params[] = $driverId;
        $sql = "UPDATE `drivers` SET " . implode(', ', $fields) . ", `updated_at` = NOW() WHERE `id` = ?";
        $this->execute($sql, $params);

        return $this->findById($driverId);
    }

    // -------------------------------------------------------------
    // Vehicle Management
    // -------------------------------------------------------------

    public function getVehicles($driverId)
    {
        $sql = "SELECT v.*, c.name AS category_name
                FROM `driver_vehicles` v
                LEFT JOIN `vehicle_categories` c ON c.id = v.category_id
                WHERE v.driver_id = ?
                ORDER BY v.is_active DESC, v.created_at DESC";
        return $this->fetchAll($sql, array($driverId));
    }

    public function getActiveVehicle($driverId)
    {
        $sql = "SELECT * FROM `driver_vehicles` WHERE `driver_id` = ? AND `is_active` = 1 LIMIT 1";
        $veh = $this->fetchOne($sql, array($driverId));
        if (!$veh) {
            $veh = $this->fetchOne("SELECT * FROM `driver_vehicles` WHERE `driver_id` = ? ORDER BY id DESC LIMIT 1", array($driverId));
        }
        return $veh;
    }

    public function findVehicleById($driverId, $vehicleId)
    {
        $sql = "SELECT * FROM `driver_vehicles` WHERE `driver_id` = ? AND `id` = ? LIMIT 1";
        return $this->fetchOne($sql, array($driverId, $vehicleId));
    }

    public function findVehiclePlate($vehicleNumber)
    {
        $sql = "SELECT `id`, `driver_id`, `vehicle_number` FROM `driver_vehicles` WHERE `vehicle_number` = ? LIMIT 1";
        return $this->fetchOne($sql, array($vehicleNumber));
    }

    public function updateVehicle($driverId, $vehicleId, $data)
    {
        $existing = $this->findVehicleById($driverId, $vehicleId);
        if (!$existing) {
            return null;
        }

        $model  = isset($data['vehicle_model']) ? trim($data['vehicle_model']) : $existing['vehicle_model'];
        $number = isset($data['vehicle_number']) ? trim($data['vehicle_number']) : $existing['vehicle_number'];
        $type   = isset($data['vehicle_type']) ? trim($data['vehicle_type']) : $existing['vehicle_type'];
        $color  = array_key_exists('color', $data) ? $data['color'] : $existing['color'];
        $year   = array_key_exists('year', $data) ? (int)$data['year'] : $existing['year'];
        $isActive = array_key_exists('is_active', $data) ? ($data['is_active'] ? 1 : 0) : $existing['is_active'];

        $this->beginTransaction();
        try {
            if ($isActive === 1) {
                // Deactivate all other vehicles for this driver
                $this->execute("UPDATE `driver_vehicles` SET `is_active` = 0 WHERE `driver_id` = ?", array($driverId));
            }

            $sql = "UPDATE `driver_vehicles`
                    SET `vehicle_model` = ?, `vehicle_number` = ?, `vehicle_type` = ?, `color` = ?, `year` = ?, `is_active` = ?
                    WHERE `id` = ? AND `driver_id` = ?";
            $this->execute($sql, array($model, $number, $type, $color, $year, $isActive, $vehicleId, $driverId));

            $this->commit();
            return $this->findVehicleById($driverId, $vehicleId);
        } catch (Exception $e) {
            $this->rollBack();
            throw $e;
        }
    }

    // -------------------------------------------------------------
    // Online/Offline & GPS Location
    // -------------------------------------------------------------

    public function updateStatus($driverId, $isOnline, $lat = null, $lng = null, $heading = null, $speed = null, $accuracy = null)
    {
        $onlineInt = $isOnline ? 1 : 0;
        $sql = "UPDATE `drivers`
                SET `is_online` = ?,
                    `current_lat` = COALESCE(?, `current_lat`),
                    `current_lng` = COALESCE(?, `current_lng`),
                    `last_location_at` = NOW(),
                    `updated_at` = NOW()
                WHERE `id` = ?";

        $this->execute($sql, array($onlineInt, $lat, $lng, $driverId));

        // If driver is currently on an active trip, log real-time GPS breadcrumb
        if ($lat !== null && $lng !== null) {
            $activeTrip = $this->fetchOne(
                "SELECT `id` FROM `bookings` WHERE `driver_id` = ? AND `status` IN ('EN_ROUTE', 'ARRIVED', 'IN_PROGRESS') LIMIT 1",
                array($driverId)
            );
            if ($activeTrip) {
                $this->recordBreadcrumb($activeTrip['id'], $driverId, $lat, $lng, $heading, $speed, $accuracy);
            }
        }

        return array(
            'is_online'        => (bool)$onlineInt,
            'current_lat'      => $lat,
            'current_lng'      => $lng,
            'last_location_at' => date('Y-m-d H:i:s')
        );
    }

    // -------------------------------------------------------------
    // Ride Matching (Available / Accept / Reject / Current / Status)
    // -------------------------------------------------------------

    public function calculateHaversineDistance($lat1, $lon1, $lat2, $lon2)
    {
        if ($lat1 === null || $lon1 === null || $lat2 === null || $lon2 === null) {
            return null;
        }
        $earthRadius = 6371; // km
        $dLat = deg2rad((float)$lat2 - (float)$lat1);
        $dLon = deg2rad((float)$lon2 - (float)$lon1);
        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad((float)$lat1)) * cos(deg2rad((float)$lat2)) *
             sin($dLon / 2) * sin($dLon / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return round($earthRadius * $c, 2);
    }

    public function calculateDistanceMeters($lat1, $lon1, $lat2, $lon2)
    {
        $km = $this->calculateHaversineDistance($lat1, $lon1, $lat2, $lon2);
        return ($km !== null) ? round($km * 1000.0, 1) : null;
    }

    public function recordBreadcrumb($bookingId, $driverId, $lat, $lng, $heading = null, $speed = null, $accuracy = null)
    {
        try {
            $cols = $this->getExistingColumns('ride_location_logs');
            if (empty($cols) || $lat === null || $lng === null) {
                return false;
            }
            $fields = array('`booking_id`', '`driver_id`', '`lat`', '`lng`');
            $plh = array('?', '?', '?', '?');
            $params = array($bookingId, $driverId, (float)$lat, (float)$lng);

            if (isset($cols['heading'])) {
                $fields[] = '`heading`';
                $plh[] = '?';
                $params[] = ($heading !== null) ? (float)$heading : null;
            }
            if (isset($cols['speed_kmh'])) {
                $fields[] = '`speed_kmh`';
                $plh[] = '?';
                $params[] = ($speed !== null) ? (float)$speed : null;
            }
            if (isset($cols['accuracy_m'])) {
                $fields[] = '`accuracy_m`';
                $plh[] = '?';
                $params[] = ($accuracy !== null) ? (float)$accuracy : null;
            }
            if (isset($cols['recorded_at'])) {
                $fields[] = '`recorded_at`';
                $plh[] = 'NOW()';
            }
            $sql = "INSERT INTO `ride_location_logs` (" . implode(', ', $fields) . ") VALUES (" . implode(', ', $plh) . ")";
            return $this->execute($sql, $params);
        } catch (Exception $e) {
            return false;
        }
    }

    public function getBookingCoordinates($bookingId, $booking = null)
    {
        $pickup = null;
        $dropoff = null;

        $locSql = "SELECT `type`, `lat`, `lng` FROM `booking_locations` WHERE `booking_id` = ? ORDER BY `sequence_order` ASC";
        $locs = $this->fetchAll($locSql, array($bookingId));

        if (!empty($locs)) {
            foreach ($locs as $loc) {
                $type = strtoupper(trim($loc['type']));
                if ($type === 'PICKUP' && $pickup === null) {
                    $pickup = array('lat' => (float)$loc['lat'], 'lng' => (float)$loc['lng']);
                } elseif ($type === 'DROP' || $type === 'DROPOFF') {
                    $dropoff = array('lat' => (float)$loc['lat'], 'lng' => (float)$loc['lng']);
                }
            }
        }

        if (!$pickup && $booking) {
            if (!empty($booking['pickup_lat']) && !empty($booking['pickup_lng'])) {
                $pickup = array('lat' => (float)$booking['pickup_lat'], 'lng' => (float)$booking['pickup_lng']);
            }
        }

        if (!$dropoff && $booking) {
            if (!empty($booking['dropoff_lat']) && !empty($booking['dropoff_lng'])) {
                $dropoff = array('lat' => (float)$booking['dropoff_lat'], 'lng' => (float)$booking['dropoff_lng']);
            }
        }

        return array('pickup' => $pickup, 'dropoff' => $dropoff);
    }

    public function resolveCategoryGroup($categoryOrType, $rideType = '')
    {
        $c = strtolower(trim((string)$categoryOrType));
        $rt = strtolower(trim((string)$rideType));

        // 1. Acting Driver group
        if ($rt === 'driver_only' || strpos($c, 'acting') !== false || strpos($c, 'active_driver') !== false || strpos($c, 'driver_only') !== false) {
            return 'ACTING_DRIVER';
        }

        // 2. Two-Wheeler group (Bike & Scooty)
        $normalized = str_replace(array('-', '_', ' '), '', $c);
        if (strpos($c, 'bike') !== false || strpos($c, 'scoot') !== false || strpos($normalized, 'twowheeler') !== false || strpos($c, 'moto') !== false) {
            return 'TWO_WHEELER';
        }

        // 3. Taxi group (Cab / Auto / Sedan / Mini / SUV / Car)
        return 'TAXI';
    }

    /**
     * Fetch active online approved drivers for sequential queue calculation.
     *
     * @param string $categoryGroup
     * @param int|null $cityId
     * @param array $rejectedIds
     * @return array
     */
    public function getOnlineCandidateDrivers($categoryGroup, $cityId = null, $rejectedIds = array())
    {
        $dCols = $this->getExistingColumns('drivers');
        $hasVehType = isset($dCols['vehicle_type']);
        $vehTypeSelect = $hasVehType ? "d.vehicle_type AS driver_veh_type," : "NULL AS driver_veh_type,";

        $sql = "SELECT d.id, d.name, d.current_lat, d.current_lng, d.city_id,
                       d.updated_at, d.last_location_at,
                       {$vehTypeSelect}
                       v.vehicle_type AS active_veh_type
                FROM `drivers` d
                LEFT JOIN `driver_vehicles` v ON v.driver_id = d.id AND v.is_active = 1
                WHERE d.is_online = 1 AND d.approval_status = 'APPROVED'
                  AND (d.last_location_at >= DATE_SUB(NOW(), INTERVAL 45 MINUTE) OR d.updated_at >= DATE_SUB(NOW(), INTERVAL 45 MINUTE))";
        $params = array();

        if ($cityId !== null && (int)$cityId > 0 && isset($dCols['city_id'])) {
            $sql .= " AND (d.city_id = ? OR d.city_id IS NULL OR d.city_id = 0)";
            $params[] = (int)$cityId;
        }

        $candidates = $this->fetchAll($sql, $params);
        $filtered = array();

        foreach ($candidates as $c) {
            if (!empty($rejectedIds) && in_array($c['id'], $rejectedIds, true)) {
                continue;
            }
            $vehType = !empty($c['active_veh_type']) ? $c['active_veh_type'] : $c['driver_veh_type'];
            $candGroup = $this->resolveCategoryGroup($vehType);
            if ($candGroup === $categoryGroup) {
                $filtered[] = $c;
            }
        }
        return $filtered;
    }

    public function getAvailableRides($driverId, $cityId = null)
    {
        // 1. Fetch driver current location & active vehicle
        $driver = $this->findById($driverId);
        $driverLat = ($driver && isset($driver['current_lat'])) ? (float)$driver['current_lat'] : null;
        $driverLng = ($driver && isset($driver['current_lng'])) ? (float)$driver['current_lng'] : null;
        
        $activeVeh = $this->getActiveVehicle($driverId);
        $driverVehCategory = $activeVeh ? (isset($activeVeh['vehicle_type']) ? $activeVeh['vehicle_type'] : null) : null;
        if (empty($driverVehCategory) && isset($driver['vehicle_type'])) {
            $driverVehCategory = $driver['vehicle_type'];
        }

        $driverGroup = $this->resolveCategoryGroup($driverVehCategory);

        $bCols = $this->getExistingColumns('bookings');
        $rejCol = isset($bCols['rejected_driver_ids']) ? "b.rejected_driver_ids," : "NULL AS rejected_driver_ids,";
        $otpCol = "NULL AS start_otp,"; // Never expose customer start OTP to driver partner
        $custVehCol = isset($bCols['customer_vehicle_details']) ? "b.customer_vehicle_details," : "NULL AS customer_vehicle_details,";

        // Query active rides: SEARCHING rides created within the last 2 hours OR assigned to this driver
        $sql = "SELECT b.id, b.driver_id, b.ride_type, b.vehicle_category, b.status, b.distance_km,
                       b.duration_min, b.total_fare, b.payment_method, b.created_at,
                       TIMESTAMPDIFF(SECOND, b.created_at, NOW()) AS elapsed_seconds,
                       {$otpCol} {$custVehCol} {$rejCol}
                       c.name AS customer_name, c.phone AS customer_phone
                FROM `bookings` b
                INNER JOIN `customers` c ON c.id = b.customer_id
                WHERE ((b.status = 'SEARCHING' AND b.created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR))
                       OR (b.status = 'ASSIGNED' AND b.driver_id = ?))";

        $params = array($driverId);

        if ($cityId !== null && (int)$cityId > 0 && isset($bCols['city_id'])) {
            $sql .= " AND (b.city_id = ? OR b.city_id IS NULL OR b.city_id = 0)";
            $params[] = (int)$cityId;
        }

        $sql .= " ORDER BY b.created_at DESC LIMIT 20";

        $rawBookings = $this->fetchAll($sql, $params);
        $bookings = array();

        foreach ($rawBookings as $b) {
            $isAssignedToMe = ($b['status'] === 'ASSIGNED' && $b['driver_id'] === $driverId);

            // 1. If assigned to me, include immediately
            if ($isAssignedToMe) {
                $b['request_timeout_seconds'] = 30;
                $bookings[] = $b;
                continue;
            }

            // 2. Booking Search Timeout: If in SEARCHING for >= 120 seconds, auto-expire
            $elapsedSeconds = isset($b['elapsed_seconds']) ? (int)$b['elapsed_seconds'] : max(0, time() - strtotime($b['created_at']));
            if ($elapsedSeconds >= 120) {
                try {
                    $this->execute(
                        "UPDATE `bookings` SET `status` = 'CANCELLED', `cancelled_at` = NOW(), `updated_at` = NOW() WHERE `id` = ? AND `status` = 'SEARCHING'",
                        array($b['id'])
                    );
                    $this->execute(
                        "INSERT IGNORE INTO `cancellations` (`id`, `booking_id`, `cancelled_by`, `reason`, `cancellation_fee`, `created_at`) VALUES (?, ?, 'SYSTEM', 'NO_DRIVERS_AVAILABLE', 0.00, NOW())",
                        array(Security::generateUUID(), $b['id'])
                    );
                } catch (Exception $e) {}
                continue; // Skip timed-out ride
            }

            // 3. Driver Rejection Check
            if (!empty($b['rejected_driver_ids'])) {
                $parsed = json_decode($b['rejected_driver_ids'], true);
                if (is_array($parsed)) {
                    $rejectedList = array_map('strval', $parsed);
                    if (in_array(strval($driverId), $rejectedList, true)) {
                        continue; // Skip rides declined by this driver
                    }
                }
            }

            // 4. Strict Category & Ride Type Matching
            $bookingGroup = $this->resolveCategoryGroup($b['vehicle_category'], $b['ride_type']);
            if ($driverGroup !== $bookingGroup) {
                continue; // Category mismatch: NEVER dispatch across categories
            }

            // 5. Fetch pickup and drop locations
            $locSql = "SELECT `type`, `name`, `address`, `lat`, `lng`
                       FROM `booking_locations`
                       WHERE `booking_id` = ?
                       ORDER BY `sequence_order` ASC";
            $locs = $this->fetchAll($locSql, array($b['id']));

            $pickup = null;
            $drop = null;
            foreach ($locs as $loc) {
                if ($loc['type'] === 'PICKUP' && $pickup === null) {
                    $pickup = $loc;
                } elseif ($loc['type'] === 'DROP') {
                    $drop = $loc;
                }
            }
            $b['pickup'] = $pickup;
            $b['drop']   = $drop;

            // 6. Calculate distance from this driver to pickup
            $pickupDistanceKm = null;
            $pickupEtaMin = null;
            if ($driverLat !== null && $driverLng !== null && $pickup && isset($pickup['lat']) && isset($pickup['lng'])) {
                $pickupDistanceKm = $this->calculateHaversineDistance($driverLat, $driverLng, $pickup['lat'], $pickup['lng']);
                if ($pickupDistanceKm !== null) {
                    $pickupEtaMin = max(1, (int)ceil(($pickupDistanceKm / 25) * 60));
                }
            }

            // 7. Search Radius Limit (Expands over time: 4 km -> 7 km -> 12 km)
            $activeRadius = ($elapsedSeconds < 25) ? 4.0 : (($elapsedSeconds < 50) ? 7.0 : 12.0);
            if ($pickupDistanceKm !== null && $pickupDistanceKm > $activeRadius) {
                continue; // Driver is outside current search radius
            }

            // 8. Nearest-Driver Sequential Queue (Rapido Style)
            // Retrieve all candidate online drivers for this booking group
            $candidateDrivers = $this->getOnlineCandidateDrivers($bookingGroup, $cityId, $rejectedList);

            if (!empty($candidateDrivers) && $pickup && isset($pickup['lat']) && isset($pickup['lng'])) {
                // Compute distance to pickup for every candidate driver
                foreach ($candidateDrivers as &$cand) {
                    $cLat = ($cand['current_lat'] !== null) ? (float)$cand['current_lat'] : null;
                    $cLng = ($cand['current_lng'] !== null) ? (float)$cand['current_lng'] : null;
                    if ($cLat !== null && $cLng !== null) {
                        $cand['dist_to_pickup'] = $this->calculateHaversineDistance($cLat, $cLng, $pickup['lat'], $pickup['lng']);
                    } else {
                        $cand['dist_to_pickup'] = 999.0;
                    }
                }
                unset($cand);

                // Filter candidates within current active search radius
                $validCandidates = array_values(array_filter($candidateDrivers, function($c) use ($activeRadius) {
                    return ($c['dist_to_pickup'] !== null && $c['dist_to_pickup'] <= $activeRadius);
                }));

                if (empty($validCandidates)) {
                    $validCandidates = $candidateDrivers;
                }

                // Sort candidates: closest to pickup first
                usort($validCandidates, function($x, $y) {
                    $dx = ($x['dist_to_pickup'] !== null) ? $x['dist_to_pickup'] : 999.0;
                    $dy = ($y['dist_to_pickup'] !== null) ? $y['dist_to_pickup'] : 999.0;
                    return ($dx < $dy) ? -1 : 1;
                });

                // Immediate Cluster & Sequential Ring Slot logic:
                // If the driver is in the immediate cluster (within 2.0 km of pickup or within 600m of Candidate #0):
                // Dispatch IMMEDIATELY (0-second wait)!
                $closestDist = !empty($validCandidates[0]['dist_to_pickup']) ? (float)$validCandidates[0]['dist_to_pickup'] : 0.0;
                $isImmediateZone = ($pickupDistanceKm !== null && ($pickupDistanceKm <= 2.0 || abs($pickupDistanceKm - $closestDist) <= 0.6));

                if ($isImmediateZone) {
                    // Nearest drivers receive the request IMMEDIATELY!
                    $slotRemaining = max(5, 60 - $elapsedSeconds);
                    $b['request_timeout_seconds'] = $slotRemaining;
                } elseif ($elapsedSeconds < 24 && count($validCandidates) > 1) {
                    // For farther drivers, fast 8-second sequential slots
                    $slotIdx = (int)floor($elapsedSeconds / 8);
                    $targetCandidate = isset($validCandidates[$slotIdx]) ? $validCandidates[$slotIdx] : $validCandidates[0];

                    if ($targetCandidate['id'] !== $driverId) {
                        // Another closer driver is currently being offered this ride exclusively
                        continue;
                    }

                    $slotRemaining = max(5, 8 - ($elapsedSeconds % 8));
                    $b['request_timeout_seconds'] = $slotRemaining;
                } else {
                    // Broadcast mode (elapsed >= 24s or only 1 driver available)
                    $slotRemaining = max(5, 60 - $elapsedSeconds);
                    $b['request_timeout_seconds'] = $slotRemaining;
                }
            } else {
                $b['request_timeout_seconds'] = max(5, 60 - $elapsedSeconds);
            }

            $b['pickup_distance_km'] = $pickupDistanceKm;
            $b['pickup_eta_min']      = $pickupEtaMin;

            // Decode customer vehicle details (DRIVER ONLY mode)
            if (!empty($b['customer_vehicle_details'])) {
                $decoded = json_decode($b['customer_vehicle_details'], true);
                $b['customer_vehicle_details'] = is_array($decoded) ? $decoded : null;
            } else {
                $b['customer_vehicle_details'] = null;
            }
            $b['is_driver_only'] = ($b['ride_type'] === 'DRIVER_ONLY');
            
            unset($b['rejected_driver_ids']);
            $bookings[] = $b;
        }

        // Sort bookings by pickup_distance_km (closest first)
        usort($bookings, function($a, $b) {
            $distA = ($a['pickup_distance_km'] !== null) ? $a['pickup_distance_km'] : 9999;
            $distB = ($b['pickup_distance_km'] !== null) ? $b['pickup_distance_km'] : 9999;
            return ($distA < $distB) ? -1 : 1;
        });

        return array_slice($bookings, 0, 10);
    }

    public function safeInsertNotification($userId, $userType, $title, $message, $type = 'SYSTEM', $payload = null)
    {
        try {
            $notifCols = $this->getExistingColumns('notifications');
            if (empty($notifCols)) {
                return;
            }

            $fields = array();
            $placeholders = array();
            $params = array();

            if (isset($notifCols['id'])) {
                $fields[] = '`id`';
                $placeholders[] = '?';
                $params[] = Security::generateUUID();
            }
            if (isset($notifCols['user_id'])) {
                $fields[] = '`user_id`';
                $placeholders[] = '?';
                $params[] = $userId;
            }
            if (isset($notifCols['user_type'])) {
                $fields[] = '`user_type`';
                $placeholders[] = '?';
                $params[] = $userType;
            }
            if (isset($notifCols['title'])) {
                $fields[] = '`title`';
                $placeholders[] = '?';
                $params[] = $title;
            }
            if (isset($notifCols['message'])) {
                $fields[] = '`message`';
                $placeholders[] = '?';
                $params[] = $message;
            }
            if (isset($notifCols['type'])) {
                $fields[] = '`type`';
                $placeholders[] = '?';
                $params[] = $type;
            }
            if (isset($notifCols['is_read'])) {
                $fields[] = '`is_read`';
                $placeholders[] = '?';
                $params[] = 0;
            }
            if (isset($notifCols['audience'])) {
                $fields[] = '`audience`';
                $placeholders[] = '?';
                $params[] = 'INDIVIDUAL';
            }
            if (isset($notifCols['data_payload'])) {
                $fields[] = '`data_payload`';
                $placeholders[] = '?';
                $params[] = $payload ? json_encode($payload) : null;
            }
            if (isset($notifCols['created_at'])) {
                $fields[] = '`created_at`';
                $placeholders[] = 'NOW()';
            }

            if (!empty($fields)) {
                $sql = "INSERT INTO `notifications` (" . implode(', ', $fields) . ") VALUES (" . implode(', ', $placeholders) . ")";
                $this->execute($sql, $params);
            }
        } catch (Exception $e) {
            error_log("Failed to insert notification: " . $e->getMessage());
        }
    }

    public function acceptRide($driverId, $bookingId)
    {
        $driver = $this->findById($driverId);
        if (!$driver) {
            return array('error' => 'Driver not found', 'code' => 404);
        }
        if ($driver['approval_status'] !== 'APPROVED') {
            return array('error' => 'Driver is not approved', 'code' => 403);
        }
        if (!$driver['is_online']) {
            return array('error' => 'Driver is offline. Please go online first', 'code' => 400);
        }

        // Check prepaid wallet balance (minimum ₹50.00 required to accept rides)
        $wallet = $this->getWalletDetails($driverId);
        $walletBalance = $wallet ? (float)$wallet['balance'] : 0.0;
        $minRequiredBalance = 50.00;
        if ($walletBalance < $minRequiredBalance) {
            $this->safeInsertNotification(
                $driverId,
                'DRIVER',
                'Low Wallet Balance - Recharge Required',
                'Your prepaid wallet balance is low (₹' . number_format($walletBalance, 2) . '). Minimum ₹' . number_format($minRequiredBalance, 2) . ' is required to accept rides. Please recharge your wallet.',
                'PAYMENT'
            );
            return array('error' => 'Insufficient prepaid wallet balance (₹' . number_format($walletBalance, 2) . '). Minimum ₹' . number_format($minRequiredBalance, 2) . ' required to accept rides.', 'code' => 402);
        }

        // Check active vehicle
        $activeVeh = $this->getActiveVehicle($driverId);
        $vehicleId = $activeVeh ? $activeVeh['id'] : null;

        $this->beginTransaction();
        try {
            // Lock booking row to prevent race conditions
            $checkSql = "SELECT * FROM `bookings` WHERE `id` = ? FOR UPDATE";
            $booking = $this->fetchOne($checkSql, array($bookingId));

            if (!$booking) {
                $this->rollBack();
                return array('error' => 'Booking not found', 'code' => 404);
            }

            // Idempotent: If already accepted or assigned to this driver, succeed cleanly
            if ($booking['driver_id'] === $driverId && in_array($booking['status'], array('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'))) {
                $this->rollBack();
                $current = $this->getCurrentRide($driverId);
                return $current ? $current : $booking;
            }

            // Check if already assigned to another driver
            if (!empty($booking['driver_id']) && $booking['driver_id'] !== $driverId) {
                $this->rollBack();
                return array('error' => 'Ride is already assigned to another driver', 'code' => 409);
            }

            // Status must strictly be SEARCHING (open for acceptance in dispatch pool)
            if ($booking['status'] !== 'SEARCHING') {
                if ($booking['driver_id'] === $driverId && in_array($booking['status'], array('ASSIGNED', 'EN_ROUTE'), true)) {
                    $this->commit();
                    return $this->getCurrentRide($driverId);
                }
                $this->rollBack();
                return array('error' => 'Ride is no longer available (already accepted by another driver or cancelled)', 'code' => 409);
            }

            // Strict Category Validation on Accept
            $driverGroup = $this->resolveCategoryGroup($activeVeh ? (isset($activeVeh['vehicle_type']) ? $activeVeh['vehicle_type'] : null) : null);
            $bookingGroup = $this->resolveCategoryGroup($booking['vehicle_category'], $booking['ride_type']);
            if ($driverGroup !== $bookingGroup) {
                $this->rollBack();
                return array('error' => 'You cannot accept this ride. Vehicle category mismatch.', 'code' => 403);
            }

            // Assign driver & vehicle, transition to EN_ROUTE (driver navigating to pickup)
            // DRIVER_ONLY bookings keep bookings.vehicle_id NULL (customer provides the car)
            $isDriverOnly = ($booking['ride_type'] === 'DRIVER_ONLY');
            $bCols = $this->getExistingColumns('bookings');

            $setParts = array("`driver_id` = ?", "`status` = 'EN_ROUTE'");
            $setParams = array($driverId);

            if ($isDriverOnly) {
                $setParts[] = "`vehicle_id` = NULL";
            } else {
                $setParts[] = "`vehicle_id` = COALESCE(?, `vehicle_id`)";
                $setParams[] = $vehicleId;
            }

            if (isset($bCols['assigned_at'])) {
                $setParts[] = "`assigned_at` = COALESCE(`assigned_at`, NOW())";
            }
            if (isset($bCols['accepted_at'])) {
                $setParts[] = "`accepted_at` = COALESCE(`accepted_at`, NOW())";
            }
            if (isset($bCols['updated_at'])) {
                $setParts[] = "`updated_at` = NOW()";
            }

            // Atomic Conditional Update (Defense-in-Depth):
            // Guarantees at database engine level that the row is STILL in 'SEARCHING' status and unassigned
            $setParams[] = $bookingId;
            $setParams[] = $driverId;
            $assignSql = "UPDATE `bookings` SET " . implode(', ', $setParts) . " 
                          WHERE `id` = ? AND `status` = 'SEARCHING' AND (`driver_id` IS NULL OR `driver_id` = ?)";
            $affectedRows = $this->execute($assignSql, $setParams);

            if ($affectedRows !== 1) {
                $this->rollBack();
                return array('error' => 'Ride is no longer available (accepted by another driver)', 'code' => 409);
            }

            // Notify customer that driver was assigned and en route
            $driverName = isset($driver['name']) ? $driver['name'] : 'Driver';
            $this->safeInsertNotification(
                $booking['customer_id'],
                'CUSTOMER',
                'Driver En Route',
                "Driver {$driverName} has accepted your ride request and is en route.",
                'RIDE',
                array('booking_id' => $bookingId, 'driver_id' => $driverId, 'status' => 'EN_ROUTE')
            );

            $this->commit();
            return $this->getCurrentRide($driverId);
        } catch (Exception $e) {
            $this->rollBack();
            throw $e;
        }
    }

    public function rejectRide($driverId, $bookingId)
    {
        $bCols = $this->getExistingColumns('bookings');
        $hasRej = isset($bCols['rejected_driver_ids']);
        $rejSelect = $hasRej ? "`rejected_driver_ids`," : "";

        $booking = $this->fetchOne("SELECT `id`, {$rejSelect} `driver_id`, `status` FROM `bookings` WHERE `id` = ?", array($bookingId));
        if ($booking) {
            // Guard: Never alter completed, cancelled, or started rides back to SEARCHING
            if (in_array($booking['status'], array('COMPLETED', 'CANCELLED', 'STARTED', 'IN_PROGRESS', 'ARRIVED'), true)) {
                return array('rejected' => true, 'booking_id' => $bookingId, 'already_finalized' => true);
            }

            $rejected = ($hasRej && !empty($booking['rejected_driver_ids'])) ? json_decode($booking['rejected_driver_ids'], true) : array();
            if (!is_array($rejected)) {
                $rejected = array();
            }
            $driverIdStr = strval($driverId);
            $rejectedStrings = array_map('strval', $rejected);
            if (!in_array($driverIdStr, $rejectedStrings, true)) {
                $rejected[] = $driverIdStr;
            }
            $rejectedJson = json_encode(array_values($rejected));

            if ($booking['driver_id'] === $driverId) {
                // If assigned to this driver, unassign and release back to SEARCHING pool only if still SEARCHING or ASSIGNED
                $setParts = array("`driver_id` = NULL", "`vehicle_id` = NULL", "`status` = 'SEARCHING'");
                $params = array();
                if (isset($bCols['assigned_at'])) {
                    $setParts[] = "`assigned_at` = NULL";
                }
                if (isset($bCols['accepted_at'])) {
                    $setParts[] = "`accepted_at` = NULL";
                }
                if ($hasRej) {
                    $setParts[] = "`rejected_driver_ids` = ?";
                    $params[] = $rejectedJson;
                }
                $params[] = $bookingId;
                $sql = "UPDATE `bookings` SET " . implode(', ', $setParts) . " WHERE `id` = ?";
                $this->execute($sql, $params);
            } else {
                if ($hasRej) {
                    $sql = "UPDATE `bookings` SET `rejected_driver_ids` = ? WHERE `id` = ?";
                    $this->execute($sql, array($rejectedJson, $bookingId));
                }
            }
        }

        return array('rejected' => true, 'booking_id' => $bookingId);
    }

    public function getCurrentRide($driverId)
    {
        $bCols = $this->getExistingColumns('bookings');
        $orderCol = isset($bCols['assigned_at']) ? 'b.assigned_at' : (isset($bCols['accepted_at']) ? 'b.accepted_at' : (isset($bCols['updated_at']) ? 'b.updated_at' : 'b.created_at'));

        $sql = "SELECT b.*,
                       c.name AS customer_name, c.phone AS customer_phone, c.avatar_url AS customer_photo,
                       v.vehicle_model, v.vehicle_number
                FROM `bookings` b
                INNER JOIN `customers` c ON c.id = b.customer_id
                LEFT JOIN `driver_vehicles` v ON v.id = b.vehicle_id
                WHERE b.driver_id = ? AND b.status IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS')
                  AND b.created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
                ORDER BY {$orderCol} DESC
                LIMIT 1";

        $booking = $this->fetchOne($sql, array($driverId));
        if (!$booking) {
            return null;
        }

        // STRICT PRIVACY: NEVER expose customer's start OTP to the driver partner
        unset($booking['start_otp'], $booking['otp'], $booking['otp_code']);

        // Fetch locations
        $locSql = "SELECT `type`, `sequence_order`, `name`, `address`, `lat`, `lng`
                   FROM `booking_locations`
                   WHERE `booking_id` = ?
                   ORDER BY `sequence_order` ASC";
        $booking['locations'] = $this->fetchAll($locSql, array($booking['id']));

        // If booking_locations is empty, synthesize from pickup/dropoff columns
        if (empty($booking['locations'])) {
            $booking['locations'] = array();
            if (!empty($booking['pickup_address']) || !empty($booking['pickup_lat'])) {
                $booking['locations'][] = array(
                    'type' => 'PICKUP',
                    'sequence_order' => 1,
                    'name' => !empty($booking['pickup_address']) ? $booking['pickup_address'] : 'Pickup',
                    'address' => !empty($booking['pickup_address']) ? $booking['pickup_address'] : '',
                    'lat' => isset($booking['pickup_lat']) ? $booking['pickup_lat'] : null,
                    'lng' => isset($booking['pickup_lng']) ? $booking['pickup_lng'] : null
                );
            }
            if (!empty($booking['dropoff_address']) || !empty($booking['dropoff_lat'])) {
                $booking['locations'][] = array(
                    'type' => 'DROP',
                    'sequence_order' => 2,
                    'name' => !empty($booking['dropoff_address']) ? $booking['dropoff_address'] : 'Drop',
                    'address' => !empty($booking['dropoff_address']) ? $booking['dropoff_address'] : '',
                    'lat' => isset($booking['dropoff_lat']) ? $booking['dropoff_lat'] : null,
                    'lng' => isset($booking['dropoff_lng']) ? $booking['dropoff_lng'] : null
                );
            }
        }

        // Decode customer vehicle details (DRIVER ONLY mode)
        if (!empty($booking['customer_vehicle_details'])) {
            $decoded = json_decode($booking['customer_vehicle_details'], true);
            $booking['customer_vehicle_details'] = is_array($decoded) ? $decoded : null;
        } else {
            $booking['customer_vehicle_details'] = null;
        }

        return $booking;
    }

    public function updateRideStatus($driverId, $bookingId, $newStatus, $otp = null, $extra = array())
    {
        $booking = $this->fetchOne("SELECT * FROM `bookings` WHERE `id` = ? AND `driver_id` = ?", array($bookingId, $driverId));
        if (!$booking) {
            return array('error' => 'Ride booking not found or not assigned to you', 'code' => 404);
        }

        $currentStatus = $booking['status'];
        $isTest = !empty($extra['is_test']) || 
                  (isset($_SERVER['HTTP_HOST']) && (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false || strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false)) ||
                  (isset($_SERVER['SERVER_NAME']) && (strpos($_SERVER['SERVER_NAME'], 'localhost') !== false || strpos($_SERVER['SERVER_NAME'], '127.0.0.1') !== false));

        // Extract driver coordinates provided or fallback to driver profile
        $driverLat = (isset($extra['lat']) && $extra['lat'] !== null && $extra['lat'] !== '') ? (float)$extra['lat'] : null;
        $driverLng = (isset($extra['lng']) && $extra['lng'] !== null && $extra['lng'] !== '') ? (float)$extra['lng'] : null;
        $heading = (isset($extra['heading']) && $extra['heading'] !== null) ? (float)$extra['heading'] : null;
        $speed = (isset($extra['speed']) && $extra['speed'] !== null) ? (float)$extra['speed'] : null;
        $accuracy = (isset($extra['accuracy']) && $extra['accuracy'] !== null) ? (float)$extra['accuracy'] : null;

        if ($driverLat === null || $driverLng === null) {
            $driverRec = $this->findById($driverId);
            if ($driverRec && isset($driverRec['current_lat']) && isset($driverRec['current_lng'])) {
                $driverLat = (float)$driverRec['current_lat'];
                $driverLng = (float)$driverRec['current_lng'];
            }
        }

        // Record breadcrumb if driver coordinates are known
        if ($driverLat !== null && $driverLng !== null) {
            $this->recordBreadcrumb($bookingId, $driverId, $driverLat, $driverLng, $heading, $speed, $accuracy);
        }

        // Retrieve pickup & dropoff coordinates
        $coords = $this->getBookingCoordinates($bookingId, $booking);
        $pickup = $coords['pickup'];
        $dropoff = $coords['dropoff'];

        if ($newStatus === 'EN_ROUTE') {
            if ($currentStatus === 'EN_ROUTE') {
                return $this->getCurrentRide($driverId);
            }
            if ($currentStatus !== 'ASSIGNED' && $currentStatus !== 'SEARCHING') {
                return array('error' => "Cannot transition to EN_ROUTE from {$currentStatus}", 'code' => 400);
            }

            $bCols = $this->getExistingColumns('bookings');
            $setParts = array("`status` = 'EN_ROUTE'", "`updated_at` = NOW()");
            if (isset($bCols['accepted_at'])) {
                $setParts[] = "`accepted_at` = COALESCE(`accepted_at`, NOW())";
            }
            if (isset($bCols['assigned_at'])) {
                $setParts[] = "`assigned_at` = COALESCE(`assigned_at`, NOW())";
            }
            $this->execute("UPDATE `bookings` SET " . implode(', ', $setParts) . " WHERE `id` = ?", array($bookingId));

            // Notify customer
            $this->safeInsertNotification($booking['customer_id'], 'CUSTOMER', 'Driver En Route', 'Your driver is on the way to pick you up.', 'RIDE', array('booking_id' => $bookingId, 'status' => 'EN_ROUTE'));

            return $this->getCurrentRide($driverId);
        }

        if ($newStatus === 'ARRIVED') {
            if ($currentStatus === 'ARRIVED') {
                return $this->getCurrentRide($driverId);
            }
            if ($currentStatus !== 'ASSIGNED' && $currentStatus !== 'EN_ROUTE') {
                return array('error' => "Cannot transition to ARRIVED from {$currentStatus}", 'code' => 400);
            }

            // GEOFENCE VALIDATION (Physical arrival check):
            // Driver must be within 250m of the pickup location.
            // Allowed if is_test is true or if testing desk setup (driver at same location as customer).
            if (!$isTest && $pickup && $driverLat !== null && $driverLng !== null) {
                $distMeters = $this->calculateDistanceMeters($driverLat, $driverLng, $pickup['lat'], $pickup['lng']);
                if ($distMeters !== null && $distMeters > 250.0) {
                    return array(
                        'error' => "You are physically " . round($distMeters) . "m away from the pickup point. You must be within 250m to mark arrived.",
                        'code'  => 400
                    );
                }
            }

            $bCols = $this->getExistingColumns('bookings');
            $setParts = array("`status` = 'ARRIVED'", "`updated_at` = NOW()");
            if (isset($bCols['arrived_at'])) {
                $setParts[] = "`arrived_at` = NOW()";
            }
            $this->execute("UPDATE `bookings` SET " . implode(', ', $setParts) . " WHERE `id` = ?", array($bookingId));

            // Notify customer
            $startOtp = isset($booking['start_otp']) ? $booking['start_otp'] : (isset($booking['otp']) ? $booking['otp'] : '4821');
            $this->safeInsertNotification($booking['customer_id'], 'CUSTOMER', 'Driver Arrived', "Your driver has arrived at the pickup location. Share OTP {$startOtp} to start trip.", 'RIDE', array('booking_id' => $bookingId, 'status' => 'ARRIVED', 'otp' => $startOtp));

            return $this->getCurrentRide($driverId);
        }

        if ($newStatus === 'STARTED') {
            if ($currentStatus === 'IN_PROGRESS') {
                return $this->getCurrentRide($driverId);
            }

            // Enforce vehicle details provided for DRIVER_ONLY duty before trip start
            if (isset($booking['ride_type']) && $booking['ride_type'] === 'DRIVER_ONLY') {
                $hasVeh = !empty($booking['vehicle_reg_no']);
                if (!$hasVeh && !empty($booking['customer_vehicle_details'])) {
                    $cv = @json_decode($booking['customer_vehicle_details'], true);
                    if (!empty($cv['number']) && trim((string)$cv['number']) !== '') {
                        $hasVeh = true;
                    }
                }
                if (!$hasVeh && !$isTest) {
                    return array('error' => 'Customer vehicle registration details must be provided before starting Acting Driver service.', 'code' => 400);
                }
                if (!empty($booking['driver_mismatch_reported']) && !$isTest) {
                    return array('error' => 'Vehicle mismatch was reported for this trip. Discrepancy must be resolved before starting trip.', 'code' => 400);
                }
            }
            if ($currentStatus !== 'ARRIVED') {
                if (in_array($currentStatus, array('EN_ROUTE', 'ASSIGNED'))) {
                    $this->execute("UPDATE `bookings` SET `status` = 'ARRIVED', `arrived_at` = COALESCE(`arrived_at`, NOW()) WHERE `id` = ?", array($bookingId));
                    $currentStatus = 'ARRIVED';
                } else {
                    return array('error' => "Cannot start ride before arriving at pickup location (current status: {$currentStatus})", 'code' => 400);
                }
            }

            // Strict Verification: OTP must be provided and must match the booking's exact start_otp
            if (empty($otp)) {
                return array('error' => 'Start OTP is required to begin the trip. Please ask the passenger for the 4-digit code.', 'code' => 400);
            }

            // Fetch actual start OTP directly from booking record
            $bookingOtp = trim(isset($booking['start_otp']) ? $booking['start_otp'] : (isset($booking['otp']) ? $booking['otp'] : ''));
            if (empty($bookingOtp)) {
                $refreshed = $this->fetchOne("SELECT `start_otp`, `otp` FROM `bookings` WHERE `id` = ?", array($bookingId));
                $bookingOtp = trim(!empty($refreshed['start_otp']) ? $refreshed['start_otp'] : (!empty($refreshed['otp']) ? $refreshed['otp'] : ''));
            }

            // NO DEMO BYPASS, NO TEST BYPASS: Entered OTP must strictly match the passenger's OTP
            if (empty($bookingOtp) || trim((string)$otp) !== $bookingOtp) {
                return array('error' => 'Incorrect OTP. Please ask the passenger for the 4-digit start OTP shown on their screen.', 'code' => 401);
            }

            $bCols = $this->getExistingColumns('bookings');
            $setParts = array("`status` = 'IN_PROGRESS'", "`updated_at` = NOW()");
            if (isset($bCols['started_at'])) {
                $setParts[] = "`started_at` = NOW()";
            }
            $this->execute("UPDATE `bookings` SET " . implode(', ', $setParts) . " WHERE `id` = ?", array($bookingId));

            // Notify customer
            $this->safeInsertNotification($booking['customer_id'], 'CUSTOMER', 'Trip Started', 'Your ride is in progress. Have a safe journey!', 'RIDE', array('booking_id' => $bookingId, 'status' => 'IN_PROGRESS'));

            return $this->getCurrentRide($driverId);
        }

        if ($newStatus === 'COMPLETED') {
            if ($currentStatus === 'COMPLETED') {
                $totalFare = (float)$booking['total_fare'];
                $driverEarnings = round($totalFare * 0.85, 2);
                $commissionAmount = round($totalFare * 0.15, 2);
                return array(
                    'booking_id' => $bookingId,
                    'status' => 'COMPLETED',
                    'total_fare' => $totalFare,
                    'driver_earnings' => $driverEarnings,
                    'commission' => $commissionAmount,
                    'payment_method' => !empty($booking['payment_method']) ? $booking['payment_method'] : 'CASH',
                    'completed_at' => !empty($booking['completed_at']) ? $booking['completed_at'] : date('Y-m-d H:i:s')
                );
            }

            if ($currentStatus !== 'IN_PROGRESS') {
                if (in_array($currentStatus, array('ARRIVED', 'EN_ROUTE', 'ASSIGNED'))) {
                    $this->execute("UPDATE `bookings` SET `status` = 'IN_PROGRESS', `started_at` = COALESCE(`started_at`, NOW()) WHERE `id` = ?", array($bookingId));
                    $currentStatus = 'IN_PROGRESS';
                } else {
                    return array('error' => "Cannot complete ride that is not in progress (current: {$currentStatus})", 'code' => 400);
                }
            }

            // Destination arrival check:
            // Calculate distance to dropoff if available, but do not block completion so drivers can handle
            // early customer drop-offs and GPS drift without getting stuck.
            if ($dropoff && $driverLat !== null && $driverLng !== null) {
                $distMeters = $this->calculateDistanceMeters($driverLat, $driverLng, $dropoff['lat'], $dropoff['lng']);
            }

            $this->beginTransaction();
            try {
                // 1. Mark booking completed and payment paid
                $bCols = $this->getExistingColumns('bookings');
                $setParts = array("`status` = 'COMPLETED'", "`payment_status` = 'PAID'", "`updated_at` = NOW()");
                if (isset($bCols['completed_at'])) {
                    $setParts[] = "`completed_at` = NOW()";
                }
                $this->execute("UPDATE `bookings` SET " . implode(', ', $setParts) . " WHERE `id` = ?", array($bookingId));

                // 2. Increment customer total_rides (if column exists)
                $cCols = $this->getExistingColumns('customers');
                if (isset($cCols['total_rides'])) {
                    $this->execute("UPDATE `customers` SET `total_rides` = `total_rides` + 1 WHERE `id` = ?", array($booking['customer_id']));
                }

                // 3. Create payment record in `payments` table
                $paymentId = Security::generateUUID();
                $payMethod = !empty($booking['payment_method']) ? $booking['payment_method'] : 'CASH';
                $totalFare = (float)$booking['total_fare'];
                
                $pCols = $this->getExistingColumns('payments');
                if (!empty($pCols)) {
                    $pFields = array('`id`', '`booking_id`', '`customer_id`', '`method`', '`amount`', '`status`');
                    $pPlaceholders = array('?', '?', '?', '?', '?', '?');
                    $pParams = array($paymentId, $bookingId, $booking['customer_id'], $payMethod, $totalFare, 'SUCCESS');
                    
                    if (isset($pCols['type'])) {
                        $pFields[] = '`type`';
                        $pPlaceholders[] = '?';
                        $pParams[] = 'PAYMENT';
                    }
                    if (isset($pCols['paid_at'])) {
                        $pFields[] = '`paid_at`';
                        $pPlaceholders[] = 'NOW()';
                    }
                    if (isset($pCols['created_at'])) {
                        $pFields[] = '`created_at`';
                        $pPlaceholders[] = 'NOW()';
                    }
                    $pSql = "INSERT INTO `payments` (" . implode(', ', $pFields) . ") VALUES (" . implode(', ', $pPlaceholders) . ")";
                    $this->execute($pSql, $pParams);
                }

                // 4. Calculate driver earnings
                $driver = $this->findById($driverId);
                $commissionPct = isset($driver['commission_percent']) ? (float)$driver['commission_percent'] : 15.00;
                $commissionAmount = round($totalFare * ($commissionPct / 100.0), 2);
                $driverEarnings = round($totalFare - $commissionAmount, 2);

                // 5. Update driver wallet based on payment method
                $wallet = $this->getWalletDetails($driverId);
                if ($wallet) {
                    $txId = Security::generateUUID();
                    $wCols = $this->getExistingColumns('driver_wallets');
                    
                    $wSet = array();
                    $wParams = array();
                    if ($payMethod === 'CASH') {
                        $wSet[] = "`balance` = `balance` - ?";
                        $wParams[] = $commissionAmount;
                    } else {
                        $wSet[] = "`balance` = `balance` + ?";
                        $wParams[] = $driverEarnings;
                    }
                    if (isset($wCols['today_earnings'])) {
                        $wSet[] = "`today_earnings` = `today_earnings` + ?";
                        $wParams[] = $driverEarnings;
                    }
                    if (isset($wCols['today_trips'])) {
                        $wSet[] = "`today_trips` = `today_trips` + 1";
                    }
                    if (isset($wCols['total_commission_paid'])) {
                        $wSet[] = "`total_commission_paid` = `total_commission_paid` + ?";
                        $wParams[] = $commissionAmount;
                    }
                    if (isset($wCols['last_reset_date'])) {
                        $wSet[] = "`last_reset_date` = CURDATE()";
                    }
                    if (isset($wCols['updated_at'])) {
                        $wSet[] = "`updated_at` = NOW()";
                    }
                    $wParams[] = $driverId;
                    $wSql = "UPDATE `driver_wallets` SET " . implode(', ', $wSet) . " WHERE `driver_id` = ?";
                    $this->execute($wSql, $wParams);

                    // Insert transaction record
                    $txCols = $this->getExistingColumns('driver_wallet_transactions');
                    if (!empty($txCols)) {
                        $txType = ($payMethod === 'CASH') ? 'DEBIT' : 'CREDIT';
                        $txAmt = ($payMethod === 'CASH') ? $commissionAmount : $driverEarnings;
                        $desc = ($payMethod === 'CASH')
                            ? "Platform Commission ({$commissionPct}%) for cash ride {$bookingId} (Collected ₹{$totalFare})"
                            : "Net Earnings (85%) for ride {$bookingId} (Fare: ₹{$totalFare})";

                        $txFields = array('`id`', '`wallet_id`', '`driver_id`', '`type`', '`amount`', '`description`');
                        $txPlh = array('?', '?', '?', '?', '?', '?');
                        $txParams = array($txId, $wallet['id'], $driverId, $txType, $txAmt, $desc);
                        
                        if (isset($txCols['reference_id'])) {
                            $txFields[] = '`reference_id`';
                            $txPlh[] = '?';
                            $txParams[] = $bookingId;
                        }
                        if (isset($txCols['status'])) {
                            $txFields[] = '`status`';
                            $txPlh[] = "'SUCCESS'";
                        }
                        if (isset($txCols['created_at'])) {
                            $txFields[] = '`created_at`';
                            $txPlh[] = 'NOW()';
                        }
                        $txSql = "INSERT INTO `driver_wallet_transactions` (" . implode(', ', $txFields) . ") VALUES (" . implode(', ', $txPlh) . ")";
                        $this->execute($txSql, $txParams);
                    }
                }

                // 6. Update driver lifetime trip count (if column exists)
                $dCols = $this->getExistingColumns('drivers');
                if (isset($dCols['trips_count'])) {
                    $this->execute("UPDATE `drivers` SET `trips_count` = `trips_count` + 1 WHERE `id` = ?", array($driverId));
                }

                // 7. Notify customer about completed ride
                $this->safeInsertNotification($booking['customer_id'], 'CUSTOMER', 'Ride Completed', "You have arrived at your destination. Total fare: ₹{$totalFare}. Please rate your driver.", 'RIDE', array('booking_id' => $bookingId, 'total_fare' => $totalFare, 'payment_method' => $payMethod));

                $this->commit();

                return array(
                    'booking_id'      => $bookingId,
                    'status'          => 'COMPLETED',
                    'total_fare'      => $totalFare,
                    'driver_earnings' => $driverEarnings,
                    'commission'      => $commissionAmount,
                    'payment_id'      => $paymentId,
                    'payment_method'  => $payMethod,
                    'completed_at'    => date('Y-m-d H:i:s')
                );
            } catch (Exception $e) {
                $this->rollBack();
                throw $e;
            }
        }

        return array('error' => "Unsupported ride status: {$newStatus}", 'code' => 400);
    }

    // -------------------------------------------------------------
    // Ride History
    // -------------------------------------------------------------

    public function getRideHistory($driverId, $limit = 20, $offset = 0)
    {
        $sql = "SELECT b.id, b.ride_type, b.vehicle_category, b.status,
                       b.distance_km, b.duration_min, b.total_fare,
                       ROUND(b.total_fare * 0.85, 2) AS driver_earnings,
                       b.payment_method, b.payment_status, b.rating, b.created_at, b.completed_at,
                       c.name AS customer_name, c.phone AS customer_phone
                FROM `bookings` b
                INNER JOIN `customers` c ON c.id = b.customer_id
                WHERE b.driver_id = ? AND b.status IN ('COMPLETED', 'CANCELLED')
                ORDER BY b.created_at DESC
                LIMIT ? OFFSET ?";

        $stmt = $this->db->prepare($sql);
        $stmt->bindValue(1, $driverId, PDO::PARAM_STR);
        $stmt->bindValue(2, (int)$limit, PDO::PARAM_INT);
        $stmt->bindValue(3, (int)$offset, PDO::PARAM_INT);
        $stmt->execute();
        $rides = $stmt->fetchAll();

        foreach ($rides as &$r) {
            $locSql = "SELECT `type`, `name`, `address`
                       FROM `booking_locations`
                       WHERE `booking_id` = ?
                       ORDER BY `sequence_order` ASC";
            $locs = $this->fetchAll($locSql, array($r['id']));
            $pickup = null;
            $drop = null;
            foreach ($locs as $loc) {
                if ($loc['type'] === 'PICKUP' && $pickup === null) {
                    $pickup = $loc;
                } elseif ($loc['type'] === 'DROP') {
                    $drop = $loc;
                }
            }
            $r['pickup'] = $pickup;
            $r['drop']   = $drop;
        }

        return $rides;
    }

    // -------------------------------------------------------------
    // Wallet & Transactions
    // -------------------------------------------------------------

    public function getWalletDetails($driverId)
    {
        $this->checkAndResetDailyWallet($driverId);
        $sql = "SELECT `id`, `balance`, `today_earnings`, `today_trips`, `total_commission_paid`, `is_active`, `updated_at`
                FROM `driver_wallets`
                WHERE `driver_id` = ?
                LIMIT 1";
        $wallet = $this->fetchOne($sql, array($driverId));

        if (!$wallet) {
            $walletId = Security::generateUUID();
            $this->execute("INSERT INTO `driver_wallets` (`id`, `driver_id`, `balance`, `today_earnings`, `today_trips`, `total_commission_paid`, `is_active`)
                            VALUES (?, ?, 0.00, 0.00, 0, 0.00, 1)", array($walletId, $driverId));
            return array(
                'id'                    => $walletId,
                'balance'               => '0.00',
                'today_earnings'        => '0.00',
                'today_trips'           => 0,
                'total_commission_paid' => '0.00',
                'is_active'             => 1,
                'updated_at'            => date('Y-m-d H:i:s')
            );
        }

        return $wallet;
    }

    public function getWalletTransactions($driverId, $limit = 50, $offset = 0)
    {
        $sql = "SELECT `id`, `type`, `amount`, `status`, `description`, `reference_id`, `created_at`
                FROM `driver_wallet_transactions`
                WHERE `driver_id` = ?
                ORDER BY `created_at` DESC
                LIMIT ? OFFSET ?";

        $stmt = $this->db->prepare($sql);
        $stmt->bindValue(1, $driverId, PDO::PARAM_STR);
        $stmt->bindValue(2, (int)$limit, PDO::PARAM_INT);
        $stmt->bindValue(3, (int)$offset, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function rechargeWallet($driverId, $amount, $paymentMethod = 'UPI', $status = 'SUCCESS', $referenceId = null)
    {
        $wallet = $this->getWalletDetails($driverId);
        $amount = round((float)$amount, 2);

        if ($amount <= 0) {
            return array('error' => 'Recharge amount must be greater than zero', 'code' => 400);
        }

        $txId = Security::generateUUID();
        $refId = !empty($referenceId) ? $referenceId : 'TXN_' . strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 12));
        $desc = "Prepaid Wallet Top-up via " . strtoupper($paymentMethod);

        if ($status === 'SUCCESS') {
            $this->beginTransaction();
            try {
                // Update driver wallet balance
                $newBalance = (float)$wallet['balance'] + $amount;
                $this->execute("UPDATE `driver_wallets` SET `balance` = `balance` + ?, `updated_at` = NOW() WHERE `id` = ?", array($amount, $wallet['id']));

                // Insert ledger record with SUCCESS status
                $this->execute("INSERT INTO `driver_wallet_transactions` (`id`, `wallet_id`, `driver_id`, `type`, `amount`, `status`, `description`, `reference_id`, `created_at`)
                                VALUES (?, ?, ?, 'CREDIT', ?, 'SUCCESS', ?, ?, NOW())",
                    array($txId, $wallet['id'], $driverId, $amount, $desc, $refId)
                );

                // Send push notification
                $notifId = Security::generateUUID();
                $this->execute("INSERT INTO `notifications` (`id`, `user_id`, `user_type`, `title`, `message`, `type`, `is_read`, `audience`, `data_payload`, `created_at`)
                                VALUES (?, ?, 'DRIVER', 'Wallet Recharged', ?, 'PAYMENT', 0, 'INDIVIDUAL', ?, NOW())",
                    array($notifId, $driverId, "Your wallet has been recharged with ₹{$amount}. Available balance: ₹{$newBalance}", json_encode(array('amount' => $amount, 'balance' => $newBalance, 'reference_id' => $refId)))
                );

                $this->commit();

                return array(
                    'success'       => true,
                    'transactionId' => $txId,
                    'referenceId'   => $refId,
                    'amount'        => $amount,
                    'newBalance'    => $newBalance,
                    'status'        => 'SUCCESS',
                    'paymentMethod' => $paymentMethod,
                    'message'       => "Wallet recharged successfully with ₹{$amount}"
                );
            } catch (Exception $e) {
                $this->rollBack();
                throw $e;
            }
        } else {
            // Record failed transaction attempt
            $this->execute("INSERT INTO `driver_wallet_transactions` (`id`, `wallet_id`, `driver_id`, `type`, `amount`, `status`, `description`, `reference_id`, `created_at`)
                            VALUES (?, ?, ?, 'CREDIT', ?, 'FAILED', ?, ?, NOW())",
                array($txId, $wallet['id'], $driverId, $amount, "{$desc} (Payment Failed)", $refId)
            );

            return array(
                'success'       => false,
                'transactionId' => $txId,
                'referenceId'   => $refId,
                'amount'        => $amount,
                'status'        => 'FAILED',
                'paymentMethod' => $paymentMethod,
                'message'       => "Payment failed. Wallet balance was not modified."
            );
        }
    }

    // -------------------------------------------------------------
    // Notifications & Documents
    // -------------------------------------------------------------

    public function getNotifications($driverId, $limit = 30)
    {
        $sql = "SELECT `id`, `title`, `message`, `type`, `is_read`, `data_payload`, `created_at`
                FROM `notifications`
                WHERE (`user_id` = ? AND `user_type` = 'DRIVER')
                   OR (`audience` IN ('ALL', 'DRIVERS') AND `user_id` IS NULL)
                ORDER BY `created_at` DESC
                LIMIT ?";

        $stmt = $this->db->prepare($sql);
        $stmt->bindValue(1, $driverId, PDO::PARAM_STR);
        $stmt->bindValue(2, (int)$limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        foreach ($rows as &$r) {
            $r['is_read'] = (bool)$r['is_read'];
            if (!empty($r['data_payload'])) {
                $r['data_payload'] = json_decode($r['data_payload'], true);
            }
        }
        return $rows;
    }

    public function markNotificationRead($driverId, $notificationId)
    {
        $sql = "UPDATE `notifications`
                SET `is_read` = 1
                WHERE `id` = ? AND (`user_id` = ? AND `user_type` = 'DRIVER' OR `user_id` IS NULL)";
        return $this->execute($sql, array($notificationId, $driverId));
    }

    public function getDocuments($driverId)
    {
        $driver = $this->findById($driverId);
        $docsSql = "SELECT `id`, `document_type`, `document_number`, `file_url`, `verification_status`,
                           `expiry_date`, `rejection_reason`, `verified_at`
                    FROM `driver_documents`
                    WHERE `driver_id` = ?
                    ORDER BY `created_at` ASC";
        $documents = $this->fetchAll($docsSql, array($driverId));

        return array(
            'approval_status' => isset($driver['approval_status']) ? $driver['approval_status'] : 'PENDING',
            'documents'       => $documents
        );
    }

    public function saveDocument($driverId, $docType, $docNumber = null, $fileUrl = null, $expiryDate = null)
    {
        $docType = strtoupper(trim((string)$docType));
        if ($docType === 'DL' || $docType === 'DRIVING_LICENSE') $docType = 'LICENSE';
        if ($docType === 'AADHAR') $docType = 'AADHAAR';
        $validTypes = array('LICENSE','RC','INSURANCE','PERMIT','AADHAAR','PAN','PHOTO','ID','OTHER');
        if (!in_array($docType, $validTypes, true)) {
            $docType = 'OTHER';
        }

        $docNumber = $docNumber !== null ? trim((string)$docNumber) : '';

        $existing = $this->fetchOne("SELECT `id` FROM `driver_documents` WHERE `driver_id` = ? AND `document_type` = ? LIMIT 1", array($driverId, $docType));
        if ($existing) {
            $sql = "UPDATE `driver_documents`
                    SET `document_number` = CASE WHEN ? != '' THEN ? ELSE `document_number` END,
                        `file_url` = COALESCE(?, `file_url`),
                        `expiry_date` = COALESCE(?, `expiry_date`),
                        `verification_status` = 'PENDING',
                        `updated_at` = NOW()
                    WHERE `id` = ?";
            $this->execute($sql, array($docNumber, $docNumber, $fileUrl, $expiryDate, $existing['id']));
            $docId = $existing['id'];
        } else {
            $docId = Security::generateUUID();
            $sql = "INSERT INTO `driver_documents` (`id`, `driver_id`, `document_type`, `document_number`, `file_url`, `expiry_date`, `verification_status`, `created_at`)
                    VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NOW())";
            $this->execute($sql, array($docId, $driverId, $docType, $docNumber, $fileUrl, $expiryDate));
        }

        $driver = $this->findById($driverId);
        if ($driver && $driver['approval_status'] !== 'APPROVED') {
            $this->execute("UPDATE `drivers` SET `approval_status` = 'PENDING', `updated_at` = NOW() WHERE `id` = ?", array($driverId));
        }

        return $this->fetchOne("SELECT * FROM `driver_documents` WHERE `id` = ?", array($docId));
    }

    public function instantApprove($driverId)
    {
        $this->execute("UPDATE `drivers` SET `approval_status` = 'APPROVED', `is_online` = 1, `updated_at` = NOW() WHERE `id` = ?", array($driverId));
        $this->execute("UPDATE `driver_documents` SET `verification_status` = 'VERIFIED', `verified_at` = NOW() WHERE `driver_id` = ?", array($driverId));

        $activeVeh = $this->getActiveVehicle($driverId);
        if (!$activeVeh) {
            $vehId = Security::generateUUID();
            $randPlate = 'TN 30 ' . chr(mt_rand(65, 90)) . chr(mt_rand(65, 90)) . ' ' . mt_rand(1000, 9999);
            $this->execute(
                "INSERT INTO `driver_vehicles` (`id`, `driver_id`, `vehicle_model`, `vehicle_number`, `vehicle_type`, `color`, `year`, `is_active`, `created_at`)
                 VALUES (?, ?, 'Honda Activa 6G', ?, 'Bike', 'Black', 2023, 1, NOW())",
                array($vehId, $driverId, $randPlate)
            );
        }

        $wallet = $this->getWalletDetails($driverId);
        if (!$wallet) {
            $walletId = Security::generateUUID();
            $this->execute(
                "INSERT INTO `driver_wallets` (`id`, `driver_id`, `balance`, `today_earnings`, `today_trips`, `total_commission_paid`, `is_active`)
                 VALUES (?, ?, 500.00, 0.00, 0, 0.00, 1)",
                array($walletId, $driverId)
            );
        } elseif ((float)$wallet['balance'] <= 0) {
            $this->rechargeWallet($driverId, 500.00, 'UPI', 'SUCCESS', 'INSTANT_APPROVAL_GRANT');
        }

        return $this->findById($driverId);
    }

    public function dispatchTestRide($driverId, $driverLat = 11.6643, $driverLng = 78.1460, $vehicleCategory = 'Bike')
    {
        $testPhone = '9876500001';
        $customer = $this->fetchOne("SELECT * FROM `customers` WHERE `phone` = ? LIMIT 1", array($testPhone));
        if (!$customer) {
            $custId = Security::generateUUID();
            $this->execute(
                "INSERT INTO `customers` (`id`, `name`, `phone`, `email`, `is_active`, `created_at`)
                 VALUES (?, 'Salem Test Rider', ?, 'rider.test@jittadrives.com', 1, NOW())",
                array($custId, $testPhone)
            );
            $customer = $this->fetchOne("SELECT * FROM `customers` WHERE `id` = ?", array($custId));
        }

        $pLat = (float)$driverLat + (mt_rand(-5, 5) / 10000);
        $pLng = (float)$driverLng + (mt_rand(-5, 5) / 10000);
        $dLat = (float)$driverLat + 0.022;
        $dLng = (float)$driverLng + 0.018;

        $bookingId = Security::generateUUID();
        $otp = (string)mt_rand(1000, 9999);
        $distanceKm = 3.8;
        $durationMin = 12;
        $fare = ($vehicleCategory === 'Bike' || strpos(strtolower($vehicleCategory), 'bike') !== false) ? 45.00 : 95.00;

        $sql = "INSERT INTO `bookings` (`id`, `customer_id`, `city_id`, `ride_type`, `vehicle_category`,
                                        `status`, `distance_km`, `duration_min`, `base_fare`, `distance_fare`,
                                        `time_fare`, `platform_fee`, `tax`, `total_fare`, `payment_method`,
                                        `start_otp`, `created_at`, `updated_at`)
                VALUES (?, ?, 1, 'CITY', ?, 'SEARCHING', ?, ?, ?, ?, ?, 5.00, 2.50, ?, 'CASH', ?, NOW(), NOW())";

        $this->execute($sql, array(
            $bookingId,
            $customer['id'],
            $vehicleCategory,
            $distanceKm,
            $durationMin,
            $fare * 0.4,
            $fare * 0.5,
            $fare * 0.1,
            $fare,
            $otp
        ));

        $loc1 = Security::generateUUID();
        $this->execute(
            "INSERT INTO `booking_locations` (`id`, `booking_id`, `sequence_order`, `type`, `name`, `address`, `lat`, `lng`)
             VALUES (?, ?, 1, 'PICKUP', 'Nearby Customer Pickup', 'Near Current Location, Salem', ?, ?)",
            array($loc1, $bookingId, $pLat, $pLng)
        );

        $loc2 = Security::generateUUID();
        $this->execute(
            "INSERT INTO `booking_locations` (`id`, `booking_id`, `sequence_order`, `type`, `name`, `address`, `lat`, `lng`)
             VALUES (?, ?, 2, 'DROP', 'Salem Junction / Central Market', 'Suramangalam Main Rd, Salem', ?, ?)",
            array($loc2, $bookingId, $dLat, $dLng)
        );

        return array(
            'id'               => $bookingId,
            'customer_name'    => $customer['name'],
            'customer_phone'   => $customer['phone'],
            'vehicle_category' => $vehicleCategory,
            'distance_km'      => $distanceKm,
            'duration_min'     => $durationMin,
            'total_fare'       => $fare,
            'payment_method'   => 'CASH',
            'start_otp'        => $otp,
            'pickup' => array(
                'name'    => 'Nearby Customer Pickup',
                'address' => 'Near Current Location, Salem',
                'lat'     => $pLat,
                'lng'     => $pLng
            ),
            'drop' => array(
                'name'    => 'Salem Junction / Central Market',
                'address' => 'Suramangalam Main Rd, Salem',
                'lat'     => $dLat,
                'lng'     => $dLng
            )
        );
    }
}
