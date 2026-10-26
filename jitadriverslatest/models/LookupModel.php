<?php
/**
 * RedTaxi Backend - Lookup Model
 * Public catalogue lookups: vehicle categories, coupons, offers, and fare rules.
 * Schema-resilient and dynamically adapts to database columns.
 */

require_once __DIR__ . '/BaseModel.php';

class LookupModel extends BaseModel
{
    /** @var array cached table column maps */
    private $cachedCols = array();

    /**
     * Inspect and cache column names for a table.
     *
     * @param string $table
     * @return array map of lowercased column names
     */
    private function getTableColumns($table)
    {
        if (!isset($this->cachedCols[$table])) {
            $cols = array();
            try {
                $stmt = $this->db->query("SHOW COLUMNS FROM `{$table}`");
                if ($stmt) {
                    while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $cols[strtolower($r['Field'])] = true;
                    }
                }
            } catch (Exception $e) {}
            $this->cachedCols[$table] = $cols;
        }
        return $this->cachedCols[$table];
    }

    /**
     * Get active vehicle categories (normalized to the customer app shape).
     *
     * @return array
     */
    public function getVehicleCategories()
    {
        $cols = $this->getTableColumns('vehicle_categories');

        $hasCat = isset($cols['category']);
        $hasCap = isset($cols['capacity']);
        $hasBp  = isset($cols['base_price']);
        $hasPkm = isset($cols['per_km_rate']);
        $hasEta = isset($cols['eta_min']);
        $hasTag = isset($cols['tagline']);
        $hasImg = isset($cols['image_url']);
        $hasOrd = isset($cols['sort_order']);

        $category  = $hasCat ? (isset($cols['code']) ? "COALESCE(category, code) AS category" : "category") : (isset($cols['code']) ? "code AS category" : "name AS category");
        $capacity  = $hasCap ? (isset($cols['seat_capacity']) ? "COALESCE(capacity, seat_capacity) AS capacity" : "capacity") : (isset($cols['seat_capacity']) ? "seat_capacity AS capacity" : "4 AS capacity");
        $basePrice = $hasBp  ? (isset($cols['base_fare']) ? "COALESCE(base_price, base_fare) AS base_price" : "base_price") : (isset($cols['base_fare']) ? "base_fare AS base_price" : "50.00 AS base_price");
        $perKmRate = $hasPkm ? (isset($cols['per_km_fare']) ? "COALESCE(per_km_rate, per_km_fare) AS per_km_rate" : "per_km_rate") : (isset($cols['per_km_fare']) ? "per_km_fare AS per_km_rate" : "15.00 AS per_km_rate");
        $etaMin    = $hasEta ? "eta_min" : "5 AS eta_min";
        $tagline   = $hasTag ? "tagline" : (isset($cols['description']) ? "description AS tagline" : "NULL AS tagline");
        $image     = $hasImg ? "image_url" : (isset($cols['icon_url']) ? "icon_url AS image_url" : "NULL AS image_url");
        $order     = $hasOrd ? "sort_order" : "0 AS sort_order";

        $sql = "SELECT id, name, {$category}, {$capacity}, {$basePrice}, {$perKmRate},
                       {$etaMin}, {$tagline}, {$image}, {$order}
                FROM vehicle_categories
                WHERE is_active = 1
                ORDER BY " . ($hasOrd ? "sort_order ASC, " : "") . "name ASC";

        $rows = $this->fetchAll($sql);

        $categories = array();
        foreach ($rows as $r) {
            $categories[] = array(
                'id'         => $r['id'],
                'name'       => $r['name'],
                'category'   => $r['category'],
                'capacity'   => (int)$r['capacity'],
                'basePrice'  => (float)$r['base_price'],
                'perKmRate'  => (float)$r['per_km_rate'],
                'etaMin'     => $r['eta_min'] !== null ? (int)$r['eta_min'] : 5,
                'tagline'    => isset($r['tagline']) ? $r['tagline'] : null,
                'image'      => isset($r['image_url']) ? $r['image_url'] : null,
            );
        }
        return $categories;
    }

    /**
     * Get offers & coupons configuration settings
     *
     * @return array
     */
    public function getOffersSettings()
    {
        $file = __DIR__ . '/../config/offers_settings.json';
        if (file_exists($file)) {
            $raw = @file_get_contents($file);
            $parsed = json_decode($raw, true);
            if (is_array($parsed)) {
                return $parsed;
            }
        }
        return array(
            'notice_text' => '',
            'offers_enabled' => true,
            'coupons_enabled' => true
        );
    }

    /**
     * Get active, non-expired coupons (normalized to the customer app shape).
     *
     * @return array
     */
    public function getCoupons()
    {
        $settings = $this->getOffersSettings();
        if (isset($settings['coupons_enabled']) && !$settings['coupons_enabled']) {
            return array();
        }

        $cols = $this->getTableColumns('coupons');
        $hasDiscountVal = isset($cols['discount_value']);

        if (!$hasDiscountVal) {
            $discTypeCol = isset($cols['discount_type']) ? "discount_type" : "'FLAT' AS discount_type";
            $discAmtCol  = isset($cols['discount_amount']) ? "discount_amount" : "0.00 AS discount_amount";
            $minBookCol  = isset($cols['min_booking']) ? "min_booking" : "0.00 AS min_booking";
            $maxDiscCol  = isset($cols['max_discount']) ? "max_discount" : "NULL AS max_discount";
            $expDateCol  = isset($cols['expiry_date']) ? "expiry_date" : "NULL AS expiry_date";

            $sql = "SELECT id, code, {$discTypeCol}, {$discAmtCol}, {$minBookCol}, {$maxDiscCol},
                           description, {$expDateCol}, is_active
                    FROM coupons
                    WHERE is_active = 1 AND ({$expDateCol} IS NULL OR {$expDateCol} >= CURDATE())
                    ORDER BY created_at DESC";
        } else {
            $sql = "SELECT id, code,
                    CASE WHEN discount_type = 'PERCENTAGE' THEN 'PERCENT' ELSE discount_type END AS discount_type,
                    discount_value AS discount_amount, min_order_amount AS min_booking, max_discount,
                    description, valid_until AS expiry_date, is_active
                FROM coupons
                WHERE is_active = 1 AND (valid_until IS NULL OR valid_until >= CURDATE())
                ORDER BY created_at DESC";
        }
        $rows = $this->fetchAll($sql);

        $coupons = array();
        foreach ($rows as $r) {
            $coupons[] = array(
                'id'             => $r['id'],
                'code'           => $r['code'],
                'discountType'   => strtoupper($r['discount_type']) === 'PERCENT' ? 'PERCENT' : 'FLAT',
                'discountAmount' => (float)$r['discount_amount'],
                'minBooking'     => (float)$r['min_booking'],
                'maxDiscount'    => $r['max_discount'] !== null ? (float)$r['max_discount'] : null,
                'expiryDate'     => $r['expiry_date'],
                'description'    => $r['description'],
                'isActive'       => (int)$r['is_active'] === 1,
            );
        }
        return $coupons;
    }

    /**
     * Get active offers (joined with coupon code, normalized).
     *
     * @return array
     */
    public function getOffers()
    {
        $settings = $this->getOffersSettings();
        if (isset($settings['offers_enabled']) && !$settings['offers_enabled']) {
            return array();
        }

        $cols = $this->getTableColumns('offers');

        $hasDiscTag  = isset($cols['discount_tag']);
        $hasBgGrad   = isset($cols['bg_gradient']);
        $hasVal      = isset($cols['validity']);
        $hasSortOrd  = isset($cols['sort_order']);
        $hasStartDt  = isset($cols['start_date']);
        $hasEndDt    = isset($cols['end_date']);
        $hasCouponId = isset($cols['coupon_id']);

        $tag   = $hasDiscTag ? "o.discount_tag" : "NULL AS discount_tag";
        $bg    = $hasBgGrad ? "o.bg_gradient" : "NULL AS bg_gradient";
        $val   = $hasVal ? "o.validity" : "NULL AS validity";
        $ord   = $hasSortOrd ? "o.sort_order" : (isset($cols['priority']) ? "o.priority AS sort_order" : "0 AS sort_order");
        $start = $hasStartDt ? "o.start_date" : (isset($cols['starts_at']) ? "o.starts_at AS start_date" : "NULL AS start_date");
        $end   = $hasEndDt ? "o.end_date" : (isset($cols['ends_at']) ? "o.ends_at AS end_date" : "NULL AS end_date");

        $couponJoin = $hasCouponId ? "LEFT JOIN coupons c ON c.id = o.coupon_id" : "";
        $couponCode = $hasCouponId ? "c.code AS coupon_code" : "NULL AS coupon_code";

        $startCond = $hasStartDt ? "(o.start_date IS NULL OR o.start_date <= CURDATE())" : (isset($cols['starts_at']) ? "(o.starts_at IS NULL OR o.starts_at <= CURDATE())" : "1=1");
        $endCond   = $hasEndDt ? "(o.end_date IS NULL OR o.end_date >= CURDATE())" : (isset($cols['ends_at']) ? "(o.ends_at IS NULL OR o.ends_at >= CURDATE())" : "1=1");
        $orderClause = $hasSortOrd ? "o.sort_order ASC, o.created_at DESC" : (isset($cols['priority']) ? "o.priority ASC, o.created_at DESC" : "o.created_at DESC");

        $sql = "SELECT o.id, o.title, o.description, {$tag}, {$bg}, o.image_url,
                       {$val}, o.target_audience, o.is_active, {$ord}, {$start}, {$end},
                       {$couponCode}
                FROM offers o
                {$couponJoin}
                WHERE o.is_active = 1
                  AND {$startCond}
                  AND {$endCond}
                ORDER BY {$orderClause}";

        $rows = $this->fetchAll($sql);

        $offers = array();
        foreach ($rows as $r) {
            $code = !empty($r['coupon_code']) ? strtoupper(trim($r['coupon_code'])) : null;
            if (!$code && !empty($r['description']) && preg_match('/^[A-Z0-9_-]{3,16}$/i', trim($r['description']))) {
                $code = strtoupper(trim($r['description']));
            }
            if (!$code && !empty($r['discount_tag']) && preg_match('/^[A-Z0-9]{3,12}$/i', trim($r['discount_tag'])) && strpos($r['discount_tag'], '%') === false) {
                $code = strtoupper(trim($r['discount_tag']));
            }
            if (!$code) {
                $cleanTitle = preg_replace('/[^a-zA-Z0-9]/', '', $r['title']);
                $code = strtoupper(substr($cleanTitle ?: 'OFFER', 0, 5)) . '10';
            }

            $discTag = !empty($r['discount_tag']) ? $r['discount_tag'] : 'SPECIAL OFFER';

            $offers[] = array(
                'id'             => $r['id'],
                'code'           => $code,
                'title'          => $r['title'],
                'description'    => $r['description'],
                'discountTag'    => $discTag,
                'bgGradient'     => $r['bg_gradient'],
                'image'          => $r['image_url'],
                'validity'       => !empty($r['validity']) ? $r['validity'] : 'Valid on all rides',
                'targetAudience' => isset($r['target_audience']) ? $r['target_audience'] : 'ALL',
                'isActive'       => (int)$r['is_active'] === 1,
            );
        }
        return $offers;
    }

    /**
     * Get active fare rules joined with vehicle category names.
     *
     * @return array
     */
    public function getFareRules()
    {
        $cols = $this->getTableColumns('fare_rules');
        $hasCatId = isset($cols['category_id']);
        $hasVehCatId = isset($cols['vehicle_category_id']);

        if ($hasCatId) {
            $catIdCol = "fr.category_id";
            $joinOn = "vc.id = fr.category_id";
            $perKmCol = isset($cols['per_km']) ? "fr.per_km" : (isset($cols['per_km_fare']) ? "fr.per_km_fare" : "15.00");
            $perMinCol = isset($cols['per_minute']) ? "fr.per_minute" : (isset($cols['per_min_fare']) ? "fr.per_min_fare" : "2.00");
            $waitingCol = isset($cols['waiting_per_min']) ? "fr.waiting_per_min" : (isset($cols['waiting_charge_per_min']) ? "fr.waiting_charge_per_min" : "0.00");
            $freeKmCol = isset($cols['free_km']) ? "fr.free_km" : "0";
            $nightCol = isset($cols['night_charge_percent']) ? "fr.night_charge_percent" : (isset($cols['night_surge_multiplier']) ? "fr.night_surge_multiplier" : "1.00");
            $platCol = isset($cols['platform_fee']) ? "fr.platform_fee" : "10.00";
            $taxCol = isset($cols['tax_percent']) ? "fr.tax_percent" : "5.00";
            $cancCol = isset($cols['cancellation_fee']) ? "fr.cancellation_fee" : "30.00";
        } else {
            $catIdCol = $hasVehCatId ? "fr.vehicle_category_id" : "1";
            $joinOn = $hasVehCatId ? "vc.id = fr.vehicle_category_id" : "1=0";
            $perKmCol = isset($cols['per_km_fare']) ? "fr.per_km_fare" : (isset($cols['per_km']) ? "fr.per_km" : "15.00");
            $perMinCol = isset($cols['per_min_fare']) ? "fr.per_min_fare" : (isset($cols['per_minute']) ? "fr.per_minute" : "2.00");
            $waitingCol = isset($cols['waiting_charge_per_min']) ? "fr.waiting_charge_per_min" : (isset($cols['waiting_per_min']) ? "fr.waiting_per_min" : "2.00");
            $freeKmCol = "0";
            $nightCol = isset($cols['night_surge_multiplier']) ? "fr.night_surge_multiplier" : "1.00";
            $platCol = "10.00";
            $taxCol = "5.00";
            $cancCol = isset($cols['cancellation_fee']) ? "fr.cancellation_fee" : "30.00";
        }

        $sql = "SELECT fr.id, fr.city_id, {$catIdCol} AS category_id, fr.base_fare,
                       {$freeKmCol} AS free_km, {$perKmCol} AS per_km,
                       {$perMinCol} AS per_minute, {$waitingCol} AS waiting_per_min,
                       {$nightCol} AS night_charge_percent, {$platCol} AS platform_fee,
                       {$taxCol} AS tax_percent, {$cancCol} AS cancellation_fee, fr.is_active,
                       vc.name AS category_name
                FROM fare_rules fr
                LEFT JOIN vehicle_categories vc ON {$joinOn}
                WHERE fr.is_active = 1
                ORDER BY vc.name ASC";

        $rows = $this->fetchAll($sql);

        $rules = array();
        foreach ($rows as $r) {
            $rules[] = array(
                'id'                 => $r['id'],
                'category'           => $r['category_name'],
                'category_id'        => $r['category_id'],
                'city_id'            => (int)$r['city_id'],
                'baseFare'           => (float)$r['base_fare'],
                'freeKm'             => (float)$r['free_km'],
                'perKm'              => (float)$r['per_km'],
                'perMinute'          => (float)$r['per_minute'],
                'waitingPerMin'      => (float)$r['waiting_per_min'],
                'nightChargePercent' => (float)$r['night_charge_percent'],
                'platformFee'        => (float)$r['platform_fee'],
                'taxPercent'         => (float)$r['tax_percent'],
                'cancellationFee'    => (float)$r['cancellation_fee'],
                'isActive'           => (int)$r['is_active'] === 1,
            );
        }
        return $rules;
    }
}