import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useTaxiApp } from '../../context/TaxiAppContext';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../../i18n/translations';

interface LanguageSwitcherProps {
  compact?: boolean;
  showFlag?: boolean;
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  compact = false,
  className = '',
}) => {
  const { language, setLanguage, themeMode } = useTaxiApp();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isLight = themeMode === 'LIGHT';

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLanguage = (code: LanguageCode) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs border transition shadow-xs select-none ${
          isLight
            ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 hover:border-[#E85D04]/40'
            : 'bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 text-slate-100 hover:border-[#E85D04]/50'
        }`}
        title="Change Language / மொழி மாற்றுக"
        aria-expanded={isOpen}
      >
        <div className="w-5 h-5 rounded-lg bg-[#E85D04]/10 text-[#E85D04] flex items-center justify-center shrink-0">
          <Globe className="w-3.5 h-3.5 text-[#E85D04]" />
        </div>
        
        <span className="font-extrabold text-[11px] text-[#E85D04] bg-[#E85D04]/10 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
          {currentLang.code}
        </span>

        <span className={compact ? 'hidden md:inline font-semibold' : 'inline font-semibold'}>
          {currentLang.nativeName}
        </span>

        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#E85D04]' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 mt-1.5 w-44 rounded-2xl shadow-2xl border p-1 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md ${
            isLight
              ? 'bg-white/98 border-slate-200 text-slate-900 shadow-slate-300/60'
              : 'bg-slate-900/98 border-slate-800 text-slate-100 shadow-black/80'
          }`}
        >
          <div className="space-y-0.5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = lang.code === language;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelectLanguage(lang.code)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-[#FFF7F0] dark:bg-[#E85D04]/15 text-[#E85D04] font-bold border border-[#E85D04]/30'
                      : isLight
                      ? 'hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-transparent'
                      : 'hover:bg-slate-800 text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-[#E85D04]/10 text-[#E85D04] font-mono font-bold text-[10px] flex items-center justify-center uppercase shrink-0">
                      {lang.code}
                    </span>
                    <div className="text-left">
                      <div className="text-xs font-bold leading-tight">{lang.nativeName}</div>
                      <div className="text-[10px] opacity-70 leading-none">{lang.name}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#E85D04] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
