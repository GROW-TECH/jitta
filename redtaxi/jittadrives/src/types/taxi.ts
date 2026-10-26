export type AppViewMode = 'CUSTOMER' | 'DRIVER' | 'ADMIN';
export type ThemeMode = 'DARK' | 'LIGHT';

export type CustomerScreen =
  | 'SPLASH'
  | 'ONBOARDING'
  | 'LOGIN'
  | 'REGISTER'
  | 'OTP'
  | 'HOME'
  | 'SEARCH_LOCATION'
  | 'PICKUP_PIN'
  | 'DESTINATION_CONFIRM'
  | 'ADD_STOP'
  | 'RIDE_TYPES'
  | 'VEHICLE_SELECT'
  | 'FARE_DETAILS'
  | 'COUPONS'
  | 'PAYMENT_METHOD'
  | 'BOOKING_CONFIRM'
  | 'SEARCHING_DRIVER'
  | 'NO_DRIVERS_AVAILABLE'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_EN_ROUTE'
  | 'DRIVER_ARRIVED'
  | 'TRIP_STARTED'
  | 'LIVE_TRIP'
  | 'SOS'
  | 'CHAT'
  | 'SHARE_TRIP'
  | 'TRIP_COMPLETED'
  | 'PAYMENT_COMPLETED'
  | 'RATING'
  | 'INVOICE'
  | 'MY_RIDES'
  | 'RIDE_DETAILS'
  | 'SCHEDULED_RIDES'
  | 'RENTAL_BOOKING'
  | 'OUTSTATION_BOOKING'
  | 'AIRPORT_BOOKING'
  | 'DRIVER_ONLY_BOOKING'
  | 'WALLET'
  | 'BALANCES'
  | 'GIFT_CARD'
  | 'OFFERS'
  | 'NOTIFICATIONS'
  | 'PROFILE'
  | 'SAVED_PLACES'
  | 'SUPPORT';

export type DriverScreen =
  | 'DRIVER_SPLASH'
  | 'DRIVER_LOGIN'
  | 'DRIVER_REGISTRATION'
  | 'DOCUMENTS_UPLOAD'
  | 'DRIVER_APPROVAL'
  | 'DRIVER_HOME'
  | 'RIDE_REQUEST'
  | 'RIDE_ACCEPTED'
  | 'ARRIVING'
  | 'ARRIVED'
  | 'START_RIDE'
  | 'COMPLETE_RIDE'
  | 'EARNINGS'
  | 'DRIVER_WALLET'
  | 'DRIVER_HISTORY'
  | 'DRIVER_PROFILE'
  | 'DRIVER_NOTIFICATIONS';

export type RideType = 'CITY' | 'RENTAL' | 'OUTSTATION' | 'AIRPORT' | 'DRIVER_ONLY' | 'BIKE';

export interface LocationPoint {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: 'AIRPORT' | 'STATION' | 'WORK' | 'HOME' | 'POPULAR';
}

export interface VehicleOption {
  id: string;
  name: string;
  category: string;
  capacity: number;
  basePrice: number;
  perKmRate: number;
  etaMin: number;
  tagline: string;
  image: string;
}

export interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  rating: number;
  tripsCount: number;
  photo: string;
  vehicleModel: string;
  vehicleNumber: string;
  vehicleType: string;
  isOnline: boolean;
  approvalStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
  todayEarnings: number;
  completedTripsToday: number;
  commission: number;
  documents: {
    license: string;
    rc: string;
    insurance: string;
    permit: string;
  };
  documentNumbers?: {
    license: string;
    rc: string;
    insurance: string;
    permit: string;
  };
}

export interface SavedPlace {
  id: string;
  label: 'Home' | 'Work' | 'Other';
  address: string;
  location: LocationPoint;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar: string;
  walletBalance: number;
  totalRides: number;
  status: 'ACTIVE' | 'BLOCKED';
  joinedDate: string;
  savedPlaces: SavedPlace[];
}

export interface FareBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  waitingFare: number;
  platformFee: number;
  tax: number;
  discount: number;
  totalFare: number;
}

export interface BookingRecord {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverRating?: number;
  driverPhoto?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  customerVehicle?: {
    model: string;
    number: string;
    type?: string;
    color?: string;
    ownerName?: string;
    photos?: Record<string, string>;
    documents?: Record<string, string>;
    verification_status?: string;
  };
  vehicleVerificationStatus?: 'NOT_PROVIDED' | 'FORMAT_VALID' | 'VERIFICATION_PENDING' | 'VERIFIED' | 'VERIFICATION_FAILED' | 'VERIFICATION_UNAVAILABLE';
  driverVehicleConfirmed?: boolean;
  driverMismatchReported?: boolean;
  driverMismatchReason?: string;
  driverLocation?: { lat: number; lng: number };
  cancellationReason?: string;
  request_timeout_seconds?: number;
  rideType: RideType;
  vehicleCategory: string;
  pickup: LocationPoint;
  drop: LocationPoint;
  stops?: LocationPoint[];
  status:
    | 'SEARCHING'
    | 'ASSIGNED'
    | 'EN_ROUTE'
    | 'ARRIVED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'SCHEDULED'
    | 'NO_DRIVERS_FOUND';
  startOtp: string;
  distanceKm: number;
  durationMin: number;
  fare: FareBreakdown;
  paymentMethod: 'UPI' | 'CASH' | 'WALLET' | 'CARD' | 'BANK_TRANSFER';
  paymentStatus: 'PENDING' | 'PAID';
  createdAt: string;
  scheduledTime?: string;
  rating?: number;
  reviewText?: string;
  outstationDetails?: {
    tripType: 'ONE_WAY' | 'ROUND_TRIP';
    startDate: string;
    returnDate?: string;
  };
  rentalDetails?: {
    hours: number;
    includedKm: number;
  };
  airportDetails?: {
    tripType: 'PICKUP' | 'DROP';
    flightNumber: string;
    terminal: string;
    date: string;
    time: string;
  };
}

export interface Coupon {
  id: string;
  code: string;
  discountAmount: number;
  discountType: 'FLAT' | 'PERCENT';
  minBooking: number;
  maxDiscount?: number;
  expiryDate: string;
  description: string;
  isActive: boolean;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  userName: string;
  userType: 'CUSTOMER' | 'DRIVER';
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  description: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  type: 'RIDE' | 'OFFER' | 'SYSTEM' | 'PAYMENT';
}

export interface ChatMessage {
  id: string;
  sender: 'CUSTOMER' | 'DRIVER';
  text: string;
  time: string;
  audioUrl?: string;
  duration?: number;
}

export interface SupportTicket {
  id: string;
  user: string;
  role: 'CUSTOMER' | 'DRIVER';
  category: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: string;
}

export interface OfferBanner {
  id: string;
  code: string;
  title: string;
  description: string;
  discountTag: string;
  bgGradient: string;
  validity: string;
}

export interface FareRule {
  category: string;
  baseFare: number;
  freeKm: number;
  perKm: number;
  perMinute: number;
  waitingPerMin: number;
  nightChargePercent: number;
  platformFee: number;
  taxPercent: number;
  cancellationFee: number;
}
