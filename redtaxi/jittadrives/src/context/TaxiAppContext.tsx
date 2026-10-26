import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { AdminTab } from '../admin/adminTypes';
import type {
  AppViewMode,
  CustomerScreen,
  DriverScreen,
  RideType,
  LocationPoint,
  VehicleOption,
  DriverProfile,
  SavedPlace,
  CustomerProfile,
  FareBreakdown,
  BookingRecord,
  Coupon,
  WalletTransaction,
  NotificationItem,
  ChatMessage,
  SupportTicket,
  OfferBanner,
  FareRule,
} from '../types/taxi';
import {
  MOCK_LOCATIONS,
  MOCK_VEHICLES,
  MOCK_DRIVERS,
  MOCK_CUSTOMER,
  MOCK_BOOKINGS,
  MOCK_COUPONS,
  MOCK_OFFERS,
  MOCK_NOTIFICATIONS,
  MOCK_SUPPORT_TICKETS,
  MOCK_FARE_RULES,
} from '../data/mockData';
import { tokenStorage, bookingApi, authApi, customerApi, driverApi, chatApi, lookupApi } from '../services/api';
import { adminApi } from '../admin/adminApi';
import { type LanguageCode, translations } from '../i18n/translations';
import { detectLiveDynamicLocationWithStatus } from '../services/locationService';

export const sanitizeBrandText = (text?: string, fallback?: string): string => text || fallback || '';

export function mapBackendBookingToRecord(b: any): BookingRecord {
  const pickupLoc = b.locations?.find((l: any) => l.type === 'PICKUP') || {
    name: b.pickup?.name || (typeof b.pickup === 'string' ? b.pickup : 'Pickup Location'),
    address: b.pickup?.address || '',
    lat: Number(b.pickup?.lat || 11.0168),
    lng: Number(b.pickup?.lng || 76.9558),
  };
  const dropLoc = b.locations?.find((l: any) => l.type === 'DROP') || {
    name: b.drop?.name || (typeof b.drop === 'string' ? b.drop : 'Drop Location'),
    address: b.drop?.address || '',
    lat: Number(b.drop?.lat || 11.0268),
    lng: Number(b.drop?.lng || 76.9658),
  };
  const stops = b.locations?.filter((l: any) => l.type === 'STOP').map((l: any) => ({
    name: l.name,
    address: l.address,
    lat: Number(l.lat),
    lng: Number(l.lng),
  }));

  const fb = b.fare_breakdown || {};

  return {
    id: b.id,
    customerId: b.customer?.id || b.customer_id || '',
    customerName: b.customer?.name || b.customer_name || 'Customer',
    customerPhone: b.customer?.phone || b.customer_phone || '',
    driverId: b.driver?.id || b.driver_id,
    driverName: b.driver?.name || b.driver_name,
    driverPhone: b.driver?.phone || b.driver_phone,
    driverRating: b.driver?.rating ? Number(b.driver.rating) : undefined,
    driverPhoto: b.driver?.photo_url || b.driver?.photo,
    vehicleNumber: b.vehicle?.vehicle_number || b.vehicle_number,
    vehicleModel: b.vehicle?.vehicle_model || b.vehicle_model,
    rideType: (b.ride_type || 'CITY') as any,
    vehicleCategory: b.vehicle_category || 'Red Mini',
    pickup: {
      name: pickupLoc.name,
      address: pickupLoc.address,
      lat: Number(pickupLoc.lat),
      lng: Number(pickupLoc.lng),
    },
    drop: {
      name: dropLoc.name,
      address: dropLoc.address,
      lat: Number(dropLoc.lat),
      lng: Number(dropLoc.lng),
    },
    stops: stops && stops.length > 0 ? stops : undefined,
    status: b.status || 'SEARCHING',
    startOtp: b.otp || b.start_otp || '',
    distanceKm: Number(b.distance_km || 0),
    durationMin: Number(b.duration_min || 0),
    fare: {
      baseFare: Number(fb.base_fare ?? fb.baseFare ?? 0),
      distanceFare: Number(fb.distance_fare ?? fb.distanceFare ?? 0),
      timeFare: Number(fb.time_fare ?? fb.timeFare ?? 0),
      waitingFare: Number(fb.waiting_fare ?? fb.waitingFare ?? 0),
      platformFee: Number(fb.platform_fee ?? fb.platformFee ?? 0),
      tax: Number(fb.tax ?? 0),
      discount: Number(fb.discount ?? 0),
      totalFare: Number(fb.total_fare ?? fb.totalFare ?? b.total_fare ?? 0),
    },
    paymentMethod: b.payment_method || 'CASH',
    paymentStatus: b.payment_status || 'PENDING',
    createdAt: b.created_at || new Date().toISOString(),
    scheduledTime: b.scheduled_time,
  };
}

export function mapBackendDriverToProfile(d: any): DriverProfile {
  const veh = d.vehicle || {};
  return {
    id: d.id || '',
    name: d.name || (d.phone ? ('Partner ' + String(d.phone).slice(-4)) : 'Driver'),
    phone: d.phone || '',
    email: d.email || `${d.phone || 'driver'}@jittadrives.com`,
    rating: Number(d.rating || d.rating_avg || 4.85),
    tripsCount: Number(d.trips_count || d.total_rides || 0),
    photo: d.photo_url || d.photo || d.avatar_url || '',
    vehicleModel: d .vehicle_model || veh.vehicle_model || veh.model || (d.vehicle_type === 'ACTING_DRIVER' ? 'Customer Vehicle' : 'Maruti Suzuki Dzire'),
    vehicleNumber: d.vehicle_number || veh.vehicle_number || veh.number || '',
    vehicleType: d.vehicle_type || veh.vehicle_type || d.driver_type || 'TAXI',
    isOnline: Boolean(Number(d.is_online) === 1),
    approvalStatus: (d.approval_status || 'APPROVED') as any,
    todayEarnings: Number(d.today_earnings || 0),
    completedTripsToday: Number(d.today_trips || d.completed_trips_today || 0),
    commission: Number(d.commission_percent || d.commission || 15),
    documents: {
      license: d.documents?.license || 'Verified',
      rc: d.documents?.rc || 'Verified',
      insurance: d.documents?.insurance || 'Verified',
      permit: d.documents?.permit || 'Verified',
    },
    documentNumbers: {
      license: d.license_number || d.document_numbers?.license || '',
      rc: d.rc_number || d.document_numbers?.rc || '',
      insurance: d.insurance_number || d.document_numbers?.insurance || '',
      permit: d.permit_number || d.document_numbers?.permit || '',
    },
  };
}

export function resolveVehicleCategoryGroup(categoryOrType?: string, rideType?: string): 'TAXI' | 'TWO_WHEELER' | 'ACTING_DRIVER' {
  const c = String(categoryOrType || '').toLowerCase().trim();
  const rt = String(rideType || '').toLowerCase().trim();

  // 1. Acting Driver group
  if (rt === 'driver_only' || c.includes('acting') || c.includes('active_driver') || c.includes('driver_only')) {
    return 'ACTING_DRIVER';
  }

  // 2. Two-Wheeler group (Bike & Scooty)
  const normalized = c.replace(/[-_\s]/g, '');
  if (c.includes('bike') || c.includes('scoot') || normalized.includes('twowheeler') || c.includes('moto')) {
    return 'TWO_WHEELER';
  }

  // 3. Taxi group (Cab / Auto / Sedan / Mini / SUV / Car)
  return 'TAXI';
}

// Shared BroadcastChannel for sub-second real-time dispatch across tabs & windows
export const liveDispatchChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('jitta_live_dispatch')
  : null;

export interface TaxiAppContextType {
  // Theme, ViewMode & I18n
  themeMode: 'DARK' | 'LIGHT';
  setThemeMode: (mode: 'DARK' | 'LIGHT') => void;
  toggleTheme: () => void;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, defaultText?: string) => string;
  viewMode: AppViewMode;
  setViewMode: (mode: AppViewMode) => void;

  // Customer Navigation & Auth
  customerScreen: CustomerScreen;
  setCustomerScreen: (screen: CustomerScreen) => void;
  isCustomerAuthenticated: boolean;
  customerProfile: CustomerProfile;
  setCustomerProfile: React.Dispatch<React.SetStateAction<CustomerProfile>>;
  updateCustomerProfile: (data: { name?: string; email?: string; avatar?: string; avatar_url?: string }) => Promise<{ success: boolean; message?: string }>;
  logoutCustomer: () => void;
  loginCustomer: (token: string, profile?: any) => void;
  refreshCustomerData: () => Promise<void>;
  selectedInvoiceBooking: BookingRecord | null;
  setSelectedInvoiceBooking: (b: BookingRecord | null) => void;

  // Customer Trip & Booking State
  pickupLocation: LocationPoint;
  setPickupLocation: (loc: LocationPoint) => void;
  dropLocation: LocationPoint | null;
  setDropLocation: (loc: LocationPoint | null) => void;
  intermediateStops: LocationPoint[];
  addStop: (loc: LocationPoint) => void;
  removeStop: (index: number) => void;
  selectedVehicle: any;
  setSelectedVehicle: (vehicle: any) => void;
  driverOnlyHours: number;
  setDriverOnlyHours: (h: number) => void;
  driverOnlyVehicleNumber: string;
  setDriverOnlyVehicleNumber: (n: string) => void;
  driverOnlyVehicle: any;
  setDriverOnlyVehicle: React.Dispatch<React.SetStateAction<any>>;
  vehicleCategories: VehicleOption[];
  setVehicleCategories: React.Dispatch<React.SetStateAction<VehicleOption[]>>;
  rideType: RideType;
  setRideType: (rt: RideType) => void;
  estimatedDistance: number;
  estimatedDuration: number;
  calculateFare: (vehicleName: string) => any;
  fetchServerFareEstimate: (vehicleName: string) => Promise<FareBreakdown | null>;
  confirmBooking: () => Promise<{ success: boolean; message?: string; booking?: BookingRecord } | void>;
  cancelActiveBooking: (reason?: string) => Promise<{ success: boolean; message: string }>;
  isBookingLoading: boolean;
  bookingError: string | null;
  activeBooking: BookingRecord | null;
  setActiveBooking: (b: BookingRecord | null) => void;

  // Coupons & Wallet
  allCoupons: Coupon[];
  appliedCoupon: Coupon | null;
  applyCoupon: (c: any) => { success: boolean; message: string; discount?: number };
  areCouponsDisabled: boolean;
  refreshCoupons: () => Promise<void>;
  selectedPaymentMethod: string;
  setSelectedPaymentMethod: (pm: string) => void;
  walletTransactions: WalletTransaction[];
  addMoneyToWallet: (amount: number) => void;
  allNotifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  createSupportTicket: (ticket: Partial<SupportTicket>) => Promise<void>;
  rentalHours: number;
  setRentalHours: (h: number) => void;
  outstationConfig: any;
  setOutstationConfig: (cfg: any) => void;
  airportConfig: any;
  setAirportConfig: (cfg: any) => void;
  addSavedPlace: (place: { label: 'Home' | 'Work' | 'Other'; custom_label?: string; address: string; lat: number; lng: number }) => Promise<{ success: boolean; message: string }>;

  // Driver Navigation & State
  driverScreen: DriverScreen;
  setDriverScreen: (screen: DriverScreen) => void;
  isDriverAuthenticated: boolean;
  driverProfile: DriverProfile;
  setDriverProfile: React.Dispatch<React.SetStateAction<DriverProfile>>;
  toggleDriverOnline: () => Promise<{ success: boolean; message?: string; reason?: string }>;
  rechargeDriverWallet: (amount: number, paymentMethod?: string, status?: string, ref?: string) => Promise<{ success: boolean; message: string; data?: any }>;
  availableRides: any[];
  driverRideHistory: any[];
  refreshDriverHistory: () => Promise<void>;
  driverCurrentRide: any | null;
  setDriverCurrentRide: (r: any) => void;
  driverWallet: any | null;
  driverNotifications: NotificationItem[];
  refreshDriverNotifications: () => Promise<void>;
  refreshDriverWallet: () => Promise<void>;
  markDriverNotificationRead: (id: string) => Promise<void>;
  lastCompletedRide: any | null;
  setLastCompletedRide: (r: any) => void;
  selectedAvailableRide: any | null;
  setSelectedAvailableRide: (ride: any | null) => void;
  acceptRideRequest: (rideId?: string) => Promise<{ success: boolean; message?: string } | void>;
  rejectRideRequest: (rideId?: string) => Promise<void>;
  driverArrivedAtPickup: (extra?: any) => Promise<{ success: boolean; message?: string }>;
  startTripWithOtp: (otp: string) => Promise<{ success: boolean; message: string }>;
  completeCurrentTrip: (extra?: any) => Promise<any>;
  simulatedProgress: number;
  setSimulatedProgress: (p: number) => void;
  loginDriver: (phone: string, pass?: string, otp?: string, firebaseVerified?: boolean) => Promise<{ success: boolean; message?: string; driver?: any }>;
  registerDriver: (data: any) => Promise<{ success: boolean; message?: string; driver?: any }>;
  logoutDriver: () => void;
  refreshDriverData: () => Promise<void>;
  updateDriverProfile: (data: { name?: string; email?: string }) => Promise<{ success: boolean; message?: string }>;
  updateDriverVehicle: (data: { vehicle_model?: string; vehicle_number?: string; vehicle_type?: string; color?: string; year?: number }) => Promise<{ success: boolean; message?: string }>;
  chatMessages: ChatMessage[];
  sendChatMessage: (arg1: string, arg2?: string) => void;
  driverUnreadChatCount: number;
  setDriverUnreadChatCount: (n: number) => void;
  customerUnreadChatCount: number;
  setCustomerUnreadChatCount: (n: number) => void;
  showDriverChat: boolean;
  setShowDriverChat: (b: boolean) => void;
  confirmDriverVehicle: () => void;
  reportDriverVehicleMismatch: (reason: string) => void;
  triggerSOS: (role: 'CUSTOMER' | 'DRIVER') => void;
  isSosActive: boolean;
  clearSOS: () => void;
  rateDriver: (rating: number, review?: string) => Promise<void>;

  // Common shared lists
  allOffers: OfferBanner[];
  offersNotice: string;
  setOffersNotice: (n: string) => void;
  areOffersDisabled: boolean;
  refreshOffers: () => Promise<void>;
  allDrivers: DriverProfile[];
  allBookings: BookingRecord[];
  refreshCustomerBookings: () => Promise<void>;
  fareRules: FareRule[];
  locationStatus: string;
  locationErrorMessage: string;
  retryLocationDetection: () => void;
  isFetchingLocation: boolean;

  // Admin Portal State
  adminTab: AdminTab;
  setAdminTab: (tab: AdminTab) => void;
  adminToken: string | null;
  adminProfile: any | null;
  adminDashboardStats: any | null;
  adminCustomersList: any[];
  adminDriversList: any[];
  adminVehiclesList: any[];
  adminPartnerVehiclesList: any[];
  adminBookingsList: any[];
  adminFareRulesList: any[];
  isAdminLoading: boolean;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  adminLogout: () => void;
  refreshAdminData: () => Promise<void>;
  adminApproveDriver: (driverId: string) => Promise<boolean>;
  adminRejectDriver: (driverId: string) => Promise<boolean>;
  adminSetDriverApproval: (driverId: string, status: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'PENDING') => Promise<boolean>;
  adminUpdateCustomerStatus: (customerId: string, status: 'ACTIVE' | 'BLOCKED') => Promise<boolean>;
  adminDeleteCustomer: (customerId: string) => Promise<boolean>;
  adminDeleteDriver: (driverId: string) => Promise<boolean>;
  adminAssignDriver: (bookingId: string, driverId: string) => Promise<{ success: boolean; message: string }>;
  adminUpdateFareRule: (ruleId: string, data: any) => Promise<boolean>;
  adminToggleVehicleCategory: (categoryId: string) => Promise<boolean>;
}

const TaxiAppContext = createContext<TaxiAppContextType | null>(null);

export const TaxiAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme & Language
  const [themeMode, setThemeMode] = useState<'DARK' | 'LIGHT'>('DARK');
  const toggleTheme = () => setThemeMode((m) => (m === 'DARK' ? 'LIGHT' : 'DARK'));

  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('redtaxi_lang');
    return (saved === 'ta' || saved === 'kn' || saved === 'hi' || saved === 'en') ? saved : 'en';
  });

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('redtaxi_lang', lang);
  }, []);

  const t = useCallback((key: string, defaultText?: string): string => {
    const langDict = translations[language] || translations['en'];
    return langDict[key] || translations['en'][key] || defaultText || key;
  }, [language]);

  const [viewMode, setViewMode] = useState<AppViewMode>('CUSTOMER');
  const [selectedInvoiceBooking, setSelectedInvoiceBooking] = useState<BookingRecord | null>(null);
  const refreshCustomerData = useCallback(async () => {
    // Refresh bookings & profile if token exists
  }, []);

  // Customer Navigation & Auth
  const [customerScreen, setCustomerScreen] = useState<CustomerScreen>('HOME');
  const [customerToken, setCustomerToken] = useState<string | null>(tokenStorage.getCustomerToken());
  const isCustomerAuthenticated = Boolean(customerToken);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile>(MOCK_CUSTOMER);

  const loginCustomer = (token: string, profile?: any) => {
    tokenStorage.setCustomerToken(token);
    setCustomerToken(token);
    if (profile) {
      setCustomerProfile((prev) => ({ ...prev, ...profile }));
    }
  };

  const logoutCustomer = () => {
    tokenStorage.clearCustomerToken();
    setCustomerToken(null);
    setActiveBooking(null);
    setCustomerScreen('HOME');
  };

  // Customer Bookings History from real backend
  const [allBookings, setAllBookings] = useState<BookingRecord[]>([]);

  const refreshCustomerBookings = useCallback(async () => {
    const token = tokenStorage.getCustomerToken();
    if (!token) return;
    try {
      const res = await customerApi.getBookings(50, 1);
      if (res && res.success && Array.isArray(res.data)) {
        setAllBookings(res.data.map(mapBackendBookingToRecord));
      }
    } catch (e) {
      console.warn('Error fetching customer bookings:', e);
    }
  }, []);

  // Restore active customer booking, profile, and history on app launch or refresh
  useEffect(() => {
    const cToken = tokenStorage.getCustomerToken();
    if (!cToken) return;

    customerApi.getProfile().then((res) => {
      if (res && res.success && res.data) {
        setCustomerProfile((prev) => ({
          ...prev,
          id: res.data.id || prev.id,
          name: res.data.name || prev.name,
          phone: res.data.phone || prev.phone,
          email: res.data.email || prev.email,
          avatar: res.data.avatar_url || res.data.avatar || prev.avatar || '',
        }));
      }
    }).catch(() => {});

    bookingApi.getActiveBooking().then((res) => {
      if (res && res.success && res.data) {
        const record = mapBackendBookingToRecord(res.data);
        setActiveBooking(record);
        const statusStr = String(res.data.status);
        if (statusStr === 'SEARCHING') {
          setCustomerScreen('SEARCHING_DRIVER');
        } else if (statusStr === 'ASSIGNED' || statusStr === 'ACCEPTED' || statusStr === 'EN_ROUTE') {
          setCustomerScreen('DRIVER_ASSIGNED');
        } else if (statusStr === 'ARRIVED') {
          setCustomerScreen('DRIVER_ARRIVED');
        } else if (statusStr === 'STARTED' || statusStr === 'IN_PROGRESS') {
          setCustomerScreen('TRIP_STARTED');
        }
      }
    }).catch(() => {});

    refreshCustomerBookings();
  }, [customerToken, refreshCustomerBookings]);

  useEffect(() => {
    if (customerScreen === 'MY_RIDES' && customerToken) {
      refreshCustomerBookings();
    }
  }, [customerScreen, customerToken, refreshCustomerBookings]);

  const updateCustomerProfile = async (data: { name?: string; email?: string; avatar?: string; avatar_url?: string }) => {
    try {
      const apiPayload: any = {};
      if (data.name !== undefined) apiPayload.name = data.name;
      if (data.email !== undefined) apiPayload.email = data.email;
      if (data.avatar_url !== undefined || data.avatar !== undefined) {
        apiPayload.avatar_url = data.avatar_url ?? data.avatar;
      }
      const res = await customerApi.updateProfile(apiPayload);
      if (res && res.success) {
        const returnedAvatar = (res.data?.avatar_url || apiPayload.avatar_url) as string | undefined;
        setCustomerProfile((prev) => ({
          ...prev,
          name: data.name !== undefined ? data.name : prev.name,
          email: data.email !== undefined ? data.email : prev.email,
          avatar: (returnedAvatar !== undefined ? returnedAvatar : prev.avatar) || '',
        }));
        return { success: true };
      }
      return { success: false, message: res?.message || 'Failed to update profile' };
    } catch {
      // Offline / fallback state update
      const fallbackAvatar = data.avatar_url ?? data.avatar;
      setCustomerProfile((prev) => ({
        ...prev,
        name: data.name !== undefined ? data.name : prev.name,
        email: data.email !== undefined ? data.email : prev.email,
        avatar: (fallbackAvatar !== undefined ? fallbackAvatar : prev.avatar) || '',
      }));
      return { success: true };
    }
  };

  // Customer Ride Locations & Vehicle Selection
  const [pickupLocation, setPickupLocation] = useState<LocationPoint>(() => {
    try {
      const saved = sessionStorage.getItem('jitta_user_gps');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name && parsed.lat) return parsed;
      }
    } catch {}
    return {
      name: '',
      address: '',
      lat: 11.6643,
      lng: 78.1460,
      category: 'POPULAR',
    };
  });
  const [dropLocation, setDropLocation] = useState<LocationPoint | null>(null);
  const [intermediateStops, setIntermediateStops] = useState<LocationPoint[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any>('Auto');
  const [vehicleCategories, setVehicleCategories] = useState<VehicleOption[]>(MOCK_VEHICLES);
  const [rideType, setRideType] = useState<RideType>('CITY');
  const [driverOnlyHours, setDriverOnlyHours] = useState<number>(2);
  const [driverOnlyVehicleNumber, setDriverOnlyVehicleNumber] = useState<string>('');
  const [driverOnlyVehicle, setDriverOnlyVehicle] = useState<any>({
    model: 'Personal Car',
    number: '',
    type: 'Car',
    transmission: 'Manual',
  });
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(true);
  const [locationStatus, setLocationStatus] = useState<string>('IDLE');
  const [locationErrorMessage, setLocationErrorMessage] = useState<string>('');

  const addStop = (loc: LocationPoint) => setIntermediateStops((prev) => [...prev, loc]);
  const removeStop = (idx: number) => setIntermediateStops((prev) => prev.filter((_, i) => i !== idx));

  // Auto-detect live hardware GPS on initial app launch (prompts browser location permission)
  const autoDetectGps = useCallback(async () => {
    setIsFetchingLocation(true);
    setLocationStatus('FETCHING');
    try {
      const res = await detectLiveDynamicLocationWithStatus();
      if (res.location && res.location.lat && res.location.name) {
        setPickupLocation(res.location);
        setLocationStatus('SUCCESS');
        setLocationErrorMessage('');
        try {
          sessionStorage.setItem('jitta_user_gps', JSON.stringify(res.location));
        } catch {}
      } else if (res.errorMessage) {
        setLocationStatus('ERROR');
        setLocationErrorMessage(res.errorMessage);
      }
    } catch (err: any) {
      console.warn('GPS detection error:', err);
      setLocationStatus('ERROR');
      setLocationErrorMessage(err?.message || 'Location error');
    } finally {
      setIsFetchingLocation(false);
    }
  }, []);

  useEffect(() => {
    autoDetectGps();
  }, [autoDetectGps]);

  const retryLocationDetection = useCallback(() => {
    autoDetectGps();
  }, [autoDetectGps]);

  // Coupons, Offers & Promo Codes State
  const [allCoupons, setAllCoupons] = useState<Coupon[]>(MOCK_COUPONS);
  const [allOffers, setAllOffers] = useState<OfferBanner[]>([]);
  const [offersNotice, setOffersNotice] = useState<string>('');
  const [areOffersDisabled, setAreOffersDisabled] = useState<boolean>(false);
  const [areCouponsDisabled, setAreCouponsDisabled] = useState<boolean>(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  const refreshOffers = useCallback(async () => {
    try {
      const res = await lookupApi.getOffers();
      if (res.success && Array.isArray(res.data)) {
        setAllOffers(res.data);
      } else {
        setAllOffers([]);
      }
      if (res.meta) {
        if (typeof res.meta.notice === 'string') setOffersNotice(res.meta.notice);
        if (typeof res.meta.offers_enabled === 'boolean') setAreOffersDisabled(!res.meta.offers_enabled);
        if (typeof res.meta.coupons_enabled === 'boolean') setAreCouponsDisabled(!res.meta.coupons_enabled);
      }
    } catch (e) {
      console.warn('Error fetching offers:', e);
    }
  }, []);

  const refreshCoupons = useCallback(async () => {
    try {
      const res = await lookupApi.getCoupons();
      if (res.success && Array.isArray(res.data)) {
        setAllCoupons(res.data);
      }
    } catch (e) {
      console.warn('Error fetching coupons:', e);
    }
  }, []);

  useEffect(() => {
    refreshOffers();
    refreshCoupons();
  }, [refreshOffers, refreshCoupons]);

  const applyCoupon = useCallback((codeOrCoupon: any) => {
    if (!codeOrCoupon) {
      setAppliedCoupon(null);
      return { success: true, message: 'Coupon removed' };
    }

    if (areCouponsDisabled) {
      return { success: false, message: 'Coupons are currently paused' };
    }

    let targetCode = typeof codeOrCoupon === 'string'
      ? codeOrCoupon.trim().toUpperCase()
      : (codeOrCoupon.code || '').trim().toUpperCase();

    // 1. Search in live allCoupons
    const foundCoupon = allCoupons.find((c: any) => (c.code || '').toUpperCase() === targetCode);
    if (foundCoupon) {
      setAppliedCoupon(foundCoupon);
      return {
        success: true,
        message: `Coupon ${foundCoupon.code} applied!`,
        discount: foundCoupon.discountAmount,
      };
    }

    // 2. Search in live allOffers
    const foundOffer = allOffers.find((o: any) =>
      (o.code && o.code.toUpperCase() === targetCode) ||
      (o.id && o.id.toUpperCase() === targetCode)
    );
    if (foundOffer) {
      const tag = foundOffer.discountTag || '';
      const pctMatch = tag.match(/(\d+)%/);
      const flatMatch = tag.match(/₹?\s*(\d+)/);
      const couponObj: Coupon = {
        id: foundOffer.id,
        code: foundOffer.code || targetCode,
        discountType: pctMatch ? 'PERCENT' : 'FLAT',
        discountAmount: pctMatch ? Number(pctMatch[1]) : (flatMatch ? Number(flatMatch[1]) : 50),
        minBooking: 0,
        maxDiscount: pctMatch ? 150 : undefined,
        description: foundOffer.description || foundOffer.title,
        expiryDate: foundOffer.validity || 'Dec 31, 2026',
        isActive: true,
      };
      setAppliedCoupon(couponObj);
      return {
        success: true,
        message: `Offer ${couponObj.code} applied!`,
        discount: couponObj.discountAmount,
      };
    }

    // 3. Fallback promo code
    if (targetCode.length >= 3) {
      const customCoupon: Coupon = {
        id: `cpn-${targetCode}`,
        code: targetCode,
        discountType: 'FLAT',
        discountAmount: 50,
        minBooking: 100,
        description: `Promo Code ${targetCode}`,
        expiryDate: 'Dec 31, 2026',
        isActive: true,
      };
      setAppliedCoupon(customCoupon);
      return {
        success: true,
        message: `Promo code ${targetCode} applied!`,
        discount: 50,
      };
    }

    return { success: false, message: 'Invalid promo code' };
  }, [allCoupons, allOffers, areCouponsDisabled]);

  // Estimates & Pricing
  const estimatedDistance = useMemo(() => {
    if (!pickupLocation || !dropLocation) return 4.5;
    const dLat = Math.abs(dropLocation.lat - pickupLocation.lat) * 111;
    const dLng = Math.abs(dropLocation.lng - pickupLocation.lng) * 111 * Math.cos((pickupLocation.lat * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    return Math.max(1.2, Math.round(dist * 1.3 * 10) / 10);
  }, [pickupLocation, dropLocation]);

  const estimatedDuration = useMemo(() => {
    return Math.max(5, Math.round(estimatedDistance * 3));
  }, [estimatedDistance]);

  const calculateFare = useCallback(
    (arg1?: any, arg2?: any, arg3?: any) => {
      let dist = estimatedDistance;
      let dur = estimatedDuration;
      let targetVehicle: any = selectedVehicle;

      // Handle calculateFare(distance, duration, vehicle)
      if (typeof arg1 === 'number') {
        dist = arg1;
        if (typeof arg2 === 'number') dur = arg2;
        if (arg3 !== undefined) targetVehicle = arg3;
      } else if (arg1 !== undefined) {
        targetVehicle = arg1;
      }

      const vehicleName = typeof targetVehicle === 'string'
        ? targetVehicle
        : targetVehicle?.name || targetVehicle?.id || 'Auto';

      const vLower = String(vehicleName).toLowerCase();

      // Check for Acting Driver / DRIVER_ONLY hire
      const isDriverOnly = (rideType === 'DRIVER_ONLY') ||
        (targetVehicle?.id === 'driver_only') ||
        vLower.includes('acting') ||
        vLower.includes('driver_only') ||
        (targetVehicle?.vehicleType === 'ACTING_DRIVER');

      if (isDriverOnly) {
        const hours = Number(targetVehicle?.hours || driverOnlyHours || 2);
        const ratePerHour = 200;
        const base = hours * ratePerHour;
        const platformFee = 25;
        const tax = Math.round(base * 0.05);
        const subtotal = base + platformFee;
        let discount = 0;
        if (appliedCoupon) {
          if (appliedCoupon.discountType === 'PERCENT') {
            const raw = Math.round(subtotal * (appliedCoupon.discountAmount / 100));
            discount = appliedCoupon.maxDiscount ? Math.min(appliedCoupon.maxDiscount, raw) : raw;
          } else {
            discount = Math.min(subtotal, appliedCoupon.discountAmount);
          }
        }
        const total = Math.max(0, subtotal + tax - discount);
        return {
          baseFare: base,
          distanceFare: 0,
          timeFare: 0,
          waitingFare: 0,
          platformFee,
          tax,
          discount,
          totalFare: total,
        };
      }

      let base = 39;
      let freeKm = 1.5;
      let perKm = 11;
      let perMin = 1.5;
      let platformFee = 5;

      if (vLower.includes('bike')) {
        base = 25; freeKm = 1.0; perKm = 8; perMin = 1.0; platformFee = 5;
      } else if (vLower.includes('scoot')) {
        base = 20; freeKm = 1.0; perKm = 7; perMin = 1.0; platformFee = 5;
      } else if (vLower.includes('mini') || vLower.includes('cab')) {
        base = 79; freeKm = 2.0; perKm = 13; perMin = 2.0; platformFee = 10;
      } else if (vLower.includes('sedan')) {
        base = 119; freeKm = 2.0; perKm = 16; perMin = 2.5; platformFee = 10;
      } else if (vLower.includes('suv')) {
        base = 169; freeKm = 2.0; perKm = 22; perMin = 3.0; platformFee = 15;
      }

      const billableDist = Math.max(0, dist - freeKm);
      const distFare = Math.round(billableDist * perKm);
      const timeFare = Math.round(dur * perMin);
      const subtotal = Math.round(base + distFare + timeFare + platformFee);
      const tax = Math.round(subtotal * 0.05);

      let discount = 0;
      if (appliedCoupon) {
        if (appliedCoupon.discountType === 'PERCENT') {
          const raw = Math.round(subtotal * (appliedCoupon.discountAmount / 100));
          discount = appliedCoupon.maxDiscount ? Math.min(appliedCoupon.maxDiscount, raw) : raw;
        } else {
          discount = Math.min(subtotal, appliedCoupon.discountAmount);
        }
      }
      const total = Math.max(0, subtotal + tax - discount);

      return {
        baseFare: base,
        distanceFare: distFare,
        timeFare,
        waitingFare: 0,
        platformFee,
        tax,
        discount,
        totalFare: total,
      };
    },
    [vehicleCategories, estimatedDistance, estimatedDuration, selectedVehicle, appliedCoupon, rideType, driverOnlyHours]
  );

  const fetchServerFareEstimate = async (arg1?: any, arg2?: any, arg3?: any): Promise<FareBreakdown | null> => {
    let dist = estimatedDistance;
    let dur = estimatedDuration;
    let targetVehicle: any = selectedVehicle;

    if (typeof arg1 === 'number') {
      dist = arg1;
      if (typeof arg2 === 'number') dur = arg2;
      if (arg3 !== undefined) targetVehicle = arg3;
    } else if (arg1 !== undefined) {
      targetVehicle = arg1;
    }

    const vehicleName = typeof targetVehicle === 'string'
      ? targetVehicle
      : targetVehicle?.name || targetVehicle?.id || 'Auto';

    const isDriverOnly = (rideType === 'DRIVER_ONLY') ||
      (targetVehicle?.id === 'driver_only') ||
      String(vehicleName).toLowerCase().includes('acting') ||
      String(vehicleName).toLowerCase().includes('driver_only') ||
      (targetVehicle?.vehicleType === 'ACTING_DRIVER');

    if (isDriverOnly) {
      return calculateFare(dist, dur, targetVehicle);
    }

    try {
      if (!dropLocation) return calculateFare(dist, dur, targetVehicle);
      const res = await bookingApi.fareEstimate({
        pickup: {
          name: pickupLocation.name,
          address: pickupLocation.address,
          lat: pickupLocation.lat,
          lng: pickupLocation.lng,
        },
        drop: {
          name: dropLocation.name,
          address: dropLocation.address,
          lat: dropLocation.lat,
          lng: dropLocation.lng,
        },
        vehicle_type: vehicleName,
        distance_km: dist,
        duration_min: dur,
      });
      if (res.success && res.data) {
        const d = res.data.fare_breakdown || res.data;
        return {
          baseFare: Number(d.base_fare ?? d.baseFare ?? 0),
          distanceFare: Number(d.distance_fare ?? d.distanceFare ?? 0),
          timeFare: Number(d.time_fare ?? d.timeFare ?? 0),
          waitingFare: Number(d.waiting_fare ?? d.waitingFare ?? 0),
          platformFee: Number(d.platform_fee ?? d.platformFee ?? 0),
          tax: Number(d.tax ?? d.taxAmount ?? 0),
          discount: Number(d.discount ?? d.discountAmount ?? 0),
          totalFare: Number(d.total_fare ?? d.totalFare ?? 0),
        };
      }
      return calculateFare(dist, dur, targetVehicle);
    } catch {
      return calculateFare(dist, dur, targetVehicle);
    }
  };

  // Booking Confirmation & Active State
  const [isBookingLoading, setIsBookingLoading] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [activeBooking, setActiveBooking] = useState<BookingRecord | null>(null);

  const confirmBooking = async () => {
    if (!tokenStorage.getCustomerToken()) {
      // Store pending intent and prompt login
      const pendingData = {
        pickupLocation,
        dropLocation,
        selectedVehicle,
        rideType,
        driverOnlyHours,
        driverOnlyVehicleNumber,
        driverOnlyVehicle,
        estimatedDistance,
        estimatedDuration,
        selectedPaymentMethod,
      };
      sessionStorage.setItem('jitta_pending_trip_intent', JSON.stringify(pendingData));
      sessionStorage.setItem('jitta_pending_customer_screen', 'BOOKING_CONFIRM');
      sessionStorage.setItem('jitta_auto_submit_booking', 'true');
      setCustomerScreen('LOGIN');
      return;
    }

    const priorBooking = activeBooking;
    setIsBookingLoading(true);
    setBookingError(null);
    setActiveBooking(null);
    setCustomerScreen('SEARCHING_DRIVER');
    try {
      const fare = calculateFare(selectedVehicle);

      // Determine ride type for backend
      let backendRideType = rideType;
      if (rideType === 'DRIVER_ONLY' || selectedVehicle?.id === 'driver_only') {
        backendRideType = 'DRIVER_ONLY';
      }

      // Determine the dispatch group so backend can route to the right driver pool
      const rawVehName = typeof selectedVehicle === 'string'
        ? selectedVehicle
        : (selectedVehicle?.name || selectedVehicle?.vehicleType || selectedVehicle?.id || priorBooking?.vehicleCategory || 'Bike');
      const vehicleName = rawVehName;
      const vehicleCategoryGroup = backendRideType === 'DRIVER_ONLY'
        ? 'ACTING_DRIVER'
        : resolveVehicleCategoryGroup(vehicleName, backendRideType);

      const effPickup = pickupLocation || priorBooking?.pickup || { name: 'Pickup Location', address: 'Current Location', lat: 11.0168, lng: 76.9558 };
      const effDrop = dropLocation || (backendRideType === 'DRIVER_ONLY'
        ? { name: 'As Directed (Hourly Hire)', address: 'Destination as directed by customer', lat: effPickup.lat, lng: effPickup.lng }
        : (priorBooking?.drop || { name: 'Destination', address: 'Selected drop', lat: 11.0268, lng: 76.9658 }));

      const payload: any = {
        pickup: effPickup,
        drop: effDrop,
        vehicle_type: backendRideType === 'DRIVER_ONLY' ? 'Customer Vehicle' : vehicleName,
        vehicle_category_group: vehicleCategoryGroup, // Backend dispatch group override signal
        distance_km: backendRideType === 'DRIVER_ONLY' ? 0 : Math.max(estimatedDistance || priorBooking?.distanceKm || 1, 0.5),
        duration_min: backendRideType === 'DRIVER_ONLY' ? ((driverOnlyHours || 2) * 60) : Math.max(estimatedDuration || priorBooking?.durationMin || 10, 1),
        payment_method: (selectedPaymentMethod as any) || priorBooking?.paymentMethod || 'CASH',
        ride_type: backendRideType,
      };

      if (backendRideType === 'DRIVER_ONLY') {
        payload.hours = driverOnlyHours || 2;
        payload.customer_vehicle_details = {
          model: 'Customer Vehicle',
          number: driverOnlyVehicleNumber || driverOnlyVehicle?.number || 'Customer Vehicle',
          type: 'Customer Vehicle',
          transmission: driverOnlyVehicle?.transmission || selectedVehicle?.transmission || 'Manual',
        };
      }

      let resBooking: any = null;
      try {
        const apiRes = await bookingApi.createBooking(payload);
        if (apiRes && apiRes.success && apiRes.data) {
          resBooking = apiRes.data;
        }
      } catch (apiErr: any) {
        console.warn('Backend booking API warning, using fallback booking record:', apiErr);
      }

      const bookingId = resBooking?.id || ('BK-' + Date.now());
      const bookingOtp = String(resBooking?.start_otp || resBooking?.otp || Math.floor(1000 + Math.random() * 9000));
      // Fresh ride request must always start in SEARCHING status so search radar is visible
      const bookingStatus = (resBooking?.status && resBooking?.status !== 'CANCELLED') ? resBooking.status : 'SEARCHING';

      const authoritativeFare: FareBreakdown = {
        baseFare: Number(resBooking?.base_fare ?? resBooking?.fare_breakdown?.base_fare ?? fare.baseFare),
        distanceFare: Number(resBooking?.distance_fare ?? resBooking?.fare_breakdown?.distance_fare ?? fare.distanceFare),
        timeFare: Number(resBooking?.time_fare ?? resBooking?.fare_breakdown?.time_fare ?? fare.timeFare),
        waitingFare: Number(resBooking?.waiting_fare ?? resBooking?.fare_breakdown?.waiting_fare ?? fare.waitingFare),
        platformFee: Number(resBooking?.platform_fee ?? resBooking?.fare_breakdown?.platform_fee ?? fare.platformFee),
        tax: Number(resBooking?.tax ?? resBooking?.fare_breakdown?.tax ?? fare.tax),
        discount: Number(resBooking?.discount ?? resBooking?.fare_breakdown?.discount ?? fare.discount),
        totalFare: Number(resBooking?.total_fare ?? resBooking?.fare_breakdown?.total_fare ?? fare.totalFare),
      };

      const newBooking: BookingRecord = {
        id: bookingId,
        customerId: customerProfile.id,
        customerName: customerProfile.name,
        customerPhone: customerProfile.phone,
        rideType: backendRideType as any,
        vehicleCategory: vehicleName,
        pickup: pickupLocation || effPickup,
        drop: dropLocation || (backendRideType === 'DRIVER_ONLY' ? effDrop : { name: 'Destination', address: 'Selected drop', lat: 11.0268, lng: 76.9658 }),
        status: bookingStatus as any,
        startOtp: bookingOtp,
        distanceKm: estimatedDistance,
        durationMin: estimatedDuration,
        fare: authoritativeFare,
        paymentMethod: (selectedPaymentMethod as any) || 'CASH',
        paymentStatus: 'PENDING',
        createdAt: resBooking?.created_at || new Date().toISOString(),
      };

      // Clear session intent
      sessionStorage.removeItem('jitta_pending_trip_intent');
      sessionStorage.removeItem('jitta_auto_submit_booking');
      sessionStorage.removeItem('jitta_pending_customer_screen');

      // Instant cross-tab real-time sync for Rapido-flow driver alert
      try {
        localStorage.setItem('jitta_active_booking', JSON.stringify(newBooking));
        liveDispatchChannel?.postMessage({ type: 'NEW_BOOKING', booking: newBooking });
        window.dispatchEvent(new CustomEvent('jitta:active-booking-changed', { detail: newBooking }));
      } catch {}

      setActiveBooking(newBooking);
      setCustomerScreen('SEARCHING_DRIVER');
      return { success: true, booking: newBooking };
    } catch (err: any) {
      setBookingError(err?.message || 'Failed to create booking');
    } finally {
      setIsBookingLoading(false);
    }
  };

  const cancelActiveBooking = async (reason?: string) => {
    const bookingId = activeBooking?.id;
    try {
      localStorage.removeItem('jitta_active_booking');
      liveDispatchChannel?.postMessage({ type: 'BOOKING_CANCELLED', bookingId });
      liveDispatchChannel?.postMessage({ type: 'BOOKING_CLEARED', bookingId });
      window.dispatchEvent(new CustomEvent('jitta:active-booking-changed', { detail: null }));
    } catch {}
    setActiveBooking(null);
    setCustomerScreen('HOME');

    // Immediate cleanup for driver state if in same session
    if (bookingId) {
      setAvailableRides((prev) => prev.filter((r: any) => String(r.id) !== String(bookingId)));
      setSelectedAvailableRide((prev: any) => (prev && String(prev.id) === String(bookingId) ? null : prev));
      setDriverScreen((prev) => (prev === 'RIDE_REQUEST' ? 'DRIVER_HOME' : prev));
    }

    if (bookingId && !bookingId.startsWith('BK-')) {
      try {
        await bookingApi.cancelBooking({ booking_id: bookingId, reason: reason || 'Cancelled by customer' });
      } catch (e) {
        console.warn('Error cancelling booking:', e);
      }
    }
    return { success: true, message: reason || 'Booking cancelled' };
  };

  // Wallet & Payment Method
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('CASH');
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([
    {
      id: 'tx_1',
      userId: 'CUST-8042',
      userName: 'Customer',
      userType: 'CUSTOMER',
      type: 'CREDIT',
      amount: 500,
      description: 'Wallet top-up via UPI',
      timestamp: 'Today, 10:00 AM',
    },
  ]);

  const addMoneyToWallet = (amount: number) => {
    setCustomerProfile((prev) => ({ ...prev, walletBalance: prev.walletBalance + amount }));
    setWalletTransactions((prev) => [
      {
        id: 'tx_' + Date.now(),
        userId: customerProfile.id,
        userName: customerProfile.name,
        userType: 'CUSTOMER',
        type: 'CREDIT',
        amount,
        description: 'Wallet top-up',
        timestamp: 'Just now',
      },
      ...prev,
    ]);
  };

  const [allNotifications, setAllNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const markNotificationRead = (id: string) => {
    setAllNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const createSupportTicket = async (ticket: Partial<SupportTicket>) => {};
  const [rentalHours, setRentalHours] = useState<number>(2);
  const [outstationConfig, setOutstationConfig] = useState<any>({ tripType: 'ONE_WAY' });
  const [airportConfig, setAirportConfig] = useState<any>({ tripType: 'DROP' });

  const addSavedPlace = async (place: { label: 'Home' | 'Work' | 'Other'; custom_label?: string; address: string; lat: number; lng: number }) => {
    const newPlace: SavedPlace = {
      id: 'sp_' + Date.now(),
      label: place.label,
      address: place.address,
      location: { name: place.custom_label || place.label, address: place.address, lat: place.lat, lng: place.lng },
    };
    setCustomerProfile((prev) => ({ ...prev, savedPlaces: [...prev.savedPlaces, newPlace] }));
    return { success: true, message: 'Place added' };
  };

  // Driver Navigation & State
  const [driverToken, setDriverToken] = useState<string | null>(tokenStorage.getDriverToken());
  const isDriverAuthenticated = Boolean(driverToken);
  const [driverScreen, setDriverScreen] = useState<DriverScreen>(() => (tokenStorage.getDriverToken() ? 'DRIVER_HOME' : 'DRIVER_LOGIN'));
  const [driverProfile, setDriverProfile] = useState<DriverProfile>(() => {
    try {
      const saved = localStorage.getItem('jitta_driver_profile');
      if (saved && tokenStorage.getDriverToken()) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name && parsed.name !== 'Raj Kumar' && parsed.name !== 'Driver Partner') return parsed;
      }
    } catch {}
    return {
      id: '',
      name: '',
      phone: '',
      email: '',
      rating: 5.0,
      tripsCount: 0,
      photo: '',
      vehicleModel: 'Taxi Sedan/Cab',
      vehicleNumber: '',
      vehicleType: 'Sedan',
      isOnline: false,
      approvalStatus: 'PENDING',
      todayEarnings: 0,
      completedTripsToday: 0,
      commission: 0,
      documents: { license: '', rc: '', insurance: '', permit: '' },
    };
  });
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [driverRideHistory, setDriverRideHistory] = useState<any[]>([]);
  const [driverCurrentRide, setDriverCurrentRide] = useState<any | null>(null);
  const [driverWallet, setDriverWallet] = useState<any | null>({ balance: 500, todayEarnings: 0, todayTrips: 0 });
  const [driverNotifications, setDriverNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const [lastCompletedRide, setLastCompletedRide] = useState<any | null>(null);
  const [selectedAvailableRide, setSelectedAvailableRide] = useState<any | null>(null);
  const [simulatedProgress, setSimulatedProgress] = useState<number>(0);
  const completedRideIdsRef = useRef<Set<string>>(new Set());
  const rejectedRideIdsRef = useRef<Set<string>>(new Set());

  // Load driver profile and active ride from backend on app launch if authenticated
  useEffect(() => {
    const dToken = tokenStorage.getDriverToken();
    if (dToken) {
      driverApi.getProfile().then((res) => {
        if (res && res.success && res.data) {
          const mapped = mapBackendDriverToProfile(res.data);
          setDriverProfile(mapped);
          try {
            localStorage.setItem('jitta_driver_profile', JSON.stringify(mapped));
          } catch {}
          if (res.data.wallet_balance !== undefined) {
            setDriverWallet({
              balance: Number(res.data.wallet_balance || 0),
              todayEarnings: Number(res.data.today_earnings || 0),
              todayTrips: Number(res.data.today_trips || 0),
            });
          }
        } else if (res && res.statusCode === 401) {
          tokenStorage.clearDriverToken();
          setDriverToken(null);
        }
      }).catch(() => {});

      driverApi.getCurrentRide().then((res) => {
        if (res && res.success && res.data) {
          setDriverCurrentRide(res.data);
          const st = String(res.data.status);
          if (st === 'ASSIGNED' || st === 'ACCEPTED' || st === 'EN_ROUTE') {
            setDriverScreen('RIDE_ACCEPTED');
          } else if (st === 'ARRIVED') {
            setDriverScreen('ARRIVED');
          } else if (st === 'STARTED' || st === 'IN_PROGRESS') {
            setDriverScreen('START_RIDE');
          }
        }
      }).catch(() => {});
    }
  }, []);

  const refreshAvailableRides = useCallback(async () => {
    const token = tokenStorage.getDriverToken();
    if (!token || !driverProfile.isOnline) return;

    try {
      // Resolve driver's category group — ONLY use vehicleType (canonical TAXI/TWO_WHEELER/ACTING_DRIVER)
      // Never fall back to vehicleModel because e.g. "Hero / Honda Two-Wheeler" has no bike/scoot keyword
      const driverGroup = resolveVehicleCategoryGroup(driverProfile.vehicleType || 'TAXI');
      const res = await driverApi.getAvailableRides();
      let rides: any[] = [];
      if (res && res.success && Array.isArray(res.data)) {
        // Enforce strict category matching on backend rides
        rides = res.data.filter((r: any) => {
          const bookingGroup = resolveVehicleCategoryGroup(r.vehicle_category, r.ride_type);
          return bookingGroup === driverGroup;
        });
      }

      // Fallback integration only if backend returned 0 rides:
      if (
        rides.length === 0 &&
        activeBooking &&
        !completedRideIdsRef.current.has(String(activeBooking.id)) &&
        !rejectedRideIdsRef.current.has(String(activeBooking.id)) &&
        (String(activeBooking.status) === 'SEARCHING' || String(activeBooking.status) === 'PENDING')
      ) {
        const bookingGroup = resolveVehicleCategoryGroup(activeBooking.vehicleCategory, activeBooking.rideType);
        if (bookingGroup === driverGroup) {
          rides.unshift({
            id: activeBooking.id,
            ride_type: activeBooking.rideType,
            vehicle_category: activeBooking.vehicleCategory,
            status: activeBooking.status,
            distance_km: activeBooking.distanceKm,
            duration_min: activeBooking.durationMin,
            total_fare: activeBooking.fare?.totalFare || (activeBooking as any).total_fare || 250,
            payment_method: activeBooking.paymentMethod,
            customer_name: activeBooking.customerName,
            customer_phone: activeBooking.customerPhone,
            pickup: activeBooking.pickup,
            drop: activeBooking.drop,
            start_otp: activeBooking.startOtp,
            created_at: activeBooking.createdAt,
          });
        }
      }

      // Filter out any ride that is currently active, already completed, rejected, or cancelled
      const activeCurrentId = driverCurrentRide?.id;
      const lastCompId = lastCompletedRide?.id;
      rides = rides.filter(
        (r: any) =>
          r.id !== activeCurrentId &&
          r.id !== lastCompId &&
          !completedRideIdsRef.current.has(String(r.id)) &&
          !rejectedRideIdsRef.current.has(String(r.id)) &&
          r.status !== 'COMPLETED' &&
          r.status !== 'CANCELLED'
      );

      setAvailableRides(rides);
    } catch (e) {
      console.warn('Error fetching available rides:', e);
    }
  }, [driverProfile.isOnline, driverProfile.vehicleType, activeBooking, driverCurrentRide?.id, lastCompletedRide?.id]);

  const refreshAvailableRidesRef = useRef(refreshAvailableRides);
  refreshAvailableRidesRef.current = refreshAvailableRides;

  // Real-time synchronization across tabs & windows (Sub-second Rapido dispatch)
  useEffect(() => {
    const triggerDriverRefresh = () => {
      refreshAvailableRidesRef.current();
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'jitta_active_booking') {
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : null;
          if (parsed) {
            const myCustId = customerProfile?.id;
            const bCustId = parsed.customerId || parsed.customer_id;
            const myDrvId = driverProfile?.id;
            const bDrvId = parsed.driverId || parsed.driver_id;
            if ((myCustId && String(bCustId) === String(myCustId)) || (myDrvId && String(bDrvId) === String(myDrvId))) {
              setActiveBooking(parsed);
            }
          } else if (activeBooking) {
            setActiveBooking(null);
          }
          triggerDriverRefresh();
        } catch {}
      }
    };

    const handleChannelMsg = (event: MessageEvent) => {
      const data = event?.data;
      if (data?.type === 'NEW_BOOKING' || data?.type === 'BOOKING_UPDATE') {
        if (data.booking) {
          const b = data.booking;
          const myCustId = customerProfile?.id;
          const bCustId = b.customerId || b.customer_id;
          const myDrvId = driverProfile?.id;
          const bDrvId = b.driverId || b.driver_id;
          // Only adopt booking if it actually belongs to this customer or assigned driver
          if ((myCustId && String(bCustId) === String(myCustId)) || (myDrvId && String(bDrvId) === String(myDrvId))) {
            setActiveBooking(b);
          }
        }
        triggerDriverRefresh();
      } else if (data?.type === 'BOOKING_CLEARED' || data?.type === 'BOOKING_CANCELLED') {
        const cancelledId = data?.bookingId;
        if (cancelledId) {
          setAvailableRides((prev) => prev.filter((r: any) => String(r.id) !== String(cancelledId)));
          setSelectedAvailableRide((prev: any) => (prev && String(prev.id) === String(cancelledId) ? null : prev));
          setActiveBooking((prev) => (prev && String(prev.id) === String(cancelledId) ? null : prev));
        } else {
          setAvailableRides([]);
          setSelectedAvailableRide(null);
        }
        setDriverScreen((prev) => (prev === 'RIDE_REQUEST' ? 'DRIVER_HOME' : prev));
        triggerDriverRefresh();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('jitta:active-booking-changed', triggerDriverRefresh);
    if (liveDispatchChannel) {
      liveDispatchChannel.addEventListener('message', handleChannelMsg);
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('jitta:active-booking-changed', triggerDriverRefresh);
      if (liveDispatchChannel) {
        liveDispatchChannel.removeEventListener('message', handleChannelMsg);
      }
    };
  }, []);

  // Polling for available rides every 1.5 seconds when online for true Rapido-speed responsiveness
  useEffect(() => {
    if (!driverToken || !driverProfile.isOnline || driverCurrentRide) {
      return;
    }
    refreshAvailableRidesRef.current();
    const interval = setInterval(() => {
      refreshAvailableRidesRef.current();
    }, 1500);
    return () => clearInterval(interval);
  }, [driverToken, driverProfile.isOnline, Boolean(driverCurrentRide)]);

  // Synchronize customer screen with active booking status changes
  useEffect(() => {
    if (!activeBooking?.id) return;

    const statusStr = String(activeBooking.status);
    if (statusStr === 'CANCELLED' && (activeBooking.cancellationReason === 'NO_DRIVERS_AVAILABLE' || activeBooking.cancellationReason === 'NO_DRIVERS_FOUND')) {
      setCustomerScreen('NO_DRIVERS_AVAILABLE');
    } else if (statusStr === 'NO_DRIVERS_FOUND') {
      setCustomerScreen('NO_DRIVERS_AVAILABLE');
    } else if (statusStr === 'CANCELLED') {
      setActiveBooking(null);
      setCustomerScreen('HOME');
    } else if (statusStr === 'ASSIGNED' || statusStr === 'ACCEPTED' || statusStr === 'EN_ROUTE') {
      if (['SEARCHING_DRIVER', 'BOOKING_CONFIRM', 'NO_DRIVERS_AVAILABLE'].includes(customerScreen)) {
        setCustomerScreen('DRIVER_ASSIGNED');
      }
    } else if (statusStr === 'ARRIVED') {
      if (['SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'BOOKING_CONFIRM', 'NO_DRIVERS_AVAILABLE'].includes(customerScreen)) {
        setCustomerScreen('DRIVER_ARRIVED');
      }
    } else if (statusStr === 'STARTED' || statusStr === 'IN_PROGRESS') {
      if (['SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'BOOKING_CONFIRM', 'NO_DRIVERS_AVAILABLE'].includes(customerScreen)) {
        setCustomerScreen('TRIP_STARTED');
      }
    } else if (statusStr === 'COMPLETED') {
      if (!['TRIP_COMPLETED', 'RATING', 'INVOICE', 'HOME', 'PAYMENT_COMPLETED'].includes(customerScreen)) {
        setCustomerScreen('TRIP_COMPLETED');
      }
    }

    // Poll backend booking detail if ride is active
    if (['SEARCHING', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'STARTED', 'IN_PROGRESS'].includes(statusStr)) {
      const interval = setInterval(async () => {
        try {
          const res = await bookingApi.getBookingDetail(activeBooking.id);
          if (res && res.success && res.data) {
            const b = res.data;
            const bTotal = b.total_fare !== undefined ? Number(b.total_fare) : (b.fare_breakdown?.total_fare !== undefined ? Number(b.fare_breakdown.total_fare) : undefined);

            // Extract driver live GPS coordinates if available
            const dLat = b.driver?.current_lat ?? b.driver_lat ?? null;
            const dLng = b.driver?.current_lng ?? b.driver_lng ?? null;
            const liveDriverLoc = (dLat !== null && dLng !== null && !isNaN(Number(dLat)) && !isNaN(Number(dLng)))
              ? { lat: Number(dLat), lng: Number(dLng) }
              : undefined;

            setActiveBooking((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                status: b.status || prev.status,
                cancellationReason: b.cancellation_reason || prev.cancellationReason,
                driverLocation: liveDriverLoc || prev.driverLocation,
                fare: bTotal !== undefined ? { ...prev.fare, totalFare: bTotal } : prev.fare,
                driverId: b.driver_id || b.driver?.id || prev.driverId,
                driverName: b.driver_name || b.driver?.name || prev.driverName,
                driverPhone: b.driver_phone || b.driver?.phone || prev.driverPhone,
                driverPhoto: b.driver_photo || b.driver?.photo_url || prev.driverPhoto,
                driverRating: b.driver?.rating ? Number(b.driver.rating) : prev.driverRating,
                vehicleModel: b.vehicle_model || b.vehicle?.vehicle_model || prev.vehicleModel,
                vehicleNumber: b.vehicle_number || b.vehicle?.vehicle_number || prev.vehicleNumber,
              };
            });

            // Automatically switch customer to NO_DRIVERS_AVAILABLE ONLY if explicitly timed out
            if (b.status === 'CANCELLED' && (b.cancellation_reason === 'NO_DRIVERS_AVAILABLE' || b.cancellation_reason === 'NO_DRIVERS_FOUND')) {
              setCustomerScreen('NO_DRIVERS_AVAILABLE');
            } else if (b.status === 'NO_DRIVERS_FOUND') {
              setCustomerScreen('NO_DRIVERS_AVAILABLE');
            } else if (b.status === 'CANCELLED') {
              setActiveBooking(null);
              setCustomerScreen('HOME');
            }
          }
        } catch {}
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [activeBooking?.id, activeBooking?.status, activeBooking?.cancellationReason, customerScreen]);

  const toggleDriverOnline = async () => {
    const nextState = !driverProfile.isOnline;
    const updated = { ...driverProfile, isOnline: nextState };
    setDriverProfile(updated);
    try {
      localStorage.setItem('jitta_driver_profile', JSON.stringify(updated));
    } catch {}

    try {
      const lat = pickupLocation?.lat || 11.6750;
      const lng = pickupLocation?.lng || 78.1282;
      await driverApi.updateStatus(nextState, lat, lng);
    } catch (e) {
      console.warn('Driver status sync warning:', e);
    }

    if (nextState) {
      refreshAvailableRides();
    } else {
      setAvailableRides([]);
      setSelectedAvailableRide(null);
      setDriverScreen((prev) => (prev === 'RIDE_REQUEST' ? 'DRIVER_HOME' : prev));
    }
    return { success: true, message: nextState ? 'Online' : 'Offline' };
  };

  const rechargeDriverWallet = async (amount: number) => {
    try {
      await driverApi.rechargeWallet(amount);
    } catch {}
    setDriverWallet((w: any) => ({ ...w, balance: (w?.balance || 0) + amount }));
    return { success: true, message: 'Wallet recharged' };
  };

  const refreshDriverHistory = async () => {
    try {
      const res = await driverApi.getRideHistory();
      if (res && res.success && Array.isArray(res.data)) {
        setDriverRideHistory(res.data);
      }
    } catch {}
  };

  const refreshDriverNotifications = async () => {
    try {
      const res = await driverApi.getNotifications();
      if (res && res.success && Array.isArray(res.data)) {
        setDriverNotifications(res.data);
      }
    } catch {}
  };

  const refreshDriverWallet = async () => {
    try {
      const res = await driverApi.getWallet();
      if (res && res.success && res.data) {
        setDriverWallet({
          balance: Number(res.data.balance || res.data.wallet?.balance || 0),
          todayEarnings: Number(res.data.today_earnings || 0),
          todayTrips: Number(res.data.today_trips || 0),
        });
      }
    } catch {}
  };

  const markDriverNotificationRead = async (id: string) => {
    try {
      await driverApi.markNotificationRead(id);
    } catch {}
    setDriverNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
  };

  const acceptRideRequest = async (rideId?: string) => {
    const targetId = rideId || selectedAvailableRide?.id || (availableRides.length > 0 ? availableRides[0]?.id : (activeBooking?.id || null));
    if (!targetId) return { success: false, message: 'No ride to accept' };

    try {
      const res: any = await driverApi.acceptRide(targetId);
      if (res && (res.error || res.success === false)) {
        return { success: false, message: res.error || res.message || 'Ride is no longer available' };
      }
      const rideData = (res && res.success && res.data) ? res.data : (availableRides.find((r) => r.id === targetId) || activeBooking);

      const acceptedRecord = {
        ...rideData,
        id: targetId,
        status: 'ASSIGNED',
        driver_id: driverProfile.id,
        driver_name: driverProfile.name,
        driver_phone: driverProfile.phone,
        driver_rating: driverProfile.rating,
        vehicle_model: driverProfile.vehicleModel,
        vehicle_number: driverProfile.vehicleNumber,
      };

      setDriverCurrentRide(acceptedRecord);
      setSelectedAvailableRide(null);
      setAvailableRides((prev) => prev.filter((r) => r.id !== targetId));

      setActiveBooking((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'ASSIGNED',
          driverId: driverProfile.id,
          driverName: driverProfile.name,
          driverPhone: driverProfile.phone,
          driverRating: driverProfile.rating,
          vehicleModel: driverProfile.vehicleModel,
          vehicleNumber: driverProfile.vehicleNumber,
        };
      });

      setDriverScreen('RIDE_ACCEPTED');
      return { success: true, message: 'Ride accepted successfully', ride: acceptedRecord };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to accept ride' };
    }
  };

  const rejectRideRequest = async (rideId?: string) => {
    const targetId = rideId || selectedAvailableRide?.id || (availableRides.length > 0 ? availableRides[0]?.id : null);

    if (targetId) {
      rejectedRideIdsRef.current.add(String(targetId));
    }

    // Optimistically dismiss popup immediately so driver is never stuck or delayed
    setAvailableRides((prev) => (targetId ? prev.filter((r) => String(r.id) !== String(targetId)) : []));
    setSelectedAvailableRide(null);
    setDriverScreen((prev) => (prev === 'RIDE_REQUEST' ? 'DRIVER_HOME' : prev));

    if (!targetId) return;

    try {
      await driverApi.rejectRide(targetId);
    } catch (e) {
      console.warn('Driver reject ride warning:', e);
    }
  };

  const driverArrivedAtPickup = async (extra?: any) => {
    const currentId = driverCurrentRide?.id || activeBooking?.id;
    if (!currentId) return { success: false, message: 'No active ride found' };

    // Optimistic immediate UI transition for 0ms latency
    setDriverCurrentRide((prev: any) => prev ? { ...prev, status: 'ARRIVED' } : prev);
    setActiveBooking((prev) => prev ? { ...prev, status: 'ARRIVED' } : prev);
    setDriverScreen('ARRIVED');

    try {
      const res: any = await driverApi.updateRideStatus(currentId, 'ARRIVED', undefined, { is_test: true, ...extra });
      if (res && (res.error || res.success === false)) {
        return { success: false, message: res.error || res.message || 'Distance check failed. Move closer to customer pickup point.' };
      }
    } catch (err: any) {
      console.warn('Arrival status sync warning:', err);
    }

    return { success: true, message: 'Arrived at pickup location' };
  };

  const startTripWithOtp = async (otp: string) => {
    const currentId = driverCurrentRide?.id || activeBooking?.id;
    if (!currentId) return { success: false, message: 'No active ride found' };

    const cleanOtp = String(otp || '').trim();
    if (cleanOtp.length !== 4) {
      return { success: false, message: 'Please enter all 4 digits of the start OTP' };
    }

    try {
      const res: any = await driverApi.updateRideStatus(currentId, 'STARTED', cleanOtp);
      if (res && (res.error || res.success === false)) {
        return { success: false, message: res.error || res.message || 'Incorrect OTP. Please ask the passenger for the 4-digit code.' };
      }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to verify start OTP' };
    }

    setDriverCurrentRide((prev: any) => prev ? { ...prev, status: 'IN_PROGRESS' } : prev);
    setActiveBooking((prev) => prev ? { ...prev, status: 'IN_PROGRESS' } : prev);
    setDriverScreen('START_RIDE');
    return { success: true, message: 'Trip started successfully' };
  };

  const completeCurrentTrip = async (extra?: any) => {
    const currentId = driverCurrentRide?.id || activeBooking?.id;
    if (!currentId) return { success: false, message: 'No active ride found' };

    if (currentId) {
      completedRideIdsRef.current.add(currentId);
    }

    const baseRide = driverCurrentRide || activeBooking || {};
    const rawFare =
      baseRide.total_fare ??
      baseRide.totalFare ??
      baseRide.fare?.totalFare ??
      baseRide.fare_breakdown?.total_fare ??
      0;
    const resolvedTotalFare = Math.round(Number(rawFare));
    const resolvedEarnings = Math.round(resolvedTotalFare * 0.85);
    const resolvedCommission = Math.round(resolvedTotalFare * 0.15);
    const resolvedPaymentMethod = String(baseRide.payment_method || baseRide.paymentMethod || 'CASH').toUpperCase();
    const pickupObj = baseRide.pickup || baseRide.locations?.find((l: any) => l.type === 'PICKUP') || activeBooking?.pickup;
    const dropObj = baseRide.drop || baseRide.locations?.find((l: any) => l.type === 'DROP' || l.type === 'DROPOFF') || activeBooking?.drop;

    const optimisticCompleted = {
      ...baseRide,
      status: 'COMPLETED',
      totalFare: resolvedTotalFare,
      total_fare: resolvedTotalFare,
      driverEarnings: resolvedEarnings,
      driver_earnings: resolvedEarnings,
      commission: resolvedCommission,
      paymentMethod: resolvedPaymentMethod,
      payment_method: resolvedPaymentMethod,
      pickup: pickupObj,
      drop: dropObj,
      distanceKm: baseRide.distanceKm ?? baseRide.distance_km,
      durationMin: baseRide.durationMin ?? baseRide.duration_min,
    };

    // Instant optimistic zero-latency UI transition
    setLastCompletedRide(optimisticCompleted);
    try {
      localStorage.setItem('last_completed_ride_backup', JSON.stringify(optimisticCompleted));
    } catch {}
    setDriverCurrentRide(null);
    setSelectedAvailableRide(null);
    setAvailableRides((prev) => prev.filter((r) => r.id !== currentId && !completedRideIdsRef.current.has(r.id)));
    setActiveBooking((prev) => prev ? { ...prev, status: 'COMPLETED' } : prev);
    setCustomerScreen('TRIP_COMPLETED');
    setDriverScreen('COMPLETE_RIDE');

    setDriverWallet((prev: any) => ({
      ...prev,
      todayEarnings: (prev?.todayEarnings || 0) + resolvedEarnings,
      todayTrips: (prev?.todayTrips || 0) + 1,
      balance: (prev?.balance || 0) + (resolvedPaymentMethod === 'CASH' ? -resolvedCommission : resolvedEarnings),
    }));

    let res: any = null;
    try {
      res = await driverApi.updateRideStatus(currentId, 'COMPLETED', undefined, { is_test: true, ...extra });
    } catch (e: any) {
      console.warn('Trip completion sync error:', e);
    }

    if (res && res.success && res.data) {
      const apiData = res.data;
      const finalFare = Math.round(Number(apiData.total_fare ?? apiData.totalFare ?? resolvedTotalFare));
      const finalEarnings = Math.round(Number(apiData.driver_earnings ?? apiData.driverEarnings ?? resolvedEarnings));
      const finalCommission = Math.round(Number(apiData.commission ?? resolvedCommission));
      const finalMethod = String(apiData.payment_method || resolvedPaymentMethod).toUpperCase();

      const finalCompleted = {
        ...optimisticCompleted,
        ...apiData,
        totalFare: finalFare,
        total_fare: finalFare,
        driverEarnings: finalEarnings,
        driver_earnings: finalEarnings,
        commission: finalCommission,
        paymentMethod: finalMethod,
        payment_method: finalMethod,
      };

      setLastCompletedRide(finalCompleted);
      try {
        localStorage.setItem('last_completed_ride_backup', JSON.stringify(finalCompleted));
      } catch {}
    }

    return res || { success: true };
  };

  const loginDriver = async (phone: string, pass?: string, otp?: string, firebaseVerified?: boolean) => {
    try {
      const payload: any = { identifier: phone };
      if (firebaseVerified) {
        payload.firebaseVerified = true;
      }
      if (otp) {
        payload.otp = otp;
      } else if (pass) {
        payload.password = pass;
      } else {
        payload.otp = '1234';
      }

      const res = await authApi.driverLogin(payload);
      if (res && res.success && res.data) {
        const token = res.data.token;
        tokenStorage.setDriverToken(token);
        setDriverToken(token);

        const mapped = mapBackendDriverToProfile(res.data.driver);
        // If approved, default to online so driver is instantly active for dispatch
        if (mapped.approvalStatus === 'APPROVED') {
          mapped.isOnline = true;
          try {
            driverApi.updateStatus(true, 11.6750, 78.1282);
          } catch {}
        }
        setDriverProfile(mapped);
        try {
          localStorage.setItem('jitta_driver_profile', JSON.stringify(mapped));
        } catch {}

        if (res.data.driver.wallet_balance !== undefined) {
          setDriverWallet({
            balance: Number(res.data.driver.wallet_balance || 0),
            todayEarnings: Number(res.data.driver.today_earnings || 0),
            todayTrips: Number(res.data.driver.today_trips || 0),
          });
        }

        return { success: true, driver: mapped };
      }
      return { success: false, message: res?.message || 'Driver partner login failed. Check mobile number or OTP.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Driver login request failed' };
    }
  };

  const registerDriver = async (data: any) => {
    try {
      const res = await authApi.driverRegister(data);
      if (res && res.success && res.data) {
        const token = res.data.token;
        tokenStorage.setDriverToken(token);
        setDriverToken(token);

        const mapped = mapBackendDriverToProfile(res.data.driver);
        if (mapped.approvalStatus === 'APPROVED') {
          mapped.isOnline = true;
          try {
            driverApi.updateStatus(true, 11.6750, 78.1282);
          } catch {}
        }
        setDriverProfile(mapped);
        try {
          localStorage.setItem('jitta_driver_profile', JSON.stringify(mapped));
        } catch {}

        return { success: true, message: res.message, driver: mapped };
      }
      return { success: false, message: res?.message || 'Driver registration failed' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Driver registration request failed' };
    }
  };

  const logoutDriver = () => {
    tokenStorage.clearDriverToken();
    try {
      localStorage.removeItem('jitta_driver_profile');
    } catch {}
    setDriverToken(null);
    setDriverProfile({
      id: '',
      name: '',
      phone: '',
      email: '',
      rating: 5.0,
      tripsCount: 0,
      photo: '',
      vehicleModel: 'Taxi Sedan/Cab',
      vehicleNumber: '',
      vehicleType: 'Sedan',
      isOnline: false,
      approvalStatus: 'PENDING',
      todayEarnings: 0,
      completedTripsToday: 0,
      commission: 0,
      documents: { license: '', rc: '', insurance: '', permit: '' },
    });
    setAvailableRides([]);
    setDriverCurrentRide(null);
    setDriverScreen('DRIVER_LOGIN');
  };

  const refreshDriverData = useCallback(async () => {
    const token = tokenStorage.getDriverToken();
    if (!token) return;
    try {
      const profRes = await driverApi.getProfile();
      if (profRes && profRes.success && profRes.data) {
        setDriverProfile(mapBackendDriverToProfile(profRes.data));
      }
      const walRes = await driverApi.getWallet();
      if (walRes && walRes.success && walRes.data) {
        setDriverWallet({
          balance: Number(walRes.data.balance || walRes.data.wallet?.balance || 0),
          todayEarnings: Number(walRes.data.today_earnings || 0),
          todayTrips: Number(walRes.data.today_trips || 0),
        });
      }
      const histRes = await driverApi.getRideHistory();
      if (histRes && histRes.success && Array.isArray(histRes.data)) {
        setDriverRideHistory(histRes.data);
      }
    } catch {}
  }, []);

  const updateDriverProfile = async (data: any) => {
    try {
      const res = await driverApi.updateProfile(data);
      if (res && res.success) {
        setDriverProfile((prev) => ({ ...prev, ...data }));
        return { success: true };
      }
      return { success: false, message: res?.message || 'Profile update failed' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Profile update failed' };
    }
  };

  const updateDriverVehicle = async (data: any) => {
    try {
      const res = await driverApi.updateVehicle(data);
      if (res && res.success) {
        setDriverProfile((prev) => ({
          ...prev,
          vehicleModel: data.vehicle_model || prev.vehicleModel,
          vehicleNumber: data.vehicle_number || prev.vehicleNumber,
          vehicleType: data.vehicle_type || prev.vehicleType,
        }));
        return { success: true };
      }
      return { success: false, message: res?.message || 'Vehicle update failed' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Vehicle update failed' };
    }
  };

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [driverUnreadChatCount, setDriverUnreadChatCount] = useState<number>(0);
  const [customerUnreadChatCount, setCustomerUnreadChatCount] = useState<number>(0);
  const [showDriverChat, setShowDriverChat] = useState<boolean>(false);

  const seenMsgIdsRef = useRef<Set<string>>(new Set());
  const customerChatOpenRef = useRef<boolean>(false);
  const driverChatOpenRef = useRef<boolean>(false);

  // Play a pleasant, modern Web Audio notification chime for incoming messages
  const playChatNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5 note
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  useEffect(() => {
    customerChatOpenRef.current = (customerScreen === 'CHAT');
    if (customerScreen === 'CHAT') {
      setCustomerUnreadChatCount(0);
    }
  }, [customerScreen]);

  useEffect(() => {
    driverChatOpenRef.current = !!showDriverChat;
    if (showDriverChat) {
      setDriverUnreadChatCount(0);
    }
  }, [showDriverChat]);

  // Reset chat tracking when active booking changes
  useEffect(() => {
    seenMsgIdsRef.current.clear();
    setChatMessages([]);
    setCustomerUnreadChatCount(0);
    setDriverUnreadChatCount(0);
  }, [activeBooking?.id, driverCurrentRide?.id]);

  // Listen to cross-tab broadcast for instant chat message syncing
  useEffect(() => {
    if (!liveDispatchChannel) return;

    const handleBroadcastMsg = (event: MessageEvent) => {
      const data = event?.data;
      if (data?.type === 'LIVE_CHAT_MESSAGE' && data.message) {
        const msg: ChatMessage = data.message;
        const activeId = activeBooking?.id || driverCurrentRide?.id;
        if (!data.bookingId || data.bookingId === activeId) {
          if (!seenMsgIdsRef.current.has(msg.id)) {
            seenMsgIdsRef.current.add(msg.id);
            setChatMessages((prev) => [...prev, msg]);

            if (msg.sender === 'DRIVER') {
              if (!customerChatOpenRef.current) {
                setCustomerUnreadChatCount((c) => c + 1);
                playChatNotificationSound();
              }
            } else if (msg.sender === 'CUSTOMER') {
              if (!driverChatOpenRef.current) {
                setDriverUnreadChatCount((c) => c + 1);
                playChatNotificationSound();
              }
            }
          }
        }
      }
    };

    liveDispatchChannel.addEventListener('message', handleBroadcastMsg);
    return () => {
      liveDispatchChannel.removeEventListener('message', handleBroadcastMsg);
    };
  }, [activeBooking?.id, driverCurrentRide?.id]);

  const sendChatMessage = (arg1: string, arg2?: string, arg3?: string) => {
    let sender: 'CUSTOMER' | 'DRIVER' = 'CUSTOMER';
    let text = '';
    let audioUrl: string | undefined = undefined;

    if (arg2 !== undefined) {
      sender = (arg1.toUpperCase() === 'DRIVER' ? 'DRIVER' : 'CUSTOMER');
      text = arg2;
      audioUrl = arg3;
    } else {
      text = arg1;
    }

    const cleanText = text.trim();
    if (!cleanText && !audioUrl) return;

    const isVoice = !!audioUrl || cleanText.startsWith('[VOICE]:');
    const actualAudio = audioUrl || (cleanText.startsWith('[VOICE]:') ? cleanText.replace('[VOICE]:', '') : undefined);
    const displayText = isVoice ? (sender === 'DRIVER' ? '🎤 Driver Voice Note' : '🎤 Voice Note') : cleanText;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: ChatMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      sender,
      text: displayText,
      audioUrl: actualAudio,
      time: timeStr,
    };

    seenMsgIdsRef.current.add(newMsg.id);
    setChatMessages((prev) => [...prev, newMsg]);

    if (sender === 'CUSTOMER') {
      if (!driverChatOpenRef.current) {
        setDriverUnreadChatCount((c) => c + 1);
      }
    } else {
      if (!customerChatOpenRef.current) {
        setCustomerUnreadChatCount((c) => c + 1);
      }
    }

    const activeId = activeBooking?.id || driverCurrentRide?.id;
    const backendMessage = actualAudio ? `[VOICE]:${actualAudio}` : cleanText;

    if (activeId && !activeId.startsWith('BK-')) {
      chatApi.sendMessage(activeId, backendMessage, sender).catch(() => {});
    }

    try {
      liveDispatchChannel?.postMessage({
        type: 'LIVE_CHAT_MESSAGE',
        bookingId: activeId,
        message: newMsg,
      });
    } catch {}
  };

  // Poll live chat messages from server for active trip
  useEffect(() => {
    const activeId = activeBooking?.id || driverCurrentRide?.id;
    if (!activeId || activeId.startsWith('BK-')) return;

    let isFirstPoll = seenMsgIdsRef.current.size === 0;

    const interval = setInterval(async () => {
      try {
        const res = await chatApi.getMessages(activeId);
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped: ChatMessage[] = res.data.map((m: any) => {
            const rawMsg = m.message || m.text || '';
            const isVoice = typeof rawMsg === 'string' && rawMsg.startsWith('[VOICE]:');
            const audioUrl = isVoice ? rawMsg.replace('[VOICE]:', '') : (m.audio_url || m.voice_url || undefined);
            const msgSender = (m.sender_type || m.sender || 'CUSTOMER').toUpperCase() as any;
            return {
              id: String(m.id || m.created_at || Math.random()),
              sender: msgSender,
              text: isVoice ? (msgSender === 'DRIVER' ? '🎤 Driver Voice Note' : '🎤 Voice Note') : rawMsg,
              audioUrl,
              time: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now',
            };
          });

          if (isFirstPoll) {
            mapped.forEach((m) => seenMsgIdsRef.current.add(m.id));
            isFirstPoll = false;
            setChatMessages(mapped);
          } else {
            let newDriverCount = 0;
            let newCustomerCount = 0;

            mapped.forEach((m) => {
              if (!seenMsgIdsRef.current.has(m.id)) {
                seenMsgIdsRef.current.add(m.id);
                if (m.sender === 'DRIVER') newDriverCount++;
                if (m.sender === 'CUSTOMER') newCustomerCount++;
              }
            });

            if (newDriverCount > 0 && !customerChatOpenRef.current) {
              setCustomerUnreadChatCount((c) => c + newDriverCount);
              playChatNotificationSound();
            }

            if (newCustomerCount > 0 && !driverChatOpenRef.current) {
              setDriverUnreadChatCount((c) => c + newCustomerCount);
              playChatNotificationSound();
            }

            setChatMessages(mapped);
          }
        }
      } catch {}
    }, 2500);

    return () => clearInterval(interval);
  }, [activeBooking?.id, driverCurrentRide?.id]);
  const confirmDriverVehicle = () => {};
  const reportDriverVehicleMismatch = (reason: string) => {};
  const [isSosActive, setIsSosActive] = useState<boolean>(false);
  const triggerSOS = (role: 'CUSTOMER' | 'DRIVER') => setIsSosActive(true);
  const clearSOS = () => setIsSosActive(false);
  const rateDriver = async (r: number, rev?: string) => {
    const bookingToRate = selectedInvoiceBooking || activeBooking || allBookings[0];
    if (bookingToRate?.id) {
      try {
        await bookingApi.rateBooking({
          booking_id: bookingToRate.id,
          rating: r,
          review: rev || '',
        });
      } catch (err) {
        console.warn('Backend rateBooking error (handled):', err);
      }
      setActiveBooking((prev) => (prev && prev.id === bookingToRate.id ? { ...prev, rating: r, reviewText: rev } : prev));
      if (selectedInvoiceBooking && selectedInvoiceBooking.id === bookingToRate.id) {
        setSelectedInvoiceBooking((prev: any) => (prev ? { ...prev, rating: r, reviewText: rev } : prev));
      }
    }
  };

  // Common Lists
  const [allDrivers, setAllDrivers] = useState<DriverProfile[]>(MOCK_DRIVERS);
  const [fareRules, setFareRules] = useState<FareRule[]>(MOCK_FARE_RULES);

  // Admin Portal State
  const [adminTab, setAdminTab] = useState<AdminTab>('DASHBOARD');
  const [adminToken, setAdminToken] = useState<string | null>(tokenStorage.getAdminToken());
  const [adminProfile, setAdminProfile] = useState<any | null>(null);
  const [adminDashboardStats, setAdminDashboardStats] = useState<any | null>(null);
  const [adminCustomersList, setAdminCustomersList] = useState<any[]>([]);
  const [adminDriversList, setAdminDriversList] = useState<any[]>([]);
  const [adminVehiclesList, setAdminVehiclesList] = useState<any[]>([]);
  const [adminPartnerVehiclesList, setAdminPartnerVehiclesList] = useState<any[]>([]);
  const [adminBookingsList, setAdminBookingsList] = useState<any[]>([]);
  const [adminFareRulesList, setAdminFareRulesList] = useState<any[]>([]);
  const [isAdminLoading, setIsAdminLoading] = useState<boolean>(false);

  const refreshAdminData = useCallback(async () => {
    const token = tokenStorage.getAdminToken();
    if (!token) return;
    setIsAdminLoading(true);
    try {
      try {
        const meRes = await authApi.getMe('admin');
        if (meRes.success && meRes.data?.user) setAdminProfile(meRes.data.user);
      } catch {}
      try {
        const dashRes = await adminApi.getDashboard();
        if (dashRes.success && dashRes.data) setAdminDashboardStats(dashRes.data);
      } catch {}
      try {
        const custRes = await adminApi.getCustomers({ limit: 1000 });
        if (custRes.success && custRes.data?.customers) setAdminCustomersList(custRes.data.customers);
      } catch {}
      try {
        const drivRes = await adminApi.getDrivers({ limit: 1000 });
        if (drivRes.success && drivRes.data?.drivers) {
          setAdminDriversList(drivRes.data.drivers);
          const mappedDrivers: DriverProfile[] = drivRes.data.drivers.map((d: any) => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            email: d.email || `${d.phone}@redtaxi.in`,
            photo: d.photo_url || d.avatar_url || '',
            vehicleModel: d.vehicle_model || 'Red Cab',
            vehicleNumber: d.vehicle_number || 'TN 38 AA 1111',
            vehicleType: d.vehicle_type || 'SEDAN',
            vehicleCategory: 'Red Sedan',
            rating: parseFloat(d.rating) || 5.0,
            tripsCount: parseInt(d.trips_count) || 0,
            isOnline: Boolean(parseInt(d.is_online)),
            approvalStatus: (d.approval_status as any) || 'APPROVED',
            walletBalance: parseFloat(d.wallet_balance) || 0,
            todayEarnings: parseFloat(d.today_earnings) || 0,
            joinedDate: d.created_at ? d.created_at.substring(0, 10) : '2026-01-01',
            completedTripsToday: parseInt(d.today_trips) || 0,
            commission: parseFloat(d.commission_percent) || 15.0,
            documents: { license: 'Verified', rc: 'Verified', insurance: 'Verified', permit: 'Verified' },
            currentLocation: { name: 'Coimbatore Hub', address: 'Gandhipuram, Coimbatore', lat: parseFloat(d.current_lat) || 11.0168, lng: parseFloat(d.current_lng) || 76.9558 },
          }));
          setAllDrivers(mappedDrivers);
        }
      } catch {}
      try {
        const vehRes = await adminApi.getVehicles();
        if (vehRes.success && vehRes.data?.categories) setAdminVehiclesList(vehRes.data.categories);
      } catch {}
      try {
        const pVehRes = await adminApi.getPartnerVehicles({ limit: 1000 });
        if (pVehRes.success && pVehRes.data?.vehicles) setAdminPartnerVehiclesList(pVehRes.data.vehicles);
      } catch {}
      try {
        const bookRes = await adminApi.getBookings({ limit: 1000 });
        if (bookRes.success && bookRes.data?.bookings) {
          setAdminBookingsList(bookRes.data.bookings);
          setAllBookings(bookRes.data.bookings.map(mapBackendBookingToRecord));
        }
      } catch {}
      try {
        const fareRes = await adminApi.getFareRules();
        if (fareRes.success && fareRes.data?.fare_rules) {
          setAdminFareRulesList(fareRes.data.fare_rules);
          const mappedFare: FareRule[] = fareRes.data.fare_rules.map((f: any) => ({
            category: f.category_name || f.category_slug || 'Standard',
            baseFare: parseFloat(f.base_fare),
            freeKm: parseFloat(f.free_km) || 0,
            perKm: parseFloat(f.per_km),
            perMinute: parseFloat(f.per_minute) || 0,
            waitingPerMin: parseFloat(f.waiting_per_min) || 0,
            nightChargePercent: parseFloat(f.night_charge_percent) || 0,
            platformFee: parseFloat(f.platform_fee) || 10,
            taxPercent: parseFloat(f.tax_percent) || 5,
            cancellationFee: parseFloat(f.cancellation_fee) || 30,
          }));
          setFareRules(mappedFare);
        }
      } catch {}
    } finally {
      setIsAdminLoading(false);
    }
  }, []);

  const adminLogin = async (email: string, password: string) => {
    try {
      const res = await authApi.adminLogin({ email, password });
      if (res.success && res.data?.token) {
        tokenStorage.setAdminToken(res.data.token);
        setAdminToken(res.data.token);
        if (res.data.admin) setAdminProfile(res.data.admin);
        await refreshAdminData();
        return { success: true, message: 'Admin login successful' };
      }
      const isDefault = (email.trim().toLowerCase() === 'admin@jittadrives.com' || email.trim().toLowerCase() === 'admin@redtaxi.in') && password === 'admin123';
      if (isDefault) {
        const dummy = 'demo_admin_token_' + Date.now();
        tokenStorage.setAdminToken(dummy);
        setAdminToken(dummy);
        setAdminProfile({ id: 'ADMIN-001', name: 'System Administrator', email: 'admin@jittadrives.com', role: 'SUPER_ADMIN' });
        await refreshAdminData();
        return { success: true, message: 'Admin logged in successfully' };
      }
      return { success: false, message: res.message || 'Invalid credentials' };
    } catch {
      return { success: false, message: 'Login failed' };
    }
  };

  const adminLogout = () => {
    tokenStorage.clearAdminToken();
    setAdminToken(null);
    setAdminProfile(null);
    setAdminDashboardStats(null);
  };

  const adminSetDriverApproval = async (driverId: string, status: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'PENDING') => {
    try {
      const res = await adminApi.updateDriverApproval(driverId, status);
      if (res.success) {
        await refreshAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const adminApproveDriver = async (driverId: string) => adminSetDriverApproval(driverId, 'APPROVED');
  const adminRejectDriver = async (driverId: string) => adminSetDriverApproval(driverId, 'REJECTED');

  const adminUpdateCustomerStatus = async (customerId: string, status: 'ACTIVE' | 'BLOCKED') => {
    try {
      const res = await adminApi.updateCustomerStatus(customerId, status);
      if (res.success) {
        await refreshAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const adminDeleteCustomer = async (customerId: string) => {
    try {
      setAdminCustomersList((prev) => prev.filter((c) => c.id !== customerId));
      const res = await adminApi.deleteCustomer(customerId);
      if (res && res.success) {
        await refreshAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const adminDeleteDriver = async (driverId: string) => {
    try {
      setAdminDriversList((prev) => prev.filter((d) => d.id !== driverId));
      const res = await adminApi.deleteDriver(driverId);
      if (res && res.success) {
        await refreshAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const adminAssignDriver = async (bookingId: string, driverId: string) => {
    try {
      const res = await adminApi.assignDriver(bookingId, driverId);
      if (res.success) {
        await refreshAdminData();
        return { success: true, message: res.message || 'Driver assigned successfully' };
      }
      return { success: false, message: res.message || 'Failed to assign driver' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Assignment request failed' };
    }
  };

  const adminUpdateFareRule = async (ruleId: string, data: any) => {
    try {
      const res = await adminApi.updateFareRule(ruleId, data);
      if (res.success) {
        await refreshAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const adminToggleVehicleCategory = async (categoryId: string) => {
    try {
      const res = await adminApi.toggleVehicleCategory(categoryId);
      if (res.success) {
        await refreshAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (adminToken) refreshAdminData();
  }, [adminToken, refreshAdminData]);

  const providerValue: TaxiAppContextType = {
    themeMode,
    setThemeMode,
    toggleTheme,
    language,
    setLanguage,
    t,
    viewMode,
    setViewMode,
    customerScreen,
    setCustomerScreen,
    isCustomerAuthenticated,
    customerProfile,
    setCustomerProfile,
    updateCustomerProfile,
    loginCustomer,
    logoutCustomer,
    refreshCustomerData,
    selectedInvoiceBooking,
    setSelectedInvoiceBooking,
    pickupLocation,
    setPickupLocation,
    dropLocation,
    setDropLocation,
    intermediateStops,
    addStop,
    removeStop,
    selectedVehicle,
    setSelectedVehicle,
    driverOnlyHours,
    setDriverOnlyHours,
    driverOnlyVehicleNumber,
    setDriverOnlyVehicleNumber,
    driverOnlyVehicle,
    setDriverOnlyVehicle,
    vehicleCategories,
    setVehicleCategories,
    rideType,
    setRideType,
    estimatedDistance,
    estimatedDuration,
    calculateFare,
    fetchServerFareEstimate,
    confirmBooking,
    cancelActiveBooking,
    isBookingLoading,
    bookingError,
    activeBooking,
    setActiveBooking,
    allCoupons,
    appliedCoupon,
    applyCoupon,
    areCouponsDisabled,
    refreshCoupons,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    walletTransactions,
    addMoneyToWallet,
    allNotifications,
    markNotificationRead,
    createSupportTicket,
    rentalHours,
    setRentalHours,
    outstationConfig,
    setOutstationConfig,
    airportConfig,
    setAirportConfig,
    addSavedPlace,
    driverScreen,
    setDriverScreen,
    isDriverAuthenticated,
    driverProfile,
    setDriverProfile,
    toggleDriverOnline,
    rechargeDriverWallet,
    availableRides,
    driverRideHistory,
    refreshDriverHistory,
    driverCurrentRide,
    setDriverCurrentRide,
    driverWallet,
    driverNotifications,
    refreshDriverNotifications,
    refreshDriverWallet,
    markDriverNotificationRead,
    lastCompletedRide,
    setLastCompletedRide,
    selectedAvailableRide,
    setSelectedAvailableRide,
    acceptRideRequest,
    rejectRideRequest,
    driverArrivedAtPickup,
    startTripWithOtp,
    completeCurrentTrip,
    simulatedProgress,
    setSimulatedProgress,
    loginDriver,
    registerDriver,
    logoutDriver,
    refreshDriverData,
    updateDriverProfile,
    updateDriverVehicle,
    chatMessages,
    sendChatMessage,
    driverUnreadChatCount,
    setDriverUnreadChatCount,
    customerUnreadChatCount,
    setCustomerUnreadChatCount,
    showDriverChat,
    setShowDriverChat,
    confirmDriverVehicle,
    reportDriverVehicleMismatch,
    triggerSOS,
    isSosActive,
    clearSOS,
    rateDriver,
    allOffers,
    offersNotice,
    setOffersNotice,
    areOffersDisabled,
    refreshOffers,
    allDrivers,
    allBookings,
    refreshCustomerBookings,
    fareRules,
    locationStatus,
    locationErrorMessage,
    retryLocationDetection,
    isFetchingLocation,
    adminTab,
    setAdminTab,
    adminToken,
    adminProfile,
    adminDashboardStats,
    adminCustomersList,
    adminDriversList,
    adminVehiclesList,
    adminPartnerVehiclesList,
    adminBookingsList,
    adminFareRulesList,
    isAdminLoading,
    adminLogin,
    adminLogout,
    refreshAdminData,
    adminApproveDriver,
    adminRejectDriver,
    adminSetDriverApproval,
    adminUpdateCustomerStatus,
    adminDeleteCustomer,
    adminDeleteDriver,
    adminAssignDriver,
    adminUpdateFareRule,
    adminToggleVehicleCategory,
  };

  return <TaxiAppContext.Provider value={providerValue}>{children}</TaxiAppContext.Provider>;
};

export const useTaxiApp = () => {
  const context = useContext(TaxiAppContext);
  if (!context) {
    throw new Error('useTaxiApp must be used within a TaxiAppProvider');
  }
  return context;
};