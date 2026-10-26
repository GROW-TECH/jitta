/**
 * Indian Motor Vehicle Registration Number Format Validator and Normalizer.
 * Supports:
 * 1. Standard Indian Registration (State Code 2 letters + RTO 1-2 digits + Series 0-3 letters + Number 1-4 digits)
 * 2. Bharat Series (BH series): YY BH #### XX (introduced 2021)
 * 3. Normalizes input (uppercase, removes excessive spaces/hyphens).
 */

export interface VehicleValidationResult {
  valid: boolean;
  isValid: boolean;
  normalized: string;
  formatted: string;
  type: 'STANDARD' | 'BH_SERIES' | null;
  stateCode: string | null;
  stateName: string | null;
  error?: string;
  errorMessage?: string;
  status: 'NOT_PROVIDED' | 'FORMAT_VALID' | 'INVALID';
}

export const INDIAN_STATE_CODES: Record<string, string> = {
  AN: 'Andaman and Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CG: 'Chhattisgarh',
  CH: 'Chandigarh',
  DD: 'Daman and Diu',
  DL: 'Delhi',
  DN: 'Dadra and Nagar Haveli',
  GA: 'Goa',
  GJ: 'Gujarat',
  HP: 'Himachal Pradesh',
  HR: 'Haryana',
  JH: 'Jharkhand',
  JK: 'Jammu and Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  OR: 'Odisha',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TN: 'Tamil Nadu',
  TR: 'Tripura',
  TS: 'Telangana',
  UK: 'Uttarakhand',
  UA: 'Uttarakhand',
  UP: 'Uttar Pradesh',
  WB: 'West Bengal',
};

/**
 * Normalizes input: uppercase, removes all non-alphanumeric characters.
 */
export function normalizeVehicleNumber(input: string | null | undefined): string {
  if (!input) return '';
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Formats a normalized number into readable display format:
 * "TN38AB1234" -> "TN 38 AB 1234"
 * "22BH1234AA" -> "22 BH 1234 AA"
 */
export function formatDisplayVehicleNumber(normalized: string): string {
  const norm = normalizeVehicleNumber(normalized);
  if (!norm) return '';

  // BH Series: 22 BH 1234 AA
  const bhMatch = norm.match(/^([0-9]{2})(BH)([0-9]{4})([A-Z]{1,2})$/);
  if (bhMatch) {
    return `${bhMatch[1]} ${bhMatch[2]} ${bhMatch[3]} ${bhMatch[4]}`;
  }

  // Standard Indian: State (2) + RTO (1-2) + Series (0-3) + Number (1-4)
  const stdMatch = norm.match(/^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{1,4})$/);
  if (stdMatch) {
    const parts = [stdMatch[1], stdMatch[2]];
    if (stdMatch[3]) parts.push(stdMatch[3]);
    parts.push(stdMatch[4]);
    return parts.join(' ');
  }

  return norm;
}

/**
 * Validates vehicle registration number format against official Indian registration rules.
 */
export function validateVehicleNumber(input: string | null | undefined): VehicleValidationResult {
  const raw = (input || '').trim();
  if (!raw) {
    return {
      valid: false,
      isValid: false,
      normalized: '',
      formatted: '',
      type: null,
      stateCode: null,
      stateName: null,
      error: 'Vehicle registration number is required',
      errorMessage: 'Vehicle registration number is required',
      status: 'NOT_PROVIDED',
    };
  }

  const norm = normalizeVehicleNumber(raw);

  if (norm.length < 6 || norm.length > 12) {
    const err = 'Plate must be 6 to 12 characters (e.g. TN 38 AB 1234)';
    return {
      valid: false,
      isValid: false,
      normalized: norm,
      formatted: raw,
      type: null,
      stateCode: null,
      stateName: null,
      error: err,
      errorMessage: err,
      status: 'INVALID',
    };
  }

  // 1. Check Bharat Series (BH series): YY BH #### XX (from 2021)
  const bhMatch = norm.match(/^([0-9]{2})(BH)([0-9]{4})([A-Z]{1,2})$/);
  if (bhMatch) {
    const year = parseInt(bhMatch[1], 10);
    if (year < 21 || year > 40) {
      const err = `Invalid BH Series year prefix '${bhMatch[1]}'. Must be 21 or later.`;
      return {
        valid: false,
        isValid: false,
        normalized: norm,
        formatted: formatDisplayVehicleNumber(norm),
        type: 'BH_SERIES',
        stateCode: 'BH',
        stateName: 'Bharat Series (All-India)',
        error: err,
        errorMessage: err,
        status: 'INVALID',
      };
    }

    return {
      valid: true,
      isValid: true,
      normalized: norm,
      formatted: formatDisplayVehicleNumber(norm),
      type: 'BH_SERIES',
      stateCode: 'BH',
      stateName: 'Bharat Series (All-India)',
      status: 'FORMAT_VALID',
    };
  }

  // 2. Check Standard Indian Series
  const stdMatch = norm.match(/^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{1,4})$/);
  if (stdMatch) {
    const stateCode = stdMatch[1];
    const digits = stdMatch[4];

    if (!INDIAN_STATE_CODES[stateCode]) {
      const err = `Unknown state/UT code '${stateCode}'. Please check first 2 letters.`;
      return {
        valid: false,
        isValid: false,
        normalized: norm,
        formatted: formatDisplayVehicleNumber(norm),
        type: 'STANDARD',
        stateCode,
        stateName: null,
        error: err,
        errorMessage: err,
        status: 'INVALID',
      };
    }

    if (parseInt(digits, 10) === 0) {
      const err = 'Plate number digits cannot be all zeros';
      return {
        valid: false,
        isValid: false,
        normalized: norm,
        formatted: formatDisplayVehicleNumber(norm),
        type: 'STANDARD',
        stateCode,
        stateName: INDIAN_STATE_CODES[stateCode],
        error: err,
        errorMessage: err,
        status: 'INVALID',
      };
    }

    return {
      valid: true,
      isValid: true,
      normalized: norm,
      formatted: formatDisplayVehicleNumber(norm),
      type: 'STANDARD',
      stateCode,
      stateName: INDIAN_STATE_CODES[stateCode],
      status: 'FORMAT_VALID',
    };
  }

  const defaultErr = 'Invalid format. Example: TN 38 AB 1234 or 22 BH 1234 AA';
  return {
    valid: false,
    isValid: false,
    normalized: norm,
    formatted: raw,
    type: null,
    stateCode: null,
    stateName: null,
    error: defaultErr,
    errorMessage: defaultErr,
    status: 'INVALID',
  };
}
