import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Navigation, MapPin, Plus, Minus, Check, AlertTriangle, Compass } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationPoint } from '../../types/taxi';
import { reverseGeocodeLiveGps, detectLiveDynamicLocation, isLocationInTamilNadu } from '../../services/locationService';

interface RapidoMapPinPickerProps {
  initialLocation?: LocationPoint | null;
  mode?: 'pickup' | 'drop';
  onConfirm: (location: LocationPoint, mode: 'pickup' | 'drop') => void;
  onBack: () => void;
}

export const RapidoMapPinPicker: React.FC<RapidoMapPinPickerProps> = ({
  initialLocation,
  mode = 'pickup',
  onConfirm,
  onBack,
}) => {
  const [activeMode, setActiveMode] = useState<'pickup' | 'drop'>(mode);
  const isPickup = activeMode === 'pickup';

  // Current center coordinates being pointed at
  const defaultLat = initialLocation?.lat && isFinite(Number(initialLocation.lat))
    ? Number(initialLocation.lat)
    : 11.6643;
  const defaultLng = initialLocation?.lng && isFinite(Number(initialLocation.lng))
    ? Number(initialLocation.lng)
    : 78.1460;

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultLat,
    lng: defaultLng,
  });

  const [resolvedLocation, setResolvedLocation] = useState<LocationPoint>({
    name: initialLocation?.name || (isPickup ? 'Selected Pickup Point' : 'Selected Drop Point'),
    address: initialLocation?.address || 'Salem, Tamil Nadu',
    lat: defaultLat,
    lng: defaultLng,
    category: 'POPULAR',
  });

  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(false);
  const [gpsToast, setGpsToast] = useState<string>('');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const initialLatRef = useRef<number>(defaultLat);
  const initialLngRef = useRef<number>(defaultLng);
  const initialNameRef = useRef<string | null>(initialLocation?.name || null);
  const initialAddressRef = useRef<string | null>(initialLocation?.address || null);
  const reqIdRef = useRef<number>(0);

  // Helper to compute distance in meters
  const getDistanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Reverse geocode the center coordinates
  const performReverseGeocode = useCallback(async (lat: number, lng: number) => {
    // If the pin is still within 25m of the user's explicitly selected search result,
    // PRESERVE the verified landmark name (e.g. "ARRS Multiplex", "D-Mart") and refine coords!
    const distFromInitial = getDistanceMeters(initialLatRef.current, initialLngRef.current, lat, lng);
    if (initialNameRef.current && distFromInitial < 25) {
      setResolvedLocation((prev) => ({
        ...prev,
        name: initialNameRef.current!,
        address: initialAddressRef.current || prev.address,
        lat,
        lng,
      }));
      return;
    }

    const currentReqId = ++reqIdRef.current;
    setIsLocating(true);
    try {
      const geo = await reverseGeocodeLiveGps(lat, lng);
      // Discard stale responses if user moved pin again
      if (reqIdRef.current !== currentReqId) return;

      if (geo) {
        setResolvedLocation({
          name: geo.name || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`,
          address: geo.address || `${geo.name}, Tamil Nadu`,
          lat,
          lng,
          category: 'POPULAR',
        });
      }
    } catch (err) {
      console.warn('[RapidoMapPinPicker] Reverse geocode error:', err);
    } finally {
      if (reqIdRef.current === currentReqId) {
        setIsLocating(false);
      }
    }
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      if ((mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
        mapContainerRef.current.innerHTML = '';
      }

      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      // Crisp Google Maps live road tiles via Leaflet
      const tileLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
        tileSize: 256,
      });

      tileLayer.on('tileerror', (e) => {
        const img = e.tile as HTMLImageElement;
        if (img && !img.dataset.hasFallback) {
          img.dataset.hasFallback = 'true';
          const coords = (e as any).coords;
          if (coords) {
            img.src = `https://a.basemaps.cartocdn.com/rastertiles/voyager/${coords.z}/${coords.x}/${coords.y}.png`;
          }
        }
      });

      tileLayer.addTo(map);

      // Map move listeners
      map.on('movestart', () => {
        setIsDragging(true);
      });

      map.on('move', () => {
        const center = map.getCenter();
        setCurrentCoords({ lat: center.lat, lng: center.lng });
      });

      map.on('moveend', () => {
        setIsDragging(false);
        const center = map.getCenter();
        setCurrentCoords({ lat: center.lat, lng: center.lng });

        // Debounce reverse geocoding to prevent hammering API
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          performReverseGeocode(center.lat, center.lng);
        }, 350);
      });

      leafletMapRef.current = map;

      // Invalidate size to guarantee no black / missing canvas tiles
      [50, 200, 500].forEach((delay) => {
        setTimeout(() => {
          if (leafletMapRef.current) leafletMapRef.current.invalidateSize();
        }, delay);
      });

      // Initial reverse geocode if initialLocation didn't have name
      if (!initialLocation?.name) {
        performReverseGeocode(defaultLat, defaultLng);
      }
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [defaultLat, defaultLng, performReverseGeocode, initialLocation?.name]);

  // Handle Recenter to User's High Precision Live GPS
  const handleRecenterToGps = async () => {
    setIsGpsLoading(true);
    setGpsToast('Detecting high-precision GPS...');
    try {
      const loc = await detectLiveDynamicLocation();
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        if (leafletMapRef.current) {
          leafletMapRef.current.flyTo([loc.lat, loc.lng], 17, {
            animate: true,
            duration: 1.0,
          });
        }
        setCurrentCoords({ lat: loc.lat, lng: loc.lng });
        setResolvedLocation(loc);
        setGpsToast('📍 Centered on your current GPS location');
      } else {
        setGpsToast('GPS location unavailable, using map pin');
      }
    } catch (err) {
      console.warn('[RapidoMapPinPicker] GPS Recenter failed:', err);
      setGpsToast('Could not fetch GPS location');
    } finally {
      setIsGpsLoading(false);
      setTimeout(() => setGpsToast(''), 3000);
    }
  };

  const handleZoom = (delta: number) => {
    if (leafletMapRef.current) {
      if (delta > 0) leafletMapRef.current.zoomIn();
      else leafletMapRef.current.zoomOut();
    }
  };

  const handleConfirm = () => {
    onConfirm(resolvedLocation, activeMode);
  };

  const isTN = isLocationInTamilNadu(resolvedLocation);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FAFAF8] text-[#171717] overflow-hidden select-none font-sans">
      {/* 1. Top Floating Navigation Header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/95 backdrop-blur-md rounded-2xl border border-black/10 flex items-center justify-center text-[#171717] hover:bg-gray-100 shadow-lg transition active:scale-95"
            aria-label="Back to search"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Mode Selector Tabs (Rapido Style) */}
          <div className="bg-white/95 backdrop-blur-md border border-black/10 rounded-2xl p-1 shadow-lg flex items-center gap-1">
            <button
              onClick={() => setActiveMode('pickup')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                isPickup
                  ? 'bg-[#22A06B] text-white shadow-sm'
                  : 'text-[#737373] hover:text-[#171717]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isPickup ? 'bg-white' : 'bg-[#22A06B]'}`} />
              <span>Pickup</span>
            </button>
            <button
              onClick={() => setActiveMode('drop')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                !isPickup
                  ? 'bg-[#E85D04] text-white shadow-sm'
                  : 'text-[#737373] hover:text-[#171717]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${!isPickup ? 'bg-white' : 'bg-[#E85D04]'}`} />
              <span>Drop</span>
            </button>
          </div>
        </div>

        {/* Brand Chip */}
        <div className="hidden sm:flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-black/10 px-3 py-1.5 rounded-full shadow-lg pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-[#E85D04] animate-pulse" />
          <span className="text-[11px] font-black tracking-wide text-[#171717]">Jitta Drives Map</span>
        </div>
      </div>

      {/* 2. Full-Screen Interactive Leaflet Map */}
      <div className="relative flex-1 w-full h-full">
        <div ref={mapContainerRef} className="w-full h-full bg-[#E5E5E0]" />

        {/* 3. RAPIDO FLOATING CENTER PIN WITH DYNAMIC SPEECH BUBBLE */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-20 pointer-events-none flex flex-col items-center">
          {/* Dynamic Speech Bubble Pill Floating Above Pin */}
          <div
            className={`transition-all duration-200 transform ${
              isDragging ? '-translate-y-3 scale-105' : 'translate-y-0 scale-100'
            }`}
          >
            <div className="bg-[#18181B]/95 backdrop-blur-md text-white border border-white/20 px-3.5 py-2 rounded-2xl shadow-2xl flex flex-col items-center max-w-[280px] sm:max-w-[340px]">
              {/* Header Label */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isPickup ? 'bg-[#22A06B] shadow-[0_0_8px_#22A06B]' : 'bg-[#E85D04] shadow-[0_0_8px_#E85D04]'
                  } ${isLocating || isDragging ? 'animate-ping' : ''}`}
                />
                <span className="text-[10px] font-black uppercase tracking-wider text-white/70">
                  {isPickup ? 'Order will be picked up here' : 'Drop location'}
                </span>
              </div>

              {/* Resolved Location Name / Locating indicator */}
              <div className="text-center font-black text-xs sm:text-sm truncate w-full px-1 text-white">
                {isDragging || isLocating ? (
                  <span className="flex items-center justify-center gap-1.5 text-amber-300 font-bold">
                    <span className="inline-block w-2.5 h-2.5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                    <span>Pinpointing location...</span>
                  </span>
                ) : (
                  <span>{resolvedLocation.name || 'Selected Point'}</span>
                )}
              </div>
            </div>

            {/* Speech Bubble Downward Arrow Tip */}
            <div className="w-0 h-0 mx-auto border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[7px] border-t-[#18181B]/95 -mt-[1px]" />
          </div>

          {/* Pin Graphic with Dynamic Lift and Bounce Animation */}
          <div
            className={`transition-transform duration-150 transform flex flex-col items-center ${
              isDragging ? '-translate-y-3.5' : 'translate-y-0'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-2xl ring-4 transition-colors ${
                isPickup
                  ? 'bg-[#22A06B] ring-[#22A06B]/30'
                  : 'bg-[#E85D04] ring-[#E85D04]/30'
              }`}
            >
              <MapPin className="w-5 h-5 fill-white text-transparent" />
            </div>
            {/* Pin Stem Point */}
            <div
              className={`w-1 h-3 -mt-0.5 rounded-b-full transition-colors ${
                isPickup ? 'bg-[#22A06B]' : 'bg-[#E85D04]'
              }`}
            />
          </div>

          {/* Dynamic Pin Ground Shadow (scales down when dragged) */}
          <div
            className={`w-4 h-1.5 bg-black/40 rounded-full blur-[1px] transition-all duration-150 -mt-0.5 ${
              isDragging ? 'scale-75 opacity-30' : 'scale-100 opacity-60'
            }`}
          />
        </div>

        {/* 4. Floating Action Controls (GPS Recenter + Zoom) */}
        <div className="absolute right-3 sm:right-4 bottom-44 sm:bottom-48 z-30 flex flex-col gap-2.5">
          <button
            onClick={handleRecenterToGps}
            disabled={isGpsLoading}
            className="w-12 h-12 rounded-2xl bg-white/95 backdrop-blur-md text-[#171717] hover:text-[#E85D04] shadow-xl border border-black/10 flex items-center justify-center transition active:scale-95 disabled:opacity-60"
            title="Recenter to my current GPS location"
            aria-label="Recenter to my current GPS location"
          >
            <Navigation className={`w-5 h-5 fill-current ${isPickup ? 'text-[#22A06B]' : 'text-[#E85D04]'} ${isGpsLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => handleZoom(1)}
            className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-md text-[#171717] hover:text-[#E85D04] shadow-lg border border-black/10 flex items-center justify-center transition active:scale-95 mx-auto"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <Plus className="w-4 h-4 font-bold" />
          </button>

          <button
            onClick={() => handleZoom(-1)}
            className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-md text-[#171717] hover:text-[#E85D04] shadow-lg border border-black/10 flex items-center justify-center transition active:scale-95 mx-auto"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <Minus className="w-4 h-4 font-bold" />
          </button>
        </div>

        {/* GPS Status Toast */}
        {gpsToast && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-[#18181B]/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl backdrop-blur-md animate-fade-in flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            <span>{gpsToast}</span>
          </div>
        )}
      </div>

      {/* 5. Bottom Confirmation Card (Rapido Standard Bottom Sheet) */}
      <div className="relative z-30 bg-white border-t border-black/10 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] p-4 sm:p-5 rounded-t-3xl space-y-3.5">
        <div className="flex items-start gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              isPickup ? 'bg-[#22A06B]/10 text-[#22A06B]' : 'bg-[#E85D04]/10 text-[#E85D04]'
            }`}
          >
            <MapPin className="w-6 h-6" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  isPickup
                    ? 'bg-[#22A06B]/15 text-[#22A06B]'
                    : 'bg-[#E85D04]/15 text-[#E85D04]'
                }`}
              >
                {isPickup ? 'Pickup Point' : 'Drop Destination'}
              </span>
              <span className="text-[10px] text-[#737373] font-medium font-mono">
                {currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-black text-[#171717] truncate mt-1">
              {isLocating ? 'Locating address...' : resolvedLocation.name || 'Selected Map Location'}
            </h3>

            <p className="text-xs text-[#737373] line-clamp-2 mt-0.5">
              {resolvedLocation.address}
            </p>
          </div>
        </div>

        {!isTN && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>This pin appears to be outside Tamil Nadu service area.</span>
          </div>
        )}

        {/* Primary Confirmation Button */}
        <button
          onClick={handleConfirm}
          className={`w-full font-black text-sm sm:text-base py-3.5 sm:py-4 rounded-2xl shadow-xl transition active:scale-98 flex items-center justify-center gap-2 text-white ${
            isPickup
              ? 'bg-[#22A06B] hover:bg-[#1C8457] shadow-[#22A06B]/25'
              : 'bg-[#E85D04] hover:bg-[#C2410C] shadow-[#E85D04]/25'
          }`}
        >
          <Check className="w-5 h-5 stroke-[2.5]" />
          <span>{isPickup ? 'Confirm Pickup Location' : 'Confirm Drop Location'}</span>
        </button>
      </div>
    </div>
  );
};
