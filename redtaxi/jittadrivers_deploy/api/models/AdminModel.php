<?php
/**
 * RedTaxi Backend - Admin Model
 * Manages admin operations, queries, mutations and data persistence.
 * Compatible with PHP 5.6+.
 */

require_once __DIR__ . '/BaseModel.php';
require_once dirname(__DIR__) . '/utils/Security.php';

class AdminModel extends BaseModel
{
    /**
     * Find admin user by email
     *
     * @param string $email
     * @return array|null
     */
    public function findByEmail($email)
    {
        $clean = strtolower(trim($email));
        $asJitta = str_replace('@redtaxi.in', '@jittadrives.com', $clean);
        $asRed = str_replace('@jittadrives.com', '@redtaxi.in', $clean);
        $sql = "SELECT id, name, email, password_hash, phone, role, city_id, is_active, last_login_at, created_at FROM admin_users WHERE email = ? OR email = ? OR email = ? ORDER BY (email LIKE '%jittadrives%') DESC LIMIT 1";
        return $this->fetchOne($sql, array($clean, $asJitta, $asRed));
    }

    /**
     * Find admin user by ID
     *
     * @param string $id
     * @return array|null
     */
    public function findById($id)
    {
        $sql = "SELECT id, name, email, phone, role, city_id, is_active, last_login_at, created_at FROM admin_users WHERE id = ? LIMIT 1";
        return $this->fetchOne($sql, array($id));
    }

    /**
     * Update admin last login timestamp
     *
     * @param string $id
     * @return int
     */
    public function updateLastLogin($id)
    {
        $sql = "UPDATE admin_users SET last_login_at = NOW() WHERE id = ?";
        return $this->execute($sql, array($id));
    }

    /**
     * Detect which database schema is active:
     *   - 'local'      : dev schema (bookings.total_fare, booking_locations.name ...)
     *   - 'production' : host dump schema (bookings.final_fare + direct coordinates, no booking_locations.name)
     *
     * @return string
     */
    private $schemaVersion = null;

    private function schema()
    {
        if ($this->schemaVersion === null) {
            $row = $this->fetchOne(
                "SELECT COUNT(*) AS c FROM information_schema.columns
                 WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'total_fare'"
            );
            $this->schemaVersion = ($row && (int)$row['c'] > 0) ? 'local' : 'production';
        }
        return $this->schemaVersion;
    }

    private function isLocalSchema()
    {
        return $this->schema() === 'local';
    }

    /**
     * Detect the promotions/coupons schema.
     * The live host DB is a merged schema: payments holds local columns (type/paid_at) but the
     * coupons/offers tables follow the production layout (discount_value, min_order_amount, valid_until,
     * priority, starts_at, ends_at). So the discounts/promos must be judged on their own columns.
     *
     * @return bool  true when coupons/offers use the production schema
     */
    private function promoUsesProductionSchema()
    {
        static $promoSchemaVersion = null;
        if ($promoSchemaVersion === null) {
            $row = $this->fetchOne(
                "SELECT COUNT(*) AS c FROM information_schema.columns
                 WHERE table_schema = DATABASE() AND table_name = 'coupons' AND column_name = 'discount_value'"
            );
            $promoSchemaVersion = ($row && (int)$row['c'] > 0) ? 'production' : 'local';
        }
        return $promoSchemaVersion === 'production';
    }

    /**
     * Aggregated Dashboard Statistics
     *
     * @return array
     */
    public function getDashboardStats()
    {
        // Payment success status differs per schema (payments ledger is the source of truth for revenue)
        $paidStatus = $this->isLocalSchema() ? 'SUCCESS' : 'COMPLETED';

        // 1. Booking KPIs
        $bookingStatsSql = "SELECT 
            COUNT(*) as total_bookings,
            SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_bookings,
            SUM(CASE WHEN status IN ('SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS') THEN 1 ELSE 0 END) as active_bookings,
            SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_bookings,
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_bookings
        FROM bookings";
        $bookingStats = $this->fetchOne($bookingStatsSql);

        // 2. Revenue KPIs from the payments ledger (actual stored amounts, successfully paid only)
        $revenueStatsSql = "SELECT 
            COALESCE(SUM(CASE WHEN status = '{$paidStatus}' THEN amount ELSE 0 END), 0) as total_revenue,
            COALESCE(SUM(CASE WHEN status = '{$paidStatus}' AND DATE(created_at) = CURDATE() THEN amount ELSE 0 END), 0) as today_revenue,
            SUM(CASE WHEN status = '{$paidStatus}' THEN 1 ELSE 0 END) as paid_count
        FROM payments";
        $revenueStats = $this->fetchOne($revenueStatsSql);

        // 2. Customer KPIs
        $customerStatsSql = "SELECT 
            COUNT(*) as total_customers,
            SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_customers,
            SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked_customers
        FROM customers";
        $customerStats = $this->fetchOne($customerStatsSql);

        // 3. Driver KPIs
        $driverStatsSql = "SELECT 
            COUNT(*) as total_drivers,
            SUM(CASE WHEN is_online = 1 THEN 1 ELSE 0 END) as online_drivers,
            SUM(CASE WHEN approval_status = 'APPROVED' THEN 1 ELSE 0 END) as approved_drivers,
            SUM(CASE WHEN approval_status = 'PENDING' THEN 1 ELSE 0 END) as pending_drivers,
            SUM(CASE WHEN approval_status = 'SUSPENDED' THEN 1 ELSE 0 END) as suspended_drivers,
            SUM(CASE WHEN approval_status = 'REJECTED' THEN 1 ELSE 0 END) as rejected_drivers
        FROM drivers";
        $driverStats = $this->fetchOne($driverStatsSql);

        // 4. Vehicle Category Count
        $categoryCount = $this->fetchOne("SELECT COUNT(*) as total_categories FROM vehicle_categories WHERE is_active = 1");

        // 5. Recent 8 Bookings
        if ($this->isLocalSchema()) {
            $recentBookingsSql = "SELECT 
                b.id, b.ride_type, b.vehicle_category, b.status, b.total_fare, b.payment_method, b.payment_status, b.created_at,
                c.name as customer_name, c.phone as customer_phone,
                d.name as driver_name, d.phone as driver_phone,
                p.name as pickup_name, p.address as pickup_address,
                dr.name as drop_name, dr.address as drop_address
            FROM bookings b
            LEFT JOIN customers c ON c.id = b.customer_id
            LEFT JOIN drivers d ON d.id = b.driver_id
            LEFT JOIN booking_locations p ON p.booking_id = b.id AND p.type = 'PICKUP'
            LEFT JOIN booking_locations dr ON dr.booking_id = b.id AND dr.type = 'DROP'
            ORDER BY b.created_at DESC
            LIMIT 8";
        } else {
            $recentBookingsSql = "SELECT 
                b.id, 'CITY' as ride_type, COALESCE(vc.name, 'N/A') as vehicle_category, b.status, b.final_fare as total_fare, b.payment_method, b.payment_status, b.created_at,
                c.name as customer_name, c.phone as customer_phone,
                d.name as driver_name, d.phone as driver_phone,
                b.pickup_address as pickup_name, b.pickup_address as pickup_address,
                b.dropoff_address as drop_name, b.dropoff_address as drop_address
            FROM bookings b
            LEFT JOIN customers c ON c.id = b.customer_id
            LEFT JOIN drivers d ON d.id = b.driver_id
            LEFT JOIN vehicle_categories vc ON vc.id = b.vehicle_category_id
            ORDER BY b.created_at DESC
            LIMIT 8";
        }
        $recentBookings = $this->fetchAll($recentBookingsSql);

        // 6. Revenue & Booking Trend (last 7 days, zero-filled).
        //    Revenue comes from the payments ledger (paid transactions only), bookings is a booking count.
        $trendDaysSql = "SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 0 DAY), '%Y-%m-%d') AS day
            UNION ALL SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '%Y-%m-%d')
            UNION ALL SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '%Y-%m-%d')
            UNION ALL SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '%Y-%m-%d')
            UNION ALL SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 4 DAY), '%Y-%m-%d')
            UNION ALL SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '%Y-%m-%d')
            UNION ALL SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 6 DAY), '%Y-%m-%d')";
        $trendRevenueSql = "SELECT DATE(created_at) AS day,
            ROUND(COALESCE(SUM(CASE WHEN status = '{$paidStatus}' THEN amount ELSE 0 END), 0), 2) AS revenue
        FROM payments
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(created_at)";
        $trendBookingsSql = "SELECT DATE(created_at) AS day, COUNT(*) AS bookings
        FROM bookings
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(created_at)";
        $trendRowsSql = "SELECT d.day, COALESCE(r.revenue, 0) AS revenue, COALESCE(b.bookings, 0) AS bookings
            FROM ({$trendDaysSql}) d
            LEFT JOIN ({$trendRevenueSql}) r ON r.day = d.day
            LEFT JOIN ({$trendBookingsSql}) b ON b.day = d.day
            ORDER BY d.day ASC";
        $trendRows = $this->fetchAll($trendRowsSql);
        $revenueTrend = array();
        foreach ($trendRows as $row) {
            $revenueTrend[] = array(
                'day'      => $row['day'],
                'label'    => date('D', strtotime($row['day'])),
                'revenue'  => (float)$row['revenue'],
                'bookings' => (int)$row['bookings']
            );
        }

        return array(
            'kpis' => array(
                'total_bookings'      => (int)$bookingStats['total_bookings'],
                'completed_bookings'  => (int)$bookingStats['completed_bookings'],
                'active_bookings'     => (int)$bookingStats['active_bookings'],
                'cancelled_bookings'  => (int)$bookingStats['cancelled_bookings'],
                'total_revenue'       => (float)$revenueStats['total_revenue'],
                'today_revenue'       => (float)$revenueStats['today_revenue'],
                'paid_transactions'   => (int)$revenueStats['paid_count'],
                'today_bookings'      => (int)$bookingStats['today_bookings'],
                'total_customers'     => (int)$customerStats['total_customers'],
                'active_customers'    => (int)$customerStats['active_customers'],
                'blocked_customers'   => (int)$customerStats['blocked_customers'],
                'total_drivers'       => (int)$driverStats['total_drivers'],
                'online_drivers'      => (int)$driverStats['online_drivers'],
                'approved_drivers'    => (int)$driverStats['approved_drivers'],
                'pending_drivers'     => (int)$driverStats['pending_drivers'],
                'suspended_drivers'   => (int)$driverStats['suspended_drivers'],
                'total_categories'    => (int)$categoryCount['total_categories']
            ),
            'driver_distribution' => array(
                'approved'  => (int)$driverStats['approved_drivers'],
                'pending'   => (int)$driverStats['pending_drivers'],
                'suspended' => (int)$driverStats['suspended_drivers'],
                'rejected'  => (int)$driverStats['rejected_drivers']
            ),
            'recent_bookings' => $recentBookings,
            'revenue_trend'   => $revenueTrend
        );
    }

    /**
     * Get Customers list with wallet balance and total bookings
     *
     * @param int $limit
     * @param int $offset
     * @param string $search
     * @return array
     */
    public function getCustomers($limit = 50, $offset = 0, $search = '')
    {
        $params = array();
        $whereClause = "WHERE 1=1";

        if (!empty($search)) {
            $whereClause .= " AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)";
            $searchTerm = '%' . $search . '%';
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        $countSql = "SELECT COUNT(*) as total FROM customers c $whereClause";
        $totalRow = $this->fetchOne($countSql, $params);
        $total = (int)$totalRow['total'];

        $sql = "SELECT 
            c.id, c.name, c.phone, c.email, c.avatar_url, c.status, c.total_rides, c.created_at,
            COALESCE(w.balance, 0.00) as wallet_balance,
            COUNT(b.id) as actual_bookings_count
        FROM customers c
        LEFT JOIN customer_wallets w ON w.customer_id = c.id
        LEFT JOIN bookings b ON b.customer_id = c.id
        $whereClause
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT " . (int)$limit . " OFFSET " . (int)$offset;

        $customers = $this->fetchAll($sql, $params);

        return array(
            'customers' => $customers,
            'total'     => $total,
            'limit'     => $limit,
            'offset'    => $offset
        );
    }

    /**
     * Update customer account status (ACTIVE or BLOCKED)
     *
     * @param string $customerId
     * @param string $status
     * @return bool
     */
    public function updateCustomerStatus($customerId, $status)
    {
        $validStatuses = array('ACTIVE', 'BLOCKED', 'DELETED');
        if (!in_array($status, $validStatuses, true)) {
            return false;
        }

        $sql = "UPDATE customers SET status = ?, updated_at = NOW() WHERE id = ?";
        return $this->execute($sql, array($status, $customerId)) > 0;
    }

    /**
     * Delete customer account and associated records
     */
    public function deleteCustomer($customerId)
    {
        try {
            $this->execute("DELETE FROM customer_wallets WHERE customer_id = ?", array($customerId));
            $this->execute("DELETE FROM customer_saved_places WHERE customer_id = ?", array($customerId));
            $this->execute("DELETE FROM notifications WHERE user_id = ? AND user_type = 'CUSTOMER'", array($customerId));
            $this->execute("DELETE FROM support_tickets WHERE user_id = ? AND user_type = 'CUSTOMER'", array($customerId));
            $res = $this->execute("DELETE FROM customers WHERE id = ?", array($customerId));
            if ($res <= 0) {
                $this->execute("UPDATE customers SET status = 'DELETED', updated_at = NOW() WHERE id = ?", array($customerId));
            }
            return true;
        } catch (Exception $e) {
            $this->execute("UPDATE customers SET status = 'DELETED', updated_at = NOW() WHERE id = ?", array($customerId));
            return true;
        }
    }

    /**
     * Delete driver account and associated records
     */
    public function deleteDriver($driverId)
    {
        try {
            $this->execute("DELETE FROM driver_wallets WHERE driver_id = ?", array($driverId));
            $this->execute("DELETE FROM driver_documents WHERE driver_id = ?", array($driverId));
            $this->execute("DELETE FROM vehicles WHERE driver_id = ?", array($driverId));
            $this->execute("DELETE FROM notifications WHERE user_id = ? AND user_type = 'DRIVER'", array($driverId));
            $res = $this->execute("DELETE FROM drivers WHERE id = ?", array($driverId));
            if ($res <= 0) {
                $this->execute("UPDATE drivers SET approval_status = 'REJECTED', is_online = 0, updated_at = NOW() WHERE id = ?", array($driverId));
            }
            return true;
        } catch (Exception $e) {
            $this->execute("UPDATE drivers SET approval_status = 'REJECTED', is_online = 0, updated_at = NOW() WHERE id = ?", array($driverId));
            return true;
        }
    }

    /**
     * Get Drivers list with vehicle info, wallet balance, and stats
     *
     * @param int $limit
     * @param int $offset
     * @param string $approvalStatus
     * @param string $search
     * @return array
     */
    public function getDrivers($limit = 50, $offset = 0, $approvalStatus = '', $search = '')
    {
        $params = array();
        $whereClause = "WHERE 1=1";

        if (!empty($approvalStatus)) {
            $whereClause .= " AND d.approval_status = ?";
            $params[] = $approvalStatus;
        }

        if (!empty($search)) {
            $whereClause .= " AND (d.name LIKE ? OR d.phone LIKE ? OR d.email LIKE ? OR dv.vehicle_number LIKE ?)";
            $searchTerm = '%' . $search . '%';
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        $vehicleJoin = $this->isLocalSchema() ? "dv.is_active = 1" : "dv.is_primary = 1";

        $countSql = "SELECT COUNT(DISTINCT d.id) as total 
            FROM drivers d 
            LEFT JOIN driver_vehicles dv ON dv.driver_id = d.id AND {$vehicleJoin}
            $whereClause";
        $totalRow = $this->fetchOne($countSql, $params);
        $total = (int)$totalRow['total'];

        if ($this->isLocalSchema()) {
            $sql = "SELECT 
                d.id, d.name, d.phone, d.email, d.photo_url, d.rating, d.trips_count, d.is_online,
                d.approval_status, d.commission_percent, d.current_lat, d.current_lng, d.created_at,
                dv.vehicle_model, dv.vehicle_number, dv.vehicle_type, dv.color, dv.category_id,
                COALESCE(dw.balance, 0.00) as wallet_balance,
                COALESCE(dw.today_earnings, 0.00) as today_earnings
            FROM drivers d
            LEFT JOIN driver_vehicles dv ON dv.driver_id = d.id AND {$vehicleJoin}
            LEFT JOIN driver_wallets dw ON dw.driver_id = d.id
            $whereClause
            GROUP BY d.id
            ORDER BY d.created_at DESC
            LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
        } else {
            $sql = "SELECT 
                d.id, d.name, d.phone, d.email, d.avatar_url as photo_url, d.rating_avg as rating,
                d.total_rides as trips_count, d.is_online, d.is_on_ride,
                d.approval_status, NULL as commission_percent, d.current_lat, d.current_lng, d.created_at,
                dv.vehicle_model, dv.vehicle_number, NULL as vehicle_type, dv.vehicle_color as color,
                dv.vehicle_category_id as category_id,
                COALESCE(dw.balance, 0.00) as wallet_balance,
                0.00 as today_earnings
            FROM drivers d
            LEFT JOIN driver_vehicles dv ON dv.driver_id = d.id AND {$vehicleJoin}
            LEFT JOIN driver_wallets dw ON dw.driver_id = d.id
            $whereClause
            GROUP BY d.id
            ORDER BY d.created_at DESC
            LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
        }

        $drivers = $this->fetchAll($sql, $params);

        return array(
            'drivers' => $drivers,
            'total'   => $total,
            'limit'   => $limit,
            'offset'  => $offset
        );
    }

    /**
     * Update driver approval status
     *
     * @param string $driverId
     * @param string $approvalStatus
     * @return bool
     */
    public function updateDriverApproval($driverId, $approvalStatus)
    {
        $validStatuses = array('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
        if (!in_array($approvalStatus, $validStatuses, true)) {
            return false;
        }

        $sql = "UPDATE drivers SET approval_status = ?, updated_at = NOW() WHERE id = ?";
        return $this->execute($sql, array($approvalStatus, $driverId)) > 0;
    }

    /**
     * Update driver online status (Admin override)
     *
     * @param string $driverId
     * @param int $isOnline
     * @return bool
     */
    public function updateDriverStatus($driverId, $isOnline)
    {
        $sql = "UPDATE drivers SET is_online = ?, updated_at = NOW() WHERE id = ?";
        return $this->execute($sql, array($isOnline ? 1 : 0, $driverId)) > 0;
    }

    /**
     * Get Vehicle Categories
     *
     * @return array
     */
    public function getVehicleCategories()
    {
        if ($this->isLocalSchema()) {
            $sql = "SELECT 
                vc.id, vc.name, vc.category, vc.capacity, vc.base_price, vc.per_km_rate,
                vc.eta_min, vc.tagline, vc.image_url, vc.is_active, vc.sort_order,
                COUNT(dv.id) as active_assigned_vehicles
            FROM vehicle_categories vc
            LEFT JOIN driver_vehicles dv ON dv.category_id = vc.id AND dv.is_active = 1
            GROUP BY vc.id
            ORDER BY vc.sort_order ASC";
        } else {
            $sql = "SELECT 
                vc.id, vc.name, vc.code as category, vc.seat_capacity as capacity, vc.base_fare as base_price,
                vc.per_km_fare as per_km_rate, NULL as eta_min, vc.description as tagline, vc.icon_url as image_url,
                vc.is_active, vc.sort_order,
                COUNT(dv.id) as active_assigned_vehicles
            FROM vehicle_categories vc
            LEFT JOIN driver_vehicles dv ON dv.vehicle_category_id = vc.id AND dv.is_primary = 1
            GROUP BY vc.id
            ORDER BY vc.sort_order ASC";
        }
        return $this->fetchAll($sql);
    }

    /**
     * Update vehicle category details
     *
     * @param string $id
     * @param array $data
     * @return bool
     */
    public function updateVehicleCategory($id, $data)
    {
        if ($this->isLocalSchema()) {
            $sql = "UPDATE vehicle_categories SET 
                base_price = ?,
                per_km_rate = ?,
                capacity = ?,
                tagline = ?,
                is_active = ?
            WHERE id = ?";

            return $this->execute($sql, array(
                $data['base_price'],
                $data['per_km_rate'],
                $data['capacity'],
                $data['tagline'],
                $data['is_active'] ? 1 : 0,
                $id
            )) > 0;
        }

        $sql = "UPDATE vehicle_categories SET 
            base_fare = ?,
            per_km_fare = ?,
            per_min_fare = ?,
            seat_capacity = ?,
            minimum_fare = ?,
            cancellation_fee = ?,
            description = ?,
            is_active = ?
        WHERE id = ?";

        return $this->execute($sql, array(
            isset($data['base_fare']) ? $data['base_fare'] : (isset($data['base_price']) ? $data['base_price'] : 0),
            isset($data['per_km_fare']) ? $data['per_km_fare'] : (isset($data['per_km_rate']) ? $data['per_km_rate'] : 0),
            isset($data['per_min_fare']) ? $data['per_min_fare'] : 0,
            isset($data['seat_capacity']) ? $data['seat_capacity'] : (isset($data['capacity']) ? $data['capacity'] : 4),
            isset($data['minimum_fare']) ? $data['minimum_fare'] : 0,
            isset($data['cancellation_fee']) ? $data['cancellation_fee'] : 0,
            isset($data['description']) ? $data['description'] : (isset($data['tagline']) ? $data['tagline'] : null),
            isset($data['is_active']) ? ($data['is_active'] ? 1 : 0) : 1,
            $id
        )) > 0;
    }

    /**
     * Toggle vehicle category active status
     *
     * @param string $id
     * @return array|null Updated category
     */
    public function toggleVehicleCategory($id)
    {
        $sql = "UPDATE vehicle_categories SET is_active = IF(is_active = 1, 0, 1) WHERE id = ?";
        $this->execute($sql, array($id));
        if ($this->isLocalSchema()) {
            return $this->fetchOne("SELECT id, name, category, is_active FROM vehicle_categories WHERE id = ?", array($id));
        }
        return $this->fetchOne("SELECT id, name, code as category, is_active FROM vehicle_categories WHERE id = ?", array($id));
    }

    /**
     * Get Bookings list with full customer, driver, and location details
     *
     * @param int $limit
     * @param int $offset
     * @param string $status
     * @param string $search
     * @return array
     */
    public function getBookings($limit = 50, $offset = 0, $status = '', $search = '')
    {
        $params = array();
        $whereClause = "WHERE 1=1";

        if (!empty($status) && $status !== 'ALL') {
            $whereClause .= " AND b.status = ?";
            $params[] = $status;
        }

        if (!empty($search)) {
            $whereClause .= " AND (b.id LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR d.name LIKE ? OR d.phone LIKE ?)";
            $searchTerm = '%' . $search . '%';
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        $countSql = "SELECT COUNT(*) as total 
            FROM bookings b
            LEFT JOIN customers c ON c.id = b.customer_id
            LEFT JOIN drivers d ON d.id = b.driver_id
            $whereClause";
        $totalRow = $this->fetchOne($countSql, $params);
        $total = (int)$totalRow['total'];

        if ($this->isLocalSchema()) {
            $sql = "SELECT 
                b.id, b.customer_id, b.driver_id, b.vehicle_id, b.city_id, b.ride_type, b.vehicle_category,
                b.status, b.start_otp, b.distance_km, b.duration_min, b.base_fare, b.distance_fare,
                b.time_fare, b.waiting_fare, b.platform_fee, b.tax, b.discount, b.total_fare,
                b.payment_method, b.payment_status, b.rating, b.review_text,
                b.assigned_at, b.started_at, b.completed_at, b.created_at,
                c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
                d.name as driver_name, d.phone as driver_phone,
                dv.vehicle_model, dv.vehicle_number,
                p.name as pickup_name, p.address as pickup_address, p.lat as pickup_lat, p.lng as pickup_lng,
                dr.name as drop_name, dr.address as drop_address, dr.lat as drop_lat, dr.lng as drop_lng
            FROM bookings b
            LEFT JOIN customers c ON c.id = b.customer_id
            LEFT JOIN drivers d ON d.id = b.driver_id
            LEFT JOIN driver_vehicles dv ON dv.driver_id = d.id AND dv.is_active = 1
            LEFT JOIN booking_locations p ON p.booking_id = b.id AND p.type = 'PICKUP'
            LEFT JOIN booking_locations dr ON dr.booking_id = b.id AND dr.type = 'DROP'
            $whereClause
            ORDER BY b.created_at DESC
            LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
        } else {
            $sql = "SELECT 
                b.id, b.customer_id, b.driver_id, NULL as vehicle_id, NULL as city_id,
                'CITY' as ride_type, COALESCE(vc.name, 'N/A') as vehicle_category, b.vehicle_category_id,
                b.status, b.otp as start_otp,
                COALESCE(b.actual_distance_km, b.estimated_distance_km, 0) as distance_km,
                COALESCE(b.actual_duration_min, b.estimated_duration_min, 0) as duration_min,
                NULL as base_fare, NULL as distance_fare, NULL as time_fare, NULL as waiting_fare,
                NULL as platform_fee, NULL as tax, b.discount_amount as discount, b.final_fare as total_fare,
                b.payment_method, b.payment_status, b.driver_rating as rating, b.driver_feedback as review_text,
                b.accepted_at as assigned_at, b.started_at, b.completed_at, b.created_at,
                c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
                d.name as driver_name, d.phone as driver_phone,
                dv.vehicle_model, dv.vehicle_number,
                b.pickup_address as pickup_name, b.pickup_address as pickup_address,
                b.pickup_lat as pickup_lat, b.pickup_lng as pickup_lng,
                b.dropoff_address as drop_name, b.dropoff_address as drop_address,
                b.dropoff_lat as drop_lat, b.dropoff_lng as drop_lng
            FROM bookings b
            LEFT JOIN customers c ON c.id = b.customer_id
            LEFT JOIN drivers d ON d.id = b.driver_id
            LEFT JOIN driver_vehicles dv ON dv.driver_id = d.id AND dv.is_primary = 1
            LEFT JOIN vehicle_categories vc ON vc.id = b.vehicle_category_id
            $whereClause
            ORDER BY b.created_at DESC
            LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
        }

        $bookings = $this->fetchAll($sql, $params);

        return array(
            'bookings' => $bookings,
            'total'    => $total,
            'limit'    => $limit,
            'offset'   => $offset
        );
    }

    /**
     * Get all ride ratings with customer and driver details
     *
     * @param int $limit
     * @param int $offset
     * @return array
     */
    public function getRatings($limit = 50, $offset = 0)
    {
        $sql = "SELECT 
                b.id, b.rating, b.review_text, b.created_at,
                c.name as customer_name, c.phone as customer_phone,
                d.name as driver_name, d.phone as driver_phone
            FROM bookings b
            LEFT JOIN customers c ON c.id = b.customer_id
            LEFT JOIN drivers d ON d.id = b.driver_id
            WHERE b.rating IS NOT NULL
            ORDER BY b.created_at DESC
            LIMIT " . (int)$limit . " OFFSET " . (int)$offset;

        $ratings = $this->fetchAll($sql);

        // Count total
        $countSql = "SELECT COUNT(*) as total FROM bookings WHERE rating IS NOT NULL";
        $totalRow = $this->fetchOne($countSql);
        $total = (int)$totalRow['total'];

        return array(
            'ratings' => $ratings,
            'total'    => $total,
            'limit'    => $limit,
            'offset'   => $offset
        );
    }

    /**
     * Get single booking details
     *
     * @param string $id
     * @return array|null
     */
    public function getBookingDetail($id)
    {
        if ($this->isLocalSchema()) {
            $sql = "SELECT 
                b.*,
                c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
                d.name as driver_name, d.phone as driver_phone, d.photo_url as driver_photo, d.rating as driver_rating,
                dv.vehicle_model, dv.vehicle_number, dv.vehicle_type, dv.color as vehicle_color,
                p.name as pickup_name, p.address as pickup_address, p.lat as pickup_lat, p.lng as pickup_lng,
                dr.name as drop_name, dr.address as drop_address, dr.lat as drop_lat, dr.lng as drop_lng
            FROM bookings b
            LEFT JOIN customers c ON c.id = b.customer_id
            LEFT JOIN drivers d ON d.id = b.driver_id
            LEFT JOIN driver_vehicles dv ON dv.driver_id = d.id AND dv.is_active = 1
            LEFT JOIN booking_locations p ON p.booking_id = b.id AND p.type = 'PICKUP'
            LEFT JOIN booking_locations dr ON dr.booking_id = b.id AND dr.type = 'DROP'
            WHERE b.id = ? LIMIT 1";
        } else {
            $sql = "SELECT 
                b.*,
                c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
                d.name as driver_name, d.phone as driver_phone, d.avatar_url as driver_photo, d.rating_avg as driver_rating,
                dv.vehicle_model, dv.vehicle_number, NULL as vehicle_type, dv.vehicle_color as vehicle_color,
                b.pickup_address as pickup_name, b.pickup_address as pickup_address, b.pickup_lat as pickup_lat, b.pickup_lng as pickup_lng,
                b.dropoff_address as drop_name, b.dropoff_address as drop_address, b.dropoff_lat as drop_lat, b.dropoff_lng as drop_lng
            FROM bookings b
            LEFT JOIN customers c ON c.id = b.customer_id
            LEFT JOIN drivers d ON d.id = b.driver_id
            LEFT JOIN driver_vehicles dv ON dv.driver_id = d.id AND dv.is_primary = 1
            WHERE b.id = ? LIMIT 1";
        }

        return $this->fetchOne($sql, array($id));
    }

    /**
     * Assign a driver to a booking (Admin manual assignment)
     *
     * @param string $bookingId
     * @param string $driverId
     * @return array Result array with success or error
     */
    public function assignDriver($bookingId, $driverId)
    {
        $booking = $this->fetchOne("SELECT id, status, customer_id FROM bookings WHERE id = ?", array($bookingId));
        if (!$booking) {
            return array('success' => false, 'error' => 'Booking not found');
        }

        if ($booking['status'] === 'COMPLETED' || $booking['status'] === 'CANCELLED') {
            return array('success' => false, 'error' => "Cannot assign driver to a {$booking['status']} booking");
        }

        $driver = $this->fetchOne("SELECT id, name, approval_status, is_online FROM drivers WHERE id = ?", array($driverId));
        if (!$driver) {
            return array('success' => false, 'error' => 'Driver not found');
        }

        if ($driver['approval_status'] !== 'APPROVED') {
            return array('success' => false, 'error' => "Cannot assign driver: Partner approval status is {$driver['approval_status']}");
        }

        // Check if driver is already engaged in another active ride
        $activeRide = $this->fetchOne(
            "SELECT id FROM bookings WHERE driver_id = ? AND status IN ('ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS') AND id != ? LIMIT 1",
            array($driverId, $bookingId)
        );
        if ($activeRide) {
            return array('success' => false, 'error' => 'Selected driver is already engaged in another active ride');
        }

        // Check driver prepaid wallet balance
        $wallet = $this->fetchOne("SELECT balance FROM driver_wallets WHERE driver_id = ?", array($driverId));
        $driverBal = $wallet ? (float)$wallet['balance'] : 0.0;
        if ($driverBal <= 0) {
            // Send automated low balance notification to driver
            $notifType = $this->isLocalSchema() ? 'PAYMENT' : 'SYSTEM';
            $notifAud = $this->isLocalSchema() ? 'INDIVIDUAL' : 'DRIVERS';
            $this->execute(
                "INSERT INTO notifications (id, user_id, user_type, title, message, type, is_read, audience, created_at)
                 VALUES (?, ?, 'DRIVER', 'Low Wallet Balance - Recharge Required', 'Your prepaid wallet balance is ₹" . number_format($driverBal, 2) . ". Please recharge your wallet to receive and accept new rides.', '$notifType', 0, '$notifAud', NOW())",
                array(Security::generateUUID(), $driverId)
            );
            return array('success' => false, 'error' => "Cannot assign ride: Driver has low prepaid wallet balance (₹" . number_format($driverBal, 2) . "). Automated recharge notification has been sent to the driver.");
        }

        // Get driver's primary vehicle
        $vehicleJoin = $this->isLocalSchema() ? "dv.is_active = 1" : "dv.is_primary = 1";
        $vehicle = $this->fetchOne("SELECT id, vehicle_model, vehicle_number FROM driver_vehicles dv WHERE dv.driver_id = ? AND {$vehicleJoin} LIMIT 1", array($driverId));
        $vehicleId = $vehicle ? $vehicle['id'] : null;

        // Perform assignment
        if ($this->isLocalSchema()) {
            $updateSql = "UPDATE bookings SET 
                driver_id = ?,
                vehicle_id = ?,
                status = 'ASSIGNED',
                assigned_at = NOW(),
                updated_at = NOW()
            WHERE id = ?";
            $this->execute($updateSql, array($driverId, $vehicleId, $bookingId));
        } else {
            $categoryId = $vehicle && !empty($vehicle['vehicle_category_id']) ? $vehicle['vehicle_category_id'] : null;
            $updateSql = "UPDATE bookings SET 
                driver_id = ?,
                vehicle_category_id = ?,
                status = 'ASSIGNED',
                accepted_at = NOW(),
                updated_at = NOW()
            WHERE id = ?";
            $this->execute($updateSql, array($driverId, $categoryId, $bookingId));
        }

        // Create notification for driver and customer
        $notifType   = $this->isLocalSchema() ? 'RIDE' : 'RIDE_UPDATE';
        $notifAud1   = $this->isLocalSchema() ? 'INDIVIDUAL' : 'DRIVERS';
        $notifAud2   = $this->isLocalSchema() ? 'INDIVIDUAL' : 'CUSTOMERS';

        $this->execute("INSERT INTO notifications (id, user_id, user_type, title, message, type, is_read, audience, created_at)
            VALUES (?, ?, 'DRIVER', 'Admin Assigned New Ride', 'You have been assigned ride #" . substr($bookingId, 0, 8) . "', '$notifType', 0, '$notifAud1', NOW())",
            array(Security::generateUUID(), $driverId)
        );

        $this->execute("INSERT INTO notifications (id, user_id, user_type, title, message, type, is_read, audience, created_at)
            VALUES (?, ?, 'CUSTOMER', 'Driver Assigned by Dispatch', 'A driver has been assigned to your ride.', '$notifType', 0, '$notifAud2', NOW())",
            array(Security::generateUUID(), $booking['customer_id'])
        );

        return array(
            'success' => true,
            'booking' => $this->getBookingDetail($bookingId)
        );
    }

    /**
     * Update booking status manually (Admin override)
     *
     * @param string $bookingId
     * @param string $status
     * @return bool
     */
    public function updateBookingStatus($bookingId, $status)
    {
        if ($this->isLocalSchema()) {
            $validStatuses = array('SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SCHEDULED');
        } else {
            $validStatuses = array('SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
        }
        if (!in_array($status, $validStatuses, true)) {
            return false;
        }

        $extraUpdates = '';
        if ($status === 'COMPLETED') {
            $extraUpdates = ", completed_at = NOW(), payment_status = 'PAID'";
        } elseif ($status === 'IN_PROGRESS') {
            $extraUpdates = ", started_at = NOW()";
        }

        $sql = "UPDATE bookings SET status = ? $extraUpdates, updated_at = NOW() WHERE id = ?";
        return $this->execute($sql, array($status, $bookingId)) > 0;
    }

    /**
     * Get Fare Rules joined with Vehicle Categories
     *
     * @return array
     */
    public function getFareRules()
    {
        if ($this->isLocalSchema()) {
            $sql = "SELECT 
                fr.id, fr.city_id, fr.category_id, fr.base_fare, fr.free_km, fr.per_km, fr.per_minute,
                fr.waiting_per_min, fr.night_charge_percent, fr.platform_fee, fr.tax_percent,
                fr.cancellation_fee, fr.is_active, fr.updated_at,
                vc.name as category_name, vc.category as category_slug, vc.capacity
            FROM fare_rules fr
            LEFT JOIN vehicle_categories vc ON vc.id = fr.category_id
            ORDER BY fr.category_id ASC";
        } else {
            $sql = "SELECT 
                fr.id, fr.city_id, fr.vehicle_category_id as category_id, fr.base_fare, 0 as free_km,
                fr.per_km_fare as per_km, fr.per_min_fare as per_minute,
                fr.waiting_charge_per_min as waiting_per_min, fr.night_surge_multiplier as night_charge_percent,
                0 as platform_fee, 0 as tax_percent,
                fr.cancellation_fee, fr.is_active, fr.updated_at,
                vc.name as category_name, vc.code as category_slug, vc.seat_capacity as capacity
            FROM fare_rules fr
            LEFT JOIN vehicle_categories vc ON vc.id = fr.vehicle_category_id
            ORDER BY fr.vehicle_category_id ASC";
        }
        return $this->fetchAll($sql);
    }

    /**
     * Update a Fare Rule
     *
     * @param string $id
     * @param array $data
     * @return bool
     */
    public function updateFareRule($id, $data)
    {
        if ($this->isLocalSchema()) {
            $sql = "UPDATE fare_rules SET 
                base_fare = ?,
                free_km = ?,
                per_km = ?,
                per_minute = ?,
                waiting_per_min = ?,
                night_charge_percent = ?,
                platform_fee = ?,
                tax_percent = ?,
                cancellation_fee = ?,
                is_active = ?,
                updated_at = NOW()
            WHERE id = ?";

            return $this->execute($sql, array(
                $data['base_fare'],
                isset($data['free_km']) ? $data['free_km'] : 0.00,
                $data['per_km'],
                isset($data['per_minute']) ? $data['per_minute'] : 0.00,
                isset($data['waiting_per_min']) ? $data['waiting_per_min'] : 0.00,
                isset($data['night_charge_percent']) ? $data['night_charge_percent'] : 0.00,
                isset($data['platform_fee']) ? $data['platform_fee'] : 10.00,
                isset($data['tax_percent']) ? $data['tax_percent'] : 5.00,
                isset($data['cancellation_fee']) ? $data['cancellation_fee'] : 30.00,
                isset($data['is_active']) ? ($data['is_active'] ? 1 : 0) : 1,
                $id
            )) > 0;
        }

        $sql = "UPDATE fare_rules SET 
            base_fare = ?,
            per_km_fare = ?,
            per_min_fare = ?,
            waiting_charge_per_min = ?,
            night_surge_multiplier = ?,
            cancellation_fee = ?,
            is_active = ?,
            updated_at = NOW()
        WHERE id = ?";

        return $this->execute($sql, array(
            isset($data['base_fare']) ? $data['base_fare'] : 0.00,
            isset($data['per_km']) ? $data['per_km'] : (isset($data['per_km_fare']) ? $data['per_km_fare'] : 0.00),
            isset($data['per_minute']) ? $data['per_minute'] : (isset($data['per_min_fare']) ? $data['per_min_fare'] : 0.00),
            isset($data['waiting_per_min']) ? $data['waiting_per_min'] : (isset($data['waiting_charge_per_min']) ? $data['waiting_charge_per_min'] : 0.00),
            isset($data['night_charge_percent']) ? $data['night_charge_percent'] : (isset($data['night_surge_multiplier']) ? $data['night_surge_multiplier'] : 1.00),
            isset($data['cancellation_fee']) ? $data['cancellation_fee'] : (isset($data['cancellation_fee_local']) ? $data['cancellation_fee_local'] : 0.00),
            isset($data['is_active']) ? ($data['is_active'] ? 1 : 0) : 1,
            $id
        )) > 0;
    }

    /**
     * Get Partner Vehicles list with driver and category information
     *
     * @param int $limit
     * @param int $offset
     * @param string $search
     * @return array
     */
    public function getPartnerVehicles($limit = 50, $offset = 0, $search = '')
    {
        $params = array();
        $whereClause = "WHERE 1=1";

        if (!empty($search)) {
            $whereClause .= " AND (dv.vehicle_number LIKE ? OR dv.vehicle_model LIKE ? OR d.name LIKE ? OR d.phone LIKE ?)";
            $searchTerm = '%' . $search . '%';
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        $countSql = "SELECT COUNT(*) as total 
            FROM driver_vehicles dv
            LEFT JOIN drivers d ON d.id = dv.driver_id
            $whereClause";
        $totalRow = $this->fetchOne($countSql, $params);
        $total = (int)$totalRow['total'];

        if ($this->isLocalSchema()) {
            $sql = "SELECT 
                dv.id, dv.driver_id, dv.vehicle_model, dv.vehicle_number, dv.vehicle_type,
                dv.category_id, dv.color, dv.year, dv.is_active, dv.created_at,
                d.name as driver_name, d.phone as driver_phone, d.approval_status as driver_approval_status,
                d.is_online as driver_is_online,
                vc.name as category_name
            FROM driver_vehicles dv
            LEFT JOIN drivers d ON d.id = dv.driver_id
            LEFT JOIN vehicle_categories vc ON vc.id = dv.category_id
            $whereClause
            ORDER BY dv.created_at DESC
            LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
        } else {
            $sql = "SELECT 
                dv.id, dv.driver_id, dv.vehicle_model, dv.vehicle_number, NULL as vehicle_type,
                dv.vehicle_category_id as category_id, dv.vehicle_color as color, dv.vehicle_year as year,
                dv.is_primary as is_active, dv.created_at,
                d.name as driver_name, d.phone as driver_phone, d.approval_status as driver_approval_status,
                d.is_online as driver_is_online,
                vc.name as category_name
            FROM driver_vehicles dv
            LEFT JOIN drivers d ON d.id = dv.driver_id
            LEFT JOIN vehicle_categories vc ON vc.id = dv.vehicle_category_id
            $whereClause
            ORDER BY dv.created_at DESC
            LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
        }

        $vehicles = $this->fetchAll($sql, $params);

        return array(
            'vehicles' => $vehicles,
            'total'    => $total,
            'limit'    => $limit,
            'offset'   => $offset
        );
    }

    // =====================================================================
    // Dynamic admin sections: Coupons / Offers / Wallets / Payments / SOS /
    // Support / Notifications / Settings (schema-aware where tables differ)
    // =====================================================================

    /**
     * Get Coupons list (normalized across local & production schemas)
     */
    public function getCoupons($limit = 50, $offset = 0, $search = '')
    {
        $searchClause = '';
        $params = array();
        if (!empty($search)) {
            $searchClause = "WHERE code LIKE ? OR description LIKE ?";
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
        }

        if (!$this->promoUsesProductionSchema()) {
            $sql = "SELECT id, code, discount_type, discount_amount as discount, min_booking as min_order,
                    max_discount, COALESCE(max_uses_total,0) as max_uses, 0 as used_count,
                    description, expiry_date as expiry, is_active, created_at
                FROM coupons $searchClause
                ORDER BY created_at DESC
                LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
        } else {
            $sql = "SELECT id, code, 
                    CASE WHEN discount_type = 'PERCENTAGE' THEN 'PERCENT' ELSE discount_type END as discount_type,
                    discount_value as discount, min_order_amount as min_order,
                    max_discount, COALESCE(max_uses,0) as max_uses, used_count,
                    description, valid_until as expiry, is_active, created_at
                FROM coupons $searchClause
                ORDER BY created_at DESC
                LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
        }

        $coupons = $this->fetchAll($sql, $params);
        $countRow = $this->fetchOne("SELECT COUNT(*) as c FROM coupons $searchClause", $params);

        return array('coupons' => $coupons, 'total' => (int)$countRow['c'], 'limit' => $limit, 'offset' => $offset);
    }

    /**
     * Create a coupon (schema-aware)
     */
    public function createCoupon($data)
    {
        $code = isset($data['code']) ? trim($data['code']) : '';
        if ($code === '') {
            return array('success' => false, 'error' => 'Coupon code is required');
        }
        $discountType = strtoupper(isset($data['discount_type']) ? $data['discount_type'] : 'FLAT');
        $discountType = ($discountType === 'PERCENT' || $discountType === 'PERCENTAGE') ? 'PERCENT' : 'FLAT';

        if ($this->isLocalSchema()) {
            $sql = "INSERT INTO coupons (id, code, discount_type, discount_amount, min_booking, max_discount,
                    max_uses_total, max_uses_per_user, description, expiry_date, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())";
            $params = array(
                Security::generateUUID(),
                $code,
                $discountType,
                isset($data['discount']) ? $data['discount'] : 0,
                isset($data['min_order']) ? $data['min_order'] : 0,
                isset($data['max_discount']) ? $data['max_discount'] : null,
                isset($data['max_uses']) ? $data['max_uses'] : null,
                isset($data['max_uses_per_user']) ? $data['max_uses_per_user'] : 1,
                isset($data['description']) ? $data['description'] : '',
                isset($data['expiry']) ? $data['expiry'] : date('Y-m-d'),
                isset($data['is_active']) ? ($data['is_active'] ? 1 : 0) : 1
            );
        } else {
            $sql = "INSERT INTO coupons (id, code, description, discount_type, discount_value, min_order_amount,
                    max_discount, max_uses, max_uses_per_user, valid_until, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
            $params = array(
                Security::generateUUID(),
                $code,
                isset($data['description']) ? $data['description'] : '',
                $discountType === 'PERCENT' ? 'PERCENTAGE' : 'FLAT',
                isset($data['discount']) ? $data['discount'] : 0,
                isset($data['min_order']) ? $data['min_order'] : 0,
                isset($data['max_discount']) ? $data['max_discount'] : null,
                isset($data['max_uses']) ? $data['max_uses'] : null,
                isset($data['max_uses_per_user']) ? $data['max_uses_per_user'] : 1,
                isset($data['expiry']) ? $data['expiry'] : date('Y-m-d'),
                isset($data['is_active']) ? ($data['is_active'] ? 1 : 0) : 1
            );
        }

        try {
            $this->execute($sql, $params);
            return array('success' => true);
        } catch (Exception $e) {
            return array('success' => false, 'error' => 'Coupon code may already exist');
        }
    }

    /**
     * Toggle coupon active status
     */
    public function toggleCoupon($id)
    {
        $sql = "UPDATE coupons SET is_active = IF(is_active = 1, 0, 1) WHERE id = ?";
        return $this->execute($sql, array($id)) > 0;
    }

    /**
     * Delete coupon
     */
    public function deleteCoupon($id)
    {
        return $this->execute("DELETE FROM coupons WHERE id = ?", array($id)) > 0;
    }

    /**
     * Get Offers list (normalized)
     */
    public function getOffers()
    {
        if ($this->isLocalSchema()) {
            $sql = "SELECT id, title, description, discount_tag as tag, image_url, coupon_id,
                    target_audience, is_active, sort_order, start_date, end_date, created_at
                FROM offers
                ORDER BY sort_order ASC, created_at DESC";
        } else {
            $sql = "SELECT id, title, description, NULL as tag, image_url, coupon_id,
                    target_audience, is_active, priority as sort_order, starts_at as start_date, ends_at as end_date, created_at
                FROM offers
                ORDER BY priority ASC, created_at DESC";
        }
        return $this->fetchAll($sql);
    }

    /**
     * Create an offer (schema-aware)
     */
    public function createOffer($data)
    {
        $title = isset($data['title']) ? trim($data['title']) : '';
        if ($title === '') {
            return array('success' => false, 'error' => 'Offer title is required');
        }

        if ($this->isLocalSchema()) {
            $sql = "INSERT INTO offers (id, coupon_id, title, description, discount_tag, bg_gradient, image_url,
                    validity, target_audience, applicable_cities, is_active, sort_order, start_date, end_date, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
            $params = array(
                Security::generateUUID(),
                isset($data['coupon_id']) ? $data['coupon_id'] : null,
                $title,
                isset($data['description']) ? $data['description'] : '',
                isset($data['tag']) ? $data['tag'] : null,
                isset($data['bg_gradient']) ? $data['bg_gradient'] : null,
                isset($data['image_url']) ? $data['image_url'] : null,
                isset($data['validity']) ? $data['validity'] : null,
                isset($data['target_audience']) ? $data['target_audience'] : 'ALL',
                isset($data['applicable_cities']) ? $data['applicable_cities'] : null,
                isset($data['is_active']) ? ($data['is_active'] ? 1 : 0) : 1,
                isset($data['sort_order']) ? $data['sort_order'] : 0,
                isset($data['start_date']) ? $data['start_date'] : null,
                isset($data['end_date']) ? $data['end_date'] : null
            );
        } else {
            $sql = "INSERT INTO offers (id, coupon_id, title, description, image_url, offer_type, target_audience,
                    action_url, priority, is_active, starts_at, ends_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
            $params = array(
                Security::generateUUID(),
                isset($data['coupon_id']) ? $data['coupon_id'] : null,
                $title,
                isset($data['description']) ? $data['description'] : '',
                isset($data['image_url']) ? $data['image_url'] : null,
                isset($data['offer_type']) ? $data['offer_type'] : 'BANNER',
                isset($data['target_audience']) ? $data['target_audience'] : 'ALL',
                isset($data['action_url']) ? $data['action_url'] : null,
                isset($data['sort_order']) ? $data['sort_order'] : 0,
                isset($data['is_active']) ? ($data['is_active'] ? 1 : 0) : 1,
                isset($data['start_date']) ? $data['start_date'] : null,
                isset($data['end_date']) ? $data['end_date'] : null
            );
        }

        $this->execute($sql, $params);
        return array('success' => true);
    }

    /**
     * Toggle offer active status
     */
    public function toggleOffer($id)
    {
        $sql = "UPDATE offers SET is_active = IF(is_active = 1, 0, 1) WHERE id = ?";
        return $this->execute($sql, array($id)) > 0;
    }

    /**
     * Delete offer
     */
    public function deleteOffer($id)
    {
        return $this->execute("DELETE FROM offers WHERE id = ?", array($id)) > 0;
    }

    /**
     * Wallet audit: customer & driver balances, platform commission retained
     */
    public function getWalletAudit()
    {
        $cust = $this->fetchOne("SELECT COALESCE(SUM(balance), 0) as total_balance, COUNT(*) as count
            FROM customer_wallets WHERE is_active = 1");
        $drv = $this->fetchOne("SELECT COALESCE(SUM(balance), 0) as total_balance, COUNT(*) as count
            FROM driver_wallets WHERE is_active = 1");

        $commission = 0;
        if ($this->isLocalSchema()) {
            $commRow = $this->fetchOne("SELECT COALESCE(SUM(total_commission_paid), 0) as commission FROM driver_wallets");
            $commission = (float)$commRow['commission'];
        }

        $custTx = $this->fetchOne("SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as amount FROM customer_wallet_transactions");
        $drvTx = $this->fetchOne("SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as amount FROM driver_wallet_transactions");

        $customerWallets = $this->fetchAll("SELECT w.id, w.customer_id, w.balance, w.is_active, w.updated_at,
                c.name as customer_name, c.phone as customer_phone
            FROM customer_wallets w
            LEFT JOIN customers c ON c.id = w.customer_id
            ORDER BY w.balance DESC LIMIT 100");

        $driverWallets = $this->fetchAll("SELECT w.id, w.driver_id, w.balance, w.is_active, w.updated_at,
                d.name as driver_name, d.phone as driver_phone
            FROM driver_wallets w
            LEFT JOIN drivers d ON d.id = w.driver_id
            ORDER BY w.balance DESC LIMIT 100");

        return array(
            'total_customer_balance'   => (float)$cust['total_balance'],
            'customer_wallet_count'    => (int)$cust['count'],
            'total_driver_balance'     => (float)$drv['total_balance'],
            'driver_wallet_count'      => (int)$drv['count'],
            'platform_commission'      => $commission,
            'customer_tx_count'        => (int)$custTx['c'],
            'customer_tx_amount'       => (float)$custTx['amount'],
            'driver_tx_count'          => (int)$drvTx['c'],
            'driver_tx_amount'         => (float)$drvTx['amount'],
            'customer_wallets'         => $customerWallets,
            'driver_wallets'           => $driverWallets
        );
    }

    /**
     * Get Payment rows (normalized status/method across schemas)
     */
    public function getPayments($limit = 50, $offset = 0, $search = '')
    {
        $searchClause = '';
        $params = array();
        if (!empty($search)) {
            $searchClause = "WHERE p.gateway_txn_id LIKE ? OR c.name LIKE ? OR c.phone LIKE ?";
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
        }

        if ($this->isLocalSchema()) {
            $sql = "SELECT p.id, p.booking_id, p.customer_id, p.method, p.status, p.amount,
                    p.gateway_txn_id, p.paid_at, p.created_at,
                    c.name as customer_name, c.phone as customer_phone,
                    d.name as driver_name
                FROM payments p
                LEFT JOIN customers c ON c.id = p.customer_id
                LEFT JOIN bookings b ON b.id = p.booking_id
                LEFT JOIN drivers d ON d.id = b.driver_id
                $searchClause
                ORDER BY p.created_at DESC
                LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
        } else {
            $sql = "SELECT p.id, p.booking_id, p.customer_id, p.method, p.status, p.amount,
                    p.gateway_txn_id, NULL as paid_at, p.created_at,
                    c.name as customer_name, c.phone as customer_phone,
                    d.name as driver_name
                FROM payments p
                LEFT JOIN customers c ON c.id = p.customer_id
                LEFT JOIN drivers d ON d.id = p.driver_id
                $searchClause
                ORDER BY p.created_at DESC
                LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
        }

        $rows = $this->fetchAll($sql, $params);
        $statusMap = array('INITIATED' => 'PENDING', 'SUCCESS' => 'COMPLETED', 'FAILED' => 'FAILED', 'REFUNDED' => 'REFUNDED',
            'PENDING' => 'PENDING', 'COMPLETED' => 'COMPLETED');
        foreach ($rows as &$row) {
            $row['status'] = isset($statusMap[$row['status']]) ? $statusMap[$row['status']] : $row['status'];
        }
        unset($row);

        $countRow = $this->fetchOne("SELECT COUNT(*) as c FROM payments p
            LEFT JOIN customers c ON c.id = p.customer_id $searchClause", $params);

        return array('payments' => $rows, 'total' => (int)$countRow['c'], 'limit' => $limit, 'offset' => $offset);
    }

    /**
     * Get SOS alerts (normalized across schemas)
     */
    public function getSosAlerts($limit = 50, $status = '')
    {
        $statusClause = '';
        $params = array();
        if (!empty($status)) {
            $statusClause = "WHERE s.status = ?";
            $params[] = $status;
        }

        if ($this->isLocalSchema()) {
            $sql = "SELECT s.id, s.booking_id, s.triggered_by, s.triggered_user_id, s.lat, s.lng,
                    s.status, s.resolution_notes as notes, s.resolved_at, s.created_at,
                    cu.name as customer_name, cu.phone as customer_phone,
                    dr.name as driver_name, dr.phone as driver_phone
                FROM sos_alerts s
                LEFT JOIN bookings b ON b.id = s.booking_id
                LEFT JOIN customers cu ON cu.id = s.triggered_user_id AND s.triggered_by = 'CUSTOMER'
                LEFT JOIN drivers dr ON dr.id = s.triggered_user_id AND s.triggered_by = 'DRIVER'
                $statusClause
                ORDER BY FIELD(s.status, 'ACTIVE', 'ESCALATED') DESC, s.created_at DESC
                LIMIT " . (int)$limit;
        } else {
            $sql = "SELECT s.id, s.booking_id, s.triggered_by, s.triggered_by_id as triggered_user_id, s.lat, s.lng,
                    s.status, s.notes, s.resolved_at, s.created_at,
                    cu.name as customer_name, cu.phone as customer_phone,
                    dr.name as driver_name, dr.phone as driver_phone
                FROM sos_alerts s
                LEFT JOIN bookings b ON b.id = s.booking_id
                LEFT JOIN customers cu ON cu.id = s.triggered_by_id AND s.triggered_by = 'CUSTOMER'
                LEFT JOIN drivers dr ON dr.id = s.triggered_by_id AND s.triggered_by = 'DRIVER'
                $statusClause
                ORDER BY FIELD(s.status, 'ACTIVE') DESC, s.created_at DESC
                LIMIT " . (int)$limit;
        }

        return $this->fetchAll($sql, $params);
    }

    /**
     * Resolve a SOS alert
     */
    public function resolveSos($id, $status, $adminId, $notes)
    {
        if (!in_array($status, array('RESOLVED', 'FALSE_ALARM'), true)) {
            return false;
        }
        if ($this->isLocalSchema()) {
            $sql = "UPDATE sos_alerts SET status = ?, resolved_by = ?, resolution_notes = ?, resolved_at = NOW()
                WHERE id = ?";
            return $this->execute($sql, array($status, $adminId, $notes, $id)) > 0;
        }
        $sql = "UPDATE sos_alerts SET status = ?, notes = ?, resolved_at = NOW() WHERE id = ?";
        return $this->execute($sql, array($status, $notes, $id)) > 0;
    }

    /**
     * Get support tickets (normalized across schemas)
     */
    public function getSupportTickets($limit = 50, $status = '', $search = '')
    {
        $whereParts = array('1=1');
        $params = array();
        if (!empty($status)) {
            $whereParts[] = 't.status = ?';
            $params[] = $status;
        }
        if (!empty($search)) {
            $whereParts[] = '(t.subject LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR d.name LIKE ?)';
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
        }
        $whereClause = implode(' AND ', $whereParts);

        $sql = "SELECT t.id, t.user_id, t.user_type, t.booking_id, t.subject, t.status, t.priority, t.created_at,
                COALESCE(c.name, d.name, 'Unknown') as user_name,
                COALESCE(c.phone, d.phone) as user_phone
            FROM support_tickets t
            LEFT JOIN customers c ON c.id = t.user_id AND t.user_type = 'CUSTOMER'
            LEFT JOIN drivers d ON d.id = t.user_id AND t.user_type = 'DRIVER'
            WHERE $whereClause
            ORDER BY FIELD(t.status, 'OPEN', 'IN_PROGRESS') DESC, t.created_at DESC
            LIMIT " . (int)$limit;

        $rows = $this->fetchAll($sql, $params);
        $totalRow = $this->fetchOne("SELECT COUNT(*) as c FROM support_tickets t
            LEFT JOIN customers c ON c.id = t.user_id AND t.user_type = 'CUSTOMER'
            LEFT JOIN drivers d ON d.id = t.user_id AND t.user_type = 'DRIVER'
            WHERE $whereClause", $params);

        return array('tickets' => $rows, 'total' => (int)$totalRow['c'], 'limit' => $limit);
    }

    /**
     * Get replies for a support ticket
     */
    public function getSupportTicketReplies($ticketId)
    {
        return $this->fetchAll("SELECT id, ticket_id, sender_type, sender_id, message, created_at
            FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC", array($ticketId));
    }

    /**
     * Update support ticket status
     */
    public function updateSupportTicketStatus($id, $status)
    {
        if (!in_array($status, array('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'), true)) {
            return false;
        }
        if ($this->isLocalSchema()) {
            $extra = ($status === 'RESOLVED') ? ", resolved_at = NOW()" : "";
            $sql = "UPDATE support_tickets SET status = ? {$extra}, updated_at = NOW() WHERE id = ?";
        } else {
            $sql = "UPDATE support_tickets SET status = ?, updated_at = NOW() WHERE id = ?";
        }
        return $this->execute($sql, array($status, $id)) > 0;
    }

    /**
     * Reply to a support ticket as admin
     */
    public function replySupportTicket($ticketId, $message, $adminId)
    {
        $ticket = $this->fetchOne("SELECT id, status FROM support_tickets WHERE id = ?", array($ticketId));
        if (!$ticket) {
            return array('success' => false, 'error' => 'Ticket not found');
        }
        if (trim($message) === '') {
            return array('success' => false, 'error' => 'Reply message cannot be empty');
        }
        $this->execute("INSERT INTO support_messages (id, ticket_id, sender_type, sender_id, message, created_at)
            VALUES (?, ?, 'ADMIN', ?, ?, NOW())",
            array(Security::generateUUID(), $ticketId, $adminId, $message));

        if ($ticket['status'] === 'OPEN') {
            $this->execute("UPDATE support_tickets SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = ?", array($ticketId));
        }
        return array('success' => true);
    }

    /**
     * Get recent notifications (broadcasts & system)
     */
    public function getNotifications($limit = 50)
    {
        return $this->fetchAll("SELECT id, user_id, user_type, title, message, type, is_read, audience, created_at
            FROM notifications ORDER BY created_at DESC LIMIT " . (int)$limit);
    }

    /**
     * Broadcast a notification to an audience (type SYSTEM works in both schemas)
     */
    public function broadcastNotification($title, $message, $audience)
    {
        if (!in_array($audience, array('ALL', 'CUSTOMERS', 'DRIVERS'), true)) {
            $audience = 'ALL';
        }
        $this->execute("INSERT INTO notifications (id, user_id, user_type, title, message, type, is_read, audience, created_at)
            VALUES (?, NULL, NULL, ?, ?, 'SYSTEM', 0, ?, NOW())",
            array(Security::generateUUID(), $title, $message, $audience));
        return true;
    }

    /**
     * Get system settings (idempotently creates table since it is not in the base dump)
     */
    public function getSystemSettings()
    {
        $this->ensureSettingsTable();
        $rows = $this->fetchAll("SELECT k, v FROM system_settings");
        $settings = array('platform_commission' => '15', 'sos_number' => '112');
        foreach ($rows as $row) {
            $settings[$row['k']] = $row['v'];
        }
        return $settings;
    }

    /**
     * Save system settings
     */
    public function saveSystemSettings($settings)
    {
        $this->ensureSettingsTable();
        foreach ($settings as $key => $value) {
            $this->execute(
                "INSERT INTO system_settings (k, v, updated_at) VALUES (?, ?, NOW())
                 ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = NOW()",
                array($key, (string)$value)
            );
        }
        return true;
    }

    private function ensureSettingsTable()
    {
        $this->execute("CREATE TABLE IF NOT EXISTS system_settings (
            k varchar(100) NOT NULL PRIMARY KEY,
            v text,
            updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }
}
