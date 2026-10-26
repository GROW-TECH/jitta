import React from 'react';
import { Home, Clock, Ticket, User } from 'lucide-react';
import { useTaxiApp } from '../../context/TaxiAppContext';

export const CustomerFooterNav: React.FC = () => {
  const { customerScreen, setCustomerScreen, language } = useTaxiApp();

  // Active tab detection across all customer navigation screens
  const isHomeActive = customerScreen === 'HOME';
  const isRidesActive = ['MY_RIDES', 'RIDE_DETAILS'].includes(customerScreen);
  const isOffersActive = ['OFFERS', 'COUPONS'].includes(customerScreen);
  const isProfileActive = [
    'PROFILE',
    'GIFT_CARD',
    'NOTIFICATIONS',
    'SAVED_PLACES',
    'SUPPORT',
  ].includes(customerScreen);

  const tabs = [
    {
      id: 'home',
      label: language === 'ta' ? 'முகப்பு' : 'Home',
      icon: Home,
      isActive: isHomeActive,
      onClick: () => setCustomerScreen('HOME'),
    },
    {
      id: 'rides',
      label: language === 'ta' ? 'பயணங்கள்' : 'My Rides',
      icon: Clock,
      isActive: isRidesActive,
      onClick: () => setCustomerScreen('MY_RIDES'),
    },
    {
      id: 'offers',
      label: language === 'ta' ? 'சலுகைகள்' : 'Offers',
      icon: Ticket,
      isActive: isOffersActive,
      onClick: () => setCustomerScreen('OFFERS'),
    },
    {
      id: 'profile',
      label: language === 'ta' ? 'சுயவிவரம்' : 'Profile',
      icon: User,
      isActive: isProfileActive,
      onClick: () => setCustomerScreen('PROFILE'),
    },
  ];

  return (
    <nav
      aria-label="Customer Navigation Footer"
      className="w-full bg-white/95 backdrop-blur-md border-t border-black/10 shrink-0 z-40 select-none shadow-[0_-3px_12px_rgba(0,0,0,0.04)]"
    >
      <div className="max-w-lg mx-auto grid grid-cols-4 px-2 pt-1.5 pb-2 text-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={tab.onClick}
              className={`flex flex-col items-center justify-center py-1 transition-all duration-150 min-h-[44px] rounded-xl active:scale-95 ${
                tab.isActive
                  ? 'text-[#E85D04] font-extrabold'
                  : 'text-[#737373] hover:text-[#171717] font-medium'
              }`}
            >
              <div className="relative flex flex-col items-center">
                {tab.isActive && (
                  <span className="w-5 h-0.5 bg-[#E85D04] rounded-full mb-1" />
                )}
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    tab.isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                />
              </div>
              <span className={`text-[10.5px] mt-0.5 leading-tight ${tab.isActive ? 'font-bold' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
