<?php
/**
 * RedTaxi Backend - Sync Jitta Drives Vehicle Categories & Fare Rules into MySQL
 */
require_once __DIR__ . '/config/database.php';

$db = Database::getInstance()->getConnection();

$db->exec("DELETE FROM fare_rules");
$db->exec("DELETE FROM vehicle_categories");

$categories = array(
    array(
        'id'          => 'auto',
        'name'        => 'Auto',
        'category'    => 'Auto',
        'capacity'    => 3,
        'base_price'  => 39.00,
        'per_km_rate' => 11.00,
        'eta_min'     => 3,
        'tagline'     => '3 Seater',
        'image_url'   => '/vehicles/auto.jpg',
        'sort_order'  => 1,
        'type'        => 'TAXI',
        'fare_rule'   => array(
            'id'                   => 'fr-auto-01',
            'base_fare'            => 39.00,
            'free_km'              => 1.50,
            'per_km'               => 11.00,
            'per_minute'           => 1.50,
            'waiting_per_min'      => 1.00,
            'night_charge_percent' => 10.00,
            'platform_fee'         => 5.00,
            'tax_percent'          => 5.00,
            'cancellation_fee'     => 20.00
        )
    ),
    array(
        'id'          => 'sedan',
        'name'        => 'Sedan',
        'category'    => 'Sedan',
        'capacity'    => 4,
        'base_price'  => 119.00,
        'per_km_rate' => 16.00,
        'eta_min'     => 4,
        'tagline'     => '4 Seater',
        'image_url'   => '/vehicles/red_sedan.jpg',
        'sort_order'  => 2,
        'type'        => 'TAXI',
        'fare_rule'   => array(
            'id'                   => 'fr-sedan-03',
            'base_fare'            => 119.00,
            'free_km'              => 2.00,
            'per_km'               => 16.00,
            'per_minute'           => 2.50,
            'waiting_per_min'      => 2.00,
            'night_charge_percent' => 15.00,
            'platform_fee'         => 10.00,
            'tax_percent'          => 5.00,
            'cancellation_fee'     => 40.00
        )
    ),
    array(
        'id'          => 'suv',
        'name'        => 'SUV',
        'category'    => 'SUV',
        'capacity'    => 6,
        'base_price'  => 169.00,
        'per_km_rate' => 22.00,
        'eta_min'     => 6,
        'tagline'     => '6 Seater',
        'image_url'   => '/vehicles/red_suv.jpg',
        'sort_order'  => 3,
        'type'        => 'TAXI',
        'fare_rule'   => array(
            'id'                   => 'fr-suv-04',
            'base_fare'            => 169.00,
            'free_km'              => 2.00,
            'per_km'               => 22.00,
            'per_minute'           => 3.00,
            'waiting_per_min'      => 2.50,
            'night_charge_percent' => 15.00,
            'platform_fee'         => 15.00,
            'tax_percent'          => 5.00,
            'cancellation_fee'     => 50.00
        )
    ),
    array(
        'id'          => 'bike',
        'name'        => 'Bike',
        'category'    => 'Bike',
        'capacity'    => 1,
        'base_price'  => 25.00,
        'per_km_rate' => 8.00,
        'eta_min'     => 2,
        'tagline'     => '1 Seater',
        'image_url'   => '/vehicles/bike.jpg',
        'sort_order'  => 4,
        'type'        => 'BIKE',
        'fare_rule'   => array(
            'id'                   => 'fr-bike-05',
            'base_fare'            => 25.00,
            'free_km'              => 1.00,
            'per_km'               => 8.00,
            'per_minute'           => 1.00,
            'waiting_per_min'      => 1.00,
            'night_charge_percent' => 10.00,
            'platform_fee'         => 5.00,
            'tax_percent'          => 5.00,
            'cancellation_fee'     => 15.00
        )
    ),
    array(
        'id'          => 'scooter',
        'name'        => 'Scooter',
        'category'    => 'Scooter',
        'capacity'    => 1,
        'base_price'  => 20.00,
        'per_km_rate' => 7.00,
        'eta_min'     => 3,
        'tagline'     => '1 Seater',
        'image_url'   => '/vehicles/scooter.jpg',
        'sort_order'  => 5,
        'type'        => 'BIKE',
        'fare_rule'   => array(
            'id'                   => 'fr-scooter-06',
            'base_fare'            => 20.00,
            'free_km'              => 1.00,
            'per_km'               => 7.00,
            'per_minute'           => 1.00,
            'waiting_per_min'      => 1.00,
            'night_charge_percent' => 10.00,
            'platform_fee'         => 5.00,
            'tax_percent'          => 5.00,
            'cancellation_fee'     => 15.00
        )
    )
);

$catStmt = $db->prepare("
    INSERT INTO vehicle_categories (id, name, category, capacity, base_price, per_km_rate, eta_min, tagline, image_url, is_active, sort_order, created_at)
    VALUES (:id, :name, :category, :capacity, :base_price, :per_km_rate, :eta_min, :tagline, :image_url, 1, :sort_order, NOW())
");

$frStmt = $db->prepare("
    INSERT INTO fare_rules (id, category_id, city_id, base_fare, free_km, per_km, per_minute, waiting_per_min, night_charge_percent, platform_fee, tax_percent, cancellation_fee, is_active)
    VALUES (:id, :category_id, 1, :base_fare, :free_km, :per_km, :per_minute, :waiting_per_min, :night_charge_percent, :platform_fee, :tax_percent, :cancellation_fee, 1)
");

foreach ($categories as $cat) {
    $catStmt->execute(array(
        ':id'          => $cat['id'],
        ':name'        => $cat['name'],
        ':category'    => $cat['category'],
        ':capacity'    => $cat['capacity'],
        ':base_price'  => $cat['base_price'],
        ':per_km_rate' => $cat['per_km_rate'],
        ':eta_min'     => $cat['eta_min'],
        ':tagline'     => $cat['tagline'],
        ':image_url'   => $cat['image_url'],
        ':sort_order'  => $cat['sort_order'],
    ));

    $fr = $cat['fare_rule'];
    $frStmt->execute(array(
        ':id'                   => $fr['id'],
        ':category_id'          => $cat['id'],
        ':base_fare'            => $fr['base_fare'],
        ':free_km'              => $fr['free_km'],
        ':per_km'               => $fr['per_km'],
        ':per_minute'           => $fr['per_minute'],
        ':waiting_per_min'      => $fr['waiting_per_min'],
        ':night_charge_percent' => $fr['night_charge_percent'],
        ':platform_fee'         => $fr['platform_fee'],
        ':tax_percent'          => $fr['tax_percent'],
        ':cancellation_fee'     => $fr['cancellation_fee']
    ));
}

echo "Jitta Drives Vehicle categories and fare rules synced successfully to redtaxi_db!\n";
