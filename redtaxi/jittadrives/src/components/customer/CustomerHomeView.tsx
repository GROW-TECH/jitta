import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Menu,
  Search,
  ChevronRight,
  Navigation,
  Clock,
  MapPin,
} from 'lucide-react';
import { useTaxiApp } from '../../context/TaxiAppContext';
import { InteractiveMap } from '../common/InteractiveMap';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { detectLiveDynamicLocation } from '../../services/locationService';
import { ALL_TAMIL_NADU_LOCATIONS } from '../../data/tamilNaduLocations';

export const CustomerHomeView: React.FC = () => {
  const [isUpdatingGps, setIsUpdatingGps] = useState<boolean>(false);

  // Draggable Bottom Card snap states: PEEK (compact), HALF (normal), EXPANDED (full)
  const [snapState, setSnapState] = useState<'PEEK' | 'HALF' | 'EXPANDED'>('HALF');
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const hasMovedRef = useRef<boolean>(false);

  const {
    language,
    setCustomerScreen,
    pickupLocation,
    setPickupLocation,
    setDropLocation,
    setRideType,
    isFetchingLocation,
    customerProfile,
    isCustomerAuthenticated,
    allBookings,
  } = useTaxiApp() as any;

  // Derive user-specific storage key only for authenticated users
  const isGuest = !isCustomerAuthenticated || !customerProfile?.id || customerProfile.id === 'cust-1';
  const userIdentifier = useMemo(() => {
    if (isGuest) return 'guest';
    if (customerProfile?.id && customerProfile.id !== 'cust-1') return `user_${customerProfile.id}`;
    if (customerProfile?.phone) return `phone_${customerProfile.phone.replace(/\D/g, '').slice(-10)}`;
    return 'guest';
  }, [isGuest, customerProfile?.id, customerProfile?.phone]);

  const recentsKey = `jitta_recent_destinations_${userIdentifier}`;

  // Dynamically compute suggestions:
  // - Logged-in users with travel history: Actual user recent destinations (with RECENT badge)
  // - Unauthenticated users / guests / no travel history: Closest Bus Stand, Railway Station, and Landmark to their captured live GPS (with NEARBY badge, NO RECENT tag, NO mock data!)
  const suggestionsList = useMemo(() => {
    if (!isGuest) {
      // 1. Check user-scoped recent destinations from localStorage
      try {
        const raw = localStorage.getItem(recentsKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.slice(0, 3).map((item: any) => ({
              name: item.primaryText || item.name,
              address: item.secondaryText || item.address || item.fullText || '',
              lat: item.lat,
              lng: item.lng,
              isRecent: true,
            }));
          }
        }
      } catch {}

      // 2. Fallback to this specific authenticated user's completed trips from backend
      if (allBookings && Array.isArray(allBookings) && allBookings.length > 0) {
        const completed = allBookings
          .filter((b: any) => b.status === 'COMPLETED' || b.status === 'PAID')
          .slice(0, 5);
        const tripRecents: any[] = [];
        const seen = new Set<string>();
        for (const trip of completed) {
          const dropName = trip.drop?.name || (typeof trip.drop === 'string' ? trip.drop : null);
          const dropAddr = trip.drop?.address || (typeof trip.drop === 'string' ? trip.drop : '');
          const dLat = Number(trip.drop?.lat || trip.drop_lat);
          const dLng = Number(trip.drop?.lng || trip.drop_lng);
          if (dropName && !seen.has(dropName.toLowerCase().trim())) {
            seen.add(dropName.toLowerCase().trim());
            tripRecents.push({
              name: dropName,
              address: dropAddr,
              lat: !isNaN(dLat) && dLat !== 0 ? dLat : 11.6643,
              lng: !isNaN(dLng) && dLng !== 0 ? dLng : 78.1460,
              isRecent: true,
            });
            if (tripRecents.length >= 3) break;
          }
        }
        if (tripRecents.length > 0) {
          return tripRecents;
        }
      }
    }

    // 3. For users who didn't log in (or users with no past trips):
    // Dynamically calculate the closest Bus Stand, Railway Station, and Landmark
    // to their captured live GPS coordinates! NO mock data, NO RECENT tag!
    const userLat = Number(pickupLocation?.lat) || 11.6643;
    const userLng = Number(pickupLocation?.lng) || 78.1460;

    const computeDist = (lat: number, lng: number) => {
      const dLat = (lat - userLat) * 111.32;
      const dLng = (lng - userLng) * 111.32 * Math.cos((userLat * Math.PI) / 180);
      return dLat * dLat + dLng * dLng;
    };

    // Find closest Bus Stand to captured GPS
    const busStands = ALL_TAMIL_NADU_LOCATIONS
      .filter((loc) => /bus stand|bus terminus|bus stop/i.test(loc.name) || /bus stand/i.test(loc.address || ''))
      .map((loc) => ({ ...loc, distSq: computeDist(loc.lat, loc.lng) }))
      .sort((a, b) => a.distSq - b.distSq);

    // Find closest Railway Station to captured GPS
    const railwayStations = ALL_TAMIL_NADU_LOCATIONS
      .filter((loc) => /railway|junction|station/i.test(loc.name) || loc.category === 'STATION')
      .map((loc) => ({ ...loc, distSq: computeDist(loc.lat, loc.lng) }))
      .sort((a, b) => a.distSq - b.distSq);

    // Find closest Major Landmark / Hub
    const majorLandmarks = ALL_TAMIL_NADU_LOCATIONS
      .filter((loc) => !/bus stand|railway/i.test(loc.name))
      .map((loc) => ({ ...loc, distSq: computeDist(loc.lat, loc.lng) }))
      .sort((a, b) => a.distSq - b.distSq);

    const nearestList: any[] = [];
    const seenNames = new Set<string>();

    const addIfUnique = (candidate?: any) => {
      if (candidate && !seenNames.has(candidate.name.toLowerCase().trim())) {
        seenNames.add(candidate.name.toLowerCase().trim());
        nearestList.push({
          name: candidate.name,
          address: candidate.address || 'Tamil Nadu',
          lat: candidate.lat,
          lng: candidate.lng,
          isRecent: false, // NO recent tag for non-logged in users!
        });
      }
    };

    // Pick top closest: 1 Bus Stand, 1 Railway Station, 1 Major Landmark
    addIfUnique(busStands[0]);
    addIfUnique(railwayStations[0]);
    addIfUnique(majorLandmarks[0]);

    if (nearestList.length < 3 && busStands[1]) addIfUnique(busStands[1]);
    if (nearestList.length < 3 && railwayStations[1]) addIfUnique(railwayStations[1]);
    if (nearestList.length < 3 && majorLandmarks[1]) addIfUnique(majorLandmarks[1]);

    return nearestList;
  }, [isGuest, recentsKey, allBookings, pickupLocation?.lat, pickupLocation?.lng]);

  // Snap heights: PEEK (~150px: handle + search), HALF (~330px: 3 recents + GPS), EXPANDED (~520px)
  const getSnapHeights = () => {
    const containerH = containerRef.current?.clientHeight || window.innerHeight;
    return {
      PEEK: 155,
      HALF: Math.min(345, containerH * 0.52),
      EXPANDED: Math.min(540, containerH * 0.76),
    };
  };

  const getTargetHeight = (snap: 'PEEK' | 'HALF' | 'EXPANDED') => {
    const snaps = getSnapHeights();
    return snaps[snap];
  };

  // Drag Gesture Listeners (Touch & Mouse)
  const startDrag = (clientY: number) => {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartYRef.current = clientY;
    const currentH = dragHeight ?? getTargetHeight(snapState);
    dragStartHeightRef.current = currentH;
    setIsDragging(true);
  };

  const onDragMove = (clientY: number) => {
    if (!isDraggingRef.current) return;
    const deltaY = dragStartYRef.current - clientY; // Upward drag = positive height increase
    if (Math.abs(deltaY) > 5) {
      hasMovedRef.current = true;
    }
    const snaps = getSnapHeights();
    const minH = snaps.PEEK - 20;
    const maxH = snaps.EXPANDED + 20;
    const newH = Math.max(minH, Math.min(maxH, dragStartHeightRef.current + deltaY));
    setDragHeight(newH);
  };

  const endDrag = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    if (!hasMovedRef.current) {
      // Tap on drag handle: toggle between PEEK and HALF/EXPANDED
      setDragHeight(null);
      setSnapState((prev) => (prev === 'EXPANDED' ? 'HALF' : prev === 'HALF' ? 'EXPANDED' : 'HALF'));
      return;
    }

    const currentH = dragHeight ?? getTargetHeight(snapState);
    const snaps = getSnapHeights();

    const diffPeek = Math.abs(currentH - snaps.PEEK);
    const diffHalf = Math.abs(currentH - snaps.HALF);
    const diffExpanded = Math.abs(currentH - snaps.EXPANDED);

    if (diffPeek <= diffHalf && diffPeek <= diffExpanded) {
      setSnapState('PEEK');
    } else if (diffHalf <= diffPeek && diffHalf <= diffExpanded) {
      setSnapState('HALF');
    } else {
      setSnapState('EXPANDED');
    }
    setDragHeight(null);
  };

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (isDraggingRef.current && e.touches[0]) {
        onDragMove(e.touches[0].clientY);
      }
    };
    const handleTouchEnd = () => {
      if (isDraggingRef.current) endDrag();
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        onDragMove(e.clientY);
      }
    };
    const handleMouseUp = () => {
      if (isDraggingRef.current) endDrag();
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [snapState, dragHeight]);

  const handleSelectRecent = (item: any) => {
    setDropLocation({
      name: item.name,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
    });
    setCustomerScreen('VEHICLE_SELECT');
  };

  const currentHeightPx = dragHeight ?? getTargetHeight(snapState);

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] relative overflow-hidden font-sans select-none"
    >
      {/* Top App Bar */}
      <header className="w-full h-14 bg-white border-b border-black/10 px-3 sm:px-4 z-30 flex items-center justify-between shrink-0 shadow-xs">
        {/* Left: Menu button */}
        <div className="flex items-center justify-start flex-1 min-w-0">
          <button
            onClick={() => setCustomerScreen('PROFILE')}
            className="w-9 h-9 bg-black/5 hover:bg-black/10 active:scale-95 rounded-xl flex items-center justify-center text-[#525252] hover:text-[#171717] transition shrink-0"
            aria-label="Open Profile Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Center: Brand Logo & Title */}
        <div
          className="flex items-center justify-center gap-2 cursor-pointer shrink-0 px-2"
          onClick={() => setCustomerScreen('HOME')}
        >
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Jitta Drives Logo"
            className="w-7 h-7 object-contain shrink-0"
          />
          <span className="font-extrabold text-base tracking-tight text-[#171717] whitespace-nowrap flex items-center">
            Jitta&nbsp;<span className="text-[#E85D04]">Drives</span>
          </span>
        </div>

        {/* Right: Language Switcher */}
        <div className="flex items-center justify-end flex-1 min-w-0">
          <LanguageSwitcher compact={true} forceLight={true} />
        </div>
      </header>

      {/* Main Body - Map taking background with Draggable Bottom Card */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {/* Main Interactive Map View */}
        <div className="w-full h-full relative flex-1">
          <InteractiveMap
            pickup={pickupLocation}
            showNearbyDrivers={true}
            height="h-full"
            forceLight={true}
          />

          {/* Rapido-Style Location Pill Badge on Map */}
          <div
            onClick={() => setCustomerScreen('SEARCH_LOCATION')}
            className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-md z-20 bg-white/95 text-[#171717] border border-black/10 px-3.5 py-2 rounded-full shadow-lg flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md cursor-pointer hover:bg-white active:scale-98 transition-all"
            title="Search or set pickup location"
          >
            {isFetchingLocation || isUpdatingGps || !pickupLocation?.name ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 animate-ping" />
                <span className="truncate text-gray-500 font-medium">
                  {language === 'ta' ? 'இடம் பெறப்படுகிறது...' : 'Locating GPS...'}
                </span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-[#22A06B] shrink-0 border-2 border-white ring-1 ring-[#22A06B]" />
                <span className="truncate font-semibold text-[#171717] tracking-tight">
                  {pickupLocation.name}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DRAGGABLE SEARCH CARD OVER MAP (Matching Screenshot 1)                    */}
        {/* Can be dragged UP and DOWN with finger or mouse                          */}
        {/* ========================================================================= */}
        <div
          style={{
            height: `${currentHeightPx}px`,
            transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="absolute bottom-2 left-3 right-3 md:left-auto md:right-1/2 md:translate-x-1/2 md:w-[460px] bg-white border border-black/10 rounded-3xl shadow-2xl p-4 z-30 flex flex-col overflow-hidden will-change-[height]"
        >
          {/* Drag Handle Bar (Touch / Mouse drag target) */}
          <div
            onMouseDown={(e) => startDrag(e.clientY)}
            onTouchStart={(e) => {
              if (e.touches[0]) startDrag(e.touches[0].clientY);
            }}
            className="w-full pt-0.5 pb-2 cursor-grab active:cursor-grabbing shrink-0 flex items-center justify-center"
            title="Drag search box up or down"
          >
            <div className="w-12 h-1.5 bg-gray-300 hover:bg-gray-400 rounded-full transition-colors" />
          </div>


          {/* Search Bar Input Trigger */}
          <div
            onClick={() => setCustomerScreen('SEARCH_LOCATION')}
            className="bg-gray-100 hover:bg-gray-200/80 p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition shrink-0 mb-2"
          >
            <Search className="w-4 h-4 text-[#171717] shrink-0" />
            <span className="text-xs font-bold text-[#737373] flex-1 truncate">
              Where do you want to go?
            </span>
          </div>

          {/* Location Suggestions List (User Recent Trips or Nearby Places) */}
          <div className="flex-1 overflow-y-auto space-y-1 divide-y divide-black/5 overscroll-contain">
            {suggestionsList.map((item: any, idx: number) => (
              <div
                key={idx}
                onClick={() => handleSelectRecent(item)}
                className="pt-2 pb-1.5 flex items-center justify-between cursor-pointer hover:bg-black/5 rounded-xl px-1 transition group"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1 pr-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    item.isRecent
                      ? 'bg-gray-100 text-[#737373] group-hover:bg-[#FFF7F0] group-hover:text-[#E85D04]'
                      : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                  }`}>
                    {item.isRecent ? (
                      <Clock className="w-3.5 h-3.5" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#171717] group-hover:text-[#E85D04] truncate transition-colors">
                        {item.name}
                      </span>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                        item.isRecent
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                      }`}>
                        {item.isRecent ? 'RECENT' : 'NEARBY'}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#737373] truncate mt-0.5">
                      {item.address}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#A3A3A3] shrink-0" />
              </div>
            ))}
          </div>

          {/* Floating Current GPS Pill Button */}
          <div className="flex justify-center pt-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                setIsUpdatingGps(true);
                try {
                  const loc = await detectLiveDynamicLocation();
                  if (loc) {
                    setPickupLocation(loc);
                  }
                } finally {
                  setIsUpdatingGps(false);
                }
              }}
              disabled={isUpdatingGps}
              className="flex items-center gap-1.5 bg-white border border-black/10 px-3.5 py-1.5 rounded-full text-xs font-bold text-[#171717] hover:bg-gray-50 active:scale-95 transition shadow-2xs"
            >
              <Navigation
                className={`w-3.5 h-3.5 text-[#22A06B] ${isUpdatingGps ? 'animate-spin' : ''}`}
              />
              <span>{isUpdatingGps ? 'Locating...' : 'Current GPS'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
