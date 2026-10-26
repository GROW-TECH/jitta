<?php
/**
 * RedTaxi Backend - Seed Vehicle Categories and Fare Rules
 * Populates standard categories and fare rules into redtaxi_db if empty.
 * Compatible with PHP 5.6+.
 */

require_once __DIR__ . '/config/database.php';

$db = Database::getInstance()->getConnection();

// Check if cities has at least Coimbatore
$stmt = $db->query("SELECT id FROM cities WHERE name = 'Coimbatore' LIMIT 1");
$city = $stmt->fetch(PDO::FETCH_ASSOC);
$cityId = 1;
if (!$city) {
    $db->query("INSERT INTO cities (id, name, state, country, lat, lng, radius_km, is_active) VALUES (1, 'Coimbatore', 'Tamil Nadu', 'India', 11.0168, 76.9558, 50, 1)");
    $cityId = 1;
} else {
    $cityId = (int)$city['id'];
}

$categories = array(
    array(
        'id'          => 'vc-mini-01',
        'name'        => 'Red Mini',
        'category'    => 'Compact Hatchback',
        'capacity'    => 4,
        'base_price'  => 99.00,
        'per_km_rate' => 14.00,
        'eta_min'     => 3,
        'tagline'     => 'Quick & affordable city rides',
        'image_url'   => 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=300&auto=format&fit=crop&q=80',
        'sort_order'  => 1,
        'fare_rule'   => array(
            'id'                   => 'fr-mini-cbe-01',
            'base_fare'            => 99.00,
            'free_km'              => 2.00,
            'per_km'               => 14.00,
            'per_minute'           => 2.00,
            'waiting_per_min'      => 1.50,
            'night_charge_percent' => 15.00,
            'platform_fee'         => 10.00,
            'tax_percent'          => 5.00,
            'cancellation_fee'     => 30.00
        )
    ),
    array(
        'id'          => 'vc-sedan-02',
        'name'        => 'Red Sedan',
        'category'    => 'Comfort Sedan',
        'capacity'    => 4,
        'base_price'  => 149.00,
        'per_km_rate' => 18.00,
        'eta_min'     => 4,
        'tagline'     => 'Spacious boot, AC comfort & top drivers',
        'image_url'   => 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=300&auto=format&fit=crop&q=80',
        'sort_order'  => 2,
        'fare_rule'   => array(
            'id'                   => 'fr-sedan-cbe-02',
            'base_fare'            => 149.00,
            'free_km'              => 2.00,
            'per_km'               => 18.00,
            'per_minute'           => 2.50,
            'waiting_per_min'      => 2.00,
            'night_charge_percent' => 15.00,
            'platform_fee'         => 10.00,
            'tax_percent'          => 5.00,
            'cancellation_fee'     => 40.00
        )
    ),
    array(
        'id'          => 'vc-suv-03',
        'name'        => 'Red SUV Prime',
        'category'    => '6-Seater SUV',
        'capacity'    => 6,
        'base_price'  => 199.00,
        'per_km_rate' => 24.00,
        'eta_min'     => 6,
        'tagline'     => 'Extra space for family & luggage',
        'image_url'   => 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=300&auto=format&fit=crop&q=80',
        'sort_order'  => 3,
        'fare_rule'   => array(
            'id'                   => 'fr-suv-cbe-03',
            'base_fare'            => 199.00,
            'free_km'              => 3.00,
            'per_km'               => 24.00,
            'per_minute'           => 3.00,
            'waiting_per_min'      => 3.00,
            'night_charge_percent' => 20.00,
            'platform_fee'         => 15.00,
            'tax_percent'          => 5.00,
            'cancellation_fee'     => 50.00
        )
    ),
    array(
        'id'          => 'vc-outstation-04',
        'name'        => 'Red Outstation',
        'category'    => 'Intercity Cruiser',
        'capacity'    => 5,
        'base_price'  => 499.00,
        'per_km_rate' => 16.00,
        'eta_min'     => 12,
        'tagline'     => 'Hassle-free intercity travel with verified chauffeurs',
        'image_url'   => 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=300&auto=format&fit=crop&q=80',
        'sort_order'  => 4,
        'fare_rule'   => array(
            'id'                   => 'fr-outstation-cbe-04',
            'base_fare'            => 499.00,
            'free_km'              => 0.00,
            'per_km'               => 16.00,
            'per_minute'           => 1.00,
            'waiting_per_min'      => 2.00,
            'night_charge_percent' => 0.00,
            'platform_fee'         => 20.00,
            'tax_percent'          => 5.00,
            'cancellation_fee'     => 100.00
        )
    )
);

foreach ($categories as $cat) {
    // Upsert vehicle category
    $checkCat = $db->prepare("SELECT id FROM vehicle_categories WHERE id = ? OR name = ?");
    $checkCat->execute(array($cat['id'], $cat['name']));
    $existing = $checkCat->fetch(PDO::FETCH_ASSOC);

    $catId = $cat['id'];
    if (!$existing) {
        $ins = $db->prepare("INSERT INTO vehicle_categories 
            (id, name, category, capacity, base_price, per_km_rate, eta_min, tagline, image_url, is_active, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)");
        $ins->execute(array(
            $cat['id'],
            $cat['name'],
            $cat['category'],
            $cat['capacity'],
            $cat['base_price'],
            $cat['per_km_rate'],
            $cat['eta_min'],
            $cat['tagline'],
            $cat['image_url'],
            $cat['sort_order']
        ));
        echo "Inserted vehicle category: {$cat['name']} ({$cat['id']})\n";
    } else {
        $catId = $existing['id'];
        echo "Vehicle category already exists: {$cat['name']} ({$catId})\n";
    }

    // Upsert fare rule for Coimbatore
    $fr = $cat['fare_rule'];
    $checkFr = $db->prepare("SELECT id FROM fare_rules WHERE city_id = ? AND category_id = ?");
    $checkFr->execute(array($cityId, $catId));
    $existingFr = $checkFr->fetch(PDO::FETCH_ASSOC);

    if (!$existingFr) {
        $insFr = $db->prepare("INSERT INTO fare_rules
            (id, city_id, category_id, base_fare, free_km, per_km, per_minute, waiting_per_min, night_charge_percent, platform_fee, tax_percent, cancellation_fee, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)");
        $insFr->execute(array(
            $fr['id'],
            $cityId,
            $catId,
            $fr['base_fare'],
            $fr['free_km'],
            $fr['per_km'],
            $fr['per_minute'],
            $fr['waiting_per_min'],
            $fr['night_charge_percent'],
            $fr['platform_fee'],
            $fr['tax_percent'],
            $fr['cancellation_fee']
        ));
        echo "  Inserted fare rule for {$cat['name']} in city {$cityId}\n";
    } else {
        echo "  Fare rule already exists for {$cat['name']} in city {$cityId}\n";
    }
}

echo "Seeding complete.\n";
