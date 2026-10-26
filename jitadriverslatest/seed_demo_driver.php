<?php
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/DriverModel.php';
require_once __DIR__ . '/utils/Security.php';

$db = Database::getInstance()->getConnection();
$driverModel = new DriverModel();

$phone = '9876543210';
$existing = $driverModel->findByPhone($phone);

if (!$existing) {
    echo "Creating default demo driver 9876543210...\n";
    $driver = $driverModel->createDriver(array(
        'name'            => 'Karthik Raja',
        'phone'           => $phone,
        'email'           => 'driver.karthik@redtaxi.in',
        'approval_status' => 'APPROVED',
        'city_id'         => 1,
        'rating'          => 4.9,
        'trips_count'     => 142
    ));
    $driverId = $driver['id'];

    // Add active vehicle
    $vehId = Security::generateUUID();
    $db->prepare("INSERT INTO `driver_vehicles` (`id`, `driver_id`, `vehicle_model`, `vehicle_number`, `vehicle_type`, `color`, `year`, `is_active`, `created_at`)
                  VALUES (?, ?, 'Maruti Dzire White', 'TN 38 BR 1234', 'Sedan', 'White', 2023, 1, NOW())")
       ->execute(array($vehId, $driverId));

    // Add wallet
    $driverModel->getWalletDetails($driverId);

    // Add documents
    $docs = array('LICENSE', 'RC', 'INSURANCE');
    foreach ($docs as $doc) {
        $docId = Security::generateUUID();
        $db->prepare("INSERT INTO `driver_documents` (`id`, `driver_id`, `document_type`, `file_url`, `verification_status`, `created_at`)
                      VALUES (?, ?, ?, 'https://example.com/docs/demo.jpg', 'VERIFIED', NOW())")
           ->execute(array($docId, $driverId, $doc));
    }

    echo "Demo driver created successfully: {$driverId}\n";
} else {
    echo "Demo driver 9876543210 already exists: {$existing['id']}\n";
    // Ensure APPROVED
    $db->prepare("UPDATE `drivers` SET `approval_status` = 'APPROVED' WHERE `id` = ?")->execute(array($existing['id']));
    // Ensure active vehicle
    $veh = $driverModel->getActiveVehicle($existing['id']);
    if (!$veh) {
        $vehId = Security::generateUUID();
        $db->prepare("INSERT INTO `driver_vehicles` (`id`, `driver_id`, `vehicle_model`, `vehicle_number`, `vehicle_type`, `color`, `year`, `is_active`, `created_at`)
                      VALUES (?, ?, 'Maruti Dzire White', 'TN 38 BR 1234', 'Sedan', 'White', 2023, 1, NOW())")
           ->execute(array($vehId, $existing['id']));
    }
}
