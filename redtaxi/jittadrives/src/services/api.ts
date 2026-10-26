/**
 * RedTaxi Frontend - API Client & Services Layer
 * Integrates React UI with PHP REST backend (/api/v1)
 */

export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: any;
  errors?: any;
  timestamp: string;
}

export function resolveAppBase(): string {
  if (typeof window !== 'undefined') {
    const knownRoutes = ['customer', 'driver', 'admin', 'user', 'tracking'];
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (segments.length > 0 && !knownRoutes.includes(segments[0].toLowerCase())) {
      return (window.location.origin || '') + '/' + segments[0];
    }
    return window.location.origin || '';
  }
  return '';
}

export function resolveApiBase(): string {
  if (typeof window !== 'undefined') {
    const knownRoutes = ['customer', 'driver', 'admin', 'user', 'tracking'];
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (segments.length > 0 && !knownRoutes.includes(segments[0].toLowerCase())) {
      return (window.location.origin || '') + '/' + segments[0] + '/api/v1';
    }
    return (window.location.origin || '') + '/api/v1';
  }
  return '/api/v1';
}

const API_BASE = resolveApiBase();

// Token Storage Keys
const CUSTOMER_TOKEN_KEY = 'redtaxi_customer_token';
const DRIVER_TOKEN_KEY = 'redtaxi_driver_token';
const ADMIN_TOKEN_KEY = 'redtaxi_admin_token';

export const tokenStorage = {
  getCustomerToken: (): string | null => localStorage.getItem(CUSTOMER_TOKEN_KEY),
  setCustomerToken: (token: string): void => localStorage.setItem(CUSTOMER_TOKEN_KEY, token),
  clearCustomerToken: (): void => localStorage.removeItem(CUSTOMER_TOKEN_KEY),

  getDriverToken: (): string | null => localStorage.getItem(DRIVER_TOKEN_KEY),
  setDriverToken: (token: string): void => localStorage.setItem(DRIVER_TOKEN_KEY, token),
  clearDriverToken: (): void => localStorage.removeItem(DRIVER_TOKEN_KEY),

  getAdminToken: (): string | null => localStorage.getItem(ADMIN_TOKEN_KEY),
  setAdminToken: (token: string): void => localStorage.setItem(ADMIN_TOKEN_KEY, token),
  clearAdminToken: (): void => localStorage.removeItem(ADMIN_TOKEN_KEY),
};

/**
 * Generic API request wrapper with Bearer token injection
 */
export async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
  tokenType: 'customer' | 'driver' | 'admin' | 'none' = 'none'
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (tokenType === 'customer') {
    const token = tokenStorage.getCustomerToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Auth-Token'] = token;
      headers['X-Customer-Token'] = token;
    }
  } else if (tokenType === 'driver') {
    const token = tokenStorage.getDriverToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Auth-Token'] = token;
      headers['X-Driver-Token'] = token;
    }
  } else if (tokenType === 'admin') {
    const token = tokenStorage.getAdminToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Auth-Token'] = token;
      headers['X-Admin-Token'] = token;
    }
  }

  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Only clear token if explicit authentication endpoint fails
    if (response.status === 401 && (endpoint.includes('/auth/logout') || endpoint === '/auth/me')) {
      if (tokenType === 'customer') tokenStorage.clearCustomerToken();
      if (tokenType === 'driver') tokenStorage.clearDriverToken();
      if (tokenType === 'admin') tokenStorage.clearAdminToken();
    }

    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (json && typeof json === 'object') {
      if (json.statusCode === 401 && (endpoint.includes('/auth/logout') || endpoint === '/auth/me')) {
        if (tokenType === 'customer') tokenStorage.clearCustomerToken();
        if (tokenType === 'driver') tokenStorage.clearDriverToken();
        if (tokenType === 'admin') tokenStorage.clearAdminToken();
      }
      return json as ApiResponse<T>;
    }

    return {
      success: false,
      statusCode: response.status || 500,
      message: response.status === 503 || response.status === 500
        ? 'Database connection error: Please verify server database credentials in api/.env or open api/setup.php to configure.'
        : (response.statusText || 'Server unavailable'),
      data: null as unknown as T,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      success: false,
      statusCode: 500,
      message: err?.message || 'Network error or server unavailable',
      data: null as unknown as T,
      timestamp: new Date().toISOString(),
    };
  }
}

// =============================================================================
// Authentication Service
// =============================================================================
export const authApi = {
  customerRegister: (data: {
    name: string;
    phone: string;
    email?: string;
    password?: string;
    confirm_password?: string;
    city_id?: number;
  }) =>
    request<{ token: string; tokenType: string; customer: any }>(
      '/auth/customer/register',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  customerLogin: (data: {
    identifier: string;
    password?: string;
    otp?: string;
    firebaseVerified?: boolean;
    firebaseToken?: string;
    phone?: string;
  }) =>
    request<{ token: string; tokenType: string; customer: any }>(
      '/auth/customer/login',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  driverLogin: (data: {
    identifier: string;
    password?: string;
    otp?: string;
    firebaseVerified?: boolean;
    firebaseToken?: string;
    phone?: string;
  }) =>
    request<{ token: string; tokenType: string; driver: any }>(
      '/auth/driver/login',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  driverRegister: (data: {
    name: string;
    phone: string;
    email?: string;
    password: string;
    confirm_password: string;
    city_id?: number;
    vehicle_model?: string;
    vehicle_number?: string;
    vehicle_type?: string;
    license_number?: string;
    license_photo?: string;
    driver_type?: string;
    rc_number?: string;
    insurance_number?: string;
    permit_number?: string;
  }) =>
    request<{ token: string; tokenType: string; driver: any }>(
      '/auth/driver/register',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  adminLogin: (data: { email: string; password: string }) =>
    request<{ token: string; tokenType: string; admin: any }>(
      '/auth/admin/login',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  sendOtp: (phone: string, role: 'customer' | 'driver' = 'customer') =>
    request<{ phone: string; otp: string; expires_in: number }>(
      '/auth/send-otp',
      { method: 'POST', body: JSON.stringify({ phone, role }) }
    ),

  logout: () =>
    request('/auth/logout', { method: 'POST' }),

  getMe: (role: 'customer' | 'driver' | 'admin') =>
    request<any>('/auth/me', { method: 'GET' }, role),
};

// =============================================================================
// Customer Service
// =============================================================================
export const customerApi = {
  getProfile: () =>
    request<any>('/customer/profile', { method: 'GET' }, 'customer'),

  updateProfile: (data: { name?: string; email?: string; avatar_url?: string; city_id?: number }) =>
    request<any>('/customer/profile', { method: 'PUT', body: JSON.stringify(data) }, 'customer'),

  getPlaces: () =>
    request<any[]>('/customer/places', { method: 'GET' }, 'customer'),

  addPlace: (data: { label: 'Home' | 'Work' | 'Other'; custom_label?: string; address: string; lat: number; lng: number }) =>
    request<any>('/customer/places', { method: 'POST', body: JSON.stringify(data) }, 'customer'),

  updatePlace: (id: string, data: { label?: 'Home' | 'Work' | 'Other'; custom_label?: string; address?: string; lat?: number; lng?: number }) =>
    request<any>(`/customer/places/${id}`, { method: 'PUT', body: JSON.stringify(data) }, 'customer'),

  deletePlace: (id: string) =>
    request<any>(`/customer/places/${id}`, { method: 'DELETE' }, 'customer'),

  getBookings: (limit = 20, page = 1) =>
    request<any[]>(`/customer/bookings?limit=${limit}&page=${page}`, { method: 'GET' }, 'customer'),

  getBookingDetail: (id: string) =>
    request<any>(`/customer/bookings/${id}`, { method: 'GET' }, 'customer'),

  getNotifications: () =>
    request<any[]>('/customer/notifications', { method: 'GET' }, 'customer'),

  markNotificationRead: (id: string) =>
    request<any>(`/customer/notifications/${id}/read`, { method: 'PATCH' }, 'customer'),

  getWallet: () =>
    request<any>('/customer/wallet', { method: 'GET' }, 'customer'),

  createSupportTicket: (data: { category: string; subject: string; description: string; priority?: string; booking_id?: string }) =>
    request<any>('/customer/support/tickets', { method: 'POST', body: JSON.stringify(data) }, 'customer'),

  getSupportTickets: () =>
    request<any[]>('/customer/support/tickets', { method: 'GET' }, 'customer'),

  getSupportTicketDetail: (id: string) =>
    request<any>(`/customer/support/tickets/${id}`, { method: 'GET' }, 'customer'),

  replySupportTicket: (id: string, message: string) =>
    request<any>(`/customer/support/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ message }) }, 'customer'),
};

// =============================================================================
// Driver Service
// =============================================================================
export const driverApi = {
  getProfile: () =>
    request<any>('/driver/profile', { method: 'GET' }, 'driver'),

  updateProfile: (data: { name?: string; email?: string; photo_url?: string; city_id?: number }) =>
    request<any>('/driver/profile', { method: 'PUT', body: JSON.stringify(data) }, 'driver'),

  getVehicle: () =>
    request<{ active_vehicle: any; all_vehicles: any[] }>('/driver/vehicle', { method: 'GET' }, 'driver'),

  updateVehicle: (data: { vehicle_model?: string; vehicle_number?: string; vehicle_type?: string; color?: string; year?: number }, id?: string) =>
    request<any>(id ? `/driver/vehicles/${id}` : '/driver/vehicle', { method: 'PUT', body: JSON.stringify(data) }, 'driver'),

  updateStatus: (isOnline: boolean, lat?: number, lng?: number, extra?: { heading?: number; speed?: number; accuracy?: number }) =>
    request<{ is_online: boolean; current_lat: number; current_lng: number; last_location_at: string }>(
      '/driver/status',
      { method: 'PATCH', body: JSON.stringify({ is_online: isOnline, lat, lng, ...extra }) },
      'driver'
    ),

  getAvailableRides: () =>
    request<any[]>('/driver/rides/available', { method: 'GET' }, 'driver'),

  acceptRide: (id: string) =>
    request<any>(`/driver/rides/${id}/accept`, { method: 'POST' }, 'driver'),

  rejectRide: (id: string) =>
    request<any>(`/driver/rides/${id}/reject`, { method: 'POST' }, 'driver'),

  getCurrentRide: () =>
    request<any>('/driver/rides/current', { method: 'GET' }, 'driver'),

  setEnRoute: (id: string) =>
    request<any>(`/driver/rides/${id}/en-route`, { method: 'POST' }, 'driver'),

  updateRideStatus: (
    id: string,
    status: 'EN_ROUTE' | 'ARRIVED' | 'STARTED' | 'COMPLETED',
    otp?: string,
    extra?: { lat?: number; lng?: number; is_test?: boolean; heading?: number; speed?: number; accuracy?: number }
  ) =>
    request<any>(
      `/driver/rides/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status, otp, ...extra }) },
      'driver'
    ),

  getRideHistory: (limit = 20, page = 1) =>
    request<any[]>(`/driver/rides/history?limit=${limit}&page=${page}`, { method: 'GET' }, 'driver'),

  getWallet: (limit = 50, page = 1) =>
    request<any>(`/driver/wallet?limit=${limit}&page=${page}`, { method: 'GET' }, 'driver'),

  rechargeWallet: (amount: number, payment_method = 'UPI', status = 'SUCCESS', reference_id?: string) =>
    request<any>(
      '/driver/wallet/recharge',
      { method: 'POST', body: JSON.stringify({ amount, payment_method, status, reference_id }) },
      'driver'
    ),

  getNotifications: () =>
    request<any[]>('/driver/notifications', { method: 'GET' }, 'driver'),

  markNotificationRead: (id: string) =>
    request<any>(`/driver/notifications/${id}/read`, { method: 'PATCH' }, 'driver'),

  getDocuments: () =>
    request<{ approval_status: string; documents: any[] }>('/driver/documents', { method: 'GET' }, 'driver'),

  uploadDocument: (data: { document_type: string; document_number?: string; file_url?: string; expiry_date?: string }) =>
    request<any>('/driver/documents/upload', { method: 'POST', body: JSON.stringify(data) }, 'driver'),

  instantApprove: () =>
    request<any>('/driver/documents/instant-approve', { method: 'POST' }, 'driver'),

  dispatchTestRide: (lat: number, lng: number, vehicle_type?: string) =>
    request<any>('/driver/test-ride/dispatch', { method: 'POST', body: JSON.stringify({ lat, lng, vehicle_type }) }, 'driver'),

  confirmVehicle: (bookingId: string) =>
    request<any>(`/driver/rides/${bookingId}/confirm-vehicle`, { method: 'POST' }, 'driver'),

  reportVehicleMismatch: (bookingId: string, reason: string) =>
    request<any>(`/driver/rides/${bookingId}/report-vehicle-mismatch`, { method: 'POST', body: JSON.stringify({ reason }) }, 'driver'),
};

// =============================================================================
// Public Catalogue Lookup Service
// =============================================================================
export const lookupApi = {
  getVehicleCategories: () =>
    request<any[]>('/lookup/vehicle-categories', { method: 'GET' }),

  getCoupons: () =>
    request<any[]>('/lookup/coupons', { method: 'GET' }),

  getOffers: () =>
    request<any[]>('/lookup/offers', { method: 'GET' }),

  getFareRules: () =>
    request<any[]>('/lookup/fare-rules', { method: 'GET' }),
};

// =============================================================================
// Booking Service
// =============================================================================
export const bookingApi = {
  fareEstimate: (data: {
    pickup: { name: string; address?: string; lat?: number; lng?: number } | string;
    drop: { name: string; address?: string; lat?: number; lng?: number } | string;
    vehicle_type?: string;
    distance_km?: number;
    duration_min: number;
    ride_type?: 'CITY' | 'RENTAL' | 'OUTSTATION' | 'AIRPORT' | 'DRIVER_ONLY';
    city_id?: number;
    coupon_code?: string;
    customer_vehicle_details?: {
      model: string;
      number: string;
      type?: string;
      color?: string;
    };
  }) =>
    request<any>('/booking/fare-estimate', { method: 'POST', body: JSON.stringify(data) }, 'customer'),

  createBooking: (data: {
    pickup: { name: string; address?: string; lat?: number; lng?: number } | string;
    drop: { name: string; address?: string; lat?: number; lng?: number } | string;
    stops?: Array<{ name: string; address?: string; lat?: number; lng?: number }>;
    vehicle_type?: string;
    distance_km?: number;
    duration_min: number;
    payment_method: 'UPI' | 'CASH' | 'WALLET' | 'CARD' | 'BANK_TRANSFER';
    ride_type?: 'CITY' | 'RENTAL' | 'OUTSTATION' | 'AIRPORT' | 'DRIVER_ONLY' | 'BIKE';
    city_id?: number;
    coupon_code?: string;
    scheduled_time?: string;
    customer_vehicle_details?: {
      model: string;
      number: string;
      type?: string;
      color?: string;
    };
  }) =>
    request<any>('/booking/create', { method: 'POST', body: JSON.stringify(data) }, 'customer'),

  getActiveBooking: () =>
    request<any>('/booking/active', { method: 'GET' }, 'customer'),

  completeBooking: (bookingId?: string) =>
    request<any>('/booking/complete', { method: 'POST', body: JSON.stringify({ booking_id: bookingId }) }, 'customer'),

  cancelBooking: (data: { booking_id?: string; reason?: string }) =>
    request<any>('/booking/cancel', { method: 'POST', body: JSON.stringify(data) }, 'customer'),

  getBookingDetail: (id: string) =>
    request<any>(`/booking/${id}`, { method: 'GET' }, 'customer'),

  rateBooking: (data: { booking_id: string; rating: number; review?: string }) =>
    request<any>('/booking/rate', { method: 'POST', body: JSON.stringify(data) }, 'customer'),

  triggerSOS: (data: { booking_id?: string; id?: string; lat?: number; lng?: number }, role: 'customer' | 'driver' = 'customer') =>
    request<any>('/booking/sos', { method: 'POST', body: JSON.stringify(data) }, role),

  updateVehicleDetails: (bookingId: string, data: { number: string; model?: string; type?: string; color?: string }) =>
    request<any>(`/booking/${bookingId}/vehicle-details`, { method: 'POST', body: JSON.stringify(data) }, 'customer'),

  getVehicleVerification: (bookingId: string) =>
    request<any>(`/booking/${bookingId}/vehicle-verification`, { method: 'GET' }, 'customer'),

  validateVehicleFormat: (number: string) =>
    request<any>('/vehicle/validate-format', { method: 'POST', body: JSON.stringify({ number }) }),

  verifyVehicleRegistration: (number: string) =>
    request<any>('/vehicle/verify-registration', { method: 'POST', body: JSON.stringify({ number }) }),
};

// =============================================================================
// Live Ride Chat Service
// =============================================================================
export const chatApi = {
  getMessages: (bookingId: string) =>
    request<any[]>(`/rides/${bookingId}/messages`, { method: 'GET' }),

  sendMessage: (bookingId: string, message: string, senderType: 'CUSTOMER' | 'DRIVER', senderId?: string) =>
    request<any>(
      `/rides/${bookingId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ message, sender_type: senderType, sender_id: senderId }),
      },
      senderType === 'DRIVER' ? 'driver' : 'customer'
    ),
};
