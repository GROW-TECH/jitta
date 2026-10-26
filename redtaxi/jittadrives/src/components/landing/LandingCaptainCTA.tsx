import React from 'react';
import { ArrowRight, Wallet, Calendar, TrendingUp, Headphones } from 'lucide-react';

interface LandingCaptainCTAProps {
  onOpenDownloadModal: () => void;
}

export const LandingCaptainCTA: React.FC<LandingCaptainCTAProps> = ({ onOpenDownloadModal }) => {
  return (
    <section id="captain" className="py-20 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-white border-t border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-3xl p-8 sm:p-12 lg:p-16 text-white shadow-2xl relative overflow-hidden">
          
          {/* Subtle Orange Glow Accent */}
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-[#E85D04]/20 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            
            <div className="lg:col-span-8 space-y-6">
              <span className="inline-block px-3.5 py-1.5 rounded-full bg-[#E85D04]/20 border border-[#E85D04]/40 text-[#E85D04] text-xs font-black uppercase tracking-wider">
                Partner with Jitta
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                Be Your Own Boss. <span className="text-[#E85D04]">Earn on Your Terms.</span>
              </h2>

              <p className="text-slate-300 font-medium text-sm sm:text-base max-w-2xl leading-relaxed">
                Join thousands of proud captains driving Auto, Cabs, Bikes, and acting driver gigs across Salem & Tamil Nadu. Enjoy instant daily payouts and minimal commission.
              </p>

              {/* 4 Key Captain Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#E85D04] shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">Daily Payouts</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#E85D04] shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">Low Commission</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#E85D04] shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">Flexible Hours</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#E85D04] shrink-0">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">24/7 Helpline</span>
                </div>
              </div>
            </div>

            {/* Right Action */}
            <div className="lg:col-span-4 flex flex-col items-start lg:items-end justify-center">
              <button
                onClick={onOpenDownloadModal}
                className="px-8 py-4 rounded-2xl bg-[#E85D04] hover:bg-[#C2410C] text-white font-black text-sm sm:text-base shadow-xl shadow-[#E85D04]/30 hover:shadow-2xl transition-all active:scale-95 flex items-center gap-2.5"
              >
                <span>Register as Captain</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <span className="text-xs text-slate-400 font-medium mt-3">
                Quick 5-minute onboarding on Android
              </span>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};
