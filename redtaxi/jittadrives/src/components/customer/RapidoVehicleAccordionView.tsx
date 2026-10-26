import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ArrowLeft, Plus, Tag, CheckCircle2, AlertCircle, Info, ShieldCheck } from 'lucide-react';
import { useTaxiApp } from '../../context/TaxiAppContext';
import { InteractiveMap } from '../common/InteractiveMap';
import { validateVehicleNumber } from '../../utils/vehicleRegValidator';

export const RapidoVehicleAccordionView: React.FC = () => {
  const {
    language,
    pickupLocation,
    dropLocation,
    setDropLocation,
    setCustomerScreen,
    selectedVehicle,
    setSelectedVehicle,
    calculateFare,
    estimatedDistance,
    estimatedDuration,
    appliedCoupon,
    selectedPaymentMethod,
    rideType,
    setRideType,
    setDriverOnlyHours,
    setDriverOnlyVehicleNumber,
    setDriverOnlyVehicle,
  } = useTaxiApp() as any;

  const [expandedSection, setExpandedSection] = useState<'CAB' | 'BIKE' | 'DRIVER' | null>(
    rideType === 'DRIVER_ONLY' ? 'DRIVER' : 'BIKE'
  );
  const [actingDriverHours, setActingDriverHours] = useState<number>(2);
  const [actingVehicleCategory, setActingVehicleCategory] = useState<string>('Customer Vehicle');
  const [actingTransmission, setActingTransmission] = useState<'MANUAL' | 'AUTOMATIC'>('MANUAL');
  const [vehicleNumberInput, setVehicleNumberInput] = useState<string>('');
  const [driverValidationError, setDriverValidationError] = useState<string | null>(null);
  const [actingIncludeDrop, setActingIncludeDrop] = useState<boolean>(false);
  const [actingCustomDrop, setActingCustomDrop] = useState<any>(null);

  useEffect(() => {
    if (rideType === 'DRIVER_ONLY') {
      setExpandedSection('DRIVER');
      if (dropLocation) {
        setActingIncludeDrop(true);
        setActingCustomDrop(dropLocation);
      }
    }
  }, [rideType, dropLocation]);

  const ACTING_VEHICLE_TYPES = [
    { id: 'Bike', name: 'Bike', icon: '🏍️' },
    { id: 'Scooty', name: 'Scooty', icon: '🛵' },
    { id: 'Hatchback', name: 'Hatchback', icon: '🚗' },
    { id: 'Sedan', name: 'Sedan', icon: '🚘' },
    { id: 'SUV / MUV', name: 'SUV / MUV', icon: '🚙' },
  ];

  // Draggable Bottom Sheet State & Snaps: PEEK (~240px), HALF (~55vh), EXPANDED (~85vh)
  const [snapState, setSnapState] = useState<'PEEK' | 'HALF' | 'EXPANDED'>('HALF');
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const hasMovedRef = useRef<boolean>(false);

  useEffect(() => {
    const handleEdit = () => setCustomerScreen('SEARCH_LOCATION');
    window.addEventListener('jitta:edit-pickup', handleEdit);
    window.addEventListener('jitta:edit-drop', handleEdit);
    return () => {
      window.removeEventListener('jitta:edit-pickup', handleEdit);
      window.removeEventListener('jitta:edit-drop', handleEdit);
    };
  }, [setCustomerScreen]);

  const distance = estimatedDistance || 8.4;
  const duration = estimatedDuration || 24;

  const CABS_LIST = [
    {
      id: 'auto',
      name: 'Auto',
      tagline: 'Autos at doorstep',
      capacity: 3,
      etaMin: 3,
      basePrice: 39,
      perKmRate: 11,
      fare: calculateFare(distance, duration, { id: 'auto', name: 'Auto', basePrice: 39, perKmRate: 11 } as any).totalFare || 109,
      image: '/vehicles/auto.jpg',
    },
    {
      id: 'mini',
      name: 'Cab',
      tagline: 'Comfortable hatchbacks & sedans',
      capacity: 4,
      etaMin: 3,
      basePrice: 79,
      perKmRate: 13,
      fare: calculateFare(distance, duration, { id: 'mini', name: 'Cab', basePrice: 79, perKmRate: 13 } as any).totalFare || 126,
      image: '/vehicles/red_sedan.jpg',
    },
    {
      id: 'sedan',
      name: 'Sedan',
      tagline: 'Executive AC Sedans',
      capacity: 4,
      etaMin: 4,
      basePrice: 119,
      perKmRate: 16,
      fare: calculateFare(distance, duration, { id: 'sedan', name: 'Sedan', basePrice: 119, perKmRate: 16 } as any).totalFare || 149,
      image: '/vehicles/red_sedan.jpg',
    },
    {
      id: 'suv',
      name: 'SUV XL',
      tagline: 'Family SUV (6 Seater)',
      capacity: 6,
      etaMin: 6,
      basePrice: 169,
      perKmRate: 22,
      fare: calculateFare(distance, duration, { id: 'suv', name: 'SUV XL', basePrice: 169, perKmRate: 22 } as any).totalFare || 219,
      image: '/vehicles/red_suv.jpg',
    },
  ];

  const BIKES_LIST = [
    {
      id: 'bike',
      name: 'Bike',
      tagline: 'Quick Bike rides',
      capacity: 1,
      etaMin: 2,
      basePrice: 25,
      perKmRate: 8,
      fare: calculateFare(distance, duration, { id: 'bike', name: 'Bike', basePrice: 25, perKmRate: 8 } as any).totalFare || 48,
      image: '/vehicles/bike.jpg',
    },
    {
      id: 'scooter',
      name: 'Scooty',
      tagline: 'Compact & comfortable rides',
      capacity: 1,
      etaMin: 3,
      basePrice: 20,
      perKmRate: 7,
      fare: calculateFare(distance, duration, { id: 'scooter', name: 'Scooty', basePrice: 20, perKmRate: 7 } as any).totalFare || 55,
      image: '/vehicles/scooter.jpg',
    },
  ];

  // Ensure a vehicle is pre-selected
  useEffect(() => {
    if (!selectedVehicle) {
      setSelectedVehicle(BIKES_LIST[0] as any);
    }
  }, [selectedVehicle, setSelectedVehicle]);

  // Calculate snap heights based on screen
  const getSnapHeights = () => {
    const containerH = containerRef.current?.clientHeight || window.innerHeight;
    return {
      PEEK: Math.max(200, Math.min(250, containerH * 0.32)),
      HALF: Math.max(380, Math.min(480, containerH * 0.58)),
      EXPANDED: Math.min(containerH * 0.86, 680),
    };
  };

  const getTargetHeight = (snap: 'PEEK' | 'HALF' | 'EXPANDED') => {
    const snaps = getSnapHeights();
    return snaps[snap];
  };

  // Drag Gesture Handlers (Touch and Mouse)
  const startDrag = (clientY: number) => {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartYRef.current = clientY;
    const currentH = dragHeight ?? getTargetHeight(snapState);
    dragStartHeightRef.current = currentH;
    setIsDragging(true);
  };

  const onDragMove = (clientY: number) => {
    if (!isDraggingRef.current) return;
    const deltaY = dragStartYRef.current - clientY; // Drag up increases height
    if (Math.abs(deltaY) > 5) {
      hasMovedRef.current = true;
    }
    const snaps = getSnapHeights();
    const minH = snaps.PEEK - 20;
    const maxH = snaps.EXPANDED + 20;
    const newH = Math.max(minH, Math.min(maxH, dragStartHeightRef.current + deltaY));
    setDragHeight(newH);
  };

  const endDrag = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    if (!hasMovedRef.current) {
      // Tap on drag handle: toggle snap state
      setDragHeight(null);
      setSnapState((prev) => (prev === 'EXPANDED' ? 'HALF' : prev === 'HALF' ? 'EXPANDED' : 'HALF'));
      return;
    }

    const currentH = dragHeight ?? getTargetHeight(snapState);
    const snaps = getSnapHeights();

    const diffPeek = Math.abs(currentH - snaps.PEEK);
    const diffHalf = Math.abs(currentH - snaps.HALF);
    const diffExpanded = Math.abs(currentH - snaps.EXPANDED);

    if (diffPeek <= diffHalf && diffPeek <= diffExpanded) {
      setSnapState('PEEK');
    } else if (diffHalf <= diffPeek && diffHalf <= diffExpanded) {
      setSnapState('HALF');
    } else {
      setSnapState('EXPANDED');
    }
    setDragHeight(null);
  };

  // Global window listeners for drag move & end
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (isDraggingRef.current && e.touches[0]) {
        onDragMove(e.touches[0].clientY);
      }
    };
    const handleTouchEnd = () => {
      if (isDraggingRef.current) endDrag();
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        onDragMove(e.clientY);
      }
    };
    const handleMouseUp = () => {
      if (isDraggingRef.current) endDrag();
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [snapState, dragHeight]);

  // Acting Driver Pricing Breakdown: Base rate = ₹200/hr, Platform fee = ₹25, Tax = 5%
  const driverRatePerHour = 200;
  const driverBasePrice = actingDriverHours * driverRatePerHour;
  const driverPlatformFee = 25;
  const driverTax = Math.round(driverBasePrice * 0.05);
  const driverEstimatedTotal = driverBasePrice + driverPlatformFee + driverTax;

  const regValidation = vehicleNumberInput.trim() ? validateVehicleNumber(vehicleNumberInput) : null;

  const buttonText = expandedSection === 'DRIVER'
    ? `Book Acting Driver (${actingDriverHours} Hr${actingDriverHours > 1 ? 's' : ''})`
    : expandedSection === 'CAB'
    ? 'Book Cab'
    : selectedVehicle?.name === 'Scooty'
    ? 'Book Scooty'
    : 'Book Bike';

  const displayedFare = expandedSection === 'DRIVER'
    ? driverEstimatedTotal
    : (selectedVehicle?.fare || null);

  const handleBookClick = () => {
    if (expandedSection === 'DRIVER') {
      if (vehicleNumberInput.trim() && !regValidation?.isValid) {
        setDriverValidationError('Please enter a valid Indian vehicle registration format or leave it blank to proceed.');
        return;
      }
      setDriverValidationError(null);
      setRideType('DRIVER_ONLY');
      setDriverOnlyHours(actingDriverHours);
      const normalizedPlate = regValidation?.isValid ? regValidation.normalized : (vehicleNumberInput.trim() || '');
      setDriverOnlyVehicleNumber(normalizedPlate);
      if (setDriverOnlyVehicle) {
        setDriverOnlyVehicle((prev: any) => ({
          ...prev,
          number: normalizedPlate,
          type: 'Customer Vehicle',
          vehicle_type: 'Customer Vehicle',
          transmission: actingTransmission,
        }));
      }
      const transmissionLabel = actingTransmission === 'AUTOMATIC' ? 'Automatic' : 'Manual';
      setSelectedVehicle({
        id: 'driver_only',
        name: 'Acting Driver',
        tagline: `${actingDriverHours} Hrs • ${transmissionLabel}${normalizedPlate ? ` • ${normalizedPlate}` : ' • Customer Vehicle'}`,
        capacity: 1,
        basePrice: driverBasePrice,
        fare: driverEstimatedTotal,
        image: '/vehicles/driver_chauffeur.svg',
        vehicleType: 'ACTING_DRIVER',
        transmission: actingTransmission,
        hours: actingDriverHours,
      });

      // Acting Driver only uses drop location if user explicitly chose to specify one
      if (actingIncludeDrop && actingCustomDrop) {
        setDropLocation(actingCustomDrop);
      } else {
        setDropLocation(null);
      }

      setCustomerScreen('BOOKING_CONFIRM');
    } else if (expandedSection === 'BIKE') {
      setRideType('CITY');
      const isBike = selectedVehicle && typeof selectedVehicle === 'object' &&
        (selectedVehicle.id === 'bike' || selectedVehicle.id === 'scooter' || selectedVehicle.name === 'Bike' || selectedVehicle.name === 'Scooty');
      if (!isBike) {
        setSelectedVehicle(BIKES_LIST[0] as any);
      }
      setCustomerScreen('BOOKING_CONFIRM');
    } else if (expandedSection === 'CAB') {
      setRideType('CITY');
      const isCab = selectedVehicle && typeof selectedVehicle === 'object' &&
        ['auto', 'mini', 'sedan', 'suv'].includes(selectedVehicle.id);
      if (!isCab) {
        setSelectedVehicle(CABS_LIST[0] as any);
      }
      setCustomerScreen('BOOKING_CONFIRM');
    } else {
      setCustomerScreen('BOOKING_CONFIRM');
    }
  };

  const currentHeightPx = dragHeight ?? getTargetHeight(snapState);

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col bg-[#FAFAF8] text-[#171717] relative overflow-hidden font-sans select-none"
    >
      {/* Interactive Map taking full background */}
      <div className="absolute inset-0 w-full h-full">
        <InteractiveMap
          pickup={pickupLocation}
          drop={dropLocation}
          showNearbyDrivers={true}
          height="h-full"
          forceLight={true}
        />

        {/* Top Floating Back Button */}
        <button
          onClick={() => setCustomerScreen('HOME')}
          className="absolute top-4 left-4 z-30 w-10 h-10 rounded-full bg-white shadow-md border border-black/10 flex items-center justify-center text-[#171717] hover:bg-gray-100 active:scale-95 transition"
          aria-label="Back to home"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Floating Controls on Map Top Right */}
        <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2.5 max-w-[240px]">
          {expandedSection === 'DRIVER' ? (
            <div className="bg-white/95 backdrop-blur shadow-md border border-black/10 px-3 py-1.5 rounded-2xl text-[11px] font-bold text-[#171717] flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${actingIncludeDrop && actingCustomDrop ? 'bg-emerald-500' : 'bg-gray-400'} shrink-0`} />
              <span className="text-[#737373]">Drop:</span>
              <span className="truncate max-w-[90px]">
                {actingIncludeDrop && actingCustomDrop ? actingCustomDrop.name : 'As directed'}
              </span>
            </div>
          ) : (
            <button
              onClick={() => setCustomerScreen('ADD_STOP')}
              className="flex items-center gap-1.5 bg-white shadow-md border border-black/10 px-3.5 py-1.5 rounded-full text-xs font-bold text-[#171717] hover:bg-gray-50 active:scale-95 transition backdrop-blur"
            >
              <Plus className="w-3.5 h-3.5 text-[#171717]" />
              <span>Add stop</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DRAGGABLE VEHICLE SELECTION BOTTOM SHEET                                  */}
      {/* The entire box moves UP and DOWN with touch & mouse dragging              */}
      {/* ========================================================================= */}
      <div
        style={{
          height: `${currentHeightPx}px`,
          transition: isDragging ? 'none' : 'height 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="absolute bottom-0 left-0 right-0 md:left-auto md:right-1/2 md:translate-x-1/2 md:w-[480px] bg-white border-t border-black/10 rounded-t-3xl sm:rounded-t-[32px] shadow-2xl z-30 flex flex-col overflow-hidden will-change-[height]"
      >
        {/* Drag Handle Bar Header (Touch / Mouse drag target) */}
        <div
          onMouseDown={(e) => startDrag(e.clientY)}
          onTouchStart={(e) => {
            if (e.touches[0]) startDrag(e.touches[0].clientY);
          }}
          className="w-full pt-3 pb-2 px-4 cursor-grab active:cursor-grabbing shrink-0 flex flex-col items-center justify-center hover:bg-gray-50/50 transition-colors"
          title="Drag vehicle box up or down"
        >
          <div className="w-12 h-1.5 bg-gray-300 hover:bg-gray-400 rounded-full transition-colors" />

          {/* Status Demand Tag */}
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#22A06B] mt-2">
            <span className="w-2 h-2 rounded-full bg-[#22A06B] animate-pulse" />
            <span>Fares are higher due to increased demand</span>
          </div>
        </div>

        {/* Scrollable Vehicle Options Content */}
        <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-3 overscroll-contain">
          {/* 3 Collapsible Accordion Cards */}
          <div className="space-y-2.5">
            {/* Card 1: Vehicles (Cab & Auto) */}
            <div
              onClick={() => {
                const next = expandedSection === 'CAB' ? null : 'CAB';
                setExpandedSection(next);
                if (next === 'CAB') {
                  const isCab = selectedVehicle && typeof selectedVehicle === 'object' &&
                    ['auto', 'mini', 'sedan', 'suv'].includes(selectedVehicle.id);
                  if (!isCab) setSelectedVehicle(CABS_LIST[0] as any);
                }
                if (snapState === 'PEEK') setSnapState('HALF');
              }}
              className={`border rounded-2xl p-3 cursor-pointer transition flex items-center justify-between ${
                expandedSection === 'CAB' ? 'border-[#E85D04] bg-[#FFF7F0]' : 'border-black/10 bg-[#FAFAF8] hover:bg-black/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-9 rounded-xl overflow-hidden border border-black/5 bg-white flex items-center justify-center shrink-0">
                  <img src="/vehicles/red_sedan.jpg" alt="Vehicle" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-[#171717]">Vehicles (Cab & Auto)</h4>
                  <p className="text-[10px] text-[#737373]">Autos, Hatchbacks, Sedans & SUVs</p>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 text-[#737373] transition-transform ${expandedSection === 'CAB' ? 'rotate-90 text-[#E85D04]' : ''}`} />
            </div>

            {/* Expanded Cabs List */}
            {expandedSection === 'CAB' && (
              <div className="space-y-2 pl-2 pr-1">
                {CABS_LIST.map((item) => (
                  <div
                    key={item.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVehicle(item as any);
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      selectedVehicle?.id === item.id ? 'border-[#E85D04] bg-[#FFF7F0]' : 'border-black/10 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={item.image} alt={item.name} className="w-10 h-8 object-contain" />
                      <div>
                        <h5 className="text-xs font-bold text-[#171717]">{item.name}</h5>
                        <p className="text-[10px] text-[#737373]">{item.tagline}</p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-[#171717]">₹{item.fare}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Card 2: Bikes (Moto & Scooty) */}
            <div
              onClick={() => {
                const next = expandedSection === 'BIKE' ? null : 'BIKE';
                setExpandedSection(next);
                if (next === 'BIKE') {
                  const isBike = selectedVehicle && typeof selectedVehicle === 'object' &&
                    (selectedVehicle.id === 'bike' || selectedVehicle.id === 'scooter');
                  if (!isBike) setSelectedVehicle(BIKES_LIST[0] as any);
                }
                if (snapState === 'PEEK') setSnapState('HALF');
              }}
              className={`border rounded-2xl p-3 cursor-pointer transition flex items-center justify-between ${
                expandedSection === 'BIKE' ? 'border-[#E85D04] bg-[#FFF7F0]' : 'border-black/10 bg-[#FAFAF8] hover:bg-black/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-9 rounded-xl overflow-hidden border border-black/5 bg-white flex items-center justify-center shrink-0">
                  <img src="/vehicles/bike.jpg" alt="Bike" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-[#171717]">Bikes (Moto & Scooty)</h4>
                  <p className="text-[10px] text-[#737373]">Quick solo rides & budget travel</p>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 text-[#737373] transition-transform ${expandedSection === 'BIKE' ? 'rotate-90 text-[#E85D04]' : ''}`} />
            </div>

            {/* Expanded Bikes List */}
            {expandedSection === 'BIKE' && (
              <div className="space-y-2 pl-2 pr-1">
                {BIKES_LIST.map((item) => (
                  <div
                    key={item.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVehicle(item as any);
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      selectedVehicle?.id === item.id ? 'border-[#E85D04] bg-[#FFF7F0]' : 'border-black/10 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={item.image} alt={item.name} className="w-10 h-8 object-contain" />
                      <div>
                        <h5 className="text-xs font-bold text-[#171717]">{item.name}</h5>
                        <p className="text-[10px] text-[#737373]">{item.tagline}</p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-[#171717]">₹{item.fare}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Card 3: Acting Driver Hire */}
            <div
              onClick={() => {
                const next = expandedSection === 'DRIVER' ? null : 'DRIVER';
                setExpandedSection(next);
                if (snapState === 'PEEK') setSnapState('HALF');
              }}
              className={`border rounded-2xl p-3 cursor-pointer transition flex items-center justify-between ${
                expandedSection === 'DRIVER' ? 'border-[#E85D04] bg-[#FFF7F0]' : 'border-black/10 bg-[#FAFAF8] hover:bg-black/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-9 rounded-xl overflow-hidden border border-black/5 bg-[#FFF7F0] flex items-center justify-center text-base shrink-0">
                  👨‍✈️
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-[#171717]">Acting Driver Hire</h4>
                  <p className="text-[10px] text-[#737373]">Hire verified driver for your personal vehicle</p>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 text-[#737373] transition-transform ${expandedSection === 'DRIVER' ? 'rotate-90 text-[#E85D04]' : ''}`} />
            </div>

            {/* Expanded Driver Options */}
            {expandedSection === 'DRIVER' && (
              <div className="p-3 border border-black/10 rounded-xl space-y-3 bg-[#FAFAF8]">

                {/* 1. Optional Drop Destination Choice for Acting Driver */}
                <div className="bg-white border border-black/10 rounded-xl p-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={actingIncludeDrop}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setActingIncludeDrop(checked);
                          if (checked && !actingCustomDrop && dropLocation) {
                            setActingCustomDrop(dropLocation);
                          }
                        }}
                        className="w-4 h-4 text-[#E85D04] rounded accent-[#E85D04] cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[#171717]">
                        Specify Drop Destination <span className="text-[10px] text-[#737373] font-normal">(Optional)</span>
                      </span>
                    </label>
                    {actingIncludeDrop && actingCustomDrop && (
                      <button
                        type="button"
                        onClick={() => {
                          setActingIncludeDrop(false);
                          setActingCustomDrop(null);
                        }}
                        className="text-[10px] font-bold text-rose-500 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {actingIncludeDrop ? (
                    <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-[#171717] block truncate">
                          {actingCustomDrop ? actingCustomDrop.name : 'No drop location selected'}
                        </span>
                        <span className="text-[10px] text-[#737373] block truncate">
                          {actingCustomDrop?.address || 'Tap to choose destination'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomerScreen('SEARCH_LOCATION')}
                        className="text-xs font-bold text-[#E85D04] hover:underline ml-2 shrink-0 bg-[#FFF7F0] border border-[#E85D04]/30 px-2 py-1 rounded-lg"
                      >
                        {actingCustomDrop ? 'Change' : '+ Select Drop'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-[#737373] mt-1 pl-6">
                      Only pickup needed. Driver will drive wherever you direct on hourly hire.
                    </p>
                  )}
                </div>

                {/* 2. Transmission Type (Manual vs Automatic) */}
                <div>
                  <label className="text-[10px] font-bold text-[#737373] uppercase block mb-1.5">
                    Transmission
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setActingTransmission('MANUAL')}
                      className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        actingTransmission === 'MANUAL'
                          ? 'bg-[#E85D04] text-white border-[#E85D04]'
                          : 'bg-white text-[#171717] border-black/10'
                      }`}
                    >
                      <span>🕹️</span>
                      <span>Manual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActingTransmission('AUTOMATIC')}
                      className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        actingTransmission === 'AUTOMATIC'
                          ? 'bg-[#E85D04] text-white border-[#E85D04]'
                          : 'bg-white text-[#171717] border-black/10'
                      }`}
                    >
                      <span>⚡</span>
                      <span>Automatic</span>
                    </button>
                  </div>
                </div>

                {/* Vehicle Registration Number (Optional upfront) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-[#737373] uppercase">
                      Vehicle Number <span className="text-[#A3A3A3] font-normal normal-case">(Optional during booking)</span>
                    </label>
                    {regValidation?.isValid && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Format Valid ✓
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={vehicleNumberInput}
                    onChange={(e) => {
                      setVehicleNumberInput(e.target.value.toUpperCase());
                      if (driverValidationError) setDriverValidationError(null);
                    }}
                    placeholder="e.g. TN 38 AB 1234 or 22 BH 1234 AA"
                    className="w-full bg-white border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-[#171717] outline-none font-mono uppercase focus:border-[#E85D04] transition"
                  />

                  {/* Real-time Format Feedback */}
                  {!vehicleNumberInput.trim() ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-[#737373] mt-1.5 bg-black/5 px-2.5 py-1 rounded-lg">
                      <Info className="w-3 h-3 text-[#737373] shrink-0" />
                      <span>Optional upfront — can be provided before service starts</span>
                    </div>
                  ) : regValidation?.isValid ? (
                    <div className="flex items-center justify-between text-[10px] text-emerald-700 mt-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Format Valid: <strong className="font-mono">{regValidation.formatted}</strong></span>
                      </div>
                      <span className="text-[9px] text-emerald-600 font-medium">Official verif. unconfigured</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-700 mt-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg font-bold">
                      <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>{regValidation?.errorMessage || 'Invalid registration format (e.g. TN 38 AB 1234)'}</span>
                    </div>
                  )}

                  {driverValidationError && (
                    <p className="text-rose-600 text-[10px] mt-1 font-bold">{driverValidationError}</p>
                  )}
                </div>

                {/* Duration Hours */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-[#737373] uppercase">
                      Hire Duration
                    </label>
                    <span className="text-[10px] font-extrabold text-[#E85D04]">₹{driverRatePerHour} / hour</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 4, 8, 12, 24].map((hr) => (
                      <button
                        key={hr}
                        onClick={() => setActingDriverHours(hr)}
                        className={`py-1.5 text-[11px] font-bold rounded-lg border transition ${
                          actingDriverHours === hr
                            ? 'bg-[#E85D04] text-white border-[#E85D04] shadow-xs'
                            : 'bg-white text-[#171717] border-black/10 hover:border-black/20'
                        }`}
                      >
                        {hr} {hr === 1 ? 'Hr' : 'Hrs'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pricing Breakdown Card */}
                <div className="bg-white border border-black/5 rounded-xl p-2.5 space-y-1 text-[11px]">
                  <div className="flex justify-between text-[#737373]">
                    <span>Base Price ({actingDriverHours} hrs × ₹{driverRatePerHour}/hr)</span>
                    <span className="font-semibold text-[#171717]">₹{driverBasePrice}</span>
                  </div>
                  <div className="flex justify-between text-[#737373]">
                    <span>Platform Fee</span>
                    <span className="font-semibold text-[#171717]">₹{driverPlatformFee}</span>
                  </div>
                  <div className="flex justify-between text-[#737373]">
                    <span>GST (5%)</span>
                    <span className="font-semibold text-[#171717]">₹{driverTax}</span>
                  </div>
                  <div className="flex justify-between text-xs font-extrabold text-[#171717] pt-1 border-t border-black/5">
                    <span>Estimated Total</span>
                    <span className="text-[#E85D04]">₹{driverEstimatedTotal}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-[#22A06B] font-semibold bg-[#22A06B]/10 px-2 py-1 rounded-lg">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#22A06B] shrink-0" />
                  <span>You provide vehicle • Verified professional driver arrives</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Footer (Payment, Offers & Solid Orange Book Button) */}
        <div className="px-4 py-3 border-t border-black/5 bg-white space-y-2.5 shrink-0">
          {/* Payment & Offers Bar */}
          <div className="flex items-center justify-between text-xs font-bold">
            <div
              onClick={() => setCustomerScreen('PAYMENT_METHODS')}
              className="flex items-center gap-1.5 cursor-pointer text-[#171717] hover:text-[#E85D04]"
            >
              <span className="text-blue-600 font-extrabold">G Pay</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#737373]" />
            </div>

            <div
              onClick={() => setCustomerScreen('COUPONS')}
              className="flex items-center gap-1.5 cursor-pointer text-[#E85D04] hover:underline"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>% Offers</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Main Solid Rapido Orange Action Button */}
          <button
            onClick={handleBookClick}
            className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white text-sm font-extrabold py-3.5 rounded-2xl shadow-lg shadow-[#E85D04]/30 active:scale-98 transition flex items-center justify-center gap-2"
          >
            <span>{buttonText}</span>
            {displayedFare && <span>• ₹{displayedFare}</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
