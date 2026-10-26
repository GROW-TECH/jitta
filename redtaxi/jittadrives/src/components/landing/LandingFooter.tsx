import React from 'react';
import { Phone, Mail, MapPin } from 'lucide-react';

interface LandingFooterProps {
  onOpenDownloadModal: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onOpenDownloadModal }) => {
  const customerPlayStoreUrl = "https://play.google.com/store/apps/details?id=com.xiadot.jittadrives.user";
  const driverPlayStoreUrl = "https://play.google.com/store/apps/details?id=com.xiadot.jittadrives.driver";

  return (
    <footer id="contact" className="bg-[#0A0D14] text-white pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 pb-12 border-b border-slate-800/80">
          
          {/* Col 1: Customer App Download */}
          <div className="space-y-4">
            <h4 className="text-sm font-extrabold text-white tracking-wide">
              Customer app
            </h4>

            <a
              href={customerPlayStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-[#0E1320] hover:bg-slate-900 border border-slate-700/80 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all active:scale-95 group"
            >
              <svg className="w-5 h-5 shrink-0 transform group-hover:scale-105 transition-transform" viewBox="0 0 512 512">
                <path fill="#00C1A6" d="M30.4 18.2C24 25.4 20 36.4 20 50.4v411.2c0 14 4 25 10.4 32.2l1.6 1.6L254.6 272v-8L32 16.6l-1.6 1.6z"/>
                <path fill="#FF3A44" d="M331 348.4l-76.4-76.4v-8l76.4-76.4 1.8 1 90.7 51.5c25.9 14.7 25.9 38.7 0 53.4L332.8 347.4l-1.8 1z"/>
                <path fill="#00E676" d="M254.6 272L32 494.6c8.6 9.1 22.8 10.2 38.8 1.1l240.2-136.5L254.6 272z"/>
                <path fill="#FFD600" d="M254.6 256L311 199.6 70.8 62.7c-16-9.1-30.2-8-38.8 1.1L254.6 256z"/>
              </svg>
              <div className="text-left leading-tight">
                <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-semibold">GET IT ON</span>
                <span className="block text-xs font-black text-white">Google Play</span>
              </div>
            </a>
          </div>

          {/* Col 2: Captain App Download */}
          <div className="space-y-4">
            <h4 className="text-sm font-extrabold text-white tracking-wide">
              Captain app
            </h4>

            <a
              href={driverPlayStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-[#0E1320] hover:bg-slate-900 border border-slate-700/80 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all active:scale-95 group"
            >
              <svg className="w-5 h-5 shrink-0 transform group-hover:scale-105 transition-transform" viewBox="0 0 512 512">
                <path fill="#00C1A6" d="M30.4 18.2C24 25.4 20 36.4 20 50.4v411.2c0 14 4 25 10.4 32.2l1.6 1.6L254.6 272v-8L32 16.6l-1.6 1.6z"/>
                <path fill="#FF3A44" d="M331 348.4l-76.4-76.4v-8l76.4-76.4 1.8 1 90.7 51.5c25.9 14.7 25.9 38.7 0 53.4L332.8 347.4l-1.8 1z"/>
                <path fill="#00E676" d="M254.6 272L32 494.6c8.6 9.1 22.8 10.2 38.8 1.1l240.2-136.5L254.6 272z"/>
                <path fill="#FFD600" d="M254.6 256L311 199.6 70.8 62.7c-16-9.1-30.2-8-38.8 1.1L254.6 256z"/>
              </svg>
              <div className="text-left leading-tight">
                <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-semibold">GET IT ON</span>
                <span className="block text-xs font-black text-white">Google Play</span>
              </div>
            </a>
          </div>

          {/* Col 3: Company Navigation */}
          <div className="space-y-3">
            <h4 className="text-sm font-extrabold text-white tracking-wide mb-4">
              Company
            </h4>
            <ul className="space-y-2 text-xs font-medium text-slate-400">
              <li><a href="#home" className="hover:text-white transition-colors">Home</a></li>
              <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#safety" className="hover:text-white transition-colors">Safety</a></li>
              <li><a href="#fleet" className="hover:text-white transition-colors">Services</a></li>
              <li><a href="#captain" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="/terms-and-conditions.html" className="hover:text-white transition-colors">Terms & Conditions</a></li>
              <li><a href="/privacy-policy.html" className="hover:text-white transition-colors">Privacy Policy</a></li>
            </ul>
          </div>

          {/* Col 4: Terms & Regulations */}
          <div className="space-y-3 lg:col-span-2">
            <h4 className="text-sm font-extrabold text-white tracking-wide mb-4">
              Terms & Legal
            </h4>
            <ul className="space-y-2 text-xs font-medium text-slate-400">
              <li><a href="/terms-and-conditions.html" className="hover:text-white transition-colors">Terms & Conditions Overview</a></li>
              <li><a href="/terms-and-conditions.html" className="hover:text-white transition-colors">Customer Terms - Two Wheeler</a></li>
              <li><a href="/terms-and-conditions.html" className="hover:text-white transition-colors">Customer Terms - Cabs & Auto</a></li>
              <li><a href="#about" className="hover:text-white transition-colors">Corporate Affairs</a></li>
              <li><a href="/terms-and-conditions.html" className="hover:text-white transition-colors">Captain Terms - Two Wheeler</a></li>
              <li><a href="/terms-and-conditions.html" className="hover:text-white transition-colors">Captain Terms - Cabs & Auto</a></li>
              <li><a href="/delete-account.html" className="text-orange-400 hover:text-orange-300 font-semibold transition-colors">Account & Data Deletion</a></li>
            </ul>
          </div>

          {/* Col 5: Follow Us & Socials */}
          <div className="space-y-4">
            <h4 className="text-sm font-extrabold text-white tracking-wide">
              Follow Us
            </h4>

            <div className="flex items-center gap-3">
              {/* Facebook */}
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-[#E85D04] text-white flex items-center justify-center transition-colors"
                aria-label="Facebook"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>

              {/* Twitter / X */}
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-[#E85D04] text-white flex items-center justify-center transition-colors"
                aria-label="Twitter X"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>

              {/* LinkedIn */}
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-[#E85D04] text-white flex items-center justify-center transition-colors"
                aria-label="LinkedIn"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>

              {/* Instagram */}
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-[#E85D04] text-white flex items-center justify-center transition-colors"
                aria-label="Instagram"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
            </div>

            <div className="pt-2 text-xs text-slate-400 space-y-1">
              <p className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#E85D04]" />
                <a href="tel:+918220444321" className="hover:text-white font-bold">+91 82204 44321</a>
              </p>
              <p className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#E85D04]" />
                <a href="mailto:Jittadrives@gmail.com" className="hover:text-white font-medium">Jittadrives@gmail.com</a>
              </p>
            </div>
          </div>

        </div>

        {/* Bottom Copyright Bar */}
        <div className="pt-8 text-center text-xs text-slate-500 font-medium">
          <p>© 2026 Jitta Drives Transportation. All rights reserved.</p>
          <p className="text-[11px] text-slate-600 mt-1">
            Salem, Tamil Nadu, India • Licensed Ride-Hailing Platform
          </p>
        </div>

      </div>
    </footer>
  );
};
