<?php
/**
 * RedTaxi Backend - Driver Controller
 * Handles Driver Profile, Vehicle Details, Online/Offline GPS Status,
 * Available Rides, Accept/Reject, Active Trip State Transitions (ARRIVED, STARTED, COMPLETED),
 * Ride History, Earnings Ledger, Notifications, and Documents.
 * Compatible with PHP 5.6+.
 */

require_once __DIR__ . '/BaseController.php';
require_once dirname(__DIR__) . '/models/DriverModel.php';
require_once dirname(__DIR__) . '/middleware/AuthMiddleware.php';
require_once dirname(__DIR__) . '/utils/Response.php';

class DriverController extends BaseController
{
    private $driverModel;

    public function __construct()
    {
        $this->driverModel = new DriverModel();
    }

    private function requireAuthDriverId()
    {
        $user = AuthMiddleware::requireDriver();
        return $user['sub'];
    }

    // =============================================================
    // 1. Get Driver Profile
    // GET /api/v1/driver/profile
    // =============================================================
    public function getProfile()
    {
        $driverId = $this->requireAuthDriverId();
        $driver = $this->driverModel->findById($driverId);

        if (!$driver) {
            Response::notFound('Driver partner profile not found');
        }

        unset($driver['password_hash']);
        Response::success($driver, 'Driver profile retrieved');
    }

    // =============================================================
    // 2. Update Driver Profile
    // PUT /api/v1/driver/profile
    // =============================================================
    public function updateProfile()
    {
        $driverId = $this->requireAuthDriverId();
        $input = $this->getJsonInput();

        $updateData = array();
        $errors = array();

        if (isset($input['name'])) {
            $name = trim($input['name']);
            if (strlen($name) < 2 || strlen($name) > 100) {
                $errors['name'] = 'Name must be between 2 and 100 characters';
            }
            $updateData['name'] = $name;
        }

        if (isset($input['email'])) {
            $email = trim($input['email']);
            if (!empty($email)) {
                if (!$this->validateEmail($email)) {
                    $errors['email'] = 'Invalid email address format';
                } else {
                    $existing = $this->driverModel->findByEmail($email);
                    if ($existing && $existing['id'] !== $driverId) {
                        Response::conflict('This email is already registered to another driver partner');
                    }
                    $updateData['email'] = $email;
                }
            } else {
                $updateData['email'] = null;
            }
        }

        if (!empty($errors)) {
            Response::badRequest('Validation failed. Please correct the highlighted errors.', $errors);
        }

        if (isset($input['photo_url']) || isset($input['avatar_url']) || isset($input['photo'])) {
            $raw = isset($input['photo_url']) ? $input['photo_url'] : (isset($input['avatar_url']) ? $input['avatar_url'] : $input['photo']);
            $photoInput = is_string($raw) ? trim($raw) : '';
            if ($photoInput === '') {
                $updateData['photo_url'] = null;
                $updateData['avatar_url'] = null;
            } elseif (preg_match('#^data:image/(\w+);base64,(.+)$#', $photoInput, $matches)) {
                $ext = strtolower($matches[1]);
                if ($ext === 'jpeg') $ext = 'jpg';
                $data = base64_decode($matches[2]);
                $filename = 'drv_' . substr($driverId, 0, 8) . '_' . time() . '.' . $ext;
                $dir = __DIR__ . '/../uploads/profiles';
                if (!file_exists($dir)) @mkdir($dir, 0777, true);
                $filePath = $dir . '/' . $filename;
                if (@file_put_contents($filePath, $data)) {
                    $updateData['photo_url'] = '/uploads/profiles/' . $filename;
                    $updateData['avatar_url'] = '/uploads/profiles/' . $filename;
                } else {
                    $updateData['photo_url'] = $photoInput;
                    $updateData['avatar_url'] = $photoInput;
                }
            } else {
                $updateData['photo_url'] = $photoInput;
                $updateData['avatar_url'] = $photoInput;
            }
        }

        if (isset($input['city_id'])) {
            $updateData['city_id'] = (int)$input['city_id'];
        }

        if (empty($updateData)) {
            Response::badRequest('No profile fields provided for update');
        }

        $updated = $this->driverModel->updateProfile($driverId, $updateData);
        unset($updated['password_hash']);

        Response::success($updated, 'Driver profile updated successfully');
    }

    // =============================================================
    // 3. Get Driver Vehicle Details
    // GET /api/v1/driver/vehicle or GET /api/v1/driver/vehicles
    // =============================================================
    public function getVehicle()
    {
        $driverId = $this->requireAuthDriverId();
        $vehicles = $this->driverModel->getVehicles($driverId);
        $activeVehicle = $this->driverModel->getActiveVehicle($driverId);

        $data = array(
            'active_vehicle' => $activeVehicle,
            'all_vehicles'   => $vehicles
        );

        Response::success($data, 'Driver vehicle details retrieved');
    }

    // =============================================================
    // 4. Update Driver Vehicle Details
    // PUT /api/v1/driver/vehicles/{id} or PUT /api/v1/driver/vehicle
    // =============================================================
    public function updateVehicle($params)
    {
        $driverId = $this->requireAuthDriverId();
        $vehicleId = isset($params['id']) ? $params['id'] : null;

        // If no ID in route, try to get the active vehicle ID
        if (empty($vehicleId)) {
            $active = $this->driverModel->getActiveVehicle($driverId);
            if ($active) {
                $vehicleId = $active['id'];
            } else {
                Response::notFound('No active vehicle found for driver');
            }
        }

        $input = $this->getJsonInput();

        $updated = $this->driverModel->updateVehicle($driverId, $vehicleId, $input);
        if (!$updated) {
            Response::notFound('Vehicle not found or does not belong to driver');
        }

        Response::success($updated, 'Vehicle details updated successfully');
    }

    // =============================================================
    // 5. Driver Online/Offline Status & GPS
    // PATCH /api/v1/driver/status
    // =============================================================
    public function updateStatus()
    {
        $driverId = $this->requireAuthDriverId();
        $input = $this->getJsonInput();

        $isOnline = isset($input['is_online']) ? (bool)$input['is_online'] : false;
        $lat = isset($input['lat']) ? $input['lat'] : null;
        $lng = isset($input['lng']) ? $input['lng'] : null;
        $heading = isset($input['heading']) ? $input['heading'] : null;
        $speed = isset($input['speed']) ? $input['speed'] : null;
        $accuracy = isset($input['accuracy']) ? $input['accuracy'] : null;

        if ($lat !== null || $lng !== null) {
            if (!$this->validateCoordinates($lat, $lng)) {
                Response::unprocessableEntity('Coordinates must be valid numbers (lat: -90 to 90, lng: -180 to 180)', array('coordinates' => 'Must be valid lat/lng'));
            }
            $lat = (float)$lat;
            $lng = (float)$lng;
        }

        // Driver must have approved status to go online
        $driver = $this->driverModel->findById($driverId);
        if ($isOnline && isset($driver['approval_status']) && $driver['approval_status'] !== 'APPROVED') {
            Response::forbidden('Driver partner is ' . strtolower($driver['approval_status']) . '. You cannot go online until approved.');
        }

        $result = $this->driverModel->updateStatus($driverId, $isOnline, $lat, $lng, $heading, $speed, $accuracy);
        Response::success($result, 'Driver status updated to ' . ($isOnline ? 'ONLINE' : 'OFFLINE'));
    }

    // =============================================================
    // 6. Get Available Ride Requests
    // GET /api/v1/driver/rides/available
    // =============================================================
    public function getAvailableRides()
    {
        $driverId = $this->requireAuthDriverId();
        $driver = $this->driverModel->findById($driverId);

        if (isset($driver['approval_status']) && $driver['approval_status'] !== 'APPROVED') {
            Response::success(array(), 'Driver is unapproved');
        }
        if (empty($driver['is_online'])) {
            $this->driverModel->updateStatus($driverId, 1);
        }

        $cityId = isset($driver['city_id']) ? $driver['city_id'] : null;
        $rides = $this->driverModel->getAvailableRides($driverId, $cityId);

        Response::success($rides, 'Available ride requests retrieved');
    }

    // =============================================================
    // 7. Accept Ride Request
    // POST /api/v1/driver/rides/{id}/accept
    // =============================================================
    public function acceptRide($params)
    {
        $driverId = $this->requireAuthDriverId();
        $bookingId = isset($params['id']) ? $params['id'] : null;

        if (empty($bookingId)) {
            Response::badRequest('Booking ID is required');
        }

        // Driver cannot accept new ride if already in a different active ride
        $current = $this->driverModel->getCurrentRide($driverId);
        if ($current && $current['id'] !== $bookingId) {
            $isStale = !empty($current['created_at']) && (strtotime($current['created_at']) < (time() - 1800));
            if ($isStale || Env::get('APP_ENV') !== 'production') {
                $this->driverModel->updateRideStatus($driverId, $current['id'], 'COMPLETED');
            } else {
                Response::error('You already have an active ride (' . $current['id'] . '). Complete it before accepting another.', 409);
            }
        }

        $result = $this->driverModel->acceptRide($driverId, $bookingId);

        if (isset($result['error'])) {
            Response::error($result['error'], $result['code']);
        }

        Response::success($result, 'Ride accepted successfully');
    }

    // =============================================================
    // 8. Reject Ride Request
    // POST /api/v1/driver/rides/{id}/reject
    // =============================================================
    public function rejectRide($params)
    {
        $driverId = $this->requireAuthDriverId();
        $bookingId = isset($params['id']) ? $params['id'] : null;

        if (empty($bookingId)) {
            Response::badRequest('Booking ID is required');
        }

        $result = $this->driverModel->rejectRide($driverId, $bookingId);
        Response::success($result, 'Ride request rejected');
    }

    // =============================================================
    // 9. Get Current / Active Ride
    // GET /api/v1/driver/rides/current
    // =============================================================
    public function getCurrentRide()
    {
        $driverId = $this->requireAuthDriverId();
        $current = $this->driverModel->getCurrentRide($driverId);

        if (!$current) {
            Response::success(null, 'No active ride at the moment');
        }

        Response::success($current, 'Active ride retrieved');
    }

    // =============================================================
    // 10. Update Ride Status (ARRIVED, STARTED, COMPLETED)
    // PATCH /api/v1/driver/rides/{id}/status
    // =============================================================
    public function updateRideStatus($params)
    {
        $driverId = $this->requireAuthDriverId();
        $bookingId = isset($params['id']) ? $params['id'] : null;

        if (empty($bookingId)) {
            Response::badRequest('Booking ID is required');
        }

        $input = $this->getJsonInput();
        $this->requireFields($input, array('status'));

        $status = strtoupper(trim($input['status']));
        if ($status === 'IN_PROGRESS') {
            $status = 'STARTED';
        }
        $otp = isset($input['otp']) ? trim($input['otp']) : null;

        if (!in_array($status, array('EN_ROUTE', 'ARRIVED', 'STARTED', 'COMPLETED'), true)) {
            Response::unprocessableEntity("Status must be 'EN_ROUTE', 'ARRIVED', 'STARTED', or 'COMPLETED'", array('status' => 'Invalid status value'));
        }

        $extra = array(
            'lat'      => isset($input['lat']) ? $input['lat'] : null,
            'lng'      => isset($input['lng']) ? $input['lng'] : null,
            'is_test'  => !empty($input['is_test']),
            'heading'  => isset($input['heading']) ? $input['heading'] : null,
            'speed'    => isset($input['speed']) ? $input['speed'] : null,
            'accuracy' => isset($input['accuracy']) ? $input['accuracy'] : null
        );

        $result = $this->driverModel->updateRideStatus($driverId, $bookingId, $status, $otp, $extra);

        if (isset($result['error'])) {
            Response::error($result['error'], $result['code']);
        }

        $msg = "Ride status updated to {$status}";
        if ($status === 'COMPLETED') {
            $msg = "Ride completed! ₹{$result['driver_earnings']} credited to your wallet.";
        }

        Response::success($result, $msg);
    }

    // =============================================================
    // Set Ride En Route
    // POST /api/v1/driver/rides/{id}/en-route
    // =============================================================
    public function setEnRoute($params)
    {
        $driverId = $this->requireAuthDriverId();
        $bookingId = isset($params['id']) ? $params['id'] : null;

        if (empty($bookingId)) {
            Response::badRequest('Booking ID is required');
        }

        $result = $this->driverModel->updateRideStatus($driverId, $bookingId, 'EN_ROUTE');

        if (isset($result['error'])) {
            Response::error($result['error'], $result['code']);
        }

        Response::success($result, 'Driver is en route to pickup');
    }

    // =============================================================
    // 11. Get Driver Ride History
    // GET /api/v1/driver/rides/history
    // =============================================================
    public function getRideHistory()
    {
        $driverId = $this->requireAuthDriverId();
        $limit = (int)$this->getQueryParam('limit', 20);
        $page  = (int)$this->getQueryParam('page', 1);

        if ($limit < 1 || $limit > 100) {
            $limit = 20;
        }
        if ($page < 1) {
            $page = 1;
        }
        $offset = ($page - 1) * $limit;

        $rides = $this->driverModel->getRideHistory($driverId, $limit, $offset);

        $meta = array(
            'page'  => $page,
            'limit' => $limit,
            'count' => count($rides)
        );

        Response::success($rides, 'Driver ride history retrieved', 200, $meta);
    }

    // =============================================================
    // 12. Get Driver Wallet and Transactions
    // GET /api/v1/driver/wallet
    // =============================================================
    public function getWallet()
    {
        $driverId = $this->requireAuthDriverId();
        $wallet = $this->driverModel->getWalletDetails($driverId);

        $limit = (int)$this->getQueryParam('limit', 50);
        $page  = (int)$this->getQueryParam('page', 1);

        if ($limit < 1 || $limit > 100) {
            $limit = 50;
        }
        if ($page < 1) {
            $page = 1;
        }
        $offset = ($page - 1) * $limit;

        $transactions = $this->driverModel->getWalletTransactions($driverId, $limit, $offset);

        $data = array(
            'walletId'            => $wallet['id'],
            'balance'             => (float)$wallet['balance'],
            'todayEarnings'       => (float)$wallet['today_earnings'],
            'todayTrips'          => (int)$wallet['today_trips'],
            'totalCommissionPaid' => (float)$wallet['total_commission_paid'],
            'currency'            => 'INR',
            'isActive'            => (bool)$wallet['is_active'],
            'transactions'        => $transactions
        );

        $meta = array(
            'page'  => $page,
            'limit' => $limit,
            'count' => count($transactions)
        );

        Response::success($data, 'Driver wallet and earnings ledger retrieved', 200, $meta);
    }

    // =============================================================
    // Recharge Driver Prepaid Wallet
    // POST /api/v1/driver/wallet/recharge
    // =============================================================
    public function rechargeWallet()
    {
        $driverId = $this->requireAuthDriverId();
        $input = $this->getJsonInput();
        $this->requireFields($input, array('amount'));

        $amount = (float)$input['amount'];
        $paymentMethod = isset($input['payment_method']) ? trim($input['payment_method']) : 'UPI';
        $status = isset($input['status']) ? strtoupper(trim($input['status'])) : 'SUCCESS';
        $referenceId = isset($input['reference_id']) ? trim($input['reference_id']) : null;

        if ($amount <= 0) {
            Response::badRequest('Recharge amount must be greater than zero');
        }

        $res = $this->driverModel->rechargeWallet($driverId, $amount, $paymentMethod, $status, $referenceId);

        if (isset($res['error'])) {
            Response::error($res['error'], $res['code']);
        }

        if (!$res['success']) {
            Response::badRequest($res['message'], $res);
        }

        Response::success($res, $res['message']);
    }

    // =============================================================
    // 13. Get Driver Notifications
    // GET /api/v1/driver/notifications
    // =============================================================
    public function getNotifications()
    {
        $driverId = $this->requireAuthDriverId();
        $limit = (int)$this->getQueryParam('limit', 30);

        if ($limit < 1 || $limit > 100) {
            $limit = 30;
        }

        $notifications = $this->driverModel->getNotifications($driverId, $limit);

        $unreadCount = 0;
        foreach ($notifications as $n) {
            if (!$n['is_read']) {
                $unreadCount++;
            }
        }

        $meta = array(
            'total'       => count($notifications),
            'unreadCount' => $unreadCount
        );

        Response::success($notifications, 'Driver notifications retrieved', 200, $meta);
    }

    // PATCH /api/v1/driver/notifications/{id}/read
    public function markNotificationRead($params)
    {
        $driverId = $this->requireAuthDriverId();
        $notifId = isset($params['id']) ? $params['id'] : null;

        if (empty($notifId)) {
            Response::badRequest('Notification ID is required');
        }

        $this->driverModel->markNotificationRead($driverId, $notifId);
        Response::success(array('markedRead' => true, 'id' => $notifId), 'Notification marked as read');
    }

    // =============================================================
    // 14. Driver Document / Status Information
    // GET /api/v1/driver/documents
    // =============================================================
    public function getDocuments()
    {
        $driverId = $this->requireAuthDriverId();
        $docs = $this->driverModel->getDocuments($driverId);

        Response::success($docs, 'Driver document and verification status retrieved');
    }

    // =============================================================
    // 15. Upload / Save Driver Document
    // POST /api/v1/driver/documents/upload
    // =============================================================
    public function uploadDocument()
    {
        $driverId = $this->requireAuthDriverId();
        $input = $this->getJsonInput();
        $this->requireFields($input, array('document_type'));

        $docType = strtoupper(trim($input['document_type']));
        $docNumber = isset($input['document_number']) ? trim($input['document_number']) : null;
        $fileUrl = isset($input['file_url']) ? trim($input['file_url']) : null;
        $expiryDate = isset($input['expiry_date']) ? trim($input['expiry_date']) : null;

        $doc = $this->driverModel->saveDocument($driverId, $docType, $docNumber, $fileUrl, $expiryDate);
        Response::success($doc, 'Document uploaded and submitted for verification');
    }

    // =============================================================
    // 16. Instant Approval for Test / Demo
    // POST /api/v1/driver/documents/instant-approve
    // =============================================================
    public function instantApprove()
    {
        $driverId = $this->requireAuthDriverId();
        $driver = $this->driverModel->instantApprove($driverId);
        Response::success($driver, 'Driver partner approved and activated successfully');
    }

    // =============================================================
    // 17. Dispatch Test Ride Near Driver
    // POST /api/v1/driver/test-ride/dispatch
    // =============================================================
    public function dispatchTestRide()
    {
        $driverId = $this->requireAuthDriverId();
        $input = $this->getJsonInput();
        $lat = isset($input['lat']) ? (float)$input['lat'] : 11.6643;
        $lng = isset($input['lng']) ? (float)$input['lng'] : 78.1460;
        $vehType = isset($input['vehicle_type']) ? trim($input['vehicle_type']) : 'Bike';

        $booking = $this->driverModel->dispatchTestRide($driverId, $lat, $lng, $vehType);
        Response::created($booking, 'Test ride dispatched successfully near your coordinates');
    }
    /**
     * POST /api/v1/driver/rides/{id}/confirm-vehicle
     * Driver confirms physical vehicle matches registration plate.
     */
    public function confirmCustomerVehicle($params = array())
    {
        $driver = AuthMiddleware::requireDriver();
        $driverId = $driver['sub'];

        $bookingId = null;
        if (isset($params['id']) && trim($params['id']) !== '') {
            $bookingId = trim($params['id']);
        }
        if (empty($bookingId)) {
            Response::badRequest('Ride ID is required');
        }

        require_once dirname(__DIR__) . '/models/BookingModel.php';
        $bookingModel = new BookingModel();

        try {
            $res = $bookingModel->confirmBookingVehicleByDriver($bookingId, $driverId);
            Response::success($res, $res['message']);
        } catch (Exception $e) {
            $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 400;
            if ($code === 403) {
                Response::forbidden($e->getMessage());
            } elseif ($code === 404) {
                Response::notFound($e->getMessage());
            } else {
                Response::badRequest($e->getMessage());
            }
        }
    }

    /**
     * POST /api/v1/driver/rides/{id}/report-vehicle-mismatch
     * Driver reports that physical vehicle does not match registration plate.
     */
    public function reportVehicleMismatch($params = array())
    {
        $driver = AuthMiddleware::requireDriver();
        $driverId = $driver['sub'];

        $bookingId = null;
        if (isset($params['id']) && trim($params['id']) !== '') {
            $bookingId = trim($params['id']);
        }
        if (empty($bookingId)) {
            Response::badRequest('Ride ID is required');
        }

        $input = $this->getJsonInput();
        $reason = isset($input['reason']) ? trim($input['reason']) : '';

        require_once dirname(__DIR__) . '/models/BookingModel.php';
        $bookingModel = new BookingModel();

        try {
            $res = $bookingModel->reportBookingVehicleMismatchByDriver($bookingId, $driverId, $reason);
            Response::success($res, $res['message']);
        } catch (Exception $e) {
            $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 400;
            if ($code === 403) {
                Response::forbidden($e->getMessage());
            } elseif ($code === 404) {
                Response::notFound($e->getMessage());
            } else {
                Response::badRequest($e->getMessage());
            }
        }
    }
}
