import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Car,
  Phone,
  MessageSquare,
  Share2,
  X,
  Send,
  AlertTriangle,
  Shield,
  User,
  CheckCircle2,
  Edit3,
  Clock,
  RefreshCw,
  Mic,
  Trash2,
} from 'lucide-react';
import { useTaxiApp, sanitizeBrandText } from '../../context/TaxiAppContext';
import { InteractiveMap } from '../common/InteractiveMap';
import { validateVehicleNumber } from '../../utils/vehicleRegValidator';
import { VoiceMessageBubble } from '../common/VoiceMessageBubble';

export const CustomerActiveTripView: React.FC = () => {
  const {
    language,
    customerScreen,
    setCustomerScreen,
    activeBooking,
    setActiveBooking,
    confirmBooking,
    cancelActiveBooking,
    driverProfile,
    driverEta,
    simulatedProgress,
    chatMessages,
    sendChatMessage,
    completeCurrentTrip,
    customerUnreadChatCount,
    setCustomerUnreadChatCount,
    updateActiveBookingVehicleDetails,
  } = useTaxiApp() as any;

  const [searchTimer, setSearchTimer] = useState<number>(60);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Dynamic live ETA from driver's GPS to pickup location
  const liveDriverEta = useMemo(() => {
    if (activeBooking?.driverLocation?.lat && activeBooking?.pickup?.lat) {
      const lat1 = Number(activeBooking.driverLocation.lat);
      const lon1 = Number(activeBooking.driverLocation.lng);
      const lat2 = Number(activeBooking.pickup.lat);
      const lon2 = Number(activeBooking.pickup.lng);
      if (isFinite(lat1) && isFinite(lon1) && isFinite(lat2) && isFinite(lon2)) {
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distKm = 6371 * c;
        return Math.max(1, Math.ceil((distKm / 25) * 60));
      }
    }
    return driverEta;
  }, [activeBooking?.driverLocation, activeBooking?.pickup, driverEta]);

  // Search countdown timer (auto transitions to NO_DRIVERS_AVAILABLE at 60s)
  useEffect(() => {
    if (customerScreen === 'SEARCHING_DRIVER') {
      setSearchTimer(60);
      const timer = setInterval(() => {
        setSearchTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCustomerScreen('NO_DRIVERS_AVAILABLE');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [customerScreen, setCustomerScreen]);

  const [chatInput, setChatInput] = useState<string>('');
  const [showShareToast, setShowShareToast] = useState<boolean>(false);
  const [tripVehiclePlateInput, setTripVehiclePlateInput] = useState<string>('');
  const [isEditingPlate, setIsEditingPlate] = useState<boolean>(false);
  const [isSubmittingPlate, setIsSubmittingPlate] = useState<boolean>(false);
  const [plateSubmitError, setPlateSubmitError] = useState<string | null>(null);
  const [plateSubmitSuccess, setPlateSubmitSuccess] = useState<string | null>(null);
  const previousTripScreenRef = useRef<any>('DRIVER_EN_ROUTE');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice message recording states
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const startVoiceRecording = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        alert('Microphone recording is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
        else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(250);
      setIsRecordingVoice(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      alert('Please allow microphone permission to record voice messages.');
    }
  };

  const stopAndSendVoice = () => {
    if (!mediaRecorderRef.current || !isRecordingVoice) return;

    const recorder = mediaRecorderRef.current;
    recorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        if (base64Data) {
          sendChatMessage('CUSTOMER', '🎤 Voice Note', base64Data);
        }
      };
      reader.readAsDataURL(audioBlob);

      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };

    try {
      recorder.stop();
    } catch {}
    setIsRecordingVoice(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    audioChunksRef.current = [];
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatRecordTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSaveTripVehiclePlate = async () => {
    const raw = tripVehiclePlateInput.trim();
    if (!raw) {
      setPlateSubmitError('Please enter a vehicle registration number');
      return;
    }
    const check = validateVehicleNumber(raw);
    if (!check.isValid) {
      setPlateSubmitError(check.errorMessage || 'Invalid registration number format (e.g. TN 38 AB 1234)');
      return;
    }
    setPlateSubmitError(null);
    setIsSubmittingPlate(true);
    try {
      const res = await updateActiveBookingVehicleDetails(check.normalized, 'Customer Vehicle');
      if (res && res.success) {
        setPlateSubmitSuccess('Vehicle registration updated successfully!');
        setIsEditingPlate(false);
        setTripVehiclePlateInput('');
        setTimeout(() => setPlateSubmitSuccess(null), 3500);
      } else {
        setPlateSubmitError(res?.message || 'Failed to update vehicle details');
      }
    } catch (err: any) {
      setPlateSubmitError(err?.message || 'Error updating vehicle');
    } finally {
      setIsSubmittingPlate(false);
    }
  };

  useEffect(() => {
    if (customerScreen === 'CHAT') {
      setCustomerUnreadChatCount(0);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [customerScreen, chatMessages, setCustomerUnreadChatCount]);

  const quickReplies =
    language === 'ta'
      ? [
          'நான் மெயின் கேட் அருகில் காத்திருக்கிறேன்.',
          '2 நிமிடங்கள் காத்திருக்கவும், கீழே வருகிறேன்.',
          'நான் சரியான பிக்அப் இடத்தில் இருக்கிறேன்.',
          'இப்போது எங்கே இருக்கிறீர்கள்?',
          'வந்தவுடன் என்னை அழைக்கவும்.',
          'என்னிடம் லக்கேஜ் / பைகள் உள்ளன.',
        ]
      : [
          'I am waiting near the main gate.',
          'Please wait 2 minutes, coming down.',
          'I am at the exact pickup location.',
          'Where are you right now?',
          'Call me once you arrive.',
          'I have bags / luggage.',
        ];

  // 16. Searching For Driver Screen
  if (customerScreen === 'SEARCHING_DRIVER') {
    const searchPercent = Math.max(0, Math.min(100, Math.round(((60 - searchTimer) / 60) * 100)));
    const radiusText = searchTimer > 35
      ? (language === 'ta' ? '4 கி.மீ சுற்றளவில் தேடுகிறது' : 'Searching nearest drivers within 4 km')
      : searchTimer > 15
      ? (language === 'ta' ? '7 கி.மீ சுற்றளவில் விரிவுபடுத்துகிறது' : 'Expanding search radius to 7 km')
      : (language === 'ta' ? 'அனைத்து அருகிலுள்ள ஓட்டுநர்களுக்கும் அறிவிக்கப்படுகிறது' : 'Broadcasting to all active nearby drivers');

    return (
      <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] relative">
        <InteractiveMap height="h-full" showNearbyDrivers={true} forceLight={true} showControls={false} />

        <div className="absolute inset-0 bg-[#FAFAF8]/85 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 sm:p-6 text-center z-20">
          <div className="relative flex items-center justify-center mb-4 sm:mb-6">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-2 border-[#E85D04]/30 animate-radar absolute" />
            <div className="w-18 h-18 sm:w-24 sm:h-24 rounded-full border-2 border-[#E85D04]/50 animate-radar delay-300 absolute" />
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#E85D04] rounded-full flex items-center justify-center shadow-2xl shadow-[#E85D04]/40 ring-4 ring-[#E85D04]/20 z-10">
              <Car className="w-7 h-7 sm:w-8 sm:h-8 text-white animate-car-drive" />
            </div>
          </div>

          <h2 className="text-lg sm:text-xl font-extrabold text-[#171717]">
            {language === 'ta' ? 'ஓட்டுநரைத் தேடுகிறது...' : 'Finding Your Nearest Driver...'}
          </h2>
          <p className="text-[#737373] text-xs mt-1 max-w-xs">
            {radiusText}
          </p>

          {/* 60-Second Search Progress Bar */}
          <div className="w-full max-w-[260px] bg-black/10 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-[#E85D04] h-full transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${searchPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-[#737373] mt-1 font-mono font-bold">
            {searchTimer}s remaining
          </span>

          {activeBooking && (
            <div className="mt-3 sm:mt-4 bg-white/95 border border-black/5 p-3 rounded-2xl w-full max-w-[290px] sm:max-w-xs text-left text-xs space-y-1.5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#737373] font-bold uppercase tracking-wider">
                  {language === 'ta' ? 'முன்பதிவு #' : 'Booking #'}{activeBooking.id.length > 8 ? activeBooking.id.substring(0, 8).toUpperCase() : activeBooking.id}
                </span>
                <span className="text-[10px] bg-[#E85D04]/10 text-[#E85D04] border border-[#E85D04]/30 px-2 py-0.5 rounded-full font-bold">
                  {activeBooking.status}
                </span>
              </div>
              <div className="text-[#171717] font-bold truncate">
                {activeBooking.pickup?.name} → {activeBooking.drop?.name}
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#737373] pt-1 border-t border-black/5">
                <span>{(typeof activeBooking.vehicleCategory === 'object' ? (activeBooking.vehicleCategory as any)?.name : activeBooking.vehicleCategory) || 'Ride'} • ₹{activeBooking.fare?.totalFare || activeBooking.total_fare || ''}</span>
                {(activeBooking?.startOtp || activeBooking?.start_otp || activeBooking?.otp || activeBooking?.otp_code) && (
                  <span className="text-[#22A06B] font-bold">OTP: {activeBooking.startOtp || activeBooking.start_otp || activeBooking.otp || activeBooking.otp_code}</span>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 sm:mt-4 bg-white/95 border border-black/5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl flex items-center gap-2 text-xs text-[#22A06B] max-w-[290px] sm:max-w-xs">
            <span className="w-2 h-2 rounded-full bg-[#22A06B] animate-ping shrink-0" />
            <span className="truncate">
              {language === 'ta' ? 'அருகிலுள்ள ஓட்டுநர்களுக்கு அறிவிக்கப்படுகிறது • காத்திருக்கிறது' : 'Ringing closest driver • Waiting'}
            </span>
          </div>

          <button
            onClick={() => cancelActiveBooking()}
            className="mt-4 sm:mt-6 text-xs text-rose-600 hover:text-rose-500 font-bold border border-rose-600/30 px-4 py-2 rounded-xl transition hover:bg-rose-50 min-h-[40px]"
          >
            {language === 'ta' ? 'கோரிக்கையை ரத்து செய்' : 'Cancel Request'}
          </button>
        </div>
      </div>
    );
  }

  // 16b. No Drivers Available Screen (Search Timeout Flow)
  if (customerScreen === 'NO_DRIVERS_AVAILABLE') {
    return (
      <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] relative">
        <InteractiveMap height="h-full" showNearbyDrivers={false} forceLight={true} showControls={false} />

        <div className="absolute inset-0 bg-[#FAFAF8]/95 backdrop-blur-[4px] flex flex-col items-center justify-center p-5 text-center z-30">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-500/10 border-2 border-amber-500/20 rounded-full flex items-center justify-center mb-3 sm:mb-4 text-amber-600 shadow-xl">
            <Clock className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>

          <h2 className="text-lg sm:text-xl font-extrabold text-[#171717]">
            {language === 'ta' ? 'அனைத்து ஓட்டுநர்களும் தற்போது பணியில் உள்ளனர்' : 'All Nearby Drivers Are Currently Busy'}
          </h2>
          <p className="text-[#737373] text-xs mt-1.5 max-w-xs leading-relaxed">
            {language === 'ta'
              ? 'உங்கள் பகுதிக்கு அருகிலுள்ள ஓட்டுநர்கள் தற்போது பிற சவாரிகளில் உள்ளனர். முன்னுரிமையுடன் மீண்டும் முயற்சிக்கலாம் அல்லது வேறு வாகனத்தைத் தேர்ந்தெடுக்கலாம்.'
              : 'Captains around your pickup area are currently completing trips. You can retry with high priority or switch vehicle types.'}
          </p>

          {activeBooking && (
            <div className="mt-4 bg-white border border-black/5 p-3 rounded-2xl w-full max-w-xs text-left text-xs space-y-1.5 shadow-sm">
              <div className="text-[10px] text-[#737373] font-bold uppercase tracking-wider">
                {language === 'ta' ? 'பயண விபரம்' : 'Ride Request'}
              </div>
              <div className="text-[#171717] font-bold truncate">
                {activeBooking.pickup?.name} → {activeBooking.drop?.name}
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#737373] pt-1 border-t border-black/5">
                <span>{activeBooking.vehicleCategory || 'Ride'}</span>
                <span className="font-bold text-[#171717]">₹{activeBooking.fare?.totalFare || activeBooking.total_fare || ''}</span>
              </div>
            </div>
          )}

          <div className="w-full max-w-xs space-y-2 mt-5">
            <button
              disabled={isRetrying}
              onClick={async () => {
                setIsRetrying(true);
                setCustomerScreen('SEARCHING_DRIVER');
                try {
                  if (typeof confirmBooking === 'function') {
                    await confirmBooking();
                  }
                } finally {
                  setIsRetrying(false);
                }
              }}
              className="w-full py-3 bg-[#E85D04] hover:bg-[#D05303] text-white font-extrabold rounded-2xl text-xs sm:text-sm shadow-lg shadow-[#E85D04]/30 transition flex items-center justify-center gap-2 active:scale-98 disabled:opacity-70"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? (language === 'ta' ? 'தேடப்படுகிறது...' : 'Starting Priority Search...') : (language === 'ta' ? 'மீண்டும் தேடு (முன்னுரிமை)' : 'Try Again (Priority Search)')}</span>
            </button>

            <button
              onClick={() => setCustomerScreen('VEHICLE_SELECT')}
              className="w-full py-2.5 bg-white hover:bg-gray-50 text-[#171717] font-bold rounded-2xl text-xs border border-black/10 transition"
            >
              {language === 'ta' ? 'வேறு வாகனம் தேர்வு செய்' : 'Choose Another Vehicle'}
            </button>

            <button
              onClick={() => {
                cancelActiveBooking();
                setCustomerScreen('HOME');
              }}
              className="w-full py-2 text-xs text-[#737373] hover:text-black font-semibold transition"
            >
              {language === 'ta' ? 'ரத்து செய்து முகப்புக்குச் செல்' : 'Cancel & Return Home'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 17 & 18. Driver Assigned / En Route Screen
  if (
    customerScreen === 'DRIVER_ASSIGNED' ||
    customerScreen === 'DRIVER_EN_ROUTE' ||
    customerScreen === 'DRIVER_ARRIVED' ||
    customerScreen === 'TRIP_STARTED' ||
    customerScreen === 'LIVE_TRIP'
  ) {
    return (
      <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] relative">
        {/* Main Live Map with Live Driver Location tracking */}
        <InteractiveMap
          pickup={activeBooking?.pickup}
          drop={activeBooking?.drop}
          driverLocation={activeBooking?.driverLocation}
          progress={simulatedProgress}
          height="h-full"
          forceLight={true}
        />

        {/* Floating Incoming Driver Message Notification Banner */}
        {customerUnreadChatCount > 0 && (
          <div
            onClick={() => {
              previousTripScreenRef.current = customerScreen;
              setCustomerUnreadChatCount(0);
              setCustomerScreen('CHAT');
            }}
            className="absolute top-4 left-3 right-3 sm:left-6 sm:right-6 z-30 bg-[#171717]/95 backdrop-blur text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-white/10 cursor-pointer animate-bounce transition hover:bg-black"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-[#E85D04] flex items-center justify-center shrink-0 text-white font-bold text-xs relative">
                <MessageSquare className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-red-600 rounded-full text-[9px] font-black flex items-center justify-center ring-1 ring-white">
                  {customerUnreadChatCount}
                </span>
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[11px] font-bold text-white truncate">
                  {sanitizeBrandText(activeBooking?.driverName, 'Driver')} sent a message
                </p>
                <p className="text-[10px] text-gray-300 truncate">
                  {chatMessages[chatMessages.length - 1]?.text || 'Tap to reply'}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-[#E85D04] text-white px-2.5 py-1 rounded-xl shrink-0 shadow">
              Open Chat
            </span>
          </div>
        )}

        {/* Floating Chat Action Button on Map with Live Unread Badge */}
        <div className="absolute right-3.5 sm:right-5 bottom-[300px] sm:bottom-[320px] z-30">
          <button
            onClick={() => {
              previousTripScreenRef.current = customerScreen;
              setCustomerUnreadChatCount(0);
              setCustomerScreen('CHAT');
            }}
            className="w-12 h-12 bg-white hover:bg-gray-50 text-[#22A06B] rounded-full shadow-2xl border border-black/10 flex items-center justify-center relative transition active:scale-90 hover:scale-105"
            title="Chat with Driver"
            aria-label="Chat with Driver"
          >
            <MessageSquare className="w-5 h-5 text-[#22A06B]" />
            {customerUnreadChatCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 bg-[#EF4444] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xl ring-2 ring-white animate-bounce z-40">
                {customerUnreadChatCount > 9 ? '9+' : customerUnreadChatCount}
              </span>
            )}
          </button>
        </div>

        {/* Bottom Driver & Status Sheet Card */}
        <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-4 z-20 bg-white/95 backdrop-blur border border-black/5 p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-2xl space-y-3 sm:space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Header Status Bar */}
          <div className="flex items-center justify-between border-b border-black/5 pb-2.5 sm:pb-3 gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-[#E85D04] font-extrabold uppercase tracking-wider block truncate">
                {activeBooking?.status === 'ARRIVED'
                  ? (language === 'ta' ? 'உங்கள் ஓட்டுநர் வந்துவிட்டார்!' : 'Your Driver Has Arrived!')
                  : activeBooking?.status === 'IN_PROGRESS'
                  ? (language === 'ta' ? 'பயணம் நடைபெறுகிறது' : 'Trip In Progress')
                  : (language === 'ta' ? 'ஓட்டுநர் வந்து கொண்டிருக்கிறார்' : 'Driver On The Way')}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-bold text-[#171717] truncate">
                  {activeBooking?.status === 'ARRIVED'
                    ? (language === 'ta' ? 'ஏறும் இடத்தில் காத்திருக்கிறார்' : 'Waiting at pickup')
                    : activeBooking?.status === 'IN_PROGRESS'
                    ? (language === 'ta' ? `சேருமிடம் ${24 - Math.round((simulatedProgress / 100) * 20)} நிமிடங்களில்` : `Destination in ${24 - Math.round((simulatedProgress / 100) * 20)} min`)
                    : (language === 'ta' ? `${liveDriverEta} நிமிடங்களில் வருவார்` : `Arriving in ${liveDriverEta} min`)}
                </span>
              </div>
            </div>

            {/* OTP Display Badge */}
            <div className="bg-white border border-[#22A06B]/40 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-xl text-center shrink-0">
              <span className="text-[8px] sm:text-[9px] text-[#737373] block font-semibold">
                {language === 'ta' ? 'தொடக்க OTP' : 'START OTP'}
              </span>
              <span className="text-sm sm:text-base font-extrabold text-[#22A06B] tracking-wider font-mono">
                {activeBooking?.startOtp || activeBooking?.start_otp || activeBooking?.otp || activeBooking?.otp_code || '----'}
              </span>
            </div>
          </div>

          {/* Driver Card Info */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              {(activeBooking?.driverPhoto || driverProfile.photo) ? (
                <img
                  src={activeBooking?.driverPhoto || driverProfile.photo}
                  alt="Driver"
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-[#E85D04] shadow shrink-0"
                />
              ) : (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 border-2 border-[#E85D04]/30 flex items-center justify-center text-[#E85D04] shadow shrink-0">
                  <User className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-extrabold text-[#171717] flex items-center gap-1 truncate">
                  <span className="truncate">{activeBooking?.driverName || 'Driver Assigned'}</span>
                  <span className="text-[11px] text-amber-400 font-bold shrink-0">
                    ★ {activeBooking?.driverRating ? activeBooking.driverRating.toFixed(1) : '5.0'}
                  </span>
                </h4>
                <p className="text-[11px] text-[#737373] truncate">
                  {activeBooking?.vehicleModel || (typeof activeBooking?.vehicleCategory === 'object' ? (activeBooking.vehicleCategory as any)?.name : activeBooking?.vehicleCategory) || 'Jitta Drives Vehicle'}
                </p>
                <span className="text-[9px] sm:text-[10px] text-[#22A06B] font-bold bg-[#22A06B]/10 px-1.5 py-0.5 rounded border border-[#22A06B]/30 truncate inline-block">
                  {activeBooking?.vehicleNumber || 'Plate Pending'}
                </span>
              </div>
            </div>

            {/* Call & Chat Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={() => {
                  previousTripScreenRef.current = customerScreen;
                  setCustomerUnreadChatCount(0);
                  setCustomerScreen('CHAT');
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 bg-black/5 hover:bg-black/10 text-[#525252] rounded-xl sm:rounded-2xl flex items-center justify-center border border-black/10 shadow relative transition active:scale-95"
                aria-label="Chat with Driver"
                title="Chat with Driver"
              >
                <MessageSquare className="w-4 h-4 text-[#22A06B]" />
                {customerUnreadChatCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#EF4444] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg ring-2 ring-white animate-bounce z-20">
                    {customerUnreadChatCount > 9 ? '9+' : customerUnreadChatCount}
                  </span>
                )}
              </button>
              {activeBooking?.driverPhone ? (
                <a
                  href={`tel:${activeBooking.driverPhone}`}
                  className="w-9 h-9 sm:w-10 sm:h-10 bg-[#22A06B] hover:bg-[#1F8F5F] text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-[#22A06B]/30"
                  aria-label="Call Driver"
                >
                  <Phone className="w-4 h-4" />
                </a>
              ) : (
                <button
                  disabled
                  className="w-9 h-9 sm:w-10 sm:h-10 bg-black/5 text-[#A3A3A3] rounded-xl sm:rounded-2xl flex items-center justify-center cursor-not-allowed"
                  aria-label="Phone unavailable"
                >
                  <Phone className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Acting Driver Vehicle Card: Required before service begins */}
          {activeBooking?.rideType === 'DRIVER_ONLY' && (
            <div className="bg-[#FFF7F0] border border-[#E85D04]/30 rounded-2xl p-3 sm:p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-extrabold text-xs text-[#171717]">
                  <Car className="w-4 h-4 text-[#E85D04]" />
                  <span>Your Vehicle (Acting Driver)</span>
                </div>
                {activeBooking.vehicleNumber && ['ASSIGNED', 'EN_ROUTE', 'ARRIVED'].includes(activeBooking.status) && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingPlate(!isEditingPlate);
                      setTripVehiclePlateInput(activeBooking.vehicleNumber || '');
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-[#E85D04] hover:underline"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isEditingPlate ? 'Cancel' : 'Edit Plate'}</span>
                  </button>
                )}
              </div>

              {/* Status Badges */}
              {activeBooking.vehicleNumber ? (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-mono font-black text-sm bg-white px-2.5 py-1 rounded-lg border border-black/10 text-[#171717]">
                    {activeBooking.vehicleNumber}
                  </span>
                  {activeBooking.driverVehicleConfirmed ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Inspected & Confirmed by Driver
                    </span>
                  ) : activeBooking.driverMismatchReported ? (
                    <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-300 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600" /> Driver reported plate mismatch
                    </span>
                  ) : activeBooking.vehicleVerificationStatus === 'VERIFIED' ? (
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                      Officially Verified ✓
                    </span>
                  ) : (
                    <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                      Format Valid ✓ (Official Verif. Unconfigured)
                    </span>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-amber-300 rounded-xl p-2.5 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Vehicle plate required before driver arrives!</span>
                  </div>
                  <p className="text-[10px] text-[#737373]">
                    Please provide your car registration number so your driver can verify the vehicle upon arrival.
                  </p>
                </div>
              )}

              {/* Input field if not provided or customer clicked Edit Plate */}
              {(!activeBooking.vehicleNumber || isEditingPlate) && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. TN 38 AB 1234 or 22 BH 1234 AA"
                      value={tripVehiclePlateInput}
                      onChange={(e) => {
                        setTripVehiclePlateInput(e.target.value.toUpperCase());
                        if (plateSubmitError) setPlateSubmitError(null);
                      }}
                      className="flex-1 bg-white border border-black/15 rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase outline-none focus:border-[#E85D04]"
                    />
                    <button
                      type="button"
                      disabled={isSubmittingPlate || !tripVehiclePlateInput.trim()}
                      onClick={handleSaveTripVehiclePlate}
                      className="bg-[#E85D04] hover:bg-[#C2410C] disabled:opacity-50 text-white font-extrabold px-3 py-2 rounded-xl text-xs transition shrink-0 shadow-xs"
                    >
                      {isSubmittingPlate ? 'Saving…' : 'Save Plate'}
                    </button>
                  </div>
                  {plateSubmitError && (
                    <p className="text-rose-600 text-[10px] font-bold">{plateSubmitError}</p>
                  )}
                  {plateSubmitSuccess && (
                    <p className="text-emerald-700 text-[10px] font-bold">{plateSubmitSuccess}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pre-Trip Cancellation option */}
          {activeBooking && ['ASSIGNED', 'EN_ROUTE', 'ARRIVED'].includes(activeBooking.status) && (
            <div className="pt-2 border-t border-black/5 flex justify-between items-center">
              <span className="text-[11px] text-[#737373]">
                {language === 'ta' ? 'பயணத்தை ரத்து செய்ய வேண்டுமா?' : 'Need to cancel this ride?'}
              </span>
              <button
                onClick={() => cancelActiveBooking('Cancelled by customer before trip start')}
                className="text-xs text-rose-600 hover:text-rose-500 font-bold border border-rose-600/30 px-3 py-1.5 rounded-xl transition hover:bg-rose-50"
              >
                {language === 'ta' ? 'பயணத்தை ரத்து செய்' : 'Cancel Ride'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 22. SOS Safety Screen
  if (customerScreen === 'SOS') {
    return (
      <div className="h-full flex flex-col justify-between bg-[#FFF1F2] text-[#171717] p-6">
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-extrabold flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-6 h-6 text-rose-600 animate-bounce" />
              Emergency Safety Center
            </h2>
            <button
              onClick={() => setCustomerScreen('LIVE_TRIP')}
              className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#737373] border border-rose-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white border border-rose-200 rounded-3xl p-5 text-center space-y-3 mb-6 shadow-2xl">
            <div className="w-16 h-16 bg-rose-600 rounded-full mx-auto flex items-center justify-center ring-4 ring-rose-500/30">
              <Shield className="w-8 h-8 text-white fill-white" />
            </div>
            <h3 className="text-lg font-bold text-[#171717]">Are you in an emergency?</h3>
            <p className="text-xs text-[#737373]">
              Share your live trip status and vehicle location with family, friends, or emergency contacts.
            </p>
          </div>

          <div className="space-y-3">
            <a
              href="tel:112"
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-extrabold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 text-sm"
            >
              <Phone className="w-5 h-5 fill-white" />
              <span>CALL POLICE EMERGENCY (112)</span>
            </a>

            <button
              onClick={() => {
                setShowShareToast(true);
              }}
              className="w-full bg-[#171717] hover:bg-[#292929] text-white font-bold py-3.5 rounded-2xl border border-[#171717] flex items-center justify-center gap-2 text-xs"
            >
              <Share2 className="w-4 h-4 text-[#22A06B]" />
              <span>SHARE LIVE GPS WITH CONTACTS</span>
            </button>
          </div>
        </div>

        {showShareToast && (
          <div className="bg-[#22A06B]/10 border border-[#22A06B]/30 text-[#15803D] p-3 rounded-2xl text-xs text-center font-bold">
            ✓ Live location dispatched to emergency contacts!
          </div>
        )}
      </div>
    );
  }

  // 23. Chat Screen
  if (customerScreen === 'CHAT') {
    const handleCloseChat = () => {
      if (previousTripScreenRef.current && previousTripScreenRef.current !== 'CHAT') {
        setCustomerScreen(previousTripScreenRef.current);
      } else if (activeBooking?.status === 'ARRIVED') {
        setCustomerScreen('DRIVER_ARRIVED');
      } else if (activeBooking?.status === 'IN_PROGRESS') {
        setCustomerScreen('LIVE_TRIP');
      } else {
        setCustomerScreen('DRIVER_EN_ROUTE');
      }
    };

    return (
      <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] justify-between p-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCloseChat}
              className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] hover:text-[#171717] transition active:scale-95 shadow-sm"
              aria-label="Close Chat"
            >
              <X className="w-4 h-4" />
            </button>
            <div>
              <h3 className="text-sm font-bold text-[#171717]">{sanitizeBrandText(activeBooking?.driverName, 'Driver')}</h3>
              <span className="text-[10px] text-[#22A06B] font-semibold">Online • Active Driver</span>
            </div>
          </div>
          {activeBooking?.driverPhone && (
            <a
              href={`tel:${activeBooking.driverPhone}`}
              className="p-2 bg-[#22A06B] hover:bg-[#1B8357] rounded-xl text-white shadow transition active:scale-95"
              aria-label="Call Driver"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#737373]">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-black/5 mb-3 text-[#E85D04]">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold">
                {language === 'ta' ? 'செய்திகள் எதுவும் இல்லை' : 'No messages yet'}
              </p>
              <p className="text-[11px] text-[#A3A3A3] mt-1 max-w-[200px]">
                {language === 'ta'
                  ? 'ஓட்டுநரிடம் ஏதேனும் கேட்க கீழே உள்ள விரைவு செய்தியைப் பயன்படுத்தவும்'
                  : 'Send a quick update or message to your driver'}
              </p>
            </div>
          ) : (
            chatMessages.map((msg: any) => {
              const isVoice = !!msg.audioUrl || (typeof msg.text === 'string' && msg.text.startsWith('[VOICE]:'));
              const voiceUrl = msg.audioUrl || (isVoice ? msg.text.replace('[VOICE]:', '') : '');

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'CUSTOMER' ? 'items-end' : 'items-start'}`}
                >
                  {isVoice && voiceUrl ? (
                    <VoiceMessageBubble
                      audioUrl={voiceUrl}
                      isOwn={msg.sender === 'CUSTOMER'}
                      time={msg.time}
                      senderName={msg.sender === 'CUSTOMER' ? 'You' : (sanitizeBrandText(activeBooking?.driverName, 'Driver'))}
                    />
                  ) : (
                    <div
                      className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs font-medium shadow-sm ${
                        msg.sender === 'CUSTOMER'
                          ? 'bg-[#E85D04] text-white rounded-br-none'
                          : 'bg-white border border-black/5 text-[#262626] rounded-bl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                  )}
                  {!isVoice && <span className="text-[9px] text-[#A3A3A3] mt-1 px-1">{msg.time}</span>}
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Reply Chips & Input */}
        <div className="space-y-2 border-t border-black/5 pt-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {quickReplies.map((qr, i) => (
              <button
                key={i}
                onClick={() => sendChatMessage('CUSTOMER', qr)}
                className="bg-white border border-black/10 text-[#525252] text-[10px] px-2.5 py-1.5 rounded-xl whitespace-nowrap hover:border-[#E85D04] hover:text-[#E85D04] transition active:scale-95 shadow-sm font-medium"
              >
                {qr}
              </button>
            ))}
          </div>

          {isRecordingVoice ? (
            <div className="flex items-center justify-between gap-3 bg-red-50/90 border border-red-200 rounded-2xl p-2 px-3 shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
                <span className="text-xs font-extrabold text-red-600 font-mono">
                  {formatRecordTime(recordingSeconds)}
                </span>
                <span className="text-[11px] text-[#737373] truncate">Recording voice note...</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={cancelVoiceRecording}
                  className="w-8 h-8 rounded-xl bg-white hover:bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shadow-sm transition active:scale-95"
                  title="Cancel Recording"
                  aria-label="Cancel Recording"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={stopAndSendVoice}
                  className="w-9 h-9 rounded-xl bg-[#E85D04] hover:bg-[#C2410C] text-white flex items-center justify-center shadow-md transition active:scale-95"
                  title="Send Voice Note"
                  aria-label="Send Voice Note"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white border border-black/10 rounded-2xl p-2 focus-within:border-[#E85D04] shadow-sm">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={language === 'ta' ? 'ஓட்டுநருக்கு செய்தி எழுதவும்...' : 'Type message to driver...'}
                className="bg-transparent text-xs text-[#171717] outline-none flex-1 px-2 placeholder-[#A3A3A3]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && chatInput.trim()) {
                    sendChatMessage('CUSTOMER', chatInput.trim());
                    setChatInput('');
                  }
                }}
              />
              <button
                type="button"
                onClick={startVoiceRecording}
                className="w-8 h-8 bg-black/5 hover:bg-[#E85D04]/10 text-[#525252] hover:text-[#E85D04] rounded-xl flex items-center justify-center shrink-0 transition active:scale-95"
                title="Record Voice Message"
                aria-label="Record Voice Message"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (chatInput.trim()) {
                    sendChatMessage('CUSTOMER', chatInput.trim());
                    setChatInput('');
                  }
                }}
                className="w-8 h-8 bg-[#E85D04] hover:bg-[#C2410C] text-white rounded-xl flex items-center justify-center shrink-0 shadow transition active:scale-95"
                title="Send Message"
                aria-label="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 24. Share Trip Screen
  if (customerScreen === 'SHARE_TRIP') {
    return (
      <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-6">
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Share Live Trip</h2>
            <button
              onClick={() => setCustomerScreen('LIVE_TRIP')}
              className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#737373] border border-black/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white border border-black/5 rounded-3xl p-4 space-y-3 mb-6 shadow-xl text-xs">
            <div className="flex justify-between border-b border-black/5 pb-2">
              <span className="text-[#737373]">Driver</span>
              <span className="font-bold text-[#171717]">{activeBooking?.driverName || 'Assigned Driver'}</span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-2">
              <span className="text-[#737373]">Vehicle</span>
              <span className="font-bold text-[#171717]">{activeBooking?.vehicleNumber || (typeof activeBooking?.vehicleCategory === 'object' ? (activeBooking.vehicleCategory as any)?.name : activeBooking?.vehicleCategory) || 'Jitta Drives'}</span>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-2">
              <span className="text-[#737373]">Destination</span>
              <span className="font-bold text-[#171717] truncate max-w-[180px]">{activeBooking?.drop.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#737373]">Status</span>
              <span className="font-bold text-[#22A06B]">Live GPS Active</span>
            </div>
          </div>

          <button
            onClick={() => setShowShareToast(true)}
            className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 text-xs"
          >
            <Share2 className="w-4 h-4" />
            <span>COPY LIVE TRACKING LINK</span>
          </button>
        </div>

        {showShareToast && (
          <div className="bg-[#22A06B]/10 border border-[#22A06B]/30 text-[#15803D] p-3 rounded-2xl text-xs text-center font-bold">
            ✓ Tracking link copied: https://jittadrives.com/track/TXI-102938
          </div>
        )}
      </div>
    );
  }

  return null;
};