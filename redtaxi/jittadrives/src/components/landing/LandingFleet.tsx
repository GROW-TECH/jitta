import React from 'react';

interface ServiceItem {
  id: string;
  name: string;
  tagline: string;
  image: string;
}

const SERVICES: ServiceItem[] = [
  {
    id: 'bike',
    name: 'Bike-Taxi',
    tagline: 'Beat traffic, ride quicker',
    image: '/vehicles/bike.jpg',
  },
  {
    id: 'auto',
    name: 'Auto',
    tagline: 'Everyday autos, made easy',
    image: '/vehicles/auto.jpg',
  },
  {
    id: 'cab',
    name: 'Cab',
    tagline: 'Comfort for every journey',
    image: '/vehicles/jitta_sedan.jpg',
  },
  {
    id: 'acting_driver',
    name: 'Acting Driver',
    tagline: 'Verified chauffeur for your car',
    image: '/vehicles/driver_chauffeur.svg',
  },
];

export const LandingFleet: React.FC = () => {
  return (
    <section id="fleet" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header with Rapido-Style Accent Bar */}
        <div className="mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
            Our Services
          </h2>
          <div className="w-20 h-1.5 bg-[#E85D04] rounded-full mt-3" />
          <p className="text-slate-500 font-medium text-base sm:text-lg mt-3 max-w-2xl">
            Choose from quick bike rides, metered autos, comfortable AC cabs, or hire a verified chauffeur.
          </p>
        </div>

        {/* 2x2 Services Grid with Large Generous Cards (View-Only, Rapido Style) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {SERVICES.map((item) => (
            <div
              key={item.id}
              className="bg-[#F8F9FA] rounded-3xl p-8 sm:p-10 border border-slate-100 shadow-xs hover:shadow-lg transition-all duration-300 flex items-center justify-between gap-6 select-none min-h-[160px]"
            >
              {/* Left Column: Big Bold Title & Tagline */}
              <div className="space-y-2 min-w-0 pr-4">
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {item.name}
                </h3>
                <p className="text-sm sm:text-base text-slate-500 font-medium leading-relaxed">
                  {item.tagline}
                </p>
              </div>

              {/* Right Column: Large Vehicle Cutout Graphic */}
              <div className="w-32 h-24 sm:w-44 sm:h-32 shrink-0 flex items-center justify-center p-2 rounded-2xl bg-white/70">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
