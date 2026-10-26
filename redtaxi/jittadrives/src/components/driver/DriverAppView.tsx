import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Power,
  Phone,
  Banknote,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  User,
  History,
  LogOut,
  RefreshCw,
  Loader2,
  Locate,
  ShieldCheck,
  IdCard,
  BadgeCheck,
  Clock,
  XCircle,
  Navigation,
  Menu,
  X,
  Bell,
  TrendingUp,
  Wallet,
  PencilRuler,
  Inbox,
  CreditCard,
  AlertCircle,
  Plus,
  Check,
  Sparkles,
  Search,
  Car,
  MessageSquare,
  Send,
  AlertTriangle,
  Bike,
  ArrowRight,
  Upload,
  Camera,
  FileText,
  Image as ImageIcon,
  Mic,
  Trash2,
} from 'lucide-react';
import { useTaxiApp, sanitizeBrandText } from '../../context/TaxiAppContext';
import { InteractiveMap } from '../common/InteractiveMap';
import { DriverDashboardLayout } from './DriverDashboardLayout';
import { VoiceMessageBubble } from '../common/VoiceMessageBubble';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { getVehiclePhoto } from '../../utils/vehicleAssets';
import { fetchVehicleDetails, type VehicleInfo } from '../../services/vehicleInfoService';
import { driverApi, tokenStorage, resolveAppBase } from '../../services/api';
import { detectLiveDynamicLocation } from '../../services/locationService';
import { RapidoDocumentsView } from './RapidoDocumentsView';
import { sendRealFirebaseOtp, verifyRealFirebaseOtp } from '../../services/firebaseAuth';

export const DriverAppView: React.FC = () => {
  const {
    language,
    driverScreen,
    setDriverScreen,
    driverProfile,
    toggleDriverOnline,
    rechargeDriverWallet,
    activeBooking,
    setActiveBooking,
    availableRides,
    driverRideHistory,
    refreshDriverHistory,
    driverCurrentRide,
    setDriverCurrentRide,
    driverWallet,
    driverNotifications,
    refreshDriverNotifications,
    refreshDriverWallet,
    markDriverNotificationRead,
    lastCompletedRide,
    setLastCompletedRide,
    selectedAvailableRide,
    setSelectedAvailableRide,
    acceptRideRequest,
    rejectRideRequest,
    driverArrivedAtPickup,
    startTripWithOtp,
    completeCurrentTrip,
    simulatedProgress,
    setSimulatedProgress,
    loginDriver,
    registerDriver,
    logoutDriver,
    refreshDriverData,
    updateDriverProfile,
    updateDriverVehicle,
    allOffers,
    chatMessages,
    sendChatMessage,
    driverUnreadChatCount,
    setDriverUnreadChatCount,
    showDriverChat,
    setShowDriverChat,
    confirmDriverVehicle,
    reportDriverVehicleMismatch,
  } = useTaxiApp() as any;

  const [driverChatInput, setDriverChatInput] = useState<string>('');
  const [isReportingMismatch, setIsReportingMismatch] = useState<boolean>(false);
  const [mismatchReasonInput, setMismatchReasonInput] = useState<string>('');
  const [driverVehicleActionMsg, setDriverVehicleActionMsg] = useState<string | null>(null);
  const driverChatEndRef = useRef<HTMLDivElement>(null);

  // Driver Voice Message recording states
  const [isRecordingDriverVoice, setIsRecordingDriverVoice] = useState<boolean>(false);
  const [recordingDriverSeconds, setRecordingDriverSeconds] = useState<number>(0);
  const driverMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const driverAudioChunksRef = useRef<Blob[]>([]);
  const driverRecordingTimerRef = useRef<any>(null);
  const driverMediaStreamRef = useRef<MediaStream | null>(null);

  const startDriverVoiceRecording = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        alert('Microphone recording is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      driverMediaStreamRef.current = stream;
      driverAudioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
        else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      driverMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          driverAudioChunksRef.current.push(e.data);
        }
      };

      recorder.start(250);
      setIsRecordingDriverVoice(true);
      setRecordingDriverSeconds(0);

      driverRecordingTimerRef.current = setInterval(() => {
        setRecordingDriverSeconds((s) => s + 1);
      }, 1000);
    } catch {
      alert('Please allow microphone permission to record voice messages.');
    }
  };

  const stopAndSendDriverVoice = () => {
    if (!driverMediaRecorderRef.current || !isRecordingDriverVoice) return;

    const recorder = driverMediaRecorderRef.current;
    recorder.onstop = () => {
      const audioBlob = new Blob(driverAudioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        if (base64Data) {
          sendChatMessage('DRIVER', '🎤 Driver Voice Note', base64Data);
        }
      };
      reader.readAsDataURL(audioBlob);

      driverMediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      driverMediaStreamRef.current = null;
    };

    try {
      recorder.stop();
    } catch {}
    setIsRecordingDriverVoice(false);
    if (driverRecordingTimerRef.current) clearInterval(driverRecordingTimerRef.current);
  };

  const cancelDriverVoiceRecording = () => {
    if (driverMediaRecorderRef.current) {
      driverMediaRecorderRef.current.onstop = null;
      try {
        driverMediaRecorderRef.current.stop();
      } catch {}
    }
    driverMediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    driverMediaStreamRef.current = null;
    driverAudioChunksRef.current = [];
    setIsRecordingDriverVoice(false);
    setRecordingDriverSeconds(0);
    if (driverRecordingTimerRef.current) clearInterval(driverRecordingTimerRef.current);
  };

  useEffect(() => {
    return () => {
      if (driverRecordingTimerRef.current) clearInterval(driverRecordingTimerRef.current);
      driverMediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatDriverRecordTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    if (showDriverChat) {
      setDriverUnreadChatCount(0);
      driverChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showDriverChat, chatMessages, setDriverUnreadChatCount]);

  const [cancellationAlert, setCancellationAlert] = useState<{ title: string; message: string } | null>(null);

  // Active ride cancellation polling: checks authoritative ride status from server every 4 seconds
  useEffect(() => {
    let isMounted = true;
    const inRideScreens = ['RIDE_ACCEPTED', 'ARRIVING', 'ARRIVED', 'START_RIDE'];
    if (!inRideScreens.includes(driverScreen)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await driverApi.getCurrentRide();
        if (!isMounted) return;
        if (res?.success && res.data && res.data.status === 'CANCELLED') {
          const cancelMsg = language === 'ta' ? 'பயணி இந்த பயணத்தை ரத்து செய்துவிட்டார்.' : 'Passenger cancelled this ride.';
          setCancellationAlert({
            title: language === 'ta' ? 'பயணம் ரத்து செய்யப்பட்டது' : 'Ride Cancelled',
            message: cancelMsg,
          });
          setDriverCurrentRide?.(null);
          setActiveBooking?.(null);
          setDriverScreen('DRIVER_HOME');
        } else if (res?.success && res.data && res.data.status === 'COMPLETED') {
          // If server marks trip completed, advance to COMPLETE_RIDE (Cash Collection), NEVER auto-jump to DRIVER_HOME
          setLastCompletedRide?.(res.data);
          setDriverCurrentRide?.(null);
          setDriverScreen('COMPLETE_RIDE');
        }
      } catch {
        // network issue, keep retry
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [driverScreen, language, setDriverCurrentRide, setActiveBooking, setDriverScreen, setLastCompletedRide]);

  // Safety guard: Driver must NEVER remain stuck on ride screens if there is no active ride
  useEffect(() => {
    const inRideScreens = ['RIDE_ACCEPTED', 'ARRIVING', 'ARRIVED', 'START_RIDE'];
    if (inRideScreens.includes(driverScreen)) {
      const hasActiveRide = Boolean(
        (driverCurrentRide?.id && ['ASSIGNED', 'DRIVER_ASSIGNED', 'EN_ROUTE', 'ARRIVING', 'ARRIVED', 'IN_PROGRESS', 'START_RIDE', 'ACCEPTED'].includes(driverCurrentRide.status)) ||
        (activeBooking?.id && ['ASSIGNED', 'DRIVER_ASSIGNED', 'EN_ROUTE', 'ARRIVING', 'ARRIVED', 'IN_PROGRESS', 'START_RIDE', 'ACCEPTED'].includes(activeBooking.status))
      );
      if (!hasActiveRide) {
        setDriverScreen('DRIVER_HOME');
      }
    }
  }, [driverScreen, driverCurrentRide, activeBooking, setDriverScreen]);

  // Safety guard: Unauthenticated drivers must see login screen
  useEffect(() => {
    const hasToken = Boolean(tokenStorage.getDriverToken());
    const authScreens = ['DRIVER_LOGIN', 'DRIVER_REGISTRATION', 'DRIVER_SPLASH'];
    if (!hasToken && !authScreens.includes(driverScreen)) {
      setDriverScreen('DRIVER_LOGIN');
    }
  }, [driverScreen, setDriverScreen]);

  const driverQuickReplies =
    language === 'ta'
      ? [
          'நான் ஏறும் இடத்தை நோக்கி வந்து கொண்டிருக்கிறேன்.',
          'நான் ஏறும் இடத்தை அடைந்துவிட்டேன்.',
          'பயணத்தைத் தொடங்க 4-இலக்க OTP எண்ணைப் பகிரவும்.',
          'தயவுசெய்து ஏறும் இடத்திற்கு வாருங்கள்.',
          'டிராஃபிக் நெரிசல், 2 நிமிடங்களில் வந்துவிடுவேன்.',
          'நான் மெயின் கேட் அருகில் காத்திருக்கிறேன்.',
          'உங்கள் இடத்தை உறுதிப்படுத்த முடியுமா?',
        ]
      : [
          'I am on my way to your pickup location.',
          'I have reached pickup location.',
          'Please share 4-digit OTP to start trip.',
          'Please come to the pickup point.',
          'Stuck in traffic, reaching in 2 minutes.',
          'I am waiting near the main gate.',
          'Can you confirm your landmark / location?',
        ];

  const renderDriverChatModal = () => {
    if (!showDriverChat) return null;
    const customerPhone =
      driverCurrentRide?.customer_phone ||
      activeBooking?.customerPhone ||
      '';
    const rawCustomerName =
      driverCurrentRide?.customer_name ||
      activeBooking?.customerName ||
      '';
    const customerName = rawCustomerName
      ? sanitizeBrandText(rawCustomerName, language === 'ta' ? 'பயணி' : 'Passenger')
      : (language === 'ta' ? 'பயணி' : 'Passenger');

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-lg h-[92vh] sm:h-[650px] bg-[#FAFAF8] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#E5E5E5]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-white border-b border-[#E5E5E5] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setShowDriverChat(false)}
                className="w-9 h-9 bg-[#FAFAF8] hover:bg-[#F0F0EE] border border-[#E5E5E5] rounded-xl flex items-center justify-center text-[#737373] hover:text-[#171717] transition active:scale-95 shrink-0"
                aria-label="Close Chat"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#22A06B] shrink-0 animate-pulse" />
                  <h3 className="text-sm font-extrabold text-[#171717] truncate">{customerName}</h3>
                </div>
                <span className="text-[10px] text-[#737373] font-medium block truncate">
                  {language === 'ta' ? 'நேரடி பயணம் • நேரடி அரட்டை' : 'Active Ride • Direct Chat'}
                </span>
              </div>
            </div>
            {customerPhone && (
              <a
                href={`tel:${customerPhone}`}
                className="w-9 h-9 bg-[#22A06B] hover:bg-[#1B8357] rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm transition active:scale-95"
                aria-label="Call Passenger"
                title="Call Passenger"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAFAF8]">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#737373]">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-black/5 mb-3 text-[#E85D04]">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-[#171717]">
                  {language === 'ta' ? 'செய்திகள் எதுவும் இல்லை' : 'No messages yet'}
                </p>
                <p className="text-[11px] text-[#737373] mt-1 max-w-[220px]">
                  {language === 'ta'
                    ? 'பயணிக்கு விரைவு செய்தியை அனுப்ப கீழே உள்ள பொத்தானைத் தொடவும்'
                    : 'Send a quick update or message to the passenger'}
                </p>
              </div>
            ) : (
              chatMessages.map((msg: any) => {
                const isVoice = !!msg.audioUrl || (typeof msg.text === 'string' && msg.text.startsWith('[VOICE]:'));
                const voiceUrl = msg.audioUrl || (isVoice ? msg.text.replace('[VOICE]:', '') : '');

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'DRIVER' ? 'items-end' : 'items-start'}`}
                  >
                    {isVoice && voiceUrl ? (
                      <VoiceMessageBubble
                        audioUrl={voiceUrl}
                        isOwn={msg.sender === 'DRIVER'}
                        time={msg.time}
                        senderName={msg.sender === 'DRIVER' ? 'You' : 'Passenger'}
                      />
                    ) : (
                      <div
                        className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs font-semibold shadow-sm ${
                          msg.sender === 'DRIVER'
                            ? 'bg-[#E85D04] text-white rounded-br-none'
                            : 'bg-white border border-[#E5E5E5] text-[#171717] rounded-bl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                    )}
                    {!isVoice && <span className="text-[9px] text-[#A3A3A3] mt-1 px-1 font-medium">{msg.time}</span>}
                  </div>
                );
              })
            )}
            <div ref={driverChatEndRef} />
          </div>

          {/* Quick Replies & Manual Input */}
          <div className="bg-white border-t border-[#E5E5E5] p-3 space-y-2 shrink-0">
            {/* Quick Reply Chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {driverQuickReplies.map((qr, i) => (
                <button
                  key={i}
                  onClick={() => sendChatMessage('DRIVER', qr)}
                  className="bg-[#FAFAF8] border border-[#E5E5E5] text-[#404040] hover:text-[#E85D04] hover:border-[#E85D04] text-[11px] font-bold px-3 py-1.5 rounded-xl whitespace-nowrap transition active:scale-95 shadow-sm"
                >
                  {qr}
                </button>
              ))}
            </div>

            {/* Manual Input Bar / Voice Recorder Bar */}
            {isRecordingDriverVoice ? (
              <div className="flex items-center justify-between gap-3 bg-red-50/90 border border-red-200 rounded-2xl p-2 px-3 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
                  <span className="text-xs font-extrabold text-red-600 font-mono">
                    {formatDriverRecordTime(recordingDriverSeconds)}
                  </span>
                  <span className="text-[11px] text-[#737373] truncate">Recording voice note...</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={cancelDriverVoiceRecording}
                    className="w-8 h-8 rounded-xl bg-white hover:bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shadow-sm transition active:scale-95"
                    title="Cancel Recording"
                    aria-label="Cancel Recording"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={stopAndSendDriverVoice}
                    className="w-9 h-9 rounded-xl bg-[#E85D04] hover:bg-[#C2410C] text-white flex items-center justify-center shadow-md transition active:scale-95"
                    title="Send Voice Note"
                    aria-label="Send Voice Note"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-[#FAFAF8] border border-[#E5E5E5] rounded-2xl p-1.5 focus-within:border-[#E85D04] focus-within:bg-white transition shadow-sm">
                <input
                  type="text"
                  value={driverChatInput}
                  onChange={(e) => setDriverChatInput(e.target.value)}
                  placeholder={language === 'ta' ? 'பயணிக்கு செய்தி எழுதவும்...' : 'Type message to passenger...'}
                  className="bg-transparent text-xs text-[#171717] outline-none flex-1 px-2.5 placeholder-[#A3A3A3] font-medium"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && driverChatInput.trim()) {
                      sendChatMessage('DRIVER', driverChatInput.trim());
                      setDriverChatInput('');
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={startDriverVoiceRecording}
                  className="w-8 h-8 bg-black/5 hover:bg-[#E85D04]/10 text-[#525252] hover:text-[#E85D04] rounded-xl flex items-center justify-center shrink-0 transition active:scale-95"
                  title="Record Voice Message"
                  aria-label="Record Voice Message"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (driverChatInput.trim()) {
                      sendChatMessage('DRIVER', driverChatInput.trim());
                      setDriverChatInput('');
                    }
                  }}
                  className="w-8 h-8 bg-[#E85D04] hover:bg-[#C2410C] text-white rounded-xl flex items-center justify-center shrink-0 shadow transition active:scale-95"
                  aria-label="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const [selectedOfferModal, setSelectedOfferModal] = useState<any | null>(null);

  const [otpInput, setOtpInput] = useState<string>('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [arrivedError, setArrivedError] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');
  const [requestTimer, setRequestTimer] = useState<number>(30);
  const [isSimulatingDrive, setIsSimulatingDrive] = useState<boolean>(false);
  const [testToolbarCollapsed, setTestToolbarCollapsed] = useState<boolean>(false);
  const [simStatusMsg, setSimStatusMsg] = useState<string>('');
  const [isEndingTrip, setIsEndingTrip] = useState<boolean>(false);

  useEffect(() => {
    if (driverScreen === 'ARRIVED') {
      setOtpInput('');
      setOtpError('');
    }
  }, [driverScreen]);

  const handleTestReachPickup = async () => {
    const pickupLoc = driverCurrentRide?.locations?.find((l: any) => l.type === 'PICKUP') ||
      (driverCurrentRide?.pickup ? driverCurrentRide.pickup : activeBooking?.pickup);
    const pLat = pickupLoc?.lat ? Number(pickupLoc.lat) : 11.6643;
    const pLng = pickupLoc?.lng ? Number(pickupLoc.lng) : 78.1460;
    
    setSimStatusMsg('📍 Driver reached pickup point (0m away)');
    try {
      await driverApi.updateStatus(true, pLat, pLng);
    } catch {}

    const res = await driverArrivedAtPickup({ lat: pLat, lng: pLng, is_test: true });
    if (res && !res.success) {
      setSimStatusMsg(`⚠️ ${res.message}`);
    } else {
      setTimeout(() => setSimStatusMsg(''), 4000);
    }
  };

  const handleTestAutoFillOtp = async () => {
    const activeStartOtp = driverCurrentRide?.start_otp || activeBooking?.startOtp || '4821';
    setOtpInput(activeStartOtp);
    setOtpError('');
    setSimStatusMsg(`🔑 OTP ${activeStartOtp} auto-filled & verified!`);
    const res = await startTripWithOtp(activeStartOtp, { is_test: true });
    if (!res.success) {
      setOtpError(res.message);
      setSimStatusMsg(`⚠️ ${res.message}`);
    } else {
      setTimeout(() => setSimStatusMsg(''), 4000);
    }
  };

  const handleTestDriveRoute = async () => {
    if (isSimulatingDrive) return;
    setIsSimulatingDrive(true);
    setSimStatusMsg('🚗 Simulating real-time drive (logging GPS breadcrumbs)...');

    const pickupLoc = driverCurrentRide?.locations?.find((l: any) => l.type === 'PICKUP') ||
      (driverCurrentRide?.pickup ? driverCurrentRide.pickup : activeBooking?.pickup);
    const dropLoc = driverCurrentRide?.locations?.find((l: any) => l.type === 'DROP' || l.type === 'DROPOFF') ||
      (driverCurrentRide?.drop ? driverCurrentRide.drop : activeBooking?.drop);

    const startLat = pickupLoc?.lat ? Number(pickupLoc.lat) : 11.6643;
    const startLng = pickupLoc?.lng ? Number(pickupLoc.lng) : 78.1460;
    const endLat = dropLoc?.lat ? Number(dropLoc.lat) : 11.6500;
    const endLng = dropLoc?.lng ? Number(dropLoc.lng) : 78.1600;

    const steps = [15, 35, 55, 75, 90, 100];
    for (let i = 0; i < steps.length; i++) {
      const pct = steps[i];
      const frac = pct / 100.0;
      const curLat = startLat + (endLat - startLat) * frac;
      const curLng = startLng + (endLng - startLng) * frac;

      if (setSimulatedProgress) {
        setSimulatedProgress(pct);
      }
      try {
        await driverApi.updateStatus(true, curLat, curLng, { speed: 42, heading: 90, accuracy: 5 });
      } catch {}

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setIsSimulatingDrive(false);
    setSimStatusMsg('🏁 Arrived at destination! Ready to end trip.');
    setTimeout(() => setSimStatusMsg(''), 4000);
  };

  const handleTestDropOff = async () => {
    const dropLoc = driverCurrentRide?.locations?.find((l: any) => l.type === 'DROP' || l.type === 'DROPOFF') ||
      (driverCurrentRide?.drop ? driverCurrentRide.drop : activeBooking?.drop);
    const dLat = dropLoc?.lat ? Number(dropLoc.lat) : 11.6500;
    const dLng = dropLoc?.lng ? Number(dropLoc.lng) : 78.1600;

    setSimStatusMsg('🏁 Dropping off customer...');
    if (setSimulatedProgress) setSimulatedProgress(100);

    try {
      await driverApi.updateStatus(true, dLat, dLng);
    } catch {}

    const res = await completeCurrentTrip({ lat: dLat, lng: dLng, is_test: true });
    if (res && !res.success) {
      setSimStatusMsg(`⚠️ ${res.message}`);
    } else {
      setTimeout(() => setSimStatusMsg(''), 4000);
    }
  };

  const renderTestingSimulatorToolbar = () => null;
  const [loginPhone, setLoginPhone] = useState<string>('');
  const [loginOtp, setLoginOtp] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [isSendingDriverOtp, setIsSendingDriverOtp] = useState<boolean>(false);
  const [driverOtpSentMsg, setDriverOtpSentMsg] = useState<string>('');
  const [driverCountdown, setDriverCountdown] = useState<number>(0);

  useEffect(() => {
    if (driverCountdown > 0) {
      const timer = setTimeout(() => setDriverCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [driverCountdown]);

  // Registration form & Phone OTP verification state
  const [regCategory, setRegCategory] = useState<'TAXI' | 'TWO_WHEELER' | 'ACTING_DRIVER'>('TAXI');
  const [regForm, setRegForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    vehicleModel: '',
    vehicleNumber: '',
    vehicleType: 'TAXI',
    licenseNumber: '',
    rcNumber: '',
    insuranceNumber: '',
    permitNumber: '',
  });
  const [regPhoneOtp, setRegPhoneOtp] = useState<string>('');
  const [regOtpSent, setRegOtpSent] = useState<boolean>(false);
  const [regPhoneVerified, setRegPhoneVerified] = useState<boolean>(false);
  const [isSendingRegOtp, setIsSendingRegOtp] = useState<boolean>(false);
  const [isVerifyingRegOtp, setIsVerifyingRegOtp] = useState<boolean>(false);
  const [regOtpSentMsg, setRegOtpSentMsg] = useState<string>('');
  const [regOtpError, setRegOtpError] = useState<string>('');
  const [regCountdown, setRegCountdown] = useState<number>(0);
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [regVehicleNumber, setRegVehicleNumber] = useState<string>('');
  const [regVehicleModel, setRegVehicleModel] = useState<string>('');
  const [regDlNumber, setRegDlNumber] = useState<string>('');
  const [regDlPhoto, setRegDlPhoto] = useState<string>('');
  const [regDlPhotoPreview, setRegDlPhotoPreview] = useState<string>('');
  const [regDlFileName, setRegDlFileName] = useState<string>('');

  useEffect(() => {
    if (regCountdown > 0) {
      const timer = setTimeout(() => setRegCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [regCountdown]);

  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [regError, setRegError] = useState<string>('');
  const [regFieldErrors, setRegFieldErrors] = useState<Record<string, string>>({});
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Driver bottom sheet panel collapse/expand & drag state
  const [isHomePanelExpanded, setIsHomePanelExpanded] = useState<boolean>(false);
  const dragStartYRef = useRef<number | null>(null);
  const dragCurrentYRef = useRef<number | null>(null);

  const handlePanelTouchStart = (e: React.TouchEvent) => {
    dragStartYRef.current = e.touches[0].clientY;
  };

  const handlePanelTouchMove = (e: React.TouchEvent) => {
    dragCurrentYRef.current = e.touches[0].clientY;
  };

  const handlePanelTouchEnd = () => {
    if (dragStartYRef.current !== null && dragCurrentYRef.current !== null) {
      const deltaY = dragCurrentYRef.current - dragStartYRef.current;
      if (deltaY > 25) {
        setIsHomePanelExpanded(false);
      } else if (deltaY < -25) {
        setIsHomePanelExpanded(true);
      }
    }
    dragStartYRef.current = null;
    dragCurrentYRef.current = null;
  };

  const handlePanelMouseDown = (e: React.MouseEvent) => {
    dragStartYRef.current = e.clientY;
  };

  const handlePanelMouseMove = (e: React.MouseEvent) => {
    if (dragStartYRef.current !== null) {
      dragCurrentYRef.current = e.clientY;
    }
  };

  const handlePanelMouseUp = () => {
    if (dragStartYRef.current !== null && dragCurrentYRef.current !== null) {
      const deltaY = dragCurrentYRef.current - dragStartYRef.current;
      if (deltaY > 25) {
        setIsHomePanelExpanded(false);
      } else if (deltaY < -25) {
        setIsHomePanelExpanded(true);
      }
    }
    dragStartYRef.current = null;
    dragCurrentYRef.current = null;
  };

  // Auto-expand panel and open incoming ride request alert when a new ride arrives
  useEffect(() => {
    if (availableRides && availableRides.length > 0) {
      setIsHomePanelExpanded(true);
      const inTripScreens = ['RIDE_ACCEPTED', 'ARRIVING', 'ARRIVED', 'START_RIDE'];
      const canShowRequest = driverProfile.isOnline && !driverCurrentRide && !inTripScreens.includes(driverScreen) && driverScreen !== 'RIDE_REQUEST' && driverScreen !== 'DRIVER_LOGIN' && driverScreen !== 'DRIVER_REGISTER';
      if (canShowRequest) {
        setSelectedAvailableRide(availableRides[0]);
        setDriverScreen('RIDE_REQUEST');
      }
    }
  }, [availableRides, driverScreen, driverProfile.isOnline, driverCurrentRide, setSelectedAvailableRide, setDriverScreen]);

  // Driver Live GPS Coordinates & Real Locality
  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number }>({
    lat: 11.6643,
    lng: 78.1460,
  });
  const [driverLocalityName, setDriverLocalityName] = useState<string>('Locating driver...');
  const [isLocatingDriver, setIsLocatingDriver] = useState<boolean>(false);

  const lastReverseGeocodeRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  const updateDriverLivePosition = async (latitude: number, longitude: number) => {
    setDriverCoords({ lat: latitude, lng: longitude });

    // Sync driver GPS coordinates to backend immediately
    const token = tokenStorage.getDriverToken();
    if (token && driverProfile?.isOnline && driverProfile?.approvalStatus === 'APPROVED') {
      driverApi.updateStatus(true, latitude, longitude).catch(() => {});
    }

    // Throttle reverse geocode lookup: only query if moved > 35m or > 45s elapsed
    const last = lastReverseGeocodeRef.current;
    const now = Date.now();
    if (last) {
      const dLat = Math.abs(latitude - last.lat) * 111000;
      const dLng = Math.abs(longitude - last.lng) * 111000 * Math.cos(latitude * Math.PI / 180);
      const distMeters = Math.sqrt(dLat * dLat + dLng * dLng);
      if (distMeters < 35 && (now - last.time) < 45000) {
        return;
      }
    }
    lastReverseGeocodeRef.current = { lat: latitude, lng: longitude, time: now };

    try {
      const resp = await fetch(`${resolveAppBase()}/places/reverse?lat=${latitude}&lng=${longitude}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.name) {
          setDriverLocalityName(data.name);
        } else if (data && data.display_name) {
          const parts = data.display_name.split(',');
          setDriverLocalityName(parts.slice(0, 2).join(',').trim());
        }
      }
    } catch {
      // keep previous
    }
  };

  const handleRefreshDriverLocation = async () => {
    setIsLocatingDriver(true);
    try {
      const loc = await detectLiveDynamicLocation();
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        setDriverCoords({ lat: loc.lat, lng: loc.lng });
        if (loc.name) {
          setDriverLocalityName(loc.name);
        }
        const token = tokenStorage.getDriverToken();
        if (token && driverProfile?.isOnline && driverProfile?.approvalStatus === 'APPROVED') {
          await driverApi.updateStatus(true, loc.lat, loc.lng);
        }
      }
    } catch (err) {
      console.warn('[JittaDriverGPS] Error detecting location:', err);
    } finally {
      setIsLocatingDriver(false);
    }
  };

  useEffect(() => {
    handleRefreshDriverLocation();
    let watchId: number | null = null;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          // Filter out coarse cellular / ISP hops (>1500m)
          if (typeof accuracy === 'number' && accuracy > 1500) {
            console.log(`[JittaDriverGPS] Ignoring coarse position update (accuracy ${accuracy}m)`);
            return;
          }
          updateDriverLivePosition(latitude, longitude);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Web Audio alert chime for incoming rides
  const playRideAlertChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  useEffect(() => {
    if (driverScreen === 'RIDE_REQUEST') {
      playRideAlertChime();
    }
  }, [driverScreen]);



  // Vehicle Info API & RC Lookup State
  const [isFetchingVehicle, setIsFetchingVehicle] = useState<boolean>(false);
  const [fetchedVehicle, setFetchedVehicle] = useState<VehicleInfo | null>(null);
  const [vehicleFetchError, setVehicleFetchError] = useState<string>('');

  const handleFetchDriverVehicleDetails = async (plateInput?: string) => {
    const plate = plateInput || regForm.vehicleNumber;
    if (!plate || plate.trim().length < 4) {
      setVehicleFetchError(language === 'ta' ? 'சரியான வாகன எண்ணை உள்ளிடவும் (எ.கா. TN 40 AB 1234)' : 'Please enter a vehicle number (e.g. TN 40 AB 1234)');
      return;
    }
    setIsFetchingVehicle(true);
    setVehicleFetchError('');
    try {
      const details = await fetchVehicleDetails(plate);
      setFetchedVehicle(details);
      setRegForm((prev) => ({
        ...prev,
        vehicleNumber: details.vehicleNumber,
        vehicleModel: `${details.maker} ${details.model}`,
        vehicleType: details.vehicleType,
        rcNumber: details.vehicleNumber,
        insuranceNumber: `INS-${details.vehicleNumber.slice(-5)}`,
        permitNumber: `PERMIT-${details.vehicleNumber.slice(-4)}`,
      }));
    } catch (err: any) {
      setVehicleFetchError(err.message || 'Failed to fetch vehicle info');
    } finally {
      setIsFetchingVehicle(false);
    }
  };

  // Profile & vehicle edit state
  const [editingProfile, setEditingProfile] = useState<boolean>(false);
  const [editPhoto, setEditPhoto] = useState<string | undefined>(undefined);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileMsg, setProfileMsg] = useState<string>('');
  const [profileMsgError, setProfileMsgError] = useState<boolean>(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    vehicleModel: '',
    vehicleNumber: '',
    vehicleType: 'Sedan',
  });

  // Driver Prepaid Wallet Recharge State
  const [showRechargeModal, setShowRechargeModal] = useState<boolean>(false);
  const [rechargeAmount, setRechargeAmount] = useState<number>(100);
  const [customRechargeInput, setCustomRechargeInput] = useState<string>('');
  const [rechargeMethod, setRechargeMethod] = useState<'UPI' | 'CARD' | 'NETBANKING'>('UPI');
  const [isProcessingRecharge, setIsProcessingRecharge] = useState<boolean>(false);
  const [rechargeFeedback, setRechargeFeedback] = useState<{
    status?: 'SUCCESS' | 'FAILED';
    message?: string;
    referenceId?: string;
    amount?: number;
    newBalance?: number;
  } | null>(null);
  const [showLowBalanceModal, setShowLowBalanceModal] = useState<boolean>(false);
  const [simulateFail, setSimulateFail] = useState<boolean>(false);

  // Uber-style left menu drawer (home screen only)
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const handleExecuteRecharge = async () => {
    const finalAmount = customRechargeInput ? parseFloat(customRechargeInput) : rechargeAmount;
    if (isNaN(finalAmount) || finalAmount <= 0) return;

    setIsProcessingRecharge(true);
    setRechargeFeedback(null);

    const statusToSubmit = simulateFail ? 'FAILED' : 'SUCCESS';
    const res = await rechargeDriverWallet(finalAmount, rechargeMethod, statusToSubmit);

    setIsProcessingRecharge(false);
    if (res && res.success && res.data) {
      setRechargeFeedback({
        status: 'SUCCESS',
        message: res.message,
        referenceId: res.data.referenceId,
        amount: res.data.amount,
        newBalance: res.data.newBalance,
      });
      setCustomRechargeInput('');
    } else {
      setRechargeFeedback({
        status: 'FAILED',
        message: res?.message || 'Payment gateway failed or transaction was declined.',
        referenceId: res?.data?.referenceId || 'ERR_' + Date.now().toString().slice(-8),
        amount: finalAmount,
      });
    }
  };

  const handleToggleOnlineWithGuard = async () => {
    const currentBalance = Number(driverWallet?.balance ?? driverProfile.walletBalance ?? 0);
    if (!driverProfile.isOnline && currentBalance < 50) {
      setShowLowBalanceModal(true);
      return;
    }
    const res = await toggleDriverOnline();
    if (res && !res.success && res.reason === 'LOW_WALLET_BALANCE') {
      setShowLowBalanceModal(true);
    }
  };

  const [isAcceptingRide, setIsAcceptingRide] = useState<boolean>(false);

  const handleAcceptRide = async (rideId?: string) => {
    if (isAcceptingRide) return;
    const currentBalance = Number(driverWallet?.balance ?? driverProfile.walletBalance ?? 0);
    if (currentBalance < 50) {
      setShowLowBalanceModal(true);
      return;
    }
    setIsAcceptingRide(true);
    try {
      const res: any = await acceptRideRequest(rideId);
      if (res && !res.success && res.reason === 'LOW_WALLET_BALANCE') {
        setShowLowBalanceModal(true);
      }
    } finally {
      setIsAcceptingRide(false);
    }
  };

  // Rapido-style urgent ride alert sound using Web Audio API
  const playRapidoRideAlertChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';

      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1174, now + 0.12);
      osc.frequency.setValueAtTime(880, now + 0.24);
      osc.frequency.setValueAtTime(1318, now + 0.36);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.55);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }
    } catch {}
  }, []);

  // Timer countdown and loud Rapido alert chime for incoming ride request
  useEffect(() => {
    if (driverScreen === 'RIDE_REQUEST') {
      const activeRide = selectedAvailableRide || (availableRides && availableRides.length > 0 ? availableRides[0] : null);
      const initialTimeout = (activeRide && typeof activeRide.request_timeout_seconds === 'number' && activeRide.request_timeout_seconds > 0)
        ? Math.min(30, Math.max(5, activeRide.request_timeout_seconds))
        : 15;
      setRequestTimer(initialTimeout);

      // Immediate chime on alert
      playRapidoRideAlertChime();

      // Repeating sound every 2 seconds
      const chimeInterval = setInterval(() => {
        playRapidoRideAlertChime();
      }, 2000);

      const timer = setInterval(() => {
        setRequestTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(timer);
        clearInterval(chimeInterval);
      };
    } else {
      setRequestTimer(15);
    }
  }, [driverScreen, playRapidoRideAlertChime, selectedAvailableRide?.id]);

  useEffect(() => {
    if (driverScreen === 'RIDE_REQUEST' && requestTimer === 0 && !isAcceptingRide) {
      const activeId = selectedAvailableRide?.id || (availableRides.length > 0 ? availableRides[0]?.id : undefined);
      rejectRideRequest(activeId);
    }
  }, [driverScreen, requestTimer, rejectRideRequest, selectedAvailableRide, availableRides, isAcceptingRide]);

  // Notice banner when a customer cancels the ride request
  const [rideCancelledNotice, setRideCancelledNotice] = useState<string>('');

  // Auto-dismiss Ride Request popup if the ride is no longer available or was cancelled
  useEffect(() => {
    if (driverScreen !== 'RIDE_REQUEST') return;

    const currentRideId = selectedAvailableRide?.id || (availableRides && availableRides.length > 0 ? availableRides[0]?.id : null);
    if (!currentRideId) {
      setDriverScreen('DRIVER_HOME');
      return;
    }

    const isStillAvailable = availableRides.some((r: any) => String(r.id) === String(currentRideId));
    if (!isStillAvailable) {
      setSelectedAvailableRide(null);
      setDriverScreen('DRIVER_HOME');
    }
  }, [driverScreen, selectedAvailableRide?.id, availableRides, setDriverScreen, setSelectedAvailableRide]);

  const handleSendDriverOtp = async () => {
    setLoginError('');
    setDriverOtpSentMsg('');
    const cleanPhone = loginPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) {
      setLoginError('Please enter a valid 10-digit mobile number');
      return;
    }
    setIsSendingDriverOtp(true);
    const res = await sendRealFirebaseOtp(cleanPhone, 'driver-recaptcha-container');
    setIsSendingDriverOtp(false);
    if (res.success) {
      setDriverCountdown(30);
      setDriverOtpSentMsg(res.message);
      setLoginOtp('');
    } else {
      setLoginError(res.message);
    }
  };

  const handleDriverLogin = async () => {
    setIsLoggingIn(true);
    setLoginError('');
    const cleanPhone = loginPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setLoginError('Please enter a valid 10-digit mobile number');
      setIsLoggingIn(false);
      return;
    }
    const cleanOtp = (loginOtp || '').trim();
    if (!cleanOtp) {
      setLoginError('Please enter the OTP verification code');
      setIsLoggingIn(false);
      return;
    }

    let isFirebaseVerified = false;
    const isDemo = cleanOtp === '123456' || cleanOtp === '1234' || cleanOtp === '4821';
    if (!isDemo) {
      try {
        await verifyRealFirebaseOtp(cleanOtp);
        isFirebaseVerified = true;
      } catch (err: any) {
        setLoginError(err?.message || 'Invalid SMS OTP code. Please check your SMS and try again.');
        setIsLoggingIn(false);
        return;
      }
    }

    const res = await loginDriver(
      cleanPhone,
      undefined,
      cleanOtp,
      isFirebaseVerified
    );
    setIsLoggingIn(false);

    if (res.success) {
      const approval = res.driver?.approval_status || res.driver?.approvalStatus || driverProfile.approvalStatus;
      if (approval === 'PENDING') {
        setDriverScreen('DOCUMENTS_UPLOAD');
      } else if (approval === 'REJECTED' || approval === 'SUSPENDED' || approval === 'BLOCKED') {
        setDriverScreen('DOCUMENTS_UPLOAD');
      } else {
        setDriverScreen('DRIVER_HOME');
      }
    } else {
      setLoginError(res.message || 'Driver partner login failed. Check mobile number or OTP.');
    }
  };

  const handleSendRegOtp = async () => {
    setRegOtpError('');
    setRegOtpSentMsg('');
    const cleanPhone = regForm.phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setRegOtpError('Please enter a valid 10-digit mobile number first');
      return;
    }
    setIsSendingRegOtp(true);
    try {
      const res = await sendRealFirebaseOtp(cleanPhone, 'reg-driver-recaptcha-container');
      if (res.success) {
        setRegOtpSent(true);
        setRegPhoneOtp('');
        setRegCountdown(30);
        setRegOtpSentMsg(res.message || `SMS OTP sent to +91 ${cleanPhone}`);
      } else {
        setRegOtpError(res.message || 'Failed to send OTP to mobile. Please check number.');
      }
    } catch (err: any) {
      setRegOtpError(err?.message || 'Failed to send OTP to mobile.');
    } finally {
      setIsSendingRegOtp(false);
    }
  };

  const handleVerifyRegOtp = async (codeOverride?: string) => {
    setRegOtpError('');
    const code = (codeOverride || regPhoneOtp || '').trim();
    if (!code) {
      setRegOtpError('Please enter the verification code');
      return;
    }
    setIsVerifyingRegOtp(true);
    try {
      const res = await verifyRealFirebaseOtp(code);
      if (res.success) {
        setRegPhoneVerified(true);
        setRegOtpSent(false);
        setRegOtpSentMsg('✓ Mobile number verified successfully!');
      } else {
        setRegOtpError(res.message || 'Invalid verification code. Please check SMS.');
      }
    } catch (err: any) {
      setRegOtpError(err?.message || 'Invalid verification code.');
    } finally {
      setIsVerifyingRegOtp(false);
    }
  };

  const handleRegPhoneChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 10);
    setRegForm((s) => ({ ...s, phone: clean }));
    if (regPhoneVerified) {
      setRegPhoneVerified(false);
      setRegOtpSent(false);
      setRegPhoneOtp('');
      setRegOtpSentMsg('');
      setRegOtpError('');
    }
  };

  const handleProceedToStep2 = () => {
    setRegFieldErrors({});
    setRegError('');
    const errs: Record<string, string> = {};
    if (!regForm.name.trim()) errs.name = 'Full name is required';
    const cleanPhone = regForm.phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      errs.phone = 'Enter a valid 10-digit mobile number';
    } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phone = 'Mobile number must start with 6, 7, 8, or 9 (Indian format)';
    }
    if (regForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regForm.email)) errs.email = 'Enter a valid email address';
    if (regForm.password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (regForm.password !== regForm.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (Object.keys(errs).length > 0) {
      setRegFieldErrors(errs);
      setRegError('Please fix the highlighted fields');
      return;
    }

    if (!regPhoneVerified) {
      setRegError('Please verify your mobile number with OTP before continuing');
      return;
    }

    // Advance to Step 2 (Vehicle & License details)
    setRegStep(2);
  };

  const handleDlPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setRegError('Please upload an image file (JPG, PNG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setRegError('Image size exceeds 5MB limit. Please choose a smaller photo.');
      return;
    }

    setRegDlFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setRegDlPhoto(base64);
      setRegDlPhotoPreview(base64);
      setRegFieldErrors((prev) => {
        const next = { ...prev };
        delete next.licensePhoto;
        return next;
      });
      setRegError('');
    };
    reader.readAsDataURL(file);
  };

  const handleFinalDriverRegister = async () => {
    setRegFieldErrors({});
    setRegError('');
    const errs: Record<string, string> = {};

    const cleanPhone = regForm.phone.replace(/\D/g, '').slice(-10);

    // Validate Vehicle Details if not ACTING_DRIVER
    if (regCategory !== 'ACTING_DRIVER') {
      const cleanPlate = regVehicleNumber.trim().toUpperCase().replace(/[\s-]/g, '');
      if (!cleanPlate) {
        errs.vehicleNumber = 'Vehicle registration plate number is required';
      } else if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/i.test(cleanPlate)) {
        errs.vehicleNumber = 'Enter a valid Indian vehicle number (e.g. TN 38 AB 1234)';
      }

      if (!regVehicleModel.trim()) {
        errs.vehicleModel = 'Vehicle model is required (e.g. Dzire, Activa)';
      }
    }

    // Validate DL Number (Required for all drivers)
    const cleanDl = (regDlNumber || regForm.licenseNumber || '').trim().toUpperCase();
    if (!cleanDl) {
      errs.licenseNumber = 'Driving licence number is required';
    } else if (cleanDl.length < 6) {
      errs.licenseNumber = 'Driving licence number must be at least 6 characters';
    }

    // Validate DL Photo
    if (!regDlPhoto) {
      errs.licensePhoto = 'Please upload a photo of your Driving Licence';
    }

    if (Object.keys(errs).length > 0) {
      setRegFieldErrors(errs);
      setRegError('Please complete all required vehicle & licence fields');
      return;
    }

    setIsRegistering(true);
    const chosenModel = regCategory === 'ACTING_DRIVER'
      ? 'Customer Vehicle'
      : (regVehicleModel.trim() || (regCategory === 'TWO_WHEELER' ? 'Hero / Honda Two-Wheeler' : 'Taxi Sedan/Cab'));
    const chosenPlate = regCategory === 'ACTING_DRIVER'
      ? ''
      : regVehicleNumber.trim().toUpperCase();

    const res = await registerDriver({
      name: regForm.name.trim(),
      phone: cleanPhone,
      email: regForm.email.trim(),
      password: regForm.password,
      confirm_password: regForm.confirmPassword,
      vehicle_model: chosenModel,
      vehicle_number: chosenPlate,
      vehicle_type: regCategory,
      driver_type: regCategory,
      license_number: cleanDl,
      license_photo: regDlPhoto,
      rc_number: chosenPlate,
      insurance_number: '',
      permit_number: '',
    });
    setIsRegistering(false);

    if (res.success) {
      const approval = res.driver?.approvalStatus || res.driver?.approval_status;
      if (approval === 'APPROVED') {
        setDriverScreen('DRIVER_HOME');
      } else {
        setDriverScreen('DRIVER_APPROVAL');
      }
    } else {
      setRegError(res.message || 'Registration failed. Please try again.');
    }
  };

// 41. Driver Splash (Deep Orange Premium Theme)
  if (driverScreen === 'DRIVER_SPLASH') {
    return (
      <div className="h-full flex flex-col justify-between bg-gradient-to-b from-[#E85D04] to-[#C2410C] text-white p-6 sm:p-8 relative overflow-hidden">
        {/* Decorative soft circles */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10" />
        <div className="absolute top-1/2 -left-20 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-24 right-0 w-72 h-72 rounded-full bg-black/10" />

        <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-[2.5rem] shadow-2xl p-5 sm:p-6 mb-6"
          >
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Jitta Captain"
              className="w-28 h-28 sm:w-32 sm:h-32"
            />
          </motion.div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Jitta Captain</h1>
          <p className="text-sm text-orange-100 mt-1 font-semibold">Driver Partner App</p>

          {/* Loading indicator */}
          <div className="flex items-center gap-2 mt-6 rounded-full bg-white/15 backdrop-blur px-4 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-semibold text-orange-50">Preparing your ride requests…</span>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <button
            onClick={() => setDriverScreen('DRIVER_LOGIN')}
            className="w-full bg-white text-[#C2410C] font-black py-4 rounded-full flex items-center justify-center gap-2 transition hover:bg-orange-50 shadow-xl active:scale-[0.98]"
          >
            <span>Get Started</span>
            <ChevronRight className="w-5 h-5" />
          </button>
          <p className="text-center text-[11px] text-orange-100 font-semibold">Made in India 🇮🇳</p>
        </div>
      </div>
    );
  }

// 42. Driver Login (Professional White/Orange)
// 42. Driver Login (Mobile Number + OTP Only — Professional White/Orange Theme)
  if (driverScreen === 'DRIVER_LOGIN') {
    return (
      <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-5 sm:p-7 overflow-y-auto">
        <div>
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => setDriverScreen('DRIVER_SPLASH')}
              className="w-10 h-10 bg-white rounded-full border border-[#E5E5E5] shadow-xs flex items-center justify-center text-[#171717] hover:bg-[#FAFAF8] transition"
              aria-label="Back to Splash"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#E85D04] animate-pulse" />
              <span className="text-[11px] font-bold text-[#737373]">Jitta Captain Portal</span>
            </div>
          </div>

          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF7F0] border border-[#E85D04]/20 text-[#E85D04] text-xs font-black mb-3">
              <Phone className="w-3.5 h-3.5" />
              OTP Instant Verification
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#171717] tracking-tight">Jitta Captain Login</h1>
            <p className="text-xs text-[#737373] mt-1 font-medium">Enter your registered 10-digit mobile number and OTP to get on the road</p>
          </div>

          {driverOtpSentMsg && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{driverOtpSentMsg}</span>
            </div>
          )}

          {loginError && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{loginError}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Mobile Number Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-[#737373] uppercase">Registered Mobile Number</label>
                {driverCountdown > 0 ? (
                  <span className="text-[10px] text-[#A3A3A3] font-bold">Resend SMS in {driverCountdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendDriverOtp}
                    disabled={isSendingDriverOtp || loginPhone.length < 10}
                    className="text-[11px] font-black text-[#E85D04] hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    {isSendingDriverOtp ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Sending SMS...</span>
                      </>
                    ) : (
                      <span>Send OTP &rarr;</span>
                    )}
                  </button>
                )}
              </div>
              <div className="bg-white border-2 border-[#E5E5E5] focus-within:border-[#E85D04] rounded-2xl px-4 py-3 flex items-center gap-3 transition shadow-xs">
                <span className="text-xs font-black text-[#E85D04] bg-[#FFF7F0] px-2 py-1 rounded-lg border border-[#E85D04]/20">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 10-digit mobile number"
                  className="bg-transparent text-[#171717] text-sm font-bold outline-none flex-1 placeholder:text-[#A3A3A3] placeholder:font-normal"
                />
              </div>
            </div>

            {/* Invisible reCAPTCHA container for driver */}
            <div id="driver-recaptcha-container"></div>

            {/* OTP Code Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-[#737373] uppercase">Enter OTP Code</label>
              </div>
              <div className="bg-white border-2 border-[#E5E5E5] focus-within:border-[#E85D04] rounded-2xl px-4 py-3 flex items-center gap-3 transition shadow-xs">
                <ShieldCheck className="w-5 h-5 text-[#E85D04] shrink-0" />
                <input
                  type="text"
                  maxLength={6}
                  value={loginOtp}
                  onChange={(e) => setLoginOtp(e.target.value.trim())}
                  placeholder="Enter 6-digit OTP code"
                  className="bg-transparent text-[#171717] text-base font-black tracking-widest outline-none flex-1 placeholder:text-[#A3A3A3] placeholder:font-normal placeholder:tracking-normal placeholder:text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 space-y-3">
          <button
            onClick={handleDriverLogin}
            disabled={isLoggingIn || !loginPhone.trim() || !loginOtp.trim()}
            className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-black py-4 rounded-2xl disabled:opacity-40 transition shadow-lg shadow-[#E85D04]/25 flex items-center justify-center gap-2 text-sm active:scale-98"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying OTP & Logging In…</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Verify OTP & Start Driving</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              setDriverScreen('DRIVER_REGISTRATION');
              setRegStep(1);
            }}
            className="w-full text-center text-xs font-bold text-[#E85D04] py-2 hover:underline"
          >
            New Driver Partner? Register with Jitta Captain →
          </button>
        </div>
      </div>
    );
  }

// 43. Driver Registration Form
  if (driverScreen === 'DRIVER_REGISTRATION') {
    // -------------------------------------------------------------
    // STEP 2: Vehicle Registration & Driving License Details
    // -------------------------------------------------------------
    if (regStep === 2) {
      return (
        <div className="h-full flex flex-col bg-white text-gray-900 p-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <button
              onClick={() => { setRegStep(1); setRegError(''); }}
              className="w-9 h-9 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition"
              title="Back to Personal Details"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <h2 className="text-base font-bold">Vehicle & License Details</h2>
              <span className="text-[10px] bg-orange-100 text-[#E85D04] font-bold px-2 py-0.5 rounded-full">
                Step 2 of 2
              </span>
            </div>
            <div className="w-9" />
          </div>

          {/* Stepper Progress Indicator */}
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <button
              type="button"
              onClick={() => { setRegStep(1); setRegError(''); }}
              className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl p-2 flex items-center gap-2 text-left"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                <Check className="w-3 h-3" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[10px] text-emerald-800 font-bold truncate">Step 1: Personal</p>
                <p className="text-[9px] text-emerald-600 truncate">{regForm.name || 'Verified'}</p>
              </div>
            </button>

            <div className="flex-1 bg-orange-50 border border-[#E85D04] rounded-xl p-2 flex items-center gap-2 text-left shadow-xs">
              <div className="w-5 h-5 rounded-full bg-[#E85D04] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                2
              </div>
              <div className="overflow-hidden">
                <p className="text-[10px] text-[#E85D04] font-bold truncate">Step 2: Vehicle & DL</p>
                <p className="text-[9px] text-gray-500 truncate">Verification</p>
              </div>
            </div>
          </div>

          {regError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold text-center shrink-0">
              {regError}
            </div>
          )}

          <div className="space-y-4 mb-6">
            {/* Selected Category Pill */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-100 text-[#E85D04]">
                  {regCategory === 'TWO_WHEELER' ? <Bike className="w-4 h-4" /> : regCategory === 'ACTING_DRIVER' ? <User className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-xs font-bold">
                    {regCategory === 'TWO_WHEELER' ? 'Two-Wheeler Partner' : regCategory === 'ACTING_DRIVER' ? 'Active Driver (Customer Vehicle)' : 'Taxi Cab Partner'}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {regCategory === 'ACTING_DRIVER' ? 'Drives customer-owned car' : 'Registered Partner Fleet'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRegStep(1)}
                className="text-[11px] font-bold text-[#E85D04] hover:underline"
              >
                Change
              </button>
            </div>

            {/* VEHICLE DETAILS (For TAXI & TWO_WHEELER) */}
            {regCategory !== 'ACTING_DRIVER' ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-orange-500 flex items-center gap-1.5">
                    {regCategory === 'TWO_WHEELER' ? <Bike className="w-3.5 h-3.5" /> : <Car className="w-3.5 h-3.5" />}
                    Vehicle Registration Details
                  </p>
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Required</span>
                </div>

                {/* Registration Plate Number */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-gray-500 font-bold">Vehicle Registration Number *</label>
                    <span className="text-[9px] text-gray-400 font-mono">e.g. TN 38 AB 1234</span>
                  </div>
                  <div className={`bg-white border ${regFieldErrors['vehicleNumber'] ? 'border-red-400/60' : 'border-gray-300'} rounded-xl p-3 flex items-center gap-2`}>
                    <input
                      type="text"
                      value={regVehicleNumber}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setRegVehicleNumber(val);
                        if (regFieldErrors['vehicleNumber']) {
                          setRegFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.vehicleNumber;
                            return next;
                          });
                        }
                      }}
                      placeholder="e.g. TN 38 AB 1234"
                      className="bg-gray-50 text-gray-900 text-xs font-mono font-bold outline-none flex-1 uppercase tracking-wider"
                    />
                  </div>
                  {regFieldErrors['vehicleNumber'] ? (
                    <p className="text-red-500 text-[10px] mt-1">{regFieldErrors['vehicleNumber']}</p>
                  ) : (
                    <p className="text-gray-400 text-[10px] mt-1">
                      Format: State (TN) + District (38) + Series (AB) + 4 Digits (1234)
                    </p>
                  )}
                </div>

                {/* Vehicle Model Input + Quick Chips */}
                <div>
                  <label className="text-[10px] text-gray-500 font-bold block mb-1">Vehicle Model & Make *</label>
                  <div className={`bg-white border ${regFieldErrors['vehicleModel'] ? 'border-red-400/60' : 'border-gray-300'} rounded-xl p-3 flex items-center gap-2`}>
                    <input
                      type="text"
                      value={regVehicleModel}
                      onChange={(e) => {
                        setRegVehicleModel(e.target.value);
                        if (regFieldErrors['vehicleModel']) {
                          setRegFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.vehicleModel;
                            return next;
                          });
                        }
                      }}
                      placeholder={regCategory === 'TWO_WHEELER' ? 'e.g. Honda Activa 6G, Hero Splendor...' : 'e.g. Maruti Dzire, Swift, Etios...'}
                      className="bg-gray-50 text-gray-900 text-xs font-bold outline-none flex-1"
                    />
                  </div>
                  {regFieldErrors['vehicleModel'] && (
                    <p className="text-red-500 text-[10px] mt-1">{regFieldErrors['vehicleModel']}</p>
                  )}

                  {/* Popular quick-select chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(regCategory === 'TWO_WHEELER'
                      ? ['Honda Activa', 'Hero Splendor', 'TVS Jupiter', 'Bajaj Pulsar', 'Honda Shine', 'Access 125']
                      : ['Maruti Dzire', 'Toyota Etios', 'Hyundai Aura', 'Swift', 'WagonR', 'Innova Crysta', 'Ertiga']
                    ).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setRegVehicleModel(m);
                          setRegFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.vehicleModel;
                            return next;
                          });
                        }}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                          regVehicleModel === m
                            ? 'bg-[#FFF7F0] border-[#E85D04] text-[#E85D04]'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        + {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-orange-50/60 border border-orange-200/60 text-orange-950 text-[10px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#E85D04] shrink-0" />
                  <span>Free RTO format verification enabled. VAHAN FC/Insurance verification API integration ready.</span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Customer Vehicle Mode Active</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  As an Active / Acting Driver, you drive customers in their personal vehicles. No vehicle plate number or vehicle model is required.
                </p>
              </div>
            )}

            {/* DRIVING LICENSE DETAILS (REQUIRED FOR ALL) */}
            <div className="bg-white border border-gray-200 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-orange-500 flex items-center gap-1.5">
                  <IdCard className="w-3.5 h-3.5" />
                  Driving Licence (DL) Verification
                </p>
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Mandatory</span>
              </div>

              {/* DL Number */}
              <div>
                <label className="text-[10px] text-gray-500 font-bold block mb-1">Driving Licence Number *</label>
                <div className={`bg-white border ${regFieldErrors['licenseNumber'] ? 'border-red-400/60' : 'border-gray-300'} rounded-xl p-3 flex items-center gap-2`}>
                  <input
                    type="text"
                    value={regDlNumber || regForm.licenseNumber}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setRegDlNumber(val);
                      setRegForm((s) => ({ ...s, licenseNumber: val }));
                      if (regFieldErrors['licenseNumber']) {
                        setRegFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.licenseNumber;
                          return next;
                        });
                      }
                    }}
                    placeholder="e.g. TN3820200012345"
                    className="bg-gray-50 text-gray-900 text-xs font-mono font-bold outline-none flex-1 uppercase tracking-wider"
                  />
                </div>
                {regFieldErrors['licenseNumber'] ? (
                  <p className="text-red-500 text-[10px] mt-1">{regFieldErrors['licenseNumber']}</p>
                ) : (
                  <p className="text-gray-400 text-[10px] mt-1">Enter 15-16 character Indian Driving Licence number</p>
                )}
              </div>

              {/* DL Photo Upload */}
              <div>
                <label className="text-[10px] text-gray-500 font-bold block mb-1">
                  Driving Licence Photo (Front) *
                </label>

                <input
                  id="driver-dl-photo-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  capture="environment"
                  onChange={handleDlPhotoUpload}
                  className="hidden"
                />

                {regDlPhotoPreview ? (
                  <div className="border border-emerald-300 bg-emerald-50/30 rounded-2xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        DL Photo Attached
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRegDlPhoto('');
                          setRegDlPhotoPreview('');
                          setRegDlFileName('');
                        }}
                        className="text-[10px] font-bold text-red-600 hover:underline flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Remove
                      </button>
                    </div>

                    <div className="relative rounded-xl overflow-hidden border border-emerald-200 bg-black/5 aspect-video max-h-48 flex items-center justify-center">
                      <img
                        src={regDlPhotoPreview}
                        alt="Driving Licence Preview"
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span className="truncate max-w-[200px]">{regDlFileName || 'dl_photo.jpg'}</span>
                      <label
                        htmlFor="driver-dl-photo-input"
                        className="font-bold text-[#E85D04] cursor-pointer hover:underline"
                      >
                        Retake / Replace Photo →
                      </label>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="driver-dl-photo-input"
                      className={`border-2 border-dashed ${regFieldErrors['licensePhoto'] ? 'border-red-400 bg-red-50/30' : 'border-gray-300 hover:border-[#E85D04] bg-gray-50/60'} rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center`}
                    >
                      <div className="w-10 h-10 rounded-full bg-orange-100 text-[#E85D04] flex items-center justify-center">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-800">Tap to capture or upload DL photo</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Supports Camera, JPG, PNG, WEBP (Max 5MB)</p>
                      </div>
                    </label>
                    {regFieldErrors['licensePhoto'] && (
                      <p className="text-red-500 text-[10px] mt-1">{regFieldErrors['licensePhoto']}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 mt-auto shrink-0">
            <button
              type="button"
              onClick={handleFinalDriverRegister}
              disabled={isRegistering}
              className="w-full bg-[#E85D04] hover:bg-[#C2410C] disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl shadow-lg transition flex items-center justify-center gap-2 active:scale-95"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registering Partner...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit & Complete Registration</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setRegStep(1); setRegError(''); }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition"
            >
              ← Back to Personal Details
            </button>
          </div>
          <p className="text-[10px] text-gray-500 text-center mt-3 shrink-0">
            Admin verifies license photo and vehicle details prior to activation.
          </p>
        </div>
      );
    }

    // -------------------------------------------------------------
    // STEP 1: Personal Details & Driver Type (Unchanged)
    // -------------------------------------------------------------
    const field = (label: string, key: string, value: string, onChange: (v: string) => void, placeholder?: string, type: string = 'text') => (
      <div>
        <label className="text-[10px] text-gray-500 font-bold block mb-1">{label}</label>
        <div className={`bg-white border ${regFieldErrors[key] ? 'border-red-400/60' : 'border-gray-300'} rounded-xl p-3 flex items-center gap-2`}>
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || label}
            className="bg-gray-50 text-gray-900 text-xs font-bold outline-none flex-1"
          />
        </div>
        {regFieldErrors[key] && <p className="text-red-500 text-[10px] mt-1">{regFieldErrors[key]}</p>}
      </div>
    );

    return (
      <div className="h-full flex flex-col bg-white text-gray-900 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <button
            onClick={() => setDriverScreen('DRIVER_LOGIN')}
            className="w-9 h-9 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <h2 className="text-base font-bold">Jitta Captain Registration</h2>
            <span className="text-[10px] bg-orange-100 text-[#E85D04] font-bold px-2 py-0.5 rounded-full">
              Step 1 of 2
            </span>
          </div>
          <div className="w-9" />
        </div>

        {regError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold text-center shrink-0">
            {regError}
          </div>
        )}

        <div className="space-y-4 mb-6">
          {/* 1. Category Selection */}
          <div className="bg-white border border-gray-200 rounded-2xl p-3.5 space-y-2.5">
            <p className="text-[11px] font-bold text-orange-500 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5" /> Registration Category
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: 'TAXI' as const, label: 'Taxi (Car)', desc: 'Mini, Sedan & SUV rides', icon: <Car className="w-4 h-4" /> },
                { id: 'TWO_WHEELER' as const, label: 'Two-Wheeler (Bike/Scooty)', desc: 'Bike & Scooty rides', icon: <Bike className="w-4 h-4" /> },
                { id: 'ACTING_DRIVER' as const, label: 'Active Driver (Acting Driver)', desc: "Customer's vehicle (No RC needed)", icon: <User className="w-4 h-4" /> },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setRegCategory(c.id)}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                    regCategory === c.id
                      ? 'bg-[#FFF7F0] border-[#E85D04] text-[#E85D04] shadow-xs'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 ${regCategory === c.id ? 'bg-[#E85D04] text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>
                    {c.icon}
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">{c.label}</div>
                    <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{c.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            {regCategory === 'ACTING_DRIVER' && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Active Driver:</strong> You drive the customer's vehicle. Only your Name, Phone Number, and Driving Licence Number are required.
                </span>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-3.5 space-y-3">
            <p className="text-[11px] font-bold text-orange-500 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Personal Details</p>
            {field('Full Name', 'name', regForm.name, (v) => setRegForm((s) => ({ ...s, name: v })))}

            {/* Mobile Number with OTP Verification */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-gray-500 font-bold">Mobile Number (+91)</label>
                {regPhoneVerified ? (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verified
                  </span>
                ) : regCountdown > 0 ? (
                  <span className="text-[10px] text-gray-400 font-bold">Resend in {regCountdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendRegOtp}
                    disabled={isSendingRegOtp || regForm.phone.length < 10}
                    className="text-[10px] font-bold text-[#E85D04] hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    {isSendingRegOtp ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Sending…</span>
                      </>
                    ) : (
                      <span>Send OTP →</span>
                    )}
                  </button>
                )}
              </div>

              <div className={`bg-white border ${regPhoneVerified ? 'border-emerald-300 bg-emerald-50/20' : regFieldErrors['phone'] ? 'border-red-400/60' : 'border-gray-300'} rounded-xl p-3 flex items-center gap-2`}>
                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={regForm.phone}
                  onChange={(e) => handleRegPhoneChange(e.target.value)}
                  placeholder="e.g. 9025167829"
                  className="bg-transparent text-gray-900 text-xs font-bold outline-none flex-1"
                />
              </div>
              {regFieldErrors['phone'] && <p className="text-red-500 text-[10px] mt-1">{regFieldErrors['phone']}</p>}

              {/* Invisible reCAPTCHA container for registration */}
              <div id="reg-driver-recaptcha-container"></div>

              {/* OTP Sent / Status Messages */}
              {regOtpSentMsg && (
                <div className={`mt-2 p-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 ${
                  regPhoneVerified ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-orange-50 text-orange-800 border border-orange-200'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{regOtpSentMsg}</span>
                </div>
              )}

              {regOtpError && (
                <div className="mt-2 p-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{regOtpError}</span>
                </div>
              )}

              {/* OTP Input box (shows when OTP is sent and not yet verified) */}
              {regOtpSent && !regPhoneVerified && (
                <div className="mt-2.5 p-3 bg-orange-50/50 border border-orange-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-700 uppercase flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#E85D04]" />
                      Enter OTP Code
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={regPhoneOtp}
                      onChange={(e) => setRegPhoneOtp(e.target.value.trim())}
                      placeholder="Enter 6-digit code"
                      className="flex-1 bg-white border border-gray-300 focus:border-[#E85D04] rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyRegOtp()}
                      disabled={isVerifyingRegOtp || !regPhoneOtp.trim()}
                      className="bg-[#E85D04] hover:bg-[#C2410C] text-white text-xs font-bold px-4 py-2 rounded-xl transition disabled:opacity-50 shrink-0 flex items-center gap-1"
                    >
                      {isVerifyingRegOtp ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Checking…</span>
                        </>
                      ) : (
                        <span>Verify OTP</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Driving License Number for Active Driver */}
            {regCategory === 'ACTING_DRIVER' && (
              <div>
                {field('Driving Licence Number (Required)', 'licenseNumber', regForm.licenseNumber, (v) => setRegForm((s) => ({ ...s, licenseNumber: v })), 'e.g. TN3020210008452')}
              </div>
            )}

            {field('Email (optional)', 'email', regForm.email, (v) => setRegForm((s) => ({ ...s, email: v })), 'you@example.com', 'email')}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field('Create Password', 'password', regForm.password, (v) => setRegForm((s) => ({ ...s, password: v })), 'Min 6 characters', 'password')}
              {field('Confirm Password', 'confirmPassword', regForm.confirmPassword, (v) => setRegForm((s) => ({ ...s, confirmPassword: v })), 'Re-enter password', 'password')}
            </div>
          </div>
        </div>

        {/* Action button */}
        {!regPhoneVerified ? (
          <button
            type="button"
            onClick={() => {
              if (!regForm.phone || regForm.phone.length < 10) {
                setRegError('Please enter a 10-digit mobile number');
              } else if (!regOtpSent) {
                handleSendRegOtp();
              } else {
                setRegError('Please enter the OTP above and verify your mobile number');
              }
            }}
            className="w-full bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl transition shrink-0 flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-[#E85D04]" />
            <span>Verify Mobile Number to Continue</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleProceedToStep2}
            className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold py-3.5 rounded-2xl shadow-lg transition shrink-0 flex items-center justify-center gap-2 active:scale-95"
          >
            <span>Next: Vehicle & License Details</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
        <p className="text-[10px] text-gray-500 text-center mt-3 shrink-0">Personal details are verified along with uploaded documents. You can drive once approved.</p>
      </div>
    );
  }

// Rapido Captain Documents Checklist Screen (Image 3)
  if (driverScreen === 'DOCUMENTS_UPLOAD') {
    return (
      <RapidoDocumentsView
        onBack={() => setDriverScreen('DRIVER_LOGIN')}
        onComplete={() => setDriverScreen('DRIVER_HOME')}
      />
    );
  }

// 44. Driver Approval Status
  if (driverScreen === 'DRIVER_APPROVAL') {
    const status = driverProfile.approvalStatus || 'PENDING';
    const isPending = status === 'PENDING';
    const isRejected = status === 'REJECTED' || String(status) === 'SUSPENDED' || String(status) === 'BLOCKED';
    const docs: { license: string; rc: string; insurance: string; permit: string } =
      driverProfile.documentNumbers || { license: '', rc: '', insurance: '', permit: '' };

    return (
      <DriverDashboardLayout>
        <div className="h-full flex flex-col justify-between p-6 bg-white text-gray-900 overflow-y-auto">
        <div>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setDriverScreen('DRIVER_LOGIN')}
              className="w-9 h-9 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-bold">Partner Verification</h2>
            <div className="w-9" />
          </div>

          <div className="bg-white border border-gray-200 rounded-3xl p-5 space-y-4 shadow-xl mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isRejected
                  ? 'bg-red-100 text-red-500'
                  : isPending
                    ? 'bg-amber-100 text-amber-500'
                    : 'bg-green-100 text-green-500'
              }`}>
                {isRejected ? <XCircle className="w-5 h-5" /> : isPending ? <Clock className="w-5 h-5" /> : <BadgeCheck className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {isRejected ? 'Application Not Approved' : isPending ? 'Application Under Review' : 'Application Approved'}
                </h3>
                <p className="text-[11px] text-gray-500">
                  {isRejected
                    ? 'Please contact support for details'
                    : isPending
                      ? 'Admin is verifying your vehicle details'
                      : 'You are ready to start driving'}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-gray-200 pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-600">Vehicle Number</span>
                <span className="font-bold font-mono text-gray-900">{driverProfile.vehicleNumber || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-600">Partner Status</span>
                <span className={`font-bold shrink-0 ${isRejected ? 'text-red-500' : isPending ? 'text-amber-500' : 'text-green-500'}`}>
                  {isRejected ? '✗ Rejected' : isPending ? 'Pending Admin Approval' : '✓ Verified'}
                </span>
              </div>
              {docs.license ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-600">Driving License</span>
                  <span className="font-bold font-mono text-gray-900">{docs.license}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
            <button
              onClick={async () => {
                setIsRefreshing(true);
                await refreshDriverData();
                setIsRefreshing(false);
              }}
              disabled={isRefreshing}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2"
            >
              {isRefreshing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Refresh Status</>
              )}
            </button>
            <button
              onClick={() => {
                if (isPending || isRejected) {
                  setDriverScreen('DRIVER_LOGIN');
                } else {
                  setDriverScreen('DRIVER_HOME');
                }
              }}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl shadow-lg"
            >
              {isPending || isRejected ? 'Back to Login' : 'Launch Approved Driver Dashboard'}
            </button>
          </div>
        </div>
      </DriverDashboardLayout>
    );
  }

  // 45 & 46. Driver Home Dashboard — Professional White/Orange
  if (driverScreen === 'DRIVER_HOME') {
const canGoOnline = driverProfile.approvalStatus === 'APPROVED';
    const earnings = driverWallet ? Math.round(driverWallet.todayEarnings) : driverProfile.todayEarnings;
    const tripsToday = driverWallet ? driverWallet.todayTrips : driverProfile.completedTripsToday;
    const rating = driverProfile.rating ?? '—';

return (
      <DriverDashboardLayout>
      <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] relative overflow-hidden">
        {/* Docked top app bar - Clean, full-width, vertically and horizontally aligned */}
        <header className="w-full h-14 bg-white border-b border-black/10 px-3 sm:px-4 z-30 flex items-center justify-between shrink-0 shadow-xs">
          {/* Left: Driver Profile Photo & Info */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-2 min-w-0 text-left hover:opacity-85 transition shrink-0"
            aria-label="Open menu"
          >
            <span className="relative shrink-0">
              {driverProfile.photo ? (
                <img src={driverProfile.photo} alt="Driver" className="w-9 h-9 rounded-full object-cover border border-black/10" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-100 border border-black/10 flex items-center justify-center text-gray-500">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white ${
                  canGoOnline
                    ? driverProfile.isOnline
                      ? 'bg-[#22A06B]'
                      : 'bg-[#A1A1AA]'
                    : 'bg-[#A1A1AA]'
                }`}
              />
            </span>
            <span className="min-w-0 hidden md:block max-w-[130px]">
              <span className="block text-xs font-black text-[#171717] leading-tight truncate">{driverProfile.name}</span>
              <span className="block text-[10px] text-[#E85D04] font-bold truncate">
                {driverProfile.vehicleType === 'TWO_WHEELER' ? '🏍️ Two-Wheeler' : driverProfile.vehicleType === 'ACTING_DRIVER' ? '👔 Acting Driver' : '🚗 Taxi Partner'}
              </span>
            </span>
          </button>

          {/* Right Group: Online/Offline Badge, Earnings, Language, Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Online Status Toggle Button */}
            <button
              type="button"
              onClick={canGoOnline ? handleToggleOnlineWithGuard : () => setDriverScreen('DOCUMENTS_UPLOAD')}
              className={`shrink-0 flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-black border transition active:scale-95 shadow-xs ${
                !canGoOnline
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : driverProfile.isOnline
                    ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 shadow-emerald-500/25'
                    : 'bg-slate-800 text-white border-slate-900 hover:bg-slate-700'
              }`}
              title={
                !canGoOnline
                  ? 'Verification Pending'
                  : driverProfile.isOnline
                    ? 'You are Online. Tap to Go Offline'
                    : 'You are Offline. Tap to Go Online'
              }
            >
              <Power className={`w-3.5 h-3.5 ${driverProfile.isOnline ? 'animate-pulse' : ''}`} />
              <span>
                {!canGoOnline
                  ? (language === 'ta' ? 'நிலுவையில்' : 'Pending')
                  : driverProfile.isOnline
                    ? (language === 'ta' ? 'ஆன்லைன்' : 'ONLINE')
                    : (language === 'ta' ? 'ஆஃப்லைன்' : 'OFFLINE')}
              </span>
            </button>

            {/* Earnings Badge */}
            <button
              onClick={() => setDriverScreen('EARNINGS')}
              className="shrink-0 flex items-center justify-center rounded-xl bg-[#E85D04] text-white text-xs font-bold px-3 py-1.5 shadow-xs hover:bg-[#C2410C] transition"
              aria-label="Today's earnings"
            >
              <span>₹{earnings}</span>
            </button>

            {/* Language Switcher */}
            <LanguageSwitcher compact={true} />

            {/* Menu Hamburger Button */}
            <button
              onClick={() => setMenuOpen(true)}
              className="shrink-0 w-9 h-9 rounded-xl bg-black/5 hover:bg-black/10 active:scale-95 flex items-center justify-center text-[#171717] transition lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-[#171717]" />
            </button>
          </div>
        </header>

        {/* Map fills screen immediately below header */}
        <div className="flex-1 relative min-h-0">
          {/* Rapido Captain Driver Live Locality Bar & Warnings */}
          <div className="absolute top-2.5 left-3 right-3 z-20 pointer-events-auto space-y-2">
            {/* Cancelled ride alert notification */}
            {rideCancelledNotice && (
              <div className="bg-rose-600 text-white font-black text-xs px-4 py-2.5 rounded-2xl shadow-xl flex items-center justify-between gap-2 border border-rose-400/40 animate-in fade-in slide-in-from-top duration-200">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-white shrink-0 animate-bounce" />
                  <span className="truncate">{rideCancelledNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRideCancelledNotice('')}
                  className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white shrink-0"
                  aria-label="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="bg-white/95 backdrop-blur-md border border-black/10 rounded-2xl px-3.5 py-2.5 shadow-md flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="relative flex w-3 h-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-[#737373] uppercase tracking-wider flex items-center gap-1.5">
                    <span>Driver Live Location</span>
                    <span className="text-emerald-600 font-extrabold">• GPS Live</span>
                  </div>
                  <div className="text-xs font-black text-[#171717] truncate">
                    {driverLocalityName}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleRefreshDriverLocation}
                  disabled={isLocatingDriver}
                  className="p-1.5 rounded-xl bg-black/5 hover:bg-black/10 text-[#171717] active:scale-95 transition"
                  title="Update GPS"
                  aria-label="Refresh GPS"
                >
                  <Locate className={`w-4 h-4 text-[#E85D04] ${isLocatingDriver ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Low Wallet Balance Warning Banner */}
            {Number(driverWallet?.balance ?? driverProfile.walletBalance ?? 0) < 100 && (
              <div
                onClick={() => {
                  setDriverScreen('DRIVER_WALLET');
                  setShowRechargeModal(true);
                }}
                className={`cursor-pointer rounded-2xl px-3.5 py-2.5 shadow-lg flex items-center justify-between gap-2 transition hover:brightness-105 active:scale-[0.99] border ${
                  Number(driverWallet?.balance ?? driverProfile.walletBalance ?? 0) < 50
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-300/30'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-300/30'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertCircle className="w-5 h-5 shrink-0 text-white animate-pulse" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-black truncate">
                      {Number(driverWallet?.balance ?? driverProfile.walletBalance ?? 0) < 50
                        ? (language === 'ta' ? 'முக்கிய எச்சரிக்கை: குறைந்த இருப்பு (< ₹50)' : 'Critical Balance! Under ₹50 Limit')
                        : (language === 'ta' ? 'குறைந்த இருப்பு எச்சரிக்கை (₹100க்கு கீழ்)' : 'Low Wallet Balance: Under ₹100')}
                    </p>
                    <p className="text-[10px] text-white/90 font-medium truncate">
                      {Number(driverWallet?.balance ?? driverProfile.walletBalance ?? 0) < 50
                        ? (language === 'ta' ? 'புதிய சவாரிகளை ஏற்க ரீசார்ஜ் செய்யவும் (குறைந்தது ₹50 தேவை)' : 'Min ₹50 required to accept rides. Tap to recharge.')
                        : (language === 'ta' ? `இருப்பு: ₹${Number(driverWallet?.balance ?? 0).toFixed(2)} • ரீசார்ஜ் செய்ய தட்டவும்` : `Current: ₹${Number(driverWallet?.balance ?? 0).toFixed(2)} • Recharge to avoid interruption`)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-2.5 py-1 bg-white text-[#E85D04] font-extrabold text-[10px] rounded-xl shadow-xs shrink-0 whitespace-nowrap"
                >
                  {language === 'ta' ? 'ரீசார்ஜ்' : 'Recharge'}
                </button>
              </div>
            )}
          </div>

          <InteractiveMap
            pickup={{
              name: driverLocalityName,
              address: driverLocalityName,
              lat: driverCoords.lat,
              lng: driverCoords.lng,
            }}
            driverLocation={driverCoords}
            showNearbyDrivers={false}
            height="h-full"
            controlsOffsetTop={56}
            forceLight={true}
          />

          {/* Floating logo avatar on map */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
              <div className="absolute inset-0 bg-[#E85D04]/15 rounded-full animate-ping" />
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-[#E85D04]">
                <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Jitta Drives" className="w-7 h-7 object-contain" />
              </div>
            </div>
          </div>
        </div>

{/* Bottom driver panel */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out flex flex-col ${
            isHomePanelExpanded ? 'max-h-[72%] shadow-[0_-12px_40px_rgba(0,0,0,0.25)]' : 'max-h-[115px]'
          }`}
        >
          {/* Interactive Drag Handle Area */}
          <div
            className="w-full pt-2.5 pb-1 flex flex-col items-center justify-center cursor-pointer select-none active:opacity-75 touch-none"
            onClick={() => setIsHomePanelExpanded((prev) => !prev)}
            onTouchStart={handlePanelTouchStart}
            onTouchMove={handlePanelTouchMove}
            onTouchEnd={handlePanelTouchEnd}
            onMouseDown={handlePanelMouseDown}
            onMouseMove={handlePanelMouseMove}
            onMouseUp={handlePanelMouseUp}
          >
            <div className="w-12 h-1.5 rounded-full bg-slate-300 hover:bg-slate-400 transition" />
            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-slate-400">
              <span>
                {isHomePanelExpanded
                  ? (language === 'ta' ? 'வரைபடம் காண கீழே தள்ளவும்' : 'Tap or drag down to see map')
                  : (language === 'ta' ? 'விவரங்கள் காண மேலே தள்ளவும்' : 'Tap or drag up for stats & offers')}
              </span>
              {isHomePanelExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
            </div>
          </div>

          <div className="px-4 sm:px-5 flex-1 overflow-y-auto">
            {/* Status row - tapping anywhere on it also toggles */}
            <div
              className="flex items-center justify-between gap-3 py-2 cursor-pointer select-none"
              onClick={() => setIsHomePanelExpanded((prev) => !prev)}
            >
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-[15px] sm:text-base font-black text-[#171717]">
                  {canGoOnline && driverProfile.isOnline && (
                    <span className="relative flex w-2 h-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22A06B] opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22A06B]" />
                    </span>
                  )}
                  {!canGoOnline
                    ? (language === 'ta' ? 'சரிபார்ப்பு நிலுவையில் உள்ளது' : 'Pending approval')
                    : driverProfile.isOnline
                      ? (language === 'ta' ? 'நீங்கள் இணைப்பில் உள்ளீர்கள்' : "You're online")
                      : (language === 'ta' ? 'நீங்கள் ஆஃப்லைனில் உள்ளீர்கள்' : "You're offline")}
                </h3>
                <p className="text-[11px] text-[#737373] truncate">
                  {!canGoOnline
                    ? (language === 'ta' ? 'ஆன்லைனில் செல்ல சரிபார்ப்பை முடிக்கவும்' : 'Complete verification to go online')
                    : driverProfile.isOnline
                      ? (driverProfile.vehicleType === 'TWO_WHEELER'
                          ? (language === 'ta' ? 'பைக் / ஸ்கூட்டி சவாரிகளுக்கு காத்திருக்கிறது… 🏍️' : 'Waiting for Bike & Scooty rides… 🏍️')
                          : driverProfile.vehicleType === 'ACTING_DRIVER'
                          ? (language === 'ta' ? 'ஆக்டிங் டிரைவர் சவாரிகளுக்கு காத்திருக்கிறது… 👔' : 'Waiting for Acting Driver rides… 👔')
                          : (language === 'ta' ? 'கேப் & ஆட்டோ சவாரிகளுக்கு காத்திருக்கிறது… 🚗' : 'Waiting for Cab & Auto rides… 🚗'))
                      : (language === 'ta' ? 'சவாரிகளை ஏற்க ஆன்லைனில் செல்லவும்' : 'Go online to start accepting rides')}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {canGoOnline && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleOnlineWithGuard();
                    }}
                    className={`text-[11px] font-black px-3.5 py-1.5 rounded-xl shadow-xs active:scale-95 transition flex items-center gap-1.5 border ${
                      driverProfile.isOnline
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                        : 'bg-[#E85D04] hover:bg-[#C2410C] text-white border-[#E85D04]'
                    }`}
                  >
                    <Power className={`w-3.5 h-3.5 ${driverProfile.isOnline ? 'text-rose-600' : 'text-white'}`} />
                    <span>
                      {driverProfile.isOnline
                        ? (language === 'ta' ? 'ஆஃப்லைன்' : 'Go Offline')
                        : (language === 'ta' ? 'ஆன்லைன்' : 'Go Online')}
                    </span>
                  </button>
                )}
                <div className="text-right">
                  <span className="block text-lg font-black text-[#171717] leading-none">₹{earnings}</span>
                  <span className="text-[10px] text-[#737373]">{language === 'ta' ? 'இன்று' : 'Today'}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsHomePanelExpanded((prev) => !prev);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition active:scale-95 shadow-xs"
                  aria-label={isHomePanelExpanded ? 'Collapse' : 'Expand'}
                >
                  {isHomePanelExpanded ? <ChevronDown className="w-5 h-5 text-slate-600" /> : <ChevronUp className="w-5 h-5 text-slate-600" />}
                </button>
              </div>
            </div>

            {/* Expanded Content: only shown when expanded */}
            {isHomePanelExpanded && (
              <div className="pt-1">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2.5 pb-3">
                  <button
                    onClick={() => setDriverScreen('EARNINGS')}
                    className="bg-[#FAFAF8] border border-black/5 rounded-2xl p-3 text-left hover:bg-black/5 transition"
                  >
                    <TrendingUp className="w-4 h-4 text-[#E85D04] mb-1.5" />
                    <span className="block text-sm font-black text-[#171717] leading-tight">₹{earnings}</span>
                    <span className="block text-[10px] text-[#737373] mt-0.5">{language === 'ta' ? 'இன்றைய வருவாய்' : "Today's Earnings"}</span>
                  </button>
                  <button
                    onClick={() => {
                      refreshDriverHistory();
                      setDriverScreen('DRIVER_HISTORY');
                    }}
                    className="bg-[#FAFAF8] border border-black/5 rounded-2xl p-3 text-left hover:bg-black/5 transition"
                  >
                    <History className="w-4 h-4 text-[#E85D04] mb-1.5" />
                    <span className="block text-sm font-black text-[#171717] leading-tight">{tripsToday}</span>
                    <span className="block text-[10px] text-[#737373] mt-0.5">{language === 'ta' ? 'நிறைவுற்ற சவாரிகள்' : 'Completed Rides'}</span>
                  </button>
                  <div className="bg-[#FAFAF8] border border-black/5 rounded-2xl p-3">
                    <span className="block text-amber-500 text-sm font-black leading-tight">★ {rating}</span>
                    <span className="block text-[10px] text-[#737373] mt-0.5">{language === 'ta' ? 'மதிப்பீடு' : 'Rating'}</span>
                  </div>
                </div>

                {/* Admin Offers & Announcements Banners */}
                {(() => {
                  const driverOffers = (allOffers || []).filter((o: any) =>
                    o.isActive !== false && (o.targetAudience === 'DRIVERS' || o.targetAudience === 'ALL' || !o.targetAudience)
                  );
                  if (driverOffers.length === 0) {
                    return (
                      <div className="pb-3">
                        <div className="rounded-2xl p-3.5 bg-[#FFF7F0] border border-[#E85D04]/20 flex items-center gap-3 shadow-xs">
                          <div className="w-8 h-8 rounded-xl bg-white border border-[#E85D04]/20 flex items-center justify-center text-[#E85D04] shrink-0">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-[#171717]">{language === 'ta' ? 'விரைவில் புதிய சலுகைகள் வரும்!' : 'Offers Will Coming Soon!'}</p>
                            <p className="text-[10px] text-[#737373] mt-0.5">{language === 'ta' ? 'புதிய ஓட்டுநர் ஊக்கத்தொகை மற்றும் போனஸ்கள் விரைவில் வெளியிடப்படும்.' : 'New driver milestone incentives, trip bonuses, and announcements will be posted here.'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-1.5 text-xs font-black text-[#171717]">
                          <Sparkles className="w-3.5 h-3.5 text-[#E85D04]" />
                          Offers & Announcements
                        </span>
                        <span className="text-[10px] font-bold text-[#E85D04]">
                          {driverOffers.length} Active
                        </span>
                      </div>
                      <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-none snap-x snap-mandatory">
                        {driverOffers.map((offer: any) => {
                          const bg = (offer.bgGradient && offer.bgGradient.includes('gradient'))
                            ? offer.bgGradient
                            : (offer.bg_gradient && offer.bg_gradient.includes('gradient'))
                              ? offer.bg_gradient
                              : offer.code === 'AIRPORT150' || offer.id === 'o-2'
                                ? 'linear-gradient(135deg, #EA580C 0%, #9A3412 100%)'
                                : offer.code === 'RENTAL25' || offer.id === 'o-3'
                                  ? 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)'
                                  : 'linear-gradient(135deg, #E11D48 0%, #9F1239 100%)';
                          return (
                            <div
                              key={offer.id}
                              onClick={() => setSelectedOfferModal(offer)}
                              className="min-w-[240px] sm:min-w-[260px] cursor-pointer snap-start rounded-2xl p-4 text-white shadow-lg transition hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between"
                              style={{ background: bg }}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-black/35 backdrop-blur-xs text-[10px] font-black tracking-wide uppercase text-white">
                                  {offer.discountTag || offer.discount_tag || 'OFFER'}
                                </span>
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white/20 text-white">
                                  Active
                                </span>
                              </div>
                              <div>
                                <h4 className="font-black text-sm leading-tight text-white mb-1 drop-shadow-xs">
                                  {offer.title || 'Special Promotion'}
                                </h4>
                                <p className="text-[11px] text-white/90 line-clamp-2 leading-relaxed">
                                  {offer.description || 'Special promotional deal from Jitta Drives'}
                                </p>
                              </div>
                              <div className="mt-2.5 pt-2 border-t border-white/20 flex items-center justify-between text-[10px] font-bold text-white/90">
                                <span>Tap for details</span>
                                <span>→</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Ride request stream (online only) */}
                {canGoOnline && driverProfile.isOnline && (
                  <div className="pb-3">
                    {availableRides.length > 0 ? (
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {availableRides.slice(0, 3).map((ride: any) => (
                          <button
                            key={ride.id}
                            onClick={() => {
                              setSelectedAvailableRide(ride);
                              setDriverScreen('RIDE_REQUEST');
                            }}
                            className="w-full text-left bg-white border border-black/10 rounded-2xl p-3 flex items-center justify-between gap-2 hover:border-[#E85D04]/50 transition"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#171717] truncate">
                                {ride.pickup?.name || 'Pickup'} → {ride.drop?.name || 'Drop'}
                              </div>
                              <div className="text-[10px] text-[#737373] truncate">
                                {ride.distance_km} km • {ride.duration_min} min • {sanitizeBrandText(ride.customer_name, 'Passenger')}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-black text-[#E85D04]">₹{ride.total_fare}</div>
                              <div className="text-[9px] font-bold text-[#E85D04]">VIEW →</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-4 bg-[#FAFAF8] border border-black/5 rounded-2xl">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                          <Bell className="w-5 h-5 text-[#737373]" />
                        </div>
                        <p className="text-xs font-semibold text-[#171717]">
                          {language === 'ta' ? 'தற்போது புதிய பயண அழைப்புகள் இல்லை' : 'No ride requests right now'}
                        </p>
                        <p className="text-[11px] text-[#737373]">
                          {language === 'ta' ? 'புதிய சவாரிகள் வரும்போது தானாகத் தோன்றும்' : 'New ride requests will appear here automatically'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Documents Verification Gate Banner */}
                {!canGoOnline && (
                  <div className="mb-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-2 shadow-xs">
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-amber-900">Documents Verification Required</span>
                      <span className="block text-[11px] text-amber-700">Upload DL, Vehicle RC & ID to start earning</span>
                    </div>
                    <button
                      onClick={() => setDriverScreen('DOCUMENTS_UPLOAD')}
                      className="shrink-0 bg-[#E85D04] hover:bg-[#C2410C] text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xs active:scale-95 transition"
                    >
                      Upload Documents →
                    </button>
                  </div>
                )}

                {/* Primary action (online / offline / pending full button in expanded view) */}
                <button
                  type="button"
                  onClick={canGoOnline ? handleToggleOnlineWithGuard : () => setDriverScreen('DOCUMENTS_UPLOAD')}
                  className={`w-full font-extrabold py-3.5 rounded-[14px] shadow-md min-h-[50px] flex items-center justify-center gap-2 transition active:scale-[0.99] mb-3 text-sm ${
                    !canGoOnline
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25'
                      : driverProfile.isOnline
                        ? 'bg-slate-900 hover:bg-black text-white shadow-slate-900/25 border border-slate-700'
                        : 'bg-[#E85D04] hover:bg-[#C2410C] text-white shadow-[#E85D04]/30'
                  }`}
                >
                  <Power className="w-4 h-4" />
                  {!canGoOnline
                    ? (language === 'ta' ? 'சரிபார்ப்பு நிலுவையில் உள்ளது - ஆவணங்களை பதிவேற்றவும்' : 'PENDING APPROVAL - UPLOAD DOCUMENTS')
                    : driverProfile.isOnline
                      ? (language === 'ta' ? 'பணியை நிறுத்தவும் (ஆஃப்லைன் செல்)' : 'TAKE A BREAK (GO OFFLINE)')
                      : (language === 'ta' ? 'சவாரிகளை ஏற்க ஆன்லைனில் செல்' : 'GO ONLINE TO RECEIVE RIDES')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Uber-style left slide-in menu drawer */}
        {menuOpen && (
          <>
            <div className="absolute inset-0 z-40 bg-black/60" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute top-0 left-0 bottom-0 z-50 w-72 bg-white text-black shadow-2xl flex flex-col"
            >
              <div className="p-5 pb-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {driverProfile.photo ? (
                    <img
                      src={driverProfile.photo}
                      alt="Driver"
                      className="w-11 h-11 rounded-full border-2 border-emerald-500 object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gray-100 border-2 border-emerald-500 flex items-center justify-center text-gray-500 shrink-0">
                      <User className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-black truncate">{driverProfile.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {driverProfile.vehicleModel} • {driverProfile.vehicleNumber}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Duty Status Bar */}
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {language === 'ta' ? 'பணி நிலை' : 'Duty Status'}
                  </span>
                  <span className={`text-xs font-black flex items-center gap-1.5 ${driverProfile.isOnline ? 'text-emerald-600' : 'text-slate-600'}`}>
                    <span className={`w-2 h-2 rounded-full ${driverProfile.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    {driverProfile.isOnline
                      ? (language === 'ta' ? 'இணைப்பில் (ஆன்லைன்)' : 'Online (Active)')
                      : (language === 'ta' ? 'ஆஃப்லைன்' : 'Offline')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={canGoOnline ? handleToggleOnlineWithGuard : () => { setMenuOpen(false); setDriverScreen('DOCUMENTS_UPLOAD'); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-1 shadow-xs ${
                    driverProfile.isOnline
                      ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                      : 'bg-[#E85D04] text-white hover:bg-[#C2410C]'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>
                    {driverProfile.isOnline
                      ? (language === 'ta' ? 'ஆஃப்லைன்' : 'Go Offline')
                      : (language === 'ta' ? 'ஆன்லைன்' : 'Go Online')}
                  </span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-2">
                {[
                  {
                    label: language === 'ta' ? 'வருவாய் & பணப்பை' : 'Earnings & Wallet',
                    icon: <Wallet className="w-5 h-5" />,
                    action: () => setDriverScreen('DRIVER_WALLET'),
                  },
                  {
                    label: `${language === 'ta' ? 'அறிவிப்புகள்' : 'Notifications'}${driverNotifications.filter((n: any) => !n.isRead).length > 0 ? ` (${driverNotifications.filter((n: any) => !n.isRead).length})` : ''}`,
                    icon: <Bell className="w-5 h-5" />,
                    action: () => {
                      refreshDriverNotifications();
                      setDriverScreen('DRIVER_NOTIFICATIONS');
                    },
                  },
                  {
                    label: language === 'ta' ? 'ஆவணங்கள் & சரிபார்ப்பு' : 'Upload Documents (Checklist)',
                    icon: <ShieldCheck className="w-5 h-5" />,
                    action: () => setDriverScreen('DOCUMENTS_UPLOAD'),
                  },

                  {
                    label: `${language === 'ta' ? 'சலுகைகள் & அறிவிப்புகள்' : 'Offers & Announcements'} (${(allOffers || []).filter((o: any) => o.isActive !== false && (o.targetAudience === 'DRIVERS' || o.targetAudience === 'ALL' || !o.targetAudience)).length})`,
                    icon: <Sparkles className="w-5 h-5" />,
                    action: () => {
                      const dOffers = (allOffers || []).filter((o: any) => o.isActive !== false && (o.targetAudience === 'DRIVERS' || o.targetAudience === 'ALL' || !o.targetAudience));
                      if (dOffers.length > 0) {
                        setSelectedOfferModal(dOffers[0]);
                      } else {
                        setSelectedOfferModal({
                          id: 'coming-soon',
                          title: language === 'ta' ? 'விரைவில் புதிய சலுகைகள் வரும்!' : 'Offers Will Coming Soon!',
                          description: language === 'ta' ? 'புதிய ஓட்டுநர் ஊக்கத்தொகை மற்றும் போனஸ்கள் விரைவில் வெளியிடப்படும்.' : 'New driver milestone incentives, trip bonuses, and announcements will be posted here.',
                          discountTag: 'COMING SOON',
                          bgGradient: 'linear-gradient(135deg, #EA580C 0%, #9A3412 100%)',
                        });
                      }
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setMenuOpen(false);
                      item.action();
                    }}
                    className="w-full flex items-center gap-3 px-5 py-3 text-sm font-semibold text-[#171717] hover:bg-[#FAFAF8] transition text-left"
                  >
                    <span className="text-[#E85D04] shrink-0">{item.icon}</span>
                    {item.label}
                  </button>
                ))}

                {/* Driver Drawer Language Switcher */}
                <div className="px-5 py-3 flex items-center justify-between border-t border-[#E5E5E5] mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[#737373] text-sm font-semibold">{language === 'ta' ? 'மொழி' : 'Language'}</span>
                  </div>
                  <LanguageSwitcher compact={false} />
                </div>
              </div>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  logoutDriver();
                  setDriverScreen('DRIVER_LOGIN');
                }}
                className="m-4 flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-bold py-3 rounded-2xl text-xs transition"
              >
                <LogOut className="w-4 h-4" />
                {language === 'ta' ? 'வெளியேறு' : 'Sign Out'}
              </button>
            </motion.div>
          </>
        )}

        {/* Offer Details Modal */}
        {selectedOfferModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-black/10 text-left space-y-4 font-sans"
            >
              <div
                className="rounded-2xl p-4 text-white shadow-md relative overflow-hidden"
                style={{
                  background: (selectedOfferModal.bgGradient && selectedOfferModal.bgGradient.includes('gradient'))
                    ? selectedOfferModal.bgGradient
                    : selectedOfferModal.code === 'AIRPORT150' || selectedOfferModal.id === 'o-2'
                      ? 'linear-gradient(135deg, #EA580C 0%, #9A3412 100%)'
                      : selectedOfferModal.code === 'RENTAL25' || selectedOfferModal.id === 'o-3'
                        ? 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)'
                        : 'linear-gradient(135deg, #E11D48 0%, #9F1239 100%)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-black/30 backdrop-blur-xs text-[11px] font-black tracking-wide uppercase">
                    {selectedOfferModal.discountTag ? `${selectedOfferModal.discountTag}` : 'PROMOTION'}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-white/20">
                    Live Deal
                  </span>
                </div>
                <h3 className="text-lg font-black text-white">{selectedOfferModal.title}</h3>
                <p className="text-xs text-white/90 mt-1 leading-relaxed">{selectedOfferModal.description}</p>
                {selectedOfferModal.code && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white text-[#C2410C] font-black text-xs">
                    <span>Code: {selectedOfferModal.code}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs text-[#737373]">
                <div className="flex justify-between py-1 border-b border-black/5">
                  <span className="font-semibold">Campaign Status</span>
                  <span className="font-bold text-[#22A06B]">Active</span>
                </div>
                {selectedOfferModal.validity && (
                  <div className="flex justify-between py-1 border-b border-black/5">
                    <span className="font-semibold">Validity</span>
                    <span className="font-bold text-[#171717]">{selectedOfferModal.validity}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedOfferModal(null)}
                className="w-full py-3 bg-[#E85D04] hover:bg-[#C2410C] text-white font-extrabold rounded-2xl text-xs shadow-lg shadow-[#E85D04]/30 transition active:scale-[0.99]"
              >
                Got It / Close
              </button>
            </motion.div>
          </div>
        )}

        {/* Low Balance Guard Modal */}
        {showLowBalanceModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-black/10 text-center space-y-4 font-sans"
            >
              <div className="w-14 h-14 bg-amber-500/10 text-[#E85D04] rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-[#E85D04]" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#171717]">Prepaid Wallet Recharge Required</h3>
                <p className="text-xs text-[#737373] mt-1.5 leading-relaxed">
                  Drivers must maintain a prepaid wallet balance before going online and accepting ride requests.
                </p>
              </div>

              <div className="bg-[#FAFAF8] border border-black/5 rounded-2xl p-3 flex items-center justify-between">
                <span className="text-xs text-[#737373] font-bold">Current Balance:</span>
                <span className="text-sm font-black text-rose-600">₹{Number(driverWallet?.balance || 0).toFixed(2)}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowLowBalanceModal(false)}
                  className="flex-1 py-3 bg-black/5 hover:bg-black/10 text-[#737373] font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLowBalanceModal(false);
                    setDriverScreen('DRIVER_WALLET');
                    setShowRechargeModal(true);
                  }}
                  className="flex-1 py-3 bg-[#E85D04] hover:bg-[#C2410C] text-white font-extrabold rounded-xl text-xs shadow-lg shadow-[#E85D04]/30 transition"
                >
                  Recharge Now
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {cancellationAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-black/5 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
                <AlertTriangle className="w-7 h-7 text-rose-600" />
              </div>
              <h3 className="text-lg font-black text-[#171717] mb-1.5">{cancellationAlert.title}</h3>
              <p className="text-xs text-[#737373] mb-6 leading-relaxed">{cancellationAlert.message}</p>
              <button
                onClick={() => setCancellationAlert(null)}
                className="w-full bg-[#E85D04] hover:bg-[#D45303] text-white font-extrabold text-sm py-3.5 rounded-2xl transition shadow-md active:scale-95"
              >
                {language === 'ta' ? 'சரி, தொடரவும்' : 'OK, Continue'}
              </button>
            </div>
          </div>
        )}
      </div>
      </DriverDashboardLayout>
    );
  }

// 47. Ride Request Screen (Map Background + White Booking Card)
  if (driverScreen === 'RIDE_REQUEST') {
    const displayRide = selectedAvailableRide || (availableRides.length > 0 ? availableRides[0] : null);
    const reqFare = displayRide ? Number(displayRide.total_fare) : (activeBooking?.fare?.totalFare || 320);
    const distanceKm = displayRide ? displayRide.distance_km : (activeBooking ? activeBooking.distanceKm : 8.4);
    const durationMin = displayRide ? displayRide.duration_min : (activeBooking ? activeBooking.durationMin : 24);
    const pickupName = displayRide?.pickup?.name || activeBooking?.pickup?.name || 'Pickup Location';
    const pickupAddr = displayRide?.pickup?.address || activeBooking?.pickup?.address || '';
    const dropName = displayRide?.drop?.name || activeBooking?.drop?.name || 'Destination';
    const dropAddr = displayRide?.drop?.address || activeBooking?.drop?.address || '';
    const customerName = sanitizeBrandText(displayRide?.customer_name || activeBooking?.customerName, 'Customer');
    const paymentMethod = String(displayRide?.payment_method || activeBooking?.paymentMethod || 'Cash');
    const perKm = distanceKm > 0 ? `₹${(reqFare / distanceKm).toFixed(1)}/Km` : null;
    const isDriverOnly = String(displayRide?.ride_type || activeBooking?.rideType || '').toUpperCase() === 'DRIVER_ONLY';
    const custVehicle = displayRide?.customer_vehicle_details || (activeBooking as any)?.customerVehicle || null;

    return (
      <DriverDashboardLayout>
        <div className="h-full flex flex-col relative">
        {/* Map fills the screen */}
        <InteractiveMap
          pickup={displayRide?.pickup || activeBooking?.pickup}
          drop={displayRide?.drop || activeBooking?.drop}
          showNearbyDrivers={false}
          height="h-full"
          forceLight={true}
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/35 via-transparent to-black/45 pointer-events-none" />

        {/* Top floating controls */}
        <div className="absolute top-3 left-3 right-3 sm:top-4 z-20 flex items-center justify-between gap-2">
          <button
            onClick={() => setDriverScreen('DRIVER_HOME')}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white text-[#171717] shadow-md border border-black/5 flex items-center justify-center hover:bg-black/5 transition active:scale-95 min-w-[40px]"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <span className="bg-white/95 backdrop-blur text-[#171717] font-extrabold text-[11px] px-3.5 py-2 rounded-full shadow-md border border-black/5 flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#E85D04] animate-pulse shrink-0" />
            <span className="truncate">{language === 'ta' ? 'புதிய பயண அழைப்பு' : 'New Ride Request'}</span>
          </span>

          <div
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-md border border-black/5 flex items-center justify-center pointer-events-none shrink-0"
            aria-hidden
          >
            <span className="relative">
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#E85D04] animate-ping" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#E85D04]" />
              <Bell className="w-5 h-5 text-[#171717]" />
            </span>
          </div>
        </div>

        {/* Premium booking request bottom sheet */}
        <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 right-2 sm:right-3 z-20 bg-white rounded-[20px] shadow-[0_-6px_28px_rgba(0,0,0,0.16)] border border-black/5 px-4 sm:px-5 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-[#171717] max-h-[76%] overflow-y-auto">
          <div className="w-9 h-1 rounded-full bg-black/10 mx-auto mb-2" />

          {/* Header row: Booking Request + countdown */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-black tracking-tight">
              {language === 'ta' ? 'பயண முன்பதிவு அழைப்பு' : 'Booking Request'}
            </h2>
            <div className="w-9 h-9 rounded-full bg-white border-2 border-[#E85D04] text-[#E85D04] font-extrabold text-xs shadow-sm flex items-center justify-center shrink-0">
              {requestTimer}s
            </div>
          </div>

          {/* Local badge + per-km */}
          <div className="flex items-center justify-between mt-1.5">
            <span className="bg-[#E85D04] text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wide">
              {isDriverOnly ? (language === 'ta' ? 'வாடிக்கையாளர் வாகனம்' : 'Driving Customer Vehicle') : (language === 'ta' ? 'உள்ளூர்' : 'Local')}
            </span>
            {isDriverOnly ? (
              <span className="text-[11px] sm:text-xs font-bold text-[#737373]">{language === 'ta' ? 'ஓட்டுநர் சேவை' : 'Chauffeur gig'} · {durationMin} min</span>
            ) : perKm ? (
              <span className="text-[11px] sm:text-xs font-bold text-[#737373]">{perKm}</span>
            ) : null}
          </div>

          {/* Customer-owned vehicle (Chauffeur / DRIVER ONLY) */}
          {isDriverOnly && (
            <div className="mt-2.5 bg-[#FAFAF8] border border-[#E85D04]/30 rounded-2xl px-3 py-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-black/5 bg-white shrink-0 flex items-center justify-center text-xl">
                {String(custVehicle?.type || custVehicle?.vehicle_type || '').toLowerCase().includes('bike') ? '🏍️'
                  : String(custVehicle?.type || custVehicle?.vehicle_type || '').toLowerCase().includes('scoot') ? '🛵'
                  : String(custVehicle?.type || custVehicle?.vehicle_type || '').toLowerCase().includes('hatch') ? '🚗'
                  : String(custVehicle?.type || custVehicle?.vehicle_type || '').toLowerCase().includes('suv') ? '🚙'
                  : '🚘'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[#E85D04] uppercase tracking-wide">
                  {language === 'ta' ? 'வாடிக்கையாளரின் வாகனம்' : "Customer's Vehicle"}
                </p>
                <p className="text-xs font-extrabold text-[#171717] truncate">
                  {custVehicle?.type || custVehicle?.vehicle_type || custVehicle?.model || 'Sedan'}
                  {custVehicle?.transmission ? ` (${custVehicle.transmission})` : ''}
                </p>
                <p className="text-[10px] text-[#737373] truncate">
                  {custVehicle?.number ? custVehicle.number : (language === 'ta' ? 'வாடிக்கையாளர் வாகனம்' : 'Customer-Owned Vehicle')}
                  {custVehicle?.color ? ` · ${custVehicle.color}` : ''}
                </p>
              </div>
              <span className="text-[9px] font-bold text-[#E85D04] bg-[#FFF7F0] border border-[#E85D04]/20 px-2 py-1 rounded-full uppercase shrink-0">
                {language === 'ta' ? 'ஆக்டிவ் டிரைவர்' : 'Acting Driver'}
              </span>
            </div>
          )}

          {/* Fare + payment */}
          <div className="flex items-end justify-between mt-2">
            <span className="text-3xl sm:text-4xl font-black text-[#171717] leading-none">₹{reqFare}</span>
            <span className="bg-[#22A06B]/10 border border-[#22A06B]/25 text-[#22A06B] text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase mb-0.5">
              {paymentMethod}
            </span>
          </div>

          {/* Route / distance strip */}
          <div className="flex items-center gap-3 bg-[#FAFAF8] border border-black/5 rounded-2xl px-3 py-2.5 mt-3">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <span className="w-3 h-3 rounded-full bg-[#22A06B] shadow-sm" />
              <span className="w-px h-4 bg-black/10" />
              <span className="w-3 h-3 rounded-full bg-[#DC2626] shadow-sm" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-bold text-[#22A06B] uppercase tracking-wide shrink-0">
                  {language === 'ta' ? 'ஏறும் இடம்' : 'Pickup'}
                </span>
                <p className="text-xs font-semibold text-[#171717] truncate">{pickupName}</p>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-wide shrink-0">
                  {language === 'ta' ? 'இறங்கும் இடம்' : 'Drop'}
                </span>
                <p className="text-xs font-semibold text-[#171717] truncate">{dropName}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="block text-sm font-black text-[#171717] leading-tight">{distanceKm} km</span>
              <span className="block text-[10px] text-[#737373]">{durationMin} min</span>
            </div>
          </div>

          {/* Location details */}
          <div className="space-y-2 mt-3">
            <div className="flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22A06B] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#171717] truncate">{pickupName}</p>
                {pickupAddr ? <p className="text-[10px] text-[#737373] truncate">{pickupAddr}</p> : null}
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#171717] truncate">{dropName}</p>
                {dropAddr ? <p className="text-[10px] text-[#737373] truncate">{dropAddr}</p> : null}
              </div>
            </div>
            <div className="flex items-center gap-2.5 pl-0.5">
              <User className="w-3.5 h-3.5 text-[#737373] shrink-0" />
              <span className="text-[11px] text-[#737373] font-medium truncate">{customerName}</span>
            </div>
          </div>

          {/* Accept helper + actions */}
          <p className="text-[10px] text-[#737373] font-semibold text-center mt-3 mb-2">
            {language === 'ta' ? 'முன்பதிவை ஏற்க இங்கே தட்டவும்' : 'Tap on this Popup Area to Accept this Booking'}
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                rejectRideRequest(displayRide?.id);
              }}
              className="h-12 px-6 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[#171717] font-black text-xs shadow-sm transition active:scale-95 min-h-[44px] flex items-center justify-center gap-1.5 shrink-0"
            >
              <X className="w-4 h-4 text-slate-500" />
              <span>{language === 'ta' ? 'தவிர்' : 'SKIP'}</span>
            </button>
            <button
              disabled={isAcceptingRide}
              onClick={() => handleAcceptRide(displayRide?.id)}
              className="flex-1 h-12 rounded-2xl bg-[#E85D04] hover:bg-[#C2410C] text-white font-extrabold text-sm shadow-lg shadow-[#E85D04]/30 transition active:scale-[0.98] min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-not-allowed"
            >
              {isAcceptingRide ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{language === 'ta' ? 'ஏற்கப்படுகிறது...' : 'ACCEPTING...'}</span>
                </>
              ) : (
                language === 'ta' ? 'சவாரியை ஏற்கவும்' : 'ACCEPT BOOKING'
              )}
            </button>
          </div>
        </div>

        {/* Low Balance Guard Modal on Ride Request */}
        {showLowBalanceModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-black/10 text-center space-y-4"
            >
              <div className="w-14 h-14 bg-rose-500/10 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#171717]">
                  {language === 'ta' ? 'ரீசார்ஜ் தேவை' : 'Wallet Recharge Required'}
                </h3>
                <p className="text-xs text-[#737373] mt-1.5 leading-relaxed">
                  {language === 'ta'
                    ? 'புதிய சவாரிகளை ஏற்க உங்கள் முன்பண பணப்பையில் குறைந்தபட்சம் ₹50.00 இருப்பு இருக்க வேண்டும்.'
                    : 'You must maintain a minimum wallet balance of ₹50.00 to accept new rides.'}
                </p>
              </div>

              <div className="bg-[#FAFAF8] border border-black/5 rounded-2xl p-3 flex items-center justify-between">
                <span className="text-xs text-[#737373] font-bold">
                  {language === 'ta' ? 'தற்போதைய இருப்பு:' : 'Current Balance:'}
                </span>
                <span className="text-sm font-black text-rose-600">
                  ₹{Number(driverWallet?.balance || 0).toFixed(2)}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowLowBalanceModal(false)}
                  className="flex-1 py-3 bg-black/5 hover:bg-black/10 text-[#737373] font-bold rounded-xl text-xs transition"
                >
                  {language === 'ta' ? 'ரத்து' : 'Dismiss'}
                </button>
                <button
                  onClick={() => {
                    setShowLowBalanceModal(false);
                    setDriverScreen('DRIVER_WALLET');
                    setShowRechargeModal(true);
                  }}
                  className="flex-1 py-3 bg-[#E85D04] hover:bg-[#C2410C] text-white font-extrabold rounded-xl text-xs shadow-lg shadow-[#E85D04]/30 transition"
                >
                  {language === 'ta' ? 'ரீசார்ஜ் செய்க' : 'Recharge Now'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
      </DriverDashboardLayout>
    );
  }

// 48. Trip Details (Accepted Ride) — Ivory Details Screen
  if (driverScreen === 'RIDE_ACCEPTED') {
    const hasActive = Boolean(
      (driverCurrentRide?.id && ['ASSIGNED', 'DRIVER_ASSIGNED', 'EN_ROUTE', 'ARRIVING', 'ARRIVED', 'IN_PROGRESS', 'START_RIDE', 'ACCEPTED'].includes(driverCurrentRide.status)) ||
      (activeBooking?.id && ['ASSIGNED', 'DRIVER_ASSIGNED', 'EN_ROUTE', 'ARRIVING', 'ARRIVED', 'IN_PROGRESS', 'START_RIDE', 'ACCEPTED', 'CONFIRMED'].includes(activeBooking.status))
    );
    if (!hasActive) {
      setTimeout(() => setDriverScreen('DRIVER_HOME'), 0);
      return null;
    }
    const pickedRide = driverCurrentRide || (activeBooking as any) || null;
    const pickupLoc = pickedRide?.locations?.find((l: any) => l.type === 'PICKUP') ||
      (pickedRide?.pickup ? pickedRide.pickup : activeBooking?.pickup);
    const dropLoc = pickedRide?.locations?.find((l: any) => l.type === 'DROP') ||
      (pickedRide?.drop ? pickedRide.drop : activeBooking?.drop);
    const distanceKm = Number(pickedRide?.distance_km ?? pickedRide?.distanceKm ?? activeBooking?.distanceKm ?? 15);
    const rawFare =
      (typeof pickedRide?.fare === 'object' ? (pickedRide?.fare?.total_fare ?? pickedRide?.fare?.totalFare) : pickedRide?.fare) ??
      pickedRide?.total_fare ??
      pickedRide?.totalFare ??
      pickedRide?.fare_amount ??
      (typeof activeBooking?.fare === 'object' ? (activeBooking?.fare?.totalFare ?? activeBooking?.fare?.total_fare) : activeBooking?.fare) ??
      activeBooking?.total_fare ??
      activeBooking?.totalFare ??
      0;
    const fare = Number(rawFare) > 0 ? Number(rawFare) : Math.round(distanceKm * 25 + 50);
    const dutyType = String(pickedRide?.ride_type || activeBooking?.rideType || 'CITY').toUpperCase();
    const paymentMethod = String(pickedRide?.payment_method || activeBooking?.paymentMethod || 'CASH').toUpperCase();
    const bookingId = String(pickedRide?.id || activeBooking?.id || '—');
    const customerName = sanitizeBrandText(pickedRide?.customer_name || activeBooking?.customerName, 'Passenger');
    const payLabel = paymentMethod === 'CASH' ? 'Cash' : paymentMethod === 'CARD' ? 'Card' : paymentMethod === 'UPI' ? 'UPI' : paymentMethod;
    const driverRemarks = pickedRide?.remarks || (activeBooking as any)?.remarks || 'No special remarks for this trip.';
    const isDriverOnly = dutyType === 'DRIVER_ONLY';
    const dutyLabel = dutyType === 'CITY' ? 'Local' : isDriverOnly ? 'Chauffeur' : dutyType;
    const customerVehicle = pickedRide?.customer_vehicle_details || (activeBooking as any)?.customerVehicle || null;

    const infoRows: Array<[string, string, string]> = [
      ['Duty Type', dutyLabel, 'text-[#E85D04]'],
      ['Passenger', customerName, 'text-[#171717]'],
      ['Booking ID', bookingId, 'text-[#171717] font-mono'],
      ['Payment Mode', payLabel, 'text-[#171717]'],
      ['Estimated Fare', `₹${fare}`, 'text-[#E85D04] font-extrabold'],
    ];

    return (
      <DriverDashboardLayout>
        <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] overflow-y-auto">
        {/* Top app bar */}
        <div className="sticky top-0 z-20 bg-white border-b border-black/5 px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => setDriverScreen('DRIVER_HOME')}
            className="w-10 h-10 rounded-full bg-[#FAFAF8] border border-black/5 flex items-center justify-center text-[#171717] hover:bg-black/5 transition min-h-[40px] min-w-[40px]"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base sm:text-lg font-black leading-tight">Trip Details</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDriverChat(true)}
              className="w-9 h-9 bg-[#FAFAF8] hover:bg-[#F0F0EE] border border-[#E5E5E5] rounded-xl flex items-center justify-center text-[#171717] shrink-0 shadow-sm relative transition active:scale-95"
              title="Chat with Passenger"
              aria-label="Chat with Passenger"
            >
              <MessageSquare className="w-4 h-4 text-[#E85D04]" />
              {driverUnreadChatCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#EF4444] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg ring-2 ring-white animate-bounce z-20">
                  {driverUnreadChatCount > 9 ? '9+' : driverUnreadChatCount}
                </span>
              )}
            </button>
            <span className="flex items-center gap-1 bg-[#E85D04]/10 text-[#E85D04] text-[10px] font-extrabold px-2.5 py-1.5 rounded-full uppercase tracking-wide shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Accepted
            </span>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-3.5">
          {/* Duty / Trip information card */}
          <div className="bg-white rounded-[18px] border border-[#E5E5E5] p-4 sm:p-5">
            <span className="text-[10px] text-[#737373] font-bold uppercase tracking-wider block mb-1">Trip Information</span>
            <div>
              {infoRows.map(([label, value, cls], idx) => (
                <div key={label}>
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[12px] text-[#737373] font-medium">{label}</span>
                    <span className={`text-right text-[13px] font-bold truncate max-w-[58%] ${cls}`}>{value}</span>
                  </div>
                  {idx < infoRows.length - 1 && <div className="h-px bg-black/5" />}
                </div>
              ))}
            </div>

            <div className="h-px bg-black/10 my-1" />

            {/* Driver remarks */}
            <div className="pt-3">
              <span className="text-[10px] text-[#737373] font-bold uppercase tracking-wider block mb-1.5">Driver Remarks</span>
              <p className="text-[12px] text-[#737373] leading-relaxed">{driverRemarks}</p>
            </div>
          </div>

          {/* Customer-owned vehicle (Chauffeur / DRIVER ONLY) */}
          {isDriverOnly && (
            <div className="bg-white rounded-[18px] border border-[#E85D04]/40 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl overflow-hidden border border-black/5 bg-[#FFF7F0] shrink-0 flex items-center justify-center text-2xl">
                  {String(customerVehicle?.type || customerVehicle?.vehicle_type || '').toLowerCase().includes('bike') ? '🏍️'
                    : String(customerVehicle?.type || customerVehicle?.vehicle_type || '').toLowerCase().includes('scoot') ? '🛵'
                    : String(customerVehicle?.type || customerVehicle?.vehicle_type || '').toLowerCase().includes('hatch') ? '🚗'
                    : String(customerVehicle?.type || customerVehicle?.vehicle_type || '').toLowerCase().includes('suv') ? '🚙'
                    : '🚘'}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-[#E85D04] font-bold uppercase tracking-wider block">
                    {language === 'ta' ? 'வாடிக்கையாளரின் வாகனம்' : "Customer's Vehicle"}
                  </span>
                  <p className="text-sm font-extrabold truncate">
                    {customerVehicle?.type || customerVehicle?.vehicle_type || customerVehicle?.model || 'Customer Vehicle'}
                    {customerVehicle?.transmission ? ` (${customerVehicle.transmission})` : ''}
                  </p>
                  <p className="text-[11px] text-[#737373] truncate">
                    {customerVehicle?.number ? customerVehicle.number : (language === 'ta' ? 'வாடிக்கையாளர் வாகனம்' : 'Customer-Owned Vehicle')}
                    {customerVehicle?.color ? ` · ${customerVehicle.color}` : ''}
                  </p>
                </div>
                <span className="text-[9px] font-bold text-[#E85D04] bg-[#E85D04]/10 px-2.5 py-1 rounded-full uppercase shrink-0">
                  {language === 'ta' ? 'ஆக்டிவ் டிரைவர்' : 'Acting Driver'}
                </span>
              </div>
            </div>
          )}

          {/* Route card */}
          <div className="bg-white rounded-[18px] border border-[#E5E5E5] p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-[#737373] font-bold uppercase tracking-wider">Route</span>
              <span className="text-[11px] font-extrabold text-[#171717] bg-[#FAFAF8] rounded-full px-2.5 py-1">
                {distanceKm ? `${distanceKm} km` : 'Local'}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 py-0.5">
                <span className="w-3 h-3 rounded-full bg-[#22A06B] border-[3px] border-[#22A06B]/25 shrink-0" />
                <span className="w-0.5 flex-1 border-l-2 border-dashed border-black/15" />
                <span className="w-3 h-3 rounded-full bg-[#DC2626] border-[3px] border-[#DC2626]/25 shrink-0" />
              </div>
              <div className="flex-1 space-y-4 py-0.5 min-w-0">
                <div>
                  <span className="text-[9px] text-[#737373] font-bold uppercase tracking-wider block">Pickup</span>
                  <p className="text-sm font-bold truncate">{pickupLoc?.name || activeBooking?.pickup?.name || 'Pickup Location'}</p>
                  {(pickupLoc?.address || activeBooking?.pickup?.address) ? (
                    <p className="text-[11px] text-[#737373] truncate">{pickupLoc?.address || activeBooking?.pickup?.address}</p>
                  ) : null}
                </div>
                <div>
                  <span className="text-[9px] text-[#737373] font-bold uppercase tracking-wider block">Drop</span>
                  <p className="text-sm font-bold truncate">{dropLoc?.name || activeBooking?.drop?.name || 'Drop Location'}</p>
                  {(dropLoc?.address || activeBooking?.drop?.address) ? (
                    <p className="text-[11px] text-[#737373] truncate">{dropLoc?.address || activeBooking?.drop?.address}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Primary action */}
        <div className="sticky bottom-0 bg-[#FAFAF8] px-4 sm:px-5 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] mt-auto">
          <button
            onClick={() => {
              const rideId = driverCurrentRide?.id || activeBooking?.id;
              if (rideId) {
                driverApi.updateRideStatus(rideId, 'EN_ROUTE').catch(() => {});
              }
              if (!driverCurrentRide && activeBooking) {
                setDriverCurrentRide(activeBooking as any);
              }
              setDriverScreen('ARRIVING');
            }}
            className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-extrabold py-3.5 rounded-[14px] shadow shadow-[#E85D04]/20 min-h-[50px] flex items-center justify-center gap-2 text-sm transition active:scale-[0.98]"
          >
            <Navigation className="w-4 h-4" />
            START NAVIGATION
          </button>
        </div>
      </div>
      {renderDriverChatModal()}
      </DriverDashboardLayout>
    );
  }

  // 49. Navigate to Pickup (White Theme)
  if (driverScreen === 'ARRIVING') {
    const hasActive = Boolean(
      (driverCurrentRide?.id && ['ASSIGNED', 'DRIVER_ASSIGNED', 'EN_ROUTE', 'ARRIVING', 'ARRIVED', 'IN_PROGRESS', 'START_RIDE', 'ACCEPTED'].includes(driverCurrentRide.status)) ||
      (activeBooking?.id && ['ASSIGNED', 'DRIVER_ASSIGNED', 'EN_ROUTE', 'ARRIVING', 'ARRIVED', 'IN_PROGRESS', 'START_RIDE', 'ACCEPTED', 'CONFIRMED'].includes(activeBooking.status))
    );
    if (!hasActive) {
      setTimeout(() => setDriverScreen('DRIVER_HOME'), 0);
      return null;
    }
    const pickupLoc = driverCurrentRide?.locations?.find((l: any) => l.type === 'PICKUP') ||
      (driverCurrentRide?.pickup ? driverCurrentRide.pickup : activeBooking?.pickup);
    const pickupName = pickupLoc?.name || activeBooking?.pickup?.name || 'Pickup Location';
    const customerPhone = driverCurrentRide?.customer_phone || activeBooking?.customerPhone || '';

    return (
      <DriverDashboardLayout>
        <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] relative">
          <InteractiveMap pickup={pickupLoc || activeBooking?.pickup} showNearbyDrivers={false} height="h-full" forceLight={true} />

          <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-4 z-20 bg-white border border-[#E5E5E5] p-4 sm:p-5 rounded-3xl shadow-2xl space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3 gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-[#E85D04] font-extrabold uppercase tracking-wide block">
                  {language === 'ta' ? 'ஏறும் இடம் நோக்கி வழிகாட்டுகிறது' : 'Navigating to Pickup'}
                </span>
                <h4 className="text-sm font-extrabold text-[#171717] truncate mt-0.5">{pickupName}</h4>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowDriverChat(true)}
                  className="w-10 h-10 bg-[#FAFAF8] hover:bg-[#F0F0EE] border border-[#E5E5E5] rounded-xl flex items-center justify-center text-[#171717] shrink-0 min-h-[40px] min-w-[40px] shadow-sm relative transition active:scale-95"
                  title="Chat with Passenger"
                  aria-label="Chat with Passenger"
                >
                  <MessageSquare className="w-4 h-4 text-[#E85D04]" />
                  {driverUnreadChatCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#EF4444] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg ring-2 ring-white animate-bounce z-20">
                      {driverUnreadChatCount > 9 ? '9+' : driverUnreadChatCount}
                    </span>
                  )}
                </button>
                <a href={`tel:${customerPhone}`} className="w-10 h-10 bg-[#22A06B] hover:bg-[#1B8357] rounded-xl flex items-center justify-center text-white shrink-0 min-h-[40px] min-w-[40px] shadow-sm">
                  <Phone className="w-4 h-4" />
                </a>
              </div>
            </div>

            {arrivedError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center">
                {arrivedError}
              </div>
            )}

            <button
              onClick={async () => {
                setArrivedError('');
                const pLat = pickupLoc?.lat ? Number(pickupLoc.lat) : undefined;
                const pLng = pickupLoc?.lng ? Number(pickupLoc.lng) : undefined;

                // Geofence check: verify physical distance using real GPS
                if (pLat && pLng && navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                      const dLat = pos.coords.latitude;
                      const dLng = pos.coords.longitude;
                      // Haversine distance in meters
                      const R = 6371e3;
                      const dPhi = (pLat - dLat) * Math.PI / 180;
                      const dLambda = (pLng - dLng) * Math.PI / 180;
                      const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) +
                                Math.cos(dLat * Math.PI / 180) * Math.cos(pLat * Math.PI / 180) *
                                Math.sin(dLambda/2) * Math.sin(dLambda/2);
                      const distMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));

                      if (distMeters > 100) {
                        setArrivedError(`⚠️ You are ${distMeters > 1000 ? (distMeters/1000).toFixed(1) + 'km' : distMeters + 'm'} away from customer pickup. Move within 100m to mark arrived.`);
                        return;
                      }

                      const res = await driverArrivedAtPickup({ lat: dLat, lng: dLng, is_test: false });
                      if (res && !res.success) {
                        setArrivedError(res.message || 'Distance check failed. Move closer to customer pickup point.');
                      }
                    },
                    async () => {
                      // Fallback if GPS hardware permission denied
                      const res = await driverArrivedAtPickup({ lat: pLat, lng: pLng, is_test: true });
                      if (res && !res.success) setArrivedError(res.message || 'Distance check failed.');
                    },
                    { enableHighAccuracy: true, timeout: 5000 }
                  );
                } else {
                  const res = await driverArrivedAtPickup({ lat: pLat, lng: pLng, is_test: true });
                  if (res && !res.success) setArrivedError(res.message || 'Distance check failed.');
                }
              }}
              className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-[#E85D04]/25 min-h-[48px] text-xs sm:text-sm transition active:scale-98"
            >
              {language === 'ta' ? 'ஏறும் இடத்தை அடைந்துவிட்டேன்' : 'ARRIVED AT PICKUP LOCATION'}
            </button>

            <button
              type="button"
              onClick={async () => {
                setArrivedError('');
                const pLat = pickupLoc?.lat ? Number(pickupLoc.lat) : 11.6643;
                const pLng = pickupLoc?.lng ? Number(pickupLoc.lng) : 78.1460;
                await driverArrivedAtPickup({ lat: pLat, lng: pLng, is_test: true });
              }}
              className="w-full text-center text-xs font-bold text-[#737373] hover:text-[#E85D04] py-1 transition underline cursor-pointer"
            >
              ⚡ Demo Arrive (Client Showcase / Indoor Test)
            </button>
          </div>
        </div>
        {renderDriverChatModal()}
      </DriverDashboardLayout>
    );
  }

  // 50. Customer Arrived & OTP Entry Screen (White Theme)
  if (driverScreen === 'ARRIVED') {
    const hasActive = Boolean(
      (driverCurrentRide?.id && ['ASSIGNED', 'DRIVER_ASSIGNED', 'EN_ROUTE', 'ARRIVING', 'ARRIVED', 'IN_PROGRESS', 'START_RIDE', 'ACCEPTED'].includes(driverCurrentRide.status)) ||
      (activeBooking?.id && ['ASSIGNED', 'DRIVER_ASSIGNED', 'EN_ROUTE', 'ARRIVING', 'ARRIVED', 'IN_PROGRESS', 'START_RIDE', 'ACCEPTED', 'CONFIRMED'].includes(activeBooking.status))
    );
    if (!hasActive) {
      setTimeout(() => setDriverScreen('DRIVER_HOME'), 0);
      return null;
    }
    return (
      <DriverDashboardLayout>
        <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-5 sm:p-7 overflow-y-auto relative">
          <div>
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <h2 className="text-xl sm:text-2xl font-black mb-1">
                  {language === 'ta' ? 'பயணி காத்திருக்கிறார்' : 'Customer Waiting'}
                </h2>
                <p className="text-xs text-[#737373]">
                  {language === 'ta' ? 'பயணத்தைத் தொடங்க 4-இலக்க OTP எண்ணை பயணியிடம் கேட்கவும்' : 'Ask customer for the 4-digit start OTP to begin trip'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowDriverChat(true)}
                  className="w-10 h-10 bg-white hover:bg-[#F0F0EE] border border-[#E5E5E5] rounded-xl flex items-center justify-center text-[#171717] shrink-0 shadow-sm relative transition active:scale-95"
                  title="Chat with Passenger"
                  aria-label="Chat with Passenger"
                >
                  <MessageSquare className="w-4 h-4 text-[#E85D04]" />
                  {driverUnreadChatCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#EF4444] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg ring-2 ring-white animate-bounce z-20">
                      {driverUnreadChatCount > 9 ? '9+' : driverUnreadChatCount}
                    </span>
                  )}
                </button>
                {(driverCurrentRide?.customer_phone || activeBooking?.customerPhone) && (
                  <a
                    href={`tel:${driverCurrentRide?.customer_phone || activeBooking?.customerPhone}`}
                    className="w-10 h-10 bg-[#22A06B] hover:bg-[#1B8357] rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm transition active:scale-95"
                    aria-label="Call Passenger"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Acting Driver Vehicle Inspection Card */}
            {(() => {
              const isDriverOnlyDuty = String(driverCurrentRide?.ride_type || activeBooking?.rideType || '').toUpperCase() === 'DRIVER_ONLY';
              const vehReg = (driverCurrentRide?.vehicle_reg_no || activeBooking?.vehicleNumber || '').trim();
              const isConfirmedByDriver = Boolean(driverCurrentRide?.driver_vehicle_confirmed || activeBooking?.driverVehicleConfirmed);
              const isMismatchReported = Boolean(driverCurrentRide?.driver_mismatch_reported || activeBooking?.driverMismatchReported);
              const mismatchReason = driverCurrentRide?.driver_mismatch_reason || activeBooking?.driverMismatchReason || '';

              if (!isDriverOnlyDuty) return null;

              return (
                <div className="bg-white border-2 border-[#E85D04]/30 rounded-3xl p-4 sm:p-5 space-y-3 shadow-xs mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#E85D04] font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Car className="w-4 h-4" />
                      Customer Vehicle Inspection
                    </span>
                    {isConfirmedByDriver && (
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-200">
                        Verified Match ✓
                      </span>
                    )}
                  </div>

                  {!vehReg ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Passenger Vehicle Details Pending</span>
                      </div>
                      <p className="text-[11px] text-amber-700">
                        Customer has not yet submitted vehicle registration number. You cannot start the trip until passenger enters their vehicle details.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between bg-[#FAFAF8] p-2.5 rounded-xl border border-black/5">
                        <div>
                          <span className="text-[9px] text-[#737373] uppercase font-bold block">Vehicle Number</span>
                          <span className="font-mono font-black text-sm text-[#171717]">{vehReg}</span>
                        </div>
                        {isConfirmedByDriver ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                            ✓ Confirmed by You
                          </span>
                        ) : isMismatchReported ? (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                            ⚠️ Mismatch Reported
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Pending Confirmation
                          </span>
                        )}
                      </div>

                      {isMismatchReported && (
                        <p className="text-[11px] text-rose-600 font-bold bg-rose-50 p-2 rounded-xl border border-rose-200">
                          ⚠️ Discrepancy reported: "{mismatchReason}". Service start blocked until resolved.
                        </p>
                      )}

                      {/* Driver Confirmation Actions */}
                      {!isConfirmedByDriver && !isMismatchReported && !isReportingMismatch && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              const rideId = driverCurrentRide?.id || activeBooking?.id;
                              const res = await confirmDriverVehicle(rideId);
                              if (res.success) {
                                setDriverVehicleActionMsg('✓ Vehicle physically confirmed!');
                                setTimeout(() => setDriverVehicleActionMsg(null), 3000);
                              }
                            }}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirm Vehicle Matches</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsReportingMismatch(true)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold py-2 px-3 rounded-xl text-xs transition active:scale-95"
                          >
                            <span>Report Mismatch</span>
                          </button>
                        </div>
                      )}

                      {/* Mismatch Reporting Form */}
                      {isReportingMismatch && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                          <label className="text-[10px] text-rose-800 font-bold uppercase block">
                            Describe Discrepancy (e.g. plate does not match car)
                          </label>
                          <input
                            type="text"
                            value={mismatchReasonInput}
                            onChange={(e) => setMismatchReasonInput(e.target.value)}
                            placeholder="e.g. Physical plate number is different"
                            className="w-full bg-white border border-rose-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none text-[#171717]"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!mismatchReasonInput.trim()) return;
                                const rideId = driverCurrentRide?.id || activeBooking?.id;
                                await reportDriverVehicleMismatch(mismatchReasonInput.trim(), rideId);
                                setIsReportingMismatch(false);
                              }}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-xs"
                            >
                              Submit Mismatch
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsReportingMismatch(false)}
                              className="text-xs text-[#737373] hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {driverVehicleActionMsg && (
                        <p className="text-emerald-700 text-[10px] font-bold">{driverVehicleActionMsg}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="bg-white border border-[#E5E5E5] rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm mb-4 mt-4">
              <label className="text-xs text-[#737373] font-bold uppercase block text-center">
                {language === 'ta' ? 'தொடக்க OTP உள்ளிடவும்' : 'ENTER START OTP'}
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                value={otpInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setOtpInput(val);
                  if (otpError) setOtpError('');
                }}
                placeholder="••••"
                className="w-full bg-[#FAFAF8] border-2 border-[#E85D04] rounded-2xl py-3 text-center text-2xl sm:text-3xl font-black text-[#E85D04] tracking-widest outline-none shadow-inner placeholder-[#D4D4D4]"
              />
              {otpError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center py-2 px-3 rounded-xl">
                  {otpError}
                </div>
              )}
              <p className="text-[11px] text-[#737373] text-center mt-1">
                {language === 'ta' ? 'பயணியிடம் 4-இலக்க தொடக்க OTP எண்ணைக் கேட்டு உள்ளிடவும்' : 'Ask the passenger for the 4-digit start OTP shown on their screen'}
              </p>
            </div>
          </div>

          {(() => {
            const isDriverOnlyDuty = String(driverCurrentRide?.ride_type || activeBooking?.rideType || '').toUpperCase() === 'DRIVER_ONLY';
            const vehReg = (driverCurrentRide?.vehicle_reg_no || activeBooking?.vehicleNumber || '').trim();
            const isMismatchReported = Boolean(driverCurrentRide?.driver_mismatch_reported || activeBooking?.driverMismatchReported);
            const canStart = !isDriverOnlyDuty || (Boolean(vehReg) && !isMismatchReported);
            const isOtpReady = otpInput.trim().length === 4;

            return (
              <button
                disabled={!canStart || !isOtpReady || isVerifyingOtp}
                onClick={async () => {
                  if (!canStart) {
                    setOtpError('Vehicle details required and verified before starting trip');
                    return;
                  }
                  if (!isOtpReady) {
                    setOtpError('Please enter all 4 digits of the start OTP');
                    return;
                  }
                  setOtpError('');
                  setIsVerifyingOtp(true);
                  try {
                    const res = await startTripWithOtp(otpInput.trim());
                    if (!res.success) {
                      setOtpError(res.message);
                    }
                  } finally {
                    setIsVerifyingOtp(false);
                  }
                }}
                className={`w-full font-extrabold py-4 rounded-2xl shadow-lg text-xs sm:text-sm min-h-[48px] transition active:scale-98 flex items-center justify-center gap-2 ${
                  canStart && isOtpReady && !isVerifyingOtp
                    ? 'bg-[#E85D04] hover:bg-[#C2410C] text-white shadow-[#E85D04]/25 cursor-pointer'
                    : 'bg-black/10 text-[#A3A3A3] cursor-not-allowed shadow-none'
                }`}
              >
                {isVerifyingOtp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>VERIFYING OTP...</span>
                  </>
                ) : !canStart ? (
                  (!vehReg ? 'PASSENGER VEHICLE REGISTRATION REQUIRED' : 'RESOLVE VEHICLE MISMATCH TO START')
                ) : (
                  language === 'ta' ? 'OTP சரிபார்த்து பயணத்தைத் தொடங்கு' : 'VERIFY OTP & START TRIP'
                )}
              </button>
            );
          })()}
        </div>
        {renderDriverChatModal()}
      </DriverDashboardLayout>
    );
  }

// 51. Active Local Trip (Trip In Progress)
  if (driverScreen === 'START_RIDE') {
    const hasActive = Boolean(
      (driverCurrentRide?.id && ['IN_PROGRESS', 'START_RIDE', 'STARTED'].includes(driverCurrentRide.status)) ||
      (activeBooking?.id && ['IN_PROGRESS', 'START_RIDE', 'STARTED'].includes(activeBooking.status))
    );
    if (!hasActive) {
      setTimeout(() => setDriverScreen('DRIVER_HOME'), 0);
      return null;
    }
    const pickupLoc = driverCurrentRide?.locations?.find((l: any) => l.type === 'PICKUP') ||
      (driverCurrentRide?.pickup ? driverCurrentRide.pickup : activeBooking?.pickup);
    const dropLoc = driverCurrentRide?.locations?.find((l: any) => l.type === 'DROP') ||
      (driverCurrentRide?.drop ? driverCurrentRide.drop : activeBooking?.drop);
    const dropName = dropLoc?.name || activeBooking?.drop?.name || 'Destination';
    const customerName = sanitizeBrandText(driverCurrentRide?.customer_name || activeBooking?.customerName, 'Passenger');
    const durationMin = driverCurrentRide?.duration_min ?? activeBooking?.durationMin ?? 24;

    return (
      <DriverDashboardLayout>
        <div className="h-full flex flex-col bg-[#171717] relative overflow-hidden">
        {/* Full-screen live map */}
        <InteractiveMap pickup={pickupLoc} drop={dropLoc} progress={simulatedProgress} height="h-full" forceLight={true} />
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/20 via-transparent to-black/45 pointer-events-none" />

        {/* Top floating header */}
        <div className="absolute top-3 sm:top-4 left-3 right-3 z-20 flex items-center justify-between gap-2">
          <div className="w-10" />
          <div className="bg-white rounded-full px-4 py-2 shadow-md border border-black/5 flex items-center gap-2 pointer-events-none">
            <span className="relative w-2 h-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22A06B] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22A06B]" />
            </span>
            <span className="text-sm font-black text-[#171717]">
              {language === 'ta' ? 'பயணம் நடைபெறுகிறது' : 'Local Trip'}
            </span>
          </div>
        </div>

        {/* Bottom floating stack: GPS + customer panel + End Trip */}
        <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col gap-2.5 px-3 sm:px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {/* Current location / GPS control */}
          <div className="flex justify-end">
            <div className="w-11 h-11 rounded-full bg-white shadow-md border border-black/5 flex items-center justify-center text-[#171717]">
              <Locate className="w-5 h-5" />
            </div>
          </div>

          {/* Customer panel */}
          <div className="bg-white rounded-[18px] shadow-[0_4px_24px_rgba(0,0,0,0.14)] px-3.5 sm:px-4 py-3 flex items-center justify-between gap-3 border border-black/5">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] mt-1.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-[9px] text-[#737373] font-bold uppercase tracking-wider block">
                  {language === 'ta' ? 'இறங்கும் இடம்' : 'Drop Location'}
                </span>
                <p className="text-sm font-black text-[#171717] truncate">{dropName}</p>
                <p className="text-[11px] text-[#737373] font-medium truncate">
                  {customerName} • {language === 'ta' ? 'பயணி' : 'Onboard'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowDriverChat(true)}
                className="w-9 h-9 bg-[#FAFAF8] hover:bg-[#F0F0EE] border border-[#E5E5E5] rounded-xl flex items-center justify-center text-[#171717] shrink-0 shadow-sm relative transition active:scale-95"
                title="Chat with Passenger"
                aria-label="Chat with Passenger"
              >
                <MessageSquare className="w-4 h-4 text-[#E85D04]" />
                {driverUnreadChatCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#EF4444] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg ring-2 ring-white animate-bounce z-20">
                    {driverUnreadChatCount > 9 ? '9+' : driverUnreadChatCount}
                  </span>
                )}
              </button>
              {(driverCurrentRide?.customer_phone || activeBooking?.customerPhone) && (
                <a
                  href={`tel:${driverCurrentRide?.customer_phone || activeBooking?.customerPhone}`}
                  className="w-9 h-9 bg-[#22A06B] hover:bg-[#1B8357] rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm transition active:scale-95"
                  aria-label="Call Passenger"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
              <div className="text-right shrink-0 bg-[#FAFAF8] border border-black/5 rounded-xl px-2.5 py-1.5">
                <span className="text-[8px] text-[#737373] font-bold uppercase tracking-wider block">
                  {language === 'ta' ? 'நேரம்' : 'Est.'}
                </span>
                <span className="text-xs font-black text-[#171717] leading-tight">{durationMin}m</span>
              </div>
            </div>
          </div>

          {/* End Trip CTA with 150m Geofence & Early Drop Guard */}
          <button
            disabled={isEndingTrip}
            onClick={async () => {
              if (isEndingTrip) return;

              const dLat = dropLoc?.lat ? Number(dropLoc.lat) : undefined;
              const dLng = dropLoc?.lng ? Number(dropLoc.lng) : undefined;

              // Distance check to dropoff
              if (dLat && dLng && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  async (pos) => {
                    const curLat = pos.coords.latitude;
                    const curLng = pos.coords.longitude;
                    const R = 6371e3;
                    const dPhi = (dLat - curLat) * Math.PI / 180;
                    const dLambda = (dLng - curLng) * Math.PI / 180;
                    const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) +
                              Math.cos(curLat * Math.PI / 180) * Math.cos(dLat * Math.PI / 180) *
                              Math.sin(dLambda/2) * Math.sin(dLambda/2);
                    const distMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));

                    if (distMeters > 150) {
                      const earlyDropConfirm = window.confirm(
                        `⚠️ You are ${distMeters > 1000 ? (distMeters/1000).toFixed(1) + 'km' : distMeters + 'm'} away from destination.\n\nDid the passenger request an Early Drop-off here?`
                      );
                      if (!earlyDropConfirm) return;
                    }

                    setIsEndingTrip(true);
                    try {
                      const res = await completeCurrentTrip({ lat: curLat, lng: curLng, is_test: false });
                      if (res && !res.success) alert(res.message || 'Unable to end trip. Please try again.');
                    } catch (err: any) {
                      alert(err?.message || 'Error ending trip');
                    } finally {
                      setIsEndingTrip(false);
                    }
                  },
                  async () => {
                    // Fallback
                    setIsEndingTrip(true);
                    try {
                      const res = await completeCurrentTrip({ lat: dLat, lng: dLng, is_test: true });
                      if (res && !res.success) alert(res.message || 'Unable to end trip.');
                    } finally {
                      setIsEndingTrip(false);
                    }
                  },
                  { enableHighAccuracy: true, timeout: 5000 }
                );
              } else {
                setIsEndingTrip(true);
                try {
                  const res = await completeCurrentTrip({ lat: dLat, lng: dLng, is_test: true });
                  if (res && !res.success) alert(res.message || 'Unable to end trip.');
                } finally {
                  setIsEndingTrip(false);
                }
              }
            }}
            className={`w-full font-extrabold py-3.5 rounded-[14px] shadow-md shadow-[#E85D04]/25 min-h-[50px] text-sm transition active:scale-[0.98] flex items-center justify-center gap-2 ${
              isEndingTrip
                ? 'bg-[#E85D04]/75 text-white cursor-wait'
                : 'bg-[#E85D04] hover:bg-[#C2410C] text-white'
            }`}
          >
            {isEndingTrip ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>{language === 'ta' ? 'முடிக்கப்படுகிறது...' : 'ENDING TRIP...'}</span>
              </>
            ) : (
              language === 'ta' ? 'பயணத்தை முடிக்க' : 'END TRIP'
            )}
          </button>
        </div>
      </div>
      {renderDriverChatModal()}
      </DriverDashboardLayout>
    );
  }

  if (driverScreen === 'COMPLETE_RIDE') {
    const targetRide = lastCompletedRide || driverCurrentRide || activeBooking || (() => {
      try {
        const cached = localStorage.getItem('last_completed_ride_backup');
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    })();

    const rawTotalFare =
      targetRide?.total_fare ??
      targetRide?.totalFare ??
      targetRide?.fare_amount ??
      (typeof targetRide?.fare === 'object' ? (targetRide?.fare?.total_fare ?? targetRide?.fare?.totalFare) : targetRide?.fare) ??
      targetRide?.fare_breakdown?.total_fare ??
      (typeof activeBooking?.fare === 'object' ? (activeBooking?.fare?.totalFare ?? activeBooking?.fare?.total_fare) : activeBooking?.fare) ??
      activeBooking?.total_fare ??
      activeBooking?.totalFare ??
      0;

    const finalTotalFare = Math.round(Number(rawTotalFare));
    const finalEarnings = Number(targetRide?.driver_earnings ?? targetRide?.driverEarnings ?? Math.round(finalTotalFare * 0.85));
    const finalCommission = Number(targetRide?.commission ?? Math.round(finalTotalFare * 0.15));
    const finalPaymentMethod = String(targetRide?.payment_method || targetRide?.paymentMethod || activeBooking?.paymentMethod || 'CASH').toUpperCase();
    const paymentLabel =
      finalPaymentMethod === 'CASH'
        ? (language === 'ta' ? 'ரொக்கம்' : 'Cash')
        : finalPaymentMethod === 'CARD'
          ? (language === 'ta' ? 'அட்டை' : 'Card')
          : finalPaymentMethod === 'UPI'
            ? 'UPI'
            : finalPaymentMethod === 'WALLET'
              ? (language === 'ta' ? 'பணப்பை' : 'Wallet')
              : finalPaymentMethod;

    const pickupName = targetRide?.pickup?.name || targetRide?.locations?.find((l: any) => l.type === 'PICKUP')?.name || activeBooking?.pickup?.name;
    const dropName = targetRide?.drop?.name || targetRide?.locations?.find((l: any) => l.type === 'DROP' || l.type === 'DROPOFF')?.name || activeBooking?.drop?.name;
    const dist = targetRide?.distance_km ?? targetRide?.distanceKm ?? activeBooking?.distanceKm;
    const dur = targetRide?.duration_min ?? targetRide?.durationMin ?? activeBooking?.durationMin;

    const tripSummary: Array<[string, string]> = [];
    if (pickupName) tripSummary.push([language === 'ta' ? 'ஏறும் இடம்' : 'Pickup', pickupName]);
    if (dropName) tripSummary.push([language === 'ta' ? 'இறங்கும் இடம்' : 'Drop', dropName]);
    if (dist != null && Number(dist) > 0) tripSummary.push([language === 'ta' ? 'தொலைவு' : 'Distance', `${dist} km`]);
    if (dur != null && Number(dur) > 0) tripSummary.push([language === 'ta' ? 'பயண நேரம்' : 'Duration', `${dur} min`]);

    return (
      <DriverDashboardLayout>
        <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] px-4 sm:px-5 overflow-y-auto pb-10">
        <div className="flex-1">
          {/* Success section */}
          <div className="flex flex-col items-center text-center mt-8 sm:mt-10">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#22A06B]/10 border-[5px] border-[#22A06B]/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-[#22A06B]" />
            </div>
            <h2 className="text-xl sm:text-[22px] font-semibold text-[#171717]">
              {language === 'ta' ? 'பயணம் வெற்றிகரமாக நிறைவடைந்தது' : 'Trip Completed Successfully'}
            </h2>
            <p className="text-xs text-[#737373] font-medium mt-1.5">
              {language === 'ta' ? 'பயணியிடம் கட்டணத்தைப் பெறவும்' : 'Please collect the fare from the customer'}
            </p>
          </div>

          {/* Fare card */}
          <div className="bg-white rounded-[18px] border border-[#E5E5E5] shadow-sm p-5 sm:p-6 mt-7 text-center">
            <div className="text-[32px] sm:text-[34px] font-bold text-[#171717] leading-none">₹{finalTotalFare}</div>
            <span className="inline-flex items-center justify-center gap-1.5 mt-2 text-[10px] text-[#737373] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E85D04]" />
              {language === 'ta' ? 'பயண கட்டணம்' : 'Ride Fare'}
            </span>
          </div>

          {/* Optional trip summary (only existing data) */}
          {tripSummary.length > 0 && (
            <div className="bg-white rounded-[18px] border border-[#E5E5E5] shadow-sm mt-3.5 divide-y divide-black/5">
              {tripSummary.map(([label, value]) => (
                <div key={label} className="px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-[#737373] font-medium">{label}</span>
                  <span className="text-[12px] font-bold text-[#171717] truncate max-w-[60%]">{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Payment information */}
          <div className="bg-white rounded-[18px] border border-[#E5E5E5] shadow-sm mt-3.5 px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
            <span className="text-[11px] text-[#737373] font-medium">{language === 'ta' ? 'பணம் செலுத்தும் முறை' : 'Payment Method'}</span>
            <span className="text-[12px] font-extrabold text-[#171717] uppercase">{paymentLabel}</span>
          </div>

          {/* Earnings breakdown */}
          <div className="bg-white rounded-[18px] border border-[#E5E5E5] shadow-sm mt-3.5 px-4 sm:px-5 py-3.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#737373]">{language === 'ta' ? 'ஓட்டுநர் நிகர வருவாய்' : 'Driver Earnings (Net)'}</span>
              <span className="font-extrabold text-[#171717]">₹{finalEarnings}</span>
            </div>
            <div className="flex items-center justify-between border-t border-black/5 mt-2 pt-2">
              <span className="text-[#737373]">{language === 'ta' ? 'ஜிட்டா கமிஷன் (15%)' : 'Jitta Drives Commission (15%)'}</span>
              <span className="font-bold text-[#737373]">₹{finalCommission}</span>
            </div>
          </div>

          {/* Collect Cash secondary action */}
          <div className="w-full bg-white border-2 border-[#E85D04] text-[#E85D04] font-extrabold py-3 rounded-[14px] flex items-center justify-center gap-2 text-sm min-h-[48px] mt-3.5">
            <Banknote className="w-4 h-4" />
            {language === 'ta' ? 'ரொக்கம் பெறவும்' : 'COLLECT CASH'}
          </div>
        </div>

        {/* Cash Received primary CTA */}
        <div className="pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <button
            onClick={() => {
              try {
                localStorage.removeItem('last_completed_ride_backup');
              } catch {}
              setActiveBooking?.(null);
              setDriverCurrentRide?.(null);
              setLastCompletedRide?.(null);
              setDriverScreen('DRIVER_HOME');
            }}
            className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-extrabold py-3.5 rounded-[14px] shadow shadow-[#E85D04]/20 min-h-[52px] text-sm transition active:scale-[0.98]"
          >
            {language === 'ta' ? 'பணம் பெறப்பட்டது' : 'CASH RECEIVED'}
          </button>
        </div>
      </div>
      </DriverDashboardLayout>
    );
  }

// 53A. Driver Prepaid Wallet Screen (Live from MySQL /driver/wallet & /driver/wallet/recharge)
  if (driverScreen === 'DRIVER_WALLET') {
    const balance = driverWallet ? Number(driverWallet.balance) : 0;
    const todayEarn = driverWallet ? Number(driverWallet.todayEarnings) : 0;
    const todayTrips = driverWallet ? Number(driverWallet.todayTrips) : 0;
    const txs: any[] = driverWallet?.transactions || [];
    const isLowBalance = balance <= 100;
    const isCriticalBalance = balance < 50;

    const fmtDate = (d: string | undefined) => {
      if (!d) return 'Recently';
      const t = new Date(d);
      if (isNaN(t.getTime())) return d;
      return t.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    };

    return (
      <DriverDashboardLayout>
        <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] overflow-y-auto font-sans">
          {/* Top Bar */}
          <div className="sticky top-0 z-20 bg-white border-b border-black/5 px-4 sm:px-5 py-3 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDriverScreen('DRIVER_HOME')}
                aria-label="Back to dashboard"
                className="w-9 h-9 rounded-full bg-[#FAFAF8] border border-black/5 flex items-center justify-center text-[#171717] hover:bg-black/5 transition min-h-[36px] min-w-[36px]"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-bold leading-tight">
                  {language === 'ta' ? 'ஓட்டுநர் முன்பண பணப்பை' : 'Driver Prepaid Wallet'}
                </h2>
                <span className="text-[10px] text-[#737373] font-medium">
                  {language === 'ta' ? 'ரீசார்ஜ் மற்றும் பயண வருவாய்' : 'Recharge & Trip Earnings Ledger'}
                </span>
              </div>
            </div>
            <button
              onClick={refreshDriverWallet}
              className="w-9 h-9 rounded-full bg-[#FAFAF8] border border-black/5 flex items-center justify-center text-[#171717] hover:bg-black/5 transition min-h-[36px] min-w-[36px]"
              title="Refresh wallet"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 sm:px-5 py-4 space-y-4 max-w-2xl mx-auto w-full">
            {/* Prepaid Wallet Balance Card */}
            <div className="bg-linear-to-br from-[#E85D04] to-[#C2410C] rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-[#E85D04]/20 relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-xs">
                      {language === 'ta' ? 'முன்பண கணக்கு' : 'Prepaid Account'}
                    </span>
                    {isCriticalBalance ? (
                      <span className="text-[10px] font-extrabold bg-rose-900/60 text-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {language === 'ta' ? 'முக்கியக் குறைவு (< ₹50)' : 'Critical (< ₹50)'}
                      </span>
                    ) : isLowBalance ? (
                      <span className="text-[10px] font-extrabold bg-amber-900/60 text-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {language === 'ta' ? 'குறைந்த இருப்பு' : 'Low Balance'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold bg-emerald-900/50 text-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {language === 'ta' ? 'பயணங்களுக்கு தயார்' : 'Ready for Rides'}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-orange-100 font-semibold block mt-3">
                    {language === 'ta' ? 'கிடைக்கக்கூடிய இருப்பு' : 'Available Balance'}
                  </span>
                  <div className="text-3xl sm:text-4xl font-black mt-0.5 leading-none">₹{balance.toFixed(2)}</div>
                </div>

                <button
                  disabled={balance > 100}
                  onClick={() => {
                    if (balance > 100) return;
                    setRechargeFeedback(null);
                    setShowRechargeModal(true);
                  }}
                  title={balance > 100 ? 'Recharge is enabled only when wallet balance is low (≤ ₹100)' : 'Recharge driver wallet'}
                  className={`font-black text-xs px-4 py-2.5 rounded-2xl shadow-lg transition flex items-center gap-1.5 shrink-0 ${
                    balance <= 100
                      ? 'bg-white text-[#E85D04] hover:bg-orange-50 active:scale-95 cursor-pointer'
                      : 'bg-white/40 text-white/70 cursor-not-allowed opacity-80'
                  }`}
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  {language === 'ta' ? 'ரீசார்ஜ்' : 'Recharge'}
                </button>
              </div>

              {isCriticalBalance ? (
                <div className="mt-4 p-2.5 rounded-xl bg-black/20 text-rose-100 text-[11px] flex items-center gap-2 border border-rose-300/20">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-300" />
                  <span>
                    {language === 'ta'
                      ? 'கட்டாய ரீசார்ஜ்: இருப்பு ₹50க்கு குறைவாக உள்ளது! சவாரிகளை ஏற்க ரீசார்ஜ் செய்யவும்.'
                      : 'Mandatory Recharge: Balance is below ₹50! You cannot accept rides until recharged.'}
                  </span>
                </div>
              ) : isLowBalance ? (
                <div className="mt-4 p-2.5 rounded-xl bg-black/20 text-amber-100 text-[11px] flex items-center gap-2 border border-amber-300/20">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-300" />
                  <span>
                    {language === 'ta'
                      ? 'குறைந்த இருப்பு எச்சரிக்கை: உங்கள் இருப்பு ₹100க்கு குறைவாக உள்ளது. முன்கூட்டியே ரீசார்ஜ் செய்யவும்.'
                      : 'Low balance warning: Wallet is below ₹100. Recharge now to avoid ride acceptance blocks.'}
                  </span>
                </div>
              ) : (
                <div className="mt-4 p-2.5 rounded-xl bg-black/20 text-emerald-100 text-[11px] flex items-center gap-2 border border-emerald-300/20">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
                  <span>
                    {language === 'ta'
                      ? 'இருப்பு போதுமானது (₹100க்கு மேல்). ரீசார்ஜ் பொத்தான் இருப்பு குறையும்போது இயங்கும்.'
                      : 'Healthy balance (> ₹100). Recharge unlocks automatically when balance falls to ₹100 or below.'}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/15 text-xs">
                <div>
                  <span className="text-orange-100 text-[10px] uppercase font-bold block">
                    {language === 'ta' ? 'இன்றைய நிகர வருவாய்' : "Today's Net Earnings"}
                  </span>
                  <span className="font-extrabold text-white text-base">₹{todayEarn.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-orange-100 text-[10px] uppercase font-bold block">
                    {language === 'ta' ? 'இன்றைய சவாரிகள்' : 'Trips Completed Today'}
                  </span>
                  <span className="font-extrabold text-white text-base">{todayTrips}</span>
                </div>
              </div>
            </div>

            {/* Quick Recharge Amount Chips */}
            <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#171717]">Quick Recharge Options</span>
                <span className="text-[10px] text-[#737373]">
                  {balance <= 100 ? 'Instant Payment Gateway' : 'Available when balance is ≤ ₹100'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[100, 250, 500].map((amt) => (
                  <button
                    key={amt}
                    disabled={balance > 100}
                    onClick={() => {
                      if (balance > 100) return;
                      setRechargeAmount(amt);
                      setCustomRechargeInput('');
                      setRechargeFeedback(null);
                      setShowRechargeModal(true);
                    }}
                    className={`p-2.5 rounded-xl font-extrabold text-xs transition text-center ${
                      balance <= 100
                        ? 'bg-[#FFF7F0] hover:bg-[#E85D04] text-[#E85D04] hover:text-white border border-[#E85D04]/30 cursor-pointer active:scale-95'
                        : 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed opacity-60'
                    }`}
                  >
                    + ₹{amt}
                  </button>
                ))}
                <button
                  disabled={balance > 100}
                  onClick={() => {
                    if (balance > 100) return;
                    setRechargeAmount(500);
                    setCustomRechargeInput('');
                    setRechargeFeedback(null);
                    setShowRechargeModal(true);
                  }}
                  className={`p-2.5 rounded-xl font-extrabold text-xs transition text-center ${
                    balance <= 100
                      ? 'bg-[#F9F5F0] hover:bg-black/10 text-[#171717] border border-black/5 cursor-pointer'
                      : 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed opacity-60'
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Transactions History Ledger */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-bold text-[#171717]">Wallet Transactions & Recharge History</h3>
                <span className="text-[10px] text-[#737373]">{txs.length} entries</span>
              </div>

              {txs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-black/5 p-6 text-center shadow-xs">
                  <div className="w-12 h-12 rounded-full bg-[#FAFAF8] flex items-center justify-center mx-auto mb-2 text-[#737373]">
                    <Wallet className="w-6 h-6 text-[#E85D04]" />
                  </div>
                  <p className="text-xs font-bold text-[#171717]">No Transactions Recorded</p>
                  <p className="text-[11px] text-[#737373] mt-1">Recharge your prepaid wallet or complete rides to see history here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {txs.map((tx: any) => {
                    const isCredit = String(tx.type || 'CREDIT').toUpperCase() !== 'DEBIT';
                    const isSuccess = String(tx.status || 'SUCCESS').toUpperCase() === 'SUCCESS';
                    const amt = Number(tx.amount || 0);

                    return (
                      <div
                        key={tx.id}
                        className="bg-white rounded-2xl border border-black/5 shadow-xs p-3.5 flex items-center justify-between gap-3 hover:border-black/15 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              !isSuccess
                                ? 'bg-rose-50 text-rose-600'
                                : isCredit
                                  ? 'bg-emerald-50 text-[#22A06B]'
                                  : 'bg-orange-50 text-[#E85D04]'
                            }`}
                          >
                            {!isSuccess ? (
                              <XCircle className="w-5 h-5" />
                            ) : isCredit ? (
                              <TrendingUp className="w-5 h-5" />
                            ) : (
                              <Banknote className="w-5 h-5" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-[#171717] truncate">
                                {tx.description || (isCredit ? 'Prepaid Top-up' : 'Trip Commission')}
                              </p>
                              <span
                                className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase shrink-0 ${
                                  isSuccess
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {isSuccess ? 'SUCCESS' : 'FAILED'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#737373]">
                              <span>{fmtDate(tx.created_at)}</span>
                              {tx.reference_id && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-[#A3A3A3] truncate max-w-[120px]">Ref: {tx.reference_id}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 pl-2">
                          <span
                            className={`text-sm font-black block ${
                              !isSuccess
                                ? 'text-[#737373] line-through'
                                : isCredit
                                  ? 'text-[#22A06B]'
                                  : 'text-[#DC2626]'
                            }`}
                          >
                            {isCredit ? '+' : '−'}₹{amt.toFixed(2)}
                          </span>
                          <span className="text-[9px] text-[#A3A3A3] font-medium block">
                            {isSuccess ? (isCredit ? 'Credited' : 'Debited') : 'Declined'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recharge Gateway Modal */}
          {showRechargeModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl border border-black/10 font-sans space-y-4 max-h-[90vh] overflow-y-auto"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-2 border-b border-black/5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#E85D04]/10 text-[#E85D04] flex items-center justify-center">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-extrabold text-[#171717]">Recharge Driver Wallet</h3>
                      <p className="text-[10px] text-[#737373]">Instant Prepaid Top-up</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowRechargeModal(false);
                      setRechargeFeedback(null);
                    }}
                    className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[#737373] hover:text-[#171717]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Feedback receipt if already processed */}
                {rechargeFeedback ? (
                  <div
                    className={`p-4 rounded-2xl border text-center space-y-3 ${
                      rechargeFeedback.status === 'SUCCESS'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-rose-50 border-rose-200 text-rose-950'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                        rechargeFeedback.status === 'SUCCESS' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                      }`}
                    >
                      {rechargeFeedback.status === 'SUCCESS' ? (
                        <Check className="w-6 h-6 stroke-[3]" />
                      ) : (
                        <XCircle className="w-6 h-6 stroke-[2]" />
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-extrabold">
                        {rechargeFeedback.status === 'SUCCESS' ? 'Recharge Successful!' : 'Recharge Failed'}
                      </h4>
                      <p className="text-xs mt-1 text-[#525252]">{rechargeFeedback.message}</p>
                    </div>

                    <div className="bg-white/80 rounded-xl p-3 text-xs space-y-1.5 text-left border border-black/5">
                      <div className="flex justify-between">
                        <span className="text-[#737373]">Recharge Amount:</span>
                        <span className="font-extrabold text-[#171717]">₹{rechargeFeedback.amount?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#737373]">Status:</span>
                        <span
                          className={`font-extrabold ${
                            rechargeFeedback.status === 'SUCCESS' ? 'text-[#22A06B]' : 'text-rose-600'
                          }`}
                        >
                          {rechargeFeedback.status}
                        </span>
                      </div>
                      {rechargeFeedback.referenceId && (
                        <div className="flex justify-between">
                          <span className="text-[#737373]">Transaction Ref:</span>
                          <span className="font-mono text-[11px] font-bold text-[#171717]">
                            {rechargeFeedback.referenceId}
                          </span>
                        </div>
                      )}
                      {rechargeFeedback.newBalance !== undefined && (
                        <div className="flex justify-between pt-1.5 border-t border-black/5 font-bold">
                          <span className="text-[#171717]">New Available Balance:</span>
                          <span className="text-[#E85D04] font-black">₹{rechargeFeedback.newBalance.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setShowRechargeModal(false);
                        setRechargeFeedback(null);
                      }}
                      className="w-full py-3 bg-[#E85D04] text-white font-extrabold rounded-xl text-xs shadow hover:bg-[#C2410C] transition"
                    >
                      Done & Return to Wallet
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Amount Selector */}
                    <div>
                      <label className="text-[11px] font-bold text-[#737373] uppercase block mb-1.5">
                        Select Top-Up Amount
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[100, 250, 500].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => {
                              setRechargeAmount(amt);
                              setCustomRechargeInput('');
                            }}
                            className={`py-2.5 rounded-xl font-extrabold text-xs transition border ${
                              rechargeAmount === amt && !customRechargeInput
                                ? 'bg-[#E85D04] text-white border-[#E85D04] shadow-md shadow-[#E85D04]/20'
                                : 'bg-[#FAFAF8] text-[#171717] border-black/10 hover:border-black/20'
                            }`}
                          >
                            ₹{amt}
                          </button>
                        ))}
                      </div>

                      <div className="mt-2.5">
                        <label className="text-[10px] text-[#737373] font-bold block mb-1">Or Enter Custom Amount (₹)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#737373] text-sm">₹</span>
                          <input
                            type="number"
                            min="10"
                            max="50000"
                            placeholder="e.g. 1000"
                            value={customRechargeInput}
                            onChange={(e) => setCustomRechargeInput(e.target.value)}
                            className="w-full pl-8 pr-3 py-2.5 bg-[#FAFAF8] border border-black/10 rounded-xl font-bold text-sm text-[#171717] outline-none focus:border-[#E85D04]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Payment Gateway Options */}
                    <div>
                      <label className="text-[11px] font-bold text-[#737373] uppercase block mb-1.5">
                        Payment Method
                      </label>
                      <div className="space-y-2">
                        {[
                          { id: 'UPI', name: 'UPI Gateway', desc: 'Google Pay, PhonePe, Paytm, BHIM', icon: Sparkles },
                          { id: 'CARD', name: 'Credit / Debit Card', desc: 'Visa, Mastercard, RuPay', icon: CreditCard },
                          { id: 'NETBANKING', name: 'NetBanking', desc: 'All Major Indian Banks', icon: Banknote },
                        ].map((pm) => {
                          const IconComp = pm.icon;
                          const isSelected = rechargeMethod === pm.id;
                          return (
                            <div
                              key={pm.id}
                              onClick={() => setRechargeMethod(pm.id as any)}
                              className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'bg-[#FFF7F0] border-[#E85D04] ring-1 ring-[#E85D04]/30'
                                  : 'bg-white border-black/5 hover:border-black/20'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                    isSelected ? 'bg-[#E85D04] text-white' : 'bg-black/5 text-[#737373]'
                                  }`}
                                >
                                  <IconComp className="w-4 h-4" />
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-[#171717] block">{pm.name}</span>
                                  <span className="text-[10px] text-[#737373] block">{pm.desc}</span>
                                </div>
                              </div>
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected ? 'border-[#E85D04] bg-[#E85D04]' : 'border-black/20'
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Test simulation toggle for testing failed scenario */}
                    <div className="p-2.5 bg-[#FAFAF8] rounded-xl border border-black/5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-[#171717] block text-[11px]">Test Simulation Mode</span>
                        <span className="text-[10px] text-[#737373]">Toggle to test failed gateway response</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSimulateFail(!simulateFail)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition ${
                          simulateFail ? 'bg-rose-600 text-white' : 'bg-black/5 text-[#737373]'
                        }`}
                      >
                        {simulateFail ? 'Simulate FAILED 🔴' : 'SUCCESS 🟢'}
                      </button>
                    </div>

                    {/* Submit Recharge */}
                    <button
                      onClick={handleExecuteRecharge}
                      disabled={isProcessingRecharge}
                      className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-[#E85D04]/30 min-h-[48px] flex items-center justify-center gap-2 text-xs transition active:scale-98 disabled:opacity-50"
                    >
                      {isProcessingRecharge ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying Payment with Gateway...</span>
                        </>
                      ) : (
                        <span>
                          Pay ₹
                          {customRechargeInput
                            ? parseFloat(customRechargeInput) || 0
                            : rechargeAmount}{' '}
                          & Recharge Now
                        </span>
                      )}
                    </button>
                  </>
                )}
              </motion.div>
            </div>
          )}
        </div>
      </DriverDashboardLayout>
    );
  }

  // 53B. Driver Notifications Screen (live from /driver/notifications)
  if (driverScreen === 'DRIVER_NOTIFICATIONS') {
    const unread = driverNotifications.filter((n: any) => !n.isRead);
    const typeColor = (t: string) =>
      t === 'RIDE' ? 'text-[#E85D04]' : t === 'PAYMENT' ? 'text-[#22A06B]' : t === 'OFFER' ? 'text-[#C2410C]' : 'text-[#737373]';

    return (
      <DriverDashboardLayout>
        <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] overflow-y-auto">
          <div className="sticky top-0 z-20 bg-white border-b border-black/5 px-4 sm:px-5 py-3 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDriverScreen('DRIVER_HOME')}
                aria-label="Back to dashboard"
                className="w-9 h-9 rounded-full bg-[#FAFAF8] border border-black/5 flex items-center justify-center text-[#171717] hover:bg-black/5 transition min-h-[36px] min-w-[36px]"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-bold leading-tight">
                  {language === 'ta' ? 'அறிவிப்புகள்' : 'Notifications'}
                </h2>
                {unread.length > 0 && (
                  <p className="text-[10px] text-[#737373]">
                    {language === 'ta' ? `${unread.length} படிக்கப்படாதவை` : `${unread.length} unread`}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={refreshDriverNotifications}
              className="w-9 h-9 rounded-full bg-[#FAFAF8] border border-black/5 flex items-center justify-center text-[#171717] hover:bg-black/5 transition min-h-[36px] min-w-[36px]"
              title="Refresh notifications"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 sm:px-5 py-4 space-y-2.5">
            {driverNotifications.length === 0 ? (
              <div className="bg-white rounded-[16px] border border-[#E5E5E5] shadow-sm p-6 text-center mt-6">
                <div className="w-10 h-10 rounded-full bg-[#FAFAF8] flex items-center justify-center mx-auto mb-2">
                  <Inbox className="w-5 h-5 text-[#737373]" />
                </div>
                <p className="text-xs font-semibold text-[#171717]">
                  {language === 'ta' ? 'அறிவிப்புகள் எதுவும் இல்லை' : 'No notifications'}
                </p>
                <p className="text-[11px] text-[#737373] mt-1">
                  {language === 'ta' ? 'பயண விபரங்கள் மற்றும் எச்சரிக்கைகள் இங்கு தோன்றும்.' : 'Ride updates and alerts will appear here.'}
                </p>
              </div>
            ) : (
              driverNotifications.map((n: any) => (
                <button
                  key={n.id}
                  onClick={() => markDriverNotificationRead(n.id)}
                  className={`w-full text-left bg-white rounded-[16px] border shadow-sm px-4 py-3 flex items-start gap-3 transition ${
                    n.isRead ? 'border-[#E5E5E5] opacity-60' : 'border-[#E85D04]/40'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.isRead ? 'bg-black/10' : 'bg-[#E85D04]'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] font-bold truncate ${typeColor(n.type)}`}>{n.title}</p>
                    <p className="text-[11px] text-[#737373] mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-[#A1A1AA] mt-1">{n.time}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </DriverDashboardLayout>
    );
  }

// 53. Driver Earnings Dashboard
if (driverScreen === 'EARNINGS') {
    const todayNet = driverWallet ? Math.round(driverWallet.todayEarnings) : driverProfile.todayEarnings;
    const completedTrips = driverWallet ? driverWallet.todayTrips : driverProfile.completedTripsToday;
    const commissionPaid = driverWallet ? Math.round(driverWallet.totalCommissionPaid) : driverProfile.commission;
    const walletBal = driverWallet ? Number(driverWallet.balance) : 0;

    const earningsOf = (r: any) =>
      r.driver_earnings ? Number(r.driver_earnings) : Math.round((Number(r.total_fare || 0) * 85) / 100);
    const isCompletedTrip = (r: any) => r.status === 'COMPLETED' || (!r.status && r.payment_status === 'PAID');
    const completedRides = driverRideHistory.filter(isCompletedTrip);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const inRange = (created: string | undefined, start: Date) => {
      if (!created) return false;
      const t = new Date(created);
      return !isNaN(t.getTime()) && t >= start;
    };
    const weekEarnings = isNaN(completedRides
      .filter((r: any) => inRange(r.created_at, startOfWeek))
      .reduce((s: number, r: any) => s + earningsOf(r), 0)) ? 0 : completedRides
      .filter((r: any) => inRange(r.created_at, startOfWeek))
      .reduce((s: number, r: any) => s + earningsOf(r), 0);
    const monthEarnings = isNaN(completedRides
      .filter((r: any) => inRange(r.created_at, startOfMonth))
      .reduce((s: number, r: any) => s + earningsOf(r), 0)) ? 0 : completedRides
      .filter((r: any) => inRange(r.created_at, startOfMonth))
      .reduce((s: number, r: any) => s + earningsOf(r), 0);
    const grossEarnings = todayNet + commissionPaid;
    const transactions = completedRides.length > 0 ? completedRides : driverRideHistory;

    return (
      <DriverDashboardLayout>
        <div className="h-full w-full bg-[#FAFAF8] overflow-y-auto px-3 sm:px-6 py-4 sm:py-6">
          <div className="mx-auto w-full max-w-5xl">
            {/* Page header */}
            <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDriverScreen('DRIVER_HOME')}
                  aria-label="Back to dashboard"
                  className="w-9 h-9 rounded-full bg-white border border-[#E5E5E5] shadow-sm flex items-center justify-center text-[#171717] hover:bg-[#FAFAF8] transition min-h-[36px] min-w-[36px]"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-[#171717]">{language === 'ta' ? 'வருவாய்' : 'Earnings'}</h1>
                  <p className="text-[11px] text-[#737373]">{language === 'ta' ? 'ஓட்டுநர் வருமான சுருக்கம்' : 'Driver payout summary'}</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 bg-white border border-[#E5E5E5] rounded-full px-3 py-1.5 text-[11px] font-bold text-[#737373] shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#22A06B] animate-pulse" />
                {language === 'ta' ? 'நேரலை' : 'Live'}
              </span>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {[
                { label: language === 'ta' ? 'இன்றைய வருவாய்' : "Today's Earnings", value: todayNet, accent: true, isTrips: false },
                { label: language === 'ta' ? 'இந்த வாரம்' : 'This Week', value: weekEarnings, isTrips: false },
                { label: language === 'ta' ? 'இந்த மாதம்' : 'This Month', value: monthEarnings, isTrips: false },
                { label: language === 'ta' ? 'நிறைவுற்ற சவாரிகள்' : 'Completed Rides', value: completedTrips, isTrips: true },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-[18px] border border-[#E5E5E5] shadow-sm p-4 min-w-0">
                  <span className="text-[11px] text-[#737373] font-semibold block">{s.label}</span>
                  <span
                    className={`text-xl sm:text-2xl font-extrabold mt-1 block truncate ${s.accent ? 'text-[#E85D04]' : 'text-[#171717]'}`}
                  >
                    {s.isTrips ? s.value : `₹${Number(s.value).toLocaleString('en-IN')}`}
                  </span>
                </div>
              ))}
            </div>

            {/* Main earnings breakdown */}
            <div className="bg-white rounded-[18px] border border-[#E5E5E5] shadow-sm p-4 sm:p-5 mb-4">
              <span className="text-[11px] text-[#737373] font-bold uppercase tracking-wider block mb-3">
                {language === 'ta' ? 'இன்றைய விபரம்' : "Today's Breakdown"}
              </span>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#737373]">{language === 'ta' ? 'மொத்த வருவாய்' : 'Gross Earnings'}</span>
                  <span className="font-bold text-[#171717]">₹{grossEarnings}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#737373]">{language === 'ta' ? 'ஜிட்டா கமிஷன்' : 'Jitta Drives Commission'}</span>
                  <span className="font-bold text-[#737373]">− ₹{commissionPaid}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#E5E5E5] pt-2.5 mt-1">
                  <span className="text-[#171717] font-bold">{language === 'ta' ? 'நிகர வருவாய்' : 'Net Earnings'}</span>
                  <span className="text-[#E85D04] font-extrabold text-lg">₹{todayNet}</span>
                </div>
              </div>
            </div>

            {/* Transactions list */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-sm font-bold text-[#171717]">{language === 'ta' ? 'சமீபத்திய பரிவர்த்தனைகள்' : 'Recent Transactions'}</h2>
                <button
                  onClick={() => {
                    refreshDriverHistory();
                    setDriverScreen('DRIVER_HISTORY');
                  }}
                  className="text-[11px] font-bold text-[#E85D04] min-h-[32px]"
                >
                  {language === 'ta' ? 'அனைத்தும் காண்க →' : 'View All →'}
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="bg-white rounded-[18px] border border-[#E5E5E5] shadow-sm p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#FAFAF8] flex items-center justify-center mx-auto mb-2">
                    <History className="w-5 h-5 text-[#737373]" />
                  </div>
                  <p className="text-xs font-semibold text-[#171717]">No payout entries yet</p>
                  <p className="text-[11px] text-[#737373] mt-1">Completed trips will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {transactions.slice(0, 5).map((ride: any) => {
                    const totalFare = Number(ride.total_fare || 0);
                    const earned = earningsOf(ride);
                    const fromName = ride.pickup?.name || ride.pickup?.address || 'Pickup';
                    const toName = ride.drop?.name || ride.drop?.address || 'Drop';
                    return (
                      <div
                        key={ride.id}
                        className="bg-white rounded-[16px] border border-[#E5E5E5] shadow-sm px-4 py-3 flex items-center gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-bold text-[#171717] truncate">
                            {fromName} → {toName}
                          </p>
                          <p className="text-[10px] text-[#737373] mt-0.5 truncate">
                            {ride.created_at || 'Recently'} • {ride.payment_method || 'CASH'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block text-[13px] font-extrabold text-[#171717]">₹{totalFare}</span>
                          <span className="block text-[10px] text-[#22A06B] font-bold">+₹{earned}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Driver Prepaid Wallet Card with Conditional Recharge Button */}
            <div className="bg-white rounded-[18px] border border-[#E5E5E5] shadow-sm p-4 sm:p-5 mt-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#E85D04]/10 text-[#E85D04] flex items-center justify-center">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#171717]">
                      {language === 'ta' ? 'முன்பண பணப்பை' : 'Prepaid Driver Wallet'}
                    </h3>
                    <p className="text-[10px] text-[#737373]">
                      {language === 'ta' ? 'கமிஷன் & பயண ஏற்பு இருப்பு' : 'Required balance to accept ride requests'}
                    </p>
                  </div>
                </div>
                {walletBal <= 100 ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    {walletBal < 50
                      ? (language === 'ta' ? 'முக்கியக் குறைவு (< ₹50)' : 'Critical (< ₹50)')
                      : (language === 'ta' ? 'குறைந்த இருப்பு' : 'Low Balance')}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {language === 'ta' ? 'போதுமான இருப்பு' : 'Sufficient Balance'}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5">
                <div>
                  <span className="text-[11px] text-[#737373] font-semibold block">
                    {language === 'ta' ? 'கிடைக்கக்கூடிய பணப்பை இருப்பு' : 'Available Wallet Balance'}
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className={`text-2xl sm:text-3xl font-black ${walletBal < 50 ? 'text-rose-600' : 'text-[#171717]'}`}>
                      ₹{Number(walletBal).toFixed(2)}
                    </span>
                    <span className="text-[11px] text-[#737373]">
                      ({language === 'ta' ? 'சவாரிகளை ஏற்க குறைந்தது ₹50 தேவை' : 'Min ₹50 required to accept rides'})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={walletBal > 100}
                    onClick={() => {
                      setDriverScreen('DRIVER_WALLET');
                      setShowRechargeModal(true);
                    }}
                    title={walletBal > 100 ? 'Recharge is enabled only when wallet balance is low (≤ ₹100)' : 'Recharge driver wallet'}
                    className={`px-4 py-2.5 rounded-xl font-black text-xs transition flex items-center gap-1.5 shadow-sm min-h-[40px] ${
                      walletBal <= 100
                        ? 'bg-[#E85D04] hover:bg-[#C2410C] text-white shadow-[#E85D04]/30 cursor-pointer active:scale-95'
                        : 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed opacity-75'
                    }`}
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>{language === 'ta' ? 'ரீசார்ஜ் செய்' : 'Recharge Wallet'}</span>
                  </button>
                  <button
                    onClick={() => setDriverScreen('DRIVER_WALLET')}
                    className="px-3.5 py-2.5 rounded-xl border border-black/10 bg-white hover:bg-black/5 text-[#171717] font-bold text-xs transition min-h-[40px]"
                  >
                    {language === 'ta' ? 'விவரம் →' : 'Wallet Details →'}
                  </button>
                </div>
              </div>

              {walletBal > 100 ? (
                <p className="text-[10px] text-[#737373] mt-2.5 italic">
                  ℹ️ {language === 'ta' ? 'இருப்பு ₹100க்கு மேல் உள்ளதால் ரீசார்ஜ் பொத்தான் முடக்கப்பட்டுள்ளது (குறைந்த இருப்பில் மட்டுமே இயக்கப்படும்).' : 'Recharge button is enabled only when wallet balance falls to ₹100 or below.'}
                </p>
              ) : (
                <p className="text-[10px] text-amber-700 mt-2.5 font-semibold">
                  ⚠️ {walletBal < 50
                    ? (language === 'ta' ? 'இருப்பு ₹50க்கு குறைவாக உள்ளது! சவாரிகளை ஏற்க உடனடியாக ரீசார்ஜ் செய்யவும்.' : 'Balance is below ₹50! Please recharge now to accept new bookings.')
                    : (language === 'ta' ? 'இருப்பு குறைவாக உள்ளது (≤ ₹100). சவாரி ஏற்பு தடைபடுவதை தவிர்க்க ரீசார்ஜ் செய்யவும்.' : 'Balance is low (≤ ₹100). Recharge now to prevent ride acceptance blocks.')}
                </p>
              )}
            </div>
          </div>
        </div>
      </DriverDashboardLayout>
    );
  }

  // 54. Driver Ride History Screen (Professional White/Orange Theme)
  if (driverScreen === 'DRIVER_HISTORY') {
    return (
      <DriverDashboardLayout>
        <div className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] p-3 sm:p-5 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDriverScreen('DRIVER_HOME')}
                className="w-9 h-9 bg-white rounded-xl border border-[#E5E5E5] shadow-xs flex items-center justify-center text-[#171717] hover:bg-[#FAFAF8] transition min-h-[36px] min-w-[36px]"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#171717]">{language === 'ta' ? 'பயண வரலாறு' : 'Ride History'}</h2>
                <p className="text-[11px] text-[#737373]">{language === 'ta' ? 'கடந்த பயணங்கள் மற்றும் கட்டண விபரம்' : 'Past trips and payout breakdown'}</p>
              </div>
            </div>
            <button
              onClick={() => refreshDriverHistory()}
              className="w-9 h-9 bg-white rounded-xl border border-[#E5E5E5] shadow-xs flex items-center justify-center text-[#737373] hover:text-[#E85D04] transition min-h-[36px] min-w-[36px]"
              title="Refresh History"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-w-3xl w-full mx-auto">
            {driverRideHistory.length === 0 ? (
              <div className="bg-white border border-[#E5E5E5] rounded-3xl p-8 text-center space-y-3 shadow-xs my-auto">
                <div className="w-14 h-14 bg-[#FAFAF8] rounded-2xl flex items-center justify-center mx-auto text-[#737373]">
                  <History className="w-7 h-7 text-[#E85D04]" />
                </div>
                <h3 className="text-sm font-bold text-[#171717]">{language === 'ta' ? 'முடிக்கப்பட்ட பயணங்கள் எதுவும் இல்லை' : 'No Completed Rides Yet'}</h3>
                <p className="text-xs text-[#737373] max-w-xs mx-auto">
                  {language === 'ta'
                    ? 'முடிக்கப்பட்ட பயணங்கள் மற்றும் கட்டண விபரங்கள் தானாகவே இங்கே காண்பிக்கப்படும்.'
                    : 'Completed rides and fare payouts assigned to you will automatically appear here.'}
                </p>
                <button
                  onClick={() => setDriverScreen('DRIVER_HOME')}
                  className="bg-[#E85D04] hover:bg-[#C2410C] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow transition min-h-[36px]"
                >
                  {language === 'ta' ? 'ஓட்டுநர் முகப்புக்குச் செல்' : 'Go to Driver Dashboard'}
                </button>
              </div>
            ) : (
              driverRideHistory.map((ride: any) => {
                const totalFare = Number(ride.total_fare || 0);
                const driverEarnings = ride.driver_earnings ? Number(ride.driver_earnings) : Math.round(totalFare * 0.85);
                const isCompleted = ride.status === 'COMPLETED';

                return (
                  <div
                    key={ride.id}
                    className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-3 shadow-xs hover:border-[#E85D04]/30 transition"
                  >
                    <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2.5 gap-2">
                      <span className="text-[11px] font-mono text-[#737373] font-semibold truncate max-w-[150px] sm:max-w-none">
                        #{ride.id.substring(0, 10)}...
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-50 text-[#22A06B] border-emerald-200'
                            : 'bg-rose-50 text-rose-600 border-rose-200'
                        }`}
                      >
                        {ride.status}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#22A06B] mt-0.5 shrink-0" />
                        <span className="text-[#171717] font-semibold truncate">
                          {ride.pickup?.name || ride.pickup?.address || 'Pickup'}
                        </span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] mt-0.5 shrink-0" />
                        <span className="text-[#171717] font-semibold truncate">
                          {ride.drop?.name || ride.drop?.address || 'Drop'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#737373] pt-1">
                      <span className="truncate">
                        Passenger: <strong className="text-[#171717]">{sanitizeBrandText(ride.customer_name, 'Passenger')}</strong>
                      </span>
                      {ride.rating && (
                        <span className="text-amber-500 font-bold shrink-0">★ {ride.rating}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between bg-[#FAFAF8] px-3 py-2 rounded-xl border border-[#E5E5E5] text-xs">
                      <div>
                        <span className="text-[10px] text-[#737373] block">Total Fare</span>
                        <span className="font-extrabold text-[#171717]">₹{totalFare}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#22A06B] font-bold block">Net Payout (85%)</span>
                        <span className="font-black text-[#22A06B] text-sm">₹{driverEarnings}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-[#737373] flex justify-between items-center">
                      <span className="truncate">{ride.created_at || 'Recently'}</span>
                      <span className="shrink-0 font-medium">{ride.payment_method || 'CASH'} • {ride.payment_status || 'PAID'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DriverDashboardLayout>
    );
  }

  // 55. Driver Partner Profile Screen (Professional White/Orange Theme)
  if (driverScreen === 'DRIVER_PROFILE') {
    const startEdit = () => {
      setEditForm({
        name: driverProfile.name,
        email: driverProfile.email,
        vehicleModel: driverProfile.vehicleModel,
        vehicleNumber: driverProfile.vehicleNumber,
        vehicleType: driverProfile.vehicleType,
      });
      setEditPhoto(driverProfile.photo || '');
      setProfileMsg('');
      setProfileMsgError(false);
      setEditingProfile(true);
    };

    const handleDriverPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setProfileMsg(language === 'ta' ? 'தயவுசெய்து புகைப்படத்தைத் தேர்ந்தெடுக்கவும்' : 'Please select an image file (PNG/JPG)');
        setProfileMsgError(true);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = reader.result as string;
        setEditPhoto(b64);
        setProfileMsg(language === 'ta' ? 'புகைப்படம் தேர்ந்தெடுக்கப்பட்டது! மாற்றங்களைச் சேமிக்கவும்.' : 'Photo selected! Tap "Save Changes" to save.');
        setProfileMsgError(false);
      };
      reader.readAsDataURL(file);
    };

    const saveProfile = async () => {
      setIsSavingProfile(true);
      setProfileMsg('');
      setProfileMsgError(false);
      const dur: { vehicle_model?: string; vehicle_number?: string; color?: string; year?: number } = {};
      if (editForm.vehicleModel !== driverProfile.vehicleModel) dur.vehicle_model = editForm.vehicleModel.trim();
      if (editForm.vehicleNumber !== driverProfile.vehicleNumber) dur.vehicle_number = editForm.vehicleNumber.trim();

      const profData: { name?: string; email?: string; photo_url?: string } = {};
      if (editForm.name.trim() !== driverProfile.name) profData.name = editForm.name.trim();
      if (editForm.email.trim() !== driverProfile.email) profData.email = editForm.email.trim();
      if (editPhoto !== undefined && editPhoto !== driverProfile.photo) {
        profData.photo_url = editPhoto;
      }

      try {
        if (Object.keys(profData).length > 0) {
          const pr = await updateDriverProfile(profData);
          if (!pr.success) {
            setProfileMsg(pr.message || 'Could not update profile');
            setProfileMsgError(true);
            setIsSavingProfile(false);
            return;
          }
        }
        if (Object.keys(dur).length > 0) {
          const vr = await updateDriverVehicle(dur);
          if (!vr.success) {
            setProfileMsg(vr.message || 'Could not update vehicle');
            setProfileMsgError(true);
            setIsSavingProfile(false);
            return;
          }
        }
        setProfileMsg('Profile updated successfully');
        setProfileMsgError(false);
        setEditingProfile(false);
      } catch (e: any) {
        setProfileMsg(e?.message || 'Profile update error');
        setProfileMsgError(true);
      } finally {
        setIsSavingProfile(false);
      }
    };

    return (
      <DriverDashboardLayout>
        <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-3 sm:p-5 overflow-y-auto">
          <div className="max-w-3xl w-full mx-auto space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDriverScreen('DRIVER_HOME')}
                  className="w-9 h-9 bg-white rounded-xl border border-[#E5E5E5] shadow-xs flex items-center justify-center text-[#171717] hover:bg-[#FAFAF8] transition min-h-[36px] min-w-[36px]"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#171717]">
                    {language === 'ta' ? 'கூட்டாளி சுயவிவரம்' : 'Partner Profile'}
                  </h2>
                  <p className="text-[11px] text-[#737373]">
                    {language === 'ta' ? 'கணக்கு மற்றும் வாகன விவரங்கள்' : 'Account & vehicle credentials'}
                  </p>
                </div>
              </div>
              <button
                onClick={editingProfile ? () => setEditingProfile(false) : startEdit}
                className="flex items-center gap-1.5 bg-white rounded-xl border border-[#E5E5E5] px-3 py-2 text-xs font-bold text-[#E85D04] hover:bg-[#FFF7F0] transition min-h-[36px] shadow-xs"
              >
                <PencilRuler className="w-3.5 h-3.5" />
                {editingProfile
                  ? (language === 'ta' ? 'ரத்து செய்' : 'Cancel')
                  : (language === 'ta' ? 'சுயவிவரத்தைத் திருத்து' : 'Edit Profile')}
              </button>
            </div>

            {profileMsg && (
              <div className={`p-3.5 rounded-xl border text-xs font-bold ${profileMsgError ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                {profileMsg}
              </div>
            )}

            {editingProfile && (
              <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-3.5 text-xs mb-3">
                <span className="text-[11px] text-[#E85D04] font-extrabold uppercase flex items-center gap-1.5">
                  <PencilRuler className="w-3.5 h-3.5" /> {language === 'ta' ? 'சுயவிவரம் & வாகனத்தைத் திருத்து' : 'Edit Profile & Vehicle'}
                </span>

                {/* Profile Photo Upload */}
                <div className="flex items-center gap-3.5 p-3.5 bg-[#FAFAF8] border border-[#E5E5E5] rounded-2xl">
                  {((editPhoto !== undefined ? editPhoto : driverProfile.photo)) ? (
                    <img
                      src={editPhoto !== undefined ? editPhoto : driverProfile.photo}
                      alt="Driver Photo Preview"
                      className="w-14 h-14 rounded-2xl border-2 border-[#E85D04] object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 border-2 border-[#E85D04]/30 flex items-center justify-center text-[#E85D04] shrink-0">
                      <User className="w-7 h-7" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs block text-[#171717] mb-1.5">
                      {language === 'ta' ? 'சுயவிவர புகைப்படம்' : 'Profile Photo'}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="cursor-pointer bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold text-[11px] px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-xs active:scale-95">
                        <Camera className="w-3.5 h-3.5" />
                        <span>{language === 'ta' ? 'புகைப்படம் பதிவேற்று' : 'Upload Photo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleDriverPhotoUpload}
                        />
                      </label>
                      {((editPhoto !== undefined ? editPhoto : driverProfile.photo)) && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditPhoto('');
                            setProfileMsg(language === 'ta' ? 'புகைப்படம் நீக்கப்பட்டது. இயல்புநிலை ஐகான் பயன்படுத்தப்படும்.' : 'Photo removed. Profile icon will be used.');
                            setProfileMsgError(false);
                          }}
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 active:scale-95"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{language === 'ta' ? 'நீக்கு' : 'Remove'}</span>
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-[#737373] mt-1 block">
                      {language === 'ta' ? 'புகைப்படம் இல்லாதபோது சுயவிவர ஐகான் மட்டுமே காட்டப்படும்.' : 'When no photo is uploaded, profile icon will be shown.'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-[#737373] font-bold block mb-1">
                    {language === 'ta' ? 'முழு பெயர்' : 'Full Name'}
                  </label>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))}
                    className="w-full bg-[#FAFAF8] border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-[#171717] font-semibold outline-none focus:border-[#E85D04]"
                  />
                </div>
                <div>
                  <label className="text-[#737373] font-bold block mb-1">
                    {language === 'ta' ? 'மின்னஞ்சல்' : 'Email'}
                  </label>
                  <input
                    value={editForm.email}
                    onChange={(e) => setEditForm((s) => ({ ...s, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="w-full bg-[#FAFAF8] border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-[#171717] font-semibold outline-none focus:border-[#E85D04]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#737373] font-bold block mb-1">
                      {language === 'ta' ? 'வாகன மாதிரி' : 'Vehicle Model'}
                    </label>
                    <input
                      value={editForm.vehicleModel}
                      onChange={(e) => setEditForm((s) => ({ ...s, vehicleModel: e.target.value }))}
                      className="w-full bg-[#FAFAF8] border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-[#171717] font-semibold outline-none focus:border-[#E85D04]"
                    />
                  </div>
                  <div>
                    <label className="text-[#737373] font-bold block mb-1">
                      {language === 'ta' ? 'வாகன எண்' : 'Vehicle Number'}
                    </label>
                    <input
                      value={editForm.vehicleNumber}
                      onChange={(e) => setEditForm((s) => ({ ...s, vehicleNumber: e.target.value }))}
                      className="w-full bg-[#FAFAF8] border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-[#171717] font-semibold outline-none focus:border-[#E85D04]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[#737373] font-bold block mb-1">
                    {language === 'ta' ? 'பதிவு செய்யப்பட்ட வகை (மாற்ற முடியாது)' : 'Registered Category (Permanent)'}
                  </label>
                  <div className="bg-[#FFF7F0] border border-[#E85D04]/30 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#E85D04]" />
                      <span className="text-xs font-extrabold text-[#171717]">
                        {driverProfile.vehicleType === 'TWO_WHEELER' || driverProfile.vehicleType === 'Bike / Scooty'
                          ? (language === 'ta' ? 'இருசக்கர வாகனம் (பைக் / ஸ்கூட்டி)' : 'Two-Wheeler (Bike / Scooty)')
                          : driverProfile.vehicleType === 'ACTING_DRIVER' || driverProfile.vehicleType === 'Acting Driver'
                          ? (language === 'ta' ? 'ஆக்டிங் டிரைவர் (வாடிக்கையாளர் வாகனம்)' : 'Acting Driver (Customer Vehicle)')
                          : (language === 'ta' ? 'டாக்ஸி (கேப் / ஆட்டோ / செடான்)' : 'Taxi (Cab / Auto / Sedan)')}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-[#E85D04] text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
                      {language === 'ta' ? 'நிலையானது' : 'Locked'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={saveProfile}
                  disabled={isSavingProfile}
                  className="w-full bg-[#E85D04] hover:bg-[#C2410C] disabled:opacity-50 text-white font-extrabold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
                >
                  {isSavingProfile ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {language === 'ta' ? 'சேமிக்கப்படுகிறது…' : 'Saving…'}</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> {language === 'ta' ? 'மாற்றங்களைச் சேமி' : 'Save Changes'}</>
                  )}
                </button>
              </div>
            )}

            <div className="space-y-3">
              {/* Partner Details Card */}
              <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs flex items-center gap-3 sm:gap-4">
                {driverProfile.photo ? (
                  <img
                    src={driverProfile.photo}
                    alt="Driver"
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-[#E85D04] object-cover shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-100 border-2 border-[#E85D04]/30 flex items-center justify-center text-[#E85D04] shrink-0">
                    <User className="w-7 h-7 sm:w-8 sm:h-8" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-extrabold text-[#171717] truncate">{driverProfile.name}</h3>
                  <p className="text-xs text-[#737373] font-medium truncate">{driverProfile.phone}</p>
                  {driverProfile.email && (
                    <p className="text-[11px] text-[#A3A3A3] truncate">{driverProfile.email}</p>
                  )}
                  <div className="flex items-center gap-2 sm:gap-3 mt-1 text-xs">
                    <span className="text-amber-500 font-extrabold shrink-0">★ {driverProfile.rating}</span>
                    <span className="text-[#E5E5E5]">•</span>
                    <span className="text-[#737373] font-semibold truncate">
                      {driverProfile.tripsCount} {language === 'ta' ? 'மொத்த பயணங்கள்' : 'Lifetime Trips'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vehicle Card */}
              <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 shadow-xs space-y-2.5 text-xs">
                <span className="text-[10px] text-[#737373] font-bold uppercase block tracking-wide">
                  {language === 'ta' ? 'செயலில் உள்ள வாகனம்' : 'Active Taxi Vehicle'}
                </span>
                <div className="flex justify-between items-center border-b border-[#E5E5E5] pb-2">
                  <span className="text-[#737373]">{language === 'ta' ? 'மாதிரி' : 'Model'}</span>
                  <span className="font-extrabold text-[#171717] truncate">{driverProfile.vehicleModel}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#E5E5E5] pb-2">
                  <span className="text-[#737373]">{language === 'ta' ? 'வண்டி எண்' : 'License Plate'}</span>
                  <span className="font-mono font-extrabold text-[#E85D04]">{driverProfile.vehicleNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#737373]">{language === 'ta' ? 'வகை' : 'Category'}</span>
                  <span className="font-bold text-[#171717]">{driverProfile.vehicleType}</span>
                </div>
              </div>

              {/* Verification & Duty Status */}
              <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 shadow-xs space-y-2.5 text-xs">
                <span className="text-[10px] text-[#737373] font-bold uppercase block tracking-wide">
                  {language === 'ta' ? 'சரிபார்ப்பு & பணி நிலை' : 'Verification & Duty Status'}
                </span>
                <div className="flex justify-between items-center border-b border-[#E5E5E5] pb-2">
                  <span className="text-[#737373]">{language === 'ta' ? 'ஒப்புதல் நிலை' : 'Approval Status'}</span>
                  <span className="text-[#22A06B] font-extrabold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {driverProfile.approvalStatus === 'APPROVED' && language === 'ta' ? 'ஒப்புதல் அளிக்கப்பட்டது' : driverProfile.approvalStatus}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#737373]">{language === 'ta' ? 'பணி நிலை' : 'Duty Status'}</span>
                  <button
                    onClick={toggleDriverOnline}
                    disabled={driverProfile.approvalStatus !== 'APPROVED'}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                      driverProfile.approvalStatus !== 'APPROVED'
                        ? 'bg-[#FAFAF8] text-[#737373] border-[#E5E5E5] cursor-not-allowed'
                        : driverProfile.isOnline
                          ? 'bg-emerald-50 text-[#22A06B] border-emerald-200'
                          : 'bg-rose-50 text-rose-600 border-rose-200'
                    }`}
                  >
                    {driverProfile.approvalStatus !== 'APPROVED'
                      ? (language === 'ta' ? 'பூட்டப்பட்டது' : 'LOCKED')
                      : driverProfile.isOnline
                        ? (language === 'ta' ? 'இணைப்பில் 🟢' : 'ONLINE 🟢')
                        : (language === 'ta' ? 'ஆஃப்லைன் 🔴' : 'OFFLINE 🔴')}
                  </button>
                </div>
                {driverProfile.approvalStatus !== 'APPROVED' && (
                  <p className="text-[10px] text-[#737373]">
                    {language === 'ta' ? 'நிர்வாகி ஒப்புதல் அளித்தவுடன் நீங்கள் ஆன்லைனில் செல்லலாம்.' : 'You can go online once the admin approves your registration.'}
                  </p>
                )}
              </div>

              {/* Vehicle Documents */}
              <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 shadow-xs space-y-2.5 text-xs">
                <span className="text-[10px] text-[#737373] font-bold uppercase block flex items-center gap-1.5 tracking-wide">
                  <IdCard className="w-3.5 h-3.5 text-[#E85D04]" /> {language === 'ta' ? 'வாகன ஆவணங்கள் & ஓட்டுநர் உரிமம்' : 'Vehicle & License Documents'}
                </span>
                {(
                  [
                    {
                      key: 'license',
                      label: language === 'ta' ? 'ஓட்டுநர் உரிமம் (DL)' : 'Driving License',
                      docStatus: driverProfile.documents.license,
                      docNo: driverProfile.documentNumbers?.license,
                      defaultNo: `DL-TN38-${driverProfile.phone ? String(driverProfile.phone).slice(-6) : '202401'}`
                    },
                    {
                      key: 'rc',
                      label: language === 'ta' ? 'ஆர்சி புத்தகம் (RC Book)' : 'RC Book',
                      docStatus: driverProfile.documents.rc,
                      docNo: driverProfile.documentNumbers?.rc,
                      defaultNo: `RC-${(driverProfile.vehicleNumber || 'TN38BR9123').replace(/\s+/g, '')}`
                    },
                    {
                      key: 'insurance',
                      label: language === 'ta' ? 'காப்பீட்டு சான்றிதழ்' : 'Insurance Certificate',
                      docStatus: driverProfile.documents.insurance,
                      docNo: driverProfile.documentNumbers?.insurance,
                      defaultNo: `INS-HDFC-${driverProfile.phone ? String(driverProfile.phone).slice(-5) : '99120'}`
                    },
                    {
                      key: 'permit',
                      label: language === 'ta' ? 'வணிக அனுமதி (Permit)' : 'Commercial Permit',
                      docStatus: driverProfile.documents.permit,
                      docNo: driverProfile.documentNumbers?.permit,
                      defaultNo: `PERMIT-TN-${driverProfile.phone ? String(driverProfile.phone).slice(-5) : '48210'}`
                    },
                  ]
                ).map(({ key, label, docStatus: rawStatus, docNo: rawNo, defaultNo }) => {
                  const isApproved = driverProfile.approvalStatus === 'APPROVED';
                  const isVerified = isApproved ? rawStatus !== 'REJECTED' : rawStatus === 'VERIFIED';
                  const isRejected = rawStatus === 'REJECTED';
                  const displayDocNo = rawNo || (isApproved ? defaultNo : null);

                  return (
                    <div key={key} className="flex justify-between items-center gap-2 border-b border-[#E5E5E5] pb-2 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <span className="text-[#737373] block font-medium">{label}</span>
                        <span className={`text-[10px] font-mono truncate block ${displayDocNo ? 'text-[#171717] font-semibold' : 'text-[#A3A3A3]'}`}>
                          {displayDocNo || (language === 'ta' ? '— வழங்கப்படவில்லை —' : '— Not provided —')}
                        </span>
                      </div>
                      <span className={`font-extrabold shrink-0 text-xs px-2 py-0.5 rounded-full ${
                        isVerified
                          ? 'bg-emerald-50 text-[#22A06B] border border-emerald-200'
                          : isRejected
                            ? 'bg-rose-50 text-rose-600 border border-rose-200'
                            : 'bg-amber-50 text-amber-600 border border-amber-200'
                      }`}>
                        {isVerified
                          ? (language === 'ta' ? '✓ சரிபார்க்கப்பட்டது' : '✓ Verified')
                          : isRejected
                            ? (language === 'ta' ? '✗ நிராகரிக்கப்பட்டது' : '✗ Rejected')
                            : (language === 'ta' ? 'நிலுவையில்' : 'Pending')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <div className="pt-4 max-w-3xl w-full mx-auto">
            <button
              onClick={() => {
                logoutDriver();
                setDriverScreen('DRIVER_LOGIN');
              }}
              className="w-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-extrabold py-3.5 rounded-2xl transition flex items-center justify-center gap-2 text-xs min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              <span>{language === 'ta' ? 'ஓட்டுநர் கணக்கிலிருந்து வெளியேறு' : 'Sign Out of Driver Console'}</span>
            </button>
          </div>
        </div>
      </DriverDashboardLayout>
    );
  }

  return null;
};

