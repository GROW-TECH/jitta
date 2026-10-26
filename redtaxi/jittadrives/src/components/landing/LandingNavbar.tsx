import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface LandingNavbarProps {
  onOpenDownloadModal: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({ onOpenDownloadModal }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Home', href: '#home' },
    { label: 'About Us', href: '#about' },
    { label: 'Safety', href: '#safety' },
    { label: 'Our Services', href: '#fleet' },
    { label: 'Drive with Us', href: '#captain' },
    { label: 'Contact Us', href: '#contact' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo */}
          <a href="#home" className="flex items-center gap-3 group py-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white border border-slate-200/80 shadow-xs flex items-center justify-center p-0.5 overflow-hidden transition-transform group-hover:scale-105 shrink-0">
              <img src="/logo.png" alt="Jitta Drives" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 group-hover:text-[#E85D04] transition-colors leading-none">
                Jitta <span className="text-[#E85D04]">Drives</span>
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 tracking-wider uppercase mt-1">
                We Drive Your Rides
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 xl:gap-9">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-bold text-slate-700 hover:text-[#E85D04] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#E85D04] after:scale-x-0 hover:after:scale-x-100 after:transition-transform"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right Action Button: Download App Only */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={onOpenDownloadModal}
              className="px-6 py-2.5 rounded-full bg-slate-950 hover:bg-[#E85D04] text-white font-extrabold text-xs sm:text-sm transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              Download App
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={onOpenDownloadModal}
              className="px-3.5 py-1.5 rounded-full bg-slate-950 text-white font-extrabold text-xs sm:hidden"
            >
              App
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white px-4 pt-3 pb-6 space-y-3 shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col space-y-2">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl text-sm font-extrabold text-slate-800 hover:bg-slate-50 hover:text-[#E85D04] transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenDownloadModal();
              }}
              className="w-full py-3 rounded-xl bg-[#E85D04] text-white font-extrabold text-sm shadow-md"
            >
              Download App
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
