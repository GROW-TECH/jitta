import React, { useState, useRef, useEffect } from 'react';
import { Navigation, Plus, Minus, MapPin, Maximize2, Minimize2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationPoint } from '../../types/taxi';
import { useTaxiApp } from '../../context/TaxiAppContext';
import { loadGoogleMaps, isGoogleMapsAuthFailed } from '../../utils/googleMapsLoader';
import { detectLiveDynamicLocation } from '../../services/locationService';

// Global route geometry cache so identical routes never flicker or re-fetch across renders
const globalRoadGeometryCache = new Map<string, [number, number][]>();

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
  showControls?: boolean;
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
  showControls = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const googleContainerRef = useRef<HTMLDivElement>(null);
  const leafletContainerRef = useRef<HTMLDivElement>(null);

  const googleMapInstanceRef = useRef<any>(null);
  const leafletMapInstanceRef = useRef<L.Map | null>(null);

  const googlePolylineRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const googleRouteKeyRef = useRef<string>('');

  const leafletMarkersRef = useRef<L.Marker[]>([]);
  const leafletPolylineRef = useRef<L.Polyline | null>(null);
  const leafletCarMarkerRef = useRef<L.Marker | null>(null);
  const leafletDriverLiveMarkerRef = useRef<L.Marker | null>(null);
  const leafletRouteKeyRef = useRef<string>('');
  const leafletRoadCoordsRef = useRef<[number, number][]>([]);

  const [activeEngine, setActiveEngine] = useState<'GOOGLE' | 'LEAFLET'>('LEAFLET');
  const [zoomLevel, setZoomLevel] = useState<number>(14);

  const { themeMode, setPickupLocation } = useTaxiApp();
  const isLight = forceLight || themeMode === 'LIGHT';

  // Default coordinate: driverLocation takes priority, then pickup, fallback to Salem
  const defaultCenter = {
    lat: isFinite(Number(driverLocation?.lat))
      ? Number(driverLocation!.lat)
      : isFinite(Number(pickup?.lat))
        ? Number(pickup!.lat)
        : 11.6643,
    lng: isFinite(Number(driverLocation?.lng))
      ? Number(driverLocation!.lng)
      : isFinite(Number(pickup?.lng))
        ? Number(pickup!.lng)
        : 78.1460,
  };

  // Stable normalized coordinates to prevent re-render thrashing
  const pLat = pickup?.lat != null && isFinite(Number(pickup.lat)) ? Number(Number(pickup.lat).toFixed(5)) : null;
  const pLng = pickup?.lng != null && isFinite(Number(pickup.lng)) ? Number(Number(pickup.lng).toFixed(5)) : null;
  const dLat = drop?.lat != null && isFinite(Number(drop.lat)) ? Number(Number(drop.lat).toFixed(5)) : null;
  const dLng = drop?.lng != null && isFinite(Number(drop.lng)) ? Number(Number(drop.lng).toFixed(5)) : null;

  const stopsKey = stops
    .map((s) => `${Number(s?.lat).toFixed(5)},${Number(s?.lng).toFixed(5)}`)
    .filter((s) => !s.includes('NaN'))
    .join(';');

  const currentRouteKey = (pLat !== null && pLng !== null && dLat !== null && dLng !== null)
    ? `${pLat},${pLng};${stopsKey}->${dLat},${dLng}`
    : '';

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

  // Google Maps Markers & Directions (Stable: only fetches when route key changes)
  useEffect(() => {
    if (activeEngine !== 'GOOGLE' || !googleMapInstanceRef.current) return;
    const g = (window as any).google?.maps;
    const map = googleMapInstanceRef.current;
    if (!g || !map) return;

    googleMarkersRef.current.forEach((m) => {
      try {
        if (typeof m.setMap === 'function') m.setMap(null);
        else m.map = null;
      } catch { }
    });
    googleMarkersRef.current = [];

    if (pLat !== null && pLng !== null && dLat !== null && dLng !== null) {
      if (currentRouteKey && googleRouteKeyRef.current !== currentRouteKey) {
        googleRouteKeyRef.current = currentRouteKey;

        const validStops = stops
          .map((s) => [Number(s?.lat), Number(s?.lng)] as [number, number])
          .filter(([slat, slng]) => isFinite(slat) && isFinite(slng));

        const coordsStr = validStops.length > 0
          ? `${pLng},${pLat};${validStops.map(([lat, lng]) => `${lng},${lat}`).join(';')};${dLng},${dLat}`
          : `${pLng},${pLat};${dLng},${dLat}`;

        const fetchedKey = currentRouteKey;

        const applyGoogleRoadCoords = (roadCoords: { lat: number; lng: number }[]) => {
          if (!googleMapInstanceRef.current) return;
          if (googlePolylineRef.current) {
            googlePolylineRef.current.setPath(roadCoords);
            googlePolylineRef.current.setOptions({
              strokeColor: '#1e293b',
              strokeOpacity: 0.95,
              strokeWeight: 6,
            });
            googlePolylineRef.current.setMap(map);
          } else {
            googlePolylineRef.current = new g.Polyline({
              map,
              path: roadCoords,
              strokeColor: '#1e293b',
              strokeOpacity: 0.95,
              strokeWeight: 6,
              lineCap: 'round',
              lineJoin: 'round',
            });
          }
          const bounds = new g.LatLngBounds();
          roadCoords.forEach((pt) => bounds.extend(pt));
          map.fitBounds(bounds, 60);
        };

        if (globalRoadGeometryCache.has(currentRouteKey)) {
          const cached = globalRoadGeometryCache.get(currentRouteKey)!;
          applyGoogleRoadCoords(cached.map(([lat, lng]) => ({ lat, lng })));
        } else {
          fetch(`https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data?.routes?.[0]?.geometry?.coordinates && googleRouteKeyRef.current === fetchedKey) {
                const rawCoords = data.routes[0].geometry.coordinates as [number, number][];
                const latLngTuples = rawCoords.map(([lng, lat]) => [lat, lng] as [number, number]);
                globalRoadGeometryCache.set(fetchedKey, latLngTuples);
                const roadCoords = rawCoords.map(([lng, lat]) => ({ lat, lng }));
                applyGoogleRoadCoords(roadCoords);
              }
            })
            .catch((err) => {
              console.warn('OSRM route fetch fallback:', err);
              applyGoogleRoadCoords([
                { lat: pLat, lng: pLng },
                ...validStops.map(([lat, lng]) => ({ lat, lng })),
                { lat: dLat, lng: dLng },
              ]);
            });
        }
      }
    } else {
      if (googlePolylineRef.current) {
        try {
          googlePolylineRef.current.setMap(null);
        } catch { }
      }
      googleRouteKeyRef.current = '';
    }

    // Custom HTML Overlay Creator for Google Maps
    const createGoogleHtmlOverlay = (
      lat: number,
      lng: number,
      htmlContent: string,
      onClick?: () => void
    ) => {
      if (!g?.OverlayView) return null;
      class GooglePillOverlay extends g.OverlayView {
        private pos = new g.LatLng(lat, lng);
        private el: HTMLElement;
        constructor() {
          super();
          this.el = document.createElement('div');
          this.el.style.position = 'absolute';
          this.el.style.zIndex = '999';
          this.el.style.cursor = 'pointer';
          this.el.style.pointerEvents = 'auto';
          this.el.innerHTML = htmlContent;
          if (onClick) {
            this.el.addEventListener('click', (e: MouseEvent) => {
              e.stopPropagation();
              onClick();
            });
          }
        }
        onAdd() {
          const panes = this.getPanes();
          if (panes?.overlayMouseTarget) {
            panes.overlayMouseTarget.appendChild(this.el);
          }
        }
        draw() {
          const projection = this.getProjection();
          if (!projection || !this.el) return;
          const point = projection.fromLatLngToDivPixel(this.pos);
          if (point) {
            this.el.style.left = `${point.x}px`;
            this.el.style.top = `${point.y}px`;
          }
        }
        onRemove() {
          if (this.el && this.el.parentNode) {
            this.el.parentNode.removeChild(this.el);
          }
        }
      }
      const overlay = new GooglePillOverlay();
      overlay.setMap(map);
      return overlay;
    };

    // 1. Pickup Marker (Concentric Green Ring + Floating White Label Pill)
    if (pLat !== null && pLng !== null) {
      const rawName = pickup?.name || 'Pickup';
      const shortName = rawName.length > 20 ? rawName.slice(0, 18) + '...' : rawName;

      const pickupHtml = `
        <div style="position:relative; width:0; height:0; overflow:visible; display:flex; flex-direction:column; align-items:center; cursor:pointer;" onclick="window.dispatchEvent(new CustomEvent('jitta:edit-pickup'))">
          <div style="position:absolute; bottom:12px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center;">
            <div style="background:#ffffff; color:#171717; padding:4px 10px; border-radius:9999px; box-shadow:0 3px 12px rgba(0,0,0,0.22); border:1px solid rgba(0,0,0,0.08); font-size:11.5px; font-weight:700; display:flex; align-items:center; gap:5px; margin-bottom:5px; white-space:nowrap; pointer-events:auto;">
              <span>${shortName}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#737373" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </div>
          </div>
          <div style="position:absolute; top:-12px; left:-12px; width:24px; height:24px; border-radius:50%; background:#ffffff; border:4px solid #16a34a; box-shadow:0 2px 8px rgba(22,163,74,0.4); display:flex; align-items:center; justify-content:center; pointer-events:auto;">
            <div style="width:7px; height:7px; background:#16a34a; border-radius:50%;"></div>
          </div>
        </div>
      `;

      const overlay = createGoogleHtmlOverlay(pLat, pLng, pickupHtml, () => {
        window.dispatchEvent(new CustomEvent('jitta:edit-pickup'));
      });

      if (overlay) {
        googleMarkersRef.current.push(overlay);
      } else {
        const p = new g.Marker({
          position: { lat: pLat, lng: pLng },
          map,
          title: rawName,
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#16a34a',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
        });
        googleMarkersRef.current.push(p);
      }

      if (dLat === null) map.panTo({ lat: pLat, lng: pLng });
    }

    // 2. Drop Marker (Concentric Red Ring + Floating White Label Pill)
    if (dLat !== null && dLng !== null) {
      const rawName = drop?.name || 'Drop';
      const shortName = rawName.length > 20 ? rawName.slice(0, 18) + '...' : rawName;

      const dropHtml = `
        <div style="position:relative; width:0; height:0; overflow:visible; display:flex; flex-direction:column; align-items:center; cursor:pointer;" onclick="window.dispatchEvent(new CustomEvent('jitta:edit-drop'))">
          <div style="position:absolute; bottom:12px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center;">
            <div style="background:#ffffff; color:#171717; padding:4px 10px; border-radius:9999px; box-shadow:0 3px 12px rgba(0,0,0,0.22); border:1px solid rgba(0,0,0,0.08); font-size:11.5px; font-weight:700; display:flex; align-items:center; gap:5px; margin-bottom:5px; white-space:nowrap; pointer-events:auto;">
              <span>${shortName}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#737373" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </div>
          </div>
          <div style="position:absolute; top:-12px; left:-12px; width:24px; height:24px; border-radius:50%; background:#ffffff; border:4px solid #ef4444; box-shadow:0 2px 8px rgba(239,68,68,0.4); display:flex; align-items:center; justify-content:center; pointer-events:auto;">
            <div style="width:7px; height:7px; background:#ef4444; border-radius:50%;"></div>
          </div>
        </div>
      `;

      const overlay = createGoogleHtmlOverlay(dLat, dLng, dropHtml, () => {
        window.dispatchEvent(new CustomEvent('jitta:edit-drop'));
      });

      if (overlay) {
        googleMarkersRef.current.push(overlay);
      } else {
        const d = new g.Marker({
          position: { lat: dLat, lng: dLng },
          map,
          title: rawName,
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
    }
  }, [activeEngine, pLat, pLng, dLat, dLng, stopsKey, currentRouteKey, pickup?.name, drop?.name]);

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

      // Ultra-fast, crisp, high-resolution road tiles
      const tileUrl = isLight
        ? 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

      const tileLayer = L.tileLayer(tileUrl, {
        subdomains: isLight ? ['0', '1', '2', '3'] : ['a', 'b', 'c', 'd'],
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

  // Leaflet Route Polyline and Markers (Stable: Does NOT wipe or re-fetch on progress/tickers)
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

    const boundsPoints: L.LatLngExpression[] = [];

    try {
      // 1. Pickup Marker (Concentric Green Ring + Floating White Label Pill)
      if (pLat !== null && pLng !== null) {
        const rawName = pickup?.name || 'Pickup';
        const shortName = rawName.length > 20 ? rawName.slice(0, 18) + '...' : rawName;

        const pickupIcon = L.divIcon({
          className: 'custom-pin-pickup',
          html: `
            <div style="position:relative; width:0; height:0; overflow:visible; display:flex; flex-direction:column; align-items:center; cursor:pointer;" onclick="window.dispatchEvent(new CustomEvent('jitta:edit-pickup'))">
              <div style="position:absolute; bottom:12px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center;">
                <div style="background:#ffffff; color:#171717; padding:4px 10px; border-radius:9999px; box-shadow:0 3px 12px rgba(0,0,0,0.22); border:1px solid rgba(0,0,0,0.08); font-size:11.5px; font-weight:700; display:flex; align-items:center; gap:5px; margin-bottom:5px; white-space:nowrap; pointer-events:auto;">
                  <span>${shortName}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#737373" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </div>
              </div>
              <div style="position:absolute; top:-12px; left:-12px; width:24px; height:24px; border-radius:50%; background:#ffffff; border:4px solid #16a34a; box-shadow:0 2px 8px rgba(22,163,74,0.4); display:flex; align-items:center; justify-content:center; pointer-events:auto;">
                <div style="width:7px; height:7px; background:#16a34a; border-radius:50%;"></div>
              </div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const pm = L.marker([pLat, pLng], { icon: pickupIcon }).addTo(lMap);
        leafletMarkersRef.current.push(pm);
        boundsPoints.push([pLat, pLng]);
      }

      // 2. Drop Marker (Concentric Red Ring + Floating White Label Pill)
      if (dLat !== null && dLng !== null) {
        const rawName = drop?.name || 'Drop';
        const shortName = rawName.length > 20 ? rawName.slice(0, 18) + '...' : rawName;

        const dropIcon = L.divIcon({
          className: 'custom-pin-drop',
          html: `
            <div style="position:relative; width:0; height:0; overflow:visible; display:flex; flex-direction:column; align-items:center; cursor:pointer;" onclick="window.dispatchEvent(new CustomEvent('jitta:edit-drop'))">
              <div style="position:absolute; bottom:12px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center;">
                <div style="background:#ffffff; color:#171717; padding:4px 10px; border-radius:9999px; box-shadow:0 3px 12px rgba(0,0,0,0.22); border:1px solid rgba(0,0,0,0.08); font-size:11.5px; font-weight:700; display:flex; align-items:center; gap:5px; margin-bottom:5px; white-space:nowrap; pointer-events:auto;">
                  <span>${shortName}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#737373" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </div>
              </div>
              <div style="position:absolute; top:-12px; left:-12px; width:24px; height:24px; border-radius:50%; background:#ffffff; border:4px solid #ef4444; box-shadow:0 2px 8px rgba(239,68,68,0.4); display:flex; align-items:center; justify-content:center; pointer-events:auto;">
                <div style="width:7px; height:7px; background:#ef4444; border-radius:50%;"></div>
              </div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
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

      // 4. Stable Road Route Polyline (OSRM Engine with In-Memory Caching)
      if (currentRouteKey) {
        const routeChanged = leafletRouteKeyRef.current !== currentRouteKey;

        if (routeChanged) {
          leafletRouteKeyRef.current = currentRouteKey;

          if (globalRoadGeometryCache.has(currentRouteKey)) {
            const cachedCoords = globalRoadGeometryCache.get(currentRouteKey)!;
            leafletRoadCoordsRef.current = cachedCoords;

            if (leafletPolylineRef.current) {
              leafletPolylineRef.current.setLatLngs(cachedCoords);
            } else {
              leafletPolylineRef.current = L.polyline(cachedCoords, {
                color: '#1e293b',
                weight: 6,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }).addTo(lMap);
            }

            lMap.fitBounds(L.latLngBounds(cachedCoords), { padding: [50, 50], maxZoom: 16 });
          } else {
            // Not in cache: only create initial polyline if none exists yet
            if (!leafletPolylineRef.current) {
              const validStops = stops
                .map((s) => [Number(s?.lat), Number(s?.lng)] as [number, number])
                .filter(([slat, slng]) => isFinite(slat) && isFinite(slng));

              leafletPolylineRef.current = L.polyline([[pLat!, pLng!], ...validStops, [dLat!, dLng!]], {
                color: '#1e293b',
                weight: 6,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }).addTo(lMap);

              if (boundsPoints.length > 1) {
                lMap.fitBounds(L.latLngBounds(boundsPoints), { padding: [50, 50], maxZoom: 16 });
              }
            }

            const validStops = stops
              .map((s) => [Number(s?.lat), Number(s?.lng)] as [number, number])
              .filter(([slat, slng]) => isFinite(slat) && isFinite(slng));

            const coordsStr = validStops.length > 0
              ? `${pLng},${pLat};${validStops.map(([lat, lng]) => `${lng},${lat}`).join(';')};${dLng},${dLat}`
              : `${pLng},${pLat};${dLng},${dLat}`;

            const fetchedKey = currentRouteKey;
            fetch(`https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`)
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data?.routes?.[0]?.geometry?.coordinates && leafletPolylineRef.current && leafletRouteKeyRef.current === fetchedKey) {
                  const roadCoords = data.routes[0].geometry.coordinates.map(
                    ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
                  );
                  globalRoadGeometryCache.set(fetchedKey, roadCoords);
                  leafletRoadCoordsRef.current = roadCoords;
                  leafletPolylineRef.current.setLatLngs(roadCoords);
                  lMap.fitBounds(L.latLngBounds(roadCoords), { padding: [50, 50], maxZoom: 16 });
                }
              })
              .catch((err) => console.warn('OSRM route fetch fallback:', err));
          }
        }
        // If !routeChanged: DO NOT TOUCH leafletPolylineRef or map camera!
      } else {
        // No pickup & drop: clean up polyline
        if (leafletPolylineRef.current) {
          try {
            leafletPolylineRef.current.remove();
          } catch { }
          leafletPolylineRef.current = null;
        }
        leafletRoadCoordsRef.current = [];
        leafletRouteKeyRef.current = '';

        if (isFinite(Number(driverLocation?.lat)) && isFinite(Number(driverLocation?.lng))) {
          lMap.setView([Number(driverLocation!.lat), Number(driverLocation!.lng)], 15);
        } else if (pLat !== null && pLng !== null) {
          lMap.setView([pLat, pLng], 15);
        }
      }

      // 5. Nearby Drivers Simulation
      if (showNearbyDrivers && pLat !== null && pLng !== null && dLat === null) {
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
    } catch (err) {
      console.warn('Leaflet render error caught gracefully:', err);
    }
  }, [activeEngine, pLat, pLng, dLat, dLng, stopsKey, currentRouteKey, pickup?.name, drop?.name, showNearbyDrivers, driverLocation?.lat, driverLocation?.lng]);

  // Dedicated Smooth Car Marker Movement along Road Polyline (without re-rendering map or polyline)
  useEffect(() => {
    if (activeEngine !== 'LEAFLET' || !leafletMapInstanceRef.current) return;
    const lMap = leafletMapInstanceRef.current;

    if (typeof progress === 'number' && isFinite(progress) && progress > 0) {
      const roadCoords = leafletRoadCoordsRef.current;
      let lat: number | null = null;
      let lng: number | null = null;

      if (roadCoords && roadCoords.length > 1) {
        const pIdx = Math.max(0, Math.min(1, progress / 100));
        const coordIdx = Math.min(roadCoords.length - 1, Math.floor(pIdx * (roadCoords.length - 1)));
        lat = roadCoords[coordIdx][0];
        lng = roadCoords[coordIdx][1];
      } else if (pLat !== null && pLng !== null && dLat !== null && dLng !== null) {
        const pIdx = Math.max(0, Math.min(1, progress / 100));
        lat = pLat + (dLat - pLat) * pIdx;
        lng = pLng + (dLng - pLng) * pIdx;
      }

      if (lat !== null && lng !== null && isFinite(lat) && isFinite(lng)) {
        if (leafletCarMarkerRef.current) {
          leafletCarMarkerRef.current.setLatLng([lat, lng]);
        } else {
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
          leafletCarMarkerRef.current = L.marker([lat, lng], { icon: carIcon }).addTo(lMap);
        }
      }
    } else {
      if (leafletCarMarkerRef.current) {
        try {
          leafletCarMarkerRef.current.remove();
        } catch { }
          leafletCarMarkerRef.current = null;
      }
    }
  }, [activeEngine, progress, pLat, pLng, dLat, dLng]);

  // Bearing reference for smooth Rapido-style vehicle rotation
  const prevLiveCoordRef = useRef<{ lat: number; lng: number; bearing: number }>({ lat: 0, lng: 0, bearing: 0 });

  // Live Driver GPS Marker on Leaflet Map (Rapido-Style Smooth Animated Vehicle)
  useEffect(() => {
    if (activeEngine !== 'LEAFLET' || !leafletMapInstanceRef.current) return;
    const lMap = leafletMapInstanceRef.current;

    const dLiveLat = driverLocation?.lat != null && isFinite(Number(driverLocation.lat)) ? Number(driverLocation.lat) : null;
    const dLiveLng = driverLocation?.lng != null && isFinite(Number(driverLocation.lng)) ? Number(driverLocation.lng) : null;

    if (dLiveLat !== null && dLiveLng !== null) {
      // Calculate bearing angle between previous and current coordinate
      let bearing = prevLiveCoordRef.current.bearing;
      const prev = prevLiveCoordRef.current;
      if (prev.lat !== 0 && (Math.abs(dLiveLat - prev.lat) > 0.00005 || Math.abs(dLiveLng - prev.lng) > 0.00005)) {
        const y = Math.sin((dLiveLng - prev.lng) * Math.PI / 180) * Math.cos(dLiveLat * Math.PI / 180);
        const x = Math.cos(prev.lat * Math.PI / 180) * Math.sin(dLiveLat * Math.PI / 180) -
                  Math.sin(prev.lat * Math.PI / 180) * Math.cos(dLiveLat * Math.PI / 180) * Math.cos((dLiveLng - prev.lng) * Math.PI / 180);
        bearing = Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
      }
      prevLiveCoordRef.current = { lat: dLiveLat, lng: dLiveLng, bearing };

      const createRapidoVehicleHtml = (rot: number) => `
        <div style="position:relative; width:48px; height:48px; display:flex; align-items:center; justify-content:center;">
          <!-- GPS Pulse Radar Ring -->
          <div style="position:absolute; width:46px; height:46px; border-radius:50%; background:rgba(232,93,4,0.22); animation:ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <!-- Vehicle Directional Icon -->
          <div style="transform: rotate(${rot}deg); transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1); width:38px; height:38px; display:flex; align-items:center; justify-content:center; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.35));">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <!-- Car Body -->
              <rect x="12" y="6" width="24" height="36" rx="8" fill="#1E293B" stroke="#FFFFFF" stroke-width="2.5"/>
              <!-- Front Windshield -->
              <path d="M15 15C15 13 17 11 20 11H28C31 11 33 13 33 15V17H15V15Z" fill="#38BDF8"/>
              <!-- Rear Windshield -->
              <path d="M16 33C16 31 18 30 20 30H28C30 30 32 31 32 33V34H16V33Z" fill="#38BDF8"/>
              <!-- Jitta Taxi Roof Light (Yellow/Orange) -->
              <rect x="20" y="21" width="8" height="6" rx="2" fill="#F59E0B" stroke="#D97706" stroke-width="1"/>
              <!-- Headlights Beam (Glow) -->
              <circle cx="16" cy="7" r="2" fill="#FDE047"/>
              <circle cx="32" cy="7" r="2" fill="#FDE047"/>
              <!-- Taillights -->
              <circle cx="16" cy="41" r="1.8" fill="#EF4444"/>
              <circle cx="32" cy="41" r="1.8" fill="#EF4444"/>
            </svg>
          </div>
        </div>
      `;

      if (leafletDriverLiveMarkerRef.current) {
        leafletDriverLiveMarkerRef.current.setLatLng([dLiveLat, dLiveLng]);
        const el = leafletDriverLiveMarkerRef.current.getElement();
        if (el) {
          const rotContainer = el.querySelector('div > div:nth-child(2)') as HTMLElement;
          if (rotContainer) {
            rotContainer.style.transform = `rotate(${bearing}deg)`;
          }
        }
      } else {
        const driverIcon = L.divIcon({
          className: 'rapido-live-driver-marker',
          html: createRapidoVehicleHtml(bearing),
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        });
        leafletDriverLiveMarkerRef.current = L.marker([dLiveLat, dLiveLng], { icon: driverIcon, zIndexOffset: 1000 }).addTo(lMap);
      }
    } else {
      if (leafletDriverLiveMarkerRef.current) {
        try {
          leafletDriverLiveMarkerRef.current.remove();
        } catch {}
        leafletDriverLiveMarkerRef.current = null;
      }
    }

    return () => {
      if (leafletDriverLiveMarkerRef.current) {
        try {
          leafletDriverLiveMarkerRef.current.remove();
        } catch {}
        leafletDriverLiveMarkerRef.current = null;
      }
    };
  }, [activeEngine, driverLocation?.lat, driverLocation?.lng]);

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

  const handleRecenter = async () => {
    try {
      const loc = await detectLiveDynamicLocation();
      if (loc) {
        if (setPickupLocation) {
          setPickupLocation(loc);
        }
        if (activeEngine === 'GOOGLE' && googleMapInstanceRef.current) {
          googleMapInstanceRef.current.panTo({ lat: loc.lat, lng: loc.lng });
          googleMapInstanceRef.current.setZoom(16);
        } else if (activeEngine === 'LEAFLET' && leafletMapInstanceRef.current) {
          leafletMapInstanceRef.current.setView([loc.lat, loc.lng], 16);
        }
      }
    } catch {
      if (pickup?.lat) {
        if (activeEngine === 'GOOGLE' && googleMapInstanceRef.current) {
          googleMapInstanceRef.current.panTo({ lat: pickup.lat, lng: pickup.lng });
        } else if (activeEngine === 'LEAFLET' && leafletMapInstanceRef.current) {
          leafletMapInstanceRef.current.setView([pickup.lat, pickup.lng], 15);
        }
      }
    }
  };


  return (
    <div
      ref={containerRef}
      className={`relative w-full ${height} overflow-hidden select-none bg-slate-100`}
    >
      {/* Google Maps Canvas (active when key is authorized) */}
      <div
        ref={googleContainerRef}
        className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${activeEngine === 'GOOGLE' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'
          }`}
      />

      {/* Leaflet Live Road Map Canvas (active fallback & instant live roads) */}
      <div
        ref={leafletContainerRef}
        className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${activeEngine === 'LEAFLET' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'
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
      {showControls && (
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
      )}

      {/* Dynamic Map Status Badge */}
      <div className="absolute bottom-2 left-2 z-20 pointer-events-none opacity-90 flex items-center gap-1.5 bg-black/60 text-white backdrop-blur text-[9px] font-bold px-2.5 py-1 rounded-full shadow">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>{activeEngine === 'GOOGLE' ? 'Google Maps Dynamic API' : 'Dynamic GPS Live Map'}</span>
      </div>
    </div>
  );
};
