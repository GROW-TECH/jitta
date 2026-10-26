<?php
/**
 * RedTaxi / Jitta Drivers - Vehicle Registration Number Validation Service
 * Independently validates and normalizes Indian motor vehicle registration numbers.
 * Compatible with PHP 5.6+.
 */

class VehicleValidationService
{
    /**
     * Map of Indian State / Union Territory 2-letter codes to state names.
     */
    private static $stateCodes = array(
        'AN' => 'Andaman and Nicobar Islands',
        'AP' => 'Andhra Pradesh',
        'AR' => 'Arunachal Pradesh',
        'AS' => 'Assam',
        'BR' => 'Bihar',
        'CG' => 'Chhattisgarh',
        'CH' => 'Chandigarh',
        'DD' => 'Daman and Diu',
        'DL' => 'Delhi',
        'DN' => 'Dadra and Nagar Haveli',
        'GA' => 'Goa',
        'GJ' => 'Gujarat',
        'HP' => 'Himachal Pradesh',
        'HR' => 'Haryana',
        'JH' => 'Jharkhand',
        'JK' => 'Jammu and Kashmir',
        'KA' => 'Karnataka',
        'KL' => 'Kerala',
        'LA' => 'Ladakh',
        'LD' => 'Lakshadweep',
        'MH' => 'Maharashtra',
        'ML' => 'Meghalaya',
        'MN' => 'Manipur',
        'MP' => 'Madhya Pradesh',
        'MZ' => 'Mizoram',
        'NL' => 'Nagaland',
        'OD' => 'Odisha',
        'OR' => 'Odisha', // legacy code
        'PB' => 'Punjab',
        'PY' => 'Puducherry',
        'RJ' => 'Rajasthan',
        'SK' => 'Sikkim',
        'TN' => 'Tamil Nadu',
        'TR' => 'Tripura',
        'TS' => 'Telangana',
        'UK' => 'Uttarakhand',
        'UA' => 'Uttarakhand', // legacy code
        'UP' => 'Uttar Pradesh',
        'WB' => 'West Bengal'
    );

    /**
     * Strip whitespace and non-alphanumeric characters, returning uppercase string.
     *
     * @param string|null $input
     * @return string
     */
    public static function normalize($input)
    {
        if ($input === null) {
            return '';
        }
        return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)$input));
    }

    /**
     * Format a normalized Indian registration number into standard human-readable display string.
     * e.g. "TN38AB1234" -> "TN 38 AB 1234", "22BH1234AA" -> "22 BH 1234 AA"
     *
     * @param string $normalized
     * @return string
     */
    public static function formatDisplay($normalized)
    {
        $norm = self::normalize($normalized);
        if (empty($norm)) {
            return '';
        }

        // BH Series: 22BH1234AA -> 22 BH 1234 AA
        if (preg_match('/^([0-9]{2})(BH)([0-9]{4})([A-Z]{1,2})$/', $norm, $m)) {
            return "{$m[1]} {$m[2]} {$m[3]} {$m[4]}";
        }

        // Standard Indian: State (2), RTO (1-2), Series (0-3), Number (1-4)
        if (preg_match('/^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{1,4})$/', $norm, $m)) {
            $parts = array($m[1], $m[2]);
            if (!empty($m[3])) {
                $parts[] = $m[3];
            }
            $parts[] = $m[4];
            return implode(' ', $parts);
        }

        // Fallback
        return $norm;
    }

    /**
     * Check if a vehicle registration number has valid Indian format.
     * Provides strict syntax analysis and descriptive diagnostic messages.
     *
     * @param string|null $input
     * @return array
     */
    public static function validate($input)
    {
        $raw = trim((string)$input);
        if ($raw === '') {
            return array(
                'valid'        => false,
                'isValid'      => false,
                'normalized'   => '',
                'formatted'    => '',
                'type'         => null,
                'state_code'   => null,
                'stateCode'    => null,
                'state_name'   => null,
                'stateName'    => null,
                'error'        => 'Vehicle registration number is required',
                'errorMessage' => 'Vehicle registration number is required',
                'status'       => 'NOT_PROVIDED'
            );
        }

        $norm = self::normalize($raw);

        // Check length bounds (min 4 chars for old formats, max 13 chars)
        if (strlen($norm) < 6 || strlen($norm) > 12) {
            $msg = 'Vehicle registration number must be between 6 and 12 characters (e.g. TN 38 AB 1234)';
            return array(
                'valid'        => false,
                'isValid'      => false,
                'normalized'   => $norm,
                'formatted'    => $raw,
                'type'         => null,
                'state_code'   => null,
                'stateCode'    => null,
                'state_name'   => null,
                'stateName'    => null,
                'error'        => $msg,
                'errorMessage' => $msg,
                'status'       => 'INVALID'
            );
        }

        // 1. Check Bharat (BH) Series: YY BH #### XX (introduced 2021)
        if (preg_match('/^([0-9]{2})(BH)([0-9]{4})([A-Z]{1,2})$/', $norm, $m)) {
            $year = (int)$m[1];
            // Valid registration year from 2021 (21) onwards
            if ($year < 21 || $year > 40) {
                $msg = "Invalid BH Series year prefix '{$m[1]}'. Must be 21 or later.";
                return array(
                    'valid'        => false,
                    'isValid'      => false,
                    'normalized'   => $norm,
                    'formatted'    => self::formatDisplay($norm),
                    'type'         => 'BH_SERIES',
                    'state_code'   => 'BH',
                    'stateCode'    => 'BH',
                    'state_name'   => 'Bharat Series (All-India)',
                    'stateName'    => 'Bharat Series (All-India)',
                    'error'        => $msg,
                    'errorMessage' => $msg,
                    'status'       => 'INVALID'
                );
            }

            return array(
                'valid'        => true,
                'isValid'      => true,
                'normalized'   => $norm,
                'formatted'    => self::formatDisplay($norm),
                'type'         => 'BH_SERIES',
                'state_code'   => 'BH',
                'stateCode'    => 'BH',
                'state_name'   => 'Bharat Series (All-India)',
                'stateName'    => 'Bharat Series (All-India)',
                'error'        => null,
                'errorMessage' => null,
                'status'       => 'FORMAT_VALID'
            );
        }

        // 2. Check Standard Indian Series: StateCode (2) + RTO (1-2) + [Series (0-3)] + Digits (1-4)
        if (preg_match('/^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{1,4})$/', $norm, $m)) {
            $stateCode = $m[1];
            $rtoCode   = $m[2];
            $digits    = $m[4];

            if (!isset(self::$stateCodes[$stateCode])) {
                $msg = "Invalid Indian state code '{$stateCode}'. Please check the first two letters.";
                return array(
                    'valid'        => false,
                    'isValid'      => false,
                    'normalized'   => $norm,
                    'formatted'    => self::formatDisplay($norm),
                    'type'         => 'STANDARD',
                    'state_code'   => $stateCode,
                    'stateCode'    => $stateCode,
                    'state_name'   => null,
                    'stateName'    => null,
                    'error'        => $msg,
                    'errorMessage' => $msg,
                    'status'       => 'INVALID'
                );
            }

            // Reject all zeros in registration number (0000 is invalid in Indian motor vehicle rules)
            if ((int)$digits === 0) {
                $msg = 'Vehicle registration number digits cannot be all zeros';
                return array(
                    'valid'        => false,
                    'isValid'      => false,
                    'normalized'   => $norm,
                    'formatted'    => self::formatDisplay($norm),
                    'type'         => 'STANDARD',
                    'state_code'   => $stateCode,
                    'stateCode'    => $stateCode,
                    'state_name'   => self::$stateCodes[$stateCode],
                    'stateName'    => self::$stateCodes[$stateCode],
                    'error'        => $msg,
                    'errorMessage' => $msg,
                    'status'       => 'INVALID'
                );
            }

            return array(
                'valid'        => true,
                'isValid'      => true,
                'normalized'   => $norm,
                'formatted'    => self::formatDisplay($norm),
                'type'         => 'STANDARD',
                'state_code'   => $stateCode,
                'stateCode'    => $stateCode,
                'state_name'   => self::$stateCodes[$stateCode],
                'stateName'    => self::$stateCodes[$stateCode],
                'error'        => null,
                'errorMessage' => null,
                'status'       => 'FORMAT_VALID'
            );
        }

        $msg = 'Invalid Indian vehicle registration format. Expected format: TN 38 AB 1234 or 22 BH 1234 AA';
        return array(
            'valid'        => false,
            'isValid'      => false,
            'normalized'   => $norm,
            'formatted'    => $raw,
            'type'         => null,
            'state_code'   => null,
            'stateCode'    => null,
            'state_name'   => null,
            'stateName'    => null,
            'error'        => $msg,
            'errorMessage' => $msg,
            'status'       => 'INVALID'
        );
    }
}
