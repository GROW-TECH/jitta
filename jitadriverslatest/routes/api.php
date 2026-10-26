<?php
/**
 * RedTaxi Backend - API v1 Route Definitions
 * Configures all routes under /api/v1/
 */

require_once __DIR__ . '/Router.php';
require_once dirname(__DIR__) . '/middleware/CorsMiddleware.php';
require_once dirname(__DIR__) . '/controllers/HealthController.php';
require_once dirname(__DIR__) . '/controllers/AuthController.php';
require_once dirname(__DIR__) . '/controllers/CustomerController.php';
require_once dirname(__DIR__) . '/controllers/DriverController.php';
require_once dirname(__DIR__) . '/controllers/BookingController.php';
require_once dirname(__DIR__) . '/controllers/LookupController.php';
require_once dirname(__DIR__) . '/controllers/AdminController.php';

$router = new Router('/api/v1');

// Attach global middlewares
$router->addMiddleware(array('CorsMiddleware', 'handle'));

// Health & System Info routes
$router->get('/', array('HealthController', 'index'));
$router->get('/health', array('HealthController', 'health'));
$router->get('/status', array('HealthController', 'index'));

// Authentication routes
$router->post('/auth/customer/register', array('AuthController', 'customerRegister'));
$router->post('/auth/customer/login',    array('AuthController', 'customerLogin'));
$router->post('/auth/driver/register',   array('AuthController', 'driverRegister'));
$router->post('/auth/driver/login',      array('AuthController', 'driverLogin'));
$router->post('/auth/admin/login',       array('AuthController', 'adminLogin'));
$router->post('/auth/logout',            array('AuthController', 'logout'));
$router->post('/auth/send-otp',          array('AuthController', 'sendOtp'));
$router->get('/auth/me',                 array('AuthController', 'me'));

// Customer Profile routes
$router->get('/customer/profile',                 array('CustomerController', 'getProfile'));
$router->put('/customer/profile',                 array('CustomerController', 'updateProfile'));
$router->patch('/customer/profile',               array('CustomerController', 'updateProfile'));

// Customer Saved Places routes
$router->get('/customer/places',                  array('CustomerController', 'getPlaces'));
$router->post('/customer/places',                 array('CustomerController', 'addPlace'));
$router->put('/customer/places/{id}',             array('CustomerController', 'updatePlace'));
$router->delete('/customer/places/{id}',          array('CustomerController', 'deletePlace'));

// Customer Bookings routes
$router->get('/customer/bookings',                array('CustomerController', 'getBookings'));
$router->get('/customer/bookings/{id}',           array('CustomerController', 'getBookingDetail'));

// Fare & Booking Lifecycle routes
$router->post('/booking/fare-estimate',           array('BookingController', 'fareEstimate'));
$router->post('/booking/create',                  array('BookingController', 'createBooking'));
$router->get('/booking/active',                   array('BookingController', 'getActiveBooking'));
$router->post('/booking/cancel',                  array('BookingController', 'cancelBooking'));
$router->post('/booking/complete',                array('BookingController', 'completeBooking'));
$router->post('/booking/rate',                    array('BookingController', 'rateBooking'));
$router->post('/booking/sos',                     array('BookingController', 'triggerSOS'));
$router->get('/booking/{id}',                     array('BookingController', 'getBookingDetail'));
$router->post('/booking/{id}/cancel',             array('BookingController', 'cancelBooking'));
$router->post('/booking/{id}/complete',           array('BookingController', 'completeBooking'));
$router->post('/booking/{id}/rate',               array('BookingController', 'rateBooking'));
$router->post('/booking/{id}/sos',                array('BookingController', 'triggerSOS'));
$router->post('/booking/{id}/vehicle-details',       array('BookingController', 'updateVehicleDetails'));
$router->get('/booking/{id}/vehicle-verification',   array('BookingController', 'getVehicleVerification'));
$router->post('/vehicle/validate-format',            array('BookingController', 'validateVehicleFormat'));
$router->post('/vehicle/verify-registration',        array('BookingController', 'verifyVehicleRegistration'));
$router->get('/rides/{id}/messages',                 array('BookingController', 'getChatMessages'));
$router->post('/rides/{id}/messages',                array('BookingController', 'sendChatMessage'));

// Customer Notifications routes
$router->get('/customer/notifications',           array('CustomerController', 'getNotifications'));
$router->patch('/customer/notifications/{id}/read', array('CustomerController', 'markNotificationRead'));

// Customer Wallet routes
$router->get('/customer/wallet',                  array('CustomerController', 'getWallet'));

// Customer Support routes
$router->post('/customer/support/tickets',        array('CustomerController', 'createTicket'));
$router->get('/customer/support/tickets',         array('CustomerController', 'getTickets'));
$router->get('/customer/support/tickets/{id}',    array('CustomerController', 'getTicketDetail'));
$router->post('/customer/support/tickets/{id}/reply', array('CustomerController', 'replyTicket'));

// Driver Profile & Fleet routes
$router->get('/driver/profile',                   array('DriverController', 'getProfile'));
$router->put('/driver/profile',                   array('DriverController', 'updateProfile'));
$router->get('/driver/vehicle',                   array('DriverController', 'getVehicle'));
$router->get('/driver/vehicles',                  array('DriverController', 'getVehicle'));
$router->put('/driver/vehicle',                   array('DriverController', 'updateVehicle'));
$router->put('/driver/vehicles/{id}',             array('DriverController', 'updateVehicle'));

// Driver Online/Offline & GPS status
$router->patch('/driver/status',                  array('DriverController', 'updateStatus'));

// Driver Ride Matching & State Transitions
$router->get('/driver/rides/available',           array('DriverController', 'getAvailableRides'));
$router->post('/driver/rides/{id}/accept',        array('DriverController', 'acceptRide'));
$router->post('/driver/rides/{id}/reject',        array('DriverController', 'rejectRide'));
$router->post('/driver/rides/{id}/en-route',      array('DriverController', 'setEnRoute'));
$router->get('/driver/rides/current',             array('DriverController', 'getCurrentRide'));
$router->patch('/driver/rides/{id}/status',       array('DriverController', 'updateRideStatus'));
$router->post('/driver/rides/{id}/confirm-vehicle',  array('DriverController', 'confirmCustomerVehicle'));
$router->post('/driver/rides/{id}/report-vehicle-mismatch', array('DriverController', 'reportVehicleMismatch'));
$router->get('/driver/rides/history',             array('DriverController', 'getRideHistory'));

// Driver Wallet & Earnings
$router->get('/driver/wallet',                    array('DriverController', 'getWallet'));
$router->post('/driver/wallet/recharge',           array('DriverController', 'rechargeWallet'));

// Driver Notifications & Documents
$router->get('/driver/notifications',              array('DriverController', 'getNotifications'));
$router->patch('/driver/notifications/{id}/read',  array('DriverController', 'markNotificationRead'));
$router->get('/driver/documents',                  array('DriverController', 'getDocuments'));
$router->post('/driver/documents/upload',          array('DriverController', 'uploadDocument'));
$router->post('/driver/documents/instant-approve', array('DriverController', 'instantApprove'));
$router->post('/driver/test-ride/dispatch',        array('DriverController', 'dispatchTestRide'));

// Public Catalogue Lookups
$router->get('/lookup/vehicle-categories', array('LookupController', 'getVehicleCategories'));
$router->get('/lookup/coupons',            array('LookupController', 'getCoupons'));
$router->get('/lookup/offers',             array('LookupController', 'getOffers'));
$router->get('/lookup/fare-rules',         array('LookupController', 'getFareRules'));
$router->get('/places/search',             array('LookupController', 'searchPlaces'));

// ==========================================
// Phase 4: Admin Management & Dispatch Routes
// ==========================================
$router->get('/admin/dashboard',                  array('AdminController', 'getDashboard'));

// Admin Customer Management
$router->get('/admin/customers',                  array('AdminController', 'getCustomers'));
$router->patch('/admin/customers/{id}/status',    array('AdminController', 'updateCustomerStatus'));
$router->delete('/admin/customers/{id}',          array('AdminController', 'deleteCustomer'));

// Admin Driver Management & Approvals
$router->get('/admin/drivers',                    array('AdminController', 'getDrivers'));
$router->patch('/admin/drivers/{id}/approval',    array('AdminController', 'updateDriverApproval'));
$router->patch('/admin/drivers/{id}/status',      array('AdminController', 'updateDriverStatus'));
$router->delete('/admin/drivers/{id}',            array('AdminController', 'deleteDriver'));
$router->get('/admin/drivers/{id}/documents',     array('AdminController', 'getDriverDocuments'));
$router->post('/admin/drivers/{id}/remind-recharge', array('AdminController', 'sendRechargeReminder'));

// Admin Vehicle Fleet
$router->get('/admin/vehicles',                   array('AdminController', 'getVehicles'));
$router->get('/admin/partner-vehicles',           array('AdminController', 'getPartnerVehicles'));
$router->put('/admin/vehicles/{id}',              array('AdminController', 'updateVehicleCategory'));
$router->patch('/admin/vehicles/{id}/toggle',     array('AdminController', 'toggleVehicleCategory'));

// Admin Bookings & Manual Driver Assignment
$router->get('/admin/bookings',                  array('AdminController', 'getBookings'));
$router->get('/admin/ratings',                   array('AdminController', 'getRatings'));
$router->get('/admin/bookings/{id}',             array('AdminController', 'getBookingDetail'));
$router->post('/admin/bookings/{id}/assign',      array('AdminController', 'assignDriver'));
$router->patch('/admin/bookings/{id}/status',     array('AdminController', 'updateBookingStatus'));

// Admin Fare Management
$router->get('/admin/fare-rules',                 array('AdminController', 'getFareRules'));
$router->put('/admin/fare-rules/{id}',            array('AdminController', 'updateFareRule'));

// Admin Coupons
$router->get('/admin/coupons',                     array('AdminController', 'getCoupons'));
$router->post('/admin/coupons',                    array('AdminController', 'createCoupon'));
$router->post('/admin/coupons/toggle-all',         array('AdminController', 'toggleAllCoupons'));
$router->patch('/admin/coupons/{id}/toggle',       array('AdminController', 'toggleCoupon'));
$router->delete('/admin/coupons/{id}',             array('AdminController', 'deleteCoupon'));

// Admin Offers & Promotions
$router->get('/admin/offers',                      array('AdminController', 'getOffers'));
$router->post('/admin/offers',                     array('AdminController', 'createOffer'));
$router->post('/admin/offers/toggle-all',          array('AdminController', 'toggleAllOffers'));
$router->get('/admin/offers/settings',             array('AdminController', 'getOffersSettings'));
$router->post('/admin/offers/notice',              array('AdminController', 'updateOffersNotice'));
$router->patch('/admin/offers/{id}/toggle',        array('AdminController', 'toggleOffer'));
$router->delete('/admin/offers/{id}',              array('AdminController', 'deleteOffer'));

// Admin Wallet Audit
$router->get('/admin/wallets',                     array('AdminController', 'getWalletAudit'));

// Admin Payments
$router->get('/admin/payments',                    array('AdminController', 'getPayments'));

// Admin SOS Center
$router->get('/admin/sos-alerts',                  array('AdminController', 'getSosAlerts'));
$router->patch('/admin/sos-alerts/{id}/resolve',   array('AdminController', 'resolveSos'));

// Admin Support
$router->get('/admin/support-tickets',             array('AdminController', 'getSupportTickets'));
$router->get('/admin/support-tickets/{id}/messages', array('AdminController', 'getSupportTicketMessages'));
$router->patch('/admin/support-tickets/{id}/status', array('AdminController', 'updateSupportTicketStatus'));
$router->post('/admin/support-tickets/{id}/reply', array('AdminController', 'replySupportTicket'));

// Admin Notifications
$router->get('/admin/notifications',               array('AdminController', 'getNotifications'));
$router->post('/admin/notifications/broadcast',    array('AdminController', 'broadcastNotification'));

// Admin Settings
$router->get('/admin/settings',                    array('AdminController', 'getSettings'));
$router->put('/admin/settings',                    array('AdminController', 'saveSettings'));

return $router;
