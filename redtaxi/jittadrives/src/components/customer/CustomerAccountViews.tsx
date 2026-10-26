import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Clock,
  Ticket,
  HelpCircle,
  Check,
  ChevronRight,
  LogOut,
  Trash2,
  Car,
  User,
  Languages,
  X,
  Tag,
  Plus,
  MapPin,
  QrCode,
  Banknote,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Sparkles,
  CheckCheck,
  Calendar,
  Camera,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Search,
  Loader2,
} from 'lucide-react';
import { useTaxiApp } from '../../context/TaxiAppContext';
import { isCouponValid } from '../../utils/couponUtils';
import type { BookingRecord } from '../../types/taxi';
import { fetchVehicleDetails, type VehicleInfo } from '../../services/vehicleInfoService';
import { validateVehicleNumber } from '../../utils/vehicleRegValidator';

export const CustomerAccountViews: React.FC = () => {
  const {
    customerScreen,
    setCustomerScreen,
    isCustomerAuthenticated,
    customerProfile,
    updateCustomerProfile,
    language,
    setLanguage,
    allBookings,
    refreshCustomerBookings,
    applyCoupon,
    allNotifications,
    markNotificationRead,
    createSupportTicket,
    rentalHours,
    setRentalHours,
    outstationConfig,
    setOutstationConfig,
    airportConfig,
    setAirportConfig,
    logoutCustomer,
    deleteSavedPlace,
    addSavedPlace,
    setSelectedInvoiceBooking,
    driverOnlyVehicle,
    setDriverOnlyVehicle,
    driverOnlyHours,
    setDriverOnlyHours,
    fetchDriverOnlyFareEstimate,
    pickupLocation,
    dropLocation,
    selectedPaymentMethod,
    confirmBooking,
    isBookingLoading,
    bookingError,
    cancelActiveBooking,
    allCoupons = [],
    allOffers = [],
    offersNotice = '',
    areOffersDisabled = false,
    areCouponsDisabled = false,
    refreshOffers,
    refreshCoupons,
  } = useTaxiApp() as any;

  const [ridesTab, setRidesTab] = useState<'UPCOMING' | 'COMPLETED' | 'CANCELLED'>('COMPLETED');
  const [selectedRide, setSelectedRide] = useState<BookingRecord | null>(null);

  useEffect(() => {
    if (customerScreen === 'MY_RIDES' && typeof refreshCustomerBookings === 'function') {
      refreshCustomerBookings();
    }
    if (customerScreen === 'OFFERS') {
      if (typeof refreshOffers === 'function') refreshOffers();
      if (typeof refreshCoupons === 'function') refreshCoupons();
    }
  }, [customerScreen, ridesTab, refreshCustomerBookings, refreshOffers, refreshCoupons]);
  const [addMoneyAmount, setAddMoneyAmount] = useState<number>(500);
  const [showAddMoneyModal, setShowAddMoneyModal] = useState<boolean>(false);
  const [ticketCategory, setTicketCategory] = useState<string>('Booking Issue');
  const [ticketSubject, setTicketSubject] = useState<string>('');
  const [ticketDesc, setTicketDesc] = useState<string>('');
  const [ticketSubmitted, setTicketSubmitted] = useState<boolean>(false);

  // Coupons & Offers States
  const [showOfferDetailsModal, setShowOfferDetailsModal] = useState<any | null>(null);
  const [showAddOfferCodeModal, setShowAddOfferCodeModal] = useState<boolean>(false);
  const [newOfferCodeInput, setNewOfferCodeInput] = useState<string>('');
  const [offerApplyMessage, setOfferApplyMessage] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);


  const [isCancellingRide, setIsCancellingRide] = useState<boolean>(false);

  // Customer Edit Profile States
  const [showEditProfileModal, setShowEditProfileModal] = useState<boolean>(false);
  const [editCustName, setEditCustName] = useState<string>('');
  const [editCustEmail, setEditCustEmail] = useState<string>('');
  const [editCustPhoto, setEditCustPhoto] = useState<string | undefined>(undefined);
  const [custProfileSaving, setCustProfileSaving] = useState<boolean>(false);
  const [custProfileMsg, setCustProfileMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const openEditProfileModal = () => {
    setEditCustName(customerProfile.name || '');
    setEditCustEmail(customerProfile.email || '');
    setEditCustPhoto(customerProfile.avatar || '');
    setCustProfileMsg(null);
    setShowEditProfileModal(true);
  };

  const handleCustomerPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCustProfileMsg({ text: language === 'ta' ? 'தயவுசெய்து புகைப்படத்தைத் தேர்ந்தெடுக்கவும்' : 'Please select an image file (PNG/JPG)', isError: true });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setEditCustPhoto(b64);
      setCustProfileMsg({ text: language === 'ta' ? 'புகைப்படம் தேர்ந்தெடுக்கப்பட்டது! மாற்றங்களைச் சேமிக்கவும்.' : 'Photo selected! Tap "Save Changes" to save.', isError: false });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCustomerProfile = async () => {
    if (!editCustName.trim()) {
      setCustProfileMsg({ text: language === 'ta' ? 'பெயரை உள்ளிடவும்' : 'Name is required', isError: true });
      return;
    }
    setCustProfileSaving(true);
    setCustProfileMsg(null);
    const payload: any = {
      name: editCustName.trim(),
      email: editCustEmail.trim() || undefined,
    };
    if (editCustPhoto !== undefined) {
      payload.avatar_url = editCustPhoto;
    }
    const res = await updateCustomerProfile(payload);
    setCustProfileSaving(false);
    if (res.success) {
      setCustProfileMsg({ text: language === 'ta' ? 'சுயவிவரம் வெற்றிகரமாக புதுப்பிக்கப்பட்டது!' : 'Profile updated successfully!', isError: false });
      setTimeout(() => setShowEditProfileModal(false), 900);
    } else {
      setCustProfileMsg({ text: res.message || 'Failed to update profile', isError: true });
    }
  };

  // Saved Vehicles for Active Driver Hire
  const [savedVehicles, setSavedVehicles] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('jitta_customer_saved_vehicles');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [vehicleSavedToast, setVehicleSavedToast] = useState<string>('');
  const [showVehicleExtraDetails, setShowVehicleExtraDetails] = useState<boolean>(false);
  const [isFetchingVehicle, setIsFetchingVehicle] = useState<boolean>(false);
  const [fetchedVehicleInfo, setFetchedVehicleInfo] = useState<VehicleInfo | null>(null);
  const [vehicleFetchError, setVehicleFetchError] = useState<string>('');

  const handleFetchCustomerVehicleDetails = async (plateToFetch?: string) => {
    const plate = plateToFetch || driverOnlyVehicle?.number || '';
    if (!plate || plate.trim().length < 4) {
      setVehicleFetchError(language === 'ta' ? 'சரியான வாகன எண்ணை உள்ளிடவும் (எ.கா. TN 38 AB 1234)' : 'Please enter a vehicle number (e.g. TN 38 AB 1234)');
      return;
    }
    setIsFetchingVehicle(true);
    setVehicleFetchError('');
    try {
      const details = await fetchVehicleDetails(plate);
      setFetchedVehicleInfo(details);
      setDriverOnlyVehicle((prev: any) => ({
        ...prev,
        number: details.vehicleNumber,
        ownerName: prev?.ownerName || details.ownerName,
        model: `${details.maker} ${details.model}`,
        color: prev?.color || details.color,
        type: details.vehicleType,
      }));
    } catch (err: any) {
      setVehicleFetchError(err.message || 'Failed to fetch vehicle info');
    } finally {
      setIsFetchingVehicle(false);
    }
  };

  // Saved Places state
  const [showAddPlaceModal, setShowAddPlaceModal] = useState<boolean>(false);
  const [newPlaceLabel, setNewPlaceLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [newPlaceName, setNewPlaceName] = useState<string>('');
  const [newPlaceAddress, setNewPlaceAddress] = useState<string>('');
  const [placeError, setPlaceError] = useState<string>('');

  // 29 & 30. My Rides & Ride Details
  if (customerScreen === 'MY_RIDES') {
    const filteredRides = allBookings.filter((b: any) => {
      if (ridesTab === 'UPCOMING') return b.status === 'SCHEDULED' || b.status === 'ASSIGNED' || b.status === 'SEARCHING' || b.status === 'EN_ROUTE' || b.status === 'ARRIVED' || b.status === 'STARTED' || b.status === 'IN_PROGRESS';
      if (ridesTab === 'CANCELLED') return b.status === 'CANCELLED';
      return b.status === 'COMPLETED';
    });

    const handleCancelRide = async (_rideId?: string) => {
      if (!window.confirm('Are you sure you want to cancel this scheduled ride?')) return;
      setIsCancellingRide(true);
      try {
        await cancelActiveBooking('Customer cancelled scheduled ride');
        setSelectedRide(null);
        setRidesTab('CANCELLED');
      } catch (e) {
        console.error('Failed to cancel ride', e);
      } finally {
        setIsCancellingRide(false);
      }
    };

    if (selectedRide) {
      const isScheduled = selectedRide.status === 'SCHEDULED';
      return (
        <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-3.5 sm:p-5 overflow-y-auto">
          <div>
            <div className="flex items-center gap-3 mb-3.5">
              <button
                onClick={() => setSelectedRide(null)}
                className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] hover:text-[#171717] transition shadow-xs"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-[#171717]">Ride Details</h2>
                <span className="text-[10px] font-bold text-[#737373]">
                  {isScheduled ? 'Scheduled Booking' : `Trip #${selectedRide.id.slice(0, 8)}`}
                </span>
              </div>
            </div>

            {/* Status Banner */}
            <div className={`p-3.5 rounded-2xl mb-4 border flex items-center justify-between ${
              isScheduled 
                ? 'bg-[#FFF7F0] border-[#E85D04]/30 text-[#E85D04]'
                : selectedRide.status === 'COMPLETED'
                ? 'bg-[#E7F6ED] border-[#22A06B]/30 text-[#22A06B]'
                : 'bg-black/5 border-black/10 text-[#737373]'
            }`}>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 shrink-0" />
                <div>
                  <span className="font-extrabold text-xs block">
                    {isScheduled ? `Scheduled for ${selectedRide.scheduledTime || 'Upcoming Time'}` : selectedRide.status}
                  </span>
                  <span className="text-[10px] opacity-80 block">
                    {isScheduled ? 'Chauffeur will be assigned before pickup' : 'Standard Ride'}
                  </span>
                </div>
              </div>
              <span className="text-xs font-black bg-white/80 px-2 py-0.5 rounded-md border border-black/5">
                {selectedRide.status}
              </span>
            </div>

            <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-4 space-y-3.5 shadow-xs text-xs">
              <div className="flex justify-between border-b border-black/5 pb-2.5 gap-2">
                <span className="text-[#737373] shrink-0 font-medium">Booking ID</span>
                <span className="font-mono font-bold text-[#171717] truncate">{selectedRide.id}</span>
              </div>
              <div className="flex justify-between border-b border-black/5 pb-2.5">
                <span className="text-[#737373] font-medium">Vehicle Category</span>
                <span className="font-bold text-[#171717]">{(typeof selectedRide.vehicleCategory === 'object' ? (selectedRide.vehicleCategory as any)?.name : selectedRide.vehicleCategory) || selectedRide.vehicleModel || 'Standard Taxi'}</span>
              </div>
              <div className="flex justify-between border-b border-black/5 pb-2.5">
                <span className="text-[#737373] font-medium">Driver</span>
                <span className="font-bold text-[#171717]">{selectedRide.driverName || 'Assigning soon'}</span>
              </div>
              
              {/* Route */}
              <div className="space-y-2 border-b border-black/5 pb-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#22A06B] mt-1 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-[#737373] uppercase font-bold block">Pickup</span>
                    <span className="text-xs font-bold text-[#171717] block truncate">{selectedRide.pickup.name}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#E85D04] mt-1 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-[#737373] uppercase font-bold block">Drop</span>
                    <span className="text-xs font-bold text-[#171717] block truncate">{selectedRide.drop.name}</span>
                  </div>
                </div>
              </div>

              {/* Fare */}
              <div className="flex justify-between items-center text-sm font-extrabold text-[#171717] pt-1">
                <span>Total Fare</span>
                <span className="text-[#E85D04] font-black text-base">₹{selectedRide.fare.totalFare}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            {isScheduled ? (
              <button
                onClick={() => handleCancelRide(selectedRide.id)}
                disabled={isCancellingRide}
                className="w-full bg-[#FEF2F2] hover:bg-[#FEE2E2] text-rose-600 font-extrabold py-3.5 rounded-2xl border border-rose-200 shadow-xs transition active:scale-98 text-xs sm:text-sm"
              >
                {isCancellingRide ? 'Cancelling Ride...' : 'Cancel Scheduled Ride'}
              </button>
            ) : (
              <button
                onClick={() => {
                  setSelectedInvoiceBooking(selectedRide);
                  setCustomerScreen('INVOICE');
                }}
                className="w-full bg-[#E85D04] text-white font-extrabold py-3.5 rounded-2xl shadow-md shadow-[#E85D04]/30 hover:bg-[#C2410C] transition text-xs sm:text-sm"
              >
                View Tax Invoice
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] p-3.5 sm:p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCustomerScreen('HOME')}
              className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] hover:text-[#171717] shadow-xs"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#171717]">
              {language === 'ta' ? 'பயணங்கள்' : 'My Rides'}
            </h2>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-[#F5F2EB] p-1 rounded-2xl border border-black/5 mb-4">
          {(['UPCOMING', 'COMPLETED', 'CANCELLED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setRidesTab(tab)}
              className={`py-2 rounded-xl text-xs font-extrabold transition capitalize ${
                ridesTab === tab ? 'bg-[#E85D04] text-white shadow-sm' : 'text-[#737373] hover:text-[#171717]'
              }`}
            >
              {language === 'ta'
                ? tab === 'UPCOMING'
                  ? 'வரவிருக்கும்'
                  : tab === 'COMPLETED'
                    ? 'நிறைவுற்றவை'
                    : 'ரத்து செய்தவை'
                : tab.toLowerCase()}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {filteredRides.length === 0 ? (
            <div className="text-center py-14 space-y-3 text-[#A3A3A3]">
              <Clock className="w-10 h-10 mx-auto text-[#C9C0B2]" />
              <p className="text-xs font-bold">
                {language === 'ta'
                  ? 'பயணங்கள் எதுவும் இல்லை'
                  : `No ${ridesTab.toLowerCase()} rides found.`}
              </p>
              {ridesTab === 'UPCOMING' && (
                <button
                  onClick={() => setCustomerScreen('HOME')}
                  className="inline-flex items-center gap-1.5 bg-[#E85D04] text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-sm"
                >
                  <span>{language === 'ta' ? 'இப்போதே முன்பதிவு செய்' : 'Book a Ride Now'}</span>
                </button>
              )}
            </div>
          ) : (
            filteredRides.map((ride: any) => (
              <div
                key={ride.id}
                onClick={() => setSelectedRide(ride)}
                className="bg-white border border-black/5 p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl space-y-2.5 cursor-pointer hover:border-[#E85D04]/40 transition shadow-xs"
              >
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-extrabold text-[#171717] truncate flex-1">
                    {ride.pickup.name} → {ride.drop.name}
                  </span>
                  <span className="font-black text-[#E85D04] text-sm shrink-0">₹{ride.fare.totalFare}</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#737373] pt-2 border-t border-black/5">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-[#E85D04]" />
                    <span className="font-medium">
                      {ride.status === 'SCHEDULED' ? (ride.scheduledTime || ride.createdAt) : (ride.createdAt ? ride.createdAt.substring(0, 16) : 'Recently')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {ride.rating && (
                      <span className="text-amber-500 font-bold">★ {ride.rating}</span>
                    )}
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold ${
                      ride.status === 'SCHEDULED'
                        ? 'bg-[#FFF7F0] text-[#E85D04] border border-[#E85D04]/30'
                        : ride.status === 'COMPLETED'
                        ? 'bg-[#E7F6ED] text-[#22A06B]'
                        : 'bg-black/5 text-[#737373]'
                    }`}>
                      {ride.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }


  // 32. Rental Booking Screen
  if (customerScreen === 'RENTAL_BOOKING') {
    return (
      <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-3 sm:p-4 overflow-y-auto">
        <div>
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <button
              onClick={() => setCustomerScreen('HOME')}
              className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] min-h-[36px] min-w-[36px]"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base sm:text-lg font-bold">
              {language === 'ta' ? 'மணிநேர வாடகை டாக்ஸி' : 'Hourly Taxi Rental'}
            </h2>
          </div>

          <p className="text-xs text-[#737373] mb-3 sm:mb-4">
            {language === 'ta' ? 'பல நிறுத்தங்களுக்கு டாக்ஸியையும் ஓட்டுநரையும் உங்களுடன் வைத்துக் கொள்ளுங்கள்.' : 'Keep taxi & chauffeur with you for multiple stops.'}
          </p>

          {/* Hour Cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-4">
            {[
              { hrs: 1, km: 10, fare: 299 },
              { hrs: 2, km: 20, fare: 499 },
              { hrs: 4, km: 40, fare: 899 },
              { hrs: 8, km: 80, fare: 1699 },
              { hrs: 12, km: 120, fare: 2499 },
            ].map((r) => (
              <div
                key={r.hrs}
                onClick={() => setRentalHours(r.hrs)}
                className={`p-2.5 sm:p-3.5 rounded-2xl border cursor-pointer transition ${
                  rentalHours === r.hrs
                    ? 'bg-[#E85D04]/5 border-[#E85D04] ring-2 ring-[#E85D04]/20'
                    : 'bg-white border-black/5 hover:border-black/20'
                }`}
              >
                <div className="text-sm sm:text-base font-extrabold text-[#171717]">
                  {r.hrs} {language === 'ta' ? 'மணிநேரம்' : `Hour${r.hrs > 1 ? 's' : ''}`}
                </div>
                <span className="text-[10px] text-[#737373] block">
                  {r.km} {language === 'ta' ? 'கி.மீ உள்ளடங்கியது' : 'KM Included'}
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#22A06B] mt-1.5 sm:mt-2 block">₹{r.fare}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setCustomerScreen('VEHICLE_SELECT')}
          className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold py-3 sm:py-3.5 rounded-2xl shadow-lg min-h-[44px]"
        >
          {language === 'ta' ? `வாடகை தொகுப்பை உறுதி செய் (${rentalHours} மணிநேரம்)` : `Confirm Rental Package (${rentalHours} Hrs)`}
        </button>
      </div>
    );
  }

  // 33. Outstation Booking Screen
  if (customerScreen === 'OUTSTATION_BOOKING') {
    return (
      <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-3 sm:p-4 overflow-y-auto">
        <div>
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <button
              onClick={() => setCustomerScreen('HOME')}
              className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] min-h-[36px] min-w-[36px]"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base sm:text-lg font-bold">
              {language === 'ta' ? 'வெளியூர் பயணம்' : 'Outstation Travel'}
            </h2>
          </div>

          {/* Toggle */}
          <div className="grid grid-cols-2 gap-1 bg-[#F9F5F0] p-1 rounded-2xl border border-black/5 mb-3 sm:mb-4 text-xs font-bold">
            <button
              onClick={() => setOutstationConfig({ ...outstationConfig, tripType: 'ONE_WAY' })}
              className={`py-2 rounded-xl transition min-h-[40px] ${outstationConfig.tripType === 'ONE_WAY' ? 'bg-[#E85D04] text-white shadow' : 'text-[#737373] hover:text-[#171717]'}`}
            >
              {language === 'ta' ? 'ஒரு வழிப் பயணம்' : 'One Way'}
            </button>
            <button
              onClick={() => setOutstationConfig({ ...outstationConfig, tripType: 'ROUND_TRIP' })}
              className={`py-2 rounded-xl transition min-h-[40px] ${outstationConfig.tripType === 'ROUND_TRIP' ? 'bg-[#E85D04] text-white shadow' : 'text-[#737373] hover:text-[#171717]'}`}
            >
              {language === 'ta' ? 'இரு வழிப் பயணம்' : 'Round Trip'}
            </button>
          </div>

          <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 space-y-3 mb-4 text-xs">
            <div>
              <label className="text-[10px] text-[#737373] font-bold uppercase">
                {language === 'ta' ? 'புறப்படும் தேதி' : 'Leave On'}
              </label>
              <input
                type="date"
                value={outstationConfig.startDate}
                onChange={(e) => setOutstationConfig({ ...outstationConfig, startDate: e.target.value })}
                className="w-full bg-[#F9F5F0] border border-black/10 rounded-xl p-2.5 text-xs text-[#171717] outline-none mt-1 focus:border-[#E85D04]"
              />
            </div>
            {outstationConfig.tripType === 'ROUND_TRIP' && (
              <div>
                <label className="text-[10px] text-[#737373] font-bold uppercase">
                  {language === 'ta' ? 'திரும்பும் தேதி' : 'Return On'}
                </label>
                <input
                  type="date"
                  value={outstationConfig.returnDate}
                  onChange={(e) => setOutstationConfig({ ...outstationConfig, returnDate: e.target.value })}
                  className="w-full bg-[#F9F5F0] border border-black/10 rounded-xl p-2.5 text-xs text-[#171717] outline-none mt-1 focus:border-[#E85D04]"
                />
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setCustomerScreen('VEHICLE_SELECT')}
          className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold py-3 sm:py-3.5 rounded-2xl shadow-lg min-h-[44px]"
        >
          {language === 'ta' ? 'வெளியூர் டாக்ஸிகளைப் பார்க்க' : 'Explore Outstation Taxis'}
        </button>
      </div>
    );
  }

  // 34. Airport Booking Screen
  if (customerScreen === 'AIRPORT_BOOKING') {
    return (
      <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-3 sm:p-4 overflow-y-auto">
        <div>
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <button
              onClick={() => setCustomerScreen('HOME')}
              className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] min-h-[36px] min-w-[36px]"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base sm:text-lg font-bold">
              {language === 'ta' ? 'விமான நிலைய டாக்ஸி' : 'Airport Transfer'}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-1 bg-[#F9F5F0] p-1 rounded-2xl border border-black/5 mb-3 sm:mb-4 text-xs font-bold">
            <button
              onClick={() => setAirportConfig({ ...airportConfig, tripType: 'DROP' })}
              className={`py-2 rounded-xl transition min-h-[40px] ${airportConfig.tripType === 'DROP' ? 'bg-[#E85D04] text-white shadow' : 'text-[#737373] hover:text-[#171717]'}`}
            >
              {language === 'ta' ? 'விமான நிலையம் செல்ல' : 'Going to Airport'}
            </button>
            <button
              onClick={() => setAirportConfig({ ...airportConfig, tripType: 'PICKUP' })}
              className={`py-2 rounded-xl transition min-h-[40px] ${airportConfig.tripType === 'PICKUP' ? 'bg-[#E85D04] text-white shadow' : 'text-[#737373] hover:text-[#171717]'}`}
            >
              {language === 'ta' ? 'விமான நிலையத்திலிருந்து' : 'Pickup from Airport'}
            </button>
          </div>

          <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 space-y-3 text-xs mb-4">
            <div>
              <label className="text-[10px] text-[#737373] font-bold uppercase">
                {language === 'ta' ? 'விமான எண்' : 'Flight Number'}
              </label>
              <input
                type="text"
                value={airportConfig.flightNumber}
                onChange={(e) => setAirportConfig({ ...airportConfig, flightNumber: e.target.value })}
                className="w-full bg-[#F9F5F0] border border-black/10 rounded-xl p-2.5 text-xs text-[#171717] outline-none mt-1 focus:border-[#E85D04]"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#737373] font-bold uppercase">
                {language === 'ta' ? 'முனையம்' : 'Terminal'}
              </label>
              <select
                value={airportConfig.terminal}
                onChange={(e) => setAirportConfig({ ...airportConfig, terminal: e.target.value })}
                className="w-full bg-[#F9F5F0] border border-black/10 rounded-xl p-2.5 text-xs text-[#171717] outline-none mt-1 focus:border-[#E85D04]"
              >
                <option value="T1 International">{language === 'ta' ? 'T1 பன்னாட்டு முனையம்' : 'T1 International'}</option>
                <option value="T2 Domestic">{language === 'ta' ? 'T2 உள்நாட்டு முனையம்' : 'T2 Domestic'}</option>
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={() => setCustomerScreen('VEHICLE_SELECT')}
          className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold py-3 sm:py-3.5 rounded-2xl shadow-lg min-h-[44px]"
        >
          {language === 'ta' ? 'விமான பயணத்தை உறுதி செய்' : 'Confirm Airport Ride'}
        </button>
      </div>
    );
  }

  // 34.5. Active Driver Booking Screen — customer provides the vehicle, hires an Active Driver
  if (customerScreen === 'DRIVER_ONLY_BOOKING') {
    const inputReg = (driverOnlyVehicle?.number || '').trim();
    const regFormatCheck = inputReg ? validateVehicleNumber(inputReg) : null;
    const canBook = !inputReg || Boolean(regFormatCheck?.isValid);
    const currentTransmission = driverOnlyVehicle?.transmission || 'Manual';

    return (
      <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-3 sm:p-4 overflow-y-auto font-sans">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCustomerScreen('HOME')}
                className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] hover:text-[#171717] transition min-h-[36px] min-w-[36px] shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-extrabold text-[#171717]">
                  {language === 'ta' ? 'ஆக்டிவ் டிரைவர் அமர்த்தல்' : 'Active Driver Hire'}
                </h2>
                <p className="text-[11px] text-[#737373] -mt-0.5">
                  {language === 'ta' ? 'உங்கள் வாகனம், எங்கள் தொழில்முறை ஓட்டுநர்.' : 'Your vehicle, our verified Active Driver.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-[#FFF7F0] border border-[#E85D04]/20 px-2.5 py-1 rounded-full">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-4 h-4 object-contain" />
              <span className="text-[10px] text-[#E85D04] font-extrabold">
                {language === 'ta' ? 'ஆக்டிவ் டிரைவர்' : 'Active Driver'}
              </span>
            </div>
          </div>

          {/* Route Card */}
          <div
            onClick={() => setCustomerScreen('SEARCH_LOCATION')}
            className="bg-white border border-black/5 rounded-2xl p-3.5 mb-3 space-y-2 text-xs cursor-pointer hover:border-[#E85D04]/40 hover:bg-[#FFF7F0]/30 transition shadow-xs"
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22A06B] ring-4 ring-[#22A06B]/20 shrink-0" />
              <span className="text-[#171717] font-semibold truncate">
                {pickupLocation?.name || (language === 'ta' ? 'ஏறும் இடத்தை தேர்ந்தெடுக்கவும்' : 'Select pickup location')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 ring-4 ring-rose-600/20 shrink-0" />
              <span className="text-[#171717] font-semibold truncate">
                {dropLocation?.name || (language === 'ta' ? 'இறங்கும் இடத்தை தேர்ந்தெடுக்கவும்' : 'Select drop destination')}
              </span>
            </div>
            <div className="flex justify-end pt-1">
              <span className="text-[11px] text-[#E85D04] font-bold hover:underline">
                {language === 'ta' ? 'வழியை மாற்றவும் →' : 'Change Route →'}
              </span>
            </div>
          </div>

          {/* Customer Vehicle Details - Minimal */}
          <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 mb-3 space-y-3.5 text-xs shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-extrabold text-[#171717] uppercase tracking-wider text-[11px]">
                <Car className="w-4 h-4 text-[#E85D04]" />
                <span>{language === 'ta' ? 'வாகன விவரங்கள்' : 'Vehicle Information'}</span>
              </div>
            </div>

            {/* Vehicle Number Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-[#737373] font-bold uppercase">
                  {language === 'ta' ? 'வாகன பதிவு எண்' : 'Vehicle Registration Number'}
                </label>
                {regFormatCheck?.isValid && (
                  <span className="text-[10px] text-[#047857] font-bold truncate max-w-[200px] flex items-center gap-1 bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                    <Check className="w-3 h-3" /> Valid ✓
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#F9F5F0] border border-black/10 rounded-xl px-3 py-2.5 flex items-center gap-2 focus-within:border-[#E85D04] focus-within:bg-white transition">
                  <Car className="w-4 h-4 text-[#737373] shrink-0" />
                  <input
                    type="text"
                    value={driverOnlyVehicle.number || ''}
                    onChange={(e) => {
                      setDriverOnlyVehicle({ ...driverOnlyVehicle, number: e.target.value.toUpperCase() });
                      if (vehicleFetchError) setVehicleFetchError('');
                    }}
                    placeholder="e.g. TN 38 AB 1234"
                    maxLength={20}
                    className="bg-transparent text-xs font-bold text-[#171717] outline-none placeholder-[#A3A3A3] font-mono uppercase flex-1"
                  />
                </div>
              </div>

              {inputReg && !regFormatCheck?.isValid && (
                <p className="text-[10px] text-amber-700 mt-1 font-bold">
                  ⚠️ {regFormatCheck?.errorMessage || 'Invalid registration format (e.g. TN 38 AB 1234)'}
                </p>
              )}
            </div>

            {/* Transmission Selector */}
            <div>
              <label className="text-[10px] text-[#737373] font-bold uppercase block mb-1.5">
                {language === 'ta' ? 'டிரான்ஸ்மிஷன் முறை' : 'Transmission Type'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Manual', 'Automatic'].map((tMode) => {
                  const isSel = currentTransmission.toLowerCase() === tMode.toLowerCase();
                  return (
                    <button
                      key={tMode}
                      type="button"
                      onClick={() => setDriverOnlyVehicle({ ...driverOnlyVehicle, transmission: tMode })}
                      className={`py-2 px-3 rounded-xl border text-center transition text-xs font-bold ${
                        isSel
                          ? 'bg-[#E85D04] border-[#E85D04] text-white shadow-xs'
                          : 'bg-[#F9F5F0] border-black/5 text-[#525252] hover:border-black/20'
                      }`}
                    >
                      {tMode === 'Manual'
                        ? (language === 'ta' ? 'மேனுவல் (Manual)' : 'Manual')
                        : (language === 'ta' ? 'ஆட்டோமேட்டிக் (Auto)' : 'Automatic')}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Duration Hours */}
          <div className="bg-white border border-black/5 rounded-2xl p-3.5 mb-3 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-[#737373] font-extrabold uppercase tracking-wider">
                {language === 'ta' ? 'பயண கால அளவு' : 'Hire Duration'}
              </span>
              <span className="text-[11px] text-[#E85D04] font-bold">
                {language === 'ta' ? '₹200 / மணிநேரம்' : '₹200 / hour'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 6, 8, 12, 24].map((h) => (
                <button
                  key={h}
                  onClick={() => setDriverOnlyHours(h)}
                  className={`py-2 rounded-xl border text-xs font-bold transition ${
                    driverOnlyHours === h
                      ? 'bg-[#E85D04] text-white border-[#E85D04] shadow-sm'
                      : 'bg-[#F9F5F0] border-black/5 text-[#525252] hover:border-black/20'
                  }`}
                >
                  {h} {language === 'ta' ? 'மணி' : `Hr${h > 1 ? 's' : ''}`}
                </button>
              ))}
            </div>
          </div>

          {/* Fare Estimate */}
          <div className="bg-[#FFF7F0] border border-[#E85D04]/30 rounded-2xl p-3.5 mb-3 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] text-[#B45309] font-bold uppercase block">
                {language === 'ta' ? 'மதிப்பிடப்பட்ட ஓட்டுநர் கட்டணம்' : 'Estimated Driver Rate'}
              </span>
              <span className="text-[11px] text-[#737373]">
                {driverOnlyHours} {language === 'ta' ? 'மணி × ₹200 + தளக் கட்டணம் & வரி' : 'hrs × ₹200 + platform fee & tax'}
              </span>
            </div>
            <div className="text-xl font-black text-[#E85D04]">
              <DriverOnlyFare fetchFn={fetchDriverOnlyFareEstimate} hours={driverOnlyHours} />
            </div>
          </div>

          {/* Payment Method */}
          <div
            onClick={() => setCustomerScreen('PAYMENT_METHOD')}
            className="bg-white border border-black/5 rounded-2xl p-3.5 mb-3 flex items-center justify-between text-xs cursor-pointer hover:border-black/20 transition shadow-xs"
          >
            <span className="text-[#737373] font-bold uppercase text-[10px]">
              {language === 'ta' ? 'கட்டண முறை' : 'Payment Mode'}
            </span>
            <span className="flex items-center gap-1.5 font-bold text-[#171717]">
              {selectedPaymentMethod}
              <ChevronRight className="w-4 h-4 text-[#A3A3A3]" />
            </span>
          </div>

          <div className="flex items-start gap-2.5 text-[11px] text-[#15803D] bg-[#22A06B]/10 border border-[#22A06B]/30 rounded-2xl p-3">
            <User className="w-4 h-4 text-[#22A06B] shrink-0 mt-0.5" />
            <span className="leading-snug font-medium">
              {language === 'ta'
                ? 'உங்கள் காரை நீங்கள் வழங்குகிறீர்கள் — சரிபார்க்கப்பட்ட தொழில்முறை ஓட்டுநர் உங்கள் இடத்திற்கு வருவார்.'
                : 'You provide your own car — an Active Driver with verified professional driving credentials will arrive at your pickup location.'}
            </span>
          </div>

          {bookingError && (
            <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {bookingError}
            </div>
          )}
        </div>

        <div className="pt-3">
          <button
            onClick={async () => {
              if (!canBook) return;
              await confirmBooking();
            }}
            disabled={!canBook || isBookingLoading}
            className={`w-full font-extrabold py-3.5 rounded-2xl shadow-xl transition min-h-[48px] flex items-center justify-center gap-2 text-sm ${
              canBook && !isBookingLoading
                ? 'bg-[#E85D04] text-white hover:bg-[#C2410C] shadow-[#E85D04]/30 active:scale-98'
                : 'bg-black/10 text-[#A3A3A3] cursor-not-allowed'
            }`}
          >
            {isBookingLoading
              ? (language === 'ta' ? 'உங்கள் ஓட்டுநரைத் தேடுகிறது...' : 'Finding your Active Driver...')
              : canBook
                ? (inputReg
                    ? (language === 'ta' ? `பயணத்தை உறுதி செய் • ஓட்டுநர் (${driverOnlyHours} மணி)` : `Confirm pickup • Active Driver (${driverOnlyHours} Hrs)`)
                    : (language === 'ta' ? `பயணத்தை உறுதி செய் (வாகன எண் பிறகு சேர்க்கலாம்) • ${driverOnlyHours} மணி` : `Confirm pickup (Vehicle plate can be added later) • ${driverOnlyHours} Hrs`))
                : (language === 'ta' ? 'சரியான வாகன பதிவு எண் உள்ளிடவும்' : 'Enter valid vehicle registration format')}
          </button>
        </div>
      </div>
    );
  }

  // 35. Customer Wallet Disabled: Customers pay directly via Cash / UPI with no prepaid wallet balance.
  if (customerScreen === 'WALLET') {
    setCustomerScreen('PROFILE');
    return null;
  }

  // 35B. Jitta Balances Screen Disabled
  if (customerScreen === 'BALANCES') {
    setCustomerScreen('PROFILE');
    return null;
  }

  // 36. Coupons & Offers Screen (Always shows all Active Coupons & Promotional Deals)
  if (customerScreen === 'OFFERS') {
    // Merge valid backend/context allCoupons and promotional offers for a comprehensive catalogue
    const activeOffers = (allOffers || [])
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
        const discount = (o.discountTag && !o.discountTag.includes(code)) ? o.discountTag : 'Special Offer';
        const subtitle = (o.description && o.description.trim().toUpperCase() !== code)
          ? o.description
          : (o.subtitle || 'Applicable on select ride categories');

        return {
          id: o.id || `offer-${code}`,
          title: o.title || 'Special Promotional Offer',
          subtitle: subtitle,
          code: code,
          discount: discount,
          bgGradient: o.bgGradient,
          isUnread: false,
        };
      });

    const validCoupons = (allCoupons || [])
      .filter(isCouponValid)
      .map((c: any) => ({
        id: c.id,
        title: c.description || `Special discount with code ${c.code}`,
        subtitle: `Min ride ₹${c.minBooking || 0} • Valid till ${c.expiryDate || 'No Expiry'}`,
        code: c.code,
        discount: c.discountType === 'PERCENT' ? `${c.discountAmount}% OFF` : `₹${c.discountAmount} FLAT`,
        isUnread: false,
      }));

    const combinedCouponsList = [
      ...validCoupons,
      ...activeOffers,
    ].filter((item, index, self) => index === self.findIndex((t) => t.code === item.code));

    const handleCopyCode = (code: string) => {
      if (navigator && navigator.clipboard) {
        navigator.clipboard.writeText(code);
      }
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    };

    return (
      <div className="h-full w-full flex flex-col bg-[#FAFAF8] text-[#171717] font-sans justify-between overflow-y-auto overflow-x-hidden select-none">
        <div className="w-full max-w-lg mx-auto p-3.5 sm:p-5 flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3.5">
            <button
              onClick={() => setCustomerScreen('HOME')}
              className="w-9 h-9 rounded-xl bg-white border border-black/10 hover:bg-black/5 flex items-center justify-center text-[#171717] transition shadow-xs"
              aria-label="Back to Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FFF7F0] border border-[#E85D04]/20 rounded-full text-[#E85D04] text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {combinedCouponsList.length > 0
                  ? (language === 'ta' ? `${combinedCouponsList.length} சலுகைகள்` : `${combinedCouponsList.length} Active Deals`)
                  : (language === 'ta' ? 'விரைவில்' : 'Coming Soon')}
              </span>
            </div>
          </div>

          <div className="mb-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
              {language === 'ta' ? 'கூப்பன்கள் & சலுகைகள்' : 'Coupons & Offers'}
            </h1>
            <p className="text-xs text-[#737373] mt-1 font-medium">
              {language === 'ta'
                ? 'சரிபார்க்கப்பட்ட விளம்பரக் குறியீடுகள் மூலம் ஒவ்வொரு சவாரியிலும் சேமிக்கவும்'
                : 'Save more on every ride with verified promo codes & discounts'}
            </p>
          </div>

          {/* Admin Announcement / Notice Banner */}
          {offersNotice && (
            <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-[#FFF7F0] to-[#FFEBD9] border border-[#E85D04]/30 flex items-start gap-3 shadow-xs">
              <Sparkles className="w-4 h-4 text-[#E85D04] shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase font-black tracking-wider text-[#E85D04] block">
                  {language === 'ta' ? 'அறிவிப்பு' : 'Notice'}
                </span>
                <p className="text-xs font-bold text-[#171717] mt-0.5 leading-snug">{offersNotice}</p>
              </div>
            </div>
          )}

          {/* Add new offer code card */}
          <div
            onClick={() => setShowAddOfferCodeModal(true)}
            className="bg-white hover:bg-[#FFF7F0] border border-black/5 hover:border-[#E85D04]/30 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3.5 mb-4 sm:mb-5 cursor-pointer transition shadow-xs group"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-[#FFF7F0] border border-[#E85D04]/20 text-[#E85D04] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Tag className="w-4 h-4 fill-[#E85D04]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-xs sm:text-sm text-[#171717] block truncate">
                  {language === 'ta' ? 'கூப்பன் குறியீடு உள்ளதா?' : 'Have a promo code?'}
                </span>
                <span className="text-[10px] sm:text-[11px] text-[#737373] block truncate">
                  {language === 'ta' ? 'குறியீட்டை உள்ளிட்டு பயன்படுத்த அழுத்தவும்' : 'Tap here to enter and apply'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-[#E85D04] shrink-0">
              <span>{language === 'ta' ? 'குறியீடு உள்ளிடவும்' : 'Enter Code'}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Empty State: Offers Will Coming Soon */}
          {combinedCouponsList.length === 0 ? (
            <div className="bg-white border border-black/5 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-xs my-4">
              <div className="relative mb-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-[#FFF7F0] to-[#FFE8D6] border-2 border-[#E85D04]/30 flex items-center justify-center shadow-md shadow-[#E85D04]/10 text-[#E85D04]">
                  <Ticket className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2]" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#E85D04] text-white flex items-center justify-center shadow-xs animate-bounce">
                  <Sparkles className="w-3.5 h-3.5 fill-white" />
                </div>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-[#171717] tracking-tight mb-2">
                {language === 'ta' ? 'விரைவில் புதிய சலுகைகள் வரும்!' : 'Offers Will Coming Soon!'}
              </h2>

              <p className="text-xs sm:text-sm text-[#737373] max-w-xs mb-6 font-medium leading-relaxed">
                {offersNotice || (language === 'ta'
                  ? 'நாங்கள் உங்களுக்காக புதிய சிறப்பு சலுகைகள் மற்றும் தள்ளுபடி கூப்பன்களை தயார் செய்து வருகிறோம். விரைவில் சரிபார்க்கவும்!'
                  : "We're preparing exciting ride discounts, festival offers, and exclusive savings for you. Check back shortly!")}
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs">
                <button
                  onClick={() => setCustomerScreen('HOME')}
                  className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-extrabold text-xs py-3 px-5 rounded-2xl shadow-xs transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>{language === 'ta' ? 'சவாரி முன்பதிவு செய்' : 'Book a Ride Now'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Coupons list */
            <div className="space-y-3 pb-6">
              {combinedCouponsList.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-black/5 hover:border-[#E85D04]/30 p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl shadow-xs transition"
                >
                  <div className="flex items-start gap-3">
                    {/* Tag Icon Circle */}
                    <div className="w-10 h-10 rounded-2xl bg-[#FFF7F0] border border-[#E85D04]/20 flex items-center justify-center text-[#E85D04] shrink-0 mt-0.5">
                      <Tag className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="bg-[#FFF7F0] border border-[#E85D04]/30 text-[#E85D04] text-[10px] sm:text-xs font-extrabold px-2.5 py-0.5 rounded-lg">
                          {item.discount}
                        </span>
                        {item.isUnread && (
                          <span className="w-2 h-2 rounded-full bg-[#E85D04] shrink-0" />
                        )}
                      </div>

                      <h3 className="text-xs sm:text-sm font-extrabold text-[#171717] mt-1.5 leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-[#737373] mt-0.5 leading-relaxed">
                        {item.subtitle}
                      </p>

                      {/* Action Buttons & Code display */}
                      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-black/5">
                        <button
                          onClick={() => handleCopyCode(item.code)}
                          className="flex items-center gap-1.5 bg-[#F5F2EB] hover:bg-[#E85D04]/10 border border-black/5 hover:border-[#E85D04]/30 px-2.5 py-1 rounded-lg transition active:scale-95 text-left"
                          title="Click to copy coupon code"
                        >
                          {copiedCode === item.code ? (
                            <>
                              <CheckCheck className="w-3.5 h-3.5 text-[#15803D]" />
                              <span className="font-mono font-bold text-xs text-[#15803D]">
                                {language === 'ta' ? 'நகலெடுக்கப்பட்டது!' : 'COPIED!'}
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#737373]" />
                              <span className="font-mono font-bold text-xs text-[#171717]">{item.code}</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowOfferDetailsModal(item)}
                            className="text-xs font-bold text-[#737373] hover:text-[#171717] px-2 py-1"
                          >
                            {language === 'ta' ? 'விவரங்கள்' : 'Details'}
                          </button>
                          <button
                            onClick={() => {
                              applyCoupon(item.code || item);
                              if (pickupLocation && dropLocation) {
                                setCustomerScreen('VEHICLE_SELECT');
                              } else {
                                setCustomerScreen('HOME');
                              }
                            }}
                            className="bg-[#E85D04] hover:bg-[#C2410C] text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition active:scale-98"
                          >
                            {language === 'ta' ? 'பயன்படுத்தி முன்பதிவு செய்' : 'Apply & Book'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Offer Code Modal */}
        {showAddOfferCodeModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-black/5 p-5 rounded-3xl w-full max-w-xs space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-[#171717]">
                  {language === 'ta' ? 'சலுகைக் குறியீட்டை உள்ளிடவும்' : 'Enter Offer Code'}
                </h3>
                <button onClick={() => setShowAddOfferCodeModal(false)}>
                  <X className="w-5 h-5 text-[#737373]" />
                </button>
              </div>
              <input
                type="text"
                value={newOfferCodeInput}
                onChange={(e) => setNewOfferCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. SAVE10 / FIRST100"
                className="w-full bg-[#FFF7F0] border border-[#E85D04]/20 p-3 rounded-xl text-xs font-mono font-bold uppercase outline-none focus:border-[#E85D04] text-[#171717]"
              />
              <button
                onClick={() => {
                  if (newOfferCodeInput) {
                    const res = applyCoupon(newOfferCodeInput);
                    setOfferApplyMessage(res?.message || (language === 'ta' ? 'சலுகைக் குறியீடு வெற்றிகரமாகப் பயன்படுத்தப்பட்டது!' : 'Offer code applied successfully!'));
                    setTimeout(() => {
                      setOfferApplyMessage('');
                      setShowAddOfferCodeModal(false);
                      setCustomerScreen('VEHICLE_SELECT');
                    }, 1200);
                  }
                }}
                className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold py-3 rounded-xl text-xs shadow-md shadow-[#E85D04]/30"
              >
                {language === 'ta' ? 'சலுகையைப் பயன்படுத்து' : 'Apply Offer'}
              </button>
              {offerApplyMessage && (
                <div className="p-2 bg-[#E7F6ED] text-[#15803D] text-xs font-bold rounded-xl text-center">
                  {offerApplyMessage}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Offer Details Modal */}
        {showOfferDetailsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-black/5 p-5 rounded-3xl w-full max-w-xs space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-[#171717]">
                  {language === 'ta' ? 'சலுகை விவரங்கள்' : 'Offer Details'}
                </h3>
                <button onClick={() => setShowOfferDetailsModal(null)}>
                  <X className="w-5 h-5 text-[#737373]" />
                </button>
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-[#171717]">{showOfferDetailsModal.title}</h4>
                <p className="text-xs text-[#737373] mt-1">{showOfferDetailsModal.subtitle}</p>
                {showOfferDetailsModal.code && (
                  <div className="mt-3 p-3 bg-[#FFF7F0] border border-[#E85D04]/20 rounded-2xl flex items-center justify-between">
                    <span className="text-xs text-[#737373]">
                      {language === 'ta' ? 'கூப்பன் குறியீடு:' : 'Promo Code:'}
                    </span>
                    <span className="font-mono font-extrabold text-sm text-[#E85D04]">
                      {showOfferDetailsModal.code}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (showOfferDetailsModal.code) applyCoupon(showOfferDetailsModal.code);
                  setShowOfferDetailsModal(null);
                  setCustomerScreen('VEHICLE_SELECT');
                }}
                className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold py-3 rounded-xl text-xs shadow-md shadow-[#E85D04]/30"
              >
                {language === 'ta' ? 'பயன்படுத்தி சவாரி முன்பதிவு செய்' : 'Apply & Book Ride'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 37. Notifications Screen
  if (customerScreen === 'NOTIFICATIONS') {
    return (
      <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] p-3 sm:p-4 overflow-y-auto">
        <div className="flex items-center gap-3 mb-3 sm:mb-4">
          <button
            onClick={() => setCustomerScreen('HOME')}
            className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] min-h-[36px] min-w-[36px]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base sm:text-lg font-bold">
            {language === 'ta' ? 'அறிவிப்புகள்' : 'Notifications'}
          </h2>
        </div>

        <div className="space-y-2.5 sm:space-y-3">
          {allNotifications.map((n: any) => (
            <div
              key={n.id}
              onClick={() => !n.isRead && markNotificationRead(n.id)}
              className={`bg-white border border-black/5 p-3 sm:p-3.5 rounded-2xl space-y-1 cursor-pointer transition ${
                n.isRead ? 'opacity-60' : 'border-[#E85D04]/40 hover:border-[#E85D04]'
              }`}
            >
              <h4 className="text-xs font-bold text-[#171717]">{n.title}</h4>
              <p className="text-[11px] text-[#737373]">{n.message}</p>
              <span className="text-[9px] text-[#A3A3A3] block">{n.time}</span>
              {!n.isRead && (
                <span className="text-[9px] font-bold text-[#E85D04] block">
                  {language === 'ta' ? 'படிக்கப்படாதது - படிக்க அழுத்தவும்' : 'Unread - tap to mark read'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 38. Profile Screen
  if (customerScreen === 'PROFILE') {
    if (!isCustomerAuthenticated) {
      return (
        <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-4 sm:p-6 overflow-y-auto max-w-md mx-auto w-full">
          <div>
            <div className="flex items-center justify-between gap-3 mb-6">
              <button
                type="button"
                onClick={() => setCustomerScreen('HOME')}
                className="w-10 h-10 bg-white rounded-2xl border border-black/10 flex items-center justify-center text-[#171717] hover:bg-black/5 active:scale-95 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center bg-[#F5F5F3] p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    language === 'en' ? 'bg-white text-[#E85D04] shadow-xs' : 'text-[#737373]'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('ta')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    language === 'ta' ? 'bg-white text-[#E85D04] shadow-xs' : 'text-[#737373]'
                  }`}
                >
                  தமிழ்
                </button>
              </div>
            </div>

            <div className="text-center space-y-4 pt-4 pb-8">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-[#FFF7F0] to-orange-100/60 border border-[#E85D04]/20 flex items-center justify-center text-[#E85D04] shadow-sm">
                <User className="w-10 h-10" />
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-[#171717] tracking-tight">
                  {language === 'ta' ? 'ஜிட்டா டிரைவ்ஸுக்கு வருக' : 'Welcome to Jitta Drives'}
                </h2>
                <p className="text-xs text-[#737373] font-medium leading-relaxed mt-2 max-w-xs mx-auto">
                  {language === 'ta'
                    ? 'உங்கள் பயண வரலாறு, மற்றும் சேமிக்கப்பட்ட இடங்களை அணுக உள்நுழையவும் அல்லது கணக்கை உருவாக்கவும்.'
                    : 'Sign in to access your ride history, manage saved places, and enjoy instant verified bookings.'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem('jitta_pending_customer_screen', 'PROFILE');
                  setCustomerScreen('LOGIN');
                }}
                className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-extrabold py-3.5 rounded-2xl shadow-sm text-sm flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <span>{language === 'ta' ? 'உள்நுழையவும்' : 'Login'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem('jitta_pending_customer_screen', 'PROFILE');
                  setCustomerScreen('LOGIN');
                }}
                className="w-full bg-white hover:bg-black/5 text-[#171717] font-bold py-3.5 rounded-2xl border border-black/10 text-sm active:scale-95 transition"
              >
                {language === 'ta' ? 'புதிய கணக்கை உருவாக்கவும்' : 'Create Account'}
              </button>
            </div>
          </div>

          <div className="text-[11px] text-[#A3A3A3] text-center pb-2 pt-6">
            {language === 'ta'
              ? 'பாதுகாப்பான மற்றும் நம்பகமான டாக்ஸி & ஓட்டுநர் சேவை'
              : 'Safe, reliable, and verified rides across Tamil Nadu'}
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-3 sm:p-4 overflow-y-auto">
        <div>
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <button
              onClick={() => setCustomerScreen('HOME')}
              className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] min-h-[36px] min-w-[36px]"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base sm:text-lg font-bold">
              {language === 'ta' ? 'எனது கணக்கு' : 'My Account'}
            </h2>
          </div>

          <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex items-center justify-between gap-3 mb-4 sm:mb-6 shadow-xl">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {customerProfile.avatar ? (
                <img src={customerProfile.avatar} alt="User" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-[#E85D04] shrink-0" />
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-100 border-2 border-[#E85D04]/30 flex items-center justify-center text-[#E85D04] shrink-0 shadow-xs">
                  <User className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-bold text-[#171717] truncate">{customerProfile.name}</h3>
                <p className="text-xs text-[#737373] truncate">{customerProfile.phone}</p>
                <span className="text-[10px] text-[#22A06B] font-bold">
                  {language === 'ta' ? 'சரிபார்க்கப்பட்ட வாடிக்கையாளர் ✓' : 'Verified Customer ✓'}
                </span>
              </div>
            </div>
            <button
              onClick={openEditProfileModal}
              className="bg-[#FFF7F0] hover:bg-[#FFEBD9] border border-[#E85D04]/30 text-[#E85D04] font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 active:scale-95 shadow-xs"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{language === 'ta' ? 'திருத்து' : 'Edit Profile'}</span>
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { label: language === 'ta' ? 'பயண வரலாறு' : 'My Rides History', screen: 'MY_RIDES', icon: Clock },
              { label: language === 'ta' ? 'சலுகைகள் & கூப்பன்கள்' : 'Offers & Coupons', screen: 'OFFERS', icon: Ticket },
              { label: language === 'ta' ? 'உதவி & ஆதரவு' : 'Help & Support', screen: 'SUPPORT', icon: HelpCircle },
            ].map((m, i) => {
              const IconComp = m.icon;
              return (
                <div
                  key={i}
                  onClick={() => setCustomerScreen(m.screen as any)}
                  className="bg-white border border-black/5 p-3 sm:p-3.5 rounded-2xl flex items-center justify-between cursor-pointer hover:border-black/20 min-h-[44px]"
                >
                  <div className="flex items-center gap-3">
                    <IconComp className="w-4 h-4 text-[#E85D04] shrink-0" />
                    <span className="font-bold text-[#171717]">{m.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#A3A3A3] shrink-0" />
                </div>
              );
            })}

            {/* Simple Language Switcher: Icon + Tamil / English directly */}
            <div className="bg-white border border-black/5 p-2.5 sm:p-3 rounded-2xl flex items-center justify-between min-h-[44px]">
              <div className="flex items-center gap-2.5 pl-1">
                <Languages className="w-5 h-5 text-[#E85D04] shrink-0" />
              </div>
              <div className="flex items-center bg-[#F5F5F3] p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition select-none ${
                    language === 'en'
                      ? 'bg-white text-[#E85D04] shadow-xs'
                      : 'text-[#737373] hover:text-[#171717]'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('ta')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition select-none ${
                    language === 'ta'
                      ? 'bg-white text-[#E85D04] shadow-xs'
                      : 'text-[#737373] hover:text-[#171717]'
                  }`}
                >
                  தமிழ்
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={logoutCustomer}
          className="w-full bg-white hover:bg-[#FEF2F2] text-rose-600 font-bold py-3 sm:py-3.5 rounded-2xl border border-rose-200 flex items-center justify-center gap-2 text-xs transition mt-4 min-h-[44px]"
        >
          <LogOut className="w-4 h-4" />
          <span>{language === 'ta' ? 'வெளியேறு' : 'Logout Account'}</span>
        </button>

        {/* Customer Edit Profile Modal */}
        {showEditProfileModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-black/10">
              <div className="flex items-center justify-between pb-3 border-b border-black/10">
                <h3 className="font-extrabold text-base text-[#171717]">
                  {language === 'ta' ? 'சுயவிவரத்தைத் திருத்து' : 'Edit Profile'}
                </h3>
                <button
                  onClick={() => setShowEditProfileModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {custProfileMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold ${custProfileMsg.isError ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                  {custProfileMsg.text}
                </div>
              )}

              {/* Photo Upload Area */}
              <div className="flex items-center gap-4 p-3.5 bg-[#FAFAF8] border border-black/5 rounded-2xl">
                {editCustPhoto ? (
                  <img
                    src={editCustPhoto}
                    alt="Preview"
                    className="w-16 h-16 rounded-full object-cover border-2 border-[#E85D04] shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-[#E85D04]/30 flex items-center justify-center text-[#E85D04] shrink-0">
                    <User className="w-8 h-8" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-xs block text-[#171717] mb-1">
                    {language === 'ta' ? 'சுயவிவர புகைப்படம்' : 'Profile Photo'}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="cursor-pointer bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold text-[11px] px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-xs active:scale-95">
                      <Camera className="w-3.5 h-3.5" />
                      <span>{language === 'ta' ? 'புகைப்படம் பதிவேற்று' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCustomerPhotoUpload}
                      />
                    </label>
                    {editCustPhoto && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditCustPhoto('');
                          setCustProfileMsg({ text: language === 'ta' ? 'புகைப்படம் நீக்கப்பட்டது. இயல்புநிலை ஐகான் பயன்படுத்தப்படும்.' : 'Photo removed. Profile icon will be used.', isError: false });
                        }}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 active:scale-95"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{language === 'ta' ? 'நீக்கு' : 'Remove'}</span>
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-[#737373] mt-1 block">
                    {language === 'ta' ? 'புகைப்படம் இல்லாதபோது சுயவிவர ஐகான் மட்டுமே காட்டப்படும்.' : 'When no photo is uploaded, profile icon will appear.'}
                  </span>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-bold text-[#737373] block mb-1">
                  {language === 'ta' ? 'முழு பெயர்' : 'Full Name'}
                </label>
                <input
                  type="text"
                  value={editCustName}
                  onChange={(e) => setEditCustName(e.target.value)}
                  className="w-full bg-[#FAFAF8] border border-black/10 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#171717] outline-none focus:border-[#E85D04]"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-bold text-[#737373] block mb-1">
                  {language === 'ta' ? 'மின்னஞ்சல் முகவரி' : 'Email Address'}
                </label>
                <input
                  type="email"
                  value={editCustEmail}
                  onChange={(e) => setEditCustEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#FAFAF8] border border-black/10 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#171717] outline-none focus:border-[#E85D04]"
                />
              </div>

              {/* Phone (Readonly) */}
              <div>
                <label className="text-xs font-bold text-[#737373] block mb-1">
                  {language === 'ta' ? 'தொலைபேசி எண் (சரிபார்க்கப்பட்டது)' : 'Phone Number (Verified)'}
                </label>
                <div className="w-full bg-slate-100 border border-black/5 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-500 flex items-center justify-between">
                  <span>{customerProfile.phone}</span>
                  <span className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded">✓ Verified</span>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl transition"
                >
                  {language === 'ta' ? 'ரத்து செய்' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={custProfileSaving}
                  onClick={handleSaveCustomerProfile}
                  className="flex-1 bg-[#E85D04] hover:bg-[#C2410C] disabled:opacity-50 text-white font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                >
                  {custProfileSaving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {language === 'ta' ? 'சேமிக்கப்படுகிறது…' : 'Saving…'}</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> {language === 'ta' ? 'மாற்றங்களைச் சேமி' : 'Save Changes'}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 39. Saved Places Screen
  if (customerScreen === 'SAVED_PLACES') {
    return (
      <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-3 sm:p-4 overflow-y-auto">
        <div>
          <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setCustomerScreen('PROFILE')}
                className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] min-h-[36px] min-w-[36px]"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-base sm:text-lg font-bold">
                {language === 'ta' ? 'சேமிக்கப்பட்ட இடங்கள்' : 'Saved Places'}
              </h2>
            </div>
            <button
              onClick={() => {
                setPlaceError('');
                setNewPlaceAddress('');
                setNewPlaceName('');
                setShowAddPlaceModal(true);
              }}
              className="text-xs bg-[#E85D04] text-white font-bold px-3 py-1.5 rounded-xl hover:bg-[#C2410C] transition shadow-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === 'ta' ? 'இடம் சேர்' : 'Add Place'}</span>
            </button>
          </div>

          {/* Add Place Modal / Form */}
          {showAddPlaceModal && (
            <div className="bg-white border-2 border-[#E85D04]/30 rounded-2xl p-3.5 mb-3.5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#171717]">
                  {language === 'ta' ? 'புதிய இடத்தை சேமிக்கவும்' : 'Save New Place'}
                </span>
                <button
                  onClick={() => setShowAddPlaceModal(false)}
                  className="w-6 h-6 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-xs text-[#737373]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {placeError && (
                <div className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-lg font-medium">
                  {placeError}
                </div>
              )}

              <div className="flex gap-2">
                {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => setNewPlaceLabel(lbl)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition ${
                      newPlaceLabel === lbl
                        ? 'bg-[#E85D04] text-white border-[#E85D04]'
                        : 'bg-[#F9F5F0] text-[#737373] border-black/5 hover:border-black/20'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              {newPlaceLabel === 'Other' && (
                <input
                  type="text"
                  placeholder="Custom Name (e.g. Gym, Friend's house)"
                  value={newPlaceName}
                  onChange={(e) => setNewPlaceName(e.target.value)}
                  className="w-full text-xs bg-[#F9F5F0] border border-black/10 rounded-xl p-2.5 font-medium outline-none focus:border-[#E85D04]"
                />
              )}

              <input
                type="text"
                placeholder="Full Address / Landmark (e.g. RS Puram, Coimbatore)"
                value={newPlaceAddress}
                onChange={(e) => setNewPlaceAddress(e.target.value)}
                className="w-full text-xs bg-[#F9F5F0] border border-black/10 rounded-xl p-2.5 font-medium outline-none focus:border-[#E85D04]"
              />

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddPlaceModal(false)}
                  className="px-3 py-1.5 text-xs text-[#737373] font-semibold hover:bg-black/5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newPlaceAddress.trim()) {
                      setPlaceError('Please enter an address');
                      return;
                    }
                    await addSavedPlace({
                      label: newPlaceLabel,
                      custom_label: newPlaceLabel === 'Other' ? newPlaceName.trim() : newPlaceLabel,
                      address: newPlaceAddress.trim(),
                      lat: 11.0183,
                      lng: 76.9644,
                    });
                    setShowAddPlaceModal(false);
                  }}
                  className="px-4 py-1.5 text-xs bg-[#E85D04] text-white font-bold rounded-xl hover:bg-[#C2410C]"
                >
                  Save Place
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2.5 sm:space-y-3">
            {customerProfile.savedPlaces.length === 0 ? (
              <div className="bg-white border border-dashed border-[#E85D04]/30 rounded-2xl p-6 text-center">
                <MapPin className="w-8 h-8 text-[#E85D04] mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold text-[#171717]">No saved places found</p>
                <p className="text-[11px] text-[#737373] mt-1">Tap "+ Add Place" above to add your Home or Work</p>
              </div>
            ) : (
              customerProfile.savedPlaces.map((sp: any) => (
                <div key={sp.id} className="bg-white border border-black/5 p-3 sm:p-3.5 rounded-2xl flex items-center justify-between gap-2 shadow-xs">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-[#171717] truncate">{sp.label}</h4>
                    <p className="text-[11px] text-[#737373] truncate">{sp.address}</p>
                  </div>
                  <button
                    onClick={() => deleteSavedPlace(sp.id)}
                    className="p-2 text-[#A3A3A3] hover:text-rose-600 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Remove saved place"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // 40. Help & Support Screen
  if (customerScreen === 'SUPPORT') {
    return (
      <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-3 sm:p-4 overflow-y-auto">
        <div>
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <button
              onClick={() => setCustomerScreen('PROFILE')}
              className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] min-h-[36px] min-w-[36px]"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base sm:text-lg font-bold">
              {language === 'ta' ? 'உதவி & ஆதரவு' : 'Help & Support'}
            </h2>
          </div>

          {ticketSubmitted ? (
            <div className="bg-[#22A06B]/10 border border-[#22A06B]/30 p-4 rounded-2xl sm:rounded-3xl text-center space-y-2">
              <Check className="w-8 h-8 text-[#22A06B] mx-auto" />
              <h3 className="text-sm font-bold text-[#171717]">
                {language === 'ta' ? 'உதவி கோரிக்கை சமர்ப்பிக்கப்பட்டது' : 'Support Ticket Submitted'}
              </h3>
              <p className="text-xs text-[#15803D]">
                {language === 'ta' ? 'எங்கள் வாடிக்கையாளர் ஆதரவு குழு 15 நிமிடங்களில் பதிலளிக்கும்.' : 'Our customer team will respond within 15 minutes.'}
              </p>
              <button
                onClick={() => setTicketSubmitted(false)}
                className="mt-3 text-xs bg-[#22A06B] text-white font-bold px-4 py-2 rounded-xl min-h-[36px] hover:bg-[#1F8F5F]"
              >
                {language === 'ta' ? 'மற்றொரு கோரிக்கையைச் சமர்ப்பிக்க' : 'Submit another ticket'}
              </button>
            </div>
          ) : (
            <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-[#737373] font-bold uppercase">
                  {language === 'ta' ? 'பிரச்சினை வகை' : 'Issue Category'}
                </label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value)}
                  className="w-full bg-[#F9F5F0] border border-black/10 rounded-xl p-2.5 text-[#171717] outline-none mt-1 focus:border-[#E85D04]"
                >
                  <option value="Booking Issue">{language === 'ta' ? 'முன்பதிவு பிரச்சினை' : 'Booking Issue'}</option>
                  <option value="Payment Issue">{language === 'ta' ? 'கட்டண பிரச்சினை' : 'Payment Issue'}</option>
                  <option value="Driver Issue">{language === 'ta' ? 'ஓட்டுநர் பிரச்சினை' : 'Driver Issue'}</option>
                  <option value="Wrong Fare Charged">{language === 'ta' ? 'தவறான கட்டணம்' : 'Wrong Fare Charged'}</option>
                  <option value="Lost Item in Cab">{language === 'ta' ? 'காரில் பொருள் தவறியது' : 'Lost Item in Cab'}</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#737373] font-bold uppercase">
                  {language === 'ta' ? 'தலைப்பு' : 'Subject'}
                </label>
                <input
                  type="text"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder={language === 'ta' ? 'சுருக்கமான தலைப்பு...' : 'Brief summary...'}
                  className="w-full bg-[#F9F5F0] border border-black/10 rounded-xl p-2.5 text-[#171717] outline-none mt-1 focus:border-[#E85D04] placeholder-[#A3A3A3]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#737373] font-bold uppercase">
                  {language === 'ta' ? 'விளக்கம்' : 'Description'}
                </label>
                <textarea
                  value={ticketDesc}
                  onChange={(e) => setTicketDesc(e.target.value)}
                  placeholder={language === 'ta' ? 'என்ன நடந்தது என்பதை விளக்குங்கள்...' : 'Explain what happened...'}
                  className="w-full bg-[#F9F5F0] border border-black/10 rounded-xl p-2.5 text-[#171717] outline-none mt-1 h-20 resize-none focus:border-[#E85D04] placeholder-[#A3A3A3]"
                />
              </div>

              <button
                onClick={() => {
                  createSupportTicket({
                    category: ticketCategory,
                    subject: ticketSubject || 'General Query',
                    description: ticketDesc,
                  });
                  setTicketSubmitted(true);
                }}
                className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold py-3 rounded-2xl shadow min-h-[44px]"
              >
                {language === 'ta' ? 'கோரிக்கையைச் சமர்ப்பிக்கவும்' : 'Submit Ticket'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

// Live DRIVER ONLY fare display (server-authoritative hourly chauffeur rate)
const DriverOnlyFare: React.FC<{
  fetchFn: () => Promise<{ totalFare: number } | null>;
  hours: number;
}> = ({ fetchFn, hours }) => {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetchFn()
      .then((fb) => {
        if (alive) setTotal(fb ? fb.totalFare : null);
      })
      .catch(() => {
        if (alive) setTotal(null);
      });
    return () => {
      alive = false;
    };
  }, [fetchFn, hours]);

  if (total === null) return <span className="text-[#A3A3A3]">…</span>;
  return (
    <span>
      ₹{total}
      <span className="text-[9px] text-[#A3A3A3] ml-1 font-semibold">all-in</span>
    </span>
  );
};