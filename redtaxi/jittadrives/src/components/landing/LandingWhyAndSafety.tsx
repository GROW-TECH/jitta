import React from 'react';
import { ShieldCheck, PhoneCall, Key, Navigation, UserCheck, DollarSign, Clock } from 'lucide-react';

export const LandingWhyAndSafety: React.FC = () => {
  return (
    <>
      {/* Why Choose Jitta Drives Section */}
      <section id="about" className="py-16 sm:py-20 bg-slate-50/60 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="mb-10 sm:mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Why Choose Jitta Drives
            </h2>
            <div className="w-16 h-1 bg-[#E85D04] rounded-full mt-2.5" />
            <p className="text-slate-500 font-medium text-sm sm:text-base mt-3 max-w-xl">
              Built on transparency, affordability, and genuine driver-passenger mutual respect.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1 */}
            <div className="p-7 rounded-3xl bg-white hover:bg-orange-50/40 border border-slate-200/70 hover:border-orange-200 transition-all duration-300 space-y-3.5 shadow-xs hover:shadow-lg group">
              <div className="w-12 h-12 rounded-2xl bg-[#E85D04]/10 text-[#E85D04] flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                <DollarSign className="w-6 h-6 text-[#E85D04]" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Transparent Fares
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                No hidden peak hour surges. Know your exact fare upfront before confirming your ride.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-7 rounded-3xl bg-white hover:bg-orange-50/40 border border-slate-200/70 hover:border-orange-200 transition-all duration-300 space-y-3.5 shadow-xs hover:shadow-lg group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                <Clock className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Quick Doorstep Arrival
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                Smart dispatch algorithms assign the nearest available captain to minimize waiting time.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-7 rounded-3xl bg-white hover:bg-orange-50/40 border border-slate-200/70 hover:border-orange-200 transition-all duration-300 space-y-3.5 shadow-xs hover:shadow-lg group">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                <UserCheck className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Verified Captains
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                Every driver undergoes thorough driving license, vehicle fitness, and background scrutiny.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-7 rounded-3xl bg-white hover:bg-orange-50/40 border border-slate-200/70 hover:border-orange-200 transition-all duration-300 space-y-3.5 shadow-xs hover:shadow-lg group">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                <PhoneCall className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                24/7 Direct Helpline
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                Reach our real support team anytime via <strong>+91 70106 59842</strong> with instant resolution.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* Safety Section (Refined Light UI Matching Jitta & Rapido Aesthetic) */}
      <section id="safety" className="py-16 sm:py-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            
            {/* Left Column: Safety Headline & Features */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <span className="inline-block px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-[#E85D04] text-xs font-black uppercase tracking-wider">
                  Safety First Standard
                </span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight mt-3">
                  Your Safety Is Our <span className="text-[#E85D04]">Highest Priority</span>
                </h2>
                <div className="w-16 h-1 bg-[#E85D04] rounded-full mt-3" />
                <p className="text-slate-600 font-medium text-sm sm:text-base leading-relaxed mt-4 max-w-xl">
                  Every ride on Jitta Drives is protected by multi-layered security protocols, real-time telemetry, and dedicated human response teams.
                </p>
              </div>

              <div className="space-y-4 pt-1">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-orange-50/30 border border-slate-100 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-orange-100/70 text-[#E85D04] flex items-center justify-center shrink-0 mt-0.5">
                    <Key className="w-5 h-5 text-[#E85D04]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">4-Digit Start OTP Verification</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Your ride cannot begin until you share your secret OTP with the driver in person.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-orange-50/30 border border-slate-100 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Navigation className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">Live GPS Trip Sharing</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Share live tracking with family and friends so they can monitor your ride route in real time.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-orange-50/30 border border-slate-100 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-rose-100/70 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">Emergency SOS Assistance</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Instant one-tap emergency helpline connected directly to our local safety response command.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Safety Trust Badge Card (Light Aesthetic) */}
            <div className="lg:col-span-5">
              <div className="bg-[#F8F9FA] rounded-3xl p-7 sm:p-9 border border-slate-200/80 shadow-md space-y-6">
                <div className="flex items-center justify-between pb-6 border-b border-slate-200/80">
                  <div>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Verified Safe Rides</span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900">100% Background Screened</span>
                  </div>
                  <div className="w-13 h-13 rounded-2xl bg-[#E85D04]/10 text-[#E85D04] flex items-center justify-center font-black shrink-0 p-3">
                    <ShieldCheck className="w-7 h-7 text-[#E85D04]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-2xs">
                    <span className="text-2xl font-black text-[#E85D04]">24/7</span>
                    <span className="block text-xs font-bold text-slate-800 mt-1">Helpline Support</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">+91 70106 59842</span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-2xs">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900">4.8</span>
                      <span className="text-xs font-bold text-[#E85D04]">/ 5.0</span>
                    </div>
                    <span className="block text-xs font-bold text-slate-800 mt-1">Customer Rating</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">Based on 50,000+ rides</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed pt-2">
                  Have questions about our passenger safety guidelines? Read our verified <a href="/privacy-policy.html" className="text-[#E85D04] font-bold hover:underline">Privacy Policy</a> and ride standards.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>
    </>
  );
};
