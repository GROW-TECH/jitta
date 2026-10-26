<?php
/**
 * Seeder for Tamil Nadu & Salem Places & Landmarks
 * Populates `places` table in `redtaxi_db`
 */

require_once __DIR__ . '/config/database.php';

try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    // Ensure table exists
    require_once __DIR__ . '/migrate_places.php';

    echo "Seeding places table...\n";

    $places = [
        // ==========================================
        // 1. JAGIR AREA & NEIGHBORHOODS (SALEM WEST)
        // ==========================================
        [
            'place_id' => 'tn-salem-jagir-ammapalayam',
            'primary_text' => 'Jagir Ammapalayam',
            'secondary_text' => 'Salem West, Salem, Tamil Nadu 636302',
            'full_text' => 'Jagir Ammapalayam, Salem West, Salem, Tamil Nadu 636302',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636302',
            'category' => 'LOCALITY',
            'lat' => 11.67812,
            'lng' => 78.11113,
            'search_weight' => 100
        ],
        [
            'place_id' => 'tn-salem-jagir-reddipatti',
            'primary_text' => 'Jagir Reddipatti',
            'secondary_text' => 'Salem West, Salem, Tamil Nadu 636302',
            'full_text' => 'Jagir Reddipatti, Salem West, Salem, Tamil Nadu 636302',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636302',
            'category' => 'LOCALITY',
            'lat' => 11.68450,
            'lng' => 78.10650,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-salem-jagir-reddipatti-bus-stop',
            'primary_text' => 'Jagir Reddipatti Bus Stop',
            'secondary_text' => 'Main Road, Jagir Reddipatti, Salem 636302',
            'full_text' => 'Jagir Reddipatti Bus Stop, Salem West, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636302',
            'category' => 'TRANSIT',
            'lat' => 11.68480,
            'lng' => 78.10680,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-salem-jagir-reddipatti-main-road',
            'primary_text' => 'Jagir Reddipatti Main Road',
            'secondary_text' => 'Jagir Reddipatti, Salem West 636302',
            'full_text' => 'Jagir Reddipatti Main Road, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636302',
            'category' => 'ROAD',
            'lat' => 11.68420,
            'lng' => 78.10620,
            'search_weight' => 85
        ],
        [
            'place_id' => 'tn-salem-jagir-post-office',
            'primary_text' => 'Jagir Ammapalayam Branch Post Office',
            'secondary_text' => 'Main Road, Jagir Ammapalayam, Salem 636302',
            'full_text' => 'Jagir Ammapalayam Post Office, Main Road, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636302',
            'category' => 'POST_OFFICE',
            'lat' => 11.67750,
            'lng' => 78.11200,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-salem-jagir-govt-school',
            'primary_text' => 'Govt Higher Secondary School, Jagir Ammapalayam',
            'secondary_text' => 'School Road, Jagir Ammapalayam, Salem 636302',
            'full_text' => 'Government Higher Secondary School, Jagir Ammapalayam, Salem',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636302',
            'category' => 'SCHOOL',
            'lat' => 11.67920,
            'lng' => 78.11050,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-salem-jagir-bus-stop',
            'primary_text' => 'Jagir Ammapalayam Bus Stop',
            'secondary_text' => 'Tharamangalam Main Rd, Salem West, Salem 636302',
            'full_text' => 'Jagir Ammapalayam Bus Stop, Tharamangalam Main Rd, Salem',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636302',
            'category' => 'TRANSIT',
            'lat' => 11.67830,
            'lng' => 78.11180,
            'search_weight' => 88
        ],
        [
            'place_id' => 'tn-salem-jagir-tharamangalam-road',
            'primary_text' => 'Jagir Ammapalayam - Tharamangalam Road',
            'secondary_text' => 'Old Suramangalam to Tharamangalam, Salem',
            'full_text' => 'Jagir Ammapalayam - Tharamangalam Road, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636302',
            'category' => 'ROAD',
            'lat' => 11.67812,
            'lng' => 78.11113,
            'search_weight' => 85
        ],
        [
            'place_id' => 'tn-salem-jagir-mariamman-temple',
            'primary_text' => 'Sri Mariamman Temple, Jagir Ammapalayam',
            'secondary_text' => 'Koil Street, Jagir Ammapalayam, Salem 636302',
            'full_text' => 'Sri Mariamman Temple, Jagir Ammapalayam, Salem',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636302',
            'category' => 'TEMPLE',
            'lat' => 11.67780,
            'lng' => 78.11080,
            'search_weight' => 80
        ],
        [
            'place_id' => 'tn-salem-jagir-uzhavar-santhai',
            'primary_text' => 'Jagir Ammapalayam Farmers Market (Uzhavar Santhai)',
            'secondary_text' => 'Market Rd, Jagir Ammapalayam, Salem 636302',
            'full_text' => 'Jagir Ammapalayam Uzhavar Santhai, Salem',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636302',
            'category' => 'MARKET',
            'lat' => 11.67690,
            'lng' => 78.11250,
            'search_weight' => 80
        ],

        // ==========================================
        // 2. SURAMANGALAM & SALEM JUNCTION CORRIDOR
        // ==========================================
        [
            'place_id' => 'tn-salem-mullai-nagar-suramangalam',
            'primary_text' => 'Mullai Nagar',
            'secondary_text' => 'Suramangalam, Salem, Tamil Nadu 636005',
            'full_text' => 'Mullai Nagar, Suramangalam, Salem, Tamil Nadu 636005',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636005',
            'category' => 'LOCALITY',
            'lat' => 11.67380,
            'lng' => 78.11620,
            'search_weight' => 100
        ],
        [
            'place_id' => 'tn-salem-mullai-nagar-childrens-park',
            'primary_text' => "Mullai Nagar Children's Park",
            'secondary_text' => '4, Mullai Nagar, Suramangalam, Salem 636005',
            'full_text' => "Mullai Nagar Children's Park, Suramangalam, Salem",
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636005',
            'category' => 'PARK',
            'lat' => 11.67420,
            'lng' => 78.11680,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-salem-keerthana-theatre',
            'primary_text' => 'Keerthana-Ramana Theatre',
            'secondary_text' => 'Rajaji St, Mullai Nagar, Suramangalam, Salem 636005',
            'full_text' => 'Keerthana-Ramana Theatre, Rajaji St, Mullai Nagar, Salem',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636005',
            'category' => 'CINEMA',
            'lat' => 11.67280,
            'lng' => 78.11750,
            'search_weight' => 92
        ],
        [
            'place_id' => 'tn-salem-suramangalam',
            'primary_text' => 'Suramangalam',
            'secondary_text' => 'Salem, Tamil Nadu 636005',
            'full_text' => 'Suramangalam, Salem, Tamil Nadu 636005',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636005',
            'category' => 'LOCALITY',
            'lat' => 11.67130,
            'lng' => 78.11890,
            'search_weight' => 100
        ],
        [
            'place_id' => 'tn-salem-old-suramangalam',
            'primary_text' => 'Old Suramangalam',
            'secondary_text' => 'Near Junction, Salem, Tamil Nadu 636005',
            'full_text' => 'Old Suramangalam, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636005',
            'category' => 'LOCALITY',
            'lat' => 11.67300,
            'lng' => 78.11500,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-salem-junction',
            'primary_text' => 'Salem Junction Railway Station',
            'secondary_text' => 'Suramangalam, Salem, Tamil Nadu 636005',
            'full_text' => 'Salem Junction Railway Station, Suramangalam, Salem',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636005',
            'category' => 'STATION',
            'lat' => 11.67130,
            'lng' => 78.11890,
            'search_weight' => 100
        ],
        [
            'place_id' => 'tn-salem-sona-college',
            'primary_text' => 'Sona College of Technology',
            'secondary_text' => 'Junction Main Road, Suramangalam, Salem 636005',
            'full_text' => 'Sona College of Technology, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636005',
            'category' => 'COLLEGE',
            'lat' => 11.67800,
            'lng' => 78.12550,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-salem-thiagarajar-polytechnic',
            'primary_text' => 'Thiagarajar Polytechnic College',
            'secondary_text' => 'TPT Road, Suramangalam, Salem 636005',
            'full_text' => 'Thiagarajar Polytechnic College, Suramangalam, Salem',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636005',
            'category' => 'COLLEGE',
            'lat' => 11.67650,
            'lng' => 78.12300,
            'search_weight' => 85
        ],
        [
            'place_id' => 'tn-salem-mamangam',
            'primary_text' => 'Mamangam Roundana',
            'secondary_text' => 'Bangalore NH 44 Highway, Salem 636302',
            'full_text' => 'Mamangam, NH 44, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636302',
            'category' => 'LOCALITY',
            'lat' => 11.68500,
            'lng' => 78.11940,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-salem-mamangam-bus-stop',
            'primary_text' => 'Mamangam Bus Stop (NH 44)',
            'secondary_text' => 'Bangalore Highway, Mamangam, Salem 636302',
            'full_text' => 'Mamangam Bus Stop, Bangalore Highway, Salem',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636302',
            'category' => 'BUS_STAND',
            'lat' => 11.68550,
            'lng' => 78.11980,
            'search_weight' => 92
        ],
        [
            'place_id' => 'tn-salem-mamangam-junction',
            'primary_text' => 'Mamangam Flyover & Bypass Junction',
            'secondary_text' => 'NH 44 Flyover, Mamangam, Salem 636302',
            'full_text' => 'Mamangam Flyover Junction, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636302',
            'category' => 'JUNCTION',
            'lat' => 11.68480,
            'lng' => 78.11910,
            'search_weight' => 88
        ],
        [
            'place_id' => 'tn-salem-kollapatty',
            'primary_text' => 'Kollapatty',
            'secondary_text' => 'Near Steel Plant Road, Salem West 636030',
            'full_text' => 'Kollapatty, Salem West, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636030',
            'category' => 'LOCALITY',
            'lat' => 11.67070,
            'lng' => 78.08570,
            'search_weight' => 80
        ],
        [
            'place_id' => 'tn-salem-steel-plant',
            'primary_text' => 'Salem Steel Plant (SAIL)',
            'secondary_text' => 'Steel Plant Road, Salem, Tamil Nadu 636013',
            'full_text' => 'Salem Steel Plant SAIL, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636013',
            'category' => 'LANDMARK',
            'lat' => 11.69230,
            'lng' => 78.08450,
            'search_weight' => 95
        ],

        // ==========================================
        // 3. MEYYANUR, FIVE ROADS & FAIRLANDS HUB
        // ==========================================
        [
            'place_id' => 'tn-salem-new-bus-stand',
            'primary_text' => 'New Central Bus Stand (Meyyanur)',
            'secondary_text' => 'Sankari Main Road, Meyyanur, Salem 636004',
            'full_text' => 'New Bus Stand Central, Meyyanur, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636004',
            'category' => 'BUS_STAND',
            'lat' => 11.66430,
            'lng' => 78.14600,
            'search_weight' => 100
        ],
        [
            'place_id' => 'tn-salem-arrs-multiplex',
            'primary_text' => 'ARRS Multiplex (Cinemas)',
            'secondary_text' => 'Meyyanur Bypass Rd, Meyyanur, Salem 636004',
            'full_text' => 'ARRS Multiplex, Meyyanur Bypass Rd, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636004',
            'category' => 'CINEMA',
            'lat' => 11.66520,
            'lng' => 78.14080,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-salem-reliance-mall',
            'primary_text' => 'Reliance Mall & INOX Cinemas',
            'secondary_text' => 'Meyyanur Main Rd, Salem, Tamil Nadu 636004',
            'full_text' => 'Reliance Mall INOX, Meyyanur, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636004',
            'category' => 'MALL',
            'lat' => 11.66400,
            'lng' => 78.13800,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-salem-five-roads',
            'primary_text' => 'Five Roads Junction',
            'secondary_text' => 'Meyyanur / Fairlands, Salem, Tamil Nadu 636004',
            'full_text' => 'Five Roads Junction, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636004',
            'category' => 'JUNCTION',
            'lat' => 11.66850,
            'lng' => 78.13420,
            'search_weight' => 100
        ],
        [
            'place_id' => 'tn-salem-fairlands',
            'primary_text' => 'Fairlands',
            'secondary_text' => 'Brindavan Road, Salem, Tamil Nadu 636016',
            'full_text' => 'Fairlands, Salem, Tamil Nadu 636016',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636016',
            'category' => 'LOCALITY',
            'lat' => 11.67340,
            'lng' => 78.14150,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-salem-kurangu-chavadi',
            'primary_text' => 'Kurangu Chavadi',
            'secondary_text' => 'Omalur Main Rd, Salem, Tamil Nadu 636004',
            'full_text' => 'Kurangu Chavadi, Omalur Main Rd, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636004',
            'category' => 'JUNCTION',
            'lat' => 11.67880,
            'lng' => 78.13820,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-salem-hasthampatti',
            'primary_text' => 'Hasthampatti Roundana',
            'secondary_text' => 'Hasthampatti, Salem, Tamil Nadu 636007',
            'full_text' => 'Hasthampatti Roundana, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636007',
            'category' => 'JUNCTION',
            'lat' => 11.67220,
            'lng' => 78.16100,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-salem-gokulam-hospital',
            'primary_text' => 'Gokulam Hospital & Specialty Centre',
            'secondary_text' => 'Meyyanur, Salem, Tamil Nadu 636004',
            'full_text' => 'Gokulam Hospital, Meyyanur, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636004',
            'category' => 'HOSPITAL',
            'lat' => 11.66680,
            'lng' => 78.13750,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-salem-manipal-hospital',
            'primary_text' => 'Manipal Hospital Salem',
            'secondary_text' => 'Dalmia Board, Bangalore Highway NH 44, Salem 636012',
            'full_text' => 'Manipal Hospital Salem, NH 44, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636012',
            'category' => 'HOSPITAL',
            'lat' => 11.69800,
            'lng' => 78.11200,
            'search_weight' => 95
        ],

        // ==========================================
        // 4. TOWN, FORT, OLD BUS STAND & AMMAPET
        // ==========================================
        [
            'place_id' => 'tn-salem-old-bus-stand',
            'primary_text' => 'Old Bus Stand (Town Bus Stand)',
            'secondary_text' => 'Fort, Salem, Tamil Nadu 636001',
            'full_text' => 'Old Bus Stand, Fort, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636001',
            'category' => 'BUS_STAND',
            'lat' => 11.65480,
            'lng' => 78.16200,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-salem-four-roads',
            'primary_text' => 'Four Roads Junction',
            'secondary_text' => 'Gugai, Salem, Tamil Nadu 636006',
            'full_text' => 'Four Roads Junction, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636006',
            'category' => 'JUNCTION',
            'lat' => 11.65700,
            'lng' => 78.15780,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-salem-ammapet',
            'primary_text' => 'Ammapet Main Bus Stop',
            'secondary_text' => 'Ammapet Main Rd, Salem, Tamil Nadu 636003',
            'full_text' => 'Ammapet, Salem, Tamil Nadu 636003',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636003',
            'category' => 'LOCALITY',
            'lat' => 11.65600,
            'lng' => 78.17500,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-salem-spr-multiplex',
            'primary_text' => 'SPR Multiplex Theatres',
            'secondary_text' => 'Ammapet Main Rd, Salem, Tamil Nadu 636003',
            'full_text' => 'SPR Multiplex, Ammapet, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636003',
            'category' => 'CINEMA',
            'lat' => 11.65750,
            'lng' => 78.17220,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-salem-shevapet',
            'primary_text' => 'Shevapet Bazaar',
            'secondary_text' => 'Fort Main Rd, Shevapet, Salem, Tamil Nadu 636002',
            'full_text' => 'Shevapet Bazaar, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636002',
            'category' => 'MARKET',
            'lat' => 11.65150,
            'lng' => 78.14500,
            'search_weight' => 88
        ],
        [
            'place_id' => 'tn-salem-kailash-cinema',
            'primary_text' => 'Kailash Cinema Complex',
            'secondary_text' => 'Fort Main Rd, Shevapet, Salem, Tamil Nadu 636002',
            'full_text' => 'Kailash Cinema Complex, Shevapet, Salem',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636002',
            'category' => 'CINEMA',
            'lat' => 11.65210,
            'lng' => 78.15120,
            'search_weight' => 85
        ],
        [
            'place_id' => 'tn-salem-gugai',
            'primary_text' => 'Gugai Line Medu',
            'secondary_text' => 'Gugai, Salem, Tamil Nadu 636006',
            'full_text' => 'Gugai, Salem, Tamil Nadu 636006',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636006',
            'category' => 'LOCALITY',
            'lat' => 11.64400,
            'lng' => 78.15600,
            'search_weight' => 85
        ],
        [
            'place_id' => 'tn-salem-kondalampatti',
            'primary_text' => 'Kondalampatti Roundana',
            'secondary_text' => 'NH 44 Bypass, Kondalampatti, Salem 636010',
            'full_text' => 'Kondalampatti Roundana, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636010',
            'category' => 'JUNCTION',
            'lat' => 11.62500,
            'lng' => 78.13200,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-salem-govt-hospital',
            'primary_text' => 'Govt Mohan Kumaramangalam Medical College Hospital',
            'secondary_text' => 'Fort, Salem, Tamil Nadu 636001',
            'full_text' => 'Govt Hospital GH, Fort, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636001',
            'category' => 'HOSPITAL',
            'lat' => 11.65380,
            'lng' => 78.15800,
            'search_weight' => 95
        ],

        // ==========================================
        // 5. PERIYAR UNIVERSITY, OMALUR & AIRPORT
        // ==========================================
        [
            'place_id' => 'tn-salem-periyar-university',
            'primary_text' => 'Periyar University',
            'secondary_text' => 'Bangalore Highway NH 44, Salem 636011',
            'full_text' => 'Periyar University, Bangalore Highway, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636011',
            'category' => 'COLLEGE',
            'lat' => 11.71980,
            'lng' => 78.07720,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-salem-gce',
            'primary_text' => 'Government College of Engineering (GCE)',
            'secondary_text' => 'Bangalore Highway NH 44, Salem 636011',
            'full_text' => 'Government College of Engineering GCE Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636011',
            'category' => 'COLLEGE',
            'lat' => 11.71450,
            'lng' => 78.08200,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-salem-airport',
            'primary_text' => 'Salem Airport (SXV)',
            'secondary_text' => 'Kamalapuram, Omalur, Salem, Tamil Nadu 636309',
            'full_text' => 'Salem Airport SXV, Kamalapuram, Omalur, Salem',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636309',
            'category' => 'AIRPORT',
            'lat' => 11.78330,
            'lng' => 78.06500,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-salem-omalur',
            'primary_text' => 'Omalur Bus Stand',
            'secondary_text' => 'Omalur, Salem District, Tamil Nadu 636455',
            'full_text' => 'Omalur Bus Stand, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636455',
            'category' => 'BUS_STAND',
            'lat' => 11.74500,
            'lng' => 78.04200,
            'search_weight' => 85
        ],
        [
            'place_id' => 'tn-salem-tharamangalam',
            'primary_text' => 'Tharamangalam Kailasanathar Temple',
            'secondary_text' => 'Tharamangalam, Salem District 636502',
            'full_text' => 'Tharamangalam Kailasanathar Temple, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636502',
            'category' => 'TEMPLE',
            'lat' => 11.69600,
            'lng' => 77.97800,
            'search_weight' => 85
        ],
        [
            'place_id' => 'tn-salem-yercaud-foothills',
            'primary_text' => 'Yercaud Foot Hills (Adivaram)',
            'secondary_text' => 'Yercaud Ghat Rd, Salem, Tamil Nadu 636007',
            'full_text' => 'Yercaud Foot Hills, Salem, Tamil Nadu',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636007',
            'category' => 'LANDMARK',
            'lat' => 11.70420,
            'lng' => 78.17650,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-salem-yercaud-lake',
            'primary_text' => 'Yercaud Lake & Boat House',
            'secondary_text' => 'Yercaud Hill Station, Salem District 636601',
            'full_text' => 'Yercaud Lake & Boat House, Yercaud, Salem',
            'city' => 'Salem',
            'district' => 'Salem',
            'pincode' => '636601',
            'category' => 'TOURIST',
            'lat' => 11.77530,
            'lng' => 78.20930,
            'search_weight' => 95
        ],

        // ==========================================
        // 6. MAJOR TAMIL NADU CITIES & HUBS
        // ==========================================
        [
            'place_id' => 'tn-cbe-gandhipuram',
            'primary_text' => 'Gandhipuram Central Bus Stand',
            'secondary_text' => 'Cross Cut Rd, Coimbatore, Tamil Nadu 641012',
            'full_text' => 'Gandhipuram Bus Stand, Coimbatore, Tamil Nadu',
            'city' => 'Coimbatore',
            'district' => 'Coimbatore',
            'pincode' => '641012',
            'category' => 'BUS_STAND',
            'lat' => 11.01680,
            'lng' => 76.96560,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-cbe-airport',
            'primary_text' => 'Coimbatore International Airport (CJB)',
            'secondary_text' => 'Avinashi Rd, Peelamedu, Coimbatore 641014',
            'full_text' => 'Coimbatore Airport CJB, Peelamedu, Coimbatore',
            'city' => 'Coimbatore',
            'district' => 'Coimbatore',
            'pincode' => '641014',
            'category' => 'AIRPORT',
            'lat' => 11.03000,
            'lng' => 77.04340,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-cbe-junction',
            'primary_text' => 'Coimbatore Junction Railway Station',
            'secondary_text' => 'State Bank Rd, Gopalapuram, Coimbatore 641018',
            'full_text' => 'Coimbatore Junction, Gopalapuram, Coimbatore',
            'city' => 'Coimbatore',
            'district' => 'Coimbatore',
            'pincode' => '641018',
            'category' => 'STATION',
            'lat' => 10.99800,
            'lng' => 76.96760,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-chn-central',
            'primary_text' => 'Puratchi Thalaivar Dr. MGR Central Railway Station',
            'secondary_text' => 'Kannappar Thidal, Periyamet, Chennai 600003',
            'full_text' => 'Chennai Central Railway Station, Periyamet, Chennai',
            'city' => 'Chennai',
            'district' => 'Chennai',
            'pincode' => '600003',
            'category' => 'STATION',
            'lat' => 13.08270,
            'lng' => 80.27070,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-chn-airport',
            'primary_text' => 'Chennai International Airport (MAA)',
            'secondary_text' => 'GST Road, Meenambakkam, Chennai 600027',
            'full_text' => 'Chennai International Airport MAA, Meenambakkam, Chennai',
            'city' => 'Chennai',
            'district' => 'Chennai',
            'pincode' => '600027',
            'category' => 'AIRPORT',
            'lat' => 12.99410,
            'lng' => 80.17090,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-mdu-meenakshi',
            'primary_text' => 'Madurai Meenakshi Amman Temple',
            'secondary_text' => 'Madurai Main, Madurai, Tamil Nadu 625001',
            'full_text' => 'Madurai Meenakshi Amman Temple, Madurai, Tamil Nadu',
            'city' => 'Madurai',
            'district' => 'Madurai',
            'pincode' => '625001',
            'category' => 'TEMPLE',
            'lat' => 9.91950,
            'lng' => 78.11930,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-mdu-bus-stand',
            'primary_text' => 'Mattuthavani Integrated Bus Stand (MIBT)',
            'secondary_text' => 'Mattuthavani, Madurai, Tamil Nadu 625007',
            'full_text' => 'Mattuthavani Bus Stand, Madurai, Tamil Nadu',
            'city' => 'Madurai',
            'district' => 'Madurai',
            'pincode' => '625007',
            'category' => 'BUS_STAND',
            'lat' => 9.93920,
            'lng' => 78.16330,
            'search_weight' => 95
        ],
        [
            'place_id' => 'tn-try-central-bus-stand',
            'primary_text' => 'Tiruchirappalli Central Bus Stand',
            'secondary_text' => 'Cantonment, Trichy, Tamil Nadu 620001',
            'full_text' => 'Trichy Central Bus Stand, Cantonment, Trichy',
            'city' => 'Tiruchirappalli',
            'district' => 'Tiruchirappalli',
            'pincode' => '620001',
            'category' => 'BUS_STAND',
            'lat' => 10.79500,
            'lng' => 78.68300,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-erd-bus-stand',
            'primary_text' => 'Erode Central Bus Stand',
            'secondary_text' => 'Brough Rd, Erode, Tamil Nadu 638001',
            'full_text' => 'Erode Central Bus Stand, Brough Rd, Erode',
            'city' => 'Erode',
            'district' => 'Erode',
            'pincode' => '638001',
            'category' => 'BUS_STAND',
            'lat' => 11.34100,
            'lng' => 77.71720,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-tpr-bus-stand',
            'primary_text' => 'Tiruppur Old & New Bus Stand',
            'secondary_text' => 'Tiruppur Central, Tamil Nadu 641601',
            'full_text' => 'Tiruppur Bus Stand, Tiruppur, Tamil Nadu',
            'city' => 'Tiruppur',
            'district' => 'Tiruppur',
            'pincode' => '641601',
            'category' => 'BUS_STAND',
            'lat' => 11.10850,
            'lng' => 77.34110,
            'search_weight' => 90
        ],
        [
            'place_id' => 'tn-nmk-bus-stand',
            'primary_text' => 'Namakkal Bus Stand',
            'secondary_text' => 'Namakkal Town, Tamil Nadu 637001',
            'full_text' => 'Namakkal Bus Stand, Namakkal, Tamil Nadu',
            'city' => 'Namakkal',
            'district' => 'Namakkal',
            'pincode' => '637001',
            'category' => 'BUS_STAND',
            'lat' => 11.21890,
            'lng' => 78.16740,
            'search_weight' => 85
        ],
        [
            'place_id' => 'tn-hsr-bus-stand',
            'primary_text' => 'Hosur Bus Stand & Bagalur Road Hub',
            'secondary_text' => 'Hosur Central, Tamil Nadu 635109',
            'full_text' => 'Hosur Bus Stand, Hosur, Tamil Nadu',
            'city' => 'Hosur',
            'district' => 'Krishnagiri',
            'pincode' => '635109',
            'category' => 'BUS_STAND',
            'lat' => 12.74090,
            'lng' => 77.82530,
            'search_weight' => 85
        ]
    ];

    $insertStmt = $pdo->prepare("
        INSERT INTO `places` (
            `place_id`, `primary_text`, `secondary_text`, `full_text`,
            `city`, `district`, `state`, `pincode`, `category`,
            `lat`, `lng`, `search_weight`
        ) VALUES (
            :place_id, :primary_text, :secondary_text, :full_text,
            :city, :district, :state, :pincode, :category,
            :lat, :lng, :search_weight
        ) ON DUPLICATE KEY UPDATE
            `primary_text` = VALUES(`primary_text`),
            `secondary_text` = VALUES(`secondary_text`),
            `full_text` = VALUES(`full_text`),
            `lat` = VALUES(`lat`),
            `lng` = VALUES(`lng`),
            `search_weight` = VALUES(`search_weight`)
    ");

    $count = 0;
    foreach ($places as $p) {
        $insertStmt->execute([
            ':place_id' => $p['place_id'],
            ':primary_text' => $p['primary_text'],
            ':secondary_text' => $p['secondary_text'],
            ':full_text' => $p['full_text'],
            ':city' => $p['city'],
            ':district' => $p['district'],
            ':state' => 'Tamil Nadu',
            ':pincode' => $p['pincode'],
            ':category' => $p['category'],
            ':lat' => $p['lat'],
            ':lng' => $p['lng'],
            ':search_weight' => $p['search_weight']
        ]);
        $count++;
    }

    echo "Successfully seeded {$count} Tamil Nadu & Salem places!\n";

} catch (Exception $e) {
    echo "Seeding failed: " . $e->getMessage() . "\n";
    exit(1);
}
