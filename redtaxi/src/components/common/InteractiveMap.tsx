import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Navigation, Layers, Plus, Minus, MapPin, Maximize2, Minimize2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationPoint } from '../../types/taxi';
import { useTaxiApp } from '../../context/TaxiAppContext';
import { loadGoogleMaps, isGoogleMapsAuthFailed } from '../../utils/googleMapsLoader';

interface InteractiveMapProps {
  pickup?: LocationPoint | null;
  drop?: LocationPoint | null;
  stops?: LocationPoint[];
  driverLocation?: { lat: number; lng: number };
  showNearbyDrivers?: boolean;
  interactivePin?: boolean;
  onPinMove?: (lat: number, lng: number) => void;
  progress?: number;
  height?: string;
  controlsOffsetTop?: number;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  markers?: Array<{
    id?: string;
    type: 'CAR' | 'PICKUP' | 'DROP';
    top?: string;
    left?: string;
    lat?: number;
    lng?: number;
    label?: string;
    tone?: 'online' | 'offline' | 'pending';
  }>;
  forceLight?: boolean;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  pickup,
  drop,
  stops = [],
  driverLocation,
  showNearbyDrivers = true,
  interactivePin = false,
  onPinMove,
  progress = 0,
  height = 'h-full',
  controlsOffsetTop = 58,
  isMaximized = false,
  onToggleMaximize,
  markers = [],
  forceLight = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const googleContainerRef = useRef<HTMLDivElement>(null);
  const leafletContainerRef = useRef<HTMLDivElement>(null);

  const googleMapInstanceRef = useRef<any>(null);
  const leafletMapInstanceRef = useRef<L.Map | null>(null);

  const googlePolylineRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const googleTrafficRef = useRef<any>(null);

  const leafletMarkersRef = useRef<L.Marker[]>([]);
  const leafletPolylineRef = useRef<L.Polyline | null>(null);
  const leafletCarMarkerRef = useRef<L.Marker | null>(null);

  const [activeEngine, setActiveEngine] = useState<'GOOGLE' | 'LEAFLET'>('GOOGLE');
  const [showTraffic, setShowTraffic] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(14);

  const { themeMode } = useTaxiApp();
  const isLight = forceLight || themeMode === 'LIGHT';

  // Default coordinate: Gandhipuram, Coimbatore, Tamil Nadu
  const defaultCenter = {
    lat: pickup?.lat || 11.0168,
    lng: pickup?.lng || 76.9558,
  };

  // Check Google Maps availability and handle instant fallback
  useEffect(() => {
    let isMounted = true;

    const handleGmapsError = () => {
      if (!isMounted) return;
      (window as any).__googleMapsAuthFailed = true;
      setActiveEngine('LEAFLET');
    };

    window.addEventListener('jitta:gmaps-error', handleGmapsError);

    loadGoogleMaps().then((loaded) => {
      if (isMounted) {
        if (loaded && !isGoogleMapsAuthFailed() && (window as any).google?.maps?.Map) {
          setActiveEngine('GOOGLE');
        } else {
          setActiveEngine('LEAFLET');
        }
      }
    });

    const checkInterval = setInterval(() => {
      if (isGoogleMapsAuthFailed()) {
        setActiveEngine('LEAFLET');
        clearInterval(checkInterval);
      }
    }, 500);

    return () => {
      isMounted = false;
      window.removeEventListener('jitta:gmaps-error', handleGmapsError);
      clearInterval(checkInterval);
    };
  }, []);

  // -------------------------------------------------------------
  // 1. Google Maps Engine Initializer
  // -------------------------------------------------------------
  useEffect(() => {
    if (activeEngine !== 'GOOGLE' || !googleContainerRef.current) return;
    const g = (window as any).google?.maps;
    if (!g || !g.Map) return;

    if (!googleMapInstanceRef.current) {
      const map = new g.Map(googleContainerRef.current, {
        center: defaultCenter,
        zoom: zoomLevel,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        styles: isLight
          ? [
              { featureType: 'poi', stylers: [{ visibility: 'off' }] },
              { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
            ]
          : [
              { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
              { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
              { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
              { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
              { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
              { featureType: 'poi', stylers: [{ visibility: 'off' }] },
              { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
            ],
      });

      if (interactivePin && onPinMove) {
        map.addListener('idle', () => {
          const center = map.getCenter();
          if (center) onPinMove(center.lat(), center.lng());
        });
      }

      googleMapInstanceRef.current = map;

      // Trigger resize after small delay to avoid 0x0 canvas
      setTimeout(() => {
        if (googleMapInstanceRef.current) {
          g.event.trigger(googleMapInstanceRef.current, 'resize');
          googleMapInstanceRef.current.setCenter(defaultCenter);
        }
      }, 200);
    }

    // Actively watch for Google Maps "Oops! Something went wrong" error box
    const container = googleContainerRef.current;
    if (container) {
      const checkError = () => {
        const text = container.textContent || '';
        const hasErr =
          container.querySelector('.gm-err-container') ||
          container.querySelector('.gm-err-message') ||
          text.includes('Oops! Something went wrong') ||
          text.includes("didn't load Google Maps correctly") ||
          isGoogleMapsAuthFailed();

        if (hasErr) {
          (window as any).__googleMapsAuthFailed = true;
          setActiveEngine('LEAFLET');
        }
      };

      const observer = new MutationObserver(checkError);
      observer.observe(container, { childList: true, subtree: true, characterData: true });

      const pollTimer = setInterval(checkError, 400);

      return () => {
        observer.disconnect();
        clearInterval(pollTimer);
      };
    }
  }, [activeEngine, isLight, interactivePin, onPinMove]);

  // Google Maps Markers & Directions
  useEffect(() => {
    if (activeEngine !== 'GOOGLE' || !googleMapInstanceRef.current) return;
    const g = (window as any).google?.maps;
    const map = googleMapInstanceRef.current;
    if (!g || !map) return;

    googleMarkersRef.current.forEach((m) => m.setMap(null));
    googleMarkersRef.current = [];

    if (pickup?.lat && drop?.lat) {
      const validStops = stops
        .filter((s) => s.lat && s.lng)
        .map((s) => [Number(s.lat), Number(s.lng)] as [number, number]);

      const coordsStr = validStops.length > 0
        ? `${drop.lng},${pickup.lat};${validStops.map(([lat, lng]) => `${lng},${lat}`).join(';')};${drop.lng},${drop.lat}`
        : `${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}`;

      const applyGoogleRoadCoords = (roadCoords: { lat: number; lng: number }[]) => {
        if (!googleMapInstanceRef.current) return;
        if (googlePolylineRef.current) {
          googlePolylineRef.current.setPath(roadCoords);
          googlePolylineRef.current.setMap(map);
        } else {
          googlePolylineRef.current = new g.Polyline({
            map,
            path: roadCoords,
            strokeColor: '#E85D04',
            strokeOpacity: 0.95,
            strokeWeight: 5,
            lineCap: 'round',
            lineJoin: 'round',
          });
        }
        const bounds = new g.LatLngBounds();
        roadCoords.forEach((pt) => bounds.extend(pt));
        map.fitBounds(bounds, 60);
      };

      fetch(`https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.routes?.[0]?.geometry?.coordinates) {
            const rawCoords = data.routes[0].geometry.coordinates as [number, number][];
            const roadCoords = rawCoords.map(([lng, lat]) => ({ lat, lng }));
            applyGoogleRoadCoords(roadCoords);
          }
        })
        .catch(() => {
          applyGoogleRoadCoords([
            { lat: pickup.lat, lng: pickup.lng },
            ...validStops.map(([lat, lng]) => ({ lat, lng })),
            { lat: drop.lat, lng: drop.lng },
          ]);
        });
    } else {
      if (googlePolylineRef.current) {
        try {
          googlePolylineRef.current.setMap(null);
        } catch { }
      }
    }

    if (pickup?.lat && pickup?.lng) {
      const p = new g.Marker({
        position: { lat: pickup.lat, lng: pickup.lng },
        map,
        title: pickup.name || 'Pickup',
        icon: {
          path: g.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });
      googleMarkersRef.current.push(p);
      if (!drop?.lat) map.panTo({ lat: pickup.lat, lng: pickup.lng });
    }

    if (drop?.lat && drop?.lng) {
      const d = new g.Marker({
        position: { lat: drop.lat, lng: drop.lng },
        map,
        title: drop.name || 'Dropoff',
        icon: {
          path: g.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#ef4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });
      googleMarkersRef.current.push(d);
    }
  }, [activeEngine, pickup, drop, stops, driverLocation, showNearbyDrivers, progress, markers]);

  // -------------------------------------------------------------
  // 2. Leaflet OpenStreetMap Engine Initializer (Guaranteed Real Road Map)
  // -------------------------------------------------------------
  useEffect(() => {
    if (activeEngine !== 'LEAFLET' || !leafletContainerRef.current) return;

    if (!leafletMapInstanceRef.current) {
      // Clear container in case of remount
      if ((leafletContainerRef.current as any)._leaflet_id) {
        delete (leafletContainerRef.current as any)._leaflet_id;
        leafletContainerRef.current.innerHTML = '';
      }

      const lMap = L.map(leafletContainerRef.current, {
        center: [defaultCenter.lat, defaultCenter.lng],
        zoom: zoomLevel,
        zoomControl: false,
        attributionControl: false,
      });

      // Ultra-fast, crisp, high-resolution road tiles without any watermark
      const tileUrl = isLight
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

      const tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        tileSize: 256,
      });

      tileLayer.addTo(lMap);

      if (interactivePin && onPinMove) {
        lMap.on('moveend', () => {
          const center = lMap.getCenter();
          onPinMove(center.lat, center.lng);
        });
      }

      leafletMapInstanceRef.current = lMap;

      // Force recalculation of container dimensions
      [50, 150, 350, 800].forEach((delay) => {
        setTimeout(() => {
          if (leafletMapInstanceRef.current) {
            leafletMapInstanceRef.current.invalidateSize();
          }
        }, delay);
      });
    } else {
      leafletMapInstanceRef.current.invalidateSize();
    }
  }, [activeEngine, isLight, interactivePin, onPinMove]);

  // Keep Leaflet in sync with container resizes
  useEffect(() => {
    if (!leafletContainerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (leafletMapInstanceRef.current) {
        leafletMapInstanceRef.current.invalidateSize();
      }
    });
    ro.observe(leafletContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // Leaflet Route Polyline and Markers
  useEffect(() => {
    if (activeEngine !== 'LEAFLET' || !leafletMapInstanceRef.current) return;
    const lMap = leafletMapInstanceRef.current;

    // Clear previous markers
    leafletMarkersRef.current.forEach((m) => {
      try {
        m.remove();
      } catch {
        // ignore
      }
    });
    leafletMarkersRef.current = [];

    if (leafletPolylineRef.current) {
      try {
        leafletPolylineRef.current.remove();
      } catch {
        // ignore
      }
      leafletPolylineRef.current = null;
    }

    if (leafletCarMarkerRef.current) {
      try {
        leafletCarMarkerRef.current.remove();
      } catch {
        // ignore
      }
      leafletCarMarkerRef.current = null;
    }

    const boundsPoints: L.LatLngExpression[] = [];

    try {
      const pLat = pickup?.lat != null ? Number(pickup.lat) : NaN;
      const pLng = pickup?.lng != null ? Number(pickup.lng) : NaN;
      const dLat = drop?.lat != null ? Number(drop.lat) : NaN;
      const dLng = drop?.lng != null ? Number(drop.lng) : NaN;

      // 1. Pickup Marker
      if (isFinite(pLat) && isFinite(pLng)) {
        const pickupIcon = L.divIcon({
          className: 'custom-pin-pickup',
          html: `
            <div style="background:#22c55e; width:22px; height:22px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 4px 12px rgba(34,197,94,0.5); display:flex; align-items:center; justify-content:center;">
              <div style="width:6px; height:6px; background:#ffffff; border-radius:50%;"></div>
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const pm = L.marker([pLat, pLng], { icon: pickupIcon }).addTo(lMap);
        leafletMarkersRef.current.push(pm);
        boundsPoints.push([pLat, pLng]);
      }

      // 2. Drop Marker
      if (isFinite(dLat) && isFinite(dLng)) {
        const dropIcon = L.divIcon({
          className: 'custom-pin-drop',
          html: `
            <div style="background:#ef4444; width:22px; height:22px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 4px 12px rgba(239,68,68,0.5); display:flex; align-items:center; justify-content:center;">
              <div style="width:6px; height:6px; background:#ffffff; border-radius:50%;"></div>
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const dm = L.marker([dLat, dLng], { icon: dropIcon }).addTo(lMap);
        leafletMarkersRef.current.push(dm);
        boundsPoints.push([dLat, dLng]);
      }

      // 3. Intermediate Stops
      stops.forEach((s, idx) => {
        const sLat = Number(s?.lat);
        const sLng = Number(s?.lng);
        if (isFinite(sLat) && isFinite(sLng)) {
          const stopIcon = L.divIcon({
            className: 'custom-pin-stop',
            html: `
              <div style="background:#f59e0b; width:20px; height:20px; border-radius:50%; border:2px solid #ffffff; box-shadow:0 2px 8px rgba(0,0,0,0.3); color:#fff; font-weight:bold; font-size:10px; display:flex; align-items:center; justify-content:center;">
                ${idx + 1}
              </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          const sm = L.marker([sLat, sLng], { icon: stopIcon }).addTo(lMap);
          leafletMarkersRef.current.push(sm);
          boundsPoints.push([sLat, sLng]);
        }
      });

      // 4. Draw Route Polyline if Pickup & Drop exist
      if (isFinite(pLat) && isFinite(pLng) && isFinite(dLat) && isFinite(dLng)) {
        const validStops = stops
          .map((s) => [Number(s?.lat), Number(s?.lng)] as [number, number])
          .filter(([slat, slng]) => isFinite(slat) && isFinite(slng));

        const routePoints: L.LatLngExpression[] = [
          [pLat, pLng],
          ...validStops,
          [dLat, dLng],
        ];

        const poly = L.polyline(routePoints, {
          color: '#E85D04',
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
        }).addTo(lMap);

        leafletPolylineRef.current = poly;

        // Moving Vehicle Marker on route (only if progress > 0)
        if (typeof progress === 'number' && isFinite(progress) && progress > 0) {
          const pIdx = Math.max(0, Math.min(1, progress / 100));
          const lat = pLat + (dLat - pLat) * pIdx;
          const lng = pLng + (dLng - pLng) * pIdx;

          if (isFinite(lat) && isFinite(lng)) {
            const carIcon = L.divIcon({
              className: 'custom-car-marker',
              html: `
                <div style="position:relative; display:flex; align-items:center; justify-content:center;">
                  <div style="position:absolute; width:36px; height:36px; border-radius:50%; background:rgba(232,93,4,0.3); animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
                  <div style="width:30px; height:30px; border-radius:50%; background:#E85D04; border:2px solid #ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; overflow:hidden;">
                    <img src="${import.meta.env.BASE_URL}logo.png" style="width:20px; height:20px; object-fit:contain;" />
                  </div>
                </div>
              `,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            });

            const carMarker = L.marker([lat, lng], { icon: carIcon }).addTo(lMap);
            leafletCarMarkerRef.current = carMarker;
          }
        }
      }

      // 5. Nearby Drivers Simulation
      if (showNearbyDrivers && isFinite(pLat) && isFinite(pLng) && !isFinite(dLat)) {
        const offsets = [
          [0.0035, 0.0025],
          [-0.0025, 0.0045],
          [0.004, -0.003],
          [-0.003, -0.0025],
        ];
        offsets.forEach(([dlat, dlng]) => {
          const cabIcon = L.divIcon({
            className: 'custom-nearby-cab',
            html: `
              <div style="width:24px; height:24px; border-radius:50%; background:#E85D04; border:2px solid #ffffff; box-shadow:0 2px 8px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center;">
                <span style="color:#fff; font-size:12px;">🚗</span>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          const cab = L.marker([pLat + dlat, pLng + dlng], { icon: cabIcon }).addTo(lMap);
          leafletMarkersRef.current.push(cab);
        });
      }

      // Fit map bounds with container recalculation
      lMap.invalidateSize();
      if (boundsPoints.length > 1) {
        lMap.fitBounds(L.latLngBounds(boundsPoints), { padding: [50, 50], maxZoom: 16 });
      } else if (isFinite(pLat) && isFinite(pLng)) {
        lMap.setView([pLat, pLng], 15);
      }
    } catch (err) {
      console.warn('Leaflet render error caught gracefully:', err);
    }
  }, [activeEngine, pickup, drop, stops, driverLocation, showNearbyDrivers, progress]);

  // Map Controls
  const handleZoom = (delta: number) => {
    if (activeEngine === 'GOOGLE' && googleMapInstanceRef.current) {
      const cur = googleMapInstanceRef.current.getZoom() || 14;
      googleMapInstanceRef.current.setZoom(cur + delta);
      setZoomLevel(cur + delta);
    } else if (activeEngine === 'LEAFLET' && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.setZoom(leafletMapInstanceRef.current.getZoom() + delta);
    }
  };

  const handleRecenter = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (activeEngine === 'GOOGLE' && googleMapInstanceRef.current) {
            googleMapInstanceRef.current.panTo({ lat, lng });
            googleMapInstanceRef.current.setZoom(16);
          } else if (activeEngine === 'LEAFLET' && leafletMapInstanceRef.current) {
            leafletMapInstanceRef.current.setView([lat, lng], 16);
          }
        },
        () => {
          if (pickup?.lat) {
            if (activeEngine === 'GOOGLE' && googleMapInstanceRef.current) {
              googleMapInstanceRef.current.panTo({ lat: pickup.lat, lng: pickup.lng });
            } else if (activeEngine === 'LEAFLET' && leafletMapInstanceRef.current) {
              leafletMapInstanceRef.current.setView([pickup.lat, pickup.lng], 15);
            }
          }
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const toggleTraffic = useCallback(() => {
    setShowTraffic((prev) => !prev);
    if (activeEngine === 'GOOGLE' && googleMapInstanceRef.current) {
      const g = (window as any).google?.maps;
      if (g) {
        if (!googleTrafficRef.current) googleTrafficRef.current = new g.TrafficLayer();
        googleTrafficRef.current.setMap(showTraffic ? null : googleMapInstanceRef.current);
      }
    }
  }, [activeEngine, showTraffic]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${height} overflow-hidden select-none bg-slate-100`}
    >
      {/* Google Maps Canvas (active when key is authorized) */}
      <div
        ref={googleContainerRef}
        className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
          activeEngine === 'GOOGLE' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Leaflet Live Road Map Canvas (active fallback & instant live roads) */}
      <div
        ref={leafletContainerRef}
        className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
          activeEngine === 'LEAFLET' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Floating Center Pin for PICKUP_PIN screen */}
      {interactivePin && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-30 pointer-events-none flex flex-col items-center">
          <div className="bg-[#E85D04] text-white p-2.5 rounded-full shadow-2xl ring-4 ring-[#E85D04]/30 animate-bounce">
            <MapPin className="w-6 h-6 fill-white text-[#E85D04]" />
          </div>
          <div className="w-3.5 h-1.5 bg-black/40 rounded-full blur-[1px] -mt-1" />
        </div>
      )}

      {/* Map Control Buttons */}
      <div
        style={{ top: `${controlsOffsetTop}px` }}
        className="absolute right-3 sm:right-4 z-30 flex flex-col gap-2 pointer-events-auto"
      >
        <button
          onClick={handleRecenter}
          className="w-10 h-10 rounded-2xl bg-white/95 backdrop-blur text-slate-700 hover:text-[#E85D04] shadow-lg border border-black/5 flex items-center justify-center transition active:scale-95"
          title="Recenter to My GPS Location"
          aria-label="Recenter to My GPS Location"
        >
          <Navigation className="w-4 h-4 fill-current text-[#E85D04]" />
        </button>

        <button
          onClick={toggleTraffic}
          className={`w-10 h-10 rounded-2xl shadow-lg border border-black/5 flex items-center justify-center transition active:scale-95 ${
            showTraffic ? 'bg-[#E85D04] text-white' : 'bg-white/95 backdrop-blur text-slate-700 hover:text-[#E85D04]'
          }`}
          title="Toggle Traffic Layer"
          aria-label="Toggle Traffic Layer"
        >
          <Layers className="w-4 h-4" />
        </button>

        <button
          onClick={() => handleZoom(1)}
          className="w-10 h-10 rounded-2xl bg-white/95 backdrop-blur text-slate-700 hover:text-[#E85D04] shadow-lg border border-black/5 flex items-center justify-center transition active:scale-95"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          onClick={() => handleZoom(-1)}
          className="w-10 h-10 rounded-2xl bg-white/95 backdrop-blur text-slate-700 hover:text-[#E85D04] shadow-lg border border-black/5 flex items-center justify-center transition active:scale-95"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>

        {onToggleMaximize && (
          <button
            onClick={onToggleMaximize}
            className="w-10 h-10 rounded-2xl bg-white/95 backdrop-blur text-slate-700 hover:text-[#E85D04] shadow-lg border border-black/5 flex items-center justify-center transition active:scale-95"
            title={isMaximized ? 'Minimize Map' : 'Maximize Map'}
            aria-label={isMaximized ? 'Minimize Map' : 'Maximize Map'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Dynamic Map Status Badge */}
      <div className="absolute bottom-2 left-2 z-20 pointer-events-none opacity-90 flex items-center gap-1.5 bg-black/60 text-white backdrop-blur text-[9px] font-bold px-2.5 py-1 rounded-full shadow">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>{activeEngine === 'GOOGLE' ? 'Google Maps Dynamic API' : 'Dynamic GPS Live Map'}</span>
      </div>
    </div>
  );
};
