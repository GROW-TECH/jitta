import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, Navigation, ArrowLeft, Clock, Heart, ChevronDown, X, AlertCircle, Home, Briefcase, Building2, Trash2 } from 'lucide-react';
import { useTaxiApp } from '../../context/TaxiAppContext';
import { detectLiveDynamicLocation, isLocationInTamilNadu, fetchLocationsFromApi } from '../../services/locationService';
import { resolveAppBase } from '../../services/api';
import { ALL_TAMIL_NADU_LOCATIONS } from '../../data/tamilNaduLocations';
import { RapidoMapPinPicker } from './RapidoMapPinPicker';
import type { LocationPoint } from '../../types/taxi';

interface RapidoLocationSearchProps {
  currentLocation?: LocationPoint | null;
  onSelectLocation: (location: LocationPoint) => void;
  onClose?: () => void;
  placeholder?: string;
}

export interface PlaceSuggestion {
  placeId: string;
  sourceId?: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
  locality?: string;
  district?: string;
  placeType?: string;
  category?: string;
  distanceKm?: string;
  lat?: number;
  lng?: number;
  source?: string;
  isRecent?: boolean;
}

// In-memory cache for place details coordinates to guarantee instant 0ms distance
const globalPlaceDetailsCache = new Map<string, { lat: number; lng: number }>();

// Prominent local landmarks in Salem & Tamil Nadu for instant 0ms autocomplete
const POPULAR_TAMIL_NADU_LANDMARKS: PlaceSuggestion[] = [
  {
    placeId: 'salem-gugai',
    primaryText: 'Gugai',
    secondaryText: 'Trichy Main Rd, Gugai, Salem, Tamil Nadu 636006',
    fullText: 'Gugai, Salem, Tamil Nadu 636006',
    lat: 11.6432,
    lng: 78.1508,
    placeType: 'LOCALITY',
  },
  {
    placeId: 'salem-gugai-bus-stop',
    primaryText: 'Gugai Bus Stop',
    secondaryText: 'Trichy Main Rd, Gugai, Salem 636006',
    fullText: 'Gugai Bus Stop, Salem, Tamil Nadu',
    lat: 11.6457,
    lng: 78.1551,
    placeType: 'TRANSIT',
  },
  {
    placeId: 'salem-jagir-ammapalayam',
    primaryText: 'Jagir Ammapalayam',
    secondaryText: 'Salem West, Salem, Tamil Nadu 636302',
    fullText: 'Jagir Ammapalayam, Salem West, Salem, Tamil Nadu 636302',
    lat: 11.67812,
    lng: 78.11113,
    placeType: 'LOCALITY',
  },
  {
    placeId: 'salem-jagir-reddipatti',
    primaryText: 'Jagir Reddipatti',
    secondaryText: 'Salem West, Salem, Tamil Nadu 636302',
    fullText: 'Jagir Reddipatti, Salem West, Salem, Tamil Nadu 636302',
    lat: 11.68450,
    lng: 78.10650,
    placeType: 'LOCALITY',
  },
  {
    placeId: 'salem-jagir-post-office',
    primaryText: 'Jagir Ammapalayam Branch Post Office',
    secondaryText: 'Main Road, Jagir Ammapalayam, Salem 636302',
    fullText: 'Jagir Ammapalayam Branch Post Office, Salem, Tamil Nadu',
    lat: 11.67750,
    lng: 78.11200,
    placeType: 'POST_OFFICE',
  },
  {
    placeId: 'salem-jagir-govt-school',
    primaryText: 'Govt Higher Secondary School, Jagir Ammapalayam',
    secondaryText: 'School Road, Jagir Ammapalayam, Salem 636302',
    fullText: 'Govt Higher Secondary School, Jagir Ammapalayam, Salem',
    lat: 11.67920,
    lng: 78.11050,
    placeType: 'SCHOOL',
  },
  {
    placeId: 'salem-jagir-bus-stop',
    primaryText: 'Jagir Ammapalayam Bus Stop',
    secondaryText: 'Tharamangalam Main Rd, Salem West, Salem 636302',
    fullText: 'Jagir Ammapalayam Bus Stop, Salem',
    lat: 11.67830,
    lng: 78.11180,
    placeType: 'TRANSIT',
  },
  {
    placeId: 'salem-bangalore-bypass',
    primaryText: 'Bangalore Bypass',
    secondaryText: 'Salem - Bangalore NH 44 Bypass, Salem 636005',
    fullText: 'Bangalore Bypass, NH 44, Salem, Tamil Nadu 636005',
    lat: 11.6685,
    lng: 78.1250,
    placeType: 'LOCALITY',
    category: 'LANDMARK',
  },
  {
    placeId: 'salem-mamangam-roundana',
    primaryText: 'Mamangam Roundana',
    secondaryText: 'Bangalore NH 44 Highway, Salem 636302',
    fullText: 'Mamangam Roundana, NH 44, Salem, Tamil Nadu',
    lat: 11.68500,
    lng: 78.11940,
    placeType: 'LOCALITY',
    category: 'LANDMARK',
  },
  {
    placeId: 'salem-poi-dmart-kondalampatti',
    primaryText: 'D-Mart (Hypermarket)',
    secondaryText: 'Salem - Bangalore NH 44 Bypass, Kondalampatti, Salem 636010',
    fullText: 'D-Mart (Hypermarket), Salem - Bangalore NH 44 Bypass, Kondalampatti, Salem, Tamil Nadu 636010',
    lat: 11.62886,
    lng: 78.12745,
    placeType: 'MALL',
    category: 'COMMERCIAL',
  },
  {
    placeId: 'salem-poi-srk-school',
    primaryText: 'SRK Matric Higher Secondary School',
    secondaryText: 'Metha Nagar, Hasthampatti, Salem 636007',
    fullText: 'SRK Matric Higher Secondary School, Metha Nagar, Hasthampatti, Salem, Tamil Nadu 636007',
    lat: 11.6812,
    lng: 78.1634,
    placeType: 'SCHOOL',
    category: 'SCHOOL',
  },
  {
    placeId: 'salem-poi-reliance-mall',
    primaryText: 'Reliance Mall & Smart Bazaar',
    secondaryText: 'Meyyanur Main Rd, Meyyanur, Salem 636004',
    fullText: 'Reliance Mall & Smart Bazaar, Meyyanur Main Rd, Meyyanur, Salem, Tamil Nadu 636004',
    lat: 11.6640,
    lng: 78.1380,
    placeType: 'MALL',
    category: 'COMMERCIAL',
  },
  {
    placeId: 'salem-poi-avr-roundana',
    primaryText: 'AVR Roundana (Junction)',
    secondaryText: 'Omalur Main Rd & NH 44, Jagir Ammapalayam, Salem 636302',
    fullText: 'AVR Roundana (Junction), Omalur Main Rd & NH 44, Jagir Ammapalayam, Salem, Tamil Nadu 636302',
    lat: 11.6825,
    lng: 78.1186,
    placeType: 'JUNCTION',
    category: 'TRANSIT',
  },
  {
    placeId: 'salem-poi-saravana-bhavan',
    primaryText: 'Hotel Saravana Bhavan',
    secondaryText: 'Opp New Bus Stand, Meyyanur, Salem 636004',
    fullText: 'Hotel Saravana Bhavan, Opp New Bus Stand, Meyyanur, Salem, Tamil Nadu 636004',
    lat: 11.6655,
    lng: 78.1448,
    placeType: 'RESTAURANT',
    category: 'RESTAURANT',
  },
  {
    placeId: 'salem-poi-grt-jewellers',
    primaryText: 'GRT Jewellers',
    secondaryText: 'Omalur Main Road, Fairlands, Salem 636016',
    fullText: 'GRT Jewellers, Omalur Main Road, Fairlands, Salem, Tamil Nadu 636016',
    lat: 11.6702,
    lng: 78.1405,
    placeType: 'LANDMARK',
    category: 'COMMERCIAL',
  },
  {
    placeId: 'salem-arrs-multiplex',
    primaryText: 'ARRS Multiplex (Cinemas)',
    secondaryText: 'Meyyanur Bypass Rd, Meyyanur, Salem, Tamil Nadu 636004',
    fullText: 'ARRS Multiplex (Cinemas), Meyyanur Bypass Rd, Salem, Tamil Nadu',
    lat: 11.6652,
    lng: 78.1408,
    placeType: 'CINEMA',
  },
  {
    placeId: 'salem-new-bus-stand',
    primaryText: 'New Bus Stand (Central)',
    secondaryText: 'Sankari Main Road, Meyyanur, Salem, Tamil Nadu 636004',
    fullText: 'New Bus Stand, Meyyanur, Salem, Tamil Nadu',
    lat: 11.6643,
    lng: 78.1460,
    placeType: 'BUS_STAND',
  },
  {
    placeId: 'salem-junction',
    primaryText: 'Salem Junction Railway Station',
    secondaryText: 'Suramangalam, Salem, Tamil Nadu 636005',
    fullText: 'Salem Junction Railway Station, Suramangalam, Salem',
    lat: 11.6713,
    lng: 78.1189,
    placeType: 'STATION',
  },
  {
    placeId: 'salem-suramangalam',
    primaryText: 'Suramangalam',
    secondaryText: 'Salem, Tamil Nadu 636005',
    fullText: 'Suramangalam, Salem, Tamil Nadu 636005',
    lat: 11.6713,
    lng: 78.1189,
    placeType: 'LOCALITY',
  },
  {
    placeId: 'salem-mullai-nagar-suramangalam',
    primaryText: 'Mullai Nagar',
    secondaryText: 'Suramangalam, Salem, Tamil Nadu 636005',
    fullText: 'Mullai Nagar, Suramangalam, Salem, Tamil Nadu 636005',
    lat: 11.6738,
    lng: 78.1162,
    placeType: 'LOCALITY',
  },
  {
    placeId: 'salem-five-roads',
    primaryText: 'Five Roads Junction',
    secondaryText: 'Meyyanur, Salem, Tamil Nadu 636004',
    fullText: 'Five Roads Junction, Salem, Tamil Nadu',
    lat: 11.6685,
    lng: 78.1342,
    placeType: 'JUNCTION',
  },
  {
    placeId: 'salem-fairlands',
    primaryText: 'Fairlands Hub',
    secondaryText: 'Brindavan Road, Fairlands, Salem, Tamil Nadu 636016',
    fullText: 'Fairlands, Salem, Tamil Nadu',
    lat: 11.6734,
    lng: 78.1415,
    placeType: 'LOCALITY',
  },
  {
    placeId: 'salem-old-bus-stand',
    primaryText: 'Old Bus Stand (Town Bus Stand)',
    secondaryText: 'Fort, Salem, Tamil Nadu 636001',
    fullText: 'Old Bus Stand, Salem, Tamil Nadu',
    lat: 11.6548,
    lng: 78.1620,
    placeType: 'BUS_STAND',
  },
  {
    placeId: 'salem-airport',
    primaryText: 'Salem Airport (SXV)',
    secondaryText: 'Kamalapuram, Omalur, Salem, Tamil Nadu 636309',
    fullText: 'Salem Airport (SXV), Kamalapuram, Salem',
    lat: 11.7833,
    lng: 78.0650,
    placeType: 'AIRPORT',
  },
  {
    placeId: 'salem-sona-college',
    primaryText: 'Sona College of Technology',
    secondaryText: 'Junction Main Road, Suramangalam, Salem, Tamil Nadu 636005',
    fullText: 'Sona College of Technology, Salem, Tamil Nadu',
    lat: 11.6780,
    lng: 78.1255,
    placeType: 'COLLEGE',
  },
  {
    placeId: 'salem-ammapet',
    primaryText: 'Ammapet Main Bus Stop',
    secondaryText: 'Ammapet, Salem, Tamil Nadu 636003',
    fullText: 'Ammapet, Salem, Tamil Nadu',
    lat: 11.6560,
    lng: 78.1750,
    placeType: 'LOCALITY',
  },
  {
    placeId: 'salem-kondalampatti',
    primaryText: 'Kondalampatti Roundana',
    secondaryText: 'NH 44 Bypass, Kondalampatti, Salem, Tamil Nadu 636010',
    fullText: 'Kondalampatti Roundana, Salem, Tamil Nadu',
    lat: 11.6250,
    lng: 78.1320,
    placeType: 'JUNCTION',
  },
];

export const RapidoLocationSearch: React.FC<RapidoLocationSearchProps> = ({
  currentLocation,
  onSelectLocation,
  onClose,
  placeholder = 'Where do you want to go?',
}) => {
  const {
    pickupLocation,
    setPickupLocation,
    dropLocation,
    setDropLocation,
    setRideType,
    setCustomerScreen,
    customerProfile,
    isCustomerAuthenticated,
    allBookings,
  } = useTaxiApp() as any;

  // Derive unique customer identifier only for authenticated users
  const isGuest = !isCustomerAuthenticated || !customerProfile?.id || customerProfile.id === 'cust-1';
  const userIdentifier = useMemo(() => {
    if (isGuest) return 'guest';
    if (customerProfile?.id && customerProfile.id !== 'cust-1') return `user_${customerProfile.id}`;
    if (customerProfile?.phone) return `phone_${customerProfile.phone.replace(/\D/g, '').slice(-10)}`;
    return 'guest';
  }, [isGuest, customerProfile?.id, customerProfile?.phone]);

  const recentsKey = `jitta_recent_destinations_${userIdentifier}`;
  const homeKey = `jitta_saved_home_${userIdentifier}`;
  const workKey = `jitta_saved_work_${userIdentifier}`;
  const favKey = `jitta_saved_favorites_${userIdentifier}`;

  // Active field tracker: 'pickup' or 'drop'
  const [activeField, setActiveField] = useState<'pickup' | 'drop'>('drop');

  const [pickupInput, setPickupInput] = useState<string>(
    pickupLocation?.name || currentLocation?.name || ''
  );
  const [dropInput, setDropInput] = useState<string>(dropLocation?.name || '');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentDestinations, setRecentDestinations] = useState<any[]>([]);
  const [savedHome, setSavedHome] = useState<LocationPoint | null>(null);
  const [savedWork, setSavedWork] = useState<LocationPoint | null>(null);

  // Synchronize user-specific recent travel destinations & saved places
  useEffect(() => {
    try {
      // 1. Clean up legacy shared global key so previous users' places never leak across accounts
      localStorage.removeItem('jitta_recent_destinations');

      // 2. Unauthenticated or guest users must NEVER have recent history
      if (isGuest) {
        setRecentDestinations([]);
        setSavedHome(null);
        setSavedWork(null);
        setFavorites([]);
        return;
      }

      // 3. Check user-scoped local storage for recents
      const rawRecents = localStorage.getItem(recentsKey);
      if (rawRecents) {
        const parsed = JSON.parse(rawRecents);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentDestinations(parsed);
        } else {
          setRecentDestinations([]);
        }
      } else if (allBookings && Array.isArray(allBookings) && allBookings.length > 0) {
        // 4. Populate from this specific customer's actual ride history!
        const fromTrips: any[] = [];
        const seen = new Set<string>();
        const completedTrips = allBookings
          .filter((b: any) => b.status === 'COMPLETED' || b.status === 'PAID')
          .slice(0, 10);

        for (const trip of completedTrips) {
          const dropName = trip.drop?.name || (typeof trip.drop === 'string' ? trip.drop : null);
          const dropAddr = trip.drop?.address || (typeof trip.drop === 'string' ? trip.drop : '');
          const dLat = Number(trip.drop?.lat || trip.drop_lat);
          const dLng = Number(trip.drop?.lng || trip.drop_lng);

          if (dropName && !seen.has(dropName.toLowerCase().trim())) {
            seen.add(dropName.toLowerCase().trim());
            fromTrips.push({
              placeId: `trip-${trip.id}`,
              primaryText: dropName,
              secondaryText: dropAddr,
              fullText: dropAddr || dropName,
              lat: !isNaN(dLat) && dLat !== 0 ? dLat : 11.6643,
              lng: !isNaN(dLng) && dLng !== 0 ? dLng : 78.1460,
              timestamp: Date.now(),
            });
            if (fromTrips.length >= 6) break;
          }
        }

        setRecentDestinations(fromTrips);
        if (fromTrips.length > 0) {
          localStorage.setItem(recentsKey, JSON.stringify(fromTrips));
        }
      } else {
        // Brand new user or user with no travel history -> clean empty recents list!
        setRecentDestinations([]);
      }

      // Sync user-specific saved Home, Work, and Favorites
      const rawHome = localStorage.getItem(homeKey);
      setSavedHome(rawHome ? JSON.parse(rawHome) : null);
      const rawWork = localStorage.getItem(workKey);
      setSavedWork(rawWork ? JSON.parse(rawWork) : null);
      const rawFav = localStorage.getItem(favKey);
      setFavorites(rawFav ? JSON.parse(rawFav) : []);
    } catch {
      setRecentDestinations([]);
    }
  }, [isGuest, recentsKey, homeKey, workKey, favKey, allBookings]);
  const [settingSavedType, setSettingSavedType] = useState<'home' | 'work' | null>(null);
  const [forWho] = useState<string>('For me');
  const [outOfStateError, setOutOfStateError] = useState<string | null>(null);
  const [isPickingOnMap, setIsPickingOnMap] = useState<boolean>(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropInputRef = useRef<HTMLInputElement>(null);

  // Keep pickupInput in sync with context
  useEffect(() => {
    if (pickupLocation?.name) {
      setPickupInput(pickupLocation.name);
    }
  }, [pickupLocation?.name]);

  // Keep dropInput in sync with context
  useEffect(() => {
    if (dropLocation?.name) {
      setDropInput(dropLocation.name);
    }
  }, [dropLocation?.name]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Active query depends on which input the user is currently editing
  const activeQuery = activeField === 'pickup' ? pickupInput : dropInput;

  // Debounced search handler with 300ms delay & request cancellation
  const handleQueryChange = (text: string, field: 'pickup' | 'drop') => {
    setOutOfStateError(null);
    setSearchError(null);

    if (field === 'pickup') {
      setPickupInput(text);
    } else {
      setDropInput(text);
    }

    // Cancel in-flight debounce timer and ongoing HTTP request
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!text.trim() || text.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // 300ms debounce
    debounceTimerRef.current = setTimeout(() => {
      runSearch(text.trim());
    }, 300);
  };

  // Helper to compute road-driving distance from pickup location to suggestion
  const calcDistanceKm = (toLat?: number, toLng?: number): string | undefined => {
    if (typeof toLat !== 'number' || typeof toLng !== 'number' || isNaN(toLat) || isNaN(toLng)) return undefined;
    const fromLat = pickupLocation?.lat || currentLocation?.lat || 11.6643;
    const fromLng = pickupLocation?.lng || currentLocation?.lng || 78.1460;
    const R = 6371; // Earth radius in km
    const dLat = ((toLat - fromLat) * Math.PI) / 180;
    const dLon = ((toLng - fromLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((fromLat * Math.PI) / 180) *
        Math.cos((toLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const roadKm = R * c * 1.3; // Road winding factor
    return `${Math.max(0.5, Math.round(roadKm * 10) / 10).toFixed(1)} km`;
  };

  // Rapido-Style Location Search Engine (<50ms local database lookup)
  const runSearch = async (text: string) => {
    const userLat = pickupLocation?.lat || 11.6643;
    const userLng = pickupLocation?.lng || 78.1460;
    const queryLower = text.toLowerCase().trim();

    // 1. Instant local landmark matches (0ms initial render)
    const instantList: PlaceSuggestion[] = [];
    const seenNames = new Set<string>();

    const checkAndAdd = (item: PlaceSuggestion) => {
      // Smart dedup: preserve distinct localities/establishments with similar root words!
      const k = (item.placeId || (item.primaryText + '|' + (item.locality || item.district || item.secondaryText || ''))).toLowerCase().trim();
      if (!seenNames.has(k)) {
        seenNames.add(k);
        instantList.push({
          ...item,
          distanceKm: item.distanceKm || calcDistanceKm(item.lat, item.lng),
        });
      }
    };

    // Instant match against curated landmarks
    for (const lm of POPULAR_TAMIL_NADU_LANDMARKS) {
      if (
        lm.primaryText.toLowerCase().includes(queryLower) ||
        lm.secondaryText.toLowerCase().includes(queryLower) ||
        lm.fullText.toLowerCase().includes(queryLower)
      ) {
        checkAndAdd({
          ...lm,
          distanceKm: calcDistanceKm(lm.lat, lm.lng),
        });
      }
    }

    // Instant match against curated Tamil Nadu locations
    for (const loc of ALL_TAMIL_NADU_LOCATIONS) {
      if (
        loc.name.toLowerCase().includes(queryLower) ||
        (loc.address && loc.address.toLowerCase().includes(queryLower))
      ) {
        checkAndAdd({
          placeId: `tn-${loc.name}-${loc.lat}`,
          primaryText: loc.name,
          secondaryText: loc.address || 'Tamil Nadu',
          fullText: `${loc.name}, ${loc.address || 'Tamil Nadu'}`,
          lat: loc.lat,
          lng: loc.lng,
          placeType: 'LOCALITY',
          distanceKm: calcDistanceKm(loc.lat, loc.lng),
        });
        if (instantList.length >= 6) break;
      }
    }

    // Render instant results immediately
    if (instantList.length > 0) {
      setSuggestions([...instantList]);
    }

    // 2. Query Google Places Autocomplete API (/places/autocomplete) with AbortController cancellation
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const appBase = resolveAppBase();
      const endpoint = `${appBase}/places/autocomplete?input=${encodeURIComponent(text)}&lat=${userLat}&lng=${userLng}`;
      const res = await fetch(endpoint, { signal: controller.signal });

      if (res.ok) {
        const data = await res.json();
        const predictions = data?.predictions || [];
        if (Array.isArray(predictions) && predictions.length > 0) {
          const googleItems: PlaceSuggestion[] = predictions.map((p: any) => {
            const cached = globalPlaceDetailsCache.get(p.place_id);
            const pLat = (typeof p.lat === 'number' && !isNaN(p.lat)) ? p.lat : cached?.lat;
            const pLng = (typeof p.lng === 'number' && !isNaN(p.lng)) ? p.lng : cached?.lng;
            if (p.place_id && pLat !== undefined && pLng !== undefined) {
              globalPlaceDetailsCache.set(p.place_id, { lat: pLat, lng: pLng });
            }
            const dist = p.distance_km || (pLat && pLng ? calcDistanceKm(pLat, pLng) : undefined);
            return {
              placeId: p.place_id,
              primaryText: p.structured_formatting?.main_text || p.description,
              secondaryText: p.structured_formatting?.secondary_text || '',
              fullText: p.description,
              lat: pLat,
              lng: pLng,
              distanceKm: dist,
              source: 'google_places',
            };
          });

          setSuggestions(googleItems);
          setLoading(false);

          // If any edge cases are missing distance, resolve them simultaneously in one batch
          const missing = googleItems.filter((item) => !item.distanceKm);
          if (missing.length > 0) {
            Promise.all(
              missing.slice(0, 5).map(async (item) => {
                try {
                  const dRes = await fetch(`${appBase}/places/details?place_id=${encodeURIComponent(item.placeId)}`);
                  if (dRes.ok) {
                    const dData = await dRes.json();
                    if (dData?.result?.geometry?.location) {
                      const pLat = Number(dData.result.geometry.location.lat);
                      const pLng = Number(dData.result.geometry.location.lng);
                      globalPlaceDetailsCache.set(item.placeId, { lat: pLat, lng: pLng });
                      const dKm = calcDistanceKm(pLat, pLng);
                      return { placeId: item.placeId, lat: pLat, lng: pLng, distanceKm: dKm };
                    }
                  }
                } catch {
                  // ignore
                }
                return null;
              })
            ).then((results) => {
              const valid = results.filter(Boolean);
              if (valid.length > 0) {
                const map = new Map(valid.map((v) => [v!.placeId, v!]));
                setSuggestions((curr) =>
                  curr.map((c) => {
                    const v = map.get(c.placeId);
                    return v ? { ...c, lat: v.lat, lng: v.lng, distanceKm: v.distanceKm } : c;
                  })
                );
              }
            });
          }

          return;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      console.warn('[GooglePlaces] Autocomplete error, falling back to database:', err);
    }

    // Fallback 1: Query /places/search if Google autocomplete returned empty
    try {
      const appBase = resolveAppBase();
      const fbEndpoint = `${appBase}/places/search?q=${encodeURIComponent(text)}&lat=${userLat}&lng=${userLng}&limit=10`;
      const fbRes = await fetch(fbEndpoint, { signal: controller.signal });
      if (fbRes.ok) {
        const dbItems: PlaceSuggestion[] = await fbRes.json();
        if (Array.isArray(dbItems) && dbItems.length > 0) {
          setSuggestions(dbItems.map((item) => ({
            ...item,
            distanceKm: item.distanceKm || calcDistanceKm(item.lat, item.lng),
          })));
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore
    }

    // Fallback 2: Live client-side Google Maps Geocoder & Photon API
    try {
      const geoMatches = await fetchLocationsFromApi(text);
      if (geoMatches && geoMatches.length > 0) {
        const mapped: PlaceSuggestion[] = geoMatches.map((loc) => ({
          placeId: `geo-${loc.name}-${loc.lat}`,
          primaryText: loc.name,
          secondaryText: loc.address || 'Tamil Nadu',
          fullText: `${loc.name}, ${loc.address || 'Tamil Nadu'}`,
          lat: loc.lat,
          lng: loc.lng,
          distanceKm: calcDistanceKm(loc.lat, loc.lng),
          source: 'geocoder',
        }));
        setSuggestions(mapped);
        setLoading(false);
        return;
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }

    // Fallback 3: keep instant matches if backend returned empty
    if (instantList.length > 0) {
      setSuggestions(instantList);
    }
  };

  // User taps a suggestion: preserve exact coordinates and transition
  const handleSelectSuggestion = async (item: PlaceSuggestion) => {
    setLoading(true);
    setOutOfStateError(null);

    const cached = item.placeId ? globalPlaceDetailsCache.get(item.placeId) : null;
    let lat = typeof item.lat === 'number' && !isNaN(item.lat) ? item.lat : (cached?.lat ?? null);
    let lng = typeof item.lng === 'number' && !isNaN(item.lng) ? item.lng : (cached?.lng ?? null);

    // If coordinates are not loaded yet, fetch them from /places/details
    if ((lat === null || lng === null) && item.placeId) {
      try {
        const appBase = resolveAppBase();
        const dRes = await fetch(`${appBase}/places/details?place_id=${encodeURIComponent(item.placeId)}`);
        if (dRes.ok) {
          const dData = await dRes.json();
          if (dData?.result?.geometry?.location) {
            lat = Number(dData.result.geometry.location.lat);
            lng = Number(dData.result.geometry.location.lng);
            globalPlaceDetailsCache.set(item.placeId, { lat, lng });
          }
        }
      } catch (err) {
        console.warn('Place details fetch failed:', err);
      }
    }

    if (lat === null || lng === null) {
      lat = 11.6643;
      lng = 78.1460;
    }

    const resolved: LocationPoint = {
      name: item.primaryText,
      address: item.secondaryText || item.fullText,
      lat: lat,
      lng: lng,
      category: 'POPULAR',
    };

    if (activeField === 'drop') {
      // Enforce Tamil Nadu service boundary
      if (!isLocationInTamilNadu(resolved)) {
        setOutOfStateError(
          `Service is not available in ${resolved.name}. Jitta Drives currently operates exclusively within Tamil Nadu.`
        );
        setLoading(false);
        return;
      }

      // Check if user was setting Home or Work shortcut
      if (settingSavedType === 'home') {
        localStorage.setItem(homeKey, JSON.stringify(resolved));
        setSavedHome(resolved);
        setSettingSavedType(null);
      } else if (settingSavedType === 'work') {
        localStorage.setItem(workKey, JSON.stringify(resolved));
        setSavedWork(resolved);
        setSettingSavedType(null);
      }

      // Inside Tamil Nadu - save destination to recent history & transition to vehicle select
      saveRecentDestination({
        placeId: item.placeId,
        primaryText: resolved.name,
        secondaryText: resolved.address,
        fullText: item.fullText || resolved.address,
        lat: resolved.lat,
        lng: resolved.lng,
      });

      setDropLocation(resolved);
      setDropInput(resolved.name);
      onSelectLocation(resolved);
    } else {
      // Selected for Pickup
      setPickupLocation(resolved);
      setPickupInput(resolved.name);
      // Automatically advance focus to drop location
      setActiveField('drop');
      dropInputRef.current?.focus();
    }
    setLoading(false);
  };

  // Save selected destination to localStorage recent history (max 6, deduped)
  const saveRecentDestination = (item: {
    placeId?: string;
    primaryText: string;
    secondaryText?: string;
    fullText?: string;
    lat: number;
    lng: number;
  }) => {
    try {
      const raw = localStorage.getItem(recentsKey);
      const list: any[] = raw ? JSON.parse(raw) : [];
      const key = (item.primaryText + '|' + (item.secondaryText || '')).toLowerCase().trim();
      const filtered = list.filter(
        (r) => (r.primaryText + '|' + (r.secondaryText || '')).toLowerCase().trim() !== key
      );
      const updated = [
        {
          placeId: item.placeId || `rec-${Date.now()}`,
          primaryText: item.primaryText,
          secondaryText: item.secondaryText || item.fullText || '',
          fullText: item.fullText || item.primaryText,
          lat: item.lat,
          lng: item.lng,
          timestamp: Date.now(),
        },
        ...filtered,
      ].slice(0, 6);
      localStorage.setItem(recentsKey, JSON.stringify(updated));
      setRecentDestinations(updated);
    } catch (err) {
      console.warn('Failed to save recent destination:', err);
    }
  };

  // Handle Home / Work shortcut taps
  const handleSelectSavedPlace = (type: 'home' | 'work') => {
    const target = type === 'home' ? savedHome : savedWork;
    if (target) {
      handleSelectSuggestion({
        placeId: `saved-${type}`,
        primaryText: target.name,
        secondaryText: target.address,
        fullText: target.address,
        lat: target.lat,
        lng: target.lng,
      });
    } else {
      setSettingSavedType(type);
      setActiveField('drop');
      setDropInput('');
      setTimeout(() => dropInputRef.current?.focus(), 100);
    }
  };

  // High-accuracy live GPS capture
  const handleUseCurrentLocation = async () => {
    setLoading(true);
    setOutOfStateError(null);
    try {
      const loc = await detectLiveDynamicLocation();
      if (loc) {
        setPickupLocation(loc);
        setPickupInput(loc.name);
        // Advance to drop field
        setActiveField('drop');
        dropInputRef.current?.focus();
      }
    } catch (err) {
      console.warn('[JittaGPS] Error acquiring location:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (placeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(placeId) ? prev.filter((id) => id !== placeId) : [...prev, placeId];
      try {
        localStorage.setItem(favKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Dynamically compute nearby popular places sorted by GPS distance to user
  const userLat = pickupLocation?.lat || currentLocation?.lat || 11.6643;
  const userLng = pickupLocation?.lng || currentLocation?.lng || 78.1460;

  const nearbyPlaces = useMemo(() => {
    const allCandidates: PlaceSuggestion[] = [
      ...POPULAR_TAMIL_NADU_LANDMARKS,
      ...ALL_TAMIL_NADU_LOCATIONS.map((loc) => ({
        placeId: `tn-${loc.name}-${loc.lat}`,
        primaryText: loc.name,
        secondaryText: loc.address || 'Tamil Nadu',
        fullText: `${loc.name}, ${loc.address || 'Tamil Nadu'}`,
        lat: loc.lat,
        lng: loc.lng,
        placeType: loc.category || 'LOCALITY',
      })),
    ];

    const seen = new Set<string>();
    return allCandidates
      .filter((lm) => typeof lm.lat === 'number' && typeof lm.lng === 'number')
      .filter((lm) => {
        const k = lm.primaryText.toLowerCase().trim();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((lm) => {
        const lLat = lm.lat as number;
        const lLng = lm.lng as number;
        const dLat = (lLat - userLat) * 111.32;
        const dLng = (lLng - userLng) * 111.32 * Math.cos((userLat * Math.PI) / 180);
        const distSq = dLat * dLat + dLng * dLng;
        return {
          ...lm,
          distanceKm: calcDistanceKm(lLat, lLng),
          _distSq: distSq,
        };
      })
      .sort((a, b) => a._distSq - b._distSq);
  }, [userLat, userLng]);

  // Active suggestions list:
  // 1. If typing: search suggestions
  // 2. If not typing: User's Recent Destinations first, topped up with GPS-closest nearby places!
  const isTyping = activeQuery.trim().length >= 2;
  const activeList: PlaceSuggestion[] = useMemo(() => {
    if (isTyping) {
      return suggestions;
    }

    const recentsFormatted: PlaceSuggestion[] = recentDestinations.map((r) => ({
      placeId: r.placeId,
      primaryText: r.primaryText,
      secondaryText: r.secondaryText,
      fullText: r.fullText,
      lat: r.lat,
      lng: r.lng,
      distanceKm: calcDistanceKm(r.lat, r.lng),
      isRecent: true,
    }));

    if (recentsFormatted.length >= 6) {
      return recentsFormatted.slice(0, 6);
    }

    // Top up with GPS-closest places (deduped)
    const seen = new Set(recentsFormatted.map((r) => r.primaryText.toLowerCase().trim()));
    const remainingNeeded = 6 - recentsFormatted.length;
    const topUp = nearbyPlaces
      .filter((p) => !seen.has(p.primaryText.toLowerCase().trim()))
      .slice(0, remainingNeeded);

    return [...recentsFormatted, ...topUp];
  }, [isTyping, suggestions, recentDestinations, nearbyPlaces]);

  if (isPickingOnMap) {
    return (
      <RapidoMapPinPicker
        initialLocation={activeField === 'pickup' ? pickupLocation : (dropLocation || pickupLocation)}
        mode={activeField}
        onBack={() => setIsPickingOnMap(false)}
        onConfirm={(loc, modeConfirmed) => {
          if (modeConfirmed === 'pickup') {
            setPickupLocation(loc);
            setPickupInput(loc.name);
            setIsPickingOnMap(false);
            setActiveField('drop');
            setTimeout(() => dropInputRef.current?.focus(), 150);
          } else {
            if (settingSavedType === 'home') {
              localStorage.setItem('jitta_saved_home', JSON.stringify(loc));
              setSavedHome(loc);
              setSettingSavedType(null);
            } else if (settingSavedType === 'work') {
              localStorage.setItem('jitta_saved_work', JSON.stringify(loc));
              setSavedWork(loc);
              setSettingSavedType(null);
            }

            saveRecentDestination({
              primaryText: loc.name,
              secondaryText: loc.address,
              fullText: loc.address,
              lat: loc.lat,
              lng: loc.lng,
            });

            setDropLocation(loc);
            setDropInput(loc.name);
            setIsPickingOnMap(false);
            onSelectLocation(loc);
          }
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#FAFAF8] text-[#171717] font-sans relative overflow-hidden">
      {/* Top Header - Back button & For me selector */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white border border-black/10 flex items-center justify-center text-[#525252] hover:text-[#171717] shadow-xs"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <button className="flex items-center gap-1.5 bg-white border border-black/10 rounded-full px-3 py-1.5 text-xs font-semibold text-[#171717] shadow-xs">
          <span>{forWho}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#737373]" />
        </button>
      </div>

      {/* Out of State Service Alert Banner */}
      {outOfStateError && (
        <div className="mx-3 mt-2 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-900 text-xs shadow-sm animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-red-900">Service Not Available</p>
            <p className="text-[11px] text-red-700 mt-0.5 leading-snug">
              {outOfStateError}
            </p>
          </div>
          <button
            onClick={() => setOutOfStateError(null)}
            className="text-red-500 hover:text-red-800 font-black text-xs p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Subtle Network/Warning Alert */}
      {searchError && (
        <div className="mx-3 mt-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-semibold flex items-center justify-between">
          <span>{searchError}</span>
          <button onClick={() => setSearchError(null)} className="text-amber-600 hover:text-amber-900 ml-2">✕</button>
        </div>
      )}

      {/* Main Input Box Card (Rapido Style with Dual Active Highlight) */}
      <div className="p-3 shrink-0">
        <div className="bg-white border border-black/10 rounded-2xl p-3 shadow-sm space-y-2 relative">
          {/* Row 1: Pickup Location */}
          <div
            onClick={() => {
              setActiveField('pickup');
              pickupInputRef.current?.focus();
            }}
            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all ${
              activeField === 'pickup'
                ? 'bg-emerald-50/50 border border-[#22A06B] ring-2 ring-[#22A06B]/20'
                : 'bg-gray-50/60 border border-black/5 hover:border-black/10'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#22A06B] shrink-0 ml-1" />
            <input
              ref={pickupInputRef}
              type="text"
              value={pickupInput}
              onFocus={() => setActiveField('pickup')}
              onChange={(e) => handleQueryChange(e.target.value, 'pickup')}
              placeholder="Enter pickup location"
              className="flex-1 bg-transparent text-xs font-bold text-[#171717] outline-none placeholder-[#A3A3A3]"
            />

            {pickupInput.trim().length > 0 && activeField === 'pickup' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPickupInput('');
                  setSuggestions([]);
                }}
                className="w-5 h-5 rounded-full bg-gray-200/80 hover:bg-gray-300 text-gray-600 flex items-center justify-center shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUseCurrentLocation();
              }}
              className="flex items-center gap-1 bg-emerald-100 text-[#22A06B] px-2.5 py-1 rounded-full text-[10px] font-extrabold border border-[#22A06B]/30 hover:bg-emerald-200 transition shrink-0"
            >
              <Navigation className="w-3 h-3 text-[#22A06B]" />
              <span>GPS</span>
            </button>
          </div>

          {/* Connecting Vertical Line */}
          <div className="w-0.5 h-2.5 bg-gray-300 ml-[15px] -my-1" />

          {/* Row 2: Drop Location */}
          <div
            onClick={() => {
              setActiveField('drop');
              dropInputRef.current?.focus();
            }}
            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all ${
              activeField === 'drop'
                ? 'bg-orange-50/50 border border-[#E85D04] ring-2 ring-[#E85D04]/20'
                : 'bg-gray-50/60 border border-black/5 hover:border-black/10'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#E85D04] shrink-0 ml-1" />
            <input
              ref={dropInputRef}
              type="text"
              value={dropInput}
              onFocus={() => setActiveField('drop')}
              onChange={(e) => handleQueryChange(e.target.value, 'drop')}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-xs font-bold text-[#171717] outline-none placeholder-[#737373]"
              autoFocus
            />

            {dropInput.trim().length > 0 && activeField === 'drop' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDropInput('');
                  setSuggestions([]);
                }}
                className="w-5 h-5 rounded-full bg-gray-200/80 hover:bg-gray-300 text-gray-600 flex items-center justify-center shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Action Pills below Input Box */}
        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <button
            onClick={() => setIsPickingOnMap(true)}
            className="flex items-center justify-center gap-2 py-2 bg-white border border-black/10 rounded-xl text-xs font-bold text-[#171717] hover:bg-gray-50 hover:border-[#E85D04]/30 transition shadow-2xs cursor-pointer active:scale-95"
            title="Pick location directly on map"
          >
            <MapPin className="w-3.5 h-3.5 text-[#E85D04]" />
            <span>Pick on Map</span>
          </button>
          <button
            onClick={handleUseCurrentLocation}
            className="flex items-center justify-center gap-2 py-2 bg-white border border-black/10 rounded-xl text-xs font-bold text-[#171717] hover:bg-gray-50 transition shadow-2xs"
          >
            <Navigation className="w-3.5 h-3.5 text-[#22A06B]" />
            <span>Current GPS</span>
          </button>
        </div>


        {/* Saved Places Quick Chips (Home & Work) */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div
            onClick={() => handleSelectSavedPlace('home')}
            className={`flex items-center gap-2 p-2 bg-white border ${
              settingSavedType === 'home' ? 'border-amber-500 ring-2 ring-amber-100' : 'border-black/10'
            } rounded-xl text-left hover:bg-gray-50 transition shadow-2xs group cursor-pointer`}
          >
            <div className="w-6 h-6 rounded-full bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shrink-0">
              <Home className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#171717] leading-tight flex items-center justify-between">
                <span>Home</span>
                {savedHome && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      localStorage.removeItem(homeKey);
                      localStorage.removeItem('jitta_saved_home');
                      setSavedHome(null);
                    }}
                    className="text-[9px] text-gray-400 hover:text-red-500 font-normal ml-1"
                    title="Remove Home"
                  >
                    ✕
                  </button>
                )}
              </p>
              <p className="text-[10px] text-[#737373] truncate">
                {settingSavedType === 'home'
                  ? 'Select location below'
                  : (savedHome ? savedHome.name : 'Add Home')}
              </p>
            </div>
          </div>

          <div
            onClick={() => handleSelectSavedPlace('work')}
            className={`flex items-center gap-2 p-2 bg-white border ${
              settingSavedType === 'work' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-black/10'
            } rounded-xl text-left hover:bg-gray-50 transition shadow-2xs group cursor-pointer`}
          >
            <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shrink-0">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#171717] leading-tight flex items-center justify-between">
                <span>Work</span>
                {savedWork && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      localStorage.removeItem(workKey);
                      localStorage.removeItem('jitta_saved_work');
                      setSavedWork(null);
                    }}
                    className="text-[9px] text-gray-400 hover:text-red-500 font-normal ml-1"
                    title="Remove Work"
                  >
                    ✕
                  </button>
                )}
              </p>
              <p className="text-[10px] text-[#737373] truncate">
                {settingSavedType === 'work'
                  ? 'Select location below'
                  : (savedWork ? savedWork.name : 'Add Work')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Banner when user is saving Home or Work */}
      {settingSavedType && (
        <div className="mx-3 mb-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900 font-bold animate-in fade-in">
          <span>📍 Select any place below to set as your {settingSavedType === 'home' ? 'Home' : 'Work'} address</span>
          <button
            onClick={() => setSettingSavedType(null)}
            className="text-amber-700 hover:text-amber-900 text-[11px] ml-2 underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Field Active Hint */}
      <div className="px-4 py-1.5 flex items-center justify-between text-[11px] font-bold text-[#737373] shrink-0">
        <span>
          {activeField === 'pickup' ? '📍 Select Pickup Location' : '🏁 Select Drop Location (Tamil Nadu)'}
        </span>
        {!isTyping && (
          <div className="flex items-center gap-2">
            <span>{recentDestinations.length > 0 ? 'Recent & Nearby Places' : 'Popular Places Nearby'}</span>
            {recentDestinations.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  localStorage.removeItem(recentsKey);
                  localStorage.removeItem('jitta_recent_destinations');
                  setRecentDestinations([]);
                }}
                className="text-[10px] text-gray-400 hover:text-red-500 font-semibold cursor-pointer underline ml-1"
              >
                Clear Recents
              </button>
            )}
          </div>
        )}
      </div>

      {/* Suggestions List (Rapido Style) */}
      <div className="flex-1 overflow-y-auto px-3 divide-y divide-black/5">
        {loading && activeList.length === 0 && (
          <div className="space-y-3 py-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex items-center gap-3 py-2 animate-pulse">
                <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-2.5 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && activeList.length === 0 && isTyping && (
          <div className="py-10 text-center text-[#A3A3A3] text-xs font-medium">
            No locations found for "<span className="font-bold text-[#525252]">{activeQuery}</span>"
          </div>
        )}

        {activeList.map((item) => {
          return (
            <div
              key={item.placeId}
              onClick={() => handleSelectSuggestion(item)}
              className="flex items-center justify-between py-3.5 px-1 hover:bg-black/5 cursor-pointer transition group"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1 pr-2">
                <div className="flex flex-col items-center justify-start shrink-0 min-w-[38px]">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[#737373]">
                    {isTyping ? (
                      <MapPin className="w-3.5 h-3.5 text-[#E85D04]" />
                    ) : item.isRecent ? (
                      <Clock className="w-3.5 h-3.5 text-[#737373]" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-[#E85D04]" />
                    )}
                  </div>
                  {item.distanceKm && (
                    <span className="text-[10px] font-bold text-[#737373] mt-1 text-center whitespace-nowrap leading-none">
                      {item.distanceKm}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h4 className="text-xs font-bold text-[#171717] group-hover:text-[#E85D04] truncate transition-colors">
                    {item.primaryText}
                  </h4>
                  <p className="text-[11px] text-[#737373] truncate mt-0.5">
                    {item.secondaryText}
                  </p>
                </div>
              </div>

              <button
                onClick={(e) => toggleFavorite(item.placeId, e)}
                className="p-1.5 text-[#A3A3A3] hover:text-rose-500 transition shrink-0"
                aria-label="Save place"
              >
                <Heart
                  className={`w-4 h-4 ${
                    favorites.includes(item.placeId) ? 'fill-rose-500 text-rose-500' : ''
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
