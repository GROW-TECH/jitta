import React from 'react';
import { useTaxiApp } from '../../context/TaxiAppContext';
import { Smartphone, Car, ShieldCheck, Sun, Moon } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';

export const AppHeaderSwitcher: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    themeMode,
    toggleTheme,
    customerProfile,
    activeBooking,
    t,
  } = useTaxiApp();

  const isLight = themeMode === 'LIGHT';

  return (
    <header className={`${isLight ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-slate-900 border-slate-800 text-white shadow-md'} border-b sticky top-0 z-50 px-2 sm:px-4 py-1.5 sm:py-2.5 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto flex flex-row items-center justify-between gap-2 sm:gap-3">
        {/* Brand & Identity */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#FFF7F0] border border-[#E85D04]/30 rounded-xl flex items-center justify-center p-1 shadow-sm shrink-0">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Jitta Drives Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className={`font-extrabold text-sm sm:text-lg tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Jitta <span className="text-[#E85D04]">Drives</span>
              </h1>
              <span className="bg-[#E85D04]/10 text-[#E85D04] text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-[#E85D04]/30">
                PROD
              </span>
            </div>
            <p className={`text-[10px] hidden sm:block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{t('app.tagline', 'We drive your Rides • Interactive Booking Platform')}</p>
          </div>
        </div>

        {/* View Switcher Controls */}
        <div className={`flex items-center p-1 rounded-xl sm:rounded-2xl border shadow-inner ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
          <button
            onClick={() => setViewMode('CUSTOMER')}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs transition ${viewMode === 'CUSTOMER'
                ? 'bg-[#E85D04] text-white shadow-md shadow-[#E85D04]/30'
                : isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
          >
            <Smartphone className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{t('nav.customer', 'Customer')}</span>
          </button>

          <button
            onClick={() => setViewMode('DRIVER')}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs transition ${viewMode === 'DRIVER'
                ? 'bg-[#E85D04] text-white shadow-md shadow-[#E85D04]/30'
                : isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
          >
            <Car className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{t('nav.driver', 'Driver')}</span>
          </button>

          <button
            onClick={() => setViewMode('ADMIN')}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs transition ${viewMode === 'ADMIN'
                ? 'bg-[#E85D04] text-white shadow-md shadow-[#E85D04]/30'
                : isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
          >
            <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{t('nav.admin', 'Admin')}</span>
          </button>
        </div>

        {/* Right Status Quick Widgets, Language & Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Multi-Language Switcher (Tamil, English, Kannada, Hindi) */}
          <LanguageSwitcher />

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl font-bold text-xs border transition shadow-sm ${isLight
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20'
              }`}
            title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
          >
            {isLight ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-indigo-400" />}
            <span className="hidden sm:inline">{isLight ? t('nav.light_mode', 'Light Mode') : t('nav.dark_mode', 'Dark Mode')}</span>
          </button>

          {/* Active Trip Status Indicator */}
          {activeBooking && (
            <div className={`hidden md:flex items-center gap-2 border text-xs px-3 py-1 rounded-xl ${isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-950/80 border-emerald-800/60 text-emerald-400'}`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-semibold">{activeBooking.id}</span>
              <span className="text-[10px] opacity-80">({activeBooking.status})</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

