import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Users,
  Car,
  Calendar,
  DollarSign,
  Tag,
  Gift,
  Wallet as WalletIcon,
  CreditCard,
  AlertTriangle,
  HelpCircle,
  BarChart3,
  Bell,
  Settings,
  Search,
  Activity,
  Sun,
  Moon,
  LogOut,
  RefreshCw,
  User,
  UserCheck,
  UserX,
  CheckCircle2,
  ShieldCheck,
  Edit3,
  ChevronRight,
  Lock,
  Mail,
  Check,
  X,
  Menu,
  Eye,
  EyeOff,
  Plus,
  Download,
  TrendingUp,
  FileText,
  PieChart,
  Trash2,
  IdCard,
  Clock,
  Bike,
} from 'lucide-react';
import { useTaxiApp } from '../context/TaxiAppContext';
import type { AdminTab } from './adminTypes';
import { InteractiveMap } from '../components/common/InteractiveMap';
import Pagination from '../components/common/Pagination';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import { adminApi } from './adminApi';

const BRAND_LOGO = `${import.meta.env.BASE_URL}logo.png`;

function BrandLogo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const [broken, setBroken] = useState(false);
  const box = size === 'lg' ? 'w-24 h-24 rounded-2xl' : size === 'md' ? 'w-11 h-11 rounded-xl' : 'w-9 h-9 rounded-lg';
  const icon = size === 'lg' ? 'w-12 h-12' : size === 'md' ? 'w-6 h-6' : 'w-5 h-5';
  if (!broken) {
    return (
      <img
        src={BRAND_LOGO}
        alt="JittaDrives"
        onError={() => setBroken(true)}
        className={`${box} object-contain bg-white p-1.5 shadow ${className}`}
      />
    );
  }
  return (
    <div className={`${box} bg-[#E85D04] flex items-center justify-center text-white shadow-lg shadow-[#E85D04]/30 ${className}`}>
      <Car className={icon} />
    </div>
  );
}

export const AdminDashboardView: React.FC = () => {
  const {
    adminTab,
    setAdminTab,
    allBookings,
    allDrivers,
    fareRules,
    themeMode,
    toggleTheme,
    // Phase 4 Admin Live State & APIs
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
    adminSetDriverApproval,
    adminUpdateCustomerStatus,
    adminDeleteCustomer,
    adminDeleteDriver,
    adminAssignDriver,
    adminUpdateFareRule,
    adminToggleVehicleCategory,
  } = useTaxiApp();

  // Admin Login State
  const [loginEmail, setLoginEmail] = useState<string>('admin@jittadrives.com');
  const [loginPassword, setLoginPassword] = useState<string>('admin123');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [driverFilter, setDriverFilter] = useState<string>('ALL');
  const [driverSearch, setDriverSearch] = useState<string>('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('ALL');

  // Pagination States (10 per page)
  const [custPage, setCustPage] = useState(1);
  const [drvPage, setDrvPage] = useState(1);
  const [pvPage, setPvPage] = useState(1);
  const [bkPage, setBkPage] = useState(1);
  const [payPage, setPayPage] = useState(1);
  const [custWalletPage, setCustWalletPage] = useState(1);
  const [drvWalletPage, setDrvWalletPage] = useState(1);
  const [supportPage, setSupportPage] = useState(1);
  const [verifPage, setVerifPage] = useState(1);
  const [verifStatusFilter, setVerifStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [verifSearch, setVerifSearch] = useState<string>('');
  const PAGE_SIZE = 10;

  // Reports & Analytics Interactive Filters and Pagination
  const [reportTimeFilter, setReportTimeFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('ALL');
  const [reportSearch, setReportSearch] = useState<string>('');
  const [reportPage, setReportPage] = useState<number>(1);

  // Vehicles Directory Sub-Tab
  const [vehicleSubTab, setVehicleSubTab] = useState<'CLASSES' | 'PARTNERS'>('CLASSES');

  // Booking Detail Inspection Modal
  const [selectedBookingDetailModal, setSelectedBookingDetailModal] = useState<any | null>(null);

  // Driver Quick-View Modal
  const [driverView, setDriverView] = useState<any | null>(null);
  const [driverDocsData, setDriverDocsData] = useState<any[]>([]);
  const [driverDocsLoading, setDriverDocsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (driverView?.id) {
      setDriverDocsLoading(true);
      adminApi.getDriverDocuments(String(driverView.id))
        .then((res: any) => {
          if (res && res.documents) {
            setDriverDocsData(res.documents);
          } else {
            setDriverDocsData([]);
          }
        })
        .catch(() => setDriverDocsData([]))
        .finally(() => setDriverDocsLoading(false));
    } else {
      setDriverDocsData([]);
    }
  }, [driverView?.id]);

  // Mutation Action Loading Tracker
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Assign Driver Modal State
  const [assignModalBooking, setAssignModalBooking] = useState<any | null>(null);
  const [selectedDriverForAssign, setSelectedDriverForAssign] = useState<string>('');
  const [assignLoading, setAssignLoading] = useState<boolean>(false);
  const [assignMessage, setAssignMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Edit Fare Modal State
  const [editingFareRule, setEditingFareRule] = useState<any | null>(null);
  const [fareBasePrice, setFareBasePrice] = useState<number>(0);
  const [farePerKm, setFarePerKm] = useState<number>(0);
  const [fareFreeKm, setFareFreeKm] = useState<number>(0);
  const [fareSaveLoading, setFareSaveLoading] = useState<boolean>(false);

  // Success Notice Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const isLight = themeMode === 'LIGHT';

  // Live Map auto-refresh: keep dispatch & driver positions current while the tab is open
  const refreshAdminDataRef = useRef(refreshAdminData);
  refreshAdminDataRef.current = refreshAdminData;

  useEffect(() => {
    if (adminTab !== 'LIVE_MAP') return;
    refreshAdminDataRef.current();
    const interval = setInterval(() => {
      refreshAdminDataRef.current();
    }, 15000);
    return () => clearInterval(interval);
  }, [adminTab]);

  // Broadcast state
  const [notifTitle, setNotifTitle] = useState<string>('');
  const [notifBody, setNotifBody] = useState<string>('');
  const [notifAudience, setNotifAudience] = useState<string>('ALL');

  // Dynamic admin section state (Coupons / Offers / Wallets / Payments / SOS / Support / Notifications / Settings)
  const [couponsList, setCouponsList] = useState<any[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponFormOpen, setCouponFormOpen] = useState(false);
  const [couponForm, setCouponForm] = useState({ code: '', discount_type: 'FLAT', discount: '', min_order: '', max_discount: '', expiry: '' });
  const [couponSaving, setCouponSaving] = useState(false);
  const [offersList, setOffersList] = useState<any[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offerFormOpen, setOfferFormOpen] = useState(false);
  const [offerForm, setOfferForm] = useState({ title: '', tag: '', description: '', target_audience: 'ALL' });
  const [offerSaving, setOfferSaving] = useState(false);
  const [walletData, setWalletData] = useState<any>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportOpenCount, setSupportOpenCount] = useState(0);
  const [supportFilter, setSupportFilter] = useState('');
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [ticketReply, setTicketReply] = useState('');
  const [ticketReplySending, setTicketReplySending] = useState(false);
  const [ticketStatusBusy, setTicketStatusBusy] = useState<string | null>(null);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [notifSending, setNotifSending] = useState(false);
  const [settingsData, setSettingsData] = useState<any>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const loadAdminSection = useCallback(async () => {
    switch (adminTab) {
      case 'COUPONS':
        setCouponsLoading(true);
        try {
          const r = await adminApi.getCoupons({ limit: 1000 });
          if (r.success) setCouponsList(r.data?.coupons || []);
        } catch { /* handled by callers */ }
        finally { setCouponsLoading(false); }
        break;
      case 'OFFERS':
        setOffersLoading(true);
        try {
          const r = await adminApi.getOffers();
          if (r.success) setOffersList(r.data?.offers || []);
        } catch { /* handled by callers */ }
        finally { setOffersLoading(false); }
        break;
      case 'WALLETS':
        setWalletLoading(true);
        try {
          const r = await adminApi.getWalletAudit();
          if (r.success) setWalletData(r.data);
        } catch { /* handled by callers */ }
        finally { setWalletLoading(false); }
        break;
      case 'PAYMENTS':
        setPaymentsLoading(true);
        try {
          const r = await adminApi.getPayments({ limit: 1000 });
          if (r.success) setPaymentsList(r.data?.payments || []);
        } catch { /* handled by callers */ }
        finally { setPaymentsLoading(false); }
        break;
      case 'SUPPORT':
        setSupportLoading(true);
        try {
          const r = await adminApi.getSupportTickets({ limit: 1000 });
          if (r.success) {
            setSupportTickets(r.data?.tickets || []);
            setSupportOpenCount((r.data?.tickets || []).filter((t: any) => (t.status || '').toUpperCase() === 'OPEN').length);
          }
        } catch { /* handled by callers */ }
        finally { setSupportLoading(false); }
        break;
      case 'NOTIFICATIONS':
        try {
          const r = await adminApi.getNotifications(500);
          if (r.success) setNotificationsList(r.data?.notifications || []);
        } catch { /* handled by callers */ }
        break;
      case 'SETTINGS':
        setSettingsLoading(true);
        try {
          const r = await adminApi.getSettings();
          if (r.success) setSettingsData({ ...(r.data || {}) });
        } catch { /* handled by callers */ }
        finally { setSettingsLoading(false); }
        break;
    }
  }, [adminTab]);

  useEffect(() => {
    if (!adminToken) return;
    loadAdminSection();
  }, [loadAdminSection, adminToken]);

  // List filter predicates (shared across list rendering + pagination totals)
  const customerMatches = (c: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  };

  const driverMatches = (d: any) => {
    const status = (d.approval_status || d.approvalStatus || '').toUpperCase();
    const online = d.is_online === 1 || d.is_online === '1' || d.is_online === true || d.isOnline === 1 || d.isOnline === '1' || d.isOnline === true;
    if (driverFilter === 'ONLINE') return online;
    if (driverFilter === 'OFFLINE') return !online;
    if (driverFilter === 'PENDING') return status === 'PENDING';
    if (driverFilter === 'APPROVED') return status === 'APPROVED';
    if (driverFilter === 'SUSPENDED') return status === 'SUSPENDED';
    if (driverFilter === 'REJECTED') return status === 'REJECTED';
    return true;
  };

  const driverSearchMatches = (d: any) => {
    if (!driverSearch) return true;
    const q = driverSearch.toLowerCase();
    return (
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.phone && d.phone.includes(q)) ||
      (d.id && d.id.toLowerCase().includes(q)) ||
      (d.driver_code && String(d.driver_code).toLowerCase().includes(q))
    );
  };

  const bookingMatches = (b: any) => {
    if (bookingStatusFilter !== 'ALL' && b.status !== bookingStatusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const bId = (b.id || '').toLowerCase();
      const cName = (b.customer_name || b.customerName || '').toLowerCase();
      const dName = (b.driver_name || b.driverName || '').toLowerCase();
      return bId.includes(q) || cName.includes(q) || dName.includes(q);
    }
    return true;
  };

  const paymentMatches = (p: any) => paymentFilter === 'ALL' || (p.status || '').toUpperCase() === paymentFilter;

  const supportMatches = (t: any) => !supportFilter || (t.status || '').toUpperCase() === supportFilter;

  // Reset to page 1 when filters change; clamp page when a list shrinks
  useEffect(() => setCustPage(1), [searchQuery]);
  useEffect(() => setDrvPage(1), [driverFilter, driverSearch]);
  useEffect(() => setBkPage(1), [bookingStatusFilter, searchQuery]);
  useEffect(() => setPayPage(1), [paymentFilter]);

  const clampPage = (p: number, n: number) => (n > 0 ? Math.min(p, Math.max(1, Math.ceil(n / PAGE_SIZE))) : 1);
  useEffect(() => setCustPage((p) => clampPage(p, adminCustomersList.length)), [adminCustomersList.length]);
  useEffect(() => setDrvPage((p) => clampPage(p, Math.max(adminDriversList.length, allDrivers?.length || 0))), [adminDriversList.length, allDrivers]);
  useEffect(() => setPvPage((p) => clampPage(p, adminPartnerVehiclesList.length)), [adminPartnerVehiclesList.length]);
  useEffect(() => setBkPage((p) => clampPage(p, Math.max(adminBookingsList.length, allBookings?.length || 0))), [adminBookingsList.length, allBookings]);
  useEffect(() => setPayPage((p) => clampPage(p, paymentsList.length)), [paymentsList.length]);
  useEffect(() => setCustWalletPage((p) => clampPage(p, (walletData?.customer_wallets || []).length)), [walletData?.customer_wallets]);
  useEffect(() => setDrvWalletPage((p) => clampPage(p, (walletData?.driver_wallets || []).length)), [walletData?.driver_wallets]);
  useEffect(() => setSupportPage(1), [supportFilter]);
  useEffect(() => setSupportPage((p) => clampPage(p, supportTickets.length)), [supportTickets.length]);
  useEffect(() => setReportPage(1), [reportTimeFilter, reportStatusFilter, reportSearch]);

  const loadTicketMessages = useCallback(async (ticketId: string) => {
    try {
      const r = await adminApi.getSupportTicketMessages(ticketId);
      if (r.success) setTicketMessages(r.data?.messages || []);
    } catch { setTicketMessages([]); }
  }, []);

  useEffect(() => {
    if (!activeTicketId) return;
    loadTicketMessages(activeTicketId);
    setTicketReply('');
  }, [activeTicketId, loadTicketMessages]);

  const downloadCsv = (filename: string, headers: string[], rows: any[][]) => {
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle Admin Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    const result = await adminLogin(loginEmail, loginPassword);
    setLoginLoading(false);

    if (!result.success) {
      setLoginError(result.message || 'Login failed. Please verify credentials.');
    }
  };

  // Handle Driver Assignment submission
  const handleConfirmAssignment = async () => {
    if (!assignModalBooking || !selectedDriverForAssign) return;
    setAssignLoading(true);
    setAssignMessage(null);

    const res = await adminAssignDriver(assignModalBooking.id, selectedDriverForAssign);
    setAssignLoading(false);

    if (res.success) {
      showToast(`Driver successfully assigned to booking #${assignModalBooking.id.substring(0, 8)}`);
      setAssignModalBooking(null);
      setSelectedDriverForAssign('');
    } else {
      setAssignMessage({ text: res.message || 'Assignment failed', isError: true });
    }
  };

  // Handle Fare Rule Update submission
  const handleSaveFareRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFareRule) return;
    setFareSaveLoading(true);

    const ok = await adminUpdateFareRule(editingFareRule.id, {
      base_fare: fareBasePrice,
      per_km: farePerKm,
      free_km: fareFreeKm,
      per_minute: editingFareRule.per_minute || 0,
      waiting_per_min: editingFareRule.waiting_per_min || 0,
      night_charge_percent: editingFareRule.night_charge_percent || 0,
      platform_fee: editingFareRule.platform_fee || 10,
      tax_percent: editingFareRule.tax_percent || 5,
      cancellation_fee: editingFareRule.cancellation_fee || 30,
      is_active: editingFareRule.is_active !== undefined ? editingFareRule.is_active : 1,
    });

    setFareSaveLoading(false);

    if (ok) {
      showToast(`Fare matrix for ${editingFareRule.category_name || editingFareRule.name} updated successfully!`);
      setEditingFareRule(null);
    } else {
      alert('Failed to update fare rule.');
    }
  };

  // ===========================================================================
  // 1. ADMIN LOGIN GATE (If not authenticated)
  // ===========================================================================
  if (!adminToken) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
        <div className={`w-full max-w-md border rounded-3xl p-8 shadow-2xl space-y-6 ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <BrandLogo size="lg" className="mx-auto" />
            <h1 className="text-2xl font-black tracking-tight">
              JittaDrives <span className="text-red-500">Admin</span>
            </h1>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Enterprise Dispatch & Fleet Management Console
            </p>
          </div>

          {/* Error Banner */}
          {loginError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 text-rose-500 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className={`font-bold uppercase block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Administrator Email
              </label>
              <div className={`flex items-center gap-2 border px-3 py-2.5 rounded-xl ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@jittadrives.com"
                  required
                  className="bg-transparent outline-none w-full font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={`font-bold uppercase block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Password
              </label>
              <div className={`flex items-center gap-2 border px-3 py-2.5 rounded-xl ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-transparent outline-none w-full font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="shrink-0 text-slate-400 hover:text-slate-200 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-[#E85D04] hover:bg-[#C2410C] disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-[#E85D04]/30 transition text-sm flex items-center justify-center gap-2"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Secure Admin Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className={`pt-4 border-t text-center space-y-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
            <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Default Admin Credentials:
            </p>
            <button
              type="button"
              onClick={() => {
                setLoginEmail('admin@jittadrives.com');
                setLoginPassword('admin123');
              }}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              admin@jittadrives.com / admin123 (Quick Fill)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // 2. AUTHENTICATED ADMIN DASHBOARD
  // ===========================================================================
  const navItems: Array<{ tab: AdminTab; label: string; icon: any; count?: number }> = [
    { tab: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
    { tab: 'LIVE_MAP', label: 'Live Ride Map', icon: MapPin },
    { tab: 'CUSTOMERS', label: 'Customers', icon: Users, count: adminCustomersList.length },
    {
      tab: 'DRIVERS',
      label: 'Drivers',
      icon: Car,
      count: adminDriversList.length,
    },
    {
      tab: 'DRIVER_APPROVALS',
      label: 'Verification',
      icon: ShieldCheck,
      count: adminDriversList.filter((d) => (d.approval_status || d.approvalStatus || '').toUpperCase() === 'PENDING').length,
    },
    { tab: 'VEHICLES', label: 'Vehicles Fleet', icon: Car, count: adminVehiclesList.length },
    {
      tab: 'BOOKINGS',
      label: 'Bookings Log',
      icon: Calendar,
      count: adminBookingsList.filter((b) => b.status === 'SEARCHING').length,
    },
    { tab: 'FARE_MGMT', label: 'Fare Matrix', icon: DollarSign },
    { tab: 'COUPONS', label: 'Coupons', icon: Tag },
    { tab: 'OFFERS', label: 'Offers Banners', icon: Gift },
    { tab: 'WALLETS', label: 'Wallets Audit', icon: WalletIcon },
    { tab: 'PAYMENTS', label: 'Payment Logs', icon: CreditCard },
    { tab: 'SUPPORT', label: 'Support Desk', icon: HelpCircle, count: supportOpenCount },
    { tab: 'REPORTS', label: 'Reports & Analytics', icon: BarChart3 },
    { tab: 'NOTIFICATIONS', label: 'Push Broadcast', icon: Bell },
    { tab: 'SETTINGS', label: 'System Settings', icon: Settings },
  ];

  // Approved drivers for manual assignment
  const approvedDrivers = adminDriversList.filter(
    (d) => d.approval_status === 'APPROVED' || d.approvalStatus === 'APPROVED'
  );

  return (
    <div className={`min-h-screen flex flex-col lg:flex-row transition-colors duration-300 ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile/Tablet Sticky Top Bar (Hidden on lg+) */}
      <div className={`lg:hidden sticky top-0 z-30 px-3 py-2.5 sm:px-4 sm:py-3 border-b flex items-center justify-between transition-colors ${
        isLight ? 'bg-white/95 border-slate-200 backdrop-blur' : 'bg-slate-900/95 border-slate-800 backdrop-blur'
      }`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileNavOpen(true)}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition ${
              isLight ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Open Admin Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" />
            <span className="font-extrabold text-sm tracking-tight">
              JittaDrives <span className="text-red-500">Admin</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 hidden sm:inline">
            {navItems.find((n) => n.tab === adminTab)?.label}
          </span>
          <LanguageSwitcher compact={true} />
          <button
            onClick={toggleTheme}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition ${
              isLight ? 'bg-slate-100 border-slate-200 text-amber-500' : 'bg-slate-950 border-slate-800 text-indigo-400'
            }`}
            title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
          >
            {isLight ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={adminLogout}
            className="w-8 h-8 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 flex items-center justify-center"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Slide-Over Navigation Drawer */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            onClick={() => setIsMobileNavOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Panel */}
          <div
            className={`relative w-72 max-w-[85vw] h-full flex flex-col justify-between p-4 z-10 shadow-2xl overflow-y-auto ${
              isLight ? 'bg-white text-slate-900 border-r border-slate-200' : 'bg-slate-900 text-white border-r border-slate-800'
            }`}
          >
            <div>
              {/* Drawer Header with Close button */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/40">
                <div className="flex items-center gap-2">
                  <BrandLogo size="md" />
                  <div>
                    <h2 className="font-extrabold text-sm tracking-tight">JittaDrives <span className="text-red-500">Admin</span></h2>
                    <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Dispatch Console</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileNavOpen(false)}
                  className="w-8 h-8 rounded-xl border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Admin Profile in Drawer */}
              <div className={`mb-4 p-2.5 rounded-2xl border flex items-center justify-between text-xs ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
              }`}>
                <div className="flex items-center gap-2 truncate">
                  <div className="w-7 h-7 rounded-full bg-[#E85D04]/15 text-[#E85D04] font-bold flex items-center justify-center text-[10px]">
                    SA
                  </div>
                  <div className="truncate">
                    <p className="font-bold truncate text-[11px]">{adminProfile?.name || 'System Admin'}</p>
                    <p className={`text-[9px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{adminProfile?.email || 'admin@jittadrives.com'}</p>
                  </div>
                </div>
              </div>

              {/* Drawer Nav Items */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const IconComp = item.icon;
                  const isSel = adminTab === item.tab;
                  return (
                    <button
                      key={item.tab}
                      onClick={() => {
                        setAdminTab(item.tab);
                        setIsMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition ${
                        isSel
                          ? 'bg-[#E85D04] text-white shadow-lg shadow-[#E85D04]/30'
                          : isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <IconComp className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.count && item.count > 0 ? (
                        <span className="bg-[#E85D04] text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                          {item.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className={`pt-4 border-t text-[10px] text-center space-y-1 ${isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-500'}`}>
              <p>JittaDrives Enterprise OS v4.2</p>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Permanent Sidebar Navigation (Hidden on mobile/tablet) */}
      <aside className={`hidden lg:flex w-64 border-r p-4 flex-col justify-between shrink-0 ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
        <div>
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-6 px-2">
            <BrandLogo size="md" />
            <div>
              <h2 className="font-extrabold text-base tracking-tight">JittaDrives <span className="text-[#E85D04]">Admin</span></h2>
              <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Dispatch & Operations</p>
            </div>
          </div>

          {/* Admin User Badge */}
          <div className={`mb-4 p-2.5 rounded-2xl border flex items-center justify-between text-xs ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
            <div className="flex items-center gap-2 truncate">
              <div className="w-7 h-7 rounded-full bg-[#E85D04]/15 text-[#E85D04] font-bold flex items-center justify-center text-[10px]">
                SA
              </div>
              <div className="truncate">
                <p className="font-bold truncate text-[11px]">{adminProfile?.name || 'System Admin'}</p>
                <p className={`text-[9px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{adminProfile?.email || 'admin@jittadrives.com'}</p>
              </div>
            </div>
            <button
              onClick={adminLogout}
              title="Sign Out"
              className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const IconComp = item.icon;
              const isSel = adminTab === item.tab;
              return (
                <button
                  key={item.tab}
                  onClick={() => setAdminTab(item.tab)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition ${
                    isSel
                      ? 'bg-[#E85D04] text-white shadow-lg shadow-[#E85D04]/30'
                      : isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <IconComp className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.count && item.count > 0 ? (
                    <span className="bg-[#E85D04] text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className={`pt-4 border-t text-[10px] text-center space-y-2 ${isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-500'}`}>
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Connected to MySQL API</span>
          </div>
          <p>JittaDrives OS v4.2 • Production UI</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto space-y-4 sm:space-y-6">
        {/* Top Operational Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4 border-slate-800/40">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              {navItems.find((n) => n.tab === adminTab)?.label || 'Operations Control'}
            </h2>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Real-time taxi fleet metrics and direct MySQL database synchronization
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Refresh Button */}
            <button
              onClick={() => refreshAdminData()}
              disabled={isAdminLoading}
              className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition ${
                isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
              title="Refresh Live Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAdminLoading ? 'animate-spin text-red-500' : ''}`} />
              <span className="hidden sm:inline">{isAdminLoading ? 'Syncing...' : 'Sync'}</span>
            </button>

            {/* Theme Switcher */}
            <button
              onClick={toggleTheme}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs border flex items-center gap-1.5 transition ${
                isLight
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
              }`}
            >
              {isLight ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-indigo-400" />}
              <span>{isLight ? 'Light' : 'Dark'}</span>
            </button>

            {/* System Status Indicator */}
            <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="hidden md:inline">System Operational</span>
            </span>

            {/* Sign out */}
            <button
              onClick={adminLogout}
              className="bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* 59. Dashboard Overview */}
        {adminTab === 'DASHBOARD' && (
          <div className="space-y-6">
            {/* KPI Cards (Live from MySQL) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                {
                  title: 'TOTAL RIDES',
                  val: String(adminDashboardStats?.kpis?.total_bookings ?? allBookings.length),
                  change: `${adminDashboardStats?.kpis?.completed_bookings ?? 0} Completed`,
                  color: 'from-blue-600 to-indigo-700',
                },
                {
                  title: 'ACTIVE RIDES NOW',
                  val: String(adminDashboardStats?.kpis?.active_bookings ?? allBookings.filter((b) => b.status === 'IN_PROGRESS' || b.status === 'ASSIGNED').length),
                  change: 'Live Dispatch',
                  color: 'from-emerald-600 to-teal-700',
                },
                {
                  title: 'ONLINE DRIVERS',
                  val: `${adminDashboardStats?.kpis?.online_drivers ?? allDrivers.filter((d) => d.isOnline).length} / ${adminDashboardStats?.kpis?.total_drivers ?? allDrivers.length}`,
                  change: `${adminDashboardStats?.kpis?.approved_drivers ?? 0} Approved`,
                  color: 'from-amber-600 to-orange-700',
                },
                {
                  title: 'REGISTERED CUSTOMERS',
                  val: String(adminDashboardStats?.kpis?.total_customers ?? adminCustomersList.length),
                  change: `${adminDashboardStats?.kpis?.active_customers ?? 0} Active`,
                  color: 'from-purple-600 to-violet-700',
                },
                {
                  title: 'GROSS REVENUE',
                  val: `₹${Number(adminDashboardStats?.kpis?.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  change: `Today: ₹${Number(adminDashboardStats?.kpis?.today_revenue || 0).toFixed(2)}`,
                  color: 'from-[#E85D04] to-[#C2410C]',
                },
              ].map((kpi, idx) => (
                <div key={idx} className={`border p-4 rounded-3xl space-y-2 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                  <span className={`text-[10px] font-extrabold tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {kpi.title}
                  </span>
                  <div className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {kpi.val}
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400">{kpi.change}</span>
                </div>
              ))}
            </div>

            {/* Charts & Fleet Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className={`lg:col-span-2 border p-5 rounded-3xl space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <Activity className="w-4 h-4 text-[#E85D04]" /> Revenue Analytics — Last 7 Days
                </h3>
                {(() => {
                  const trend = adminDashboardStats?.revenue_trend ?? [];
                  const maxRev = Math.max(...(trend.length ? trend.map((t: any) => Number(t.revenue) || 0) : [0]), 1);
                  const weekRevenue = trend.reduce((s: number, t: any) => s + (Number(t.revenue) || 0), 0);
                  const weekBookings = trend.reduce((s: number, t: any) => s + (Number(t.bookings) || 0), 0);
                  return trend.length === 0 ? (
                    <div className={`h-48 rounded-2xl border p-4 flex flex-col items-center justify-center gap-2 text-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                      <Activity className="w-6 h-6 text-slate-500" />
                      <p className="text-sm font-bold text-slate-400">No revenue data yet</p>
                      <p className="text-[10px] text-slate-500">Complete rides will appear here automatically</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-4 text-[10px] font-bold">
                        <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>7-Day Revenue: <span className="text-emerald-500">₹{weekRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                        <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>Bookings: <span className="text-[#E85D04]">{weekBookings}</span></span>
                      </div>
                      <div className={`h-40 rounded-2xl border p-4 flex items-end justify-between gap-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                        {trend.map((t: any, i: number) => {
                          const rev = Number(t.revenue) || 0;
                          const h = maxRev > 0 ? Math.max((rev / maxRev) * 100, rev > 0 ? 4 : 0) : 0;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${t.day}: ₹${rev.toLocaleString('en-IN')} (${t.bookings} bookings)`}>
                              <span className={`text-[8px] font-bold truncate ${rev > 0 ? 'text-emerald-500' : 'text-slate-500'}`}>
                                {rev > 0 ? `₹${rev >= 1000 ? (rev / 1000).toFixed(1) + 'k' : rev.toFixed(0)}` : ''}
                              </span>
                              <div
                                style={{ height: `${h}%` }}
                                className={`w-full rounded-t-lg transition-all duration-500 ${rev > 0 ? 'bg-gradient-to-t from-[#E85D04] to-[#F59E0B] hover:from-[#E85D04]' : (isLight ? 'bg-slate-200' : 'bg-slate-800')}`}
                              />
                              <span className="text-[9px] text-slate-500">{t.label || t.day?.substring(5)}</span>
                              <span className="text-[8px] text-slate-500">{t.bookings || 0} rides</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Driver Approval Breakdown */}
              <div className={`border p-5 rounded-3xl space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Driver Fleet Verification
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between font-bold mb-1">
                      <span className="text-emerald-500">Approved Partners</span>
                      <span>{adminDashboardStats?.driver_distribution?.approved ?? 0}</span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-950'}`}>
                      <div
                        className="h-full bg-emerald-500"
                        style={{
                          width: `${Math.min(
                            100,
                            ((adminDashboardStats?.driver_distribution?.approved || 0) /
                              Math.max(1, (adminDashboardStats?.kpis?.total_drivers || 1))) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-bold mb-1">
                      <span className="text-amber-500">Pending Verification</span>
                      <span>{adminDashboardStats?.driver_distribution?.pending ?? 0}</span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-950'}`}>
                      <div
                        className="h-full bg-amber-500"
                        style={{
                          width: `${Math.min(
                            100,
                            ((adminDashboardStats?.driver_distribution?.pending || 0) /
                              Math.max(1, (adminDashboardStats?.kpis?.total_drivers || 1))) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-bold mb-1">
                      <span className="text-rose-500">Suspended / Rejected</span>
                      <span>
                        {(adminDashboardStats?.driver_distribution?.suspended || 0) +
                          (adminDashboardStats?.driver_distribution?.rejected || 0)}
                      </span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-950'}`}>
                      <div
                        className="h-full bg-rose-500"
                        style={{
                          width: `${Math.min(
                            100,
                            (((adminDashboardStats?.driver_distribution?.suspended || 0) +
                              (adminDashboardStats?.driver_distribution?.rejected || 0)) /
                              Math.max(1, (adminDashboardStats?.kpis?.total_drivers || 1))) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setAdminTab('DRIVERS')}
                  className="w-full bg-[#E85D04]/10 hover:bg-[#E85D04] hover:text-white text-[#E85D04] font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1"
                >
                  <span>Manage Driver Approvals</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Recent Bookings Live Preview */}
            <div className={`border rounded-3xl p-5 space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
              <div className="flex justify-between items-center">
                <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Recent Platform Dispatches
                </h3>
                <button
                  onClick={() => setAdminTab('BOOKINGS')}
                  className="text-xs text-[#E85D04] font-bold hover:underline"
                >
                  View All Bookings →
                </button>
              </div>

              <div className="overflow-x-auto scrollbar-thin border rounded-2xl">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className={`font-bold uppercase border-b ${isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                    <tr>
                      <th className="p-3">Booking ID</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Driver</th>
                      <th className="p-3">Route</th>
                      <th className="p-3">Fare</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-medium ${isLight ? 'divide-slate-200 text-slate-700' : 'divide-slate-800 text-slate-300'}`}>
                    {(adminDashboardStats?.recent_bookings?.length
                        ? adminDashboardStats.recent_bookings
                        : adminBookingsList.slice(0, 6)).map((b: any) => (
                      <tr key={b.id}>
                        <td className="p-3 font-bold text-red-500">{b.id?.substring(0, 8)}...</td>
                        <td className="p-3">{b.customer_name || b.customerName || 'Customer'}</td>
                        <td className="p-3">{b.driver_name || b.driverName || 'Unassigned'}</td>
                        <td className="p-3 max-w-xs truncate">
                          {b.pickup_name || b.pickup?.name || 'Pickup'} → {b.drop_name || b.drop?.name || 'Drop'}
                        </td>
                        <td className="p-3 font-bold text-emerald-500">₹{b.total_fare || b.fare?.totalFare || 0}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : b.status === 'ASSIGNED'
                                ? 'bg-blue-500/10 text-blue-500'
                                : b.status === 'SEARCHING'
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-slate-500/10 text-slate-400'
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 60. Live Ride Map */}
        {adminTab === 'LIVE_MAP' && (() => {
          const ACTIVE_STATUSES = ['SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'];
          const srcBookings = adminBookingsList.length > 0 ? adminBookingsList : allBookings;
          const activeBookings = srcBookings
            .filter((b: any) => ACTIVE_STATUSES.includes(b.status))
            .sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
          const srcDrivers = adminDriversList.length > 0 ? adminDriversList : allDrivers;
          const onlineDrivers = srcDrivers.filter((d: any) => d.is_online === 1 || d.isOnline);
          const approvedCount = srcDrivers.filter((d: any) => (d.approval_status || d.approvalStatus || '') === 'APPROVED').length;

          const project = (lat: number, lng: number) => {
            const MIN_LAT = 10.96, MAX_LAT = 11.08, MIN_LNG = 76.9, MAX_LNG = 77.01;
            const top = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * 100;
            const left = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * 100;
            return {
              top: `${Math.max(4, Math.min(92, top))}%`,
              left: `${Math.max(4, Math.min(92, left))}%`,
            };
          };

          const driverMarkers = srcDrivers
            .filter((d: any) => d.current_lat != null && d.current_lng != null)
            .map((d: any) => ({
              id: d.id,
              type: 'CAR' as const,
              tone: (d.is_online === 1 || d.isOnline) ? 'online' as const : 'offline' as const,
              label: d.vehicle_number || (d.name || '').split(' ')[0],
              ...project(Number(d.current_lat), Number(d.current_lng)),
            }));

          const routeMarkers = activeBookings.slice(0, 8).flatMap((b: any) => {
            const mk: any[] = [];
            if (b.pickup_lat != null && b.pickup_lng != null) {
              mk.push({ id: `${b.id}-p`, type: 'PICKUP' as const, label: b.pickup_name || 'Pickup', ...project(Number(b.pickup_lat), Number(b.pickup_lng)) });
            }
            if (b.drop_lat != null && b.drop_lng != null) {
              mk.push({ id: `${b.id}-d`, type: 'DROP' as const, label: b.drop_name || 'Drop', ...project(Number(b.drop_lat), Number(b.drop_lng)) });
            }
            return mk;
          });

          const statusChip = (s: string) =>
            ({
              SEARCHING: 'bg-amber-500/10 text-amber-500',
              ASSIGNED: 'bg-blue-500/10 text-blue-500',
              EN_ROUTE: 'bg-cyan-500/10 text-cyan-500',
              ARRIVED: 'bg-violet-500/10 text-violet-500',
              IN_PROGRESS: 'bg-emerald-500/10 text-emerald-500',
              COMPLETED: 'bg-emerald-500/10 text-emerald-500',
              CANCELLED: 'bg-rose-500/10 text-rose-500',
              SCHEDULED: 'bg-slate-500/10 text-slate-400',
            }[s] || 'bg-slate-500/10 text-slate-400');

          return (
            <div className="h-[calc(100vh-160px)] flex flex-col lg:flex-row gap-4">
              <div className="flex-1 rounded-3xl overflow-hidden border border-slate-800 relative flex flex-col min-h-[420px]">
                <div className="flex-1 relative">
                  <InteractiveMap
                    height="h-full"
                    markers={[...driverMarkers, ...routeMarkers]}
                  />
                </div>
                <div className={`absolute top-3 left-3 z-20 flex items-center gap-2 text-[10px] font-bold backdrop-blur border px-2.5 py-1.5 rounded-lg shadow ${isLight ? 'bg-white/90 border-slate-200 text-slate-700' : 'bg-slate-950/80 border-slate-800 text-slate-300'}`}>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {onlineDrivers.length} Online</span>
                  <span className="w-px h-3 bg-slate-500/40" />
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600" /> {driverMarkers.length} Tracked</span>
                  <span className="w-px h-3 bg-slate-500/40" />
                  <span>{activeBookings.length} Active</span>
                  <span className="w-px h-3 bg-slate-500/40" />
                  <button
                    onClick={() => { refreshAdminDataRef.current(); }}
                    title="Refresh live data (auto-refreshes every 15s)"
                    className="flex items-center gap-1 text-red-500 hover:text-red-400 transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>

              <div className={`w-full lg:w-80 border rounded-3xl p-4 overflow-y-auto space-y-3 shadow-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
                <h3 className="text-sm font-extrabold flex items-center justify-between">
                  <span>Active City Dispatch</span>
                  <span className="bg-red-500/10 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/30">
                    {activeBookings.length} Active
                  </span>
                </h3>

                {activeBookings.length === 0 ? (
                  <div className={`border border-dashed p-6 rounded-2xl text-center space-y-1.5 ${isLight ? 'border-slate-300 bg-slate-50' : 'border-slate-700 bg-slate-950'}`}>
                    <Activity className="w-6 h-6 text-slate-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-400">No active rides right now</p>
                    <p className="text-[10px] text-slate-500">New bookings will appear here instantly</p>
                  </div>
                ) : (
                  activeBookings.slice(0, 10).map((b: any) => (
                    <div key={b.id} className={`border p-3 rounded-2xl space-y-1.5 text-xs ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                      <div className="flex justify-between font-bold">
                        <span className="text-red-500">{b.id?.substring(0, 8)}...</span>
                        <span className="text-emerald-400">₹{Number(b.total_fare || b.fare?.totalFare || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <p className={`text-[11px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {b.pickup_name || b.pickup?.name || 'Pickup'} → {b.drop_name || b.drop?.name || 'Drop'}
                      </p>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500">
                          Driver: {b.driver_name || b.driverName || 'Awaiting dispatch'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${statusChip(b.status)}`}>{b.status}</span>
                      </div>
                    </div>
                  ))
                )}

                <div className={`border-t pt-3 text-[10px] ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                  <p className="flex justify-between font-bold">
                    <span>Approved Drivers</span>
                    <span className="text-emerald-500">{approvedCount}</span>
                  </p>
                  <p className="flex justify-between font-bold mt-1">
                    <span>Online Now</span>
                    <span className="text-emerald-500">{onlineDrivers.length}</span>
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 61 & 62. Customer Management & Details (Live from MySQL) */}
        {adminTab === 'CUSTOMERS' && (
          <div className={`border rounded-3xl p-5 space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-lg font-bold">Registered Customer Management</h2>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {adminCustomersList.length} total customers registered in MySQL database
                </p>
              </div>
              <div className={`flex items-center gap-2 border px-3 py-1.5 rounded-xl text-xs ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customers by name, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent outline-none w-48 sm:w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto scrollbar-thin border rounded-2xl">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className={`font-bold uppercase border-b ${isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                  <tr>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Mobile Phone</th>
                    <th className="p-3">Email Address</th>
                    <th className="p-3">Total Rides</th>
                    <th className="p-3">Wallet Balance</th>
                    <th className="p-3">Account Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y font-medium ${isLight ? 'divide-slate-200 text-slate-700' : 'divide-slate-800 text-slate-300'}`}>
                  {adminCustomersList
                    .filter(customerMatches)
                    .slice((custPage - 1) * PAGE_SIZE, custPage * PAGE_SIZE)
                    .map((cust: any) => {
                      const isBlocked = (cust.status || '').toUpperCase() === 'BLOCKED';
                      return (
                        <tr key={cust.id}>
                          <td className="p-3 font-bold flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#E85D04]/15 text-[#E85D04] font-bold flex items-center justify-center text-xs">
                              {cust.name ? cust.name.charAt(0).toUpperCase() : 'C'}
                            </div>
                            <span>{cust.name}</span>
                          </td>
                          <td className="p-3 font-mono">{cust.phone}</td>
                          <td className="p-3 text-slate-400">{cust.email || '—'}</td>
                          <td className="p-3 font-bold">{cust.actual_bookings_count ?? cust.total_rides ?? cust.totalRides ?? 0}</td>
                          <td className="p-3 font-bold text-emerald-500">₹{cust.wallet_balance ?? cust.walletBalance ?? '0.00'}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isBlocked ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
                              }`}
                            >
                              {cust.status || 'ACTIVE'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isBlocked ? (
                                <button
                                  disabled={actionLoadingId === cust.id}
                                  onClick={async () => {
                                    setActionLoadingId(cust.id);
                                    const ok = await adminUpdateCustomerStatus(cust.id, 'ACTIVE');
                                    setActionLoadingId(null);
                                    showToast(ok ? `Customer ${cust.name} unblocked` : `Failed to unblock ${cust.name}`);
                                  }}
                                  className="bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white font-bold px-2 py-1 rounded-lg text-[10px] transition disabled:opacity-50 flex items-center gap-1"
                                >
                                  {actionLoadingId === cust.id && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                                  <span>Unblock</span>
                                </button>
                              ) : (
                                <button
                                  disabled={actionLoadingId === cust.id}
                                  onClick={async () => {
                                    setActionLoadingId(cust.id);
                                    const ok = await adminUpdateCustomerStatus(cust.id, 'BLOCKED');
                                    setActionLoadingId(null);
                                    showToast(ok ? `Customer ${cust.name} blocked` : `Failed to block ${cust.name}`);
                                  }}
                                  className="bg-rose-600/10 text-rose-500 hover:bg-rose-600 hover:text-white font-bold px-2 py-1 rounded-lg text-[10px] transition disabled:opacity-50 flex items-center gap-1"
                                >
                                  {actionLoadingId === cust.id && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                                  <span>Block</span>
                                </button>
                              )}
                              <button
                                disabled={actionLoadingId === cust.id}
                                onClick={async () => {
                                  if (window.confirm(`Are you sure you want to permanently delete customer "${cust.name}"?`)) {
                                    setActionLoadingId(cust.id);
                                    const ok = await adminDeleteCustomer(cust.id);
                                    setActionLoadingId(null);
                                    showToast(ok ? `Customer ${cust.name} deleted successfully` : `Failed to delete ${cust.name}`);
                                  }
                                }}
                                className="bg-rose-500/10 text-rose-600 hover:bg-rose-600 hover:text-white font-bold px-2 py-1 rounded-lg text-[10px] transition disabled:opacity-50 flex items-center gap-1 border border-rose-500/20"
                                title="Delete Customer Account"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {/* Empty state for customer search */}
                  {adminCustomersList.filter(customerMatches).length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
                        No registered customers found matching "{searchQuery}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination total={adminCustomersList.filter(customerMatches).length} page={custPage} label="customers" onChange={setCustPage} isLight={isLight} />
          </div>
        )}

        {/* 63 & 64. Driver Management & Verification (Live from MySQL) */}
        {adminTab === 'DRIVERS' && (
          <div className="space-y-6">
            <div className={`border rounded-3xl p-5 space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-lg font-bold">Drivers</h2>
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {(adminDriversList.length > 0 ? adminDriversList : allDrivers).length} registered • verification, background checks & active partner management
                  </p>
                </div>
                <button
                  onClick={() => showToast('Driver onboarding is handled by the Driver App — new partners register there')}
                  className="bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Driver
                </button>
              </div>

              {/* Toolbar: Search + Status filter */}
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className={`flex items-center gap-2 border px-3 py-2 rounded-xl text-xs flex-1 sm:max-w-xs ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by ID, name, phone…"
                    value={driverSearch}
                    onChange={(e) => setDriverSearch(e.target.value)}
                    className="bg-transparent outline-none w-full"
                  />
                </div>
                <select
                  value={driverFilter}
                  onChange={(e) => setDriverFilter(e.target.value)}
                  className={`border rounded-xl px-3 py-2 text-xs outline-none font-bold ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'}`}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              {/* Table */}
              <div className="overflow-x-auto scrollbar-thin border rounded-2xl">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className={`font-bold uppercase border-b ${isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                    <tr>
                      <th className="p-3">Driver ID</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-medium ${isLight ? 'divide-slate-200 text-slate-700' : 'divide-slate-800 text-slate-300'}`}>
                    {(adminDriversList.length > 0 ? adminDriversList : allDrivers)
                      .filter(driverMatches)
                      .filter(driverSearchMatches)
                      .slice((drvPage - 1) * PAGE_SIZE, drvPage * PAGE_SIZE)
                      .map((d: any) => {
                        const status = (d.approval_status || d.approvalStatus || '').toUpperCase();
                        const online = d.is_online === 1 || d.is_online === '1' || d.is_online === true || d.isOnline === 1 || d.isOnline === '1' || d.isOnline === true;

                        return (
                          <tr key={d.id} className="hover:bg-slate-800/20 transition">
                            <td className="p-3 font-mono font-bold text-red-500">
                              {d.driver_code ? d.driver_code : `#${(d.id || '').substring(0, 8).toUpperCase()}`}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2.5">
                                {(() => {
                                  const photo = (d.photo_url || d.photo || '').trim();
                                  const hasPhoto = Boolean(photo && !photo.includes('unsplash'));
                                  if (hasPhoto) {
                                    return (
                                      <img
                                        src={photo}
                                        className="w-8 h-8 rounded-full object-cover border border-slate-400 shrink-0"
                                        alt={d.name}
                                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                      />
                                    );
                                  }
                                  return (
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${isLight ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                                      <User className="w-4 h-4 text-slate-400" />
                                    </div>
                                  );
                                })()}
                                <div>
                                  <p className="font-bold">{d.name}</p>
                                  <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {d.vehicle_model || d.vehicleModel || 'Standard'} • {d.vehicle_number || d.vehicleNumber || 'No Plate'}
                                    {d.license_number ? ` • DL: ${d.license_number}` : ''}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 font-mono">{d.phone || '—'}</td>
                            <td className="p-3">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  status === 'APPROVED'
                                    ? 'bg-emerald-500/10 text-emerald-500'
                                    : status === 'PENDING'
                                    ? 'bg-amber-500/10 text-amber-500'
                                    : status === 'SUSPENDED'
                                    ? 'bg-violet-500/10 text-violet-500'
                                    : 'bg-rose-500/10 text-rose-500'
                                }`}
                              >
                                {status}
                              </span>
                              {online && (
                                <span className="ml-2 text-[9px] font-bold text-emerald-400 flex items-center gap-1 inline-flex">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  Online
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => setDriverView(d)}
                                  className={`font-bold px-2.5 py-1.5 rounded-xl text-[10px] border transition flex items-center gap-1 ${
                                    isLight ? 'bg-orange-50 border-orange-200 text-[#E85D04] hover:bg-orange-100' : 'bg-orange-950/40 border-orange-800 text-orange-400 hover:text-white'
                                  }`}
                                  title="Inspect Driver Documents & Driving Licence"
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>View License</span>
                                </button>
                                {status === 'PENDING' ? (
                                  <>
                                    <button
                                      onClick={async () => {
                                        const ok = await adminSetDriverApproval(d.id, 'APPROVED');
                                        showToast(ok ? `Driver ${d.name} approved!` : `Failed to approve ${d.name}`);
                                      }}
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1.5 rounded-xl text-[10px] transition flex items-center gap-1"
                                    >
                                      <UserCheck className="w-3 h-3" />
                                      <span>Approve</span>
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const ok = await adminSetDriverApproval(d.id, 'REJECTED');
                                        showToast(ok ? `Driver ${d.name} rejected.` : `Failed to reject ${d.name}`);
                                      }}
                                      className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-2.5 py-1.5 rounded-xl text-[10px] transition flex items-center gap-1"
                                    >
                                      <UserX className="w-3 h-3" />
                                      <span>Reject</span>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={async () => {
                                      const next = status === 'APPROVED' ? 'SUSPENDED' : 'APPROVED';
                                      const ok = await adminSetDriverApproval(d.id, next);
                                      showToast(
                                        ok
                                          ? status === 'APPROVED'
                                            ? `Driver ${d.name} suspended`
                                            : `Driver ${d.name} activated`
                                          : `Action failed for ${d.name}`
                                      );
                                    }}
                                    className={`font-bold px-2.5 py-1.5 rounded-xl text-[10px] border transition ${
                                      status === 'APPROVED'
                                        ? 'border-violet-500/30 text-violet-500 hover:bg-violet-600 hover:text-white'
                                        : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-600 hover:text-white'
                                    }`}
                                  >
                                    {status === 'APPROVED' ? 'Suspend' : 'Activate'}
                                  </button>
                                )}
                                <button
                                  disabled={actionLoadingId === d.id}
                                  onClick={async () => {
                                    if (window.confirm(`Are you sure you want to permanently delete driver partner "${d.name}"?`)) {
                                      setActionLoadingId(d.id);
                                      const ok = await adminDeleteDriver(d.id);
                                      setActionLoadingId(null);
                                      showToast(ok ? `Driver ${d.name} deleted successfully` : `Failed to delete ${d.name}`);
                                    }
                                  }}
                                  className="border border-rose-500/30 text-rose-500 hover:bg-rose-600 hover:text-white font-bold px-2 py-1.5 rounded-xl text-[10px] transition flex items-center gap-1"
                                  title="Delete Driver Account"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                    {(adminDriversList.length > 0 ? adminDriversList : allDrivers)
                      .filter(driverMatches)
                      .filter(driverSearchMatches).length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 font-bold">
                          No drivers found matching your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                total={(adminDriversList.length > 0 ? adminDriversList : allDrivers).filter(driverMatches).filter(driverSearchMatches).length}
                page={drvPage}
                label="drivers"
                onChange={setDrvPage}
                isLight={isLight}
              />
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* DEDICATED PARTNER VERIFICATION & APPROVALS SECTION                */}
        {/* ================================================================= */}
        {adminTab === 'DRIVER_APPROVALS' && (() => {
          const rawDrivers = adminDriversList.length > 0 ? adminDriversList : allDrivers;

          const pendingList = rawDrivers.filter((d) => (d.approval_status || d.approvalStatus || '').toUpperCase() === 'PENDING');
          const approvedList = rawDrivers.filter((d) => (d.approval_status || d.approvalStatus || '').toUpperCase() === 'APPROVED');
          const rejectedList = rawDrivers.filter((d) => ['REJECTED', 'SUSPENDED', 'BLOCKED'].includes((d.approval_status || d.approvalStatus || '').toUpperCase()));

          const filteredList = rawDrivers.filter((d) => {
            const st = (d.approval_status || d.approvalStatus || '').toUpperCase();
            if (verifStatusFilter === 'PENDING' && st !== 'PENDING') return false;
            if (verifStatusFilter === 'APPROVED' && st !== 'APPROVED') return false;
            if (verifStatusFilter === 'REJECTED' && !['REJECTED', 'SUSPENDED', 'BLOCKED'].includes(st)) return false;

            if (verifSearch.trim()) {
              const q = verifSearch.toLowerCase();
              const name = String(d.name || '').toLowerCase();
              const phone = String(d.phone || '').toLowerCase();
              const plate = String(d.vehicle_number || d.vehicleNumber || '').toLowerCase();
              const model = String(d.vehicle_model || d.vehicleModel || '').toLowerCase();
              const dl = String(d.license_number || '').toLowerCase();
              const id = String(d.id || '').toLowerCase();
              return name.includes(q) || phone.includes(q) || plate.includes(q) || model.includes(q) || dl.includes(q) || id.includes(q);
            }
            return true;
          });

          const pagedList = filteredList.slice((verifPage - 1) * PAGE_SIZE, verifPage * PAGE_SIZE);

          return (
            <div className="space-y-6">
              {/* Top Header Card */}
              <div className={`border rounded-3xl p-5 space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-[#E85D04]">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Partner Verification & Approvals</h2>
                      <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Review driver Driving Licences, vehicle plate numbers, and approve partner registrations
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      refreshAdminData();
                      showToast('Driver verification list refreshed');
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#E85D04]" />
                    <span>Refresh List</span>
                  </button>
                </div>

                {/* 3 Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setVerifStatusFilter('PENDING'); setVerifPage(1); }}
                    className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
                      verifStatusFilter === 'PENDING'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-500 shadow-sm'
                        : isLight ? 'bg-slate-50 border-slate-200 hover:bg-slate-100' : 'bg-slate-950 border-slate-800 hover:bg-slate-800/40'
                    }`}
                  >
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500">Pending Review</p>
                      <h3 className="text-2xl font-black mt-0.5">{pendingList.length}</h3>
                      <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Awaiting admin verification</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                      <Clock className="w-5 h-5" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setVerifStatusFilter('APPROVED'); setVerifPage(1); }}
                    className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
                      verifStatusFilter === 'APPROVED'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-500 shadow-sm'
                        : isLight ? 'bg-slate-50 border-slate-200 hover:bg-slate-100' : 'bg-slate-950 border-slate-800 hover:bg-slate-800/40'
                    }`}
                  >
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">Approved Partners</p>
                      <h3 className="text-2xl font-black mt-0.5">{approvedList.length}</h3>
                      <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Active & verified</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setVerifStatusFilter('REJECTED'); setVerifPage(1); }}
                    className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
                      verifStatusFilter === 'REJECTED'
                        ? 'bg-rose-500/15 border-rose-500 text-rose-500 shadow-sm'
                        : isLight ? 'bg-slate-50 border-slate-200 hover:bg-slate-100' : 'bg-slate-950 border-slate-800 hover:bg-slate-800/40'
                    }`}
                  >
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Rejected / Suspended</p>
                      <h3 className="text-2xl font-black mt-0.5">{rejectedList.length}</h3>
                      <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Action required</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center">
                      <UserX className="w-5 h-5" />
                    </div>
                  </button>
                </div>

                {/* Search & Tabs Toolbar */}
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between pt-2">
                  <div className={`flex items-center gap-2 border px-3 py-2 rounded-xl text-xs flex-1 sm:max-w-md ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search driver by name, phone, plate number, or DL..."
                      value={verifSearch}
                      onChange={(e) => { setVerifSearch(e.target.value); setVerifPage(1); }}
                      className="bg-transparent outline-none w-full"
                    />
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => { setVerifStatusFilter(filter); setVerifPage(1); }}
                        className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition ${
                          verifStatusFilter === filter
                            ? 'bg-[#E85D04] text-white border-[#E85D04] shadow'
                            : isLight ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {filter === 'PENDING' ? `Pending (${pendingList.length})` : filter === 'APPROVED' ? `Approved (${approvedList.length})` : filter === 'REJECTED' ? `Rejected (${rejectedList.length})` : `All (${rawDrivers.length})`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Verification Applications List / Cards */}
                <div className="space-y-3 pt-2">
                  {pagedList.length === 0 ? (
                    <div className={`p-12 text-center rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'} space-y-2`}>
                      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-sm">No verification requests found</h4>
                      <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {verifStatusFilter === 'PENDING'
                          ? 'All partner driver applications have been reviewed and approved!'
                          : 'No drivers match your current filter search criteria.'}
                      </p>
                    </div>
                  ) : (
                    pagedList.map((d: any) => {
                      const st = (d.approval_status || d.approvalStatus || '').toUpperCase();
                      const isPending = st === 'PENDING';
                      const isApproved = st === 'APPROVED';
                      const dlNumber = d.license_number || d.licenseNumber || '';
                      const rawPhotoUrl = d.license_photo_url || d.licensePhotoUrl || '';
                      const dlPhotoUrl = rawPhotoUrl
                        ? (rawPhotoUrl.startsWith('http') || rawPhotoUrl.startsWith('data:') ? rawPhotoUrl : `${import.meta.env.VITE_API_URL || ''}${rawPhotoUrl}`)
                        : '';
                      const vCategory = (d.vehicle_type || d.driver_type || '').toUpperCase();

                      return (
                        <div
                          key={d.id}
                          className={`border rounded-2xl p-4 transition shadow-sm space-y-3 ${
                            isPending
                              ? isLight ? 'bg-amber-50/40 border-amber-300' : 'bg-amber-950/15 border-amber-800/60'
                              : isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            {/* Driver Core Details */}
                            <div className="flex items-start sm:items-center gap-3">
                              {(() => {
                                const photo = (d.photo_url || d.photo || '').trim();
                                const hasPhoto = Boolean(photo && !photo.includes('unsplash'));
                                if (hasPhoto) {
                                  return (
                                    <img
                                      src={photo}
                                      className="w-12 h-12 rounded-2xl object-cover border border-slate-300 shrink-0"
                                      alt={d.name}
                                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                    />
                                  );
                                }
                                return (
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${isLight ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                                    <User className="w-6 h-6 text-slate-400" />
                                  </div>
                                );
                              })()}
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-extrabold text-sm">{d.name}</h3>
                                  <span className="font-mono text-[10px] text-red-500 font-bold">
                                    {d.driver_code ? d.driver_code : `#${(d.id || '').substring(0, 8).toUpperCase()}`}
                                  </span>
                                  <span
                                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                      isApproved
                                        ? 'bg-emerald-500/15 text-emerald-600'
                                        : isPending
                                        ? 'bg-amber-500/15 text-amber-600 font-extrabold'
                                        : 'bg-rose-500/15 text-rose-600'
                                    }`}
                                  >
                                    {st || 'PENDING'}
                                  </span>
                                </div>
                                <p className={`text-xs font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                  📱 {d.phone || 'No phone'}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5">
                                  <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-semibold flex items-center gap-1">
                                    {vCategory === 'TWO_WHEELER' ? <Bike className="w-3 h-3 text-orange-500" /> : <Car className="w-3 h-3 text-orange-500" />}
                                    {vCategory === 'TWO_WHEELER' ? 'Two-Wheeler' : vCategory === 'ACTING_DRIVER' ? 'Active Driver (Customer Car)' : 'Taxi Cab'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Vehicle & DL Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs flex-1 lg:max-w-md">
                              <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                                <span className="text-[10px] text-slate-500 block font-semibold">Vehicle Details</span>
                                <p className="font-bold truncate mt-0.5">{d.vehicle_model || d.vehicleModel || 'Standard Vehicle'}</p>
                                <p className="font-mono font-extrabold text-[11px] text-[#E85D04] mt-0.5">
                                  {d.vehicle_number || d.vehicleNumber || (vCategory === 'ACTING_DRIVER' ? 'Customer Vehicle' : 'No Plate')}
                                </p>
                              </div>

                              <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                                <span className="text-[10px] text-slate-500 block font-semibold">Driving Licence (DL)</span>
                                <p className="font-mono font-bold text-xs mt-0.5">{dlNumber || 'Not Provided'}</p>
                                {dlPhotoUrl ? (
                                  <a
                                    href={dlPhotoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-bold text-[#E85D04] hover:underline flex items-center gap-1 mt-0.5"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>Inspect DL Photo ↗</span>
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-slate-400 mt-0.5 block">No DL photo attached</span>
                                )}
                              </div>
                            </div>

                            {/* DL Photo Thumbnail if present */}
                            {dlPhotoUrl && (
                              <div className="shrink-0 flex items-center">
                                <div
                                  className="w-20 h-14 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-black cursor-pointer hover:scale-105 transition shadow"
                                  title="Click to inspect driving licence photo"
                                  onClick={() => window.open(dlPhotoUrl, '_blank')}
                                >
                                  <img src={dlPhotoUrl} alt="DL Thumbnail" className="w-full h-full object-cover" />
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex sm:flex-col gap-2 shrink-0 justify-end">
                              {isPending ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={actionLoadingId === d.id}
                                    onClick={async () => {
                                      setActionLoadingId(d.id);
                                      const ok = await adminSetDriverApproval(d.id, 'APPROVED');
                                      setActionLoadingId(null);
                                      showToast(ok ? `Driver partner ${d.name} approved successfully!` : `Failed to approve ${d.name}`);
                                      if (ok) refreshAdminData();
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>Approve</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={actionLoadingId === d.id}
                                    onClick={async () => {
                                      setActionLoadingId(d.id);
                                      const ok = await adminSetDriverApproval(d.id, 'REJECTED');
                                      setActionLoadingId(null);
                                      showToast(ok ? `Driver partner ${d.name} rejected.` : `Failed to reject ${d.name}`);
                                      if (ok) refreshAdminData();
                                    }}
                                    className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition"
                                  >
                                    <UserX className="w-3.5 h-3.5" />
                                    <span>Reject</span>
                                  </button>
                                </>
                              ) : isApproved ? (
                                <button
                                  type="button"
                                  disabled={actionLoadingId === d.id}
                                  onClick={async () => {
                                    setActionLoadingId(d.id);
                                    const ok = await adminSetDriverApproval(d.id, 'SUSPENDED');
                                    setActionLoadingId(null);
                                    showToast(ok ? `Driver ${d.name} suspended.` : `Action failed`);
                                    if (ok) refreshAdminData();
                                  }}
                                  className="border border-violet-500/30 text-violet-500 hover:bg-violet-600 hover:text-white font-bold px-3 py-2 rounded-xl text-xs transition"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={actionLoadingId === d.id}
                                  onClick={async () => {
                                    setActionLoadingId(d.id);
                                    const ok = await adminSetDriverApproval(d.id, 'APPROVED');
                                    setActionLoadingId(null);
                                    showToast(ok ? `Driver ${d.name} approved!` : `Action failed`);
                                    if (ok) refreshAdminData();
                                  }}
                                  className="border border-emerald-500/30 text-emerald-500 hover:bg-emerald-600 hover:text-white font-bold px-3 py-2 rounded-xl text-xs transition"
                                >
                                  Re-Approve
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setDriverView(d)}
                                className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border transition ${
                                  isLight ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                                }`}
                              >
                                View Modal
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <Pagination
                  total={filteredList.length}
                  page={verifPage}
                  label="driver applications"
                  onChange={setVerifPage}
                  isLight={isLight}
                />
              </div>
            </div>
          );
        })()}

        {/* Vehicles Fleet (Live from MySQL) */}
        {adminTab === 'VEHICLES' && (
          <div className={`border rounded-3xl p-5 space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-lg font-bold">Vehicle Fleet Management</h2>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Dynamic ride classes, pricing tiers, and registered partner vehicles directory
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setVehicleSubTab('CLASSES')}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition ${
                    vehicleSubTab === 'CLASSES'
                      ? 'bg-[#E85D04] text-white border-[#E85D04] shadow'
                      : isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  Fleet Classes & Pricing ({adminVehiclesList.length})
                </button>
                <button
                  onClick={() => setVehicleSubTab('PARTNERS')}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition ${
                    vehicleSubTab === 'PARTNERS'
                      ? 'bg-[#E85D04] text-white border-[#E85D04] shadow'
                      : isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  Partner Vehicles Directory ({adminPartnerVehiclesList.length})
                </button>
              </div>
            </div>

            {vehicleSubTab === 'CLASSES' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(adminVehiclesList.length > 0 ? adminVehiclesList : [
                  { id: '1', name: 'Red Mini', category: 'Hatchback', capacity: 4, base_price: 99, per_km_rate: 14, is_active: 1, active_assigned_vehicles: 12 },
                  { id: '2', name: 'Red Sedan', category: 'Sedan', capacity: 4, base_price: 149, per_km_rate: 18, is_active: 1, active_assigned_vehicles: 18 },
                  { id: '3', name: 'Red SUV Prime', category: 'SUV', capacity: 6, base_price: 199, per_km_rate: 24, is_active: 1, active_assigned_vehicles: 8 },
                  { id: '4', name: 'Red Outstation', category: 'Intercity', capacity: 5, base_price: 499, per_km_rate: 16, is_active: 1, active_assigned_vehicles: 6 },
                ]).map((v: any) => {
                  const isActive = Boolean(parseInt(v.is_active));
                  const isUpdating = actionLoadingId === `veh-${v.id}`;
                  return (
                    <div
                      key={v.id}
                      className={`border p-4 rounded-2xl space-y-3 text-xs shadow ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-sm text-red-500">{v.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'
                          }`}
                        >
                          {isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Category</span>
                          <span className="font-semibold">{v.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Seating</span>
                          <span className="font-semibold">{v.capacity} Seats</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Base Fare</span>
                          <span className="font-bold text-emerald-500">₹{v.base_price}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Per KM Rate</span>
                          <span className="font-bold text-emerald-500">₹{v.per_km_rate}/km</span>
                        </div>
                      </div>

                      <button
                        disabled={isUpdating}
                        onClick={async () => {
                          setActionLoadingId(`veh-${v.id}`);
                          await adminToggleVehicleCategory(v.id);
                          setActionLoadingId(null);
                          showToast(`Vehicle class ${v.name} status updated`);
                        }}
                        className={`w-full py-1.5 rounded-xl font-bold text-[11px] border transition disabled:opacity-50 flex items-center justify-center gap-1 ${
                          isActive
                            ? 'border-slate-700 text-slate-400 hover:bg-slate-800'
                            : 'border-emerald-500/40 text-emerald-500 hover:bg-emerald-600 hover:text-white'
                        }`}
                      >
                        {isUpdating && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                        <span>{isActive ? 'Disable Category' : 'Enable Category'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto scrollbar-thin border rounded-2xl">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className={`font-bold uppercase border-b ${isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                    <tr>
                      <th className="p-3">Vehicle Model & Plate</th>
                      <th className="p-3">Vehicle Class</th>
                      <th className="p-3">Color / Year</th>
                      <th className="p-3">Assigned Driver</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-medium ${isLight ? 'divide-slate-200 text-slate-700' : 'divide-slate-800 text-slate-300'}`}>
                    {adminPartnerVehiclesList
                      .slice((pvPage - 1) * PAGE_SIZE, pvPage * PAGE_SIZE)
                      .map((pv: any) => (
                      <tr key={pv.id} className="hover:bg-slate-800/20 transition">
                        <td className="p-3 font-bold">
                          <div>
                            <span className="text-sm">{pv.vehicle_model}</span>
                            <div className="font-mono text-xs text-red-500">{pv.vehicle_number}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] font-bold text-slate-300">
                            {pv.category_name || pv.vehicle_type || 'Standard'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">
                          {pv.color || 'White'} • {pv.year || '2024'}
                        </td>
                        <td className="p-3 font-semibold">
                          {pv.driver_name || 'Unassigned'}
                        </td>
                        <td className="p-3 font-mono text-slate-400">
                          {pv.driver_phone || '—'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pv.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'
                            }`}
                          >
                            {pv.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {adminPartnerVehiclesList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 font-bold">
                          No partner driver vehicles registered in the database.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination total={adminPartnerVehiclesList.length} page={pvPage} label="vehicles" onChange={setPvPage} isLight={isLight} />
              </>
            )}
          </div>
        )}

        {/* Bookings Audit Log & Driver Assignment (Live from MySQL) */}
        {adminTab === 'BOOKINGS' && (
          <div className={`border rounded-3xl p-5 space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-lg font-bold">Trip Bookings Log & Dispatch Console</h2>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Manual admin driver assignment & live ride lifecycle control
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
                <select
                  value={bookingStatusFilter}
                  onChange={(e) => setBookingStatusFilter(e.target.value)}
                  className={`border rounded-xl px-3 py-1.5 text-xs outline-none font-bold ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'
                  }`}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SEARCHING">Searching (Unassigned)</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                {/* Search Box */}
                <div className={`flex items-center gap-2 border px-3 py-1.5 rounded-xl text-xs ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by ID, customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent outline-none w-36 sm:w-48"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto scrollbar-thin border rounded-2xl">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className={`font-bold uppercase border-b ${isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                  <tr>
                    <th className="p-3">Booking ID</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Assigned Driver</th>
                    <th className="p-3">Route (Pickup → Drop)</th>
                    <th className="p-3">Fare Amount</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Dispatch Action</th>
                  </tr>
                </thead>
                <tbody className={`divide-y font-medium ${isLight ? 'divide-slate-200 text-slate-700' : 'divide-slate-800 text-slate-300'}`}>
                  {(adminBookingsList.length > 0 ? adminBookingsList : allBookings)
                    .filter(bookingMatches)
                    .slice((bkPage - 1) * PAGE_SIZE, bkPage * PAGE_SIZE)
                    .map((b: any) => {
                      const isUnassigned = b.status === 'SEARCHING' || !b.driver_id;
                      return (
                        <tr key={b.id} className="hover:bg-slate-800/20 transition">
                          <td className="p-3 font-bold text-red-500 font-mono">
                            {b.id?.substring(0, 8)}...
                          </td>
                          <td className="p-3 font-semibold">
                            {b.customer_name || b.customerName || 'Customer'}
                          </td>
                          <td className="p-3 font-medium">
                            {b.driver_name || b.driverName ? (
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span>{b.driver_name || b.driverName}</span>
                              </div>
                            ) : (
                              <span className="text-amber-500 italic">Pending Assignment</span>
                            )}
                          </td>
                          <td className="p-3 max-w-xs truncate">
                            <span className="font-semibold">{b.pickup_name || b.pickup?.name || 'Pickup'}</span>
                            <span className="text-slate-500"> → </span>
                            <span>{b.drop_name || b.drop?.name || 'Drop'}</span>
                          </td>
                          <td className="p-3 font-bold text-emerald-500">
                            ₹{b.total_fare || b.fare?.totalFare || 0}
                          </td>
                          <td className="p-3">
                            <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-bold text-[10px]">
                              {b.payment_method || b.paymentMethod || 'UPI'} ({b.payment_status || b.paymentStatus || 'PENDING'})
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                b.status === 'COMPLETED'
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : b.status === 'ASSIGNED'
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : b.status === 'SEARCHING'
                                  ? 'bg-amber-500/10 text-amber-500'
                                  : 'bg-slate-500/10 text-slate-400'
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setSelectedBookingDetailModal(b)}
                                className={`font-bold px-2.5 py-1.5 rounded-xl text-[10px] border transition flex items-center gap-1 ${
                                  isLight ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                                }`}
                                title="View Full Ride Details"
                              >
                                <span>Details</span>
                              </button>
                              {b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && (
                                <button
                                  onClick={() => {
                                    setAssignModalBooking(b);
                                    setSelectedDriverForAssign(b.driver_id || (approvedDrivers[0]?.id || ''));
                                    setAssignMessage(null);
                                  }}
                                  className="bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold px-2.5 py-1.5 rounded-xl text-[10px] shadow transition flex items-center gap-1"
                                >
                                  <Car className="w-3.5 h-3.5" />
                                  <span>{isUnassigned ? 'Assign Driver' : 'Reassign'}</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {/* Empty state for bookings */}
                  {(adminBookingsList.length > 0 ? adminBookingsList : allBookings).filter(bookingMatches).length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 font-bold">
                        No bookings found matching filter "{bookingStatusFilter}" and search "{searchQuery}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              total={(adminBookingsList.length > 0 ? adminBookingsList : allBookings).filter(bookingMatches).length}
              page={bkPage}
              label="bookings"
              onChange={setBkPage}
              isLight={isLight}
            />
          </div>
        )}

        {/* Dynamic Fare Matrix (Live from MySQL) */}
        {adminTab === 'FARE_MGMT' && (
          <div className={`border rounded-3xl p-5 space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Dynamic Pricing & Fare Rules Matrix</h2>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Controls live customer ride cost calculations stored in MySQL
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(adminFareRulesList.length > 0 ? adminFareRulesList : fareRules).map((rule: any) => {
                const categoryName = rule.category_name || rule.category || 'Category';
                return (
                  <div
                    key={rule.id || rule.category}
                    className={`border p-4 rounded-2xl space-y-3 text-xs shadow ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-extrabold text-sm text-[#E85D04]">{categoryName}</h3>
                      <button
                        onClick={() => {
                          setEditingFareRule(rule);
                          setFareBasePrice(parseFloat(rule.base_fare || rule.baseFare || 99));
                          setFarePerKm(parseFloat(rule.per_km || rule.perKm || 14));
                          setFareFreeKm(parseFloat(rule.free_km || rule.freeKm || 0));
                        }}
                        className="text-[#E85D04] hover:text-[#C2410C] font-bold flex items-center gap-1 text-[11px]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Pricing</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Base Fare</span>
                        <span className="font-bold text-emerald-500">₹{rule.base_fare || rule.baseFare}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Per KM Charge</span>
                        <span className="font-bold text-emerald-500">₹{rule.per_km || rule.perKm}/km</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Free KM Included</span>
                        <span className="font-bold">{rule.free_km || rule.freeKm || 0} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Platform Fee</span>
                        <span className="font-bold">₹{rule.platform_fee || rule.platformFee || 10}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>GST Tax</span>
                        <span className="font-bold">{rule.tax_percent || rule.taxPercent || 5}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Coupons & Promo Manager */}
        {adminTab === 'COUPONS' && (
          <div className={`border rounded-3xl p-5 space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Coupons & Promo Codes</h2>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{couponsList.length} campaign(s) configured</p>
              </div>
              <button
                onClick={() => setCouponFormOpen((v) => !v)}
                className="bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow transition"
              >
                {couponFormOpen ? 'Cancel' : '+ Create Coupon'}
              </button>
            </div>

            {couponFormOpen && (
              <div className={`border p-4 rounded-2xl space-y-3 text-xs ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <input
                    type="text" placeholder="Code (e.g. SAVE50)"
                    value={couponForm.code}
                    onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                    className={`border rounded-xl p-2.5 outline-none ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}
                  />
                  <select
                    value={couponForm.discount_type}
                    onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })}
                    className={`border rounded-xl p-2.5 outline-none ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}
                  >
                    <option value="FLAT">Flat ₹ OFF</option>
                    <option value="PERCENT">Percent % OFF</option>
                  </select>
                  <input
                    type="number" placeholder="Discount value"
                    value={couponForm.discount}
                    onChange={(e) => setCouponForm({ ...couponForm, discount: e.target.value })}
                    className={`border rounded-xl p-2.5 outline-none ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}
                  />
                  <input
                    type="number" placeholder="Min order (₹, optional)"
                    value={couponForm.min_order}
                    onChange={(e) => setCouponForm({ ...couponForm, min_order: e.target.value })}
                    className={`border rounded-xl p-2.5 outline-none ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}
                  />
                  <input
                    type="number" placeholder="Max discount (₹, optional)"
                    value={couponForm.max_discount}
                    onChange={(e) => setCouponForm({ ...couponForm, max_discount: e.target.value })}
                    className={`border rounded-xl p-2.5 outline-none ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}
                  />
                  <input
                    type="date" placeholder="Valid until"
                    value={couponForm.expiry}
                    onChange={(e) => setCouponForm({ ...couponForm, expiry: e.target.value })}
                    className={`border rounded-xl p-2.5 outline-none ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    disabled={couponSaving}
                    onClick={async () => {
                      if (!couponForm.code.trim()) { showToast('Coupon code is required'); return; }
                      if (!couponForm.discount) { showToast('Discount value is required'); return; }
                      setCouponSaving(true);
                      const res = await adminApi.createCoupon({
                        code: couponForm.code.trim(),
                        discount_type: couponForm.discount_type,
                        discount: parseFloat(couponForm.discount),
                        min_order: couponForm.min_order ? parseFloat(couponForm.min_order) : 0,
                        max_discount: couponForm.max_discount ? parseFloat(couponForm.max_discount) : null,
                        expiry: couponForm.expiry || undefined,
                      });
                      setCouponSaving(false);
                      showToast(res.success ? `Coupon ${couponForm.code} created` : (res.message || 'Failed to create coupon'));
                      if (res.success) {
                        setCouponForm({ code: '', discount_type: 'FLAT', discount: '', min_order: '', max_discount: '', expiry: '' });
                        setCouponFormOpen(false);
                        const r = await adminApi.getCoupons({ limit: 1000 });
                        if (r.success) setCouponsList(r.data?.coupons || []);
                      }
                    }}
                    className="bg-[#E85D04] hover:bg-[#C2410C] disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition"
                  >
                    {couponSaving ? 'Saving…' : 'Create Coupon'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {couponsLoading && (
                <div className={`col-span-full text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Loading coupons…</div>
              )}
              {!couponsLoading && couponsList.length === 0 && (
                <div className={`col-span-full text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>No coupons yet. Create your first promo code.</div>
              )}
              {couponsList.map((c: any, idx: number) => (
                <div key={c.id || idx} className={`border p-4 rounded-2xl space-y-3 text-xs shadow ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-sm text-[#E85D04] border border-[#E85D04]/30 px-2 py-0.5 rounded bg-[#E85D04]/10">{c.code}</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${c.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>
                      {c.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className={isLight ? 'text-slate-600' : 'text-slate-300'}>{c.description || `Min order ₹${c.min_order || 0}`}</p>
                  <div className="flex justify-between font-bold pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-emerald-500">{c.discount_type === 'PERCENT' ? `${c.discount}% OFF` : `₹${c.discount} OFF`}</span>
                    <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>{(c.used_count ? `Used ${c.used_count}/${c.max_uses} • ` : '')}Valid {c.expiry || '—'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const r = await adminApi.toggleCoupon(c.id);
                        showToast(r.success ? `Coupon ${c.code} ${c.is_active ? 'disabled' : 'enabled'}` : (r.message || 'Toggle failed'));
                        if (r.success) setCouponsList((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: !x.is_active } : x)));
                      }}
                      className={`flex-1 border font-bold px-2 py-1.5 rounded-xl transition ${isLight ? 'border-slate-300 text-slate-600 hover:bg-slate-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                    >
                      {c.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={async () => {
                        const r = await adminApi.deleteCoupon(c.id);
                        showToast(r.success ? `Coupon ${c.code} deleted` : (r.message || 'Delete failed'));
                        if (r.success) setCouponsList((prev) => prev.filter((x) => x.id !== c.id));
                      }}
                      className="border border-[#E85D04]/40 text-[#E85D04] font-bold px-2 py-1.5 rounded-xl hover:bg-[#E85D04]/10 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Offers & Campaigns */}
        {adminTab === 'OFFERS' && (
          <div className={`border rounded-3xl p-5 space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-bold">Promotional Banners & Deals</h2>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{offersList.length} banner(s) live</p>
              </div>
              <button
                onClick={() => setOfferFormOpen((v) => !v)}
                className="bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow transition"
              >
                {offerFormOpen ? 'Cancel' : '+ Create Offer Banner'}
              </button>
            </div>

            {offerFormOpen && (
              <div className={`border p-4 rounded-2xl space-y-3 text-xs ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text" placeholder="Offer title"
                    value={offerForm.title}
                    onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                    className={`border rounded-xl p-2.5 outline-none ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}
                  />
                  <input
                    type="text" placeholder="Discount tag (e.g. 20% OFF)"
                    value={offerForm.tag}
                    onChange={(e) => setOfferForm({ ...offerForm, tag: e.target.value })}
                    className={`border rounded-xl p-2.5 outline-none ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}
                  />
                  <input
                    type="text" placeholder="Short description"
                    value={offerForm.description}
                    onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                    className={`border rounded-xl p-2.5 outline-none sm:col-span-2 ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}
                  />
                  <select
                    value={offerForm.target_audience}
                    onChange={(e) => setOfferForm({ ...offerForm, target_audience: e.target.value })}
                    className={`border rounded-xl p-2.5 outline-none ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}
                  >
                    <option value="ALL">All Users</option>
                    <option value="CUSTOMERS">Customers Only</option>
                    <option value="DRIVERS">Drivers Only</option>
                    <option value="NEW_USERS">New Users</option>
                  </select>
                </div>
                <div className="flex justify-end">
                  <button
                    disabled={offerSaving}
                    onClick={async () => {
                      if (!offerForm.title.trim()) { showToast('Offer title is required'); return; }
                      setOfferSaving(true);
                      const res = await adminApi.createOffer({
                        title: offerForm.title.trim(),
                        tag: offerForm.tag.trim() || undefined,
                        description: offerForm.description.trim(),
                        target_audience: offerForm.target_audience,
                      });
                      setOfferSaving(false);
                      showToast(res.success ? 'Offer banner created' : (res.message || 'Failed to create offer'));
                      if (res.success) {
                        setOfferForm({ title: '', tag: '', description: '', target_audience: 'ALL' });
                        setOfferFormOpen(false);
                        const r = await adminApi.getOffers();
                        if (r.success) setOffersList(r.data?.offers || []);
                      }
                    }}
                    className="bg-[#E85D04] hover:bg-[#C2410C] disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition"
                  >
                    {offerSaving ? 'Saving…' : 'Create Offer'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offersLoading && <div className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Loading offers…</div>}
              {!offersLoading && offersList.length === 0 && (
                <div className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>No offers yet. Create your first promotional banner.</div>
              )}
              {offersList.map((o: any) => (
                <div key={o.id} className={`bg-gradient-to-r ${isLight ? 'from-[#E85D04] to-[#F59E0B]' : 'from-[#7C2D12] to-[#9A3412]'} p-5 rounded-3xl text-white space-y-2 shadow-xl`}>
                  <div className="flex items-start justify-between">
                    <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-extrabold">{o.tag || (o.target_audience || 'PROMO')}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${o.is_active ? 'bg-emerald-400/30 text-emerald-200' : 'bg-slate-400/30 text-slate-200'}`}>
                      {o.is_active ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold">{o.title}</h3>
                  <p className="text-xs text-white/70">{o.description || `Targets ${o.target_audience || 'ALL'}`}</p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={async () => {
                        const r = await adminApi.toggleOffer(o.id);
                        showToast(r.success ? `Offer ${o.is_active ? 'disabled' : 'enabled'}` : (r.message || 'Toggle failed'));
                        if (r.success) setOffersList((prev) => prev.map((x) => (x.id === o.id ? { ...x, is_active: !x.is_active } : x)));
                      }}
                      className="bg-white/20 hover:bg-white/30 font-bold text-[10px] px-3 py-1.5 rounded-xl transition"
                    >
                      {o.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={async () => {
                        const r = await adminApi.deleteOffer(o.id);
                        showToast(r.success ? 'Offer deleted' : (r.message || 'Delete failed'));
                        if (r.success) setOffersList((prev) => prev.filter((x) => x.id !== o.id));
                      }}
                      className="bg-rose-600/60 hover:bg-rose-600 font-bold text-[10px] px-3 py-1.5 rounded-xl transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wallets Audit */}
        {adminTab === 'WALLETS' && (
          <div className={`border rounded-3xl p-5 space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <h2 className="text-lg font-bold">Customer & Driver Wallets Audit</h2>
            {walletLoading ? (
              <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Loading wallet balances…</p>
            ) : walletData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className={`border p-4 rounded-2xl ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <span className="text-slate-400 font-bold block">TOTAL CUSTOMER BALANCE</span>
                    <span className="text-xl font-extrabold text-emerald-500">₹{Number(walletData.total_customer_balance || 0).toLocaleString('en-IN')}</span>
                    <span className="block text-[10px] mt-1 text-slate-400">{walletData.customer_wallet_count} wallet(s) • {walletData.customer_tx_count} transactions</span>
                  </div>
                  <div className={`border p-4 rounded-2xl ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <span className="text-slate-400 font-bold block">DRIVER WITHDRAWABLE BALANCE</span>
                    <span className="text-xl font-extrabold text-blue-500">₹{Number(walletData.total_driver_balance || 0).toLocaleString('en-IN')}</span>
                    <span className="block text-[10px] mt-1 text-slate-400">{walletData.driver_wallet_count} wallet(s) • {walletData.driver_tx_count} transactions</span>
                  </div>
                  <div className={`border p-4 rounded-2xl ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <span className="text-slate-400 font-bold block">PLATFORM COMMISSION PAID</span>
                    <span className="text-xl font-extrabold text-purple-500">₹{Number(walletData.platform_commission || 0).toLocaleString('en-IN')}</span>
                    <span className="block text-[10px] mt-1 text-slate-400">total retained from driver earnings</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase mb-2 text-slate-400">Top Customer Wallets</h3>
                    <div className="border rounded-2xl divide-y overflow-hidden">
                      {(walletData.customer_wallets || [])
                        .slice((custWalletPage - 1) * PAGE_SIZE, custWalletPage * PAGE_SIZE)
                        .map((w: any) => (
                        <div key={w.id} className={`flex justify-between items-center text-xs p-3 ${isLight ? 'bg-slate-50 divide-slate-200' : 'bg-slate-950 divide-slate-800'}`}>
                          <span className="font-bold">{w.customer_name || 'Customer'}</span>
                          <span className="font-mono text-emerald-500">₹{Number(w.balance || 0).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                      {(walletData.customer_wallets || []).length === 0 && <p className={`text-xs p-3 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>No customer wallets.</p>}
                    </div>
                    <Pagination total={(walletData.customer_wallets || []).length} page={custWalletPage} label="customer wallets" onChange={setCustWalletPage} isLight={isLight} />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold uppercase mb-2 text-slate-400">Top Driver Wallets</h3>
                    <div className="border rounded-2xl divide-y overflow-hidden">
                      {(walletData.driver_wallets || [])
                        .slice((drvWalletPage - 1) * PAGE_SIZE, drvWalletPage * PAGE_SIZE)
                        .map((w: any) => (
                        <div key={w.id} className={`flex justify-between items-center text-xs p-3 ${isLight ? 'bg-slate-50 divide-slate-200' : 'bg-slate-950 divide-slate-800'}`}>
                          <span className="font-bold">{w.driver_name || 'Driver'}</span>
                          <span className="font-mono text-blue-500">₹{Number(w.balance || 0).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                      {(walletData.driver_wallets || []).length === 0 && <p className={`text-xs p-3 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>No driver wallets.</p>}
                    </div>
                    <Pagination total={(walletData.driver_wallets || []).length} page={drvWalletPage} label="driver wallets" onChange={setDrvWalletPage} isLight={isLight} />
                  </div>
                </div>
              </>
            ) : (
              <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Wallet data unavailable.</p>
            )}
          </div>
        )}

        {/* Payment Logs */}
        {adminTab === 'PAYMENTS' && (
          <div className={`border rounded-3xl p-5 space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <h2 className="text-lg font-bold">Payment Gateway Logs (UPI / Card / Cash)</h2>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{paymentsList.length} transactions loaded</p>
              </div>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className={`border rounded-xl p-2 text-xs outline-none ${isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-700'}`}
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="PENDING">PENDING</option>
                <option value="FAILED">FAILED</option>
                <option value="REFUNDED">REFUNDED</option>
              </select>
            </div>
            <div className="overflow-x-auto scrollbar-thin border rounded-2xl">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className={`font-bold uppercase border-b ${isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                  <tr>
                    <th className="p-3">Gateway Ref</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody className={`divide-y font-medium ${isLight ? 'divide-slate-200 text-slate-700' : 'divide-slate-800 text-slate-300'}`}>
                  {paymentsLoading && (
                    <tr><td colSpan={6} className="p-3 text-slate-400">Loading payments…</td></tr>
                  )}
                  {!paymentsLoading && paymentsList.length === 0 && (
                    <tr><td colSpan={6} className="p-3 text-slate-400">No payment transactions recorded.</td></tr>
                  )}
                  {!paymentsLoading && paymentsList
                    .filter(paymentMatches)
                    .slice((payPage - 1) * PAGE_SIZE, payPage * PAGE_SIZE)
                    .map((p: any) => (
                    <tr key={p.id}>
                      <td className="p-3 font-mono text-red-500">{p.gateway_txn_id ? `PG-${p.gateway_txn_id.substring(0, 12)}` : `#${p.id?.substring(0, 8)}`}</td>
                      <td className="p-3">{p.customer_name || '—'}</td>
                      <td className="p-3 font-bold text-emerald-500">₹{Number(p.amount || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3">{p.method || '—'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          p.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500'
                          : p.status === 'FAILED' ? 'bg-rose-500/10 text-rose-500'
                          : p.status === 'REFUNDED' ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-slate-500/10 text-slate-400'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3">{p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={paymentsList.filter(paymentMatches).length} page={payPage} label="transactions" onChange={setPayPage} isLight={isLight} />
          </div>
        )}

        {/* Support Desk */}
        {adminTab === 'SUPPORT' && (
          <div className={`border rounded-3xl p-5 space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <h2 className="text-lg font-bold">Support Desk Inquiries</h2>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{supportTickets.length} ticket(s) • {supportOpenCount} open</p>
              </div>
              <select
                value={supportFilter}
                onChange={(e) => setSupportFilter(e.target.value)}
                className={`border rounded-xl p-2 text-xs outline-none ${isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-700'}`}
              >
                <option value="">All Statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>

            {supportLoading ? (
              <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Loading tickets…</p>
            ) : supportTickets.length === 0 ? (
              <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>No support tickets yet.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2 space-y-3">
                  <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                  {supportTickets
                    .filter(supportMatches)
                    .slice((supportPage - 1) * PAGE_SIZE, supportPage * PAGE_SIZE)
                    .map((t: any) => {
                      const isOpen = (t.status || '').toUpperCase() === 'OPEN';
                      return (
                        <button
                          key={t.id}
                          onClick={() => setActiveTicketId(t.id)}
                          className={`w-full text-left border p-4 rounded-2xl text-xs transition ${activeTicketId === t.id ? (isLight ? 'border-red-500 bg-red-500/5' : 'border-red-500 bg-red-500/10') : isLight ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                        >
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-bold truncate">{t.subject || 'Inquiry'}</span>
                            <span className={`px-2 py-0.5 rounded font-bold text-[9px] shrink-0 ${isOpen ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                              {t.status}
                            </span>
                          </div>
                          <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            {t.user_name || 'Unknown'} ({t.user_type}) • {t.priority || 'MEDIUM'}
                          </p>
                          <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                            #{t.id?.substring(0, 8)} • {t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN') : ''}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <Pagination total={supportTickets.filter(supportMatches).length} page={supportPage} label="tickets" onChange={setSupportPage} isLight={isLight} />
                </div>

                <div className={`lg:col-span-3 border rounded-2xl overflow-hidden ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  {!activeTicketId ? (
                    <div className="h-full min-h-[200px] flex items-center justify-center">
                      <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Select a ticket to view the conversation.</p>
                    </div>
                  ) : (() => {
                    const t = supportTickets.find((x: any) => x.id === activeTicketId);
                    return (
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-start gap-2 flex-wrap">
                          <div>
                            <h3 className="text-sm font-extrabold">{t?.subject || 'Ticket'}</h3>
                            <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              {t?.user_name || 'Unknown'} ({t?.user_type}) • {t?.priority || 'MEDIUM'} priority
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {(t?.status === 'OPEN' || t?.status === 'IN_PROGRESS') && (
                              <button
                                disabled={ticketStatusBusy === t.id}
                                onClick={async () => {
                                  setTicketStatusBusy(t.id);
                                  const r = await adminApi.updateSupportTicketStatus(t.id, 'RESOLVED');
                                  setTicketStatusBusy(null);
                                  showToast(r.success ? 'Ticket marked RESOLVED' : (r.message || 'Update failed'));
                                  if (r.success) {
                                    setSupportTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: 'RESOLVED' } : x)));
                                    setSupportOpenCount((c) => Math.max(0, c - 1));
                                  }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-[10px] px-3 py-1.5 rounded-xl"
                              >
                                {ticketStatusBusy === t.id ? '…' : 'Resolve'}
                              </button>
                            )}
                            {t?.status !== 'OPEN' && t?.status !== 'CLOSED' && (
                              <button
                                disabled={ticketStatusBusy === t.id}
                                onClick={async () => {
                                  setTicketStatusBusy(t.id);
                                  const r = await adminApi.updateSupportTicketStatus(t.id, 'OPEN');
                                  setTicketStatusBusy(null);
                                  showToast(r.success ? 'Ticket reopened' : (r.message || 'Update failed'));
                                  if (r.success) {
                                    setSupportTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: 'OPEN' } : x)));
                                    setSupportOpenCount((c) => c + 1);
                                  }
                                }}
                                className={`border font-bold text-[10px] px-3 py-1.5 rounded-xl transition ${isLight ? 'border-slate-300 text-slate-600 hover:bg-slate-200' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}
                              >
                                Reopen
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="border rounded-2xl divide-y max-h-[340px] overflow-y-auto">
                          {ticketMessages.length === 0 ? (
                            <p className="p-3 text-xs text-slate-400">No replies yet. Reply below to assist this user.</p>
                          ) : (
                            ticketMessages.map((m: any) => (
                              <div key={m.id} className={`p-3 text-xs ${m.sender_type === 'ADMIN' ? 'text-right' : ''}`}>
                                <span className={`inline-block max-w-[85%] text-left rounded-2xl px-3 py-2 ${m.sender_type === 'ADMIN' ? (isLight ? 'bg-[#E85D04]/10 text-slate-800' : 'bg-[#E85D04]/20 text-slate-100') : isLight ? 'bg-white border border-slate-200 text-slate-700' : 'bg-slate-800 border border-slate-700 text-slate-200'}`}>
                                  <span className="font-bold block text-[10px] mb-0.5">{m.sender_type === 'ADMIN' ? 'Admin' : m.sender_type}</span>
                                  {m.message}
                                  <span className="block text-[9px] mt-1 opacity-60">
                                    {m.created_at ? new Date(m.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                                  </span>
                                </span>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="flex gap-2">
                          <textarea
                            value={ticketReply}
                            onChange={(e) => setTicketReply(e.target.value)}
                            placeholder="Type your reply…"
                            rows={2}
                            className={`flex-1 border rounded-xl p-2.5 text-xs outline-none resize-none ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}
                          />
                          <button
                            disabled={ticketReplySending || !ticketReply.trim()}
                            onClick={async () => {
                              setTicketReplySending(true);
                              const r = await adminApi.replySupportTicket(activeTicketId, ticketReply.trim());
                              setTicketReplySending(false);
                              if (r.success) {
                                showToast('Reply sent');
                                setTicketReply('');
                                await loadTicketMessages(activeTicketId);
                                setSupportTickets((prev) => prev.map((x) => (x.id === activeTicketId ? { ...x, status: x.status === 'OPEN' ? 'IN_PROGRESS' : x.status } : x)));
                              } else {
                                showToast(r.message || 'Failed to send reply');
                              }
                            }}
                            className="bg-[#E85D04] hover:bg-[#C2410C] disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl self-end"
                          >
                            {ticketReplySending ? '…' : 'Reply'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reports & Analytics */}
        {adminTab === 'REPORTS' && (() => {
          const bookings = adminBookingsList.length > 0 ? adminBookingsList : (allBookings || []);
          const now = Date.now();
          const todayStart = new Date().setHours(0, 0, 0, 0);

          const filtered = bookings.filter((b: any) => {
            if (reportStatusFilter !== 'ALL' && b.status !== reportStatusFilter) return false;

            if (reportTimeFilter !== 'ALL') {
              const bTime = new Date(b.created_at || b.booking_time || 0).getTime();
              if (reportTimeFilter === 'TODAY' && bTime < todayStart) return false;
              if (reportTimeFilter === 'WEEK' && now - bTime > 7 * 86400000) return false;
              if (reportTimeFilter === 'MONTH' && now - bTime > 30 * 86400000) return false;
            }

            if (reportSearch.trim()) {
              const q = reportSearch.toLowerCase();
              const bId = String(b.id || '').toLowerCase();
              const cName = String(b.customer_name || b.customerName || '').toLowerCase();
              const dName = String(b.driver_name || b.driverName || '').toLowerCase();
              const pick = String(b.pickup_address || b.pickup || '').toLowerCase();
              const drop = String(b.dropoff_address || b.dropoff || '').toLowerCase();
              return bId.includes(q) || cName.includes(q) || dName.includes(q) || pick.includes(q) || drop.includes(q);
            }
            return true;
          });

          const totalRevenue = filtered
            .filter((b: any) => b.status === 'COMPLETED' || b.status === 'PAID' || Number(b.total_fare || b.fare) > 0)
            .reduce((sum: number, b: any) => sum + (Number(b.total_fare || b.fare) || 0), 0);

          const completedCount = filtered.filter((b: any) => b.status === 'COMPLETED').length;
          const activeCount = filtered.filter((b: any) => ['IN_PROGRESS', 'ASSIGNED', 'SEARCHING'].includes(b.status)).length;
          const cancelledCount = filtered.filter((b: any) => b.status === 'CANCELLED').length;
          const totalCount = filtered.length;
          const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;
          const avgFare = completedCount > 0 ? Math.round(totalRevenue / completedCount) : (totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0);
          const platformCommission = Math.round(totalRevenue * 0.15);

          // Payment Methods
          const cashCount = filtered.filter((b: any) => (b.payment_method || b.paymentMethod || '').toUpperCase() === 'CASH').length;
          const upiCount = filtered.filter((b: any) => ['UPI', 'GPAY', 'PHONEPE'].includes((b.payment_method || b.paymentMethod || '').toUpperCase())).length;
          const walletCount = filtered.filter((b: any) => (b.payment_method || b.paymentMethod || '').toUpperCase() === 'WALLET').length;
          const cardCount = Math.max(0, totalCount - cashCount - upiCount - walletCount);

          // Last 7 Days Daily Breakdown
          const dailyTrend: Array<{ dateStr: string; label: string; revenue: number; rides: number }> = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
            const dayBookings = bookings.filter((b: any) => {
              const bDate = (b.created_at || b.booking_time || '').slice(0, 10);
              return bDate === dateStr;
            });
            const dayRev = dayBookings.reduce((sum: number, b: any) => sum + (Number(b.total_fare || b.fare) || 0), 0);
            dailyTrend.push({ dateStr, label, revenue: dayRev, rides: dayBookings.length });
          }
          const maxTrendRev = Math.max(...dailyTrend.map((d) => d.revenue), 1000);

          // Top Drivers Performance
          const driverMap = new Map<string, { name: string; rides: number; revenue: number }>();
          filtered.forEach((b: any) => {
            const dName = b.driver_name || b.driverName;
            if (dName && dName !== 'Searching...' && dName !== 'Unassigned') {
              const prev = driverMap.get(dName) || { name: dName, rides: 0, revenue: 0 };
              prev.rides += 1;
              prev.revenue += Number(b.total_fare || b.fare) || 0;
              driverMap.set(dName, prev);
            }
          });
          const topDrivers = Array.from(driverMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

          // Pagination
          const pagedBookings = filtered.slice((reportPage - 1) * PAGE_SIZE, reportPage * PAGE_SIZE);

          return (
            <div className="space-y-6">
              {/* Filter Controls Bar */}
              <div className={`border p-4 rounded-3xl space-y-3 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[#E85D04]" />
                    <div>
                      <h3 className={`text-base font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>Platform Reports & Live Analytics</h3>
                      <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Real-time fleet operations, revenue trends, and performance audits</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Time Period Tabs */}
                    <div className={`p-1 rounded-2xl border flex items-center gap-1 text-xs font-bold ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                      {(['ALL', 'TODAY', 'WEEK', 'MONTH'] as const).map((period) => (
                        <button
                          key={period}
                          onClick={() => setReportTimeFilter(period)}
                          className={`px-3 py-1.5 rounded-xl transition ${
                            reportTimeFilter === period
                              ? 'bg-[#E85D04] text-white shadow-sm'
                              : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {period === 'ALL' ? 'All Time' : period === 'TODAY' ? 'Today' : period === 'WEEK' ? 'Last 7 Days' : 'Last 30 Days'}
                        </button>
                      ))}
                    </div>

                    {/* Quick Sync */}
                    <button
                      onClick={() => refreshAdminData()}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${isLight ? 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                      title="Refresh Real-time Metrics"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-[#E85D04]" />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Sub-Filters: Search & Status */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-800/30">
                  <div className={`flex items-center gap-2 border px-3 py-2 rounded-xl text-xs flex-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search reports by Booking ID, Customer, Driver, Pickup, or Dropoff…"
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                      className="bg-transparent outline-none w-full font-medium"
                    />
                    {reportSearch && (
                      <button onClick={() => setReportSearch('')} className="text-slate-400 hover:text-slate-200">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <select
                    value={reportStatusFilter}
                    onChange={(e) => setReportStatusFilter(e.target.value)}
                    className={`border rounded-xl px-3 py-2 text-xs outline-none font-bold ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'}`}
                  >
                    <option value="ALL">All Ride Statuses ({bookings.length})</option>
                    <option value="COMPLETED">Completed ({bookings.filter((b: any) => b.status === 'COMPLETED').length})</option>
                    <option value="IN_PROGRESS">In Progress ({bookings.filter((b: any) => b.status === 'IN_PROGRESS').length})</option>
                    <option value="ASSIGNED">Assigned ({bookings.filter((b: any) => b.status === 'ASSIGNED').length})</option>
                    <option value="SEARCHING">Searching ({bookings.filter((b: any) => b.status === 'SEARCHING').length})</option>
                    <option value="CANCELLED">Cancelled ({bookings.filter((b: any) => b.status === 'CANCELLED').length})</option>
                  </select>
                </div>
              </div>

              {/* 5-Card Operational Metrics Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className={`border p-4 rounded-3xl space-y-2 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>TOTAL REVENUE</span>
                    <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500"><DollarSign className="w-3.5 h-3.5" /></span>
                  </div>
                  <div className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    ₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Live Gross Billings
                  </span>
                </div>

                <div className={`border p-4 rounded-3xl space-y-2 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>TOTAL RIDES</span>
                    <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500"><Car className="w-3.5 h-3.5" /></span>
                  </div>
                  <div className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {totalCount}
                  </div>
                  <span className="text-[10px] font-bold text-blue-400">{completedCount} Completed • {activeCount} Active</span>
                </div>

                <div className={`border p-4 rounded-3xl space-y-2 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>COMPLETION RATE</span>
                    <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500"><CheckCircle2 className="w-3.5 h-3.5" /></span>
                  </div>
                  <div className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {completionRate}%
                  </div>
                  <span className={`text-[10px] font-bold ${cancelledCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {cancelledCount} Cancelled ({totalCount > 0 ? Math.round((cancelledCount / totalCount) * 100) : 0}%)
                  </span>
                </div>

                <div className={`border p-4 rounded-3xl space-y-2 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>AVG TICKET FARE</span>
                    <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500"><Tag className="w-3.5 h-3.5" /></span>
                  </div>
                  <div className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    ₹{avgFare}
                  </div>
                  <span className="text-[10px] font-bold text-amber-400">Average per completed ride</span>
                </div>

                <div className={`border p-4 rounded-3xl space-y-2 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>EST. COMMISSION</span>
                    <span className="p-1.5 rounded-lg bg-[#E85D04]/10 text-[#E85D04]"><WalletIcon className="w-3.5 h-3.5" /></span>
                  </div>
                  <div className={`text-2xl font-black text-[#E85D04]`}>
                    ₹{platformCommission.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] font-bold text-[#E85D04]">~15% Platform Take Rate</span>
                </div>
              </div>

              {/* Graphical Analytics Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 7-Day Revenue & Volume Trend Chart */}
                <div className={`lg:col-span-2 border p-5 rounded-3xl space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                  <div className="flex justify-between items-center">
                    <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      <Activity className="w-4 h-4 text-[#E85D04]" /> 7-Day Revenue & Rides Trend
                    </h3>
                    <span className={`text-[10px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Daily Aggregate from Database
                    </span>
                  </div>

                  {/* Visual Bar Chart */}
                  <div className="pt-4 pb-2">
                    <div className="h-44 flex items-end justify-between gap-2 sm:gap-4 px-2">
                      {dailyTrend.map((d, idx) => {
                        const pct = Math.max(8, Math.min(100, Math.round((d.revenue / maxTrendRev) * 100)));
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                            {/* Hover tooltip */}
                            <div className="opacity-0 group-hover:opacity-100 transition absolute -top-12 z-20 pointer-events-none bg-slate-950 text-white border border-slate-700 text-[10px] rounded-lg px-2 py-1 shadow-lg whitespace-nowrap">
                              <p className="font-bold">₹{d.revenue.toLocaleString('en-IN')}</p>
                              <p className="text-[9px] text-slate-400">{d.rides} rides</p>
                            </div>

                            <span className="text-[9px] font-bold text-slate-400 hidden sm:block">
                              {d.revenue > 0 ? `₹${d.revenue}` : '—'}
                            </span>

                            {/* Bar */}
                            <div className="w-full max-w-[40px] bg-slate-800/40 rounded-t-xl overflow-hidden h-32 flex items-end justify-center">
                              <div
                                style={{ height: `${pct}%` }}
                                className="w-full bg-gradient-to-t from-[#E85D04] to-amber-500 rounded-t-xl transition-all duration-500 group-hover:brightness-110"
                              />
                            </div>

                            <span className={`text-[10px] font-extrabold truncate w-full text-center ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                              {d.label.split(',')[0]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Ride Status & Payment Distribution */}
                <div className={`border p-5 rounded-3xl space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                  <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <PieChart className="w-4 h-4 text-[#E85D04]" /> Status & Payment Share
                  </h3>

                  {/* Status Breakdown Progress Bars */}
                  <div className="space-y-3 pt-1">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Ride Status Share</p>
                    {[
                      { label: 'Completed', count: completedCount, color: 'bg-emerald-500', text: 'text-emerald-500' },
                      { label: 'In Progress / Assigned', count: activeCount, color: 'bg-blue-500', text: 'text-blue-500' },
                      { label: 'Cancelled', count: cancelledCount, color: 'bg-rose-500', text: 'text-rose-500' },
                    ].map((item, idx) => {
                      const pct = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className={item.text}>{item.label}</span>
                            <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>{item.count} ({pct}%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800/40 overflow-hidden">
                            <div style={{ width: `${pct}%` }} className={`h-full rounded-full ${item.color} transition-all duration-300`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Payment Breakdown Chips */}
                  <div className="pt-3 border-t border-slate-800/30 space-y-2">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Payment Mode Distribution</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={`p-2.5 rounded-xl border flex flex-col ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                        <span className="text-[10px] text-slate-400">Cash on Trip</span>
                        <span className="font-extrabold text-emerald-400">{cashCount} rides</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border flex flex-col ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                        <span className="text-[10px] text-slate-400">UPI / QR Scan</span>
                        <span className="font-extrabold text-blue-400">{upiCount} rides</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border flex flex-col ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                        <span className="text-[10px] text-slate-400">In-App Wallet</span>
                        <span className="font-extrabold text-[#E85D04]">{walletCount} rides</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border flex flex-col ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                        <span className="text-[10px] text-slate-400">Card / NetBanking</span>
                        <span className="font-extrabold text-purple-400">{cardCount} rides</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Performing Drivers Leaderboard */}
              {topDrivers.length > 0 && (
                <div className={`border p-5 rounded-3xl space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                  <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <TrendingUp className="w-4 h-4 text-emerald-500" /> Top Partner Drivers by Operations Volume
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {topDrivers.map((drv, idx) => (
                      <div key={idx} className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                        <div>
                          <p className="font-bold">{drv.name}</p>
                          <p className="text-[10px] text-slate-400">{drv.rides} Completed Trips</p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-emerald-400">₹{drv.revenue.toLocaleString('en-IN')}</p>
                          <p className="text-[9px] text-[#E85D04] font-semibold">Rank #{idx + 1}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Bookings & Financial Audit Log Table */}
              <div className={`border rounded-3xl p-5 space-y-4 shadow-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-base font-bold">Comprehensive Ride Operations Audit</h3>
                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Showing {pagedBookings.length} of {filtered.length} matching ride records
                    </p>
                  </div>

                  {/* Export Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        if (filtered.length === 0) { showToast('No bookings to export'); return; }
                        downloadCsv(
                          `jittadrives_bookings_report_${new Date().toISOString().slice(0, 10)}.csv`,
                          ['Booking ID', 'Status', 'Customer', 'Driver', 'Pickup Address', 'Dropoff Address', 'Fare (INR)', 'Payment Mode', 'Booking Date'],
                          filtered.map((b: any) => [
                            b.id,
                            b.status,
                            b.customer_name || b.customerName || 'Customer',
                            b.driver_name || b.driverName || 'Unassigned',
                            b.pickup_address || b.pickup || '',
                            b.dropoff_address || b.dropoff || '',
                            b.total_fare ?? b.fare ?? '',
                            b.payment_method || b.paymentMethod || 'CASH',
                            b.created_at || b.booking_time || '',
                          ])
                        );
                        showToast(`Exported ${filtered.length} bookings to CSV`);
                      }}
                      className="bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow transition flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Bookings CSV</span>
                    </button>

                    <button
                      onClick={() => {
                        downloadCsv(
                          `jittadrives_financial_summary_${new Date().toISOString().slice(0, 10)}.csv`,
                          ['Metric', 'Value'],
                          [
                            ['Filtered Gross Revenue (INR)', totalRevenue],
                            ['Filtered Bookings Count', totalCount],
                            ['Completed Trips', completedCount],
                            ['Active Trips', activeCount],
                            ['Cancelled Trips', cancelledCount],
                            ['Average Fare (INR)', avgFare],
                            ['Est. Commission (INR)', platformCommission],
                            ['Generated At', new Date().toISOString()],
                          ]
                        );
                        showToast('Financial summary exported to CSV');
                      }}
                      className={`border font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 ${isLight ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Financial Summary CSV</span>
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto scrollbar-thin border rounded-2xl">
                  <table className="w-full min-w-[800px] text-left text-xs">
                    <thead className={`font-bold uppercase border-b ${isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                      <tr>
                        <th className="p-3">Booking ID</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Driver Partner</th>
                        <th className="p-3">Route (Pickup ➔ Dropoff)</th>
                        <th className="p-3">Fare</th>
                        <th className="p-3">Payment</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Date & Time</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-medium ${isLight ? 'divide-slate-200 text-slate-700' : 'divide-slate-800 text-slate-300'}`}>
                      {pagedBookings.map((b: any) => {
                        const status = String(b.status || '').toUpperCase();
                        const isDone = status === 'COMPLETED';
                        const isLive = ['IN_PROGRESS', 'ASSIGNED', 'SEARCHING'].includes(status);
                        const isCancel = status === 'CANCELLED';

                        return (
                          <tr
                            key={b.id}
                            onClick={() => setSelectedBookingDetailModal(b)}
                            className="hover:bg-slate-800/20 cursor-pointer transition"
                          >
                            <td className="p-3 font-mono font-bold text-[#E85D04]">
                              #{String(b.id || '').substring(0, 8).toUpperCase()}
                            </td>
                            <td className="p-3 font-bold">
                              {b.customer_name || b.customerName || 'Customer'}
                            </td>
                            <td className="p-3">
                              {b.driver_name || b.driverName ? (
                                <span className="font-semibold text-slate-200">{b.driver_name || b.driverName}</span>
                              ) : (
                                <span className="text-slate-500 italic">Unassigned</span>
                              )}
                            </td>
                            <td className="p-3 max-w-xs truncate text-[11px]">
                              <p className="truncate text-slate-300">{b.pickup_address || b.pickup || '—'}</p>
                              <p className="truncate text-slate-500">➔ {b.dropoff_address || b.dropoff || '—'}</p>
                            </td>
                            <td className="p-3 font-bold font-mono text-emerald-400">
                              ₹{Number(b.total_fare ?? b.fare ?? 0).toFixed(2)}
                            </td>
                            <td className="p-3">
                              <span className="font-bold uppercase text-[10px] text-slate-400">
                                {b.payment_method || b.paymentMethod || 'CASH'}
                              </span>
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-block ${
                                  isDone
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : isLive
                                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse'
                                      : isCancel
                                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                              {b.created_at || b.booking_time
                                ? new Date(b.created_at || b.booking_time).toLocaleString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}

                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500 font-bold">
                            No ride records found matching the selected report filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filtered.length > 0 && (
                  <Pagination
                    total={filtered.length}
                    page={reportPage}
                    label="reports"
                    onChange={setReportPage}
                    isLight={isLight}
                  />
                )}
              </div>
            </div>
          );
        })()}

        {/* Notifications Broadcast */}
        {adminTab === 'NOTIFICATIONS' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={`border rounded-3xl p-5 space-y-4 shadow-xl max-w-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
              <h2 className="text-lg font-bold">Broadcast Push Notification</h2>
              <div className="space-y-3 text-xs">
                <div>
                  <label className={`font-bold uppercase block mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Audience Target</label>
                  <select
                    value={notifAudience}
                    onChange={(e) => setNotifAudience(e.target.value)}
                    className={`w-full border rounded-xl p-2.5 outline-none ${isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'}`}
                  >
                    <option value="CUSTOMERS">All Customers</option>
                    <option value="DRIVERS">All Drivers</option>
                    <option value="ALL">Everyone</option>
                  </select>
                </div>

                <div>
                  <label className={`font-bold uppercase block mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Title</label>
                  <input
                    type="text"
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    placeholder="Notification Headline..."
                    className={`w-full border rounded-xl p-2.5 outline-none ${isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'}`}
                  />
                </div>

                <div>
                  <label className={`font-bold uppercase block mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Message</label>
                  <textarea
                    value={notifBody}
                    onChange={(e) => setNotifBody(e.target.value)}
                    placeholder="Message body content..."
                    className={`w-full border rounded-xl p-2.5 outline-none h-24 resize-none ${isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'}`}
                  />
                </div>

                <button
                  disabled={notifSending}
                  onClick={async () => {
                    if (!notifTitle.trim() || !notifBody.trim()) { showToast('Title and message are required'); return; }
                    setNotifSending(true);
                    const res = await adminApi.broadcastNotification({ title: notifTitle.trim(), message: notifBody.trim(), audience: notifAudience });
                    setNotifSending(false);
                    showToast(res.success ? 'Broadcast notification dispatched!' : (res.message || 'Broadcast failed'));
                    if (res.success) {
                      setNotifTitle('');
                      setNotifBody('');
                      const r = await adminApi.getNotifications(10);
                      if (r.success) setNotificationsList((prev) => [...(r.data?.notifications || []), ...prev.filter((n) => !r.data?.notifications?.some((x: any) => x.id === n.id))].slice(0, 50));
                    }
                  }}
                  className={`w-full py-3 rounded-2xl shadow transition font-bold ${notifSending ? 'opacity-50 bg-[#E85D04] text-white' : 'bg-[#E85D04] hover:bg-[#C2410C] text-white'}`}
                >
                  {notifSending ? 'Sending…' : 'Send Broadcast Push Now'}
                </button>
              </div>
            </div>

            <div className={`border rounded-3xl p-5 space-y-3 shadow-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
              <h2 className="text-lg font-bold">Recent Broadcast History</h2>
              {notificationsList.length === 0 ? (
                <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>No notifications sent yet.</p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {notificationsList.slice(0, 20).map((n: any) => (
                    <div key={n.id} className={`border p-3 rounded-2xl text-xs ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-extrabold">{n.title}</span>
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${(n.type || '').toUpperCase() === 'PROMO' ? 'bg-purple-500/10 text-purple-500' : 'bg-slate-500/10 text-slate-400'}`}>{n.type}</span>
                      </div>
                      <p className={`mt-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{n.message}</p>
                      <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
                        <span>Audience: {n.audience}</span>
                        <span>{n.created_at ? new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* System Settings */}
        {adminTab === 'SETTINGS' && (
          <div className={`border rounded-3xl p-5 space-y-4 shadow-xl max-w-xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <h2 className="text-lg font-bold">System & Dispatch Settings</h2>
            {settingsLoading ? (
              <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Loading settings…</p>
            ) : settingsData ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className={`font-bold uppercase block mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Platform Commission %</label>
                  <input
                    type="number"
                    value={settingsData.platform_commission ?? ''}
                    onChange={(e) => setSettingsData((s: any) => ({ ...s, platform_commission: e.target.value }))}
                    className={`w-full border rounded-xl p-2.5 outline-none ${isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'}`}
                  />
                </div>
                <div>
                  <label className={`font-bold uppercase block mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Emergency Helpline Number</label>
                  <input
                    type="text"
                    value={settingsData.sos_number ?? ''}
                    onChange={(e) => setSettingsData((s: any) => ({ ...s, sos_number: e.target.value }))}
                    className={`w-full border rounded-xl p-2.5 outline-none ${isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'}`}
                  />
                </div>
                <button
                  disabled={settingsSaving}
                  onClick={async () => {
                    setSettingsSaving(true);
                    const res = await adminApi.saveSettings({
                      platform_commission: settingsData.platform_commission ?? '15',
                      sos_number: settingsData.sos_number ?? '112',
                    });
                    setSettingsSaving(false);
                    showToast(res.success ? 'System settings saved' : (res.message || 'Failed to save settings'));
                  }}
                  className={`w-full py-3 rounded-2xl shadow transition font-bold ${settingsSaving ? 'opacity-50 bg-[#E85D04] text-white' : 'bg-[#E85D04] hover:bg-[#C2410C] text-white'}`}
                >
                  {settingsSaving ? 'Saving…' : 'Save System Config'}
                </button>
              </div>
            ) : (
              <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Settings unavailable.</p>
            )}
          </div>
        )}
      </main>

      {/* ===================================================================== */}
      {/* 2.5 DRIVER QUICK-VIEW MODAL                                           */}
      {/* ===================================================================== */}
      {driverView && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setDriverView(null)}
        >
          <div
            className={`w-full max-w-md border rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#E85D04]" />
                  <span>Driver Profile</span>
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  #{driverView.driver_code ? driverView.driver_code : (driverView.id || '').substring(0, 8).toUpperCase()}
                </p>
              </div>
              <button onClick={() => setDriverView(null)} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {(() => {
                const photo = (driverView.photo_url || driverView.photo || '').trim();
                const hasPhoto = Boolean(photo && !photo.includes('unsplash'));
                if (hasPhoto) {
                  return (
                    <img
                      src={photo}
                      className="w-14 h-14 rounded-full object-cover border border-slate-400 shrink-0"
                      alt={driverView.name}
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                    />
                  );
                }
                return (
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 border ${isLight ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                    <User className="w-7 h-7 text-slate-400" />
                  </div>
                );
              })()}
              <div>
                <p className="font-extrabold text-sm">{driverView.name}</p>
                <p className={`text-xs font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{driverView.phone || '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className={`p-2.5 rounded-xl ${isLight ? 'bg-slate-50 border border-slate-200' : 'bg-slate-950 border border-slate-800'}`}>
                <span className="text-slate-500 block text-[9px]">Rating</span>
                <strong className="text-amber-500">★ {driverView.rating || '5.0'}</strong>
              </div>
              <div className={`p-2.5 rounded-xl ${isLight ? 'bg-slate-50 border border-slate-200' : 'bg-slate-950 border border-slate-800'}`}>
                <span className="text-slate-500 block text-[9px]">Trips</span>
                <strong>{driverView.trips_count || driverView.tripsCount || 0}</strong>
              </div>
              <div className={`p-2.5 rounded-xl ${isLight ? 'bg-slate-50 border border-slate-200' : 'bg-slate-950 border border-slate-800'}`}>
                <span className="text-slate-500 block text-[9px]">Wallet</span>
                <strong className="text-emerald-500">₹{driverView.wallet_balance || driverView.walletBalance || 0}</strong>
              </div>
            </div>

            <div className={`p-3 rounded-2xl space-y-1.5 text-xs ${isLight ? 'bg-slate-50 border border-slate-200' : 'bg-slate-950 border border-slate-800'}`}>
              <div className="flex justify-between">
                <span className="text-slate-500">Vehicle</span>
                <span className="font-semibold">{driverView.vehicle_model || driverView.vehicleModel || 'Standard'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Plate No</span>
                <span className="font-mono">{driverView.vehicle_number || driverView.vehicleNumber || 'No Plate'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email</span>
                <span className="font-mono truncate max-w-[180px]">{driverView.email || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className={`font-bold ${(driverView.approval_status || driverView.approvalStatus || 'PENDING') === 'APPROVED' ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {(driverView.approval_status || driverView.approvalStatus || 'PENDING').toUpperCase()}
                </span>
              </div>
            </div>

            {/* Driving License & Document Verification Section */}
            {(() => {
              const dlDoc = driverDocsData.find((doc: any) => doc.document_type === 'LICENSE') || null;
              const dlNumber = dlDoc?.document_number || driverView.license_number || driverView.licenseNumber || '';
              const rawPhotoUrl = dlDoc?.file_url || driverView.license_photo_url || driverView.licensePhotoUrl || '';
              const dlPhotoUrl = rawPhotoUrl
                ? (rawPhotoUrl.startsWith('http') || rawPhotoUrl.startsWith('data:') ? rawPhotoUrl : `${import.meta.env.VITE_API_URL || ''}${rawPhotoUrl}`)
                : '';

              return (
                <div className={`p-3.5 rounded-2xl space-y-2.5 text-xs border ${isLight ? 'bg-orange-50/50 border-orange-200' : 'bg-orange-950/20 border-orange-800/60'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold flex items-center gap-1.5 text-[#E85D04]">
                      <IdCard className="w-4 h-4" />
                      Driving Licence (DL) Verification
                    </span>
                    {dlDoc?.verified ? (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending Review
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-orange-200/40">
                    <span className="text-slate-500 font-medium">Licence Number:</span>
                    <span className="font-mono font-bold text-xs">{dlNumber || 'Not Provided'}</span>
                  </div>

                  {driverDocsLoading ? (
                    <div className="py-4 text-center text-slate-400 flex items-center justify-center gap-1.5 text-xs">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E85D04]" />
                      Loading verification document...
                    </div>
                  ) : dlPhotoUrl ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-600">Document Photo (DL Front)</span>
                        <a
                          href={dlPhotoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-[#E85D04] hover:underline"
                        >
                          Open Full Size ↗
                        </a>
                      </div>
                      <div className="rounded-xl overflow-hidden border border-slate-300 bg-black/90 aspect-video max-h-48 flex items-center justify-center group relative">
                        <img
                          src={dlPhotoUrl}
                          alt="Driver License"
                          className="w-full h-full object-contain cursor-pointer transition hover:scale-105"
                          onClick={() => window.open(dlPhotoUrl, '_blank')}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 text-center rounded-xl bg-slate-100/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 text-[11px]">
                      No Driving Licence photo uploaded yet.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Quick Approval Actions Inside Modal */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={actionLoadingId === driverView.id}
                onClick={async () => {
                  setActionLoadingId(driverView.id);
                  const ok = await adminSetDriverApproval(driverView.id, 'APPROVED');
                  setActionLoadingId(null);
                  showToast(ok ? `Driver ${driverView.name} approved successfully!` : `Failed to approve ${driverView.name}`);
                  if (ok) {
                    setDriverView((prev: any) => prev ? { ...prev, approval_status: 'APPROVED' } : null);
                    refreshAdminData();
                  }
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition"
              >
                <UserCheck className="w-4 h-4" />
                <span>Approve Partner</span>
              </button>

              <button
                type="button"
                disabled={actionLoadingId === driverView.id}
                onClick={async () => {
                  setActionLoadingId(driverView.id);
                  const ok = await adminSetDriverApproval(driverView.id, 'REJECTED');
                  setActionLoadingId(null);
                  showToast(ok ? `Driver ${driverView.name} rejected.` : `Failed to reject ${driverView.name}`);
                  if (ok) {
                    setDriverView((prev: any) => prev ? { ...prev, approval_status: 'REJECTED' } : null);
                    refreshAdminData();
                  }
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition"
              >
                <UserX className="w-4 h-4" />
                <span>Reject</span>
              </button>
            </div>

            <button
              onClick={() => setDriverView(null)}
              className={`w-full font-bold py-2.5 rounded-xl text-xs transition border ${
                isLight ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. ASSIGN DRIVER MODAL (Manual Dispatch by Admin)                      */}
      {/* ===================================================================== */}
      {assignModalBooking && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className={`w-full max-w-md border rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Car className="w-5 h-5 text-[#E85D04]" />
                  <span>Manual Driver Assignment</span>
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Ride #{assignModalBooking.id?.substring(0, 8)} • {assignModalBooking.vehicle_category || assignModalBooking.vehicleType || 'Taxi'}
                </p>
              </div>
              <button
                onClick={() => setAssignModalBooking(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ride Summary */}
            <div className={`p-3 rounded-2xl space-y-1.5 text-xs ${isLight ? 'bg-slate-50 border border-slate-200' : 'bg-slate-950 border border-slate-800'}`}>
              <div className="flex justify-between font-bold">
                <span>Rider: {assignModalBooking.customer_name || assignModalBooking.customerName || 'Customer'}</span>
                <span className="text-emerald-500">₹{assignModalBooking.total_fare || assignModalBooking.fare?.totalFare || 0}</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {assignModalBooking.pickup_name || assignModalBooking.pickup?.name} → {assignModalBooking.drop_name || assignModalBooking.drop?.name}
              </p>
            </div>

            {/* Error or Alert */}
            {assignMessage && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 p-2.5 rounded-xl text-xs font-semibold">
                {assignMessage.text}
              </div>
            )}

            {/* Driver Select */}
            <div className="space-y-2 text-xs">
              <label className={`font-bold uppercase block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Select Available / Approved Driver Partner
              </label>

              {approvedDrivers.length === 0 ? (
                <p className="text-amber-500 text-xs italic">
                  No approved drivers found. Please approve drivers in the Drivers tab first.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {approvedDrivers.map((d: any) => {
                    const isSelected = selectedDriverForAssign === d.id;
                    return (
                      <div
                        key={d.id}
                        onClick={() => setSelectedDriverForAssign(d.id)}
                        className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'border-[#E85D04] bg-[#E85D04]/10 text-white'
                            : isLight
                            ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                            : 'border-slate-800 bg-slate-950 hover:bg-slate-800/60 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#E85D04]/15 text-[#E85D04] font-bold flex items-center justify-center text-xs">
                            {d.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-xs">{d.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {d.vehicle_model || d.vehicleModel || 'Cab'} • {d.vehicle_number || d.vehicleNumber || 'No Plate'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-amber-500 font-bold">★ {d.rating || 5.0}</span>
                          {isSelected && <Check className="w-4 h-4 text-[#E85D04]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignModalBooking(null)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition ${
                  isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-100' : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignment}
                disabled={assignLoading || !selectedDriverForAssign}
                className="flex-1 bg-[#E85D04] hover:bg-[#C2410C] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs shadow transition flex items-center justify-center gap-1.5"
              >
                {assignLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Confirm Assignment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. EDIT FARE RULE MODAL (Dynamic Pricing in MySQL)                     */}
      {/* ===================================================================== */}
      {editingFareRule && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className={`w-full max-w-md border rounded-3xl p-4 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                  <span>Update Pricing: {editingFareRule.category_name || editingFareRule.name}</span>
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Modifies base rates and per-km calculation parameters
                </p>
              </div>
              <button
                onClick={() => setEditingFareRule(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFareRule} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className={`font-bold uppercase block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Base Fare (₹)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={fareBasePrice}
                  onChange={(e) => setFareBasePrice(parseFloat(e.target.value) || 0)}
                  required
                  className={`w-full border rounded-xl p-2.5 outline-none font-bold text-sm ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}
                />
              </div>

              <div className="space-y-1.5">
                <label className={`font-bold uppercase block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Per KM Rate (₹/km)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={farePerKm}
                  onChange={(e) => setFarePerKm(parseFloat(e.target.value) || 0)}
                  required
                  className={`w-full border rounded-xl p-2.5 outline-none font-bold text-sm ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}
                />
              </div>

              <div className="space-y-1.5">
                <label className={`font-bold uppercase block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Free KM Included
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={fareFreeKm}
                  onChange={(e) => setFareFreeKm(parseFloat(e.target.value) || 0)}
                  className={`w-full border rounded-xl p-2.5 outline-none font-bold text-sm ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFareRule(null)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition ${
                    isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-100' : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fareSaveLoading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs shadow transition flex items-center justify-center gap-1.5"
                >
                  {fareSaveLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Pricing</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Booking Full Details Inspection Modal */}
      {selectedBookingDetailModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className={`w-full max-w-lg border rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/40">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base">Booking Details</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    selectedBookingDetailModal.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : selectedBookingDetailModal.status === 'ASSIGNED'
                      ? 'bg-blue-500/10 text-blue-500'
                      : selectedBookingDetailModal.status === 'SEARCHING'
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-slate-500/10 text-slate-400'
                  }`}>
                    {selectedBookingDetailModal.status}
                  </span>
                </div>
                <p className="font-mono text-xs text-red-500">#{selectedBookingDetailModal.id}</p>
              </div>
              <button
                onClick={() => setSelectedBookingDetailModal(null)}
                className="w-8 h-8 rounded-xl border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Start OTP Banner */}
            {selectedBookingDetailModal.start_otp && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Lock className="w-4 h-4" />
                  <span>Customer Start Ride OTP</span>
                </div>
                <span className="font-mono font-black text-base text-amber-400 tracking-widest bg-amber-500/20 px-3 py-1 rounded-xl">
                  {selectedBookingDetailModal.start_otp}
                </span>
              </div>
            )}

            {/* Route Cards */}
            <div className={`p-4 rounded-2xl border space-y-3 text-xs ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
              <div className="flex items-start gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Pickup Location</span>
                  <p className="font-bold text-sm">{selectedBookingDetailModal.pickup_name || selectedBookingDetailModal.pickup?.name || 'Pickup'}</p>
                  <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {selectedBookingDetailModal.pickup_address || selectedBookingDetailModal.pickup?.address || '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 border-t border-slate-800/40 pt-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 shrink-0" />
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Drop Location</span>
                  <p className="font-bold text-sm">{selectedBookingDetailModal.drop_name || selectedBookingDetailModal.drop?.name || 'Drop'}</p>
                  <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {selectedBookingDetailModal.drop_address || selectedBookingDetailModal.drop?.address || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Customer & Driver Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className={`p-3 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Customer</span>
                <p className="font-bold">{selectedBookingDetailModal.customer_name || selectedBookingDetailModal.customerName || 'Passenger'}</p>
                <p className="text-slate-400 font-mono text-[11px]">{selectedBookingDetailModal.customer_phone || selectedBookingDetailModal.customerPhone || '—'}</p>
                {selectedBookingDetailModal.customer_email && (
                  <p className="text-slate-500 text-[10px] truncate">{selectedBookingDetailModal.customer_email}</p>
                )}
              </div>
              <div className={`p-3 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Assigned Driver</span>
                <p className="font-bold">{selectedBookingDetailModal.driver_name || selectedBookingDetailModal.driverName || 'Pending Assignment'}</p>
                <p className="text-slate-400 font-mono text-[11px]">{selectedBookingDetailModal.driver_phone || selectedBookingDetailModal.driverPhone || '—'}</p>
                {(selectedBookingDetailModal.vehicle_model || selectedBookingDetailModal.vehicle_number) && (
                  <p className="text-red-400 text-[10px] font-bold">
                    {selectedBookingDetailModal.vehicle_model} • {selectedBookingDetailModal.vehicle_number}
                  </p>
                )}
              </div>
            </div>

            {/* Fare Breakdown */}
            <div className={`p-4 rounded-2xl border space-y-2 text-xs ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Fare & Payment Breakdown</span>
              <div className="flex justify-between text-slate-400">
                <span>Base Fare</span>
                <span>₹{selectedBookingDetailModal.base_fare || selectedBookingDetailModal.fare?.baseFare || 0}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Distance Fare</span>
                <span>₹{selectedBookingDetailModal.distance_fare || selectedBookingDetailModal.fare?.distanceFare || 0}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Taxes & Fees</span>
                <span>₹{(parseFloat(selectedBookingDetailModal.tax || 0) + parseFloat(selectedBookingDetailModal.platform_fee || 0)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm border-t border-slate-800/40 pt-2 text-white">
                <span>Total Fare</span>
                <span className="text-emerald-400">₹{selectedBookingDetailModal.total_fare || selectedBookingDetailModal.fare?.totalFare || 0}</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold pt-1">
                <span className="text-slate-500">Payment</span>
                <span className="text-emerald-500">
                  {selectedBookingDetailModal.payment_method || 'UPI'} • {selectedBookingDetailModal.payment_status || 'PENDING'}
                </span>
              </div>
            </div>

            {/* Timestamps */}
            <div className="text-[10px] text-slate-500 space-y-1">
              <div>Created: {selectedBookingDetailModal.created_at || '—'}</div>
              {selectedBookingDetailModal.assigned_at && <div>Assigned: {selectedBookingDetailModal.assigned_at}</div>}
              {selectedBookingDetailModal.completed_at && <div>Completed: {selectedBookingDetailModal.completed_at}</div>}
            </div>

            <button
              onClick={() => setSelectedBookingDetailModal(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs transition"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
