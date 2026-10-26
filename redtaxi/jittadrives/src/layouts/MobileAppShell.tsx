import React from 'react';
import { useTaxiApp } from '../context/TaxiAppContext';

interface MobileAppShellProps {
  children: React.ReactNode;
}

export const MobileAppShell: React.FC<MobileAppShellProps> = ({ children }) => {
  const { themeMode } = useTaxiApp();
  const isLight = themeMode === 'LIGHT';

  return (
    <div
      className={`relative h-[100dvh] w-full overflow-hidden flex flex-col transition-colors duration-300 ${
        isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-white'
      }`}
    >
      {/* App Screen Content */}
      <div className="flex-1 overflow-y-auto relative flex flex-col scrollbar-thin">
        {children}
      </div>
    </div>
  );
};