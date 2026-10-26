<?php
/**
 * Rapido-Style Location Search Engine
 * High-performance, zero-cost, local-first search across Tamil Nadu & Salem
 * 100% Compatible with PHP 5.6+, PHP 7.x, PHP 8.x
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/env.php';

class PlacesSearchService
{
    private static $pdo = null;

    private static function getPdo()
    {
        if (self::$pdo === null) {
            self::$pdo = Database::getInstance()->getConnection();
        }
        return self::$pdo;
    }

    /**
     * Common Tamil Nadu phonetic & misspelling normalization dictionary
     */
    private static $spellingCorrections = array(
        'jageer'       => 'jagir',
        'sooramangalam'=> 'suramangalam',
        'suram'        => 'suramangalam',
        'mamangam'     => 'mamangam',
        'maman'        => 'mamangam',
        'redipatti'    => 'reddipatti',
        'hasthampaty'  => 'hasthampatti',
        'hasthampatty' => 'hasthampatti',
        'meyanoor'     => 'meyyanur',
        'omaloor'      => 'omalur',
        'salem jn'     => 'salem junction',
        'salem station'=> 'salem junction',
        'buss stand'   => 'bus stand',
        'bustand'      => 'bus stand',
        'central bus'  => 'bus stand',
        'uzhavar santha'=> 'uzhavar santhai',
        'fairland'     => 'fairlands',
        'kondalampaty' => 'kondalampatti',
        'velacherry'   => 'velachery',
        'peelamedu'    => 'peelamedu',
        'gandhipuram'  => 'gandhipuram',
        'coimbatore jn'=> 'coimbatore junction',
        'chennai central'=> 'puratchi thalaivar dr. m.g. ramachandran central'
    );

    /**
     * Normalize search query
     */
    public static function normalizeQuery($raw)
    {
        $clean = trim($raw);
        $clean = preg_replace('/[,\.\-_+]+/i', ' ', $clean);
        $clean = preg_replace('/\s+/', ' ', $clean);
        $lower = strtolower($clean);

        // Check dictionary variations
        $corrected = $lower;
        foreach (self::$spellingCorrections as $typo => $fixed) {
            if ($lower === $typo || strpos($lower, $typo . ' ') === 0 || strpos($lower, ' ' . $typo) !== false) {
                $corrected = str_replace($typo, $fixed, $lower);
            }
        }

        $alphaNumeric = preg_replace('/[^a-z0-9]/', '', $corrected);

        return array(
            'original'   => $raw,
            'clean'      => $clean,
            'corrected'  => $corrected,
            'normalized' => $alphaNumeric,
            'tokens'     => array_filter(explode(' ', $corrected))
        );
    }

    /**
     * Search locations using multi-stage ranking algorithm
     */
    public static function search($query, $userLat = 11.6643, $userLng = 78.1460, $limit = 10)
    {
        $userLat = (float)$userLat;
        $userLng = (float)$userLng;
        $limit   = (int)$limit;

        $qInfo = self::normalizeQuery($query);
        $searchTerm = $qInfo['corrected'];
        $clean = $qInfo['clean'];
        $normQ = $qInfo['normalized'];

        if (strlen($clean) < 2) {
            return array();
        }

        $pdo = self::getPdo();
        $results = array();
        $seenKeys = array();

        try {
            // High-performance MariaDB/MySQL SQL query with relevance scoring and proximity falloff
            $sql = "
                SELECT 
                    `id`, `place_id`, `source_id`, `primary_text`, `secondary_text`, `full_text`,
                    `locality`, `district`, `state`, `pincode`, `category`, `place_type`,
                    `lat`, `lng`, `search_weight`,
                    (6371 * acos(
                        LEAST(1.0, GREATEST(-1.0, 
                            cos(radians(?)) * cos(radians(`lat`)) * cos(radians(`lng`) - radians(?)) +
                            sin(radians(?)) * sin(radians(`lat`))
                        ))
                    ) * 1.3) AS `distance_km`,
                    (
                        -- Tier 1: Exact Name Match
                        CASE 
                            WHEN LOWER(`primary_text`) = ? THEN 120
                            WHEN `normalized_name` = ? THEN 110
                            -- Tier 2: Prefix on Name
                            WHEN LOWER(`primary_text`) LIKE ? THEN 90
                            -- Tier 3: Word-boundary match in Name
                            WHEN LOWER(`primary_text`) LIKE ? THEN 75
                            -- Tier 4: Substring in Name
                            WHEN LOWER(`primary_text`) LIKE ? THEN 60
                            -- Tier 5: Match in Locality or District
                            WHEN LOWER(`locality`) LIKE ? OR LOWER(`district`) LIKE ? THEN 45
                            -- Tier 6: Substring in Full Address
                            WHEN LOWER(`full_text`) LIKE ? THEN 35
                            ELSE 10
                        END
                        -- Category / Place Type Weight
                        + CASE 
                            WHEN `place_type` IN ('STATION', 'BUS_STAND', 'AIRPORT') THEN 25
                            WHEN `place_type` IN ('LOCALITY') THEN 15
                            WHEN `place_type` IN ('HOSPITAL', 'COLLEGE', 'SCHOOL') THEN 15
                            WHEN `place_type` IN ('MALL', 'MARKET', 'CINEMA', 'LANDMARK') THEN 12
                            ELSE 5
                        END
                        + (`search_weight` * 0.2)
                    ) AS `relevance_score`
                FROM `places`
                WHERE 
                    `primary_text` LIKE ?
                    OR `primary_text` LIKE ?
                    OR `secondary_text` LIKE ?
                    OR `full_text` LIKE ?
                    OR `normalized_name` LIKE ?
                    OR `locality` LIKE ?
                    OR `district` LIKE ?
                ORDER BY 
                    -- Proximity boost: prioritize nearby locations when typing local queries,
                    -- and heavily penalize distant localities (> 45 km) unless query explicitly requests them
                    (`relevance_score` + 
                        CASE 
                            WHEN `distance_km` < 25.0 THEN (40.0 * (1.0 - (`distance_km` / 25.0)))
                            WHEN `distance_km` > 45.0 THEN -60.0
                            ELSE 0.0
                        END
                    ) DESC,
                    `distance_km` ASC
                LIMIT " . ($limit * 2) . "
            ";

            $exactName   = strtolower($clean);
            $prefixName  = $searchTerm . '%';
            $wordPrefix  = '% ' . $searchTerm . '%';
            $subWildcard = '%' . $searchTerm . '%';
            $normPrefix  = $normQ . '%';

            $stmt = $pdo->prepare($sql);
            $stmt->execute(array(
                // Proximity distance formula params (3)
                $userLat, $userLng, $userLat,
                // Score CASE params (9)
                $exactName, $normQ,
                $prefixName,
                $wordPrefix,
                $subWildcard,
                $subWildcard, $subWildcard,
                $subWildcard,
                // WHERE params (7)
                $prefixName,
                $subWildcard,
                $subWildcard,
                $subWildcard,
                $normPrefix,
                $subWildcard,
                $subWildcard
            ));

            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Smart Deduplication: Preserve distinct localities & POIs, collapse duplicate road segments
            foreach ($rows as $row) {
                $pName = trim($row['primary_text']);
                $sec   = trim($row['secondary_text']);
                $type  = strtoupper(isset($row['place_type']) ? $row['place_type'] : 'LOCALITY');
                $lat   = (float)$row['lat'];
                $lng   = (float)$row['lng'];
                $dist  = isset($row['distance_km']) ? round((float)$row['distance_km'], 1) : 1.0;

                // Unique key composed of Place Name + Locality/District
                $locVal = !empty($row['locality']) ? $row['locality'] : $row['district'];
                $dedupKey = strtolower($pName . '|' . $locVal);

                if (isset($seenKeys[$dedupKey])) {
                    continue;
                }

                if ($type === 'ROAD') {
                    $roadKey = 'road-' . strtolower(preg_replace('/[^a-z0-9]/', '', $pName));
                    if (isset($seenKeys[$roadKey])) {
                        continue;
                    }
                    $seenKeys[$roadKey] = true;
                }

                $seenKeys[$dedupKey] = true;

                // Ride-hailing local relevance filter:
                // If user didn't explicitly request another district/city, skip distant places (> 50 km) once local matches are present
                $isInterCity = (bool)preg_match('/\b(chennai|coimbatore|bangalore|bengaluru|trichy|tiruchirappalli|madurai|erode|namakkal|karur|dharmapuri|krishnagiri|hosur|vellore|tiruppur|nagapattinam|thanjavur|sirkali)\b/i', $clean);
                if (!$isInterCity && $dist > 50.0 && count($results) > 0) {
                    continue;
                }

                $locality = !empty($row['locality']) ? $row['locality'] : (!empty($row['district']) ? $row['district'] : 'Salem');
                $district = !empty($row['district']) ? $row['district'] : 'Salem';
                $category = !empty($row['category']) ? $row['category'] : 'LOCALITY';

                $results[] = array(
                    'placeId'       => !empty($row['place_id']) ? $row['place_id'] : ('tn-' . $row['id']),
                    'sourceId'      => !empty($row['source_id']) ? $row['source_id'] : ('local-db-' . $row['id']),
                    'primaryText'   => $pName,
                    'secondaryText' => $sec,
                    'fullText'      => $row['full_text'],
                    'locality'      => $locality,
                    'district'      => $district,
                    'placeType'     => $type,
                    'category'      => $category,
                    'lat'           => $lat,
                    'lng'           => $lng,
                    'distanceKm'    => $dist . ' km',
                    'source'        => 'local_database'
                );

                if (count($results) >= $limit) {
                    break;
                }
            }

        } catch (Exception $dbErr) {
            error_log('[PlacesSearchService] DB Error: ' . $dbErr->getMessage());
        }

        // =========================================================
        // Configurable OSM / Photon Fallback
        // Triggers only when local database results are zero or insufficient (< 3 without high-confidence match)
        // =========================================================
        $enableFallback = Env::get('ENABLE_OSM_FALLBACK', true);
        $hasHighConfidence = false;
        foreach ($results as $r) {
            $normP = preg_replace('/[^a-z0-9]/', '', strtolower($r['primaryText']));
            if ($normP === $normQ || stripos($normP, $normQ) === 0 || (strlen($normQ) >= 4 && stripos($normP, $normQ) !== false)) {
                $hasHighConfidence = true;
                break;
            }
        }

        if ($enableFallback && (count($results) === 0 || (!$hasHighConfidence && count($results) < 3))) {
            $photonResults = self::queryOsmPhoton($clean, $userLat, $userLng, $seenKeys, $limit - count($results));
            foreach ($photonResults as $pr) {
                $results[] = $pr;
                if (count($results) >= $limit) break;
            }
        }

        return $results;
    }

    /**
     * Query Photon OpenStreetMap fallback
     */
    private static function queryOsmPhoton($query, $userLat, $userLng, &$seenKeys, $maxNeeded)
    {
        $out = array();
        $ctx = stream_context_create(array(
            'http' => array(
                'header'  => "User-Agent: JittaDrives-RideHailing/2.0\r\n",
                'timeout' => 2.5
            )
        ));

        $url = "https://photon.komoot.io/api/?q=" . urlencode($query) . "&lat={$userLat}&lon={$userLng}&limit=" . max(8, $maxNeeded * 3);
        $resp = @file_get_contents($url, false, $ctx);
        if (!$resp) return array();

        $data = json_decode($resp, true);
        if (!isset($data['features']) || !is_array($data['features'])) return array();

        // Check if query explicitly mentions an outside city/district
        $isMultiCityQuery = (bool)preg_match('/\b(chennai|coimbatore|bangalore|bengaluru|trichy|tiruchirappalli|madurai|erode|namakkal|karur|dharmapuri|krishnagiri|hosur|vellore|tiruppur)\b/i', $query);

        $candidates = array();

        foreach ($data['features'] as $feat) {
            $props  = isset($feat['properties']) ? $feat['properties'] : array();
            $coords = isset($feat['geometry']['coordinates']) ? $feat['geometry']['coordinates'] : null;
            if (!$coords || count($coords) < 2) continue;

            $pLng = (float)$coords[0];
            $pLat = (float)$coords[1];

            // Strict filter: Must be within South India / Tamil Nadu geographic boundary
            if ($pLat < 8.0 || $pLat > 14.0 || $pLng < 76.0 || $pLng > 81.0) {
                continue;
            }

            // Compute actual distance
            $d = 6371 * acos(
                min(1.0, max(-1.0,
                    cos(deg2rad($userLat)) * cos(deg2rad($pLat)) * cos(deg2rad($pLng) - deg2rad($userLng)) +
                    sin(deg2rad($userLat)) * sin(deg2rad($pLat))
                ))
            ) * 1.3;

            // Strict ride-hailing radius filter:
            // For local searches without an explicit inter-city name, disqualify places beyond 45 km!
            if (!$isMultiCityQuery && $d > 45.0) {
                continue;
            }

            $name = trim(isset($props['name']) ? $props['name'] : (isset($props['street']) ? $props['street'] : (isset($props['locality']) ? $props['locality'] : $query)));
            $loc  = trim(isset($props['locality']) ? $props['locality'] : (isset($props['district']) ? $props['district'] : (isset($props['city']) ? $props['city'] : 'Tamil Nadu')));
            $dist = trim(isset($props['district']) ? $props['district'] : (isset($props['county']) ? $props['county'] : (isset($props['city']) ? $props['city'] : 'Tamil Nadu')));
            $state= trim(isset($props['state']) ? $props['state'] : 'Tamil Nadu');

            $secParts = array_filter(array($loc !== $name ? $loc : null, $dist !== $loc ? $dist : null, $state));
            $secondaryText = implode(', ', $secParts);
            $fullText = $name . ', ' . $secondaryText;

            $dedupKey = strtolower($name . '|' . $dist);
            if (isset($seenKeys[$dedupKey])) {
                continue;
            }
            $seenKeys[$dedupKey] = true;

            // Map OSM type
            $osmVal = strtoupper(isset($props['osm_value']) ? $props['osm_value'] : 'LOCALITY');
            $placeType = 'LOCALITY';
            if (in_array($osmVal, array('STATION', 'HALT'))) $placeType = 'STATION';
            elseif (in_array($osmVal, array('BUS_STOP', 'BUS_STATION'))) $placeType = 'BUS_STAND';
            elseif ($osmVal === 'HOSPITAL') $placeType = 'HOSPITAL';
            elseif (in_array($osmVal, array('SCHOOL', 'COLLEGE', 'UNIVERSITY'))) $placeType = 'SCHOOL';

            $candidates[] = array(
                'placeId'       => 'osm-' . (isset($props['osm_id']) ? $props['osm_id'] : rand(100000, 999999)),
                'sourceId'      => 'osm-' . (isset($props['osm_type']) ? $props['osm_type'] : 'N') . '-' . (isset($props['osm_id']) ? $props['osm_id'] : rand()),
                'primaryText'   => $name,
                'secondaryText' => $secondaryText,
                'fullText'      => $fullText,
                'locality'      => $loc,
                'district'      => $dist,
                'placeType'     => $placeType,
                'category'      => $placeType,
                'lat'           => $pLat,
                'lng'           => $pLng,
                'distance_val'  => $d,
                'distanceKm'    => round($d, 1) . ' km',
                'source'        => 'osm_photon'
            );
        }

        // Sort candidates by proximity to user
        usort($candidates, function($a, $b) {
            return ($a['distance_val'] < $b['distance_val']) ? -1 : 1;
        });

        foreach ($candidates as $cand) {
            unset($cand['distance_val']);
            $out[] = $cand;
            if (count($out) >= $maxNeeded) break;
        }

        return $out;
    }
}
