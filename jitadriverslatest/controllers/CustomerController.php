<?php
/**
 * RedTaxi Backend - Customer Controller
 * Handles Customer Profile, Saved Places, Booking History,
 * Wallet & Ledger, Support Tickets, and Notifications.
 * Compatible with PHP 5.6+.
 */

require_once __DIR__ . '/BaseController.php';
require_once dirname(__DIR__) . '/models/CustomerModel.php';
require_once dirname(__DIR__) . '/models/BookingModel.php';
require_once dirname(__DIR__) . '/models/SupportModel.php';
require_once dirname(__DIR__) . '/middleware/AuthMiddleware.php';
require_once dirname(__DIR__) . '/utils/Response.php';

class CustomerController extends BaseController
{
    private $customerModel;
    private $bookingModel;
    private $supportModel;

    public function __construct()
    {
        $this->customerModel = new CustomerModel();
        $this->bookingModel  = new BookingModel();
        $this->supportModel  = new SupportModel();
    }

    /**
     * Helper to authenticate customer and return customer ID.
     */
    private function requireAuthCustomerId()
    {
        $user = AuthMiddleware::requireCustomer();
        return $user['sub'];
    }

    // =============================================================
    // 1. Get Customer Profile
    // GET /api/v1/customer/profile
    // =============================================================
    public function getProfile()
    {
        $customerId = $this->requireAuthCustomerId();
        $customer = $this->customerModel->findById($customerId);

        if (!$customer && !empty($_SERVER['AUTH_USER']['phone'])) {
            $customer = $this->customerModel->findByPhone($_SERVER['AUTH_USER']['phone']);
        }

        if (!$customer) {
            Response::notFound('Customer account not found');
        }

        unset($customer['password_hash']);
        Response::success($customer, 'Customer profile retrieved');
    }

    // =============================================================
    // 2. Update Customer Profile
    // PUT /api/v1/customer/profile
    // =============================================================
    public function updateProfile()
    {
        $customerId = $this->requireAuthCustomerId();
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
                    // Ensure email not in use by another customer
                    $existing = $this->customerModel->findByEmail($email);
                    if ($existing && $existing['id'] !== $customerId) {
                        Response::conflict('This email is already in use by another account');
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

        if (isset($input['avatar_url']) || isset($input['avatar']) || isset($input['photo'])) {
            $raw = isset($input['avatar_url']) ? $input['avatar_url'] : (isset($input['avatar']) ? $input['avatar'] : $input['photo']);
            $avatarInput = is_string($raw) ? trim($raw) : '';
            if ($avatarInput === '') {
                $updateData['avatar_url'] = null;
            } elseif (preg_match('#^data:image/(\w+);base64,(.+)$#', $avatarInput, $matches)) {
                $ext = strtolower($matches[1]);
                if ($ext === 'jpeg') $ext = 'jpg';
                $data = base64_decode($matches[2]);
                $filename = 'cust_' . substr($customerId, 0, 8) . '_' . time() . '.' . $ext;
                $dir = __DIR__ . '/../uploads/profiles';
                if (!file_exists($dir)) @mkdir($dir, 0777, true);
                $filePath = $dir . '/' . $filename;
                if (@file_put_contents($filePath, $data)) {
                    $updateData['avatar_url'] = '/uploads/profiles/' . $filename;
                } else {
                    $updateData['avatar_url'] = $avatarInput;
                }
            } else {
                $updateData['avatar_url'] = $avatarInput;
            }
        }

        if (isset($input['city_id'])) {
            $updateData['city_id'] = (int)$input['city_id'];
        }

        if (empty($updateData)) {
            Response::badRequest('No profile fields provided for update');
        }

        $updated = $this->customerModel->updateProfile($customerId, $updateData);
        unset($updated['password_hash']);

        Response::success($updated, 'Customer profile updated successfully');
    }

    // =============================================================
    // 3. Get Saved Places
    // GET /api/v1/customer/places
    // =============================================================
    public function getPlaces()
    {
        $customerId = $this->requireAuthCustomerId();
        $places = $this->customerModel->getSavedPlaces($customerId);

        Response::success($places, 'Saved places retrieved');
    }

    // =============================================================
    // 4A. Add Saved Place
    // POST /api/v1/customer/places
    // =============================================================
    public function addPlace()
    {
        $customerId = $this->requireAuthCustomerId();
        $input = $this->getJsonInput();

        $this->requireFields($input, array('label', 'address', 'lat', 'lng'));

        $errors = array();
        $label = $input['label'];
        if (!in_array($label, array('Home', 'Work', 'Other'), true)) {
            $errors['label'] = "Label must be 'Home', 'Work', or 'Other'";
        }

        if (strlen(trim($input['address'])) < 3 || strlen(trim($input['address'])) > 255) {
            $errors['address'] = 'Address must be between 3 and 255 characters';
        }

        if (!$this->validateCoordinates($input['lat'], $input['lng'])) {
            $errors['coordinates'] = 'Coordinates must be valid numbers (lat: -90 to 90, lng: -180 to 180)';
        }

        if (!empty($errors)) {
            Response::unprocessableEntity('Validation failed. Please correct the highlighted errors.', $errors);
        }

        $place = $this->customerModel->addSavedPlace($customerId, $input);
        Response::created($place, 'Saved place added successfully');
    }

    // =============================================================
    // 4B. Update Saved Place
    // PUT /api/v1/customer/places/{id}
    // =============================================================
    public function updatePlace($params)
    {
        $customerId = $this->requireAuthCustomerId();
        $placeId = isset($params['id']) ? $params['id'] : null;

        if (empty($placeId)) {
            Response::badRequest('Place ID is required');
        }

        $existing = $this->customerModel->findSavedPlace($customerId, $placeId);
        if (!$existing) {
            Response::notFound('Saved place not found');
        }

        $input = $this->getJsonInput();
        $errors = array();

        if (isset($input['label']) && !in_array($input['label'], array('Home', 'Work', 'Other'), true)) {
            $errors['label'] = "Label must be 'Home', 'Work', or 'Other'";
        }

        $lat = isset($input['lat']) ? $input['lat'] : $existing['lat'];
        $lng = isset($input['lng']) ? $input['lng'] : $existing['lng'];
        if (isset($input['lat']) || isset($input['lng'])) {
            if (!$this->validateCoordinates($lat, $lng)) {
                $errors['coordinates'] = 'Coordinates must be valid numbers (lat: -90 to 90, lng: -180 to 180)';
            }
        }

        if (!empty($errors)) {
            Response::unprocessableEntity('Validation failed. Please correct the highlighted errors.', $errors);
        }

        $updated = $this->customerModel->updateSavedPlace($customerId, $placeId, $input);
        Response::success($updated, 'Saved place updated successfully');
    }

    // =============================================================
    // 4C. Delete Saved Place
    // DELETE /api/v1/customer/places/{id}
    // =============================================================
    public function deletePlace($params)
    {
        $customerId = $this->requireAuthCustomerId();
        $placeId = isset($params['id']) ? $params['id'] : null;

        if (empty($placeId)) {
            Response::badRequest('Place ID is required');
        }

        $existing = $this->customerModel->findSavedPlace($customerId, $placeId);
        if (!$existing) {
            Response::notFound('Saved place not found');
        }

        $this->customerModel->deleteSavedPlace($customerId, $placeId);
        Response::success(array('deleted' => true, 'id' => $placeId), 'Saved place deleted successfully');
    }

    // =============================================================
    // 5. Get Customer Booking History
    // GET /api/v1/customer/bookings
    // =============================================================
    public function getBookings()
    {
        $customerId = $this->requireAuthCustomerId();

        $status = $this->getQueryParam('status');
        $limit  = (int)$this->getQueryParam('limit', 20);
        $page   = (int)$this->getQueryParam('page', 1);

        if ($limit < 1 || $limit > 100) {
            $limit = 20;
        }
        if ($page < 1) {
            $page = 1;
        }
        $offset = ($page - 1) * $limit;

        $bookings = $this->bookingModel->getCustomerBookings($customerId, $status, $limit, $offset);

        $meta = array(
            'page'  => $page,
            'limit' => $limit,
            'count' => count($bookings)
        );

        Response::success($bookings, 'Booking history retrieved', 200, $meta);
    }

    // =============================================================
    // 10. Get Customer Booking Details
    // GET /api/v1/customer/bookings/{id}
    // =============================================================
    public function getBookingDetail($params)
    {
        $customerId = $this->requireAuthCustomerId();
        $bookingId = isset($params['id']) ? $params['id'] : null;

        if (empty($bookingId)) {
            Response::badRequest('Booking ID is required');
        }

        $booking = $this->bookingModel->getCustomerBookingDetail($customerId, $bookingId);
        if (!$booking) {
            Response::notFound('Booking not found');
        }

        Response::success($booking, 'Booking details retrieved');
    }

    // =============================================================
    // 6. Get Customer Notifications
    // GET /api/v1/customer/notifications
    // =============================================================
    public function getNotifications()
    {
        $customerId = $this->requireAuthCustomerId();
        $limit = (int)$this->getQueryParam('limit', 30);

        if ($limit < 1 || $limit > 100) {
            $limit = 30;
        }

        $notifications = $this->customerModel->getNotifications($customerId, $limit);

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

        Response::success($notifications, 'Notifications retrieved', 200, $meta);
    }

    // PATCH /api/v1/customer/notifications/{id}/read
    public function markNotificationRead($params)
    {
        $customerId = $this->requireAuthCustomerId();
        $notifId = isset($params['id']) ? $params['id'] : null;

        if (empty($notifId)) {
            Response::badRequest('Notification ID is required');
        }

        $this->customerModel->markNotificationRead($customerId, $notifId);
        Response::success(array('markedRead' => true, 'id' => $notifId), 'Notification marked as read');
    }

    // =============================================================
    // 7. Get Customer Wallet Balance & Transactions
    // GET /api/v1/customer/wallet
    // =============================================================
    public function getWallet()
    {
        $customerId = $this->requireAuthCustomerId();

        $wallet = $this->customerModel->getWalletDetails($customerId);

        $limit = (int)$this->getQueryParam('limit', 50);
        $page  = (int)$this->getQueryParam('page', 1);

        if ($limit < 1 || $limit > 100) {
            $limit = 50;
        }
        if ($page < 1) {
            $page = 1;
        }
        $offset = ($page - 1) * $limit;

        $transactions = $this->customerModel->getWalletTransactions($customerId, $limit, $offset);

        $data = array(
            'walletId'     => $wallet['id'],
            'balance'      => (float)$wallet['balance'],
            'currency'     => 'INR',
            'isActive'     => (bool)$wallet['is_active'],
            'transactions' => $transactions
        );

        $meta = array(
            'page'  => $page,
            'limit' => $limit,
            'count' => count($transactions)
        );

        Response::success($data, 'Wallet details and transactions retrieved', 200, $meta);
    }

    // =============================================================
    // 8. Create Support Ticket
    // POST /api/v1/customer/support/tickets
    // =============================================================
    public function createTicket()
    {
        $customerId = $this->requireAuthCustomerId();
        $input = $this->getJsonInput();

        $this->requireFields($input, array('category', 'subject', 'description'));

        $subject = trim($input['subject']);
        $description = trim($input['description']);

        if (strlen($subject) < 3) {
            Response::badRequest('Subject must be at least 3 characters');
        }

        if (strlen($description) < 5) {
            Response::badRequest('Description must be at least 5 characters');
        }

        $ticket = $this->supportModel->createTicket($customerId, $input);
        Response::created($ticket, 'Support ticket created successfully');
    }

    // =============================================================
    // 9. Get Customer Support Tickets
    // GET /api/v1/customer/support/tickets
    // =============================================================
    public function getTickets()
    {
        $customerId = $this->requireAuthCustomerId();
        $tickets = $this->supportModel->getCustomerTickets($customerId);

        Response::success($tickets, 'Support tickets retrieved');
    }

    // GET /api/v1/customer/support/tickets/{id}
    public function getTicketDetail($params)
    {
        $customerId = $this->requireAuthCustomerId();
        $ticketId = isset($params['id']) ? $params['id'] : null;

        if (empty($ticketId)) {
            Response::badRequest('Ticket ID is required');
        }

        $ticket = $this->supportModel->getTicketDetail($customerId, $ticketId);
        if (!$ticket) {
            Response::notFound('Support ticket not found');
        }

        Response::success($ticket, 'Ticket details retrieved');
    }

    // POST /api/v1/customer/support/tickets/{id}/reply
    public function replyTicket($params)
    {
        $customerId = $this->requireAuthCustomerId();
        $ticketId = isset($params['id']) ? $params['id'] : null;

        if (empty($ticketId)) {
            Response::badRequest('Ticket ID is required');
        }

        $input = $this->getJsonInput();
        $this->requireFields($input, array('message'));

        $message = trim($input['message']);
        if (strlen($message) < 1) {
            Response::badRequest('Message cannot be empty');
        }

        $ticket = $this->supportModel->addMessage($customerId, $ticketId, $message);
        if (!$ticket) {
            Response::notFound('Support ticket not found');
        }

        Response::success($ticket, 'Reply submitted successfully');
    }
}
