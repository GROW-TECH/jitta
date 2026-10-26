<?php
/**
 * JittaDrives Local Development Router (Frontend & Admin & API Proxy)
 * Usage: php -S 127.0.0.1:3000 router_frontend.php
 */

require_once __DIR__ . '/config/env.php';
Env::load();

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Helper function to serve static files with proper MIME headers
function serveStaticFile($path) {
    if (!file_exists($path) || is_dir($path)) {
        return false;
    }

    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $mimeTypes = [
        'js'   => 'application/javascript; charset=utf-8',
        'mjs'  => 'application/javascript; charset=utf-8',
        'css'  => 'text/css; charset=utf-8',
        'html' => 'text/html; charset=utf-8',
        'svg'  => 'image/svg+xml',
        'png'  => 'image/png',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif'  => 'image/gif',
        'json' => 'application/json; charset=utf-8',
        'woff2'=> 'font/woff2',
        'woff' => 'font/woff',
        'ttf'  => 'font/ttf',
    ];

    if (isset($mimeTypes[$ext])) {
        header('Content-Type: ' . $mimeTypes[$ext]);
    }
    
    readfile($path);
    exit;
}

// 1. If requesting asset directly starting with /assets/admin-* translate to /admin/assets/admin-*
if (preg_match('#^/assets/(admin-[^/]+)$#', $uri, $matches)) {
    $adminAsset = __DIR__ . '/admin/assets/' . $matches[1];
    if (file_exists($adminAsset)) {
        serveStaticFile($adminAsset);
    }
}

// 1b. Nested SPA asset requests (e.g. /driver/assets/* or /customer/assets/* or /user/assets/*)
if (preg_match('#^/(?:driver|customer|user)/assets/(.+)$#', $uri, $matches)) {
    $asset = __DIR__ . '/assets/' . $matches[1];
    if (file_exists($asset)) {
        serveStaticFile($asset);
    }
}

// 1c. Admin asset requests (/admin/assets/*)
if (preg_match('#^/admin/assets/(.+)$#', $uri, $matches)) {
    $adminAsset = __DIR__ . '/admin/assets/' . $matches[1];
    if (file_exists($adminAsset)) {
        serveStaticFile($adminAsset);
    }
    $fallback = __DIR__ . '/assets/' . $matches[1];
    if (file_exists($fallback)) {
        serveStaticFile($fallback);
    }
}

// 2. Serve physical file directly if exists
$filePath = __DIR__ . $uri;
if ($uri !== '/' && file_exists($filePath) && !is_dir($filePath)) {
    serveStaticFile($filePath);
}

// 3. Search proxy & Rapido-Style Location Search Engine
if ($uri === '/places/search') {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    require_once __DIR__ . '/services/PlacesSearchService.php';

    $q   = trim($_GET['q'] ?? '');
    $lat = (float)($_GET['lat'] ?? 11.6643);
    $lng = (float)($_GET['lng'] ?? 78.1460);
    $limit = min(20, max(1, (int)($_GET['limit'] ?? 10)));

    if (strlen($q) < 2) {
        echo json_encode([]);
        exit;
    }

    $results = PlacesSearchService::search($q, $lat, $lng, $limit);
    echo json_encode($results);
    exit;
}

if (preg_match('#^/places/(autocomplete|details|reverse)$#', $uri, $m)) {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    $GMAPS_KEY = Env::get('GOOGLE_MAPS_API_KEY', 'AIzaSyAAWIhBoOW_zfNpovZWlMY5eadSoNRl1PU');

    if ($m[1] === 'autocomplete') {
        $input  = urlencode($_GET['input'] ?? '');
        $lat    = $_GET['lat'] ?? '11.6643';
        $lng    = $_GET['lng'] ?? '78.1460';
        $url    = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
                . "?input={$input}&location={$lat},{$lng}&radius=50000"
                . "&components=country:in&language=en&key={$GMAPS_KEY}";
    } elseif ($m[1] === 'details') {
        $placeId = urlencode($_GET['place_id'] ?? '');
        $url     = "https://maps.googleapis.com/maps/api/place/details/json"
                 . "?place_id={$placeId}&fields=geometry,formatted_address,name"
                 . "&key={$GMAPS_KEY}";
    } else {
        // reverse geocode: /places/reverse?lat=...&lng=...
        $lat = $_GET['lat'] ?? '11.6643';
        $lng = $_GET['lng'] ?? '78.1460';
        $ctx = stream_context_create([
            'http' => [
                'header' => "User-Agent: JittaDrives/1.0\r\n",
                'timeout' => 1.5,
                'ignore_errors' => true
            ]
        ]);
        // 0. Check local high-precision places database for known POIs within 120m
        $localPoi = null;
        try {
            require_once __DIR__ . '/config/database.php';
            $db = Database::getInstance()->getConnection();
            $degLat = 0.0018; // ~200m
            $degLng = 0.0018;
            $stmt = $db->prepare("
                SELECT `primary_text`, `locality`, `district`, `full_text`, `lat`, `lng`,
                       (6371000 * acos(
                           LEAST(1.0, GREATEST(-1.0, 
                               cos(radians(?)) * cos(radians(`lat`)) * cos(radians(`lng`) - radians(?)) +
                               sin(radians(?)) * sin(radians(`lat`))
                           ))
                       )) AS `dist_m`
                FROM `places`
                WHERE `lat` BETWEEN ? AND ? AND `lng` BETWEEN ? AND ?
                  AND `place_type` NOT IN ('LOCALITY', 'DISTRICT')
                HAVING `dist_m` <= 120
                ORDER BY `dist_m` ASC
                LIMIT 1
            ");
            $stmt->execute([$lat, $lng, $lat, $lat - $degLat, $lat + $degLat, $lng - $degLng, $lng + $degLng]);
            $localPoi = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}

        if ($localPoi) {
            $name = $localPoi['primary_text'];
            if (!empty($localPoi['locality']) && stripos($name, $localPoi['locality']) === false) {
                $name .= ', ' . $localPoi['locality'];
            }
            echo json_encode([
                'status' => 'OK',
                'name' => $name,
                'address' => !empty($localPoi['full_text']) ? $localPoi['full_text'] : ($name . ', Salem, Tamil Nadu'),
                'lat' => (float)$lat,
                'lng' => (float)$lng,
                'city' => !empty($localPoi['locality']) ? $localPoi['locality'] : 'Salem',
                'district' => !empty($localPoi['district']) ? $localPoi['district'] : 'Salem'
            ]);
            exit;
        }

        // Helper to format clean landmark title (Locality, City)
        $formatName = function($poi, $road, $suburb, $city) {
            $city = trim($city ?: 'Salem');
            $primary = '';
            if (!empty($poi)) {
                $primary = trim($poi);
            } elseif (!empty($suburb)) {
                $primary = trim($suburb);
            } elseif (!empty($road)) {
                $primary = trim($road);
            } else {
                $primary = $city;
            }

            if (!empty($city) && stripos($primary, $city) === false) {
                return "{$primary}, {$city}";
            }
            return $primary;
        };

        // 1. Try Nominatim reverse (Official OpenStreetMap - highest accuracy for landmarks & POIs in India)
        $nomUrl = "https://nominatim.openstreetmap.org/reverse?format=json&lat={$lat}&lon={$lng}&zoom=18&addressdetails=1";
        $nBody = @file_get_contents($nomUrl, false, $ctx);
        if ($nBody) {
            $nData = json_decode($nBody, true);
            if (!empty($nData['address'])) {
                $addr = $nData['address'];
                $city = $addr['city'] ?? $addr['town'] ?? $addr['state_district'] ?? $addr['county'] ?? 'Salem';
                $suburb = $addr['suburb'] ?? $addr['neighbourhood'] ?? $addr['quarter'] ?? '';
                $road = $addr['road'] ?? $addr['street'] ?? '';
                $village = $addr['village'] ?? '';

                // Extract Landmark / POI / Building name with highest precision
                $poi = trim($nData['name'] ?? '');

                if (empty($poi)) {
                    $poiKeys = [
                        'amenity', 'cinema', 'theatre', 'theater', 'building', 'mall', 'shop',
                        'tourism', 'hospital', 'clinic', 'college', 'school', 'university',
                        'hotel', 'restaurant', 'place_of_worship', 'temple', 'mosque', 'church',
                        'railway', 'bus_station', 'leisure', 'attraction', 'commercial'
                    ];
                    foreach ($poiKeys as $pk) {
                        if (!empty($addr[$pk])) {
                            $poi = trim($addr[$pk]);
                            break;
                        }
                    }
                }

                // If Nominatim didn't identify building, use local DB POI if very close (< 60m)
                if (empty($poi) && $localPoi && !empty($localPoi['primary_text'])) {
                    $poi = trim($localPoi['primary_text']);
                }

                if (empty($poi) && !empty($nData['display_name'])) {
                    $parts = array_map('trim', explode(',', $nData['display_name']));
                    if (count($parts) > 0) {
                        $p0 = $parts[0];
                        if (!preg_match('/^[0-9\-\/]+$/', $p0) && 
                            stripos($road, $p0) === false && 
                            stripos($suburb, $p0) === false && 
                            stripos($city, $p0) === false && 
                            stripos($p0, 'Tamil Nadu') === false) {
                            $poi = $p0;
                        }
                    }
                }

                $name = $formatName($poi, $road, $suburb ?: $village, $city);

                echo json_encode([
                    'status' => 'OK',
                    'name' => $name,
                    'address' => $nData['display_name'] ?? $name,
                    'lat' => (float)$lat,
                    'lng' => (float)$lng,
                    'city' => $city,
                    'district' => $addr['state_district'] ?? $addr['county'] ?? $city
                ]);
                exit;
            }
        }

        // 2. Photon Komoot fallback
        $pRevUrl = "https://photon.komoot.io/reverse?lat={$lat}&lon={$lng}";
        $pBody = @file_get_contents($pRevUrl, false, $ctx);
        if ($pBody) {
            $pData = json_decode($pBody, true);
            if (!empty($pData['features'][0]['properties'])) {
                $p = $pData['features'][0]['properties'];
                $city = $p['city'] ?? $p['county'] ?? 'Salem';
                $suburb = $p['locality'] ?? $p['district'] ?? '';
                $road = $p['street'] ?? '';
                $poi = $localPoi ? $localPoi['primary_text'] : ($p['name'] ?? '');
                if ($poi === $road || $poi === $suburb) $poi = '';

                $name = $formatName($poi, $road, $suburb, $city);
                $addrParts = array_filter([$poi, $road, $suburb, $city, 'Tamil Nadu']);
                echo json_encode([
                    'status' => 'OK',
                    'name' => $name,
                    'address' => implode(', ', $addrParts),
                    'lat' => (float)$lat,
                    'lng' => (float)$lng,
                    'city' => $city,
                    'district' => $city
                ]);
                exit;
            }
        }

        echo json_encode([
            'status' => 'OK',
            'name' => 'Salem, Tamil Nadu',
            'address' => "Lat: {$lat}, Lng: {$lng}, Salem, Tamil Nadu",
            'lat' => (float)$lat,
            'lng' => (float)$lng,
            'city' => 'Salem',
            'district' => 'Salem'
        ]);
        exit;
    }

    $ctx = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);
    $body = @file_get_contents($url, false, $ctx);
    echo $body !== false ? $body : json_encode(['status' => 'ERROR', 'error_message' => 'Proxy fetch failed']);
    exit;
}

// 4. Handle API requests (/api/*)
if (preg_match('#^/api(/|$)#', $uri)) {
    require __DIR__ . '/index.php';
    exit;
}

// 4. Handle Admin Panel requests (/admin or /admin/*)
if (preg_match('#^/admin(/|$)#', $uri)) {
    $adminHtml = __DIR__ . '/admin/index.html';
    if (file_exists($adminHtml)) {
        header('Content-Type: text/html; charset=utf-8');
        readfile($adminHtml);
        exit;
    }
}

// 5. Handle Customer Frontend SPA fallback (all other non-file requests)
$customerHtml = __DIR__ . '/index.html';
if (file_exists($customerHtml)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($customerHtml);
    exit;
}

http_response_code(404);
echo "404 Not Found";
