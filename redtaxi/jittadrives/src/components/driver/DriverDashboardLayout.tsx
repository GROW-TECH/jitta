import React from 'react';
import { History, Home, LogOut, TrendingUp, User } from 'lucide-react';
import { useTaxiApp } from '../../context/TaxiAppContext';

const NAV_ITEMS = [
  { id: 'HOME', label: 'Home', labelTa: 'முகப்பு', icon: Home },
  { id: 'TRIPS', label: 'Trips', labelTa: 'பயணங்கள்', icon: History },
  { id: 'EARNINGS', label: 'Earnings', labelTa: 'வருவாய்', icon: TrendingUp },
  { id: 'PROFILE', label: 'Profile', labelTa: 'சுயவிவரம்', icon: User },
] as const;

type NavId = (typeof NAV_ITEMS)[number]['id'];

export const DriverDashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    driverScreen,
    setDriverScreen,
    driverProfile,
    refreshDriverHistory,
    logoutDriver,
    language,
    setActiveBooking,
    setDriverCurrentRide,
    setLastCompletedRide,
  } = useTaxiApp() as any;

  const activeItem: NavId =
    driverScreen === 'DRIVER_HISTORY'
      ? 'TRIPS'
      : driverScreen === 'EARNINGS' || driverScreen === 'DRIVER_WALLET'
        ? 'EARNINGS'
        : driverScreen === 'DRIVER_PROFILE'
          ? 'PROFILE'
          : 'HOME';

  const onNavigate = (id: NavId) => {
    if (driverScreen === 'COMPLETE_RIDE') {
      setActiveBooking?.(null);
      setDriverCurrentRide?.(null);
      setLastCompletedRide?.(null);
    }
    if (id === 'HOME') setDriverScreen('DRIVER_HOME');
    else if (id === 'TRIPS') {
      refreshDriverHistory();
      setDriverScreen('DRIVER_HISTORY');
    } else if (id === 'EARNINGS') setDriverScreen('EARNINGS');
    else if (id === 'PROFILE') setDriverScreen('DRIVER_PROFILE');
  };

  return (
    <div className="h-[100dvh] w-full overflow-hidden flex flex-col lg:flex-row bg-[#FAFAF8]">
      {/* Desktop left sidebar */}
      <aside className="hidden lg:flex flex-col w-[224px] shrink-0 bg-white border-r border-[#E5E5E5]">
        {/* Brand / driver area */}
        <div className="px-4 pt-5 pb-4 flex items-center gap-3 border-b border-[#E5E5E5]">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Jitta Drives" className="w-10 h-10 object-contain" />
          <div className="min-w-0">
            <p className="text-[13px] font-black text-[#171717] leading-tight truncate">{driverProfile.name}</p>
            <p className="text-[10px] text-[#737373] truncate">
              {driverProfile.vehicleModel} • {driverProfile.vehicleNumber}
            </p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = activeItem === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-bold transition ${
                  active ? 'bg-[#E85D04] text-white' : 'text-[#737373] hover:bg-[#FAFAF8] hover:text-[#171717]'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                {language === 'ta' ? item.labelTa : item.label}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-4 pb-4">
          <button
            onClick={() => {
              logoutDriver();
              setDriverScreen('DRIVER_LOGIN');
            }}
            className="w-full flex items-center justify-center gap-2 bg-[#FAFAF8] border border-[#E5E5E5] text-[#737373] hover:bg-[#DC2626] hover:text-white hover:border-transparent text-xs font-bold py-2.5 rounded-xl transition"
          >
            <LogOut className="w-4 h-4" />
            {language === 'ta' ? 'வெளியேறு' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Content + mobile bottom navigation */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 relative overflow-hidden">{children}</div>

        {/* Clean, persistent mobile bottom navigation bar */}
        <nav className="lg:hidden shrink-0 bg-white border-t border-black/5 grid grid-cols-4 gap-1 text-center py-1 z-30 shadow-xs">
          {NAV_ITEMS.map((item) => {
            const active = activeItem === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center justify-center py-1 min-h-[44px] transition ${
                  active ? 'text-[#E85D04] font-bold' : 'text-[#737373] hover:text-[#171717]'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="text-[10px] leading-tight">{language === 'ta' ? item.labelTa : item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};