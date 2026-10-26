<?php
/**
 * RedTaxi Backend - Administrator Controller
 * Handles Admin operations: Dashboard stats, Customer management,
 * Driver verification, Fleet/Vehicle management, Booking dispatch & assignments,
 * and Fare rule modifications.
 * Compatible with PHP 5.6+.
 */

require_once __DIR__ . '/BaseController.php';
require_once dirname(__DIR__) . '/models/AdminModel.php';
require_once dirname(__DIR__) . '/middleware/AuthMiddleware.php';
require_once dirname(__DIR__) . '/utils/Response.php';

class AdminController extends BaseController
{
    private $adminModel;

    public function __construct()
    {
        $this->adminModel = new AdminModel();
    }

    private function resolveId($param)
    {
        if (is_array($param) && isset($param['id'])) {
            return $param['id'];
        }
        return $param;
    }

    /**
     * GET /api/v1/admin/dashboard
     * Returns comprehensive platform KPIs, counts, and recent bookings.
     */
    public function getDashboard()
    {
        AuthMiddleware::requireAdmin();
        $stats = $this->adminModel->getDashboardStats();
        Response::success($stats, 'Dashboard statistics loaded successfully');
    }

    /**
     * GET /api/v1/admin/customers
     * Returns list of registered customers with wallet and ride counts.
     */
    public function getCustomers()
    {
        AuthMiddleware::requireAdmin();

        $limit  = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';

        $data = $this->adminModel->getCustomers($limit, $offset, $search);
        Response::success($data);
    }

    /**
     * PATCH /api/v1/admin/customers/{id}/status
     * Updates customer account status (e.g. ACTIVE, BLOCKED).
     */
    public function updateCustomerStatus($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);

        $input = $this->getJsonInput();
        $this->requireFields($input, array('status'));

        $status = strtoupper(trim($input['status']));
        if (!in_array($status, array('ACTIVE', 'BLOCKED', 'DELETED'), true)) {
            Response::unprocessableEntity("Invalid customer status '{$status}'. Allowed values: ACTIVE, BLOCKED, DELETED", array('status' => 'Must be ACTIVE, BLOCKED, or DELETED'));
        }

        $updated = $this->adminModel->updateCustomerStatus($id, $status);

        if (!$updated) {
            Response::badRequest('Failed to update customer status or customer ID not found');
        }

        Response::success(array('id' => $id, 'status' => $status), "Customer account status set to {$status}");
    }

    /**
     * DELETE /api/v1/admin/customers/{id}
     * Permanently or soft deletes a customer account.
     */
    public function deleteCustomer($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);

        $this->adminModel->deleteCustomer($id);
        Response::success(array('id' => $id, 'deleted' => true), 'Customer account deleted successfully');
    }

    /**
     * DELETE /api/v1/admin/drivers/{id}
     * Permanently or soft deletes a driver partner account.
     */
    public function deleteDriver($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);

        $this->adminModel->deleteDriver($id);
        Response::success(array('id' => $id, 'deleted' => true), 'Driver account deleted successfully');
    }

    /**
     * GET /api/v1/admin/drivers
     * Returns list of registered drivers with vehicle details and approval statuses.
     */
    public function getDrivers()
    {
        AuthMiddleware::requireAdmin();

        $limit          = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset         = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        $approvalStatus = isset($_GET['approval_status']) ? trim($_GET['approval_status']) : '';
        $search         = isset($_GET['search']) ? trim($_GET['search']) : '';

        $data = $this->adminModel->getDrivers($limit, $offset, $approvalStatus, $search);
        Response::success($data);
    }

    /**
     * PATCH /api/v1/admin/drivers/{id}/approval
     * Updates driver partner verification status (APPROVED, REJECTED, SUSPENDED, PENDING).
     */
    public function updateDriverApproval($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);

        $input = $this->getJsonInput();
        $this->requireFields($input, array('approval_status'));

        $status = strtoupper(trim($input['approval_status']));
        if (!in_array($status, array('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'), true)) {
            Response::unprocessableEntity("Invalid driver approval status '{$status}'. Allowed values: PENDING, APPROVED, REJECTED, SUSPENDED", array('approval_status' => 'Must be PENDING, APPROVED, REJECTED, or SUSPENDED'));
        }

        $updated = $this->adminModel->updateDriverApproval($id, $status);

        if (!$updated) {
            Response::badRequest('Failed to update driver approval status. Driver ID not found.');
        }

        Response::success(array('id' => $id, 'approval_status' => $status), "Driver verification status updated to {$status}");
    }

    /**
     * PATCH /api/v1/admin/drivers/{id}/status
     * Toggles or updates driver online status.
     */
    public function updateDriverStatus($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);

        $input = $this->getJsonInput();
        $isOnline = isset($input['is_online']) ? (bool)$input['is_online'] : false;

        $updated = $this->adminModel->updateDriverStatus($id, $isOnline ? 1 : 0);
        Response::success(array('id' => $id, 'is_online' => $isOnline), "Driver online status updated");
    }

    /**
     * POST /api/v1/admin/drivers/{id}/remind-recharge
     * Sends a low balance recharge reminder notification to a driver.
     */
    public function sendRechargeReminder($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);

        $driver = $this->adminModel->getDriverDetail($id);
        if (!$driver) {
            Response::notFound('Driver not found');
        }

        $wallet = $this->adminModel->fetchOne("SELECT balance FROM driver_wallets WHERE driver_id = ?", array($id));
        $balance = $wallet ? (float)$wallet['balance'] : 0.0;

        $notifType = 'PAYMENT';
        $this->adminModel->execute(
            "INSERT INTO notifications (id, user_id, user_type, title, message, type, is_read, audience, created_at)
             VALUES (?, ?, 'DRIVER', 'Low Wallet Balance - Recharge Required', 'Your prepaid wallet balance is ₹" . number_format($balance, 2) . ". Please recharge your wallet to receive and accept new ride requests.', '$notifType', 0, 'INDIVIDUAL', NOW())",
            array(Security::generateUUID(), $id)
        );

        Response::success(array('driver_id' => $id, 'balance' => $balance), 'Recharge reminder notification sent to driver successfully');
    }

    /**
     * GET /api/v1/admin/vehicles
     * Returns vehicle categories and fleet statistics.
     */
    public function getVehicles()
    {
        AuthMiddleware::requireAdmin();
        $categories = $this->adminModel->getVehicleCategories();
        Response::success(array('categories' => $categories));
    }

    /**
     * PUT /api/v1/admin/vehicles/{id}
     * Updates vehicle category parameters (base price, per km, capacity, tagline).
     */
    public function updateVehicleCategory($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);

        $input = $this->getJsonInput();
        $this->requireFields($input, array('base_price', 'per_km_rate', 'capacity'));

        $updated = $this->adminModel->updateVehicleCategory($id, $input);
        if (!$updated) {
            Response::badRequest('Failed to update vehicle category');
        }

        Response::success(array('id' => $id), 'Vehicle category updated successfully');
    }

    /**
     * PATCH /api/v1/admin/vehicles/{id}/toggle
     * Enables or disables a vehicle category for rider bookings.
     */
    public function toggleVehicleCategory($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);

        $category = $this->adminModel->toggleVehicleCategory($id);
        if (!$category) {
            Response::notFound('Vehicle category not found');
        }

        Response::success($category, "Vehicle category status changed to " . ($category['is_active'] ? 'active' : 'inactive'));
    }

    /**
     * GET /api/v1/admin/bookings
     * Returns all platform bookings with customer and driver details.
     */
    public function getBookings()
    {
        AuthMiddleware::requireAdmin();

        $limit  = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        $status = isset($_GET['status']) ? trim($_GET['status']) : '';
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';

        $data = $this->adminModel->getBookings($limit, $offset, $status, $search);
        Response::success($data);
    }

    /**
     * GET /api/v1/admin/ratings
     * Returns all ride ratings with customer and driver details.
     */
    public function getRatings()
    {
        AuthMiddleware::requireAdmin();

        $limit  = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

        $data = $this->adminModel->getRatings($limit, $offset);
        Response::success($data);
    }

    /**
     * GET /api/v1/admin/bookings/{id}
     * Returns full details of a specific ride booking.
     */
    public function getBookingDetail($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);

        $booking = $this->adminModel->getBookingDetail($id);
        if (!$booking) {
            Response::notFound('Booking not found');
        }

        Response::success($booking);
    }

    /**
     * POST /api/v1/admin/bookings/{id}/assign
     * Manually assigns an approved driver to a booking.
     */
    public function assignDriver($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);

        $input = $this->getJsonInput();
        $this->requireFields($input, array('driver_id'));

        $driverId = trim($input['driver_id']);
        $result = $this->adminModel->assignDriver($id, $driverId);

        if (!$result['success']) {
            Response::badRequest($result['error']);
        }

        Response::success($result['booking'], "Driver assigned successfully to booking #" . substr($id, 0, 8));
    }

    /**
     * PATCH /api/v1/admin/bookings/{id}/status
     * Manually updates a booking status (e.g. COMPLETED, CANCELLED).
     */
    public function updateBookingStatus($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);

        $input = $this->getJsonInput();
        $this->requireFields($input, array('status'));

        $status = strtoupper(trim($input['status']));
        $validStatuses = array('SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SCHEDULED');
        if (!in_array($status, $validStatuses, true)) {
            Response::unprocessableEntity("Invalid booking status '{$status}'. Allowed: " . implode(', ', $validStatuses), array('status' => 'Invalid booking status'));
        }

        $updated = $this->adminModel->updateBookingStatus($id, $status);

        if (!$updated) {
            Response::badRequest('Failed to update booking status. Booking ID not found.');
        }

        Response::success(array('id' => $id, 'status' => $status), "Booking status updated to {$status}");
    }

    /**
     * GET /api/v1/admin/fare-rules
     * Returns all configured fare rules with category metadata.
     */
    public function getFareRules()
    {
        AuthMiddleware::requireAdmin();
        $rules = $this->adminModel->getFareRules();
        Response::success(array('fare_rules' => $rules));
    }

    /**
     * PUT /api/v1/admin/fare-rules/{id}
     * Updates fare pricing calculation parameters.
     */
    public function updateFareRule($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);

        $input = $this->getJsonInput();
        $this->requireFields($input, array('base_fare', 'per_km'));

        $errors = array();
        if (!is_numeric($input['base_fare']) || (float)$input['base_fare'] < 0) {
            $errors['base_fare'] = 'Base fare must be a non-negative number';
        }

        if (!is_numeric($input['per_km']) || (float)$input['per_km'] < 0) {
            $errors['per_km'] = 'Per KM rate must be a non-negative number';
        }

        if (isset($input['platform_fee']) && (!is_numeric($input['platform_fee']) || (float)$input['platform_fee'] < 0)) {
            $errors['platform_fee'] = 'Platform fee must be a non-negative number';
        }

        if (isset($input['tax_percent']) && (!is_numeric($input['tax_percent']) || (float)$input['tax_percent'] < 0 || (float)$input['tax_percent'] > 100)) {
            $errors['tax_percent'] = 'Tax percent must be a percentage between 0 and 100';
        }

        if (isset($input['cancellation_fee']) && (!is_numeric($input['cancellation_fee']) || (float)$input['cancellation_fee'] < 0)) {
            $errors['cancellation_fee'] = 'Cancellation fee must be a non-negative number';
        }

        if (!empty($errors)) {
            Response::unprocessableEntity('Validation failed. Please correct the highlighted errors.', $errors);
        }

        $updated = $this->adminModel->updateFareRule($id, $input);
        if (!$updated) {
            Response::badRequest('Failed to update fare rule or invalid rule ID');
        }

        Response::success(array('id' => $id), 'Fare rule updated successfully');
    }

    /**
     * GET /api/v1/admin/partner-vehicles
     * Returns list of partner driver vehicles with plate numbers, models, and driver info.
     */
    public function getPartnerVehicles()
    {
        AuthMiddleware::requireAdmin();

        $limit  = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';

        $data = $this->adminModel->getPartnerVehicles($limit, $offset, $search);
        Response::success($data);
    }

    /**
     * GET /api/v1/admin/coupons
     * Returns list of discount coupons.
     */
    public function getCoupons()
    {
        AuthMiddleware::requireAdmin();
        $limit  = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $data = $this->adminModel->getCoupons($limit, $offset, $search);
        Response::success($data);
    }

    /**
     * POST /api/v1/admin/coupons
     * Creates a new discount coupon.
     */
    public function createCoupon()
    {
        AuthMiddleware::requireAdmin();
        $input = $this->getJsonInput();
        $this->requireFields($input, array('code', 'discount_type', 'discount'));
        $result = $this->adminModel->createCoupon($input);
        if (!$result['success']) {
            Response::badRequest($result['error']);
        }
        Response::success(array(), 'Coupon created successfully');
    }

    /**
     * PATCH /api/v1/admin/coupons/{id}/toggle
     * Toggles coupon active status.
     */
    public function toggleCoupon($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);
        $updated = $this->adminModel->toggleCoupon($id);
        if (!$updated) {
            Response::notFound('Coupon not found');
        }
        Response::success(array('id' => $id), 'Coupon status toggled successfully');
    }

    /**
     * DELETE /api/v1/admin/coupons/{id}
     * Deletes a coupon.
     */
    public function deleteCoupon($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);
        $deleted = $this->adminModel->deleteCoupon($id);
        if (!$deleted) {
            Response::notFound('Coupon not found');
        }
        Response::success(array('id' => $id), 'Coupon deleted successfully');
    }

    /**
     * GET /api/v1/admin/offers
     * Returns list of promotional offers/banners.
     */
    public function getOffers()
    {
        AuthMiddleware::requireAdmin();
        $offers = $this->adminModel->getOffers();
        Response::success(array('offers' => $offers));
    }

    /**
     * POST /api/v1/admin/offers
     * Creates a promotional offer.
     */
    public function createOffer()
    {
        AuthMiddleware::requireAdmin();
        $input = $this->getJsonInput();
        $this->requireFields($input, array('title'));
        $result = $this->adminModel->createOffer($input);
        if (!$result['success']) {
            Response::badRequest($result['error']);
        }
        Response::success(array(), 'Offer created successfully');
    }

    /**
     * PATCH /api/v1/admin/offers/{id}/toggle
     * Toggles offer active status.
     */
    public function toggleOffer($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);
        $updated = $this->adminModel->toggleOffer($id);
        if (!$updated) {
            Response::notFound('Offer not found');
        }
        Response::success(array('id' => $id), 'Offer status toggled successfully');
    }

    /**
     * DELETE /api/v1/admin/offers/{id}
     * Deletes an offer.
     */
    public function deleteOffer($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);
        $deleted = $this->adminModel->deleteOffer($id);
        if (!$deleted) {
            Response::notFound('Offer not found');
        }
        Response::success(array('id' => $id), 'Offer deleted successfully');
    }

    /**
     * GET /api/v1/admin/wallets
     * Returns wallet audit: customer & driver balances, platform commission.
     */
    public function getWalletAudit()
    {
        AuthMiddleware::requireAdmin();
        $data = $this->adminModel->getWalletAudit();
        Response::success($data);
    }

    /**
     * GET /api/v1/admin/payments
     * Returns list of payment transactions.
     */
    public function getPayments()
    {
        AuthMiddleware::requireAdmin();
        $limit  = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $data = $this->adminModel->getPayments($limit, $offset, $search);
        Response::success($data);
    }

    /**
     * GET /api/v1/admin/sos-alerts
     * Returns list of SOS alerts (active first).
     */
    public function getSosAlerts()
    {
        AuthMiddleware::requireAdmin();
        $limit  = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $status = isset($_GET['status']) ? trim($_GET['status']) : '';
        $data = $this->adminModel->getSosAlerts($limit, $status);
        Response::success($data);
    }

    /**
     * PATCH /api/v1/admin/sos-alerts/{id}/resolve
     * Resolves a SOS alert as RESOLVED or FALSE_ALARM.
     */
    public function resolveSos($id)
    {
        AuthMiddleware::requireAdmin();
        $adminPayload = AuthMiddleware::getAuthenticatedUser();
        $adminId = isset($adminPayload['sub']) ? $adminPayload['sub'] : (isset($adminPayload['id']) ? $adminPayload['id'] : null);
        $id = $this->resolveId($id);

        $input = $this->getJsonInput();
        $status = isset($input['status']) ? strtoupper(trim($input['status'])) : 'RESOLVED';
        if (!in_array($status, array('RESOLVED', 'FALSE_ALARM'), true)) {
            Response::unprocessableEntity("Invalid SOS status '{$status}'. Allowed: RESOLVED, FALSE_ALARM");
        }
        $notes = isset($input['notes']) ? trim($input['notes']) : '';

        $updated = $this->adminModel->resolveSos($id, $status, $adminId, $notes);
        if (!$updated) {
            Response::notFound('SOS alert not found');
        }
        Response::success(array('id' => $id, 'status' => $status), 'SOS alert updated successfully');
    }

    /**
     * GET /api/v1/admin/support-tickets
     * Returns list of support tickets.
     */
    public function getSupportTickets()
    {
        AuthMiddleware::requireAdmin();
        $limit  = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $status = isset($_GET['status']) ? trim($_GET['status']) : '';
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $data = $this->adminModel->getSupportTickets($limit, $status, $search);
        Response::success($data);
    }

    /**
     * GET /api/v1/admin/support-tickets/{id}/messages
     * Returns conversation history for a support ticket.
     */
    public function getSupportTicketMessages($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);
        $messages = $this->adminModel->getSupportTicketReplies($id);
        Response::success(array('messages' => $messages));
    }

    /**
     * PATCH /api/v1/admin/support-tickets/{id}/status
     * Updates support ticket status.
     */
    public function updateSupportTicketStatus($id)
    {
        AuthMiddleware::requireAdmin();
        $id = $this->resolveId($id);
        $input = $this->getJsonInput();
        $this->requireFields($input, array('status'));
        $status = strtoupper(trim($input['status']));
        if (!in_array($status, array('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'), true)) {
            Response::unprocessableEntity("Invalid ticket status '{$status}'. Allowed: OPEN, IN_PROGRESS, RESOLVED, CLOSED");
        }
        $updated = $this->adminModel->updateSupportTicketStatus($id, $status);
        if (!$updated) {
            Response::notFound('Support ticket not found');
        }
        Response::success(array('id' => $id, 'status' => $status), 'Support ticket updated successfully');
    }

    /**
     * POST /api/v1/admin/support-tickets/{id}/reply
     * Replies to a support ticket as admin.
     */
    public function replySupportTicket($id)
    {
        AuthMiddleware::requireAdmin();
        $adminPayload = AuthMiddleware::getAuthenticatedUser();
        $adminId = isset($adminPayload['sub']) ? $adminPayload['sub'] : (isset($adminPayload['id']) ? $adminPayload['id'] : null);
        $id = $this->resolveId($id);

        $input = $this->getJsonInput();
        $this->requireFields($input, array('message'));
        $result = $this->adminModel->replySupportTicket($id, $input['message'], $adminId);
        if (!$result['success']) {
            Response::badRequest($result['error']);
        }
        Response::success(array('id' => $id), 'Reply sent successfully');
    }

    /**
     * GET /api/v1/admin/notifications
     * Returns recent notifications.
     */
    public function getNotifications()
    {
        AuthMiddleware::requireAdmin();
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $data = $this->adminModel->getNotifications($limit);
        Response::success(array('notifications' => $data));
    }

    /**
     * POST /api/v1/admin/notifications/broadcast
     * Broadcasts a notification to customers, drivers, or everyone.
     */
    public function broadcastNotification()
    {
        AuthMiddleware::requireAdmin();
        $input = $this->getJsonInput();
        $this->requireFields($input, array('title', 'message'));
        $audience = isset($input['audience']) ? strtoupper(trim($input['audience'])) : 'ALL';
        if (!in_array($audience, array('ALL', 'CUSTOMERS', 'DRIVERS'), true)) {
            Response::unprocessableEntity("Invalid audience '{$audience}'. Allowed: ALL, CUSTOMERS, DRIVERS");
        }
        $this->adminModel->broadcastNotification($input['title'], $input['message'], $audience);
        Response::success(array(), 'Notification broadcast sent successfully');
    }

    /**
     * GET /api/v1/admin/settings
     * Returns platform settings.
     */
    public function getSettings()
    {
        AuthMiddleware::requireAdmin();
        $settings = $this->adminModel->getSystemSettings();
        Response::success($settings);
    }

    /**
     * PUT /api/v1/admin/settings
     * Saves platform settings.
     */
    public function saveSettings()
    {
        AuthMiddleware::requireAdmin();
        $input = $this->getJsonInput();
        if (empty($input)) {
            Response::badRequest('No settings provided');
        }
        $this->adminModel->saveSystemSettings($input);
        Response::success(array(), 'Settings saved successfully');
    }
}
