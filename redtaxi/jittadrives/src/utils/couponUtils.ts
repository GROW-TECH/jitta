/**
 * Utility for verifying whether a coupon or promotional offer is currently valid.
 * Checks active flag, usage limits, and expiration date.
 */
export const isCouponValid = (coupon: any): boolean => {
  if (!coupon) return false;

  // Active status check
  if (coupon.isActive === false || coupon.is_active === 0 || coupon.is_active === false) {
    return false;
  }

  // Usage limits check
  if (
    typeof coupon.maxUses === 'number' &&
    typeof coupon.usedCount === 'number' &&
    coupon.maxUses > 0 &&
    coupon.usedCount >= coupon.maxUses
  ) {
    return false;
  }
  if (
    typeof coupon.max_uses === 'number' &&
    typeof coupon.used_count === 'number' &&
    coupon.max_uses > 0 &&
    coupon.used_count >= coupon.max_uses
  ) {
    return false;
  }

  // Expiry date verification
  const rawExpiry = coupon.expiryDate || coupon.expiry_date || coupon.valid_until || coupon.validUntil;
  if (!rawExpiry) {
    return true; // No expiration date specified, valid by default
  }

  const expiryTime = new Date(rawExpiry).getTime();
  if (isNaN(expiryTime)) {
    const parsed = Date.parse(rawExpiry);
    if (isNaN(parsed)) return true;
    const endOfDay = new Date(parsed);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay.getTime() >= Date.now();
  }

  const endOfDay = new Date(expiryTime);
  // If only a date string without time was provided (e.g. 2026-10-10 or 30 Sep 2026),
  // consider the coupon valid until the end of that day (23:59:59.999).
  if (typeof rawExpiry === 'string' && !rawExpiry.includes(':')) {
    endOfDay.setHours(23, 59, 59, 999);
  }

  return endOfDay.getTime() >= Date.now();
};
