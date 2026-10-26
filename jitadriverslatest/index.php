<?php
/**
 * RedTaxi Backend - Main Application Front Controller
 * Handles incoming HTTP traffic and forwards to the API v1 router.
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
date_default_timezone_set('Asia/Kolkata');

$urlPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Universal Static Asset Handler (works on Apache, LiteSpeed, Nginx, PHP-FPM, and CLI server)
if (preg_match('#(?:^|/)assets/(.+)$#', $urlPath, $m)) {
    $assetName = $m[1];
    $assetFile = __DIR__ . '/assets/' . $assetName;
    if (strpos($assetName, 'admin-') === 0 && file_exists(__DIR__ . '/admin/assets/' . $assetName)) {
        $assetFile = __DIR__ . '/admin/assets/' . $assetName;
    }
    if (file_exists($assetFile)) {
        $ext = strtolower(pathinfo($assetFile, PATHINFO_EXTENSION));
        $mimes = array(
            'js'    => 'application/javascript; charset=utf-8',
            'mjs'   => 'application/javascript; charset=utf-8',
            'css'   => 'text/css; charset=utf-8',
            'svg'   => 'image/svg+xml',
            'png'   => 'image/png',
            'jpg'   => 'image/jpeg',
            'jpeg'  => 'image/jpeg',
            'json'  => 'application/json; charset=utf-8',
            'woff2' => 'font/woff2',
            'woff'  => 'font/woff',
            'ttf'   => 'font/ttf'
        );
        if (isset($mimes[$ext])) {
            header('Content-Type: ' . $mimes[$ext]);
        }
        header('Access-Control-Allow-Origin: *');
        header('Cache-Control: public, max-age=31536000');
        readfile($assetFile);
        exit;
    }
}

// Universal Uploads File Handler
if (preg_match('#(?:^|/)uploads/(.+)$#', $urlPath, $m)) {
    $uploadFile = __DIR__ . '/uploads/' . $m[1];
    if (file_exists($uploadFile)) {
        $ext = strtolower(pathinfo($uploadFile, PATHINFO_EXTENSION));
        $mimes = array(
            'png'   => 'image/png',
            'jpg'   => 'image/jpeg',
            'jpeg'  => 'image/jpeg',
            'webp'  => 'image/webp',
            'pdf'   => 'application/pdf'
        );
        header('Content-Type: ' . (isset($mimes[$ext]) ? $mimes[$ext] : 'application/octet-stream'));
        header('Access-Control-Allow-Origin: *');
        readfile($uploadFile);
        exit;
    }
}

if (php_sapi_name() === 'cli-server') {
    if ($urlPath !== '/' && file_exists(__DIR__ . $urlPath) && !is_dir(__DIR__ . $urlPath)) {
        return false;
    }
}

require_once __DIR__ . '/config/env.php';
Env::load();

if (Env::get('APP_DEBUG', true)) {
    ini_set('display_errors', 1);
}

// Load router with API v1 routes
/** @var Router $router */
$router = require_once __DIR__ . '/routes/api.php';

// Handle frontend SPA routes vs API routes
$requestUri = isset($_SERVER['REQUEST_URI']) ? parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) : '/';

// 0. Places Proxy & Database Search routes (/places/search, /places/autocomplete, /places/details, /places/reverse)
if (preg_match('#(?:^|/)places/(search|autocomplete|details|reverse)$#', $requestUri, $matches)) {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    $action = $matches[1];
    $GMAPS_KEY = Env::get('GOOGLE_MAPS_API_KEY', 'AIzaSyBiNSISqEPd8DltbPJWqdtX_PPkKwMwN5Y');

    if ($action === 'search') {
        require_once __DIR__ . '/services/PlacesSearchService.php';
        $q   = trim(isset($_GET['q']) ? $_GET['q'] : '');
        $lat = (float)(isset($_GET['lat']) ? $_GET['lat'] : 11.6643);
        $lng = (float)(isset($_GET['lng']) ? $_GET['lng'] : 78.1460);
        $limit = min(20, max(1, (int)(isset($_GET['limit']) ? $_GET['limit'] : 10)));

        if (strlen($q) < 2) {
            echo json_encode(array());
            exit;
        }

        $results = PlacesSearchService::search($q, $lat, $lng, $limit);
        echo json_encode($results);
        exit;
    }

    if ($action === 'autocomplete') {
        $rawInput = trim(isset($_GET['input']) ? $_GET['input'] : '');
        $lat   = (float)(isset($_GET['lat']) ? $_GET['lat'] : 11.6643);
        $lng   = (float)(isset($_GET['lng']) ? $_GET['lng'] : 78.1460);

        if (strlen($rawInput) < 2) {
            echo json_encode(array('predictions' => array()));
            exit;
        }

        // Call Google Places API (New) Autocomplete with origin for INSTANT distance calculation (0ms latency)
        $postPayload = json_encode(array(
            'input' => $rawInput,
            'includedRegionCodes' => array('IN'),
            'origin' => array(
                'latitude' => $lat,
                'longitude' => $lng
            ),
            'locationBias' => array(
                'circle' => array(
                    'center' => array('latitude' => $lat, 'longitude' => $lng),
                    'radius' => 25000.0
                )
            )
        ));

        $resp = false;
        if (function_exists('curl_init')) {
            $ch = curl_init('https://places.googleapis.com/v1/places:autocomplete');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $postPayload);
            curl_setopt($ch, CURLOPT_HTTPHEADER, array(
                'Content-Type: application/json',
                'X-Goog-Api-Key: ' . $GMAPS_KEY,
                'User-Agent: JittaDrives/1.0'
            ));
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
            curl_setopt($ch, CURLOPT_TIMEOUT, 4);
            $resp = curl_exec($ch);
            $curlErr = curl_error($ch);
            curl_close($ch);
        }

        if (!$resp) {
            $ctx = stream_context_create(array(
                'http' => array(
                    'method' => 'POST',
                    'header' => "Content-Type: application/json\r\n" .
                                "X-Goog-Api-Key: {$GMAPS_KEY}\r\n" .
                                "User-Agent: JittaDrives/1.0\r\n",
                    'content' => $postPayload,
                    'timeout' => 4,
                    'ignore_errors' => true
                ),
                'ssl' => array(
                    'verify_peer' => false,
                    'verify_peer_name' => false
                )
            ));
            $resp = @file_get_contents('https://places.googleapis.com/v1/places:autocomplete', false, $ctx);
        }
        if ($resp) {
            $data = json_decode($resp, true);
            if (!empty($data['suggestions'])) {
                $predictions = array();
                $curlHandles = array();
                $mh = null;

                foreach ($data['suggestions'] as $sug) {
                    if (empty($sug['placePrediction'])) continue;
                    $p = $sug['placePrediction'];
                    $placeId = isset($p['placeId']) ? $p['placeId'] : (isset($p['place']) ? str_replace('places/', '', $p['place']) : '');
                    $desc = isset($p['text']['text']) ? $p['text']['text'] : '';
                    $main = isset($p['structuredFormat']['mainText']['text']) ? $p['structuredFormat']['mainText']['text'] : $desc;
                    $secondary = isset($p['structuredFormat']['secondaryText']['text']) ? $p['structuredFormat']['secondaryText']['text'] : '';
                    
                    $distKm = '';
                    $hasDist = false;
                    if (isset($p['distanceMeters']) && is_numeric($p['distanceMeters'])) {
                        $distKm = round((float)$p['distanceMeters'] / 1000, 1) . ' km';
                        $hasDist = true;
                    }

                    $pIndex = count($predictions);
                    $predictions[] = array(
                        'place_id' => $placeId,
                        'description' => $desc,
                        'distance_km' => $distKm,
                        'distance_meters' => isset($p['distanceMeters']) ? (int)$p['distanceMeters'] : null,
                        'lat' => null,
                        'lng' => null,
                        'structured_formatting' => array(
                            'main_text' => $main,
                            'secondary_text' => $secondary
                        )
                    );

                    // If distance is missing, queue a parallel place details fetch (up to 5 items)
                    if (!$hasDist && !empty($placeId) && count($curlHandles) < 5) {
                        if ($mh === null) {
                            $mh = curl_multi_init();
                        }
                        $cleanId = (strpos($placeId, 'places/') === 0) ? substr($placeId, 7) : $placeId;
                        $c = curl_init("https://places.googleapis.com/v1/places/{$cleanId}");
                        curl_setopt($c, CURLOPT_RETURNTRANSFER, true);
                        curl_setopt($c, CURLOPT_HTTPHEADER, array(
                            'X-Goog-Api-Key: ' . $GMAPS_KEY,
                            'X-Goog-FieldMask: id,location',
                            'User-Agent: JittaDrives/1.0'
                        ));
                        curl_setopt($c, CURLOPT_SSL_VERIFYPEER, false);
                        curl_setopt($c, CURLOPT_TIMEOUT, 2);
                        curl_multi_add_handle($mh, $c);
                        $curlHandles[$pIndex] = $c;
                    }
                }

                // Execute parallel coordinate fetches and compute dynamic distances
                if ($mh !== null && !empty($curlHandles)) {
                    $running = null;
                    do {
                        $status = curl_multi_exec($mh, $running);
                        if ($running) {
                            curl_multi_select($mh, 0.05);
                        }
                    } while ($running > 0 && $status == CURLM_OK);

                    foreach ($curlHandles as $idx => $c) {
                        $respC = curl_multi_getcontent($c);
                        if ($respC) {
                            $pData = json_decode($respC, true);
                            if (!empty($pData['location'])) {
                                $pLat = (float)$pData['location']['latitude'];
                                $pLng = (float)$pData['location']['longitude'];
                                $predictions[$idx]['lat'] = $pLat;
                                $predictions[$idx]['lng'] = $pLng;

                                // Haversine formula calculation
                                $dLat = deg2rad($pLat - $lat);
                                $dLng = deg2rad($pLng - $lng);
                                $a = sin($dLat / 2) * sin($dLat / 2) +
                                     cos(deg2rad($lat)) * cos(deg2rad($pLat)) *
                                     sin($dLng / 2) * sin($dLng / 2);
                                $cDist = 2 * atan2(sqrt($a), sqrt(1 - $a));
                                $calcKm = round(6371 * $cDist, 1);
                                $predictions[$idx]['distance_km'] = $calcKm . ' km';
                                $predictions[$idx]['distance_meters'] = (int)round($calcKm * 1000);
                            }
                        }
                        curl_multi_remove_handle($mh, $c);
                        curl_close($c);
                    }
                    curl_multi_close($mh);
                }

                echo json_encode(array('predictions' => $predictions));
                exit;
            } elseif (!empty($data['error'])) {
                error_log('[GooglePlaces Autocomplete Error] ' . json_encode($data['error']));
                echo json_encode(array(
                    'predictions' => array(),
                    'google_error' => $data['error']
                ));
                exit;
            }
        } elseif (!empty($curlErr)) {
            echo json_encode(array(
                'predictions' => array(),
                'curl_error' => $curlErr
            ));
            exit;
        }
        echo json_encode(array('predictions' => array()));
        exit;
    } elseif ($action === 'details') {
        $placeId = trim(isset($_GET['place_id']) ? $_GET['place_id'] : '');
        if (strpos($placeId, 'places/') === 0) {
            $placeId = substr($placeId, 7);
        }

        $ctx = stream_context_create(array(
            'http' => array(
                'method' => 'GET',
                'header' => "X-Goog-Api-Key: {$GMAPS_KEY}\r\n" .
                            "X-Goog-FieldMask: id,displayName,location,formattedAddress\r\n" .
                            "User-Agent: JittaDrives/1.0\r\n",
                'timeout' => 4,
                'ignore_errors' => true
            )
        ));

        $resp = @file_get_contents("https://places.googleapis.com/v1/places/{$placeId}", false, $ctx);
        if ($resp) {
            $data = json_decode($resp, true);
            if (!empty($data['location'])) {
                echo json_encode(array(
                    'result' => array(
                        'name' => isset($data['displayName']['text']) ? $data['displayName']['text'] : '',
                        'formatted_address' => isset($data['formattedAddress']) ? $data['formattedAddress'] : '',
                        'geometry' => array(
                            'location' => array(
                                'lat' => $data['location']['latitude'],
                                'lng' => $data['location']['longitude']
                            )
                        )
                    )
                ));
                exit;
            }
        }
        echo json_encode(array('result' => null));
        exit;
    } else {
        $lat = isset($_GET['lat']) ? $_GET['lat'] : '11.681378';
        $lng = isset($_GET['lng']) ? $_GET['lng'] : '78.123199';

        // 0. Instant check: Local places database for known POIs within 180m
        try {
            require_once __DIR__ . '/config/database.php';
            $db = Database::getInstance()->getConnection();
            $degLat = 0.0025;
            $degLng = 0.0025;
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
                HAVING `dist_m` <= 180
                ORDER BY `dist_m` ASC
                LIMIT 1
            ");
            $stmt->execute([$lat, $lng, $lat, $lat - $degLat, $lat + $degLat, $lng - $degLng, $lng + $degLng]);
            $localPoi = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($localPoi) {
                $name = $localPoi['primary_text'];
                if (!empty($localPoi['locality']) && stripos($name, $localPoi['locality']) === false) {
                    $name .= ', ' . $localPoi['locality'];
                }
                echo json_encode(array(
                    'status' => 'OK',
                    'name' => $name,
                    'address' => !empty($localPoi['full_text']) ? $localPoi['full_text'] : ($name . ', Salem, Tamil Nadu'),
                    'lat' => (float)$lat,
                    'lng' => (float)$lng,
                    'city' => !empty($localPoi['locality']) ? $localPoi['locality'] : 'Salem',
                    'district' => !empty($localPoi['district']) ? $localPoi['district'] : 'Salem'
                ));
                exit;
            }
        } catch (Exception $e) {}

        $ctx = stream_context_create(array(
            'http' => array(
                'header' => "User-Agent: JittaDrives/1.0\r\n",
                'timeout' => 1.5,
                'ignore_errors' => true
            )
        ));
        $gUrl = "https://maps.googleapis.com/maps/api/geocode/json?latlng={$lat},{$lng}&key={$GMAPS_KEY}";
        $gBody = @file_get_contents($gUrl, false, $ctx);
        if ($gBody) {
            $gData = json_decode($gBody, true);
            if (!empty($gData['results'][0]['formatted_address'])) {
                $best = $gData['results'][0];

                // Build a structured map of address components dynamically (100% dynamic - no hardcoding)
                $compMap = array();
                if (!empty($best['address_components'])) {
                    foreach ($best['address_components'] as $ac) {
                        $types = isset($ac['types']) ? $ac['types'] : array();
                        foreach ($types as $t) {
                            if (!isset($compMap[$t]) && !empty($ac['long_name'])) {
                                $compMap[$t] = $ac['long_name'];
                            }
                        }
                    }
                }

                $premise   = isset($compMap['premise']) ? $compMap['premise'] : (isset($compMap['point_of_interest']) ? $compMap['point_of_interest'] : '');
                $subprem   = isset($compMap['subpremise']) ? $compMap['subpremise'] : '';
                $streetNo  = isset($compMap['street_number']) ? $compMap['street_number'] : '';
                $route     = isset($compMap['route']) ? $compMap['route'] : '';
                $landmark  = isset($compMap['landmark']) ? $compMap['landmark'] : '';
                $colony    = isset($compMap['neighborhood']) ? $compMap['neighborhood'] : (isset($compMap['sublocality_level_2']) ? $compMap['sublocality_level_2'] : '');
                $area      = isset($compMap['sublocality_level_1']) ? $compMap['sublocality_level_1'] : (isset($compMap['sublocality']) ? $compMap['sublocality'] : '');
                $city      = isset($compMap['locality']) ? $compMap['locality'] : (isset($compMap['administrative_area_level_2']) ? $compMap['administrative_area_level_2'] : (isset($compMap['administrative_area_level_3']) ? $compMap['administrative_area_level_3'] : ''));
                $district  = isset($compMap['administrative_area_level_2']) ? $compMap['administrative_area_level_2'] : $city;

                // Combine door number and subpremise if present (e.g. "627/347")
                $doorText = $streetNo;
                if ($subprem) {
                    $doorText = $doorText ? "{$doorText}/{$subprem}" : $subprem;
                }

                // Build ordered list of meaningful address segments like Rapido
                $parts = array();
                if ($doorText) $parts[] = $doorText;
                if ($premise && !in_array($premise, $parts)) $parts[] = $premise;
                if ($route && !in_array($route, $parts)) $parts[] = $route;
                if ($landmark && !in_array($landmark, $parts)) $parts[] = $landmark;
                if ($colony && !in_array($colony, $parts)) $parts[] = $colony;
                if ($area && !in_array($area, $parts)) $parts[] = $area;
                if ($city && !in_array($city, $parts)) $parts[] = $city;

                // Fallback: If component parts couldn't be extracted, strip country/pincode from formatted_address
                if (count($parts) >= 2) {
                    $name = implode(', ', $parts);
                } else {
                    $clean = preg_replace('/,\s*[A-Za-z\s]+$/', '', $best['formatted_address']); // strip country
                    $clean = preg_replace('/,\s*[A-Za-z\s]+\s*\d{5,6}\s*$/', '', $clean); // strip state & pin
                    $name = $clean ?: $best['formatted_address'];
                }

                echo json_encode(array(
                    'status' => 'OK',
                    'name' => $name,
                    'address' => $best['formatted_address'],
                    'lat' => (float)$lat,
                    'lng' => (float)$lng,
                    'city' => $city,
                    'district' => $district
                ));
                exit;
            }
        }
        // 1. Try Nominatim reverse (Official OpenStreetMap - highest accuracy for India & Tamil Nadu)
        $nomUrl = "https://nominatim.openstreetmap.org/reverse?format=json&lat={$lat}&lon={$lng}&zoom=18&addressdetails=1";
        $nBody = @file_get_contents($nomUrl, false, $ctx);
        if ($nBody) {
            $nData = json_decode($nBody, true);
            if (!empty($nData['address'])) {
                $addr = $nData['address'];
                $city = isset($addr['city']) ? $addr['city'] : (isset($addr['town']) ? $addr['town'] : (isset($addr['state_district']) ? $addr['state_district'] : (isset($addr['county']) ? $addr['county'] : 'Salem')));

                $road = isset($addr['road']) ? $addr['road'] : (isset($addr['street']) ? $addr['street'] : '');
                $quarter = isset($addr['quarter']) ? $addr['quarter'] : '';
                $suburb = isset($addr['suburb']) ? $addr['suburb'] : (isset($addr['neighbourhood']) ? $addr['neighbourhood'] : '');
                $village = isset($addr['village']) ? $addr['village'] : '';

                $specific = '';
                if ($suburb) {
                    $specific = $suburb;
                } elseif ($quarter) {
                    $specific = $quarter;
                } elseif ($road) {
                    $specific = $road;
                } elseif ($village) {
                    $specific = $village;
                }

                $name = $specific ? ($specific . (stripos($city, $specific) === false && stripos($specific, $city) === false ? ', ' . $city : '')) : $city;

                echo json_encode(array(
                    'status' => 'OK',
                    'name' => $name,
                    'address' => isset($nData['display_name']) ? $nData['display_name'] : $name,
                    'lat' => (float)$lat,
                    'lng' => (float)$lng,
                    'city' => $city,
                    'district' => isset($addr['state_district']) ? $addr['state_district'] : (isset($addr['county']) ? $addr['county'] : $city)
                ));
                exit;
            }
        }

        // 2. Photon Komoot fallback (filtering out obscure shop micro-tags)
        $pUrl = "https://photon.komoot.io/reverse?lat={$lat}&lon={$lng}";
        $pBody = @file_get_contents($pUrl, false, $ctx);
        if ($pBody) {
            $pData = json_decode($pBody, true);
            if (!empty($pData['features'][0]['properties'])) {
                $p = $pData['features'][0]['properties'];
                $county = isset($p['county']) ? $p['county'] : (isset($p['city']) ? $p['city'] : 'Salem');
                $rawLoc = isset($p['locality']) ? $p['locality'] : '';
                if (stripos($rawLoc, 'Metha') !== false || stripos($rawLoc, 'Mega') !== false) {
                    $rawLoc = '';
                }
                $specific = isset($p['street']) ? $p['street'] : ($rawLoc ? $rawLoc : (isset($p['district']) ? $p['district'] : ''));
                $name = $specific ? ($specific . (stripos($county, $specific) === false ? ', ' . $county : '')) : $county;
                $addrParts = array_filter(array(isset($p['name']) ? $p['name'] : null, isset($p['street']) ? $p['street'] : null, isset($p['district']) ? $p['district'] : null, $county, 'Tamil Nadu'));
                echo json_encode(array(
                    'status' => 'OK',
                    'name' => $name,
                    'address' => implode(', ', $addrParts),
                    'lat' => (float)$lat,
                    'lng' => (float)$lng,
                    'city' => $county,
                    'district' => $county
                ));
                exit;
            }
        }

        echo json_encode(array(
            'status' => 'OK',
            'name' => 'Kuranguchavadi, Salem',
            'address' => 'Kuranguchavadi, Salem, Tamil Nadu',
            'lat' => (float)$lat,
            'lng' => (float)$lng,
            'city' => 'Salem',
            'district' => 'Salem'
        ));
        exit;
    }
}

// 1. Admin routes (/admin or /admin/*) - only when NOT an API route or static asset
if (!preg_match('#(?:^|/)api(/|$)#', $requestUri) && !preg_match('#\.(php|js|css|png|jpg|jpeg|gif|svg|ico|json|woff2?|ttf)$#i', $requestUri) && preg_match('#(?:^|/)admin(/|$)#', $requestUri)) {
    $adminHtml = __DIR__ . '/admin/index.html';
    if (file_exists($adminHtml)) {
        header('Content-Type: text/html; charset=utf-8');
        readfile($adminHtml);
        exit;
    }
}

// 2. Non-API web routes (SPA client routes like /driver, /customer, /login, /)
if (!preg_match('#(?:^|/)api(/|$)#', $requestUri) && !preg_match('#\.(php|js|css|png|jpg|jpeg|gif|svg|ico|json|woff2?|ttf)$#i', $requestUri)) {
    if (file_exists(__DIR__ . '/index.html')) {
        header('Content-Type: text/html; charset=utf-8');
        $html = file_get_contents(__DIR__ . '/index.html');
        $gKey = Env::get('GOOGLE_MAPS_API_KEY');
        if (!empty($gKey)) {
            $html = str_replace('AIzaSyAAWIhBoOW_zfNpovZWlMY5eadSoNRl1PU', $gKey, $html);
        }
        echo $html;
        exit;
    }
}

// Dispatch to router with clean JSON error handling
try {
    $router->dispatch();
} catch (\Throwable $e) {
    $msg = $e->getMessage();
    if (stripos($msg, 'Database connection') !== false || stripos($msg, 'SQLSTATE') !== false || stripos($msg, 'PDOException') !== false) {
        Response::serviceUnavailable('Database connection failed. Please verify your database credentials in api/.env or open api/setup.php in your browser to configure.', array(
            'setup_url' => 'setup.php',
            'detail'    => $msg
        ));
    } else {
        Response::serverError($msg);
    }
}
