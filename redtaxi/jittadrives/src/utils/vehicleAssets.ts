/**
 * JittaDrives - Realistic Vehicle Photography & Media Assets
 * Replaces generic SVG/Lucide car icons and emojis with authentic, high-quality vehicle photos.
 */

const RAW_BASE = import.meta.env.BASE_URL || '/';
const BASE = RAW_BASE.endsWith('/') ? RAW_BASE : `${RAW_BASE}/`;

export const VEHICLE_PHOTOS: Record<string, string> = {
  // Core Taxi Modes & Fallbacks
  taxi_general: `${BASE}vehicles/red_sedan.jpg`,
  sedan: `${BASE}vehicles/red_sedan.jpg`,
  mini: `${BASE}vehicles/red_mini.jpg`,
  suv: `${BASE}vehicles/red_suv.jpg`,
  auto: `${BASE}vehicles/auto.jpg`,
  map_cab: `${BASE}vehicles/red_sedan.jpg`,

  // 1. Auto (Auto Rickshaw)
  jitta_auto: `${BASE}vehicles/auto.jpg`,
  // 2. Mini
  red_mini: `${BASE}vehicles/red_mini.jpg`,
  jitta_mini: `${BASE}vehicles/jitta_mini.jpg`,
  // 3. Sedan (Blue / Prime Sedan)
  red_sedan: `${BASE}vehicles/red_sedan.jpg`,
  jitta_sedan: `${BASE}vehicles/jitta_sedan.jpg`,
  // 4. SUV (SUV Prime)
  red_suv: `${BASE}vehicles/red_suv.jpg`,
  jitta_suv: `${BASE}vehicles/jitta_suv.jpg`,
  
  // Bike & Scooter (4 Varieties)
  bike: `${BASE}vehicles/bike.jpg`,
  scooter: `${BASE}vehicles/scooter.jpg`,
  bike_express: `${BASE}vehicles/bike_express.jpg`,
  bike_premium: `${BASE}vehicles/bike_premium.jpg`,
  
  driver_only: `${BASE}vehicles/driver_chauffeur.svg`,
};

/**
 * Returns the authentic vehicle photo based on category ID, name, or vehicle type slug.
 */
export function getVehiclePhoto(idOrName?: string, customImage?: string): string {
  const s = String(idOrName || '').toLowerCase();

  // Match core 3 taxi categories directly
  if (s.includes('auto') || s.includes('rickshaw') || s.includes('tuk')) {
    return VEHICLE_PHOTOS.auto;
  }
  if (s.includes('sedan')) {
    return VEHICLE_PHOTOS.sedan;
  }
  if (s.includes('suv') || s.includes('prime') || s.includes('xl')) {
    return VEHICLE_PHOTOS.suv;
  }
  if (s.includes('mini') || s.includes('hatchback')) {
    return VEHICLE_PHOTOS.mini;
  }

  if (customImage && typeof customImage === 'string' && (customImage.includes('/vehicles/') || customImage.startsWith('data:'))) {
    return customImage;
  }
  
  // Bike Varieties
  if (s.includes('premium') || s.includes('cruiser') || s.includes('bullet') || s.includes('enfield') || s === 'bike-premium') {
    return VEHICLE_PHOTOS.bike_premium;
  }
  if (s.includes('express') || s.includes('fast') || s.includes('sport') || s === 'bike-express') {
    return VEHICLE_PHOTOS.bike_express;
  }
  if (s.includes('scooter') || s.includes('ev') || s.includes('electric') || s === 'scooter') {
    return VEHICLE_PHOTOS.scooter;
  }
  if (s.includes('bike') || s.includes('moto') || s.includes('motorcycle') || s === 'bike') {
    return VEHICLE_PHOTOS.bike;
  }

  if (s.includes('driver') || s.includes('chauffeur') || s.includes('hire')) {
    return VEHICLE_PHOTOS.driver_only;
  }

  return VEHICLE_PHOTOS.taxi_general;
}
