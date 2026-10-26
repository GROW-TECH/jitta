import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  HelpCircle,
  Phone,
  CheckCircle2,
  Lock,
  ChevronRight,
  FileText,
  Camera,
  Upload,
  ShieldCheck,
  CreditCard,
  Volume2,
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  Car,
  Bike,
  User,
} from 'lucide-react';
import { useTaxiApp } from '../../context/TaxiAppContext';
import { driverApi } from '../../services/api';

interface RapidoDocumentsViewProps {
  onBack?: () => void;
  onComplete?: () => void;
}

export const RapidoDocumentsView: React.FC<RapidoDocumentsViewProps> = ({ onBack, onComplete }) => {
  const {
    language,
    driverProfile,
    setDriverProfile,
    setDriverScreen,
    refreshDriverData,
  } = useTaxiApp() as any;

  // Selected vehicle category: Taxi (Car), Two-Wheeler (Bike/Scooty), Active Driver (Acting Driver)
  type DriverRegCategory = 'Taxi' | 'Two-Wheeler' | 'Active Driver';
  const initialCategory: DriverRegCategory =
    driverProfile?.vehicleType === 'ACTING_DRIVER'
      ? 'Active Driver'
      : (driverProfile?.vehicleType === 'TWO_WHEELER' || driverProfile?.vehicleType === 'Bike')
      ? 'Two-Wheeler'
      : 'Taxi';

  const [selectedVehicle, setSelectedVehicle] = useState<DriverRegCategory>(initialCategory);
  const [showVehiclePicker, setShowVehiclePicker] = useState<boolean>(false);

  // Expanded document section
  const [activeDocModal, setActiveDocModal] = useState<string | null>(null);

  // Form states for each document
  const [dlNumber, setDlNumber] = useState<string>(driverProfile?.documentNumbers?.license || 'TN3020210008452');
  const [dlExpiry, setDlExpiry] = useState<string>('2032-12-31');
  const [dlFrontUploaded, setDlFrontUploaded] = useState<boolean>(true);

  const [driverName, setDriverName] = useState<string>(driverProfile?.name || 'Karthik Raja');
  const [photoUploaded, setPhotoUploaded] = useState<boolean>(true);

  const [vehiclePlate, setVehiclePlate] = useState<string>(driverProfile?.vehicleNumber || 'TN 30 BD 5678');
  const [rcUploaded, setRcUploaded] = useState<boolean>(true);

  const [idType, setIdType] = useState<'AADHAAR' | 'PAN'>('AADHAAR');
  const [idNumber, setIdNumber] = useState<string>('5432-8765-4321');
  const [idUploaded, setIdUploaded] = useState<boolean>(true);

  // Permissions state
  const [locPermission, setLocPermission] = useState<boolean>(true);
  const [notifPermission, setNotifPermission] = useState<boolean>(true);

  // Status & loading
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isInstantApproving, setIsInstantApproving] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const [audioGuidePlaying, setAudioGuidePlaying] = useState<boolean>(false);

  // Check document statuses
  const [docStatuses, setDocStatuses] = useState({
    vehicle: true,
    drivingLicense: true,
    photoName: true,
    vehicleNumber: true,
    aadhaarPan: true,
    permissions: true,
  });

  const handleInstantApprove = async () => {
    setIsInstantApproving(true);
    setFeedbackMsg('');
    try {
      const backendVehicleType =
        selectedVehicle === 'Active Driver'
          ? 'ACTING_DRIVER'
          : selectedVehicle === 'Two-Wheeler'
          ? 'TWO_WHEELER'
          : 'TAXI';

      const finalPlate = selectedVehicle === 'Active Driver' ? '' : vehiclePlate;

      // 1. Upload sample document entries to backend
      await driverApi.uploadDocument({
        document_type: 'LICENSE',
        document_number: dlNumber,
        file_url: 'https://storage.jittadrives.com/docs/dl_demo.jpg',
        expiry_date: dlExpiry,
      }).catch(() => null);

      if (selectedVehicle !== 'Active Driver') {
        await driverApi.uploadDocument({
          document_type: 'RC',
          document_number: finalPlate,
          file_url: 'https://storage.jittadrives.com/docs/rc_demo.jpg',
        }).catch(() => null);
      }

      await driverApi.uploadDocument({
        document_type: idType,
        document_number: idNumber,
        file_url: 'https://storage.jittadrives.com/docs/id_demo.jpg',
      }).catch(() => null);

      // 2. Trigger instant approval in backend
      const res = await driverApi.instantApprove();
      const updatedProfile = {
        ...driverProfile,
        approvalStatus: 'APPROVED' as const,
        isOnline: true,
        vehicleType: backendVehicleType,
        vehicleNumber: finalPlate,
      };

      if (typeof setDriverProfile === 'function') {
        setDriverProfile((prev: any) => ({
          ...prev,
          ...updatedProfile,
        }));
      }
      try {
        localStorage.setItem('redtaxi_driver_profile', JSON.stringify(updatedProfile));
      } catch {}

      if (res && res.success) {
        await refreshDriverData();
      }
      
      if (onComplete) {
        onComplete();
      } else {
        setDriverScreen('DRIVER_HOME');
      }
    } catch {
      const backendVehicleType =
        selectedVehicle === 'Active Driver'
          ? 'ACTING_DRIVER'
          : selectedVehicle === 'Two-Wheeler'
          ? 'TWO_WHEELER'
          : 'TAXI';

      const fallback = {
        ...driverProfile,
        approvalStatus: 'APPROVED' as const,
        isOnline: true,
        vehicleType: backendVehicleType,
        vehicleNumber: selectedVehicle === 'Active Driver' ? '' : vehiclePlate,
      };
      if (typeof setDriverProfile === 'function') {
        setDriverProfile((prev: any) => ({ ...prev, ...fallback }));
      }
      try {
        localStorage.setItem('redtaxi_driver_profile', JSON.stringify(fallback));
      } catch {}
      setDriverScreen('DRIVER_HOME');
    } finally {
      setIsInstantApproving(false);
    }
  };

  const handleSaveDocItem = async (type: string) => {
    setIsSubmitting(true);
    try {
      if (type === 'DL') {
        await driverApi.uploadDocument({
          document_type: 'LICENSE',
          document_number: dlNumber,
          expiry_date: dlExpiry,
        });
        setDocStatuses((p) => ({ ...p, drivingLicense: true }));
      } else if (type === 'RC') {
        await driverApi.uploadDocument({
          document_type: 'RC',
          document_number: vehiclePlate,
        });
        setDocStatuses((p) => ({ ...p, vehicleNumber: true }));
      } else if (type === 'ID') {
        await driverApi.uploadDocument({
          document_type: idType,
          document_number: idNumber,
        });
        setDocStatuses((p) => ({ ...p, aadhaarPan: true }));
      }
    } catch {
      // offline handling
    } finally {
      setIsSubmitting(false);
      setActiveDocModal(null);
    }
  };

  const playVoicePrompt = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text =
        language === 'ta'
          ? 'உங்கள் ஓட்டுநர் உரிமம் மற்றும் வாகன ஆவணங்களை பதிவேற்றம் செய்யவும்.'
          : 'Please upload your Driving License and Vehicle RC documents to start earning with Jitta Drives.';
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = language === 'ta' ? 'ta-IN' : 'en-IN';
      utter.rate = 0.95;
      utter.onstart = () => setAudioGuidePlaying(true);
      utter.onend = () => setAudioGuidePlaying(false);
      window.speechSynthesis.speak(utter);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] text-[#0F172A] relative overflow-hidden font-sans">
      {/* 1. Header Bar matching Rapido Captain Image 3 */}
      <header className="w-full bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (onBack ? onBack() : setDriverScreen('DRIVER_LOGIN'))}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Documents</h1>
        </div>

        {/* Action icons right */}
        <div className="flex items-center gap-2">
          {/* Help button */}
          <button
            onClick={() => setActiveDocModal('HELP')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-300 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
            <span>Help</span>
          </button>

          {/* Language Chip */}
          <button
            onClick={() => alert('Language is set to English / தமிழ்')}
            className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-700 bg-white hover:bg-slate-50"
          >
            {language === 'ta' ? 'அ' : 'EN'}
          </button>

          {/* Call / Phone */}
          <a
            href="tel:1800123456"
            className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-700 bg-white hover:bg-slate-50"
            aria-label="Call support"
          >
            <Phone className="w-4 h-4 text-slate-600" />
          </a>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24 relative">
        {/* Floating Voice Guide Pill (as in Rapido image 3) */}
        <button
          onClick={playVoicePrompt}
          className={`fixed right-4 top-24 z-30 w-11 h-11 rounded-2xl shadow-lg flex items-center justify-center transition-all active:scale-95 ${
            audioGuidePlaying
              ? 'bg-[#E85D04] text-white animate-pulse'
              : 'bg-[#6366F1] text-white hover:bg-[#4F46E5]'
          }`}
          title="Voice Guide"
          aria-label="Voice Guide"
        >
          <Volume2 className="w-5 h-5" />
        </button>

        {/* 2. Hero Section matching Rapido Captain Image 3 */}
        <div className="bg-gradient-to-r from-[#EFF6FF] via-[#DBEAFE] to-[#E0E7FF] p-5 sm:p-6 border-b border-blue-100 flex items-center justify-between relative overflow-hidden">
          <div className="max-w-[70%] z-10">
            <h2 className="text-lg sm:text-xl font-extrabold text-[#1E3A8A] leading-tight">
              Upload the documents to start earning
            </h2>
            <p className="text-xs sm:text-sm text-[#3B82F6] font-medium mt-1">
              Complete all steps to get activated
            </p>
          </div>

          {/* Document Upload Graphic Illustration */}
          <div className="relative z-10 shrink-0 w-16 h-16 sm:w-20 sm:h-20 bg-white/90 rounded-2xl shadow-sm border border-blue-200/80 flex items-center justify-center text-[#1E3A8A]">
            <div className="relative">
              <FileText className="w-10 h-10 text-[#2563EB]" />
              <div className="absolute -top-1 -right-1 bg-[#2563EB] text-white rounded-full p-0.5 shadow-xs">
                <Upload className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Circular Story Badges (Learn to Upload, Questions, Why Jitta, Earnings) */}
        <div className="py-4 px-4 bg-white border-b border-slate-100">
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-none py-1">
            {/* 1. Learn to Upload */}
            <div
              onClick={() => setActiveDocModal('LEARN')}
              className="flex flex-col items-center min-w-[70px] cursor-pointer group"
            >
              <div className="relative w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-rose-500 via-pink-400 to-indigo-500 shadow-xs flex items-center justify-center group-hover:scale-105 transition">
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center overflow-hidden">
                  <CreditCard className="w-6 h-6 text-indigo-600" />
                </div>
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px]">
                  ★
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-700 mt-1.5 text-center leading-tight">
                Learn to Upload
              </span>
            </div>

            {/* 2. Questions */}
            <div
              onClick={() => setActiveDocModal('QUESTIONS')}
              className="flex flex-col items-center min-w-[70px] cursor-pointer group"
            >
              <div className="relative w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-yellow-500 shadow-xs flex items-center justify-center group-hover:scale-105 transition">
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center overflow-hidden">
                  <span className="text-xl">💬</span>
                </div>
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px]">
                  ★
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-700 mt-1.5 text-center leading-tight">
                Questions
              </span>
            </div>

            {/* 3. Why Jitta */}
            <div
              onClick={() => setActiveDocModal('WHY_JITTA')}
              className="flex flex-col items-center min-w-[70px] cursor-pointer group"
            >
              <div className="relative w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-amber-500 to-orange-400 shadow-xs flex items-center justify-center group-hover:scale-105 transition">
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center overflow-hidden">
                  <span className="font-black text-xs text-orange-600">jitta?</span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-700 mt-1.5 text-center leading-tight">
                Why Jitta
              </span>
            </div>

            {/* 4. Earnings */}
            <div
              onClick={() => setActiveDocModal('EARNINGS_INFO')}
              className="flex flex-col items-center min-w-[70px] cursor-pointer group"
            >
              <div className="relative w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-xs flex items-center justify-center group-hover:scale-105 transition">
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center overflow-hidden">
                  <span className="text-xl">💵</span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-700 mt-1.5 text-center leading-tight">
                Earnings
              </span>
            </div>
          </div>
        </div>

        {/* 4. Document Checklist Cards (Exactly as Image 3) */}
        <div className="p-4 space-y-3">
          {/* Item 1: Vehicle Category Selector */}
          <div
            onClick={() => setShowVehiclePicker(!showVehiclePicker)}
            className="w-full bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between cursor-pointer hover:border-slate-300 transition"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Category: {selectedVehicle === 'Two-Wheeler' ? 'Two-Wheeler (Bike / Scooty)' : selectedVehicle === 'Taxi' ? 'Taxi (Car)' : 'Active Driver (Acting Driver)'}
                </h3>
                <p className="text-xs text-emerald-600 font-medium">Selected (Tap to change category)</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>

          {/* Vehicle Type Inline Selector */}
          {showVehiclePicker && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 animate-in fade-in">
              {[
                { id: 'Taxi' as const, label: 'Taxi (Car)', desc: 'Car-based rides (Mini, Sedan, SUV)', icon: <Car className="w-4 h-4" /> },
                { id: 'Two-Wheeler' as const, label: 'Two-Wheeler (Bike/Scooty)', desc: 'Bike & Scooty rides', icon: <Bike className="w-4 h-4" /> },
                { id: 'Active Driver' as const, label: 'Active Driver (Acting Driver)', desc: "Customer vehicle (No RC needed)", icon: <User className="w-4 h-4" /> },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedVehicle(cat.id);
                    setShowVehiclePicker(false);
                  }}
                  className={`py-2 px-3 rounded-xl text-left border transition flex items-center gap-2.5 ${
                    selectedVehicle === cat.id
                      ? 'bg-[#E85D04] text-white border-[#E85D04] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 ${selectedVehicle === cat.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {cat.icon}
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">{cat.label}</div>
                    <div className={`text-[10px] ${selectedVehicle === cat.id ? 'text-white/80' : 'text-slate-400'}`}>{cat.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Item 2: Driving License (Active Navy Blue Box as in Image 3) */}
          <div
            onClick={() => setActiveDocModal('DL')}
            className="w-full bg-[#1E3A8A] text-white rounded-2xl p-4 shadow-md flex items-center justify-between cursor-pointer hover:bg-[#1E40AF] transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Driving License</h3>
                <p className="text-xs text-blue-200 font-medium">
                  {dlNumber ? `Number: ${dlNumber}` : 'Tap to upload DL front & back'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white" />
          </div>

          {/* Item 3: Photo and name */}
          <div
            onClick={() => setActiveDocModal('PHOTO')}
            className="w-full bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between cursor-pointer hover:border-slate-300 transition"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Photo and name</h3>
                <p className="text-xs text-slate-500">{driverName || 'Selfie & Legal Full Name'}</p>
              </div>
            </div>
            {photoUploaded ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400" />
            )}
          </div>

          {/* Item 4: Vehicle Number (Hidden for Active Driver) */}
          {selectedVehicle !== 'Active Driver' ? (
            <div
              onClick={() => setActiveDocModal('RC')}
              className="w-full bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between cursor-pointer hover:border-slate-300 transition"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                  <Car className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Vehicle Number & RC</h3>
                  <p className="text-xs text-slate-500 font-mono">{vehiclePlate || 'e.g. TN 30 BD 5678'}</p>
                </div>
              </div>
              {rcUploaded ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <Lock className="w-4 h-4 text-slate-400" />
              )}
            </div>
          ) : (
            <div className="w-full bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-3 text-emerald-800 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                <strong>Active Driver (Acting Driver):</strong> You drive customer vehicles. No personal vehicle plate or RC document required.
              </span>
            </div>
          )}

          {/* Item 5: Aadhaar or PAN card */}
          <div
            onClick={() => setActiveDocModal('ID')}
            className="w-full bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between cursor-pointer hover:border-slate-300 transition"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Aadhaar or PAN card</h3>
                <p className="text-xs text-slate-500">Government ID Verification</p>
              </div>
            </div>
            {idUploaded ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400" />
            )}
          </div>

          {/* Item 6: Permissions (optional) */}
          <div
            onClick={() => setActiveDocModal('PERMISSIONS')}
            className="w-full bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between cursor-pointer hover:border-slate-300 transition"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Permissions (optional)</h3>
                <p className="text-xs text-slate-500">Location GPS & Notifications</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        {/* 5. Instant Test Approval Box (For Seamless Testing as requested) */}
        <div className="px-4 mt-2">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Testing Mode — Instant Activation
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Bypass document review waiting time: automatically marks all documents as verified, registers active vehicle, and credits ₹500 test wallet so you can test rides immediately.
                </p>
                <button
                  onClick={handleInstantApprove}
                  disabled={isInstantApproving}
                  className="mt-3 w-full bg-[#E85D04] hover:bg-[#C2410C] active:scale-[0.99] text-white text-xs font-black py-2.5 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 transition"
                >
                  {isInstantApproving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Activating Driver Account…</span>
                    </>
                  ) : (
                    <>
                      <span>⚡ Instant Verify & Go to Driver App</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Document Upload Drawer / Modal */}
      {activeDocModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {activeDocModal === 'DL' && 'Driving License Details'}
                {activeDocModal === 'PHOTO' && 'Profile Photo & Legal Name'}
                {activeDocModal === 'RC' && 'Vehicle Registration (RC)'}
                {activeDocModal === 'ID' && 'Aadhaar / PAN Card'}
                {activeDocModal === 'PERMISSIONS' && 'App Permissions'}
                {activeDocModal === 'HELP' && 'Document Verification Help'}
                {activeDocModal === 'LEARN' && 'How to Upload Documents'}
                {activeDocModal === 'QUESTIONS' && 'Frequently Asked Questions'}
                {activeDocModal === 'WHY_JITTA' && 'Why Drive with Jitta Drives?'}
                {activeDocModal === 'EARNINGS_INFO' && 'Driver Earnings Structure'}
              </h3>
              <button
                onClick={() => setActiveDocModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-4 space-y-4">
              {activeDocModal === 'DL' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Driving License Number</label>
                    <input
                      type="text"
                      value={dlNumber}
                      onChange={(e) => setDlNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. TN3020210008452"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-[#E85D04]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={dlExpiry}
                      onChange={(e) => setDlExpiry(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#E85D04]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">DL Photo (Front & Back)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-3 flex flex-col items-center justify-center bg-slate-50 text-slate-600 hover:bg-slate-100 cursor-pointer">
                        <Camera className="w-5 h-5 text-[#E85D04] mb-1" />
                        <span className="text-[11px] font-bold">Front Photo</span>
                        <span className="text-[9px] text-emerald-600 font-bold mt-0.5">✓ Uploaded</span>
                      </div>
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-3 flex flex-col items-center justify-center bg-slate-50 text-slate-600 hover:bg-slate-100 cursor-pointer">
                        <Upload className="w-5 h-5 text-indigo-500 mb-1" />
                        <span className="text-[11px] font-bold">Back Photo</span>
                        <span className="text-[9px] text-emerald-600 font-bold mt-0.5">✓ Uploaded</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSaveDocItem('DL')}
                    disabled={isSubmitting}
                    className="w-full bg-[#1E3A8A] text-white font-bold py-3 rounded-xl mt-2 hover:bg-[#1E40AF]"
                  >
                    {isSubmitting ? 'Saving…' : 'Save & Verify License'}
                  </button>
                </>
              )}

              {activeDocModal === 'PHOTO' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                    />
                  </div>
                  <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 flex flex-col items-center justify-center bg-slate-50 text-center">
                    {driverProfile?.photo ? (
                      <img
                        src={driverProfile.photo}
                        alt="Driver"
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md mb-2"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-200 border-2 border-white shadow-md mb-2 flex items-center justify-center text-slate-500">
                        <User className="w-8 h-8 text-slate-500" />
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-800">Clear Profile Photo</span>
                    <span className="text-[10px] text-slate-500">Face must be clearly visible without sunglasses</span>
                  </div>
                  <button
                    onClick={() => setActiveDocModal(null)}
                    className="w-full bg-[#E85D04] text-white font-bold py-3 rounded-xl"
                  >
                    Confirm Photo
                  </button>
                </>
              )}

              {activeDocModal === 'RC' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle Registration Number</label>
                    <input
                      type="text"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                      placeholder="e.g. TN 30 BD 5678"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center bg-slate-50 text-slate-600">
                    <Upload className="w-6 h-6 text-indigo-500 mb-1" />
                    <span className="text-xs font-bold">Upload RC Smart Card Copy</span>
                    <span className="text-[10px] text-emerald-600 font-bold mt-1">✓ File Attached (demo)</span>
                  </div>
                  <button
                    onClick={() => handleSaveDocItem('RC')}
                    disabled={isSubmitting}
                    className="w-full bg-[#E85D04] text-white font-bold py-3 rounded-xl"
                  >
                    Save Vehicle RC
                  </button>
                </>
              )}

              {activeDocModal === 'ID' && (
                <>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIdType('AADHAAR')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                        idType === 'AADHAAR' ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      Aadhaar Card
                    </button>
                    <button
                      onClick={() => setIdType('PAN')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                        idType === 'PAN' ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      PAN Card
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {idType === 'AADHAAR' ? 'Aadhaar Number (12 Digits)' : 'PAN Number (10 Characters)'}
                    </label>
                    <input
                      type="text"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900"
                    />
                  </div>
                  <button
                    onClick={() => handleSaveDocItem('ID')}
                    disabled={isSubmitting}
                    className="w-full bg-[#1E3A8A] text-white font-bold py-3 rounded-xl"
                  >
                    Save Identity Document
                  </button>
                </>
              )}

              {activeDocModal === 'PERMISSIONS' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <span className="block text-xs font-bold text-slate-800">GPS Live Location</span>
                      <span className="text-[10px] text-slate-500">Required for nearby ride dispatches</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={locPermission}
                      onChange={(e) => setLocPermission(e.target.checked)}
                      className="w-5 h-5 accent-[#E85D04]"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <span className="block text-xs font-bold text-slate-800">Push Notifications & Sounds</span>
                      <span className="text-[10px] text-slate-500">Ring for incoming customer rides</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifPermission}
                      onChange={(e) => setNotifPermission(e.target.checked)}
                      className="w-5 h-5 accent-[#E85D04]"
                    />
                  </div>
                  <button
                    onClick={() => setActiveDocModal(null)}
                    className="w-full bg-[#E85D04] text-white font-bold py-2.5 rounded-xl"
                  >
                    Done
                  </button>
                </div>
              )}

              {['LEARN', 'QUESTIONS', 'WHY_JITTA', 'EARNINGS_INFO', 'HELP'].includes(activeDocModal) && (
                <div className="space-y-3 text-xs text-slate-600">
                  <p>
                    <strong>Jitta Drives Captain Onboarding:</strong> All driver partners are required to upload valid Driving License, Vehicle RC, and Aadhaar card before accepting live trips.
                  </p>
                  <p>
                    Once submitted, our automated verification approves valid documents within minutes. For testing, you can use the instant verification button.
                  </p>
                  <button
                    onClick={() => setActiveDocModal(null)}
                    className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl mt-3"
                  >
                    Got It
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
