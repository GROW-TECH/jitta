import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MapPin,
  Plus,
  Trash2,
  ChevronRight,
  Tag,
  Check,
  CreditCard,
  Banknote,
  Users,
  Navigation,
  Landmark,
  X,
  Info,
  Calendar,
  QrCode,
  Briefcase,
  User,
  Snowflake,
  ShieldCheck,
  CheckCircle,
  Car,
} from 'lucide-react';
import { useTaxiApp } from '../../context/TaxiAppContext';
import { InteractiveMap } from '../common/InteractiveMap';
import { ALL_TAMIL_NADU_LOCATIONS } from '../../data/tamilNaduLocations';
import {
  fetchLocationsFromApi,
  reverseGeocodeLiveGps,
  searchLocalTamilNadu,
  detectLiveDynamicLocation,
} from '../../services/locationService';
import { getVehiclePhoto } from '../../utils/vehicleAssets';
import { isCouponValid } from '../../utils/couponUtils';
import type { LocationPoint } from '../../types/taxi';
import { RapidoVehicleAccordionView } from './RapidoVehicleAccordionView';
import { RapidoLocationSearch } from '../common/RapidoLocationSearch';
import { RapidoMapPinPicker } from '../common/RapidoMapPinPicker';

export const CustomerBookingFlow: React.FC = () => {
  const {
    language,
    customerScreen,
    setCustomerScreen,
    customerProfile,
    pickupLocation,
    setPickupLocation,
    dropLocation,
    setDropLocation,
    intermediateStops,
    addStop,
    removeStop,
    selectedVehicle,
    setSelectedVehicle,
    vehicleCategories,
    allCoupons,
    appliedCoupon,
    applyCoupon,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    calculateFare,
    confirmBooking,
    isBookingLoading,
    bookingError,
    estimatedDistance,
    estimatedDuration,
    rideType,
    allOffers,
    offersNotice,
    driverOnlyHours,
    driverOnlyVehicleNumber,
    driverOnlyVehicle,
  } = useTaxiApp() as any;

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(true);
  const [onlineResults, setOnlineResults] = useState<LocationPoint[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState<boolean>(false);
  const [couponCodeInput, setCouponCodeInput] = useState<string>('');
  const [couponMsg, setCouponMsg] = useState<{ success?: boolean; text?: string }>({});
  const [isFetchingGps, setIsFetchingGps] = useState<boolean>(false);
  const [gpsStatus, setGpsStatus] = useState<string>('');

  // Uber Style States
  const [paymentProfileType, setPaymentProfileType] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [showChargesExplained, setShowChargesExplained] = useState<boolean>(false);
  const [showAddCustomPayment, setShowAddCustomPayment] = useState<boolean>(false);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [customUpiInput, setCustomUpiInput] = useState<string>('');

  const distance = estimatedDistance || 8.4;
  const duration = estimatedDuration || 24;
  const fareEstimate = calculateFare(distance, duration, selectedVehicle);

  // Live Location API fetcher for Tamil Nadu when user types
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingOnline(true);
      try {
        const fetched = await fetchLocationsFromApi(searchQuery);
        setOnlineResults(fetched);
      } catch (err) {
        console.warn('API error:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter recommendations based on search text
  const localFilteredLocations = searchLocalTamilNadu(searchQuery, 'ALL');

  // Combined Results (Local curated + Live API fetched)
  const combinedLocations = [
    ...localFilteredLocations,
    ...onlineResults.filter(
      (onl) =>
        !localFilteredLocations.some(
          (loc) => loc.name.toLowerCase() === onl.name.toLowerCase()
        )
    ),
  ];

  // Ultra-fast Dynamic Location Fetcher
  const handleFetchCurrentLocation = async () => {
    setIsFetchingGps(true);
    setGpsStatus('Fetching live dynamic location...');

    try {
      const loc = await detectLiveDynamicLocation();
      if (loc) {
        setPickupLocation(loc);
        setGpsStatus(`GPS Set: ${loc.name}`);
      } else {
        setGpsStatus('GPS unavailable - tap to select');
      }
      setTimeout(() => setGpsStatus(''), 4000);
    } catch {
      setGpsStatus('Location updated');
      setTimeout(() => setGpsStatus(''), 3000);
    } finally {
      setIsFetchingGps(false);
    }
  };


  // 6. Location Search Screen (Rapido Style with Google Places & KM distance)
  if (customerScreen === 'SEARCH_LOCATION') {
    return (
      <RapidoLocationSearch
        currentLocation={pickupLocation}
        onClose={() => setCustomerScreen(rideType === 'DRIVER_ONLY' ? 'BOOKING_CONFIRM' : 'HOME')}
        onSelectLocation={(loc) => {
          setDropLocation(loc);
          setCustomerScreen(rideType === 'DRIVER_ONLY' ? 'BOOKING_CONFIRM' : 'VEHICLE_SELECT');
        }}
      />
    );
  }

  // Old Search Layout Skip
  if (false && customerScreen === 'SEARCH_LOCATION') {
    return (
      <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] p-3 sm:p-4 overflow-hidden font-sans">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCustomerScreen('HOME')}
              className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] hover:text-[#171717] transition min-h-[36px] min-w-[36px]"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base sm:text-lg font-bold">
              {language === 'ta' ? 'சேருமிடம் தேடுக' : 'Search Destination'}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 bg-[#FFF7F0] border border-[#E85D04]/20 px-2.5 py-1 rounded-full">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-4 h-4 object-contain" />
            <span className="text-[10px] text-[#E85D04] font-extrabold">Jitta Drives</span>
          </div>
        </div>

        {/* Pickup & Drop Search Card */}
        <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-3.5 space-y-2.5 mb-3 shadow-sm shrink-0">
          {/* Pickup Input with GPS Fetch button */}
          <div className="flex items-center gap-2.5 bg-[#F9F5F0] p-2.5 rounded-xl border border-black/5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#22A06B] ring-4 ring-[#22A06B]/20 shrink-0" />
            <input
              type="text"
              readOnly
              onClick={() => setCustomerScreen('PICKUP_PIN')}
              value={pickupLocation?.name || (language === 'ta' ? 'தற்போதைய இடம்' : 'Current Location')}
              className="bg-transparent text-xs font-semibold text-[#171717] outline-none flex-1 cursor-pointer truncate"
            />
            <button
              onClick={handleFetchCurrentLocation}
              disabled={isFetchingGps}
              className="flex items-center gap-1 text-[10px] font-bold bg-[#E85D04] text-white hover:bg-[#C2410C] px-2.5 py-1 rounded-lg shadow-xs transition shrink-0"
              title="Fetch Current Live Location via Geolocation API"
            >
              <Navigation className={`w-3 h-3 ${isFetchingGps ? 'animate-spin' : 'fill-white'}`} />
              <span>{isFetchingGps ? (language === 'ta' ? 'கண்டறிகிறது...' : 'Locating...') : (language === 'ta' ? 'நேரலை GPS' : 'GPS Live')}</span>
            </button>
          </div>

          {/* GPS status toast */}
          {gpsStatus && (
            <div className="text-[11px] font-bold text-[#22A06B] bg-[#22A06B]/10 border border-[#22A06B]/30 px-3 py-1 rounded-lg flex items-center gap-1.5">
              <Check className="w-3 h-3" />
              <span>{gpsStatus}</span>
            </div>
          )}

          {/* Intermediate Stops list */}
          {intermediateStops.map((stop: LocationPoint, idx: number) => (
            <div key={idx} className="flex items-center gap-2.5 bg-[#F9F5F0] p-2.5 rounded-xl border border-[#F59E0B]/30">
              <div className="w-4 h-4 rounded-full bg-[#F59E0B] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {idx + 1}
              </div>
              <span className="text-xs font-medium text-amber-800 flex-1 truncate">{stop.name}</span>
              <button onClick={() => removeStop(idx)} className="text-[#A3A3A3] hover:text-rose-600">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Drop Destination Input with Attached Dropdown Selector */}
          <div className="relative">
            <div className="flex items-center gap-2.5 bg-[#F9F5F0] p-2.5 rounded-xl border border-black/10 focus-within:border-[#E85D04] focus-within:ring-2 focus-within:ring-[#E85D04]/10 transition shadow-2xs">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-600 ring-4 ring-rose-600/20 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                placeholder={language === 'ta' ? 'சேருமிடத்தைத் தேடவும் அல்லது உள்ளிடவும்...' : 'Search or enter drop destination (Manual)...'}
                className="bg-transparent text-xs font-bold text-[#171717] outline-none flex-1 placeholder-[#A3A3A3]"
                autoFocus
              />
              {isSearchingOnline && (
                <div className="flex items-center gap-1 text-[10px] text-[#E85D04] font-bold animate-pulse shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E85D04] animate-ping" />
                  <span>{language === 'ta' ? 'தேடுகிறது...' : 'Searching...'}</span>
                </div>
              )}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setShowDropdown(false);
                  }}
                  className="w-5 h-5 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-[#737373] text-xs shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Dropdown Selector for Live Location API & Places */}
            {showDropdown && searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-[#E85D04]/30 rounded-2xl shadow-2xl max-h-80 overflow-y-auto divide-y divide-black/5 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="sticky top-0 bg-[#FFF7F0] px-3 py-1.5 flex items-center justify-between text-[10px] font-extrabold text-[#E85D04] border-b border-[#E85D04]/20 z-10">
                  <span>
                    {language === 'ta'
                      ? `இடத்தைத் தேர்ந்தெடுக்கவும் (${combinedLocations.length})`
                      : `Select Destination (${combinedLocations.length})`}
                  </span>
                  {isSearchingOnline && (
                    <span className="text-[9px] font-semibold text-[#B45309]">
                      Live API
                    </span>
                  )}
                </div>

                {combinedLocations.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#737373]">
                    {isSearchingOnline
                      ? (language === 'ta' ? 'இடங்களைத் தேடுகிறது...' : 'Searching places...')
                      : (language === 'ta' ? 'பொருத்தமான இடங்கள் கிடைக்கவில்லை' : 'No places found')}
                  </div>
                ) : (
                  combinedLocations.map((loc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setDropLocation(loc);
                        setSearchQuery(loc.name);
                        setShowDropdown(false);
                        setCustomerScreen('DESTINATION_CONFIRM');
                      }}
                      className="w-full text-left p-3 hover:bg-[#FFF7F0] active:bg-[#FFEEDB] flex items-center gap-3 transition group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-xl bg-[#FFF7F0] group-hover:bg-[#E85D04] text-[#E85D04] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#171717] group-hover:text-[#E85D04] truncate block transition-colors">
                            {loc.name}
                          </span>
                          {loc.category && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#F9F5F0] text-[#737373] shrink-0 border border-black/5">
                              {loc.category}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#737373] truncate block mt-0.5">
                          {loc.address}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold bg-[#FFF7F0] text-[#E85D04] border border-[#E85D04]/30 px-2.5 py-1 rounded-lg shrink-0 group-hover:bg-[#E85D04] group-hover:text-white transition">
                        {language === 'ta' ? 'தேர்வு' : 'Select'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Add Stop Button */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setCustomerScreen('ADD_STOP')}
              className="flex items-center gap-1.5 text-xs text-[#E85D04] hover:text-[#C2410C] font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === 'ta' ? 'வழியில் நிறுத்தத்தைச் சேர்க்க' : 'Add Stop along the route'}</span>
            </button>
            <button
              onClick={() => setCustomerScreen('PICKUP_PIN')}
              className="text-[11px] text-[#737373] hover:text-[#171717] underline font-semibold"
            >
              {language === 'ta' ? 'மேப்பில் குறிக்க' : 'Pin on map'}
            </button>
          </div>
        </div>

        {/* When no search query: Show Saved Places */}
        {!searchQuery.trim() && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 pt-1">
            <div className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider sticky top-0 bg-[#FAFAF8] py-1 flex items-center justify-between z-10">
              <span>{language === 'ta' ? 'சேமிக்கப்பட்ட இடங்கள்' : 'Saved Places'}</span>
              <button
                onClick={() => setCustomerScreen('SAVED_PLACES')}
                className="text-[10px] text-[#E85D04] font-bold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>{language === 'ta' ? '+ புதிய இடம் சேர்' : '+ Add Place'}</span>
              </button>
            </div>

            {customerProfile?.savedPlaces && customerProfile.savedPlaces.length > 0 ? (
              customerProfile.savedPlaces.map((sp: any) => (
                <div
                  key={sp.id}
                  onClick={() => {
                    setDropLocation({ name: sp.label, address: sp.address, lat: 11.0168, lng: 76.9558, category: 'POPULAR' });
                    setCustomerScreen('DESTINATION_CONFIRM');
                  }}
                  className="bg-white border border-black/5 p-3 rounded-2xl flex items-center gap-3 cursor-pointer hover:border-[#E85D04]/40 hover:bg-[#FFF7F0]/40 transition shadow-xs group"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#E85D04]/10 text-[#E85D04] flex items-center justify-center shrink-0 font-bold group-hover:scale-105 transition-transform">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-[#171717] truncate">{sp.label}</h4>
                    <p className="text-[11px] text-[#737373] truncate mt-0.5">{sp.address}</p>
                  </div>
                  <span className="text-[10px] font-bold bg-[#FFF7F0] text-[#E85D04] border border-[#E85D04]/20 px-2.5 py-1 rounded-lg shrink-0 group-hover:bg-[#E85D04] group-hover:text-white transition">
                    {language === 'ta' ? 'தேர்வு' : 'Select'}
                  </span>
                </div>
              ))
            ) : (
              <div className="bg-white border border-dashed border-[#E85D04]/30 rounded-2xl p-4 text-center my-2">
                <MapPin className="w-6 h-6 text-[#E85D04] mx-auto mb-1 opacity-60" />
                <p className="text-xs font-bold text-[#171717]">
                  {language === 'ta' ? 'சேமிக்கப்பட்ட இடங்கள் எதுவும் இல்லை' : 'No Saved Places yet'}
                </p>
                <p className="text-[10px] text-[#737373] mt-0.5 mb-2.5">
                  {language === 'ta' ? 'வீடு, அலுவலகம் ஆகியவற்றை 1-கிளிக் முன்பதிவுக்கு சேமிக்கவும்' : 'Save Home, Work or frequent places for 1-click booking'}
                </p>
                <button
                  onClick={() => setCustomerScreen('SAVED_PLACES')}
                  className="text-xs font-bold bg-[#E85D04] text-white px-3.5 py-1.5 rounded-xl hover:bg-[#C2410C] transition shadow-xs inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'ta' ? 'புதிய இடம் சேமி' : 'Add New Place'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 7. Rapido-Style Location Pin Adjuster (Pickup / Drop)
  if (customerScreen === 'PICKUP_PIN') {
    return (
      <RapidoMapPinPicker
        initialLocation={pickupLocation}
        mode="pickup"
        onBack={() => setCustomerScreen('SEARCH_LOCATION')}
        onConfirm={(loc) => {
          setPickupLocation(loc);
          setCustomerScreen('SEARCH_LOCATION');
        }}
      />
    );
  }

  // 8. Destination Selection & Route Preview Screen
  if (customerScreen === 'DESTINATION_CONFIRM') {
    return (
      <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] relative">
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20">
          <button
            onClick={() => setCustomerScreen('SEARCH_LOCATION')}
            className="w-9 h-9 bg-white/95 backdrop-blur rounded-xl border border-black/10 flex items-center justify-center text-[#525252] shadow min-h-[36px] min-w-[36px]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        <InteractiveMap pickup={pickupLocation} drop={dropLocation} stops={intermediateStops} height="h-full" forceLight={true} />

        <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-20 bg-white/95 backdrop-blur border border-black/5 p-3.5 sm:p-4 rounded-3xl shadow-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-black/5 pb-2.5 gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-[#737373] font-bold uppercase tracking-wider">Route Preview</span>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-sm font-extrabold text-[#171717]">{distance} KM</span>
                <span className="text-[#A3A3A3]">•</span>
                <span className="text-xs font-bold text-[#22A06B]">{duration} mins travel time</span>
              </div>
            </div>
            <div className="bg-[#E85D04]/10 text-[#E85D04] border border-[#E85D04]/30 text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0">
              Clear Traffic
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-[#525252]">
              <span className="w-2 h-2 rounded-full bg-[#22A06B] shrink-0" />
              <span className="font-semibold text-[#171717] truncate">Pickup: {pickupLocation?.name}</span>
            </div>
            <div className="flex items-center gap-2 text-[#525252]">
              <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
              <span className="font-semibold text-[#171717] truncate">Drop: {dropLocation?.name}</span>
            </div>
          </div>

          <button
            onClick={() => setCustomerScreen(rideType === 'DRIVER_ONLY' ? 'DRIVER_ONLY_BOOKING' : 'VEHICLE_SELECT')}
            className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-[#E85D04]/30 flex items-center justify-center gap-2 transition min-h-[44px] active:scale-98 text-sm"
          >
            <span>{rideType === 'DRIVER_ONLY' ? 'Confirm Route for Active Driver' : 'Proceed to Vehicle Selection'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 9. Add Stop Screen
  if (customerScreen === 'ADD_STOP') {
    return (
      <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] p-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setCustomerScreen('SEARCH_LOCATION')}
            className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] hover:text-[#171717]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-bold">Add Intermediate Stop</h2>
        </div>

        <div className="space-y-3 mb-4 overflow-y-auto">
          <p className="text-xs text-[#737373]">Select an area to add as a stop before reaching final destination.</p>
          <div className="space-y-2">
            {ALL_TAMIL_NADU_LOCATIONS.slice(0, 10).map((loc: LocationPoint, idx: number) => (
              <div
                key={idx}
                onClick={() => {
                  addStop(loc);
                  setCustomerScreen('SEARCH_LOCATION');
                }}
                className="bg-white border border-black/5 p-3 rounded-2xl flex items-center justify-between cursor-pointer hover:border-[#F59E0B]/50 transition"
              >
                <div>
                  <h4 className="text-xs font-bold text-[#171717]">{loc.name}</h4>
                  <p className="text-[11px] text-[#737373]">{loc.address}</p>
                </div>
                <div className="w-7 h-7 bg-[#F59E0B]/10 text-[#F59E0B] rounded-lg flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 11. Vehicle Selection Screen - 3 Collapsible Accordions (Cab & Auto, Bikes, Acting Driver Hire)
  if (customerScreen === 'VEHICLE_SELECT' || customerScreen === 'RIDE_TYPES') {
    return <RapidoVehicleAccordionView />;
  }

  // 13. Coupon Screen
  if (customerScreen === 'COUPONS') {
    const returnScreen = dropLocation ? 'BOOKING_CONFIRM' : 'VEHICLE_SELECT';
    return (
      <div className="h-full w-full flex flex-col bg-[#FAFAF8] text-[#171717] justify-between overflow-y-auto overflow-x-hidden font-sans select-none">
        <div className="w-full max-w-lg mx-auto p-3 sm:p-5 flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setCustomerScreen(returnScreen)}
              className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] hover:text-[#171717] shadow-xs shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-lg sm:text-xl font-bold truncate">Apply Coupon</h2>
          </div>

          {/* Coupon Code Input Box */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={couponCodeInput}
              onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
              placeholder="ENTER PROMO CODE"
              className="bg-white border border-black/10 rounded-xl px-3 sm:px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#171717] outline-none flex-1 min-w-0 focus:border-[#E85D04] placeholder-[#A3A3A3] shadow-xs"
            />
            <button
              onClick={() => {
                if (!couponCodeInput.trim()) return;
                const res = applyCoupon(couponCodeInput.trim());
                setCouponMsg({ text: res.message, success: res.success });
                if (res.success) setTimeout(() => setCustomerScreen(returnScreen), 900);
              }}
              className="bg-[#E85D04] text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-[#C2410C] shrink-0 shadow-xs active:scale-95 transition"
            >
              Apply
            </button>
          </div>

          {couponMsg.text && (
            <div className={`p-2.5 rounded-xl text-xs font-bold mb-4 ${couponMsg.success ? 'bg-[#22A06B]/10 border border-[#22A06B]/30 text-[#15803D]' : 'bg-[#FEF2F2] border border-rose-200 text-rose-700'}`}>
              {couponMsg.text}
            </div>
          )}

          {/* Available Offers & Coupons List */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">
              {language === 'ta' ? 'கிடைக்கும் சலுகைகள்' : 'Available Offers'}
            </div>
            {(() => {
              // 1. Valid backend coupons
              const validCoupons = (allCoupons || []).filter(isCouponValid).map((c: any) => ({
                id: c.id,
                code: c.code,
                title: c.description || `Coupon ${c.code}`,
                discountTag: c.discountType === 'PERCENT' ? `${c.discountAmount}% OFF` : `₹${c.discountAmount} FLAT`,
                expiry: c.expiryDate ? `Valid till ${c.expiryDate}` : 'Limited time offer',
              }));

              // 2. Active promotional offers from admin
              const activeOffersList = (allOffers || [])
                .filter((o: any) => o.isActive !== false && (o.targetAudience === 'CUSTOMERS' || o.targetAudience === 'ALL' || !o.targetAudience))
                .map((o: any) => {
                  let code = (o.code || '').trim().toUpperCase();
                  if (!code || code.includes('%')) {
                    if (o.description && /^[A-Z0-9_-]{3,16}$/i.test(o.description.trim())) {
                      code = o.description.trim().toUpperCase();
                    } else {
                      code = (o.title || 'OFFER').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() + '10';
                    }
                  }
                  return {
                    id: o.id,
                    code: code,
                    title: o.title || 'Special Promotion',
                    discountTag: (o.discountTag && !o.discountTag.includes(code)) ? o.discountTag : 'Special Discount',
                    expiry: o.validity || 'Limited time offer',
                  };
                });

              // Merge and deduplicate by code
              const combinedList = [...validCoupons, ...activeOffersList].filter(
                (item, idx, arr) => item.code && arr.findIndex((x) => x.code === item.code) === idx
              );

              if (combinedList.length === 0) {
                return (
                  <div className="bg-white border border-black/5 p-6 rounded-2xl text-center shadow-xs">
                    <Tag className="w-8 h-8 text-[#A3A3A3] mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-bold text-[#171717]">
                      {language === 'ta' ? 'தற்போது சலுகைகள் எதுவும் இல்லை' : 'No active offers available'}
                    </p>
                    <p className="text-[11px] text-[#737373] mt-1">
                      {offersNotice || (language === 'ta' ? 'விரைவில் புதிய சலுகைகள் வரும்!' : 'Expired offers are hidden. Check back later!')}
                    </p>
                  </div>
                );
              }

              return combinedList.map((c: any) => (
                <div key={c.id || c.code} className="bg-white border border-black/5 p-3.5 rounded-2xl space-y-2 shadow-xs hover:border-[#E85D04]/30 transition">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-extrabold text-xs sm:text-sm text-[#B45309] bg-[#F59E0B]/10 border border-[#F59E0B]/30 px-2.5 py-0.5 rounded-lg truncate tracking-wider">
                        {c.code}
                      </span>
                      {c.discountTag && (
                        <span className="bg-[#FFF7F0] border border-[#E85D04]/20 text-[#E85D04] text-[10px] font-extrabold px-2 py-0.5 rounded-md truncate">
                          {c.discountTag}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        const res = applyCoupon(c.code);
                        setCouponMsg({ text: res.message, success: res.success });
                        if (res.success) {
                          setTimeout(() => setCustomerScreen(returnScreen), 700);
                        }
                      }}
                      className="text-xs text-[#E85D04] font-black hover:text-[#C2410C] shrink-0 uppercase tracking-wide bg-[#FFF7F0] hover:bg-[#FFEBD9] px-3.5 py-1.5 rounded-xl transition active:scale-95"
                    >
                      APPLY
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-[#171717]">{c.title}</p>
                  <span className="text-[10px] text-[#A3A3A3] block">{c.expiry}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    );
  }

  // 14. Payment Method Screen ("Pay with" - White & Orange Theme)
  if (customerScreen === 'PAYMENT_METHOD') {
    return (
      <div className="h-full w-full flex flex-col bg-[#FAFAF8] text-[#171717] font-sans justify-between overflow-y-auto overflow-x-hidden select-none">
        <div className="w-full max-w-lg mx-auto p-3 sm:p-5 flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCustomerScreen(rideType === 'DRIVER_ONLY' ? 'DRIVER_ONLY_BOOKING' : 'BOOKING_CONFIRM')}
              className="w-9 h-9 rounded-full bg-white border border-black/10 hover:bg-black/5 flex items-center justify-center text-[#171717] transition shadow-xs"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-9" />
          </div>

          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight mb-4 sm:mb-5 text-[#171717]">Pay with</h1>

          {/* Toggle Tab: Personal vs Business */}
          <div className="grid grid-cols-2 p-1 bg-[#F5F2EB] rounded-2xl mb-4 sm:mb-6 border border-black/5">
            <button
              onClick={() => setPaymentProfileType('PERSONAL')}
              className={`py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition ${
                paymentProfileType === 'PERSONAL'
                  ? 'bg-[#E85D04] text-white shadow-md shadow-[#E85D04]/30'
                  : 'text-[#737373] hover:text-[#171717]'
              }`}
            >
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Personal</span>
            </button>
            <button
              onClick={() => setPaymentProfileType('BUSINESS')}
              className={`py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition ${
                paymentProfileType === 'BUSINESS'
                  ? 'bg-[#E85D04] text-white shadow-md shadow-[#E85D04]/30'
                  : 'text-[#737373] hover:text-[#171717]'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Business</span>
            </button>
          </div>

          {/* Payment Methods Section */}
          <div className="mb-4 sm:mb-6 bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xs">
            <h2 className="text-sm sm:text-base font-bold text-[#171717] mb-2 sm:mb-3">Payment methods</h2>

            <div className="space-y-1">
              {/* Cash */}
              <div
                onClick={() => {
                  setSelectedPaymentMethod('CASH');
                  setCustomerScreen(rideType === 'DRIVER_ONLY' ? 'DRIVER_ONLY_BOOKING' : 'BOOKING_CONFIRM');
                }}
                className="flex items-center justify-between py-2.5 sm:py-3 px-2 cursor-pointer hover:bg-black/5 rounded-2xl transition gap-2"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#FFF7F0] border border-[#E85D04]/20 text-[#E85D04] flex items-center justify-center shrink-0">
                    <Banknote className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="font-bold text-xs sm:text-sm text-[#171717] truncate">Cash on Ride End</span>
                </div>
                {selectedPaymentMethod === 'CASH' && (
                  <div className="w-5 h-5 rounded-full bg-[#E85D04] text-white flex items-center justify-center shadow-xs shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* UPI Scan and Pay */}
              <div
                onClick={() => {
                  setSelectedPaymentMethod('UPI');
                  setCustomerScreen(rideType === 'DRIVER_ONLY' ? 'DRIVER_ONLY_BOOKING' : 'BOOKING_CONFIRM');
                }}
                className="flex items-center justify-between py-2.5 sm:py-3 px-2 cursor-pointer hover:bg-black/5 rounded-2xl transition gap-2"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#FFF7F0] border border-[#E85D04]/20 text-[#E85D04] flex items-center justify-center shrink-0">
                    <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="font-bold text-xs sm:text-sm text-[#171717] truncate">UPI Scan and Pay</span>
                </div>
                {selectedPaymentMethod === 'UPI' && (
                  <div className="w-5 h-5 rounded-full bg-[#E85D04] text-white flex items-center justify-center shadow-xs shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Bank Transfer / Netbanking */}
              <div
                onClick={() => {
                  setSelectedPaymentMethod('BANK_TRANSFER');
                  setCustomerScreen(rideType === 'DRIVER_ONLY' ? 'DRIVER_ONLY_BOOKING' : 'BOOKING_CONFIRM');
                }}
                className="flex items-center justify-between py-2.5 sm:py-3 px-2 cursor-pointer hover:bg-black/5 rounded-2xl transition gap-2"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#FFF7F0] border border-[#E85D04]/20 text-[#E85D04] flex items-center justify-center shrink-0">
                    <Landmark className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="font-bold text-xs sm:text-sm text-[#171717] truncate">Bank Transfer (IMPS / NEFT)</span>
                </div>
                {selectedPaymentMethod === 'BANK_TRANSFER' && (
                  <div className="w-5 h-5 rounded-full bg-[#E85D04] text-white flex items-center justify-center shadow-xs shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Add payment method */}
              <div
                onClick={() => setShowAddCustomPayment(!showAddCustomPayment)}
                className="flex items-center gap-3 py-2.5 sm:py-3 px-2 cursor-pointer text-[#E85D04] hover:bg-[#FFF7F0] rounded-2xl transition mt-1"
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#FFF7F0] border border-[#E85D04]/30 flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-[#E85D04]" />
                </div>
                <span className="font-bold text-xs sm:text-sm">Add payment method</span>
              </div>
            </div>

            {/* Expandable Add Payment Option */}
            {showAddCustomPayment && (
              <div className="mt-2 p-3 bg-[#FFF7F0]/40 border border-[#E85D04]/20 rounded-2xl space-y-2">
                <div
                  onClick={() => {
                    setSelectedPaymentMethod('CARD');
                    setShowAddCustomPayment(false);
                    setCustomerScreen(rideType === 'DRIVER_ONLY' ? 'DRIVER_ONLY_BOOKING' : 'BOOKING_CONFIRM');
                  }}
                  className="p-2.5 bg-white rounded-xl border border-black/5 flex items-center gap-3 cursor-pointer hover:border-[#E85D04]"
                >
                  <CreditCard className="w-4 h-4 text-[#E85D04]" />
                  <span className="text-xs font-bold">Credit or Debit Card</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-black/5 space-y-2">
                  <div className="flex items-center gap-3">
                    <QrCode className="w-4 h-4 text-[#E85D04]" />
                    <span className="text-xs font-bold">Custom UPI ID</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customUpiInput}
                      onChange={(e) => setCustomUpiInput(e.target.value)}
                      placeholder="e.g. yourname@oksbi"
                      className="flex-1 min-w-0 bg-[#F9F5F0] border border-black/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#E85D04]"
                    />
                    <button
                      onClick={() => {
                        setSelectedPaymentMethod('UPI');
                        setShowAddCustomPayment(false);
                        setCustomerScreen(rideType === 'DRIVER_ONLY' ? 'DRIVER_ONLY_BOOKING' : 'BOOKING_CONFIRM');
                      }}
                      className="bg-[#E85D04] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#C2410C] shrink-0"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Vouchers Section */}
          <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <h2 className="text-sm sm:text-base font-bold text-[#171717]">Vouchers & Coupons</h2>
              <button
                onClick={() => setCustomerScreen('COUPONS')}
                className="text-[11px] sm:text-xs font-bold bg-[#FFF7F0] border border-[#E85D04]/30 text-[#E85D04] px-3 py-1 sm:py-1.5 rounded-full hover:bg-[#E85D04] hover:text-white transition shrink-0"
              >
                See details
              </button>
            </div>

            <div
              onClick={() => setCustomerScreen('COUPONS')}
              className="flex items-center gap-3 py-2 px-1 cursor-pointer hover:bg-black/5 rounded-2xl transition"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#FFF7F0] border border-[#E85D04]/20 flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-[#E85D04]" />
              </div>
              <span className="font-bold text-xs sm:text-sm text-[#171717] truncate">
                {appliedCoupon ? `Applied Voucher: ${appliedCoupon.code}` : 'Add voucher code'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 15. Review Ride Screen (White & Orange Theme)
  if (customerScreen === 'BOOKING_CONFIRM') {
    const isActingDriver = (rideType === 'DRIVER_ONLY') ||
      (selectedVehicle?.id === 'driver_only') ||
      String(selectedVehicle?.name || '').toLowerCase().includes('acting') ||
      (selectedVehicle?.vehicleType === 'ACTING_DRIVER');

    const rawSavings = Number(fareEstimate.discount || 0);
    const baseDisplayPrice = isActingDriver
      ? Number(fareEstimate.baseFare || ((driverOnlyHours || 2) * 200))
      : (rawSavings > 0 ? (fareEstimate.totalFare + rawSavings) : fareEstimate.totalFare);
    const discountedPrice = fareEstimate.totalFare;
    const destinationCity = dropLocation?.name ? dropLocation.name.split(',')[0] : 'As directed';
    const selectedVehPhoto = isActingDriver
      ? '/vehicles/driver_chauffeur.svg'
      : getVehiclePhoto(selectedVehicle.id || selectedVehicle.name, selectedVehicle.image);

    return (
      <div className="h-full w-full flex flex-col bg-[#FAFAF8] text-[#171717] font-sans justify-between overflow-y-auto overflow-x-hidden select-none">
        <div className="w-full max-w-lg mx-auto p-3 sm:p-5 flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3.5">
            <button
              onClick={() => setCustomerScreen('VEHICLE_SELECT')}
              className="w-9 h-9 rounded-xl bg-white border border-black/10 hover:bg-black/5 flex items-center justify-center text-[#171717] transition shadow-xs shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-[#171717] truncate">
              {language === 'ta' ? 'பயண விபரம்' : (isActingDriver ? 'Review acting driver hire' : 'Review ride')}
            </h1>
          </div>

          {/* Top Orange Savings Banner or Apply Coupon Prompt */}
          {rawSavings > 0 ? (
            <div className="bg-[#FFF7F0] border border-[#E85D04]/30 text-[#E85D04] rounded-2xl py-2.5 px-3 sm:px-4 flex items-center justify-between mb-3 sm:mb-4 font-bold text-xs sm:text-sm shadow-xs">
              <div className="flex items-center gap-2 truncate">
                <Tag className="w-4 h-4 fill-[#E85D04] shrink-0" />
                <span className="truncate">
                  {appliedCoupon ? `You're saving ₹${rawSavings.toFixed(2)} with ${appliedCoupon.code}` : `You're saving ₹${rawSavings.toFixed(2)} on your ride`}
                </span>
              </div>
              <button
                onClick={() => setCustomerScreen('COUPONS')}
                className="text-[11px] underline font-extrabold shrink-0 hover:text-[#C2410C]"
              >
                Change
              </button>
            </div>
          ) : (
            <div
              onClick={() => setCustomerScreen('COUPONS')}
              className="bg-[#FFF7F0] border border-dashed border-[#E85D04]/40 text-[#E85D04] rounded-2xl py-2.5 px-3 sm:px-4 flex items-center justify-between mb-3 sm:mb-4 font-bold text-xs sm:text-sm shadow-xs cursor-pointer hover:bg-[#FFF2E5] transition"
            >
              <div className="flex items-center gap-2 truncate">
                <Tag className="w-4 h-4 text-[#E85D04] shrink-0" />
                <span className="truncate">Have a coupon code? Tap to apply & save</span>
              </div>
              <span className="text-xs font-extrabold text-[#E85D04] shrink-0">Apply &gt;</span>
            </div>
          )}

          {/* Selected Vehicle Card */}
          <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-3 sm:p-4 mb-3 sm:mb-4 shadow-xs flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
              <div className="w-14 h-14 bg-white border border-black/5 rounded-2xl overflow-hidden shadow-xs shrink-0 flex items-center justify-center p-1">
                <img
                  src={selectedVehPhoto}
                  alt={isActingDriver ? 'Acting Driver' : selectedVehicle.name}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-lg font-extrabold text-[#171717] truncate">
                  {isActingDriver ? 'Acting Driver' : selectedVehicle.name}
                </h3>
                <p className="text-[11px] sm:text-xs text-[#737373] mt-0.5 truncate">
                  {isActingDriver
                    ? `${driverOnlyHours || 2} Hrs • ${driverOnlyVehicle?.transmission === 'AUTOMATIC' || selectedVehicle?.transmission === 'AUTOMATIC' ? 'Automatic' : 'Manual'} Transmission${driverOnlyVehicleNumber ? ` • ${driverOnlyVehicleNumber}` : ' • Customer Vehicle'}`
                    : (selectedVehicle.tagline || 'Wagon R or similar')}
                </p>
                <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-[#525252] mt-1">
                  {isActingDriver ? (
                    <>
                      <span className="flex items-center gap-1 text-[#E85D04]">
                        <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#E85D04]" /> Verified
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-emerald-600">
                        <Car className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" /> Customer Vehicle
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#E85D04]" /> {selectedVehicle.capacity || 4}</span>
                      <span>•</span>
                      {(() => {
                        const vehId = (selectedVehicle.id || '').toLowerCase();
                        const vehName = (selectedVehicle.name || '').toLowerCase();
                        const vehCat = (selectedVehicle.category || '').toLowerCase();
                        const isTwoWheeler = vehId === 'bike' || vehId === 'scooter' || vehId === 'scooty' || vehCat === 'bike' || vehName.includes('bike') || vehName.includes('scoot');
                        const isAuto = vehId === 'auto' || vehCat === 'auto' || vehName.includes('auto');

                        if (isTwoWheeler) {
                          return (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" /> Helmet Provided
                            </span>
                          );
                        }
                        if (isAuto) {
                          return (
                            <span className="flex items-center gap-1 text-amber-600">
                              <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" /> Doorstep Pickup
                            </span>
                          );
                        }
                        return (
                          <span className="flex items-center gap-1 text-sky-600">
                            <Snowflake className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-500" /> AC
                          </span>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="flex items-center gap-1 justify-end text-sm sm:text-base font-extrabold text-[#E85D04]">
                {rawSavings > 0 && <Tag className="w-3.5 h-3.5 text-[#E85D04] fill-[#E85D04]" />}
                <span>₹{discountedPrice.toFixed(2)}</span>
              </div>
              {rawSavings > 0 && (
                <span className="text-[10px] sm:text-xs text-[#A3A3A3] line-through block mt-0.5">₹{baseDisplayPrice.toFixed(2)}</span>
              )}
            </div>
          </div>

          {/* Trip Heading & Schedule */}
          <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-3 sm:p-4 mb-3 sm:mb-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs sm:text-base font-extrabold text-[#171717] truncate flex-1 min-w-0">
                {isActingDriver
                  ? `Acting Driver Hire (${driverOnlyHours || 2} Hrs)${dropLocation?.name ? ` • To ${destinationCity}` : ''}`
                  : `Trip to ${destinationCity}`}
              </h2>

              <div
                onClick={() => setShowScheduleModal(true)}
                className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold text-[#E85D04] bg-[#FFF7F0] border border-[#E85D04]/30 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full cursor-pointer hover:bg-[#E85D04] hover:text-white transition shrink-0"
              >
                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Ride now</span>
              </div>
            </div>

            {/* Route Timeline */}
            <div className="relative pl-6 space-y-3 pt-0.5">
              {/* Timeline Line */}
              <div className="absolute left-[7px] top-2.5 bottom-2.5 w-0.5 bg-[#E85D04]/40" />

              {/* Pickup */}
              <div className="relative">
                <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-[#E85D04] ring-3 ring-white" />
                <span className="text-[9px] sm:text-[10px] text-[#737373] font-bold uppercase block">Pick-up</span>
                <h4 className="font-extrabold text-xs sm:text-sm text-[#171717] leading-tight truncate">{pickupLocation?.name}</h4>
                <p className="text-[10px] sm:text-[11px] text-[#737373] mt-0.5 truncate">{pickupLocation?.address || 'Pickup address'}</p>
              </div>

              {/* Drop */}
              {dropLocation ? (
                <div className="relative">
                  <div className="absolute -left-6 top-1 w-3 h-3 bg-white border-2 border-[#E85D04] ring-3 ring-white" />
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] sm:text-[10px] text-[#737373] font-bold uppercase block">
                      Drop-off {isActingDriver ? '(Optional)' : ''}
                    </span>
                    {isActingDriver && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCustomerScreen('SEARCH_LOCATION')}
                          className="text-[10px] font-bold text-[#E85D04] hover:underline"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => setDropLocation(null)}
                          className="text-[10px] font-bold text-rose-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <h4 className="font-extrabold text-xs sm:text-sm text-[#171717] leading-tight truncate">{dropLocation?.name}</h4>
                  <p className="text-[10px] sm:text-[11px] text-[#737373] mt-0.5 truncate">{dropLocation?.address || 'Drop-off address'}</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute -left-6 top-1 w-3 h-3 bg-white border-2 border-[#A3A3A3] ring-3 ring-white" />
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] sm:text-[10px] text-[#737373] font-bold uppercase block">Drop-off (Optional)</span>
                      <h4 className="font-bold text-xs sm:text-sm text-[#525252] leading-tight">As directed / Hourly hire</h4>
                      <p className="text-[10px] text-[#A3A3A3]">Driver drives to destinations of your choice</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomerScreen('SEARCH_LOCATION')}
                      className="text-[11px] font-bold text-[#E85D04] bg-[#FFF7F0] border border-[#E85D04]/30 px-2.5 py-1 rounded-lg hover:bg-[#E85D04] hover:text-white transition shrink-0 ml-2 shadow-2xs"
                    >
                      + Add Drop
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Price Breakdown Section */}
          <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-3 sm:p-4 mb-3 sm:mb-4 shadow-xs">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs sm:text-base font-extrabold text-[#171717]">Price breakdown</h3>
              <div
                onClick={() => setShowChargesExplained(!showChargesExplained)}
                className="flex items-center gap-1 text-[11px] sm:text-xs text-[#E85D04] font-bold cursor-pointer hover:underline"
              >
                <span>Fare details</span>
                <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
            </div>

            {showChargesExplained && (
              <div className="p-2.5 sm:p-3 bg-[#FFF7F0] rounded-xl sm:rounded-2xl border border-[#E85D04]/20 space-y-1.5 text-xs mb-2.5">
                {isActingDriver ? (
                  <>
                    <div className="flex justify-between text-[#737373]">
                      <span>Base Rate ({driverOnlyHours || 2} hrs × ₹200/hr)</span>
                      <span>₹{fareEstimate.baseFare || ((driverOnlyHours || 2) * 200)}</span>
                    </div>
                    <div className="flex justify-between text-[#737373]">
                      <span>Platform Service Fee</span>
                      <span>₹{fareEstimate.platformFee || 25}</span>
                    </div>
                    <div className="flex justify-between text-[#737373]">
                      <span>GST (5%)</span>
                      <span>₹{fareEstimate.tax || 20}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-[#737373]">
                      <span>Base Fare ({typeof selectedVehicle === 'string' ? selectedVehicle : (selectedVehicle?.name || 'Vehicle')})</span>
                      <span>₹{fareEstimate.baseFare}</span>
                    </div>
                    <div className="flex justify-between text-[#737373]">
                      <span>Distance Rate ({distance} km)</span>
                      <span>₹{fareEstimate.distanceFare}</span>
                    </div>
                    <div className="flex justify-between text-[#737373]">
                      <span>GST & Platform Charges</span>
                      <span>₹{(fareEstimate.tax || 0) + (fareEstimate.platformFee || 0)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="space-y-1.5 text-xs sm:text-sm font-medium">
              <div className="flex justify-between text-[#737373]">
                <span>{isActingDriver ? `Base price (${driverOnlyHours || 2} hrs × ₹200/hr)` : 'Base price'}</span>
                <span className="font-bold text-[#171717]">₹{baseDisplayPrice.toFixed(2)}</span>
              </div>
              {isActingDriver && (
                <div className="flex justify-between text-[#737373]">
                  <span>Platform Fee & GST (5%)</span>
                  <span className="font-bold text-[#171717]">₹{((fareEstimate.platformFee || 25) + (fareEstimate.tax || 20)).toFixed(2)}</span>
                </div>
              )}
              {rawSavings > 0 ? (
                <div className="flex justify-between text-[#22A06B] font-bold">
                  <span>Promotion Discount {appliedCoupon?.code ? `(${appliedCoupon.code})` : ''}</span>
                  <span>-₹{rawSavings.toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-[#737373] text-xs">
                  <span>Promotion Discount</span>
                  <button
                    onClick={() => setCustomerScreen('COUPONS')}
                    className="text-[#E85D04] font-bold hover:underline"
                  >
                    Apply Coupon
                  </button>
                </div>
              )}
              <div className="flex justify-between text-sm sm:text-base font-extrabold text-[#171717] pt-2 border-t border-black/5">
                <span>Total Amount</span>
                <span className="text-[#E85D04]">₹{discountedPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method Quick Switch Bar */}
          <div
            onClick={() => setCustomerScreen('PAYMENT_METHOD')}
            className="flex items-center justify-between p-3 sm:p-3.5 bg-white border border-black/5 rounded-2xl cursor-pointer hover:border-[#E85D04] transition shadow-xs mb-3"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-[#FFF7F0] border border-[#E85D04]/20 text-[#E85D04] flex items-center justify-center shrink-0">
                <Banknote className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-[#171717] truncate">
                {selectedPaymentMethod === 'CASH' ? 'Cash' : selectedPaymentMethod === 'UPI' ? 'UPI Scan and Pay' : selectedPaymentMethod}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] sm:text-xs text-[#E85D04] font-bold shrink-0 pl-2">
              <span>Change</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Bottom CTA Button */}
        <div className="p-3 sm:p-4 border-t border-black/5 bg-white shadow-xl">
          <div className="w-full max-w-lg mx-auto">
            {bookingError && (
              <div className="bg-[#FEF2F2] border border-rose-200 text-rose-700 text-xs px-3 py-2 rounded-xl font-medium mb-2.5">
                {bookingError}
              </div>
            )}

            <button
              onClick={confirmBooking}
              disabled={isBookingLoading}
              className="w-full bg-[#E85D04] hover:bg-[#C2410C] active:scale-98 disabled:opacity-60 text-white font-extrabold py-3.5 sm:py-4 rounded-2xl shadow-xl shadow-[#E85D04]/30 text-sm sm:text-base transition flex items-center justify-center gap-2 min-h-[48px]"
            >
              {isBookingLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{language === 'ta' ? 'ஏற்கும் இடம் உறுதி செய்யப்படுகிறது...' : 'Confirming your pickup...'}</span>
                </>
              ) : (
                <span className="truncate">
                  {language === 'ta'
                    ? (isActingDriver
                        ? `ஆக்டிங் டிரைவர் முன்பதிவு (${driverOnlyHours || 2} மணி) • ₹${discountedPrice.toFixed(2)}`
                        : `${(typeof selectedVehicle === 'string' ? selectedVehicle : (selectedVehicle?.name || 'Ride')).replace('Jitta ', '')} முன்பதிவு செய் • ₹${discountedPrice.toFixed(2)}`)
                    : (isActingDriver
                        ? `Book Acting Driver (${driverOnlyHours || 2} Hrs) • ₹${discountedPrice.toFixed(2)}`
                        : `Book ${(typeof selectedVehicle === 'string' ? selectedVehicle : (selectedVehicle?.name || 'Ride')).replace('Jitta ', '')} • ₹${discountedPrice.toFixed(2)}`)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Schedule Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white p-5 rounded-3xl w-full max-w-xs space-y-4 shadow-2xl border border-black/5">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-[#171717]">Schedule your ride</h3>
                <button onClick={() => setShowScheduleModal(false)}>
                  <X className="w-5 h-5 text-[#737373]" />
                </button>
              </div>
              <input
                type="datetime-local"
                defaultValue={new Date(Date.now() + 3600000).toISOString().slice(0, 16)}
                className="w-full bg-[#FFF7F0] border border-[#E85D04]/20 p-3 rounded-xl text-xs font-bold outline-none text-[#171717]"
              />
              <button
                onClick={() => setShowScheduleModal(false)}
                className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold py-3 rounded-xl text-xs shadow-md shadow-[#E85D04]/30"
              >
                Set Ride Time
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};