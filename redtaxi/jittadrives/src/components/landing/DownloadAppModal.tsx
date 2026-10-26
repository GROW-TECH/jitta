import React from 'react';
import { X } from 'lucide-react';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadAppModal: React.FC<DownloadAppModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const customerPlayStoreUrl = "https://play.google.com/store/apps/details?id=com.xiadot.jittadrives.user";
  const driverPlayStoreUrl = "https://play.google.com/store/apps/details?id=com.xiadot.jittadrives.driver";

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors z-10 active:scale-95"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="py-10 px-6 sm:px-12">
          {/* Rapido-Style Minimalist Symmetrical 2-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            
            {/* Captain App Column (Left) - Directly Clickable */}
            <a
              href={driverPlayStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center text-center px-6 py-6 space-y-5 transition-transform active:scale-98"
            >
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight whitespace-nowrap group-hover:text-[#E85D04] transition-colors">
                Captain App Download
              </h3>

              {/* Clickable Captain Logo Icon */}
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-amber-500/10 border border-amber-500/20 group-hover:border-[#E85D04] group-hover:shadow-lg flex items-center justify-center p-2.5 transition-all duration-300 transform group-hover:scale-105">
                <img 
                  src="/logo.png" 
                  alt="Jitta Captain" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              {/* Platform Label */}
              <div className="space-y-0.5">
                <span className="block text-sm font-semibold text-slate-700 group-hover:text-[#E85D04] transition-colors">
                  Android
                </span>
                <span className="block text-[11px] text-slate-400 font-medium">
                  Tap icon to install from Play Store
                </span>
              </div>
            </a>

            {/* Customer App Column (Right) - Directly Clickable */}
            <a
              href={customerPlayStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center text-center px-6 py-6 space-y-5 transition-transform active:scale-98"
            >
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight whitespace-nowrap group-hover:text-[#E85D04] transition-colors">
                Customer App Download
              </h3>

              {/* Clickable Customer Logo Icon */}
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-[#E85D04]/10 border border-[#E85D04]/20 group-hover:border-[#E85D04] group-hover:shadow-lg flex items-center justify-center p-2.5 transition-all duration-300 transform group-hover:scale-105">
                <img 
                  src="/logo.png" 
                  alt="Jitta Drives" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              {/* Platform Label */}
              <div className="space-y-0.5">
                <span className="block text-sm font-semibold text-slate-700 group-hover:text-[#E85D04] transition-colors">
                  Android
                </span>
                <span className="block text-[11px] text-slate-400 font-medium">
                  Tap icon to install from Play Store
                </span>
              </div>
            </a>

          </div>
        </div>

        {/* Modal Bottom Helpline Footer */}
        <div className="bg-slate-50 border-t border-slate-100 py-3.5 px-6 text-center text-xs text-slate-500 font-medium">
          Need assistance? Call our 24/7 Helpline: <a href="tel:+917010659842" className="text-[#E85D04] font-bold hover:underline">+91 70106 59842</a>
        </div>
      </div>
    </div>
  );
};
