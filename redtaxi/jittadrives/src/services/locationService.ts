import type { LocationPoint } from '../types/taxi';
import { ALL_TAMIL_NADU_LOCATIONS } from '../data/tamilNaduLocations';
import { loadGoogleMaps, isGoogleMapsAuthFailed } from '../utils/googleMapsLoader';
import { resolveAppBase } from './api';

export interface ReverseGeocodeResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  district?: string;
  city?: string;
}

/**
 * Fetch live forward geocoding across Tamil Nadu using Google Maps, Photon, and OSM
 */
export async function fetchLocationsFromApi(query: string): Promise<LocationPoint[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  // 1. Try Google Maps Geocoder / Autocomplete if loaded
  try {
    const isGoogleReady = await loadGoogleMaps();
    if (isGoogleReady && (window as any).google?.maps) {
      const g = (window as any).google.maps;
      const geocoder = new g.Geocoder();
      const googleResults: LocationPoint[] = await new Promise((resolve) => {
        geocoder.geocode(
          {
            address: trimmed.toLowerCase().includes('tamil nadu') ? trimmed : `${trimmed}, Tamil Nadu`,
            componentRestrictions: { country: 'IN' },
          },
          (results: any[], status: string) => {
            if (status === 'OK' && results && results.length > 0) {
              const pts: LocationPoint[] = results.slice(0, 6).map((r: any) => {
                const name = r.address_components?.[0]?.long_name || r.formatted_address.split(',')[0];
                return {
                  name,
                  address: r.formatted_address,
                  lat: r.geometry.location.lat(),
                  lng: r.geometry.location.lng(),
                  category: 'POPULAR' as const,
                };
              });
              resolve(pts);
            } else {
              resolve([]);
            }
          }
        );
      });

      if (googleResults.length > 0) {
        return googleResults;
      }
    }
  } catch (err) {
    console.warn('Google Maps geocoding fallback:', err);
  }

  const results: LocationPoint[] = [];

  // 2. Try Photon Komoot API (fast, CORS-friendly, bounded to Tamil Nadu region)
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      trimmed + ' Tamil Nadu'
    )}&limit=8&lat=11.0168&lon=76.9656`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        for (const feat of data.features) {
          const props = feat.properties || {};
          const coords = feat.geometry?.coordinates || [76.9656, 11.0168];
          const name = props.name || props.street || props.city || trimmed;
          const district = props.county || props.district || props.city || 'Tamil Nadu';
          const state = props.state || 'Tamil Nadu';
          const address = [props.street, props.district || props.city, district, state]
            .filter(Boolean)
            .join(', ');

          results.push({
            name: `${name}${props.city && props.city !== name ? `, ${props.city}` : ''}`,
            address: address || `${name}, Tamil Nadu`,
            lat: coords[1],
            lng: coords[0],
            category: 'POPULAR',
          });
        }
      }
    }
  } catch (err) {
    console.warn('Photon API fetch error:', err);
  }

  // 3. If Photon didn't return enough, try Nominatim OpenStreetMap
  if (results.length < 3) {
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        trimmed.toLowerCase().includes('tamil nadu') ? trimmed : `${trimmed}, Tamil Nadu`
      )}&countrycodes=in&limit=6&addressdetails=1`;
      const res = await fetch(nomUrl);
      if (res.ok) {
        const data = await res.json();
        for (const item of data) {
          const parts = item.display_name.split(',');
          const mainName = parts.slice(0, 2).join(',').trim();
          results.push({
            name: mainName || item.name || trimmed,
            address: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            category: 'POPULAR',
          });
        }
      }
    } catch (err) {
      console.warn('Nominatim API fetch error:', err);
    }
  }

  // Deduplicate results
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    const key = r.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique;
}

/**
 * Reverse geocode live GPS coordinates to real Tamil Nadu / Indian address
 */
export async function reverseGeocodeLiveGps(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  // 1. High-Performance Local-First Server Reverse Geocoding Proxy
  // Checks our curated POIs (D-Mart, ARRS, Schools, Hospitals) first with 0ms latency,
  // then uses Nominatim with exact landmark & building tag extraction.
  try {
    const res = await fetch(`${resolveAppBase()}/places/reverse?lat=${lat}&lng=${lng}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'OK' && data.name) {
        return {
          name: data.name,
          address: data.address || `${data.name}, Tamil Nadu`,
          lat: Number(data.lat) || lat,
          lng: Number(data.lng) || lng,
          district: data.district || '',
          city: data.city || '',
        };
      }
    }
  } catch (err) {
    console.warn('Server reverse geocode proxy error:', err);
  }

  // 2. Google Maps Geocoder Fallback
  try {
    const isGoogleReady = await loadGoogleMaps();
    if (isGoogleReady && (window as any).google?.maps && !isGoogleMapsAuthFailed()) {
      const g = (window as any).google.maps;
      const geocoder = new g.Geocoder();
      const gRes: ReverseGeocodeResult | null = await new Promise((resolve) => {
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          if (status === 'OK' && results && results[0]) {
            // Prefer point of interest / establishment (e.g. ARRS Multiplex), then premise/street address
            const poiResult = results.find((r: any) =>
              r.types?.includes('point_of_interest') ||
              r.types?.includes('establishment')
            );
            const best = poiResult || results.find((r: any) =>
              r.types?.includes('premise') ||
              r.types?.includes('street_address') ||
              r.types?.includes('sublocality')
            ) || results[0];

            const components = best.address_components || [];
            const compMap: Record<string, string> = {};
            for (const c of components) {
              for (const t of c.types || []) {
                if (!compMap[t] && c.long_name) {
                  compMap[t] = c.long_name;
                }
              }
            }

            const streetNo = compMap.street_number || '';
            const subprem = compMap.subpremise || '';
            const premise = compMap.premise || compMap.point_of_interest || compMap.establishment || '';
            const route = compMap.route || '';
            const landmark = compMap.landmark || '';
            const colony = compMap.neighborhood || compMap.sublocality_level_2 || '';
            const area = compMap.sublocality_level_1 || compMap.sublocality || '';
            const city = compMap.locality || compMap.administrative_area_level_2 || compMap.administrative_area_level_3 || '';
            const district = compMap.administrative_area_level_2 || city;

            let doorText = streetNo;
            if (subprem) {
              doorText = doorText ? `${doorText}/${subprem}` : subprem;
            }

            // Build ordered list of meaningful address segments like Rapido (100% dynamic)
            const parts: string[] = [];
            if (doorText) parts.push(doorText);
            if (premise && !parts.includes(premise)) parts.push(premise);
            if (route && !parts.includes(route)) parts.push(route);
            if (landmark && !parts.includes(landmark)) parts.push(landmark);
            if (colony && !parts.includes(colony)) parts.push(colony);
            if (area && !parts.includes(area)) parts.push(area);
            if (city && !parts.includes(city)) parts.push(city);

            let name = '';
            if (parts.length >= 2) {
              name = parts.join(', ');
            } else {
              // Strip country and postal code cleanly from formatted address
              const clean = (best.formatted_address || '')
                .replace(/,\s*[A-Za-z\s]+$/, '')
                .replace(/,\s*[A-Za-z\s]+\s*\d{5,6}\s*$/, '');
              name = clean || best.formatted_address || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
            }

            resolve({
              name,
              address: best.formatted_address,
              lat,
              lng,
              district: district || city,
              city,
            });
          } else {
            resolve(null);
          }
        });
      });

      if (gRes) return gRes;
    }
  } catch (err) {
    console.warn('Google reverse geocoding fallback:', err);
  }

  // 3. High-speed BigDataCloud fallback (free, CORS-friendly)
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(bdcUrl);
    if (res.ok) {
      const data = await res.json();
      if (data) {
        const localityInfo = data.localityInfo?.administrative || [];
        let finestName = '';
        for (const info of localityInfo) {
          if (info.order >= 8 && info.name && info.name !== data.countryName) {
            finestName = info.name;
          }
        }

        const subLocality = data.locality || data.subLocality || data.neighbourhood || finestName || '';
        const city = data.city || data.principalSubdivision || '';
        const district = data.principalSubdivision || city;

        const parts = [finestName, subLocality, city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
        const name = parts.length > 0 ? parts.join(', ') : `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;

        const address = [subLocality, city, district, data.countryName].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(', ');
        return { name, address, lat, lng, district, city };
      }
    }
  } catch (err) {
    console.warn('BigDataCloud reverse geocode error:', err);
  }

  return {
    name: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    address: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`,
    lat,
    lng,
    district: '',
    city: '',
  };
}

/**
 * Validates whether a location is within Tamil Nadu
 */
export function isLocationInTamilNadu(loc: { lat?: number; lng?: number; address?: string; name?: string } | null | undefined): boolean {
  if (!loc) return false;

  const rawText = `${loc.name || ''} ${loc.address || ''}`.toLowerCase();
  // Normalize punctuation and spacing for robust substring matching
  const text = rawText.replace(/[\-_,\.]+/g, ' ').replace(/\s+/g, ' ');

  // 1. Explicit Tamil Nadu Highway & Bypass Exemptions:
  // Major highways, bypass roads, and junctions across Tamil Nadu (Salem, Hosur, Krishnagiri, Dharmapuri, etc.)
  // are named after destination cities (e.g. "Bangalore Bypass", "Bangalore Highway", "Bangalore Road", "Cochin Road").
  // These are 100% inside Tamil Nadu and must never be treated as out-of-state!
  const isTnRoadOrBypass = /(bangalore|bengaluru|mysore|mysuru|cochin|kochi|calicut|kerala|chittoor|tirupati|hyderabad)\s*(bypass|by pass|highway|road|main road|nh|nh44|nh 44|circle|roundana|junction|bridge|flyover|stop)/i.test(text)
    || text.includes('bangalorebypass')
    || text.includes('bengalurubypass')
    || text.includes('bangalore bypass')
    || text.includes('bangalore highway')
    || text.includes('bangalore road')
    || text.includes('bangalore nh');

  // 2. Explicit positive check for Tamil Nadu / TN
  if (text.includes('tamil nadu') || text.includes('tamilnadu') || text.includes(' tn ') || text.endsWith(' tn') || text.includes(', tn')) {
    return true;
  }

  // 3. Tamil Nadu 38 districts & key municipal hubs positive check
  const tnDistricts = [
    'salem', 'chennai', 'coimbatore', 'madurai', 'tiruchirappalli', 'trichy', 'erode', 'tiruppur', 'tirupur',
    'dindigul', 'thanjavur', 'tanjore', 'vellore', 'tirunelveli', 'thoothukudi', 'tuticorin', 'karur',
    'namakkal', 'dharmapuri', 'krishnagiri', 'kanchipuram', 'chengalpattu', 'tiruvallur', 'cuddalore',
    'villupuram', 'kallakurichi', 'tiruvannamalai', 'ranipet', 'tirupattur', 'nagapattinam', 'mayiladuthurai',
    'tiruvarur', 'pudukkottai', 'sivaganga', 'ramanathapuram', 'virudhunagar', 'theni', 'tenkasi',
    'kanniyakumari', 'kanyakumari', 'nilgiris', 'ooty', 'ariyalur', 'perambalur',
    'hosur', 'attur', 'mettupalayam', 'pollachi', 'ambattur', 'tambaram', 'avadi'
  ];
  for (const dist of tnDistricts) {
    if (text.includes(dist)) {
      return true;
    }
  }

  // If identified as a Tamil Nadu bypass or highway road, allow immediately
  if (isTnRoadOrBypass) {
    return true;
  }

  // 4. Geographic bounding box check for Tamil Nadu (Lat: 8.08 to 13.55, Lng: 76.15 to 80.35)
  if (typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng)) {
    // Exclude Bangalore urban core in Karnataka (lat ~12.88 to 13.15, lng ~77.45 to 77.75)
    const isBangaloreCore = loc.lat >= 12.88 && loc.lat <= 13.15 && loc.lng >= 77.45 && loc.lng <= 77.75;
    if (loc.lat >= 8.08 && loc.lat <= 13.55 && loc.lng >= 76.15 && loc.lng <= 80.35 && !isBangaloreCore) {
      return true;
    }
    if (isBangaloreCore) {
      return false;
    }
  }

  // 5. Out of state blacklist keywords (Only applied when NO positive Tamil Nadu indicators matched)
  const outOfStateKeywords = [
    'karnataka', 'bengaluru', 'bangalore', 'mysuru', 'mysore', 'kerala', 'kochi', 'cochin',
    'thiruvananthapuram', 'trivandrum', 'palakkad', 'calicut', 'kozhikode', 'andhra',
    'tirupati', 'chittoor', 'hyderabad', 'telangana', 'maharashtra', 'mumbai', 'pune',
    'delhi', 'new delhi', 'noida', 'gurugram', 'gurgaon', 'goa', 'kolkata'
  ];

  for (const kw of outOfStateKeywords) {
    if (text.includes(kw)) {
      return false;
    }
  }

  return true;
}

export type LocationErrorType = 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN' | null;

export interface DetectLocationResult {
  location: LocationPoint;
  errorType: LocationErrorType;
  errorMessage?: string;
}

/**
 * High-accuracy live GPS detector with explicit error classification.
 */
export async function detectLiveDynamicLocationWithStatus(): Promise<DetectLocationResult> {
  // 1. Try Hardware High Accuracy GPS (real satellite/Wi-Fi positioning)
  if (typeof window !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude, accuracy } = pos.coords;
      console.log(`[JittaGPS] High-accuracy GPS acquired: ${latitude}, ${longitude} (accuracy: ${accuracy}m)`);

      const geo = await reverseGeocodeLiveGps(latitude, longitude);
      const resultLoc: LocationPoint = {
        name: geo.name || 'Current Location (GPS)',
        address: geo.address || `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`,
        lat: latitude,
        lng: longitude,
        category: 'POPULAR',
      };
      try { sessionStorage.setItem('jitta_user_gps', JSON.stringify(resultLoc)); } catch { }
      return { location: resultLoc, errorType: null };
    } catch (gpsErr: any) {
      console.debug('[JittaGPS] Hardware GPS attempt failed or timed out:', gpsErr);
      let errorType: LocationErrorType = 'UNKNOWN';
      let errorMessage = 'Unable to acquire location';

      if (gpsErr?.code === 1) {
        errorType = 'PERMISSION_DENIED';
        errorMessage = 'Location permission was denied. Please allow location access in your browser settings.';
      } else if (gpsErr?.code === 2) {
        errorType = 'POSITION_UNAVAILABLE';
        errorMessage = 'Device location is turned off. Please turn on Location/GPS in your phone settings.';
      } else if (gpsErr?.code === 3) {
        errorType = 'TIMEOUT';
        errorMessage = 'GPS request timed out. Please retry.';
      }

      // Check if a verified fallback exists in session
      try {
        const saved = sessionStorage.getItem('jitta_user_gps');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.lat && parsed.lng) {
            return { location: parsed, errorType };
          }
        }
      } catch { }

      return {
        location: {
          name: '',
          address: '',
          lat: 11.6643,
          lng: 78.1460,
          category: 'POPULAR',
        },
        errorType,
        errorMessage,
      };
    }
  }

  // Fallback when navigator.geolocation not supported
  return {
    location: {
      name: '',
      address: '',
      lat: 11.6643,
      lng: 78.1460,
      category: 'POPULAR',
    },
    errorType: 'POSITION_UNAVAILABLE',
    errorMessage: 'Geolocation is not supported by your browser.',
  };
}

/**
 * High-accuracy live GPS detector (Rapido / Uber standard).
 * Uses real device GPS satellites & Wi-Fi positioning without coarse IP gateway jumps.
 */
export async function detectLiveDynamicLocation(): Promise<LocationPoint> {
  const result = await detectLiveDynamicLocationWithStatus();
  return result.location;
}

/**
 * Search local Tamil Nadu dataset
 */
export function searchLocalTamilNadu(query: string, district: string = 'ALL'): LocationPoint[] {
  const q = query.trim().toLowerCase();
  return ALL_TAMIL_NADU_LOCATIONS.filter((loc) => {
    const matchesQuery = !q || loc.name.toLowerCase().includes(q) || loc.address.toLowerCase().includes(q);
    const matchesDistrict =
      district === 'ALL' ||
      loc.name.toLowerCase().includes(district.toLowerCase()) ||
      loc.address.toLowerCase().includes(district.toLowerCase());
    return matchesQuery && matchesDistrict;
  });
}

/**
 * Calculates live real-world road driving distance and duration using:
 * 1. Google Maps DirectionsService / DistanceMatrixService (via Live API Key)
 * 2. OSRM High-Precision Driving Routing Engine fallback
 * 3. Haversine Road Winding Formula fallback (1.3x)
 */
export async function calculateLiveRouteDrivingDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  stops: { lat: number; lng: number }[] = []
): Promise<{ distanceKm: number; durationMin: number }> {
  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    return { distanceKm: 8.4, durationMin: 22 };
  }

  // 1. Try Live Google Maps DirectionsService
  try {
    const isGoogleReady = await loadGoogleMaps();
    if (isGoogleReady && (window as any).google?.maps) {
      const g = (window as any).google.maps;
      const directionsService = new g.DirectionsService();

      const waypoints = stops.map((s) => ({
        location: new g.LatLng(s.lat, s.lng),
        stopover: true,
      }));

      const res: any = await new Promise((resolve) => {
        directionsService.route(
          {
            origin: new g.LatLng(origin.lat, origin.lng),
            destination: new g.LatLng(destination.lat, destination.lng),
            waypoints,
            travelMode: g.TravelMode.DRIVING,
            unitSystem: g.UnitSystem.METRIC,
          },
          (result: any, status: string) => {
            if (status === 'OK' && result?.routes?.[0]?.legs) {
              resolve(result.routes[0].legs);
            } else {
              resolve(null);
            }
          }
        );
      });

      if (res && res.length > 0) {
        let totalMeters = 0;
        let totalSeconds = 0;
        for (const leg of res) {
          totalMeters += leg.distance?.value || 0;
          totalSeconds += leg.duration?.value || 0;
        }
        const distanceKm = Math.max(1.0, Math.round((totalMeters / 1000) * 10) / 10);
        const durationMin = Math.max(5, Math.round(totalSeconds / 60));
        return { distanceKm, durationMin };
      }
    }
  } catch (err) {
    console.warn('[locationService] Google Directions API fallback:', err);
  }

  // 2. Try OSRM Real Road Driving Routing Engine
  try {
    const waypointsCoord = stops.map((s) => `${s.lng},${s.lat}`).join(';');
    const coordsStr = stops.length > 0
      ? `${origin.lng},${origin.lat};${waypointsCoord};${destination.lng},${destination.lat}`
      : `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=false`;
    const res = await fetch(osrmUrl);
    if (res.ok) {
      const data = await res.json();
      if (data?.routes?.[0]) {
        const route = data.routes[0];
        const distanceKm = Math.max(1.0, Math.round((route.distance / 1000) * 10) / 10);
        const durationMin = Math.max(5, Math.round(route.duration / 60));
        return { distanceKm, durationMin };
      }
    }
  } catch (err) {
    console.warn('[locationService] OSRM routing fallback:', err);
  }

  // 3. Fallback to Haversine with Road Winding Multiplier (1.3x)
  const R = 6371; // Earth radius in km
  const dLat = ((destination.lat - origin.lat) * Math.PI) / 180;
  const dLon = ((destination.lng - origin.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origin.lat * Math.PI) / 180) *
    Math.cos((destination.lat * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const roadDistance = Math.max(1.0, Math.round(R * c * 1.3 * 10) / 10);
  const travelMinutes = Math.max(5, Math.round((roadDistance / 25) * 60) + 2);

  return { distanceKm: roadDistance, durationMin: travelMinutes };
}

