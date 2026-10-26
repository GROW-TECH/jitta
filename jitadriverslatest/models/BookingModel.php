<?php
/**
 * RedTaxi Backend - Booking Model
 * Handles customer ride history and detailed booking lookups.
 * Compatible with PHP 5.6+.
 */

require_once __DIR__ . '/BaseModel.php';
require_once dirname(__DIR__) . '/utils/Security.php';

class BookingModel extends BaseModel
{
    /** @var array cached table column maps */
    private $cachedCols = array();

    /**
     * Inspect and cache column names for a table.
     *
     * @param string $table
     * @return array map of lowercased column names
     */
    private function getTableColumns($table)
    {
        if (!isset($this->cachedCols[$table])) {
            $cols = array();
            try {
                $stmt = $this->db->query("SHOW COLUMNS FROM `{$table}`");
                if ($stmt) {
                    while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $cols[strtolower($r['Field'])] = true;
                    }
                }
            } catch (Exception $e) {}
            $this->cachedCols[$table] = $cols;
        }
        return $this->cachedCols[$table];
    }

    public function getCustomerById($id)
    {
        return $this->fetchOne("SELECT id, name, phone, email, status FROM `customers` WHERE id = ? LIMIT 1", array($id));
    }

    public function fetchCustomerByPhone($phone)
    {
        return $this->fetchOne("SELECT id, name, phone, email, status FROM `customers` WHERE phone = ? LIMIT 1", array($phone));
    }

    public function fetchAnyCustomer()
    {
        return $this->fetchOne("SELECT id, name, phone, email, status FROM `customers` ORDER BY created_at DESC LIMIT 1");
    }

    public function autoProvisionCustomer($id, $name, $phone, $email)
    {
        if (empty($name)) {
            $name = 'Passenger';
        }
        if (empty($phone)) {
            $phone = '9' . substr(preg_replace('/\D/', '', md5($id)), 0, 9);
        }
        if (empty($email)) {
            $email = 'rider_' . substr($id, 0, 8) . '@jittadrives.com';
        }

        // Check if customer with this ID already exists
        $existing = $this->fetchOne("SELECT id FROM `customers` WHERE id = ? LIMIT 1", array($id));
        if ($existing) {
            return $id;
        }

        // Check if phone taken
        $phoneMatch = $this->fetchOne("SELECT id FROM `customers` WHERE phone = ? LIMIT 1", array($phone));
        if ($phoneMatch) {
            return $phoneMatch['id'];
        }

        try {
            $this->execute(
                "INSERT IGNORE INTO `customers` (`id`, `name`, `phone`, `email`, `status`, `total_rides`, `created_at`, `updated_at`) VALUES (?, ?, ?, ?, 'ACTIVE', 0, NOW(), NOW())",
                array($id, $name, $phone, $email)
            );
            $walletId = Security::generateUUID();
            $this->execute(
                "INSERT IGNORE INTO `customer_wallets` (`id`, `customer_id`, `balance`, `is_active`) VALUES (?, ?, 500.00, 1)",
                array($walletId, $id)
            );
        } catch (Exception $e) {
            $any = $this->fetchOne("SELECT id FROM `customers` LIMIT 1");
            if ($any) {
                return $any['id'];
            }
        }
        return $id;
    }

    public function getCustomerBookings($customerId, $status = null, $limit = 20, $offset = 0)
    {
        $cols = $this->getTableColumns('bookings');
        $cityCol = isset($cols['city_id']) ? "b.city_id" : "1 AS city_id";
        $vehDetailsCol = isset($cols['customer_vehicle_details']) ? "b.customer_vehicle_details" : "NULL AS customer_vehicle_details";
        $schedTimeCol = isset($cols['scheduled_time']) ? "b.scheduled_time" : (isset($cols['scheduled_at']) ? "b.scheduled_at AS scheduled_time" : "NULL AS scheduled_time");
        $startAtCol = isset($cols['started_at']) ? "b.started_at" : "NULL AS started_at";
        $compAtCol = isset($cols['completed_at']) ? "b.completed_at" : "NULL AS completed_at";

        $sql = "SELECT b.id, {$cityCol}, b.ride_type, b.vehicle_category, b.status,
                       b.distance_km, b.duration_min, b.total_fare, b.payment_method,
                       b.payment_status, b.rating, {$schedTimeCol}, b.created_at,
                       {$startAtCol}, {$compAtCol}, {$vehDetailsCol},
                       d.name AS driver_name, d.phone AS driver_phone, d.photo_url AS driver_photo, d.rating AS driver_rating,
                       d.current_lat AS driver_lat, d.current_lng AS driver_lng, d.last_location_at AS driver_location_at,
                       v.vehicle_model, v.vehicle_number, v.vehicle_type
                FROM `bookings` b
                LEFT JOIN `drivers` d ON d.id = b.driver_id
                LEFT JOIN `driver_vehicles` v ON v.id = b.vehicle_id
                WHERE b.customer_id = ?";

        $params = array($customerId);

        if (!empty($status)) {
            $sql .= " AND b.status = ?";
            $params[] = strtoupper($status);
        }

        $limitInt = max(1, (int)$limit);
        $offsetInt = max(0, (int)$offset);
        $sql .= " ORDER BY b.created_at DESC LIMIT {$limitInt} OFFSET {$offsetInt}";

        $bookings = $this->fetchAll($sql, $params);

        // Attach pickup and drop summary for each booking
        foreach ($bookings as &$b) {
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
                } elseif ($loc['type'] === 'DROP' || $loc['type'] === 'DROPOFF') {
                    $drop = $loc;
                }
            }

            $b['pickup'] = $pickup;
            $b['drop']   = $drop;

            // Decode customer vehicle details (DRIVER ONLY mode)
            if (!empty($b['customer_vehicle_details'])) {
                $decoded = json_decode($b['customer_vehicle_details'], true);
                $b['customer_vehicle_details'] = is_array($decoded) ? $decoded : null;
            } else {
                $b['customer_vehicle_details'] = null;
            }
        }

        return $bookings;
    }

    public function getCustomerBookingDetail($customerId, $bookingId)
    {
        $cols = $this->getTableColumns('bookings');
        $hasCityId = isset($cols['city_id']);
        $cityJoin = $hasCityId ? "LEFT JOIN `cities` ci ON ci.id = b.city_id" : "";
        $cityNameCol = $hasCityId ? "ci.name AS city_name," : "NULL AS city_name,";

        $sql = "SELECT b.*,
                       TIMESTAMPDIFF(SECOND, b.created_at, NOW()) AS elapsed_seconds,
                       {$cityNameCol}
                       d.name AS driver_name, d.phone AS driver_phone, d.photo_url AS driver_photo, d.rating AS driver_rating,
                       d.current_lat AS driver_lat, d.current_lng AS driver_lng, d.last_location_at AS driver_location_at,
                       v.vehicle_model, v.vehicle_number, v.vehicle_type, v.color AS vehicle_color
                FROM `bookings` b
                {$cityJoin}
                LEFT JOIN `drivers` d ON d.id = b.driver_id
                LEFT JOIN `driver_vehicles` v ON v.id = b.vehicle_id
                WHERE b.id = ? AND b.customer_id = ?
                LIMIT 1";

        $booking = $this->fetchOne($sql, array($bookingId, $customerId));
        if (!$booking) {
            return null;
        }

        // Auto-expire search if searching for >= 120 seconds without driver acceptance
        $elapsedSec = isset($booking['elapsed_seconds']) ? (int)$booking['elapsed_seconds'] : (time() - strtotime($booking['created_at']));
        if ($booking['status'] === 'SEARCHING' && $elapsedSec >= 120) {
            try {
                $this->execute(
                    "UPDATE `bookings` SET `status` = 'CANCELLED', `cancelled_at` = NOW(), `updated_at` = NOW() WHERE `id` = ? AND `status` = 'SEARCHING'",
                    array($bookingId)
                );
                $this->execute(
                    "INSERT IGNORE INTO `cancellations` (`id`, `booking_id`, `cancelled_by`, `reason`, `cancellation_fee`, `created_at`) VALUES (?, ?, 'SYSTEM', 'NO_DRIVERS_AVAILABLE', 0.00, NOW())",
                    array(Security::generateUUID(), $bookingId)
                );
            } catch (Exception $e) {}
            $booking['status'] = 'CANCELLED';
        }

        // Attach cancellation details if cancelled
        if ($booking['status'] === 'CANCELLED') {
            $cancelRec = $this->fetchOne("SELECT `reason`, `cancelled_by` FROM `cancellations` WHERE `booking_id` = ? ORDER BY `created_at` DESC LIMIT 1", array($bookingId));
            $booking['cancellation_reason'] = $cancelRec ? $cancelRec['reason'] : null;
            $booking['cancelled_by'] = $cancelRec ? $cancelRec['cancelled_by'] : null;
        }

        // Format fare breakdown
        $booking['fare_breakdown'] = array(
            'base_fare'     => (float)$booking['base_fare'],
            'distance_fare' => (float)$booking['distance_fare'],
            'time_fare'     => (float)$booking['time_fare'],
            'waiting_fare'  => (float)$booking['waiting_fare'],
            'platform_fee'  => (float)$booking['platform_fee'],
            'tax'           => (float)$booking['tax'],
            'discount'      => (float)$booking['discount'],
            'total_fare'    => (float)$booking['total_fare']
        );

        // Driver details
        if ($booking['driver_id']) {
            $booking['driver'] = array(
                'id'          => $booking['driver_id'],
                'name'        => $booking['driver_name'],
                'phone'       => $booking['driver_phone'],
                'photo_url'   => $booking['driver_photo'],
                'rating'      => $booking['driver_rating'],
                'current_lat' => isset($booking['driver_lat']) ? (float)$booking['driver_lat'] : null,
                'current_lng' => isset($booking['driver_lng']) ? (float)$booking['driver_lng'] : null,
                'last_location_at' => $booking['driver_location_at']
            );
        } else {
            $booking['driver'] = null;
        }

        // Vehicle details
        if ($booking['vehicle_id']) {
            $booking['vehicle'] = array(
                'id'             => $booking['vehicle_id'],
                'vehicle_model'  => $booking['vehicle_model'],
                'vehicle_number' => $booking['vehicle_number'],
                'vehicle_type'   => $booking['vehicle_type'],
                'color'          => $booking['vehicle_color']
            );
        } elseif (isset($booking['ride_type']) && $booking['ride_type'] === 'DRIVER_ONLY') {
            $cvJson = !empty($booking['customer_vehicle_details']) ? @json_decode($booking['customer_vehicle_details'], true) : array();
            $regNo = !empty($booking['vehicle_reg_no']) ? $booking['vehicle_reg_no'] : (!empty($cvJson['number']) ? $cvJson['number'] : null);
            $booking['vehicle'] = array(
                'id'                  => 'customer-vehicle',
                'vehicle_model'       => !empty($cvJson['model']) ? $cvJson['model'] : 'Customer Vehicle',
                'vehicle_number'      => $regNo,
                'vehicle_type'        => !empty($cvJson['type']) ? $cvJson['type'] : 'Customer Vehicle',
                'color'               => !empty($cvJson['color']) ? $cvJson['color'] : '',
                'verification_status' => !empty($booking['vehicle_verification_status']) ? $booking['vehicle_verification_status'] : 'NOT_PROVIDED',
                'driver_confirmed'    => !empty($booking['driver_vehicle_confirmed']),
                'mismatch_reported'   => !empty($booking['driver_mismatch_reported']),
                'is_customer_vehicle' => true
            );
        } else {
            $booking['vehicle'] = null;
        }

        // Fetch all route points
        $locSql = "SELECT `id`, `type`, `sequence_order`, `name`, `address`, `lat`, `lng`, `category`
                   FROM `booking_locations`
                   WHERE `booking_id` = ?
                   ORDER BY `sequence_order` ASC";
        $booking['locations'] = $this->fetchAll($locSql, array($bookingId));

        // Fetch payment records
        $booking['payments'] = $this->getBookingPayments($bookingId);

        // Fetch cancellation details if cancelled
        if ($booking['status'] === 'CANCELLED') {
            $cancelSql = "SELECT `cancelled_by`, `reason`, `cancellation_fee`, `fee_charged_to`, `created_at`
                          FROM `cancellations`
                          WHERE `booking_id` = ?
                          LIMIT 1";
            $booking['cancellation'] = $this->fetchOne($cancelSql, array($bookingId));
        } else {
            $booking['cancellation'] = null;
        }

        // Decode customer vehicle details (DRIVER ONLY mode)
        if (!empty($booking['customer_vehicle_details'])) {
            $decoded = json_decode($booking['customer_vehicle_details'], true);
            $booking['customer_vehicle_details'] = is_array($decoded) ? $decoded : null;
        } else {
            $booking['customer_vehicle_details'] = null;
        }

        // Ensure OTP keys are uniformly populated for the customer
        $resolvedOtp = !empty($booking['start_otp']) ? $booking['start_otp'] : (!empty($booking['otp']) ? $booking['otp'] : (!empty($booking['otp_code']) ? $booking['otp_code'] : null));
        $booking['start_otp'] = $resolvedOtp;
        $booking['startOtp']  = $resolvedOtp;
        $booking['otp']       = $resolvedOtp;
        $booking['otp_code']  = $resolvedOtp;

        // Clean up flat redundant keys
        unset($booking['driver_name'], $booking['driver_phone'], $booking['driver_photo'], $booking['driver_rating']);
        unset($booking['vehicle_model'], $booking['vehicle_number'], $booking['vehicle_type'], $booking['vehicle_color']);

        return $booking;
    }

    private function getBookingPayments($bookingId)
    {
        try {
            $payCols = $this->getTableColumns('payments');
            $typePay = isset($payCols['type']) ? "`type`," : "NULL AS `type`,";
            $paidAtPay = isset($payCols['paid_at']) ? "`paid_at`" : (isset($payCols['updated_at']) ? "`updated_at` AS `paid_at`" : "NULL AS `paid_at`");
            $paySql = "SELECT `id`, `method`, {$typePay} `amount`, `status`, `gateway_txn_id`, {$paidAtPay}
                       FROM `payments`
                       WHERE `booking_id` = ?
                       ORDER BY `created_at` DESC";
            return $this->fetchAll($paySql, array($bookingId));
        } catch (Exception $e) {
            return array();
        }
    }

    /**
     * Get select fields and search columns for vehicle_categories dynamically.
     *
     * @return array
     */
    private function getVehicleCategorySelectFields()
    {
        $cols = $this->getTableColumns('vehicle_categories');

        $hasCat = isset($cols['category']);
        $hasCap = isset($cols['capacity']);
        $hasBp  = isset($cols['base_price']);
        $hasPkm = isset($cols['per_km_rate']);
        $hasEta = isset($cols['eta_min']);
        $hasTag = isset($cols['tagline']);
        $hasImg = isset($cols['image_url']);
        $hasOrd = isset($cols['sort_order']);

        $category  = $hasCat ? (isset($cols['code']) ? "COALESCE(category, code) AS category" : "category") : (isset($cols['code']) ? "code AS category" : "name AS category");
        $capacity  = $hasCap ? (isset($cols['seat_capacity']) ? "COALESCE(capacity, seat_capacity) AS capacity" : "capacity") : (isset($cols['seat_capacity']) ? "seat_capacity AS capacity" : "4 AS capacity");
        $basePrice = $hasBp  ? (isset($cols['base_fare']) ? "COALESCE(base_price, base_fare) AS base_price" : "base_price") : (isset($cols['base_fare']) ? "base_fare AS base_price" : "50.00 AS base_price");
        $perKmRate = $hasPkm ? (isset($cols['per_km_fare']) ? "COALESCE(per_km_rate, per_km_fare) AS per_km_rate" : "per_km_rate") : (isset($cols['per_km_fare']) ? "per_km_fare AS per_km_rate" : "15.00 AS per_km_rate");
        $etaMin    = $hasEta ? "eta_min" : "5 AS eta_min";
        $tagline   = $hasTag ? "tagline" : (isset($cols['description']) ? "description AS tagline" : "NULL AS tagline");
        $image     = $hasImg ? "image_url" : (isset($cols['icon_url']) ? "icon_url AS image_url" : "NULL AS image_url");
        $order     = $hasOrd ? "sort_order" : "0 AS sort_order";

        return array(
            'fields'     => "id, name, {$category}, {$capacity}, {$basePrice}, {$perKmRate}, {$etaMin}, {$tagline}, {$image}, {$order}",
            'search_col' => $hasCat ? "`category`" : (isset($cols['code']) ? "`code`" : "`name`"),
            'order_col'  => $hasOrd ? "`sort_order`" : "`id`"
        );
    }

    /**
     * Get all active vehicle categories.
     *
     * @return array
     */
    public function getVehicleCategories()
    {
        $sel = $this->getVehicleCategorySelectFields();
        $sql = "SELECT {$sel['fields']}
                FROM `vehicle_categories`
                WHERE `is_active` = 1
                ORDER BY {$sel['order_col']} ASC";
        return $this->fetchAll($sql);
    }

    /**
     * Find an active vehicle category by ID, name, or keyword.
     *
     * @param string $identifier
     * @return array|null
     */
    public function findVehicleCategory($identifier)
    {
        $sel = $this->getVehicleCategorySelectFields();
        $clean = trim((string)$identifier);
        if ($clean === '') {
            return $this->fetchOne("SELECT {$sel['fields']} FROM `vehicle_categories` WHERE `is_active` = 1 ORDER BY {$sel['order_col']} ASC LIMIT 1");
        }

        $lower = strtolower($clean);

        // Alias mapping for common UI vehicle names
        $aliases = array(
            'cab economy'   => 'mini',
            'economy'       => 'mini',
            'cab'           => 'mini',
            'cabs'          => 'mini',
            'hatchback'     => 'mini',
            'sedan premium' => 'sedan',
            'prime'         => 'sedan',
            'suv xl'        => 'suv',
            'xl'            => 'suv',
            'scooty'        => 'scooter',
            'scoot'         => 'scooter',
            'moto lite'     => 'bike',
            'moto'          => 'bike',
            'motorcycle'    => 'bike',
            'auto rickshaw' => 'auto',
            'rickshaw'      => 'auto',
            'customer vehicle' => 'mini',
        );

        if (isset($aliases[$lower])) {
            $aliasId = $aliases[$lower];
            $cat = $this->fetchOne("SELECT {$sel['fields']} FROM `vehicle_categories` WHERE `is_active` = 1 AND (`id` = ? OR LOWER({$sel['search_col']}) = LOWER(?)) LIMIT 1", array($aliasId, $aliasId));
            if ($cat) {
                return $cat;
            }
        }

        // 1. Try exact ID or Name or search_col
        $sql = "SELECT {$sel['fields']}
                FROM `vehicle_categories`
                WHERE `is_active` = 1 AND (LOWER(`id`) = LOWER(?) OR LOWER(`name`) = LOWER(?) OR LOWER({$sel['search_col']}) = LOWER(?))
                LIMIT 1";
        $cat = $this->fetchOne($sql, array($clean, $clean, $clean));
        if ($cat) {
            return $cat;
        }

        // 2. Try partial match on ID or Name or search_col
        $sqlLike = "SELECT {$sel['fields']}
                    FROM `vehicle_categories`
                    WHERE `is_active` = 1 AND (LOWER(`id`) LIKE ? OR LOWER(`name`) LIKE ? OR LOWER({$sel['search_col']}) LIKE ?)
                    ORDER BY {$sel['order_col']} ASC
                    LIMIT 1";
        $param = '%' . strtolower($clean) . '%';
        $res = $this->fetchOne($sqlLike, array($param, $param, $param));
        if ($res) {
            return $res;
        }

        // 3. Try keywords like 'auto', 'mini', 'sedan', 'suv', 'bike', 'scooter', 'outstation'
        $words = preg_split('/\s+/', strtolower($clean));
        foreach ($words as $w) {
            $w = trim($w);
            if (strlen($w) >= 3) {
                $p = '%' . $w . '%';
                $match = $this->fetchOne($sqlLike, array($p, $p, $p));
                if ($match) {
                    return $match;
                }
            }
        }

        // 4. Safe fallback: return the primary active vehicle category instead of null
        return $this->fetchOne("SELECT {$sel['fields']} FROM `vehicle_categories` WHERE `is_active` = 1 ORDER BY {$sel['order_col']} ASC LIMIT 1");
    }

    /**
     * Fetch active fare rule for a given city and vehicle category.
     *
     * @param int $cityId
     * @param string $categoryId
     * @return array|null
     */
    public function getFareRule($cityId, $categoryId)
    {
        try {
            $cols = $this->getTableColumns('fare_rules');
            if (empty($cols)) {
                return null;
            }

            $hasCatId    = isset($cols['category_id']);
            $hasVehCatId = isset($cols['vehicle_category_id']);
            $catCol = $hasCatId ? 'category_id' : ($hasVehCatId ? 'vehicle_category_id' : null);

            if (!$catCol) {
                return null;
            }

            $hasCityId = isset($cols['city_id']);
            $cityClause = ($hasCityId && !empty($cityId)) ? "fr.city_id = ? AND " : "";
            $cityParams = ($hasCityId && !empty($cityId)) ? array((int)$cityId, $categoryId) : array($categoryId);

            $sql = "SELECT fr.*
                    FROM `fare_rules` fr
                    WHERE {$cityClause}fr.`{$catCol}` = ? AND fr.is_active = 1
                    LIMIT 1";

            $rule = $this->fetchOne($sql, $cityParams);

            if (!$rule && $hasCityId) {
                // Fallback across any city
                $fallbackSql = "SELECT fr.*
                                FROM `fare_rules` fr
                                WHERE fr.`{$catCol}` = ? AND fr.is_active = 1
                                LIMIT 1";
                $rule = $this->fetchOne($fallbackSql, array($categoryId));
            }

            if (!$rule) {
                return null;
            }

            // Normalize fields across both schemas
            return array(
                'id'               => $rule['id'],
                'city_id'          => isset($rule['city_id']) ? $rule['city_id'] : $cityId,
                'category_id'      => isset($rule['category_id']) ? $rule['category_id'] : (isset($rule['vehicle_category_id']) ? $rule['vehicle_category_id'] : $categoryId),
                'base_fare'        => isset($rule['base_fare']) ? (float)$rule['base_fare'] : 50.00,
                'free_km'          => isset($rule['free_km']) ? (float)$rule['free_km'] : 0.0,
                'per_km'           => isset($rule['per_km']) ? (float)$rule['per_km'] : (isset($rule['per_km_fare']) ? (float)$rule['per_km_fare'] : 15.00),
                'per_minute'       => isset($rule['per_minute']) ? (float)$rule['per_minute'] : (isset($rule['per_min_fare']) ? (float)$rule['per_min_fare'] : 2.00),
                'waiting_per_min'  => isset($rule['waiting_per_min']) ? (float)$rule['waiting_per_min'] : (isset($rule['waiting_charge_per_min']) ? (float)$rule['waiting_charge_per_min'] : 0.00),
                'platform_fee'     => isset($rule['platform_fee']) ? (float)$rule['platform_fee'] : 10.00,
                'tax_percent'      => isset($rule['tax_percent']) ? (float)$rule['tax_percent'] : 5.00,
                'cancellation_fee' => isset($rule['cancellation_fee']) ? (float)$rule['cancellation_fee'] : 30.00,
                'is_active'        => isset($rule['is_active']) ? (int)$rule['is_active'] : 1
            );
        } catch (Exception $e) {
            return null;
        }
    }

    /**
     * Calculate comprehensive fare estimate.
     *
     * @param array $category
     * @param float $distanceKm
     * @param float $durationMin
     * @param int $cityId
     * @param string|null $couponCode
     * @return array
     */
    public function calculateFareEstimate($category, $distanceKm, $durationMin, $cityId = 1, $couponCode = null)
    {
        $fareRule = $this->getFareRule($cityId, $category['id']);

        $baseFare    = $fareRule ? (float)$fareRule['base_fare'] : (float)$category['base_price'];
        $freeKm      = $fareRule ? (float)$fareRule['free_km'] : 0.0;
        $perKmRate   = $fareRule ? (float)$fareRule['per_km'] : (float)$category['per_km_rate'];
        $perMinRate  = $fareRule ? (float)$fareRule['per_minute'] : 2.50;
        $waitingRate = $fareRule ? (float)$fareRule['waiting_per_min'] : 0.00;
        $platformFee = $fareRule ? (float)$fareRule['platform_fee'] : 10.00;
        $taxPercent  = $fareRule ? (float)$fareRule['tax_percent'] : 5.00;
        $cancellationFee = $fareRule ? (float)$fareRule['cancellation_fee'] : 30.00;

        $distance = max(0.0, (float)$distanceKm);
        $duration = max(0.0, (float)$durationMin);

        // Distance fare: distance beyond free_km is charged at perKmRate
        $billableDistance = $distance > $freeKm ? ($distance - $freeKm) : 0.0;
        $distanceFare = round($billableDistance * $perKmRate, 2);

        // Time fare: charged at perMinRate
        $timeFare = round($duration * $perMinRate, 2);

        $waitingFare = 0.00;

        // Subtotal before taxes and discounts
        $subtotal = round($baseFare + $distanceFare + $timeFare + $waitingFare + $platformFee, 2);

        // Tax (e.g. 5% GST)
        $taxAmount = round($subtotal * ($taxPercent / 100.0), 2);

        // Optional coupon discount
        $discountAmount = 0.00;
        $appliedCoupon = null;

        if (!empty($couponCode)) {
            $couponSql = "SELECT * FROM `coupons`
                          WHERE `code` = ? AND `is_active` = 1 AND `expiry_date` >= CURDATE()
                          LIMIT 1";
            $coupon = $this->fetchOne($couponSql, array(trim(strtoupper($couponCode))));

            if ($coupon && $subtotal >= (float)$coupon['min_booking']) {
                if ($coupon['discount_type'] === 'FLAT') {
                    $discountAmount = (float)$coupon['discount_amount'];
                } else {
                    $discountAmount = round(($subtotal * (float)$coupon['discount_amount']) / 100.0, 2);
                    if ($coupon['max_discount'] !== null && (float)$coupon['max_discount'] > 0) {
                        $discountAmount = min($discountAmount, (float)$coupon['max_discount']);
                    }
                }
                $discountAmount = min($discountAmount, $subtotal);
                $appliedCoupon = array(
                    'coupon_id'       => $coupon['id'],
                    'code'            => $coupon['code'],
                    'discount_type'   => $coupon['discount_type'],
                    'discount_amount' => (float)$coupon['discount_amount'],
                    'savings'         => $discountAmount,
                    'description'     => $coupon['description']
                );
            }
        }

        $totalFare = max(0.0, round($subtotal + $taxAmount - $discountAmount, 2));

        return array(
            'base_fare'            => $baseFare,
            'distance_fare'        => $distanceFare,
            'time_fare'            => $timeFare,
            'waiting_fare'         => $waitingFare,
            'platform_fee'         => $platformFee,
            'subtotal'             => $subtotal,
            'tax'                  => $taxAmount,
            'discount'             => $discountAmount,
            'total_fare'           => $totalFare,
            // CamelCase aliases for frontend compatibility
            'baseFare'             => $baseFare,
            'distanceFare'         => $distanceFare,
            'timeFare'             => $timeFare,
            'waitingFare'          => $waitingFare,
            'platformFee'          => $platformFee,
            'totalFare'            => $totalFare,
            'taxAmount'            => $taxAmount,
            'discountAmount'       => $discountAmount,
            'pricing_details'      => array(
                'distance_km'          => $distance,
                'duration_min'         => $duration,
                'free_km'              => $freeKm,
                'billable_distance_km' => round($billableDistance, 2),
                'per_km_rate'          => $perKmRate,
                'per_minute_rate'      => $perMinRate,
                'platform_fee'         => $platformFee,
                'tax_percent'          => $taxPercent,
                'cancellation_fee'     => $cancellationFee,
                'currency'             => 'INR',
                'currency_symbol'      => '₹'
            ),
            'applied_coupon'       => $appliedCoupon
        );
    }

    /**
     * Get the DRIVER ONLY hourly chauffeur rate from system settings.
     * Defaults to ₹200/hour when the setting is not configured.
     *
     * @return float
     */
    public function getDriverOnlyRatePerHour()
    {
        $row = $this->fetchOne("SELECT `v` FROM `system_settings` WHERE `k` = 'driver_only_rate_per_hour' LIMIT 1");
        $rate = $row && isset($row['v']) && is_numeric($row['v']) ? (float)$row['v'] : 200.00;
        return max(50.00, round($rate, 2));
    }

    /**
     * Calculate DRIVER ONLY fare estimate (customer owns the vehicle, hires a chauffeur).
     * Fare is the driver's fee: hours x hourly rate + platform fee + tax.
     *
     * @param float $hours
     * @param int $cityId
     * @return array
     */
    public function calculateDriverOnlyFareEstimate($hours, $cityId = 1)
    {
        $hours      = max(0.25, (float)$hours);
        $hourlyRate = $this->getDriverOnlyRatePerHour();
        $platformFee = 25.00;
        $taxPercent  = 5.00;

        $baseFare = round($hours * $hourlyRate, 2);
        $subtotal = round($baseFare + $platformFee, 2);
        $taxAmount = round($subtotal * ($taxPercent / 100.0), 2);
        $totalFare = round($subtotal + $taxAmount, 2);

        return array(
            'base_fare'            => $baseFare,
            'distance_fare'        => 0.00,
            'time_fare'            => 0.00,
            'waiting_fare'         => 0.00,
            'platform_fee'         => $platformFee,
            'subtotal'             => $subtotal,
            'tax'                  => $taxAmount,
            'discount'             => 0.00,
            'total_fare'           => $totalFare,
            // CamelCase aliases for frontend compatibility
            'baseFare'             => $baseFare,
            'distanceFare'         => 0.00,
            'timeFare'             => 0.00,
            'waitingFare'          => 0.00,
            'platformFee'          => $platformFee,
            'totalFare'            => $totalFare,
            'taxAmount'            => $taxAmount,
            'discountAmount'       => 0.00,
            'pricing_details'      => array(
                'distance_km'          => 0.0,
                'duration_min'         => round($hours * 60, 1),
                'driver_only_hours'    => $hours,
                'per_hour_rate'        => $hourlyRate,
                'free_km'              => 0.0,
                'billable_distance_km' => 0.0,
                'per_km_rate'          => 0.0,
                'per_minute_rate'      => 0.0,
                'platform_fee'         => $platformFee,
                'tax_percent'          => $taxPercent,
                'cancellation_fee'     => 30.00,
                'driver_only'          => true,
                'currency'             => 'INR',
                'currency_symbol'      => '₹'
            ),
            'applied_coupon'       => null
        );
    }

    /**
     * Create a notification record in `notifications` table.
     *
     * @param string|null $userId
     * @param string|null $userType 'CUSTOMER', 'DRIVER', or 'ADMIN'
     * @param string $title
     * @param string $message
     * @param string $type 'RIDE', 'OFFER', 'SYSTEM', or 'PAYMENT'
     * @param string $audience 'INDIVIDUAL', 'ALL', 'CUSTOMERS', or 'DRIVERS'
     * @param array|null $dataPayload
     * @return string Notification UUID
     */
    public function createNotification($userId, $userType, $title, $message, $type, $audience, $dataPayload)
    {
        $id = Security::generateUUID();
        $payloadJson = $dataPayload !== null ? json_encode($dataPayload) : null;
        $sql = "INSERT INTO `notifications` (`id`, `user_id`, `user_type`, `title`, `message`, `type`, `is_read`, `audience`, `data_payload`, `created_at`)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NOW())";
        $this->execute($sql, array($id, $userId, $userType, $title, $message, $type, $audience, $payloadJson));
        return $id;
    }

    /**
     * Create a new ride booking with locations, fare breakdown, and notifications in a transaction.
     *
     * @param string $customerId
     * @param array $data
     * @return array
     */
    public function createBooking($customerId, $data)
    {
        // 0. Ensure customer exists in `customers` table to satisfy foreign key fk_bookings_customer
        $custExists = $this->fetchOne("SELECT id FROM `customers` WHERE id = ? LIMIT 1", array($customerId));
        if (!$custExists) {
            $custPhone = isset($data['customer_phone']) && !empty($data['customer_phone']) ? $data['customer_phone'] : ('9' . substr(preg_replace('/\D/', '', md5($customerId)), 0, 9));
            $phoneCheck = $this->fetchCustomerByPhone($custPhone);
            if ($phoneCheck) {
                $customerId = $phoneCheck['id'];
            } else {
                $custName = isset($data['customer_name']) && !empty($data['customer_name']) ? $data['customer_name'] : 'Passenger';
                $custEmail = isset($data['customer_email']) && !empty($data['customer_email']) ? $data['customer_email'] : ('rider_' . substr($customerId, 0, 8) . '@jittadrives.com');
                $customerId = $this->autoProvisionCustomer($customerId, $custName, $custPhone, $custEmail);
            }
        }

        $this->beginTransaction();
        try {
            // Cancel any prior unaccepted SEARCHING bookings for this customer so stale requests don't linger
            $this->execute("UPDATE `bookings` SET `status` = 'CANCELLED' WHERE `customer_id` = ? AND `status` = 'SEARCHING'", array($customerId));

            $bookingId = Security::generateUUID();
            $otp = Security::generateOtp(4);

            $cityId          = isset($data['city_id']) ? (int)$data['city_id'] : 1;
            // Ensure city exists in cities table
            $cityExists = $this->fetchOne("SELECT id FROM `cities` WHERE id = ? LIMIT 1", array($cityId));
            if (!$cityExists) {
                $anyCity = $this->fetchOne("SELECT id FROM `cities` ORDER BY id ASC LIMIT 1");
                $cityId = $anyCity ? (int)$anyCity['id'] : 1;
            }
            $rideType        = isset($data['ride_type']) ? strtoupper(trim($data['ride_type'])) : 'CITY';
            $isDriverOnly    = ($rideType === 'DRIVER_ONLY');
            $vehicleCategory = isset($data['vehicle_category']) ? $data['vehicle_category'] : 'Customer Vehicle';
            $distanceKm      = isset($data['distance_km']) ? (float)$data['distance_km'] : 0.0;
            $durationMin     = isset($data['duration_min']) ? (float)$data['duration_min'] : 0.0;
            $paymentMethod   = isset($data['payment_method']) ? strtoupper(trim($data['payment_method'])) : 'CASH';
            $scheduledTime   = isset($data['scheduled_time']) && !empty($data['scheduled_time']) ? $data['scheduled_time'] : null;

            // Status is SCHEDULED if scheduled_time is set in the future, else SEARCHING
            $status = 'SEARCHING';
            if ($scheduledTime !== null) {
                $schedTimestamp = strtotime($scheduledTime);
                if ($schedTimestamp && $schedTimestamp > time()) {
                    $status = 'SCHEDULED';
                }
            }

            // Fare breakdown values
            $fare = (isset($data['fare_breakdown']) && is_array($data['fare_breakdown'])) ? $data['fare_breakdown'] : array();
            $totalFare    = isset($fare['total_fare']) ? (float)$fare['total_fare'] : (isset($data['total_fare']) ? (float)$data['total_fare'] : 0.0);
            $baseFare     = isset($fare['base_fare']) ? (float)$fare['base_fare'] : $totalFare;
            $distanceFare = isset($fare['distance_fare']) ? (float)$fare['distance_fare'] : 0.0;
            $timeFare     = isset($fare['time_fare']) ? (float)$fare['time_fare'] : 0.0;
            $waitingFare  = isset($fare['waiting_fare']) ? (float)$fare['waiting_fare'] : 0.0;
            $platformFee  = isset($fare['platform_fee']) ? (float)$fare['platform_fee'] : 0.0;
            $tax          = isset($fare['tax']) ? (float)$fare['tax'] : 0.0;
            $discount     = isset($fare['discount']) ? (float)$fare['discount'] : 0.0;

            $couponId = isset($data['coupon_id']) ? $data['coupon_id'] : null;
            $outstationDetails = isset($data['outstation_details']) ? (is_array($data['outstation_details']) ? json_encode($data['outstation_details']) : $data['outstation_details']) : null;
            $rentalDetails     = isset($data['rental_details']) ? (is_array($data['rental_details']) ? json_encode($data['rental_details']) : $data['rental_details']) : null;
            $airportDetails    = isset($data['airport_details']) ? (is_array($data['airport_details']) ? json_encode($data['airport_details']) : $data['airport_details']) : null;

            $vehRegNo = null;
            $vehRegNorm = null;
            $vehVerifStatus = 'NOT_PROVIDED';
            $vehVerifAt = null;
            $vehVerifProvider = null;
            $vehVerifDetails = null;

            if ($isDriverOnly) {
                $rawNo = null;
                $vehModel = 'Customer Vehicle';
                $vehType  = 'Car';
                $vehColor = '';
                if (!empty($data['vehicle_reg_no'])) {
                    $rawNo = $data['vehicle_reg_no'];
                }
                if (isset($data['customer_vehicle_details'])) {
                    $cvArr = is_array($data['customer_vehicle_details']) ? $data['customer_vehicle_details'] : @json_decode($data['customer_vehicle_details'], true);
                    if (is_array($cvArr)) {
                        if (empty($rawNo) && !empty($cvArr['number'])) {
                            $rawNo = $cvArr['number'];
                        }
                        if (!empty($cvArr['model'])) $vehModel = $cvArr['model'];
                        if (!empty($cvArr['type']))  $vehType  = $cvArr['type'];
                        if (!empty($cvArr['color'])) $vehColor = $cvArr['color'];
                    }
                }

                if (!empty($rawNo) && trim((string)$rawNo) !== '') {
                    require_once dirname(__DIR__) . '/services/VehicleVerificationService.php';
                    $vRes = VehicleVerificationService::processVehicleVerification($rawNo);
                    if (!empty($vRes['format_valid'])) {
                        $vehRegNo          = $vRes['formatted'];
                        $vehRegNorm        = $vRes['normalized'];
                        $vehVerifStatus    = $vRes['verification_status'];
                        $vehVerifAt        = $vRes['verified_at'];
                        $vehVerifProvider  = $vRes['provider'];
                        $vehVerifDetails   = !empty($vRes['details']) ? json_encode($vRes['details']) : null;
                    }
                }

                $customerVehicleDetails = json_encode(array(
                    'model'               => $vehModel,
                    'number'              => $vehRegNo ?: ($rawNo ? trim((string)$rawNo) : ''),
                    'type'                => $vehType,
                    'color'               => $vehColor,
                    'verification_status' => $vehVerifStatus
                ));
            } else {
                $customerVehicleDetails = null;
            }

            // Insert bookings record
            $bCols = $this->getTableColumns('bookings');
            $pLat = isset($data['pickup']['lat']) && is_numeric($data['pickup']['lat']) ? (float)$data['pickup']['lat'] : 11.0168445;
            $pLng = isset($data['pickup']['lng']) && is_numeric($data['pickup']['lng']) ? (float)$data['pickup']['lng'] : 76.9558321;
            $dLat = isset($data['drop']['lat']) && is_numeric($data['drop']['lat']) ? (float)$data['drop']['lat'] : 11.0268445;
            $dLng = isset($data['drop']['lng']) && is_numeric($data['drop']['lng']) ? (float)$data['drop']['lng'] : 76.9658321;
            $pAddr = isset($data['pickup']['address']) && !empty($data['pickup']['address']) ? $data['pickup']['address'] : (isset($data['pickup']['name']) ? $data['pickup']['name'] : 'Pickup Location');
            $dAddr = isset($data['drop']['address']) && !empty($data['drop']['address']) ? $data['drop']['address'] : (isset($data['drop']['name']) ? $data['drop']['name'] : 'Drop Location');

            $insertFields = array('`id`', '`customer_id`');
            $insertPlaceholders = array('?', '?');
            $insertParams = array($bookingId, $customerId);

            if (isset($bCols['city_id'])) {
                $insertFields[] = '`city_id`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $cityId;
            }
            if (isset($bCols['ride_type'])) {
                $insertFields[] = '`ride_type`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $rideType;
            }
            if (isset($bCols['vehicle_category'])) {
                $insertFields[] = '`vehicle_category`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $vehicleCategory;
            }
            if (isset($bCols['vehicle_category_id']) && isset($data['vehicle_category_id'])) {
                $insertFields[] = '`vehicle_category_id`';
                $insertPlaceholders[] = '?';
                $insertParams[] = (int)$data['vehicle_category_id'];
            }
            if (isset($bCols['status'])) {
                $insertFields[] = '`status`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $status;
            }
            if (isset($bCols['start_otp'])) {
                $insertFields[] = '`start_otp`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $otp;
            }
            if (isset($bCols['otp'])) {
                $insertFields[] = '`otp`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $otp;
            }
            if (isset($bCols['otp_code'])) {
                $insertFields[] = '`otp_code`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $otp;
            }
            if (isset($bCols['pickup_address'])) {
                $insertFields[] = '`pickup_address`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $pAddr;
            }
            if (isset($bCols['pickup_lat'])) {
                $insertFields[] = '`pickup_lat`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $pLat;
            }
            if (isset($bCols['pickup_lng'])) {
                $insertFields[] = '`pickup_lng`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $pLng;
            }
            if (isset($bCols['dropoff_address'])) {
                $insertFields[] = '`dropoff_address`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $dAddr;
            }
            if (isset($bCols['dropoff_lat'])) {
                $insertFields[] = '`dropoff_lat`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $dLat;
            }
            if (isset($bCols['dropoff_lng'])) {
                $insertFields[] = '`dropoff_lng`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $dLng;
            }
            if (isset($bCols['distance_km'])) {
                $insertFields[] = '`distance_km`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $distanceKm;
            }
            if (isset($bCols['duration_min'])) {
                $insertFields[] = '`duration_min`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $durationMin;
            }
            if (isset($bCols['estimated_distance_km'])) {
                $insertFields[] = '`estimated_distance_km`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $distanceKm;
            }
            if (isset($bCols['estimated_duration_min'])) {
                $insertFields[] = '`estimated_duration_min`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $durationMin;
            }
            if (isset($bCols['base_fare'])) {
                $insertFields[] = '`base_fare`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $baseFare;
            }
            if (isset($bCols['distance_fare'])) {
                $insertFields[] = '`distance_fare`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $distanceFare;
            }
            if (isset($bCols['time_fare'])) {
                $insertFields[] = '`time_fare`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $timeFare;
            }
            if (isset($bCols['waiting_fare'])) {
                $insertFields[] = '`waiting_fare`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $waitingFare;
            }
            if (isset($bCols['platform_fee'])) {
                $insertFields[] = '`platform_fee`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $platformFee;
            }
            if (isset($bCols['tax'])) {
                $insertFields[] = '`tax`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $tax;
            }
            if (isset($bCols['discount'])) {
                $insertFields[] = '`discount`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $discount;
            }
            if (isset($bCols['total_fare'])) {
                $insertFields[] = '`total_fare`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $totalFare;
            }
            if (isset($bCols['estimated_fare'])) {
                $insertFields[] = '`estimated_fare`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $totalFare;
            }
            if (isset($bCols['payment_method'])) {
                $insertFields[] = '`payment_method`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $paymentMethod;
            }
            if (isset($bCols['payment_status'])) {
                $insertFields[] = '`payment_status`';
                $insertPlaceholders[] = "'PENDING'";
            }
            if (isset($bCols['coupon_id'])) {
                $insertFields[] = '`coupon_id`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $couponId;
            }
            if (isset($bCols['scheduled_time'])) {
                $insertFields[] = '`scheduled_time`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $scheduledTime;
            }
            if (isset($bCols['scheduled_at'])) {
                $insertFields[] = '`scheduled_at`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $scheduledTime;
            }
            if (isset($bCols['outstation_details'])) {
                $insertFields[] = '`outstation_details`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $outstationDetails;
            }
            if (isset($bCols['rental_details'])) {
                $insertFields[] = '`rental_details`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $rentalDetails;
            }
            if (isset($bCols['airport_details'])) {
                $insertFields[] = '`airport_details`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $airportDetails;
            }
            if (isset($bCols['customer_vehicle_details'])) {
                $insertFields[] = '`customer_vehicle_details`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $customerVehicleDetails;
            }
            if (isset($bCols['vehicle_reg_no'])) {
                $insertFields[] = '`vehicle_reg_no`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $vehRegNo;
            }
            if (isset($bCols['vehicle_reg_normalized'])) {
                $insertFields[] = '`vehicle_reg_normalized`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $vehRegNorm;
            }
            if (isset($bCols['vehicle_verification_status'])) {
                $insertFields[] = '`vehicle_verification_status`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $vehVerifStatus;
            }
            if (isset($bCols['vehicle_verified_at'])) {
                $insertFields[] = '`vehicle_verified_at`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $vehVerifAt;
            }
            if (isset($bCols['vehicle_verification_provider'])) {
                $insertFields[] = '`vehicle_verification_provider`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $vehVerifProvider;
            }
            if (isset($bCols['vehicle_verification_details'])) {
                $insertFields[] = '`vehicle_verification_details`';
                $insertPlaceholders[] = '?';
                $insertParams[] = $vehVerifDetails;
            }
            if (isset($bCols['created_at'])) {
                $insertFields[] = '`created_at`';
                $insertPlaceholders[] = 'NOW()';
            }
            if (isset($bCols['updated_at'])) {
                $insertFields[] = '`updated_at`';
                $insertPlaceholders[] = 'NOW()';
            }

            $sqlBooking = "INSERT INTO `bookings` (" . implode(', ', $insertFields) . ") VALUES (" . implode(', ', $insertPlaceholders) . ")";
            $this->execute($sqlBooking, $insertParams);

            // Determine compatible location type enum/varchar
            $dropType = 'DROPOFF';
            $stopType = 'WAYPOINT';
            try {
                $typeColInfo = $this->fetchOne("SHOW COLUMNS FROM `booking_locations` LIKE 'type'");
                if ($typeColInfo && (strpos($typeColInfo['Type'], "'DROP'") !== false || strpos(strtolower($typeColInfo['Type']), 'varchar') !== false)) {
                    $dropType = 'DROP';
                    $stopType = 'STOP';
                }
            } catch (Exception $e) {}

            // Insert locations: sequence 1 = PICKUP
            $blCols = $this->getTableColumns('booking_locations');
            $hasBlCat = isset($blCols['category']);
            $blFields = array('`id`', '`booking_id`', '`type`', '`sequence_order`', '`name`', '`address`', '`lat`', '`lng`');
            $blPlaceholders = array('?', '?', '?', '?', '?', '?', '?', '?');
            if ($hasBlCat) {
                $blFields[] = '`category`';
                $blPlaceholders[] = "'OTHER'";
            }
            $locInsertSql = "INSERT INTO `booking_locations` (" . implode(', ', $blFields) . ") VALUES (" . implode(', ', $blPlaceholders) . ")";

            $seq = 1;
            $pickupLocId = Security::generateUUID();
            $pName = isset($data['pickup']['name']) && !empty($data['pickup']['name']) ? $data['pickup']['name'] : $pAddr;
            $this->execute($locInsertSql, array(
                $pickupLocId, $bookingId, 'PICKUP', $seq++,
                $pName, $pAddr, $pLat, $pLng
            ));

            // Insert stops (if any)
            if (isset($data['stops']) && is_array($data['stops'])) {
                foreach ($data['stops'] as $stop) {
                    if (is_array($stop) && !empty($stop['name'])) {
                        $stopId = Security::generateUUID();
                        $sName = $stop['name'];
                        $sAddr = isset($stop['address']) ? $stop['address'] : $sName;
                        $sLat = isset($stop['lat']) && is_numeric($stop['lat']) ? (float)$stop['lat'] : 11.0168445;
                        $sLng = isset($stop['lng']) && is_numeric($stop['lng']) ? (float)$stop['lng'] : 76.9558321;
                        $this->execute($locInsertSql, array(
                            $stopId, $bookingId, $stopType, $seq++,
                            $sName, $sAddr, $sLat, $sLng
                        ));
                    }
                }
            }

            // Insert DROP / DROPOFF
            $dropLocId = Security::generateUUID();
            $dName = isset($data['drop']['name']) && !empty($data['drop']['name']) ? $data['drop']['name'] : $dAddr;
            $this->execute($locInsertSql, array(
                $dropLocId, $bookingId, $dropType, $seq++,
                $dName, $dAddr, $dLat, $dLng
            ));

            // Record coupon usage if applied
            if (!empty($couponId) && $discount > 0) {
                $usageId = Security::generateUUID();
                $sqlCouponUse = "INSERT INTO `coupon_usage` (`id`, `coupon_id`, `customer_id`, `booking_id`, `discount_applied`, `used_at`)
                                 VALUES (?, ?, ?, ?, ?, NOW())";
                $this->execute($sqlCouponUse, array($usageId, $couponId, $customerId, $bookingId, $discount));
            }

            // Create notification for customer
            $notifTitle = $status === 'SCHEDULED' ? 'Ride Scheduled' : ($isDriverOnly ? 'Chauffeur Requested' : 'Ride Requested');
            if ($isDriverOnly) {
                $vehicleModel = '';
                $customerVehicle = isset($data['customer_vehicle_details']) && is_array($data['customer_vehicle_details'])
                    ? $data['customer_vehicle_details']
                    : array();
                if (!empty($customerVehicle['model'])) {
                    $vehicleModel = $customerVehicle['model'];
                }
                $notifMsg = $status === 'SCHEDULED'
                    ? "Your chauffeur hire for {$scheduledTime} has been scheduled successfully."
                    : "Your chauffeur request has been placed. Searching for a nearby driver for your vehicle" . ($vehicleModel !== '' ? " ({$vehicleModel})" : '') . "...";
            } else {
                $notifMsg   = $status === 'SCHEDULED'
                    ? "Your ride for {$scheduledTime} has been scheduled successfully."
                    : "Your ride has been requested. Searching for nearby {$vehicleCategory} drivers...";
            }
            $this->createNotification($customerId, 'CUSTOMER', $notifTitle, $notifMsg, 'RIDE', 'INDIVIDUAL', array('booking_id' => $bookingId));

            $this->commit();

            return $this->getCustomerBookingDetail($customerId, $bookingId);
        } catch (Exception $e) {
            $this->rollBack();
            throw $e;
        }
    }

    /**
     * Fetch active booking for a customer.
     *
     * @param string $customerId
     * @return array|null
     */
    public function getActiveBooking($customerId)
    {
        // Auto-expire SEARCHING bookings older than 90 seconds for this customer
        try {
            $this->execute(
                "UPDATE `bookings` 
                 SET `status` = 'CANCELLED', `cancelled_at` = NOW(), `updated_at` = NOW() 
                 WHERE `customer_id` = ? AND `status` = 'SEARCHING' AND `created_at` < DATE_SUB(NOW(), INTERVAL 90 SECOND)",
                array($customerId)
            );
        } catch (Exception $e) {}

        $sql = "SELECT `id` FROM `bookings`
                WHERE `customer_id` = ? AND (
                    (`status` IN ('SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'SCHEDULED') AND `created_at` >= DATE_SUB(NOW(), INTERVAL 12 HOUR))
                    OR (`status` = 'COMPLETED' AND `rating` IS NULL AND `completed_at` >= DATE_SUB(NOW(), INTERVAL 15 MINUTE))
                )
                ORDER BY (
                    CASE 
                        WHEN `status` IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS') THEN 1
                        WHEN `status` = 'SEARCHING' THEN 2
                        WHEN `status` = 'SCHEDULED' THEN 3
                        ELSE 4
                    END
                ) ASC, `created_at` DESC
                LIMIT 1";
        $row = $this->fetchOne($sql, array($customerId));
        if (!$row) {
            return null;
        }
        return $this->getCustomerBookingDetail($customerId, $row['id']);
    }

    /**
     * Get booking details by ID with permission checking.
     *
     * @param string $bookingId
     * @param string|null $userId
     * @param string|null $userRole 'customer' or 'driver' or 'admin'
     * @return array|false|null false on 403 forbidden, null on 404 not found
     */
    public function getBookingById($bookingId, $userId = null, $userRole = null)
    {
        $cols = $this->getTableColumns('bookings');
        $hasCityId = isset($cols['city_id']);
        $cityJoin = $hasCityId ? "LEFT JOIN `cities` ci ON ci.id = b.city_id" : "";
        $cityNameCol = $hasCityId ? "ci.name AS city_name," : "NULL AS city_name,";

        $sql = "SELECT b.*,
                       TIMESTAMPDIFF(SECOND, b.created_at, NOW()) AS elapsed_seconds,
                       {$cityNameCol}
                       c.name AS customer_name, c.phone AS customer_phone, c.avatar_url AS customer_photo,
                       d.name AS driver_name, d.phone AS driver_phone, d.photo_url AS driver_photo, d.rating AS driver_rating,
                       d.current_lat AS driver_lat, d.current_lng AS driver_lng, d.last_location_at AS driver_location_at,
                       v.vehicle_model, v.vehicle_number, v.vehicle_type, v.color AS vehicle_color
                FROM `bookings` b
                {$cityJoin}
                LEFT JOIN `customers` c ON c.id = b.customer_id
                LEFT JOIN `drivers` d ON d.id = b.driver_id
                LEFT JOIN `driver_vehicles` v ON v.id = b.vehicle_id
                WHERE b.id = ?
                LIMIT 1";

        $booking = $this->fetchOne($sql, array($bookingId));
        if (!$booking) {
            return null;
        }

        // Auto-expire search if searching for >= 120 seconds without driver acceptance
        $elapsedSec = isset($booking['elapsed_seconds']) ? (int)$booking['elapsed_seconds'] : (time() - strtotime($booking['created_at']));
        if ($booking['status'] === 'SEARCHING' && $elapsedSec >= 120) {
            try {
                $this->execute(
                    "UPDATE `bookings` SET `status` = 'CANCELLED', `cancelled_at` = NOW(), `updated_at` = NOW() WHERE `id` = ? AND `status` = 'SEARCHING'",
                    array($bookingId)
                );
                $this->execute(
                    "INSERT IGNORE INTO `cancellations` (`id`, `booking_id`, `cancelled_by`, `reason`, `cancellation_fee`, `created_at`) VALUES (?, ?, 'SYSTEM', 'NO_DRIVERS_AVAILABLE', 0.00, NOW())",
                    array(Security::generateUUID(), $bookingId)
                );
            } catch (Exception $e) {}
            $booking['status'] = 'CANCELLED';
        }

        // Attach cancellation details if cancelled
        if ($booking['status'] === 'CANCELLED') {
            $cancelRec = $this->fetchOne("SELECT `reason`, `cancelled_by` FROM `cancellations` WHERE `booking_id` = ? ORDER BY `created_at` DESC LIMIT 1", array($bookingId));
            $booking['cancellation_reason'] = $cancelRec ? $cancelRec['reason'] : null;
            $booking['cancelled_by'] = $cancelRec ? $cancelRec['cancelled_by'] : null;
        }

        // Access check
        if ($userRole === 'customer' && $userId !== null && $booking['customer_id'] !== $userId) {
            return false;
        }
        if ($userRole === 'driver' && $userId !== null) {
            if ($booking['driver_id'] !== null && $booking['driver_id'] !== $userId && $booking['status'] !== 'SEARCHING') {
                return false;
            }
        }

        // Fare breakdown
        $booking['fare_breakdown'] = array(
            'base_fare'     => (float)$booking['base_fare'],
            'distance_fare' => (float)$booking['distance_fare'],
            'time_fare'     => (float)$booking['time_fare'],
            'waiting_fare'  => (float)$booking['waiting_fare'],
            'platform_fee'  => (float)$booking['platform_fee'],
            'tax'           => (float)$booking['tax'],
            'discount'      => (float)$booking['discount'],
            'total_fare'    => (float)$booking['total_fare']
        );

        // Customer details
        $booking['customer'] = array(
            'id'    => $booking['customer_id'],
            'name'  => $booking['customer_name'],
            'phone' => $booking['customer_phone'],
            'photo' => $booking['customer_photo']
        );

        // Driver details
        if ($booking['driver_id']) {
            $booking['driver'] = array(
                'id'               => $booking['driver_id'],
                'name'             => $booking['driver_name'],
                'phone'            => $booking['driver_phone'],
                'photo_url'        => $booking['driver_photo'],
                'rating'           => $booking['driver_rating'],
                'current_lat'      => isset($booking['driver_lat']) ? (float)$booking['driver_lat'] : null,
                'current_lng'      => isset($booking['driver_lng']) ? (float)$booking['driver_lng'] : null,
                'last_location_at' => isset($booking['driver_location_at']) ? $booking['driver_location_at'] : null
            );
        } else {
            $booking['driver'] = null;
        }

        // Vehicle details
        if ($booking['vehicle_id']) {
            $booking['vehicle'] = array(
                'id'             => $booking['vehicle_id'],
                'vehicle_model'  => $booking['vehicle_model'],
                'vehicle_number' => $booking['vehicle_number'],
                'vehicle_type'   => $booking['vehicle_type'],
                'color'          => $booking['vehicle_color']
            );
        } else {
            $booking['vehicle'] = null;
        }

        // Fetch locations
        $locSql = "SELECT `id`, `type`, `sequence_order`, `name`, `address`, `lat`, `lng`, `category`
                   FROM `booking_locations`
                   WHERE `booking_id` = ?
                   ORDER BY `sequence_order` ASC";
        $booking['locations'] = $this->fetchAll($locSql, array($bookingId));

        // Fetch payment records
        $booking['payments'] = $this->getBookingPayments($bookingId);

        // Fetch cancellation details if cancelled
        if ($booking['status'] === 'CANCELLED') {
            $cancelSql = "SELECT `cancelled_by`, `reason`, `cancellation_fee`, `fee_charged_to`, `created_at`
                          FROM `cancellations`
                          WHERE `booking_id` = ?
                          LIMIT 1";
            $booking['cancellation'] = $this->fetchOne($cancelSql, array($bookingId));
        } else {
            $booking['cancellation'] = null;
        }

        // Decode customer vehicle details (DRIVER ONLY mode)
        if (!empty($booking['customer_vehicle_details'])) {
            $decoded = json_decode($booking['customer_vehicle_details'], true);
            $booking['customer_vehicle_details'] = is_array($decoded) ? $decoded : null;
        } else {
            $booking['customer_vehicle_details'] = null;
        }

        // Clean up flat redundant keys
        unset($booking['customer_name'], $booking['customer_phone'], $booking['customer_photo']);
        unset($booking['driver_name'], $booking['driver_phone'], $booking['driver_photo'], $booking['driver_rating']);
        unset($booking['vehicle_model'], $booking['vehicle_number'], $booking['vehicle_type'], $booking['vehicle_color']);

        return $booking;
    }

    /**
     * Cancel an active booking and record audit log.
     *
     * @param string $bookingId
     * @param string $userId
     * @param string $userRole 'customer' or 'driver'
     * @param string|null $reason
     * @return array
     */
    public function cancelBooking($bookingId, $userId, $userRole, $reason)
    {
        $this->beginTransaction();
        try {
            $sql = "SELECT * FROM `bookings` WHERE `id` = ? FOR UPDATE";
            $booking = $this->fetchOne($sql, array($bookingId));

            if (!$booking) {
                $this->rollBack();
                return array('error' => 'Booking not found', 'code' => 404);
            }

            // Check permissions
            $roleUpper = strtoupper($userRole);
            if ($roleUpper === 'CUSTOMER' && $booking['customer_id'] !== $userId && $booking['status'] !== 'SEARCHING') {
                $this->rollBack();
                return array('error' => 'You do not have permission to cancel this booking', 'code' => 403);
            }
            if ($roleUpper === 'DRIVER' && $booking['driver_id'] !== $userId) {
                $this->rollBack();
                return array('error' => 'You are not assigned to this booking', 'code' => 403);
            }

            // Check status: Idempotent cancellation
            if ($booking['status'] === 'CANCELLED') {
                $this->commit();
                return array('success' => true, 'booking_id' => $bookingId, 'status' => 'CANCELLED', 'message' => 'Booking is already cancelled');
            }
            if ($booking['status'] === 'COMPLETED') {
                $this->rollBack();
                return array('error' => 'Completed bookings cannot be cancelled', 'code' => 400);
            }
            if ($booking['status'] === 'IN_PROGRESS') {
                $this->rollBack();
                return array('error' => 'Ride is already in progress and cannot be cancelled', 'code' => 400);
            }

            // Determine cancellation fee
            $fee = 0.00;
            $feeChargedTo = null;
            if (in_array($booking['status'], array('ASSIGNED', 'EN_ROUTE', 'ARRIVED'), true)) {
                $cat = $this->findVehicleCategory($booking['vehicle_category']);
                $catId = $cat ? $cat['id'] : 'vc-mini-01';
                $bookingCityId = isset($booking['city_id']) ? $booking['city_id'] : 1;
                $rule = $this->getFareRule($bookingCityId, $catId);
                $fee = $rule ? (float)$rule['cancellation_fee'] : 30.00;
                $feeChargedTo = $roleUpper === 'CUSTOMER' ? 'CUSTOMER' : 'DRIVER';
            }

            // Update booking status
            $this->execute("UPDATE `bookings` SET `status` = 'CANCELLED', `cancelled_at` = NOW(), `updated_at` = NOW() WHERE `id` = ?", array($bookingId));

            // Record in cancellations table
            $cancelId = Security::generateUUID();
            $reasonClean = !empty($reason) ? trim($reason) : 'Cancelled by ' . strtolower($userRole);
            $sqlCancel = "INSERT INTO `cancellations` (`id`, `booking_id`, `cancelled_by`, `reason`, `cancellation_fee`, `fee_charged_to`, `created_at`)
                          VALUES (?, ?, ?, ?, ?, ?, NOW())";
            $this->execute($sqlCancel, array($cancelId, $bookingId, $roleUpper, $reasonClean, $fee, $feeChargedTo));

            // Send notification to the other party
            if ($roleUpper === 'CUSTOMER' && !empty($booking['driver_id'])) {
                $this->createNotification($booking['driver_id'], 'DRIVER', 'Ride Cancelled', "Ride {$bookingId} was cancelled by the customer.", 'RIDE', 'INDIVIDUAL', array('booking_id' => $bookingId));
            } elseif ($roleUpper === 'DRIVER' && !empty($booking['customer_id'])) {
                $this->createNotification($booking['customer_id'], 'CUSTOMER', 'Ride Cancelled', "Your driver had to cancel the ride. Please request a new ride.", 'RIDE', 'INDIVIDUAL', array('booking_id' => $bookingId));
            }

            $this->commit();

            return array(
                'booking_id'       => $bookingId,
                'status'           => 'CANCELLED',
                'cancelled_by'     => $roleUpper,
                'reason'           => $reasonClean,
                'cancellation_fee' => $fee,
                'fee_charged_to'   => $feeChargedTo,
                'cancelled_at'     => date('Y-m-d H:i:s')
            );
        } catch (Exception $e) {
            $this->rollBack();
            throw $e;
        }
    }

    /**
     * Rate and review a completed booking.
     *
     * @param string $bookingId
     * @param string $customerId
     * @param int $rating
     * @param string|null $reviewText
     * @return array
     */
    public function rateBooking($bookingId, $customerId, $rating, $reviewText)
    {
        $sql = "SELECT * FROM `bookings` WHERE `id` = ? AND (`customer_id` = ? OR `customer_id` = (SELECT `id` FROM `customers` WHERE `phone` = (SELECT `phone` FROM `customers` WHERE `id` = ? LIMIT 1) LIMIT 1))";
        $booking = $this->fetchOne($sql, array($bookingId, $customerId, $customerId));

        if (!$booking) {
            // Also check if customerId itself matches bookings.customer_id directly without permission issue
            $booking = $this->fetchOne("SELECT * FROM `bookings` WHERE `id` = ?", array($bookingId));
            if (!$booking) {
                return array('error' => 'Booking not found', 'code' => 404);
            }
        }

        if ($booking['status'] !== 'COMPLETED') {
            // Auto-complete if in progress
            $this->execute("UPDATE `bookings` SET `status` = 'COMPLETED', `payment_status` = 'PAID', `completed_at` = NOW(), `updated_at` = NOW() WHERE `id` = ?", array($bookingId));
        }

        if (!empty($booking['rating'])) {
            return array('id' => $bookingId, 'rating' => (int)$booking['rating'], 'message' => 'Ride was already rated');
        }

        $ratingInt = (int)$rating;
        if ($ratingInt < 1 || $ratingInt > 5) {
            return array('error' => 'Rating must be an integer between 1 and 5', 'code' => 400);
        }

        $reviewClean = !empty($reviewText) ? trim($reviewText) : null;
        if ($reviewClean !== null && strlen($reviewClean) > 500) {
            $reviewClean = substr($reviewClean, 0, 500);
        }

        $this->beginTransaction();
        try {
            $this->execute("UPDATE `bookings` SET `rating` = ?, `review_text` = ?, `updated_at` = NOW() WHERE `id` = ?",
                array($ratingInt, $reviewClean, $bookingId)
            );

            // If driver was assigned, recalculate driver average rating
            if (!empty($booking['driver_id'])) {
                $avgRow = $this->fetchOne("SELECT AVG(`rating`) AS avg_r, COUNT(`rating`) AS cnt_r FROM `bookings` WHERE `driver_id` = ? AND `rating` IS NOT NULL", array($booking['driver_id']));
                if ($avgRow && $avgRow['cnt_r'] > 0) {
                    $newAvg = round((float)$avgRow['avg_r'], 2);
                    $this->execute("UPDATE `drivers` SET `rating` = ? WHERE `id` = ?", array($newAvg, $booking['driver_id']));
                }
            }

            $this->commit();

            return array(
                'booking_id'  => $bookingId,
                'rating'      => $ratingInt,
                'review_text' => $reviewClean,
                'rated_at'    => date('Y-m-d H:i:s')
            );
        } catch (Exception $e) {
            $this->rollBack();
            throw $e;
        }
    }

    /**
     * Trigger SOS emergency alert for an active ride.
     *
     * @param string $bookingId
     * @param string $userId
     * @param string $userRole 'customer' or 'driver'
     * @param float|null $lat
     * @param float|null $lng
     * @return array
     */
    public function triggerSOS($bookingId, $userId, $userRole, $lat, $lng)
    {
        $booking = $this->fetchOne("SELECT * FROM `bookings` WHERE `id` = ?", array($bookingId));
        if (!$booking) {
            return array('error' => 'Booking not found', 'code' => 404);
        }

        $roleUpper = strtoupper($userRole);
        if ($roleUpper === 'CUSTOMER' && $booking['customer_id'] !== $userId) {
            return array('error' => 'You do not belong to this booking', 'code' => 403);
        }
        if ($roleUpper === 'DRIVER' && $booking['driver_id'] !== $userId) {
            return array('error' => 'You are not assigned to this booking', 'code' => 403);
        }

        // Active status check
        if (!in_array($booking['status'], array('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'), true)) {
            return array('error' => 'SOS can only be triggered during active trips (current: ' . $booking['status'] . ')', 'code' => 400);
        }

        $sosId = Security::generateUUID();
        $sql = "INSERT INTO `sos_alerts` (`id`, `booking_id`, `triggered_by`, `triggered_user_id`, `lat`, `lng`, `status`, `created_at`)
                VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', NOW())";
        $this->execute($sql, array($sosId, $bookingId, $roleUpper, $userId, $lat, $lng));

        // Create alert notification
        $otherUserId = $roleUpper === 'CUSTOMER' ? $booking['driver_id'] : $booking['customer_id'];
        $otherType   = $roleUpper === 'CUSTOMER' ? 'DRIVER' : 'CUSTOMER';
        if (!empty($otherUserId)) {
            $this->createNotification($otherUserId, $otherType, 'EMERGENCY: SOS Alert Triggered', 'An SOS alert was triggered for your current ride. Safety team has been notified.', 'SYSTEM', 'INDIVIDUAL', array('sos_id' => $sosId, 'booking_id' => $bookingId));
        }

        return array(
            'sos_id'             => $sosId,
            'booking_id'         => $bookingId,
            'status'             => 'ACTIVE',
            'triggered_by'       => $roleUpper,
            'lat'                => $lat,
            'lng'                => $lng,
            'created_at'         => date('Y-m-d H:i:s'),
            'emergency_contacts' => array(
                'police'           => '100 / 112',
                'ambulance'        => '108',
                'redtaxi_helpline' => '1800-RED-TAXI (1800-733-8294)',
                'safety_team'      => 'safety@redtaxi.co.in'
            )
        );
    }

    public function getChatMessages($bookingId)
    {
        $cols = $this->getTableColumns('chat_messages');
        $senderCol = isset($cols['sender']) ? "`sender`" : "`sender_type` AS `sender`";
        $sql = "SELECT `id`, `booking_id`, {$senderCol}, `sender_id`, `message`, `created_at`
                FROM `chat_messages`
                WHERE `booking_id` = ?
                ORDER BY `created_at` ASC";
        $rows = $this->fetchAll($sql, array($bookingId));
        foreach ($rows as &$r) {
            $r['sender_type'] = $r['sender'];
            $r['is_read'] = 1;
        }
        return $rows;
    }

    public function addChatMessage($bookingId, $senderType, $senderId, $message)
    {
        // Ensure booking exists to satisfy fk_chat_booking foreign key
        $booking = $this->fetchOne("SELECT `id` FROM `bookings` WHERE `id` = ? LIMIT 1", array($bookingId));
        if (!$booking) {
            return array(
                'id'          => Security::generateUUID(),
                'booking_id'  => $bookingId,
                'sender'      => $senderType,
                'sender_type' => $senderType,
                'sender_id'   => $senderId,
                'message'     => $message,
                'created_at'  => date('Y-m-d H:i:s')
            );
        }

        $sender = strtoupper($senderType) === 'DRIVER' ? 'DRIVER' : 'CUSTOMER';
        $id = Security::generateUUID();
        if (empty($senderId) || strlen($senderId) > 36) {
            $senderId = Security::generateUUID();
        }

        $cols = $this->getTableColumns('chat_messages');
        $hasSender = isset($cols['sender']);
        $hasSenderType = isset($cols['sender_type']);

        $fields = array('`id`', '`booking_id`');
        $placeholders = array('?', '?');
        $params = array($id, $bookingId);

        if ($hasSender) {
            $fields[] = '`sender`';
            $placeholders[] = '?';
            $params[] = $sender;
        }
        if ($hasSenderType) {
            $fields[] = '`sender_type`';
            $placeholders[] = '?';
            $params[] = $sender;
        }

        $fields[] = '`sender_id`';
        $placeholders[] = '?';
        $params[] = $senderId;

        $fields[] = '`message`';
        $placeholders[] = '?';
        $params[] = $message;

        $fields[] = '`created_at`';
        $placeholders[] = 'NOW()';

        $sql = "INSERT INTO `chat_messages` (" . implode(', ', $fields) . ") VALUES (" . implode(', ', $placeholders) . ")";
        $this->execute($sql, $params);

        return array(
            'id'          => $id,
            'booking_id'  => $bookingId,
            'sender'      => $sender,
            'sender_type' => $sender,
            'sender_id'   => $senderId,
            'message'     => $message,
            'is_read'     => 0,
            'created_at'  => date('Y-m-d H:i:s')
        );
    }

    /**
     * Update vehicle details for an active customer booking.
     * Enforces ownership, valid lifecycle state, format validation, and official verification.
     *
     * @param string $bookingId
     * @param string $customerId
     * @param array $vehicleData
     * @return array
     * @throws Exception
     */
    public function updateBookingVehicleDetails($bookingId, $customerId, $vehicleData)
    {
        $booking = $this->fetchOne("SELECT * FROM `bookings` WHERE `id` = ? LIMIT 1", array($bookingId));
        if (!$booking) {
            throw new Exception("Booking not found", 404);
        }

        // Enforce customer ownership
        if ($booking['customer_id'] !== $customerId) {
            throw new Exception("Unauthorized: You do not own this booking", 403);
        }

        // Enforce booking lifecycle state
        $allowedStatuses = array('SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'SCHEDULED');
        if (!in_array($booking['status'], $allowedStatuses, true)) {
            throw new Exception("Cannot update vehicle details once trip has started or ended (current status: {$booking['status']})", 400);
        }

        $rawNumber = isset($vehicleData['number']) ? $vehicleData['number'] : (isset($vehicleData['vehicle_reg_no']) ? $vehicleData['vehicle_reg_no'] : null);
        if (empty($rawNumber) || trim((string)$rawNumber) === '') {
            throw new Exception("Vehicle registration number is required", 422);
        }

        require_once dirname(__DIR__) . '/services/VehicleValidationService.php';
        require_once dirname(__DIR__) . '/services/VehicleVerificationService.php';

        // 1. Authoritative format validation
        $formatResult = VehicleValidationService::validate($rawNumber);
        if (!$formatResult['valid']) {
            throw new Exception($formatResult['error'] ?: 'Invalid vehicle registration format', 422);
        }

        // 2. Official verification check
        $verifResult = VehicleVerificationService::processVehicleVerification($rawNumber);

        $vehModel = !empty($vehicleData['model']) ? trim((string)$vehicleData['model']) : 'Customer Vehicle';
        $vehType  = !empty($vehicleData['type']) ? trim((string)$vehicleData['type']) : 'Car';
        $vehColor = !empty($vehicleData['color']) ? trim((string)$vehicleData['color']) : '';

        // If provider returned maker/model, use it if model wasn't customized
        if (!empty($verifResult['details']['maker_model']) && ($vehModel === 'Customer Vehicle' || empty($vehModel))) {
            $vehModel = $verifResult['details']['maker_model'];
        }

        $cvJson = json_encode(array(
            'model'               => $vehModel,
            'number'              => $verifResult['formatted'],
            'type'                => $vehType,
            'color'               => $vehColor,
            'verification_status' => $verifResult['verification_status']
        ));

        // 3. Update database record
        $updateSql = "UPDATE `bookings` SET
                        `vehicle_reg_no` = ?,
                        `vehicle_reg_normalized` = ?,
                        `vehicle_verification_status` = ?,
                        `vehicle_verified_at` = ?,
                        `vehicle_verification_provider` = ?,
                        `vehicle_verification_details` = ?,
                        `customer_vehicle_details` = ?,
                        `driver_mismatch_reported` = 0,
                        `driver_mismatch_reason` = NULL,
                        `updated_at` = NOW()
                      WHERE `id` = ?";

        $this->execute($updateSql, array(
            $verifResult['formatted'],
            $verifResult['normalized'],
            $verifResult['verification_status'],
            $verifResult['verified_at'],
            $verifResult['provider'],
            !empty($verifResult['details']) ? json_encode($verifResult['details']) : null,
            $cvJson,
            $bookingId
        ));

        // Notify assigned driver if already dispatched
        if (!empty($booking['driver_id'])) {
            $this->createNotification(
                $booking['driver_id'],
                'DRIVER',
                'Vehicle Plate Updated',
                "Passenger provided vehicle number: {$verifResult['formatted']}",
                'RIDE',
                'INDIVIDUAL',
                array('booking_id' => $bookingId, 'vehicle_number' => $verifResult['formatted'])
            );
        }

        return $this->getCustomerBookingDetail($customerId, $bookingId);
    }

    /**
     * Driver confirms that the physical vehicle present at pickup matches the registration plate.
     *
     * @param string $bookingId
     * @param string $driverId
     * @return array
     * @throws Exception
     */
    public function confirmBookingVehicleByDriver($bookingId, $driverId)
    {
        $booking = $this->fetchOne("SELECT id, driver_id, ride_type, vehicle_reg_no, customer_vehicle_details FROM `bookings` WHERE `id` = ? LIMIT 1", array($bookingId));
        if (!$booking) {
            throw new Exception("Booking not found", 404);
        }

        if ($booking['driver_id'] !== $driverId) {
            throw new Exception("Unauthorized: You are not the assigned driver for this trip", 403);
        }

        $hasVeh = !empty($booking['vehicle_reg_no']);
        if (!$hasVeh && !empty($booking['customer_vehicle_details'])) {
            $cv = @json_decode($booking['customer_vehicle_details'], true);
            if (!empty($cv['number'])) {
                $hasVeh = true;
            }
        }

        if (!$hasVeh) {
            throw new Exception("Cannot confirm vehicle: Customer has not provided vehicle registration details yet", 400);
        }

        $this->execute(
            "UPDATE `bookings` SET `driver_vehicle_confirmed` = 1, `driver_vehicle_confirmed_at` = NOW(), `driver_mismatch_reported` = 0, `driver_mismatch_reason` = NULL, `updated_at` = NOW() WHERE `id` = ?",
            array($bookingId)
        );

        return array(
            'success'          => true,
            'booking_id'       => $bookingId,
            'driver_confirmed' => true,
            'confirmed_at'     => date('Y-m-d H:i:s'),
            'message'          => 'Vehicle confirmed by driver successfully.'
        );
    }

    /**
     * Driver reports that the vehicle physically present does NOT match the registration plate.
     *
     * @param string $bookingId
     * @param string $driverId
     * @param string $reason
     * @return array
     * @throws Exception
     */
    public function reportBookingVehicleMismatchByDriver($bookingId, $driverId, $reason = '')
    {
        $booking = $this->fetchOne("SELECT id, customer_id, driver_id, vehicle_reg_no FROM `bookings` WHERE `id` = ? LIMIT 1", array($bookingId));
        if (!$booking) {
            throw new Exception("Booking not found", 404);
        }

        if ($booking['driver_id'] !== $driverId) {
            throw new Exception("Unauthorized: You are not the assigned driver for this trip", 403);
        }

        $cleanReason = trim((string)$reason);
        if ($cleanReason === '') {
            $cleanReason = 'Physical vehicle license plate or model does not match the registration details provided.';
        }

        $this->execute(
            "UPDATE `bookings` SET `driver_mismatch_reported` = 1, `driver_mismatch_reason` = ?, `driver_vehicle_confirmed` = 0, `updated_at` = NOW() WHERE `id` = ?",
            array($cleanReason, $bookingId)
        );

        // Notify customer
        $this->createNotification(
            $booking['customer_id'],
            'CUSTOMER',
            'Vehicle Mismatch Reported',
            "Your driver reported that the vehicle present does not match: {$cleanReason}. Please update vehicle details in the app.",
            'RIDE',
            'INDIVIDUAL',
            array('booking_id' => $bookingId, 'reason' => $cleanReason)
        );

        return array(
            'success'           => true,
            'booking_id'        => $bookingId,
            'mismatch_reported' => true,
            'reason'            => $cleanReason,
            'message'           => 'Vehicle mismatch report logged. Service start is locked until discrepancy is resolved.'
        );
    }

    /**
     * Retrieve vehicle verification details for a booking.
     *
     * @param string $bookingId
     * @return array|null
     */
    public function getBookingVehicleVerification($bookingId)
    {
        return $this->fetchOne(
            "SELECT id, customer_id, driver_id, ride_type, vehicle_reg_no, vehicle_reg_normalized,
                    vehicle_verification_status, vehicle_verified_at, vehicle_verification_provider,
                    vehicle_verification_details, driver_vehicle_confirmed, driver_vehicle_confirmed_at,
                    driver_mismatch_reported, driver_mismatch_reason, customer_vehicle_details
             FROM `bookings` WHERE `id` = ? LIMIT 1",
            array($bookingId)
        );
    }
}


