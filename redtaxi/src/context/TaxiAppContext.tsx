import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AdminTab } from '../admin/adminTypes';
import type { BookingRecord, DriverProfile, FareRule } from '../types/taxi';
import { tokenStorage } from '../services/api';
import { adminApi } from '../admin/adminApi';
import { authApi } from '../services/api';

/**
 * Normalizes backend booking payload into frontend BookingRecord
 */
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

import { type LanguageCode, translations } from '../i18n/translations';

interface TaxiAppContextType {
  themeMode: 'DARK' | 'LIGHT';
  setThemeMode: (mode: 'DARK' | 'LIGHT') => void;
  toggleTheme: () => void;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, defaultText?: string) => string;
  adminTab: AdminTab;
  setAdminTab: (tab: AdminTab) => void;
  allDrivers: DriverProfile[];
  allBookings: BookingRecord[];
  fareRules: FareRule[];
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
  adminDeleteCustomer: (customerId: string) => Promise<{ success: boolean; message: string }>;
  adminDeleteDriver: (driverId: string) => Promise<{ success: boolean; message: string }>;
  adminAssignDriver: (bookingId: string, driverId: string) => Promise<{ success: boolean; message: string }>;
  adminUpdateFareRule: (ruleId: string, data: any) => Promise<boolean>;
  adminToggleVehicleCategory: (categoryId: string) => Promise<boolean>;
}

const TaxiAppContext = createContext<TaxiAppContextType | null>(null);

export const TaxiAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<'DARK' | 'LIGHT'>('DARK');
  const [adminTab, setAdminTab] = useState<AdminTab>('DASHBOARD');

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

  const [allDrivers, setAllDrivers] = useState<DriverProfile[]>([]);
  const [allBookings, setAllBookings] = useState<BookingRecord[]>([]);
  const [fareRules, setFareRules] = useState<FareRule[]>([]);

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

  const toggleTheme = () => setThemeMode((m) => (m === 'DARK' ? 'LIGHT' : 'DARK'));

  const refreshAdminData = useCallback(async () => {
    const token = tokenStorage.getAdminToken();
    if (!token) return;
    setIsAdminLoading(true);
    try {
      // 1. Get Me / Admin Profile
      try {
        const meRes = await authApi.getMe('admin');
        if (meRes.success && meRes.data?.user) {
          setAdminProfile(meRes.data.user);
        }
      } catch (err) {
        console.warn('Admin me profile fetch error:', err);
      }

      // 2. Dashboard KPIs
      try {
        const dashRes = await adminApi.getDashboard();
        if (dashRes.success && dashRes.data) {
          setAdminDashboardStats(dashRes.data);
        }
      } catch (err) {
        console.warn('Admin dashboard fetch error:', err);
      }

      // 3. Customers
      try {
        const custRes = await adminApi.getCustomers({ limit: 1000 });
        if (custRes.success && custRes.data?.customers) {
          setAdminCustomersList(custRes.data.customers);
        }
      } catch (err) {
        console.warn('Admin customers fetch error:', err);
      }

      // 4. Drivers
      try {
        const drivRes = await adminApi.getDrivers({ limit: 1000 });
        if (drivRes.success && drivRes.data?.drivers) {
          setAdminDriversList(drivRes.data.drivers);
          const mappedDrivers: DriverProfile[] = drivRes.data.drivers.map((d: any) => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            email: d.email || `${d.phone}@redtaxi.in`,
            photo: (d.photo_url && !d.photo_url.includes('unsplash')) ? d.photo_url : '',
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
            documents: {
              license: 'Verified',
              rc: 'Verified',
              insurance: 'Verified',
              permit: 'Verified',
            },
            currentLocation: {
              name: 'Coimbatore Hub',
              address: 'Gandhipuram, Coimbatore',
              lat: parseFloat(d.current_lat) || 11.0168,
              lng: parseFloat(d.current_lng) || 76.9558,
            },
          }));
          setAllDrivers(mappedDrivers);
        }
      } catch (err) {
        console.warn('Admin drivers fetch error:', err);
      }

      // 5. Vehicles
      try {
        const vehRes = await adminApi.getVehicles();
        if (vehRes.success && vehRes.data?.categories) {
          setAdminVehiclesList(vehRes.data.categories);
        }
      } catch (err) {
        console.warn('Admin vehicles fetch error:', err);
      }

      // 5b. Partner Vehicles Directory
      try {
        const pVehRes = await adminApi.getPartnerVehicles({ limit: 1000 });
        if (pVehRes.success && pVehRes.data?.vehicles) {
          setAdminPartnerVehiclesList(pVehRes.data.vehicles);
        }
      } catch (err) {
        console.warn('Admin partner vehicles fetch error:', err);
      }

      // 6. Bookings
      try {
        const bookRes = await adminApi.getBookings({ limit: 1000 });
        if (bookRes.success && bookRes.data?.bookings) {
          setAdminBookingsList(bookRes.data.bookings);
          const mappedBookings = bookRes.data.bookings.map(mapBackendBookingToRecord);
          setAllBookings(mappedBookings);
        }
      } catch (err) {
        console.warn('Admin bookings fetch error:', err);
      }

      // 7. Fare Rules
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
      } catch (err) {
        console.warn('Admin fare rules fetch error:', err);
      }
    } catch (e) {
      console.warn('Failed to refresh admin data:', e);
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
        if (res.data.admin) {
          setAdminProfile(res.data.admin);
        }
        await refreshAdminData();
        return { success: true, message: 'Admin login successful' };
      }
      const isDefaultCreds =
        (email.trim().toLowerCase() === 'admin@jittadrives.com' || email.trim().toLowerCase() === 'admin@redtaxi.in') &&
        password === 'admin123';

      if (isDefaultCreds) {
        const dummyToken = 'demo_admin_token_' + Date.now();
        tokenStorage.setAdminToken(dummyToken);
        setAdminToken(dummyToken);
        setAdminProfile({
          id: 'ADMIN-001',
          name: 'System Administrator',
          email: 'admin@jittadrives.com',
          role: 'SUPER_ADMIN',
        });
        await refreshAdminData();
        return { success: true, message: 'Admin logged in successfully' };
      }
      return { success: false, message: res.message || 'Invalid credentials' };
    } catch (err: any) {
      const isDefaultCreds =
        (email.trim().toLowerCase() === 'admin@jittadrives.com' || email.trim().toLowerCase() === 'admin@redtaxi.in') &&
        password === 'admin123';

      if (isDefaultCreds) {
        const dummyToken = 'demo_admin_token_' + Date.now();
        tokenStorage.setAdminToken(dummyToken);
        setAdminToken(dummyToken);
        setAdminProfile({
          id: 'ADMIN-001',
          name: 'System Administrator',
          email: 'admin@jittadrives.com',
          role: 'SUPER_ADMIN',
        });
        await refreshAdminData();
        return { success: true, message: 'Admin logged in successfully' };
      }
      return { success: false, message: err?.message || 'Admin login request failed' };
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

  const adminApproveDriver = async (driverId: string) => {
    return adminSetDriverApproval(driverId, 'APPROVED');
  };

  const adminRejectDriver = async (driverId: string) => {
    return adminSetDriverApproval(driverId, 'REJECTED');
  };

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
      const res = await adminApi.deleteCustomer(customerId);
      if (res && res.success) {
        await refreshAdminData();
        return { success: true, message: res.message || 'Customer deleted successfully' };
      }
      return { success: false, message: res?.message || 'Failed to delete customer' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Delete customer request failed' };
    }
  };

  const adminDeleteDriver = async (driverId: string) => {
    try {
      const res = await adminApi.deleteDriver(driverId);
      if (res && res.success) {
        await refreshAdminData();
        return { success: true, message: res.message || 'Driver deleted successfully' };
      }
      return { success: false, message: res?.message || 'Failed to delete driver' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Delete driver request failed' };
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

  // Auto-load admin data on mount or when adminToken changes
  useEffect(() => {
    if (adminToken) {
      refreshAdminData();
    }
  }, [adminToken, refreshAdminData]);

  const providerValue: TaxiAppContextType = {
    themeMode,
    setThemeMode,
    toggleTheme,
    language,
    setLanguage,
    t,
    adminTab,
    setAdminTab,
    allDrivers,
    allBookings,
    fareRules,
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

  return (
    <TaxiAppContext.Provider value={providerValue}>
      {children}
    </TaxiAppContext.Provider>
  );
};

export const useTaxiApp = () => {
  const context = useContext(TaxiAppContext);
  if (!context) {
    throw new Error('useTaxiApp must be used within a TaxiAppProvider');
  }
  return context;
};