<?php
/**
 * RedTaxi / Jitta Backend - Payment Controller
 * Handles Razorpay Order Creation and Signature Verification for Driver Wallet Recharge and Customer Ride Payments.
 */

require_once __DIR__ . '/BaseController.php';
require_once dirname(__DIR__) . '/services/RazorpayService.php';
require_once dirname(__DIR__) . '/models/DriverModel.php';
require_once dirname(__DIR__) . '/models/BookingModel.php';
require_once dirname(__DIR__) . '/middleware/AuthMiddleware.php';
require_once dirname(__DIR__) . '/utils/Response.php';

class PaymentController extends BaseController
{
    private $driverModel;
    private $bookingModel;

    public function __construct()
    {
        $this->driverModel = new DriverModel();
        $this->bookingModel = new BookingModel();
    }

    /**
     * POST /api/v1/payment/create-order
     * Body: { amount: 1.00, purpose: "DRIVER_RECHARGE" | "BOOKING_PAYMENT", reference_id: string }
     */
    public function createOrder()
    {
        $user = AuthMiddleware::authenticate();
        $userId = $user['sub'];
        $userRole = isset($user['role']) ? strtoupper($user['role']) : 'CUSTOMER';

        $input = $this->getJsonInput();
        $this->requireFields($input, array('amount'));

        $amount = (float)$input['amount'];
        $purpose = isset($input['purpose']) ? strtoupper(trim($input['purpose'])) : 'DRIVER_RECHARGE';
        $refId = isset($input['reference_id']) ? trim($input['reference_id']) : Security::generateUUID();

        if ($amount <= 0) {
            Response::badRequest('Payment amount must be greater than zero');
        }

        $receipt = 'REC_' . time() . '_' . substr(md5($userId . $refId), 0, 8);
        $notes = array(
            'user_id'   => $userId,
            'user_role' => $userRole,
            'purpose'   => $purpose,
            'ref_id'    => $refId
        );

        $order = RazorpayService::createOrder($amount, $receipt, $notes);

        if (!$order['success']) {
            Response::error($order['error'], 500);
        }

        // Also generate a hosted Payment Link (short_url) so mobile apps and WebViews can open UPI intent cleanly
        $driverName = isset($user['name']) ? $user['name'] : 'Jitta Captain';
        $driverPhone = isset($user['phone']) ? $user['phone'] : '';
        $callbackUrl = 'https://jittadrives.com/driver?recharge_status=success&amount=' . urlencode($amount);
        $linkRes = RazorpayService::createPaymentLink($amount, $receipt, array(
            'name'    => $driverName,
            'contact' => $driverPhone,
            'email'   => 'driver@jittadrives.com'
        ), $callbackUrl, $notes);

        if ($linkRes['success'] && !empty($linkRes['short_url'])) {
            $order['payment_link_url'] = $linkRes['short_url'];
        }

        Response::success($order, 'Razorpay order created successfully');
    }

    /**
     * POST /api/v1/payment/verify
     * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, purpose, amount, reference_id }
     */
    public function verifyPayment()
    {
        $user = AuthMiddleware::authenticate();
        $userId = $user['sub'];

        $input = $this->getJsonInput();
        $this->requireFields($input, array('razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'));

        $orderId = trim($input['razorpay_order_id']);
        $paymentId = trim($input['razorpay_payment_id']);
        $signature = trim($input['razorpay_signature']);
        $purpose = isset($input['purpose']) ? strtoupper(trim($input['purpose'])) : 'DRIVER_RECHARGE';
        $amount = isset($input['amount']) ? (float)$input['amount'] : 1.0;
        $refId = isset($input['reference_id']) ? trim($input['reference_id']) : null;

        $isValid = RazorpayService::verifySignature($orderId, $paymentId, $signature);

        if (!$isValid) {
            Response::badRequest('Invalid payment signature verification failed');
        }

        // Process based on purpose
        if ($purpose === 'DRIVER_RECHARGE') {
            $driverId = $userId;
            $res = $this->driverModel->rechargeWallet($driverId, $amount, 'UPI', 'SUCCESS', $paymentId);
            if (!$res['success']) {
                Response::badRequest($res['message'], $res);
            }
            Response::success(array(
                'verified'      => true,
                'payment_id'    => $paymentId,
                'order_id'      => $orderId,
                'wallet_result' => $res
            ), 'Wallet recharged successfully via Razorpay');
        } elseif ($purpose === 'BOOKING_PAYMENT') {
            // Customer online ride payment
            if ($refId) {
                $this->bookingModel->updatePaymentStatus($refId, 'PAID', $paymentId, 'UPI');
            }
            Response::success(array(
                'verified'   => true,
                'payment_id' => $paymentId,
                'order_id'   => $orderId
            ), 'Ride payment verified successfully');
        } else {
            Response::success(array(
                'verified'   => true,
                'payment_id' => $paymentId,
                'order_id'   => $orderId
            ), 'Payment verified successfully');
        }
    }
}

