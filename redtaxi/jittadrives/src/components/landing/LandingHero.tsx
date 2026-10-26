import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, ArrowRight, ShieldCheck, Clock, Award, X } from 'lucide-react';
import { ALL_TAMIL_NADU_LOCATIONS } from '../../data/tamilNaduLocations';
import { fetchLocationsFromApi } from '../../services/locationService';
import type { LocationPoint } from '../../types/taxi';

interface LandingHeroProps {
  onBookRide: (pickup: string, drop: string) => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onBookRide }) => {
  const [pickupInput, setPickupInput] = useState('');
  const [dropInput, setDropInput] = useState('');

  const [pickupSuggestions, setPickupSuggestions] = useState<LocationPoint[]>([]);
  const [dropSuggestions, setDropSuggestions] = useState<LocationPoint[]>([]);

  const [showPickupDropdown, setShowPickupDropdown] = useState(false);
  const [showDropDropdown, setShowDropDropdown] = useState(false);

  const pickupWrapperRef = useRef<HTMLDivElement>(null);
  const dropWrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickupWrapperRef.current && !pickupWrapperRef.current.contains(e.target as Node)) {
        setShowPickupDropdown(false);
      }
      if (dropWrapperRef.current && !dropWrapperRef.current.contains(e.target as Node)) {
        setShowDropDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Handle Pickup input change & autocomplete search
  const handlePickupChange = (val: string) => {
    setPickupInput(val);
    const q = val.trim().toLowerCase();
    if (q.length < 2) {
      setPickupSuggestions([]);
      setShowPickupDropdown(false);
      return;
    }

    // 1. Instant synchronous matching from Tamil Nadu places
    const localMatches = ALL_TAMIL_NADU_LOCATIONS.filter(
      (l) => l.name.toLowerCase().includes(q) || l.address.toLowerCase().includes(q)
    ).slice(0, 5);

    setPickupSuggestions(localMatches);
    setShowPickupDropdown(true);

    // 2. Debounced API search
    const timer = setTimeout(async () => {
      try {
        const apiMatches = await fetchLocationsFromApi(val);
        if (apiMatches && apiMatches.length > 0) {
          setPickupSuggestions((prev) => {
            const names = new Set(prev.map((p) => p.name.toLowerCase()));
            const combined = [...prev];
            for (const item of apiMatches) {
              if (!names.has(item.name.toLowerCase())) {
                combined.push(item);
                names.add(item.name.toLowerCase());
              }
            }
            return combined.slice(0, 6);
          });
        }
      } catch (err) {
        // Fallback gracefully to local matches
      }
    }, 250);

    return () => clearTimeout(timer);
  };

  // Handle Drop input change & autocomplete search
  const handleDropChange = (val: string) => {
    setDropInput(val);
    const q = val.trim().toLowerCase();
    if (q.length < 2) {
      setDropSuggestions([]);
      setShowDropDropdown(false);
      return;
    }

    // 1. Instant synchronous matching from Tamil Nadu places
    const localMatches = ALL_TAMIL_NADU_LOCATIONS.filter(
      (l) => l.name.toLowerCase().includes(q) || l.address.toLowerCase().includes(q)
    ).slice(0, 5);

    setDropSuggestions(localMatches);
    setShowDropDropdown(true);

    // 2. Debounced API search
    const timer = setTimeout(async () => {
      try {
        const apiMatches = await fetchLocationsFromApi(val);
        if (apiMatches && apiMatches.length > 0) {
          setDropSuggestions((prev) => {
            const names = new Set(prev.map((p) => p.name.toLowerCase()));
            const combined = [...prev];
            for (const item of apiMatches) {
              if (!names.has(item.name.toLowerCase())) {
                combined.push(item);
                names.add(item.name.toLowerCase());
              }
            }
            return combined.slice(0, 6);
          });
        }
      } catch (err) {
        // Fallback gracefully to local matches
      }
    }, 250);

    return () => clearTimeout(timer);
  };

  const handleSelectPickup = (loc: LocationPoint) => {
    setPickupInput(loc.name);
    setShowPickupDropdown(false);
  };

  const handleSelectDrop = (loc: LocationPoint) => {
    setDropInput(loc.name);
    setShowDropDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowPickupDropdown(false);
    setShowDropDropdown(false);
    onBookRide(pickupInput, dropInput);
  };

  return (
    <section id="home" className="relative overflow-hidden bg-gradient-to-b from-slate-50/80 via-white to-white py-12 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Headline & Interactive Booking Card */}
          <div className="lg:col-span-6 space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-[#E85D04] text-xs font-extrabold uppercase tracking-wide">
                <span className="w-2 h-2 rounded-full bg-[#E85D04] animate-pulse" />
                Live in Salem & Tamil Nadu
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
                India’s Smart & Reliable <span className="text-[#E85D04]">Ride-Hailing</span> App
              </h1>

              <p className="text-base sm:text-lg text-slate-600 font-medium max-w-xl leading-relaxed">
                Quick, comfortable, and transparent doorstep rides. From daily city commutes to outstation trips, Jitta gets you there safely.
              </p>
            </div>

            {/* Quick Ride Booking Form with Autocomplete Dropdown (Rapido-Inspired) */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xl shadow-slate-200/50 border border-slate-200/80 max-w-xl relative">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Book Your Ride</span>
                <span className="text-xs font-bold text-[#E85D04]">Zero Hidden Surge</span>
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Pickup Location Input with Dropdown */}
                <div ref={pickupWrapperRef} className="relative">
                  <div className="relative flex items-center">
                    <div className="absolute left-4 w-5 h-5 flex items-center justify-center text-emerald-600 pointer-events-none">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      value={pickupInput}
                      onChange={(e) => handlePickupChange(e.target.value)}
                      onFocus={() => {
                        if (pickupSuggestions.length > 0) setShowPickupDropdown(true);
                      }}
                      placeholder="Enter Pickup Location"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#E85D04] focus:bg-white text-slate-900 text-sm font-bold rounded-2xl py-4 pl-12 pr-10 outline-none transition-all placeholder:text-slate-400 placeholder:font-medium"
                    />
                    {pickupInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setPickupInput('');
                          setPickupSuggestions([]);
                          setShowPickupDropdown(false);
                        }}
                        className="absolute right-3.5 w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
                        aria-label="Clear pickup location"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Pickup Autocomplete Results Dropdown */}
                  {showPickupDropdown && pickupSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
                      {pickupSuggestions.map((loc, idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => handleSelectPickup(loc)}
                          className="w-full text-left px-4 py-3 hover:bg-orange-50/70 transition-colors flex items-start gap-3 group"
                        >
                          <div className="w-5 h-5 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-slate-900 group-hover:text-[#E85D04] transition-colors truncate">
                              {loc.name}
                            </span>
                            <span className="block text-xs text-slate-500 truncate mt-0.5">
                              {loc.address}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Drop Location Input with Dropdown */}
                <div ref={dropWrapperRef} className="relative">
                  <div className="relative flex items-center">
                    <div className="absolute left-4 w-5 h-5 flex items-center justify-center text-[#E85D04] pointer-events-none">
                      <Navigation className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      value={dropInput}
                      onChange={(e) => handleDropChange(e.target.value)}
                      onFocus={() => {
                        if (dropSuggestions.length > 0) setShowDropDropdown(true);
                      }}
                      placeholder="Enter Drop Location"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#E85D04] focus:bg-white text-slate-900 text-sm font-bold rounded-2xl py-4 pl-12 pr-10 outline-none transition-all placeholder:text-slate-400 placeholder:font-medium"
                    />
                    {dropInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setDropInput('');
                          setDropSuggestions([]);
                          setShowDropDropdown(false);
                        }}
                        className="absolute right-3.5 w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
                        aria-label="Clear drop location"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Drop Autocomplete Results Dropdown */}
                  {showDropDropdown && dropSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
                      {dropSuggestions.map((loc, idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => handleSelectDrop(loc)}
                          className="w-full text-left px-4 py-3 hover:bg-orange-50/70 transition-colors flex items-start gap-3 group"
                        >
                          <div className="w-5 h-5 flex items-center justify-center text-[#E85D04] shrink-0 mt-0.5">
                            <Navigation className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-slate-900 group-hover:text-[#E85D04] transition-colors truncate">
                              {loc.name}
                            </span>
                            <span className="block text-xs text-slate-500 truncate mt-0.5">
                              {loc.address}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit CTA */}
                <button
                  type="submit"
                  className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-extrabold text-base py-4 rounded-2xl shadow-lg shadow-[#E85D04]/30 hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>Book Ride Now</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>

            {/* Quick Proof Badges */}
            <div className="grid grid-cols-3 gap-4 pt-2 max-w-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#E85D04] flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="leading-tight">
                  <span className="block text-xs font-black text-slate-900">3-Min Pickup</span>
                  <span className="text-[10px] text-slate-500 font-medium">Nearest Captain</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="leading-tight">
                  <span className="block text-xs font-black text-slate-900">100% Safe</span>
                  <span className="text-[10px] text-slate-500 font-medium">Verified Drivers</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div className="leading-tight">
                  <span className="block text-xs font-black text-slate-900">Top Rated</span>
                  <span className="text-[10px] text-slate-500 font-medium">4.8/5 Star Service</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: High-Res Commercial Vehicle Banner with Rapido-Style Asymmetric Arch */}
          <div className="lg:col-span-6 relative flex justify-center items-center">
            <div className="relative w-full max-w-lg lg:max-w-none">
              {/* Rapido-Style Soft Fluid Backdrop Shape */}
              <div className="absolute -inset-2 sm:-inset-4 bg-gradient-to-r from-orange-500/20 via-amber-400/15 to-transparent rounded-tl-[100px] sm:rounded-tl-[180px] rounded-bl-[100px] sm:rounded-bl-[180px] rounded-tr-[40px] rounded-br-[40px] transform -rotate-1 pointer-events-none" />

              {/* Main Image Mask with Rapido Left-Arch Silhouette */}
              <div className="relative rounded-tl-[90px] sm:rounded-tl-[160px] rounded-bl-[90px] sm:rounded-bl-[160px] rounded-tr-[36px] rounded-br-[36px] overflow-hidden shadow-2xl border border-slate-100 bg-white">
                <img
                  src="/jitta_hero_fleet.jpg"
                  alt="Jitta Rides Fleet - Auto, Cabs, Bike"
                  className="w-full h-auto object-cover transform hover:scale-[1.02] transition-transform duration-700"
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
