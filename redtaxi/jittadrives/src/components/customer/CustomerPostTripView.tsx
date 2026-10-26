import React, { useState } from 'react';
import {
  CheckCircle2,
  Star,
  Download,
  ChevronRight,
  ArrowLeft,
  User,
  Loader2,
} from 'lucide-react';
import { useTaxiApp } from '../../context/TaxiAppContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const CustomerPostTripView: React.FC = () => {
  const {
    language,
    customerScreen,
    setCustomerScreen,
    activeBooking,
    setActiveBooking,
    allBookings,
    rateDriver,
    refreshCustomerData,
    driverProfile,
    selectedInvoiceBooking,
    setSelectedInvoiceBooking,
    customerProfile,
  } = useTaxiApp();

  const [ratingStars, setRatingStars] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Punctual', 'Clean Cab']);
  const [reviewText, setReviewText] = useState<string>('Driver was polite, drove safely, and vehicle was spotless!');
  const [invoiceDownloaded, setInvoiceDownloaded] = useState<boolean>(false);

  const booking = selectedInvoiceBooking || activeBooking || allBookings[0];

  const ratingBadges = ['Punctual', 'Clean Cab', 'Polite Active Driver', 'Safe Driving', 'Smooth Route'];

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [canSubmit, setCanSubmit] = useState<boolean>(false);

  React.useEffect(() => {
    if (customerScreen === 'RATING') {
      setIsSubmitting(false);
      const timer = setTimeout(() => setCanSubmit(true), 350);
      return () => clearTimeout(timer);
    } else {
      setCanSubmit(false);
      setIsSubmitting(false);
    }
  }, [customerScreen]);

  const dismissCompletedRide = (nextScreen: any) => {
    const bId = booking?.id || activeBooking?.id;
    if (bId) {
      try {
        localStorage.setItem('dismissed_booking_' + bId, 'true');
      } catch {}
    }
    if (nextScreen === 'HOME') {
      setActiveBooking(null);
      setSelectedInvoiceBooking(null);
    } else if (booking) {
      setSelectedInvoiceBooking(booking);
    }
    setCustomerScreen(nextScreen);
  };

  const downloadInvoice = () => {
    if (!booking) return;

    const doc = new jsPDF();

    // Premium Color Palette
    const brandOrange: [number, number, number] = [232, 93, 4];      // #E85D04
    const darkHeader: [number, number, number] = [24, 24, 27];       // #18181B Dark Charcoal
    const textDark: [number, number, number] = [15, 23, 42];         // #0F172A
    const textMuted: [number, number, number] = [100, 116, 139];     // #64748B
    const emeraldGreen: [number, number, number] = [16, 185, 129];   // #10B981
    const roseRed: [number, number, number] = [239, 68, 68];         // #EF4444
    const cardBg: [number, number, number] = [248, 250, 252];        // #F8FAFC
    const cardBorder: [number, number, number] = [226, 232, 240];    // #E2E8F0

    // 1. Top Brand Accent Line (3mm)
    doc.setFillColor(...brandOrange);
    doc.rect(0, 0, 210, 3, 'F');

    // 2. Header Background (42mm)
    doc.setFillColor(...darkHeader);
    doc.rect(0, 3, 210, 42, 'F');

    // 3. Brand Logo / Name: "Jitta Drives"
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text('Jitta', 14, 20);
    const jittaWidth = doc.getTextWidth('Jitta');
    doc.setTextColor(...brandOrange);
    doc.text('Drives', 14 + jittaWidth + 2, 20);

    // Tagline & Company Details
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225); // Slate 300
    doc.text('We drive your Rides • Premier City & Outstation Rides', 14, 27);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text('GSTIN: 33AAAAA0000A1Z5 • Jitta Drives India Pvt Ltd • Tamil Nadu', 14, 34);

    // 4. "PAID RECEIPT" Pill Badge (Right side)
    doc.setFillColor(...emeraldGreen);
    doc.roundedRect(156, 12, 40, 11, 2.5, 2.5, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('PAID RECEIPT', 176, 19, { align: 'center' });

    let y = 52;

    // 5. Booking Info Card
    doc.setFillColor(...cardBg);
    doc.roundedRect(14, y, 182, 18, 2, 2, 'F');
    doc.setDrawColor(...cardBorder);
    doc.roundedRect(14, y, 182, 18, 2, 2, 'S');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('BOOKING ID', 20, y + 6);
    doc.text('DATE & TIME', 110, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textDark);
    doc.setFontSize(9);
    doc.text(String(booking.id || 'N/A'), 20, y + 13);
    doc.text(booking.createdAt ? booking.createdAt.substring(0, 19) : 'N/A', 110, y + 13);

    y += 24;

    // 6. Customer & Vehicle 2-Column Cards
    const cardW = 88;
    const cardH = 22;

    // Left: Customer
    doc.setFillColor(...cardBg);
    doc.roundedRect(14, y, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(...cardBorder);
    doc.roundedRect(14, y, cardW, cardH, 2, 2, 'S');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('CUSTOMER', 20, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textDark);
    doc.setFontSize(9.5);
    doc.text(booking.customerName || customerProfile?.name || 'Customer', 20, y + 13);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text(booking.customerPhone || customerProfile?.phone || '', 20, y + 18);

    // Right: Vehicle & Driver
    doc.setFillColor(...cardBg);
    doc.roundedRect(108, y, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(...cardBorder);
    doc.roundedRect(108, y, cardW, cardH, 2, 2, 'S');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('VEHICLE & DRIVER', 114, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textDark);
    doc.setFontSize(9.5);
    const vehicleText = booking.vehicleCategory || booking.vehicleModel || 'Taxi';
    doc.text(vehicleText, 114, y + 13);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandOrange);
    const plateText = booking.vehicleNumber || 'Registered Vehicle';
    const driverNameText = booking.driverName ? ` • ${booking.driverName}` : '';
    doc.text(`${plateText}${driverNameText}`, 114, y + 18);

    y += 28;

    // 7. Route Details Box
    doc.setFillColor(...cardBg);
    doc.roundedRect(14, y, 182, 30, 2, 2, 'F');
    doc.setDrawColor(...cardBorder);
    doc.roundedRect(14, y, 182, 30, 2, 2, 'S');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('TRIP ROUTE', 20, y + 6);

    // Pickup Dot (Green)
    doc.setFillColor(...emeraldGreen);
    doc.circle(22, y + 12, 2, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    const pickupStr = booking.pickup?.name || (typeof booking.pickup === 'string' ? booking.pickup : 'Pickup');
    doc.text(pickupStr, 28, y + 13, { maxWidth: 160 });

    // Dotted line connecting dots
    doc.setDrawColor(...textMuted);
    doc.line(22, y + 15, 22, y + 19);

    // Drop Dot (Red)
    doc.setFillColor(...roseRed);
    doc.circle(22, y + 22, 2, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    const dropStr = booking.drop?.name || (typeof booking.drop === 'string' ? booking.drop : 'Drop');
    doc.text(dropStr, 28, y + 23, { maxWidth: 160 });

    y += 36;

    // 8. Itemized Fare Table (AutoTable) with 100% proper width and Rs. currency formatting
    const baseFare = Number(booking.fare?.baseFare || 0).toFixed(2);
    const distFare = Number(booking.fare?.distanceFare || 0).toFixed(2);
    const platformFee = Number(booking.fare?.platformFee || 0).toFixed(2);
    const tax = Number(booking.fare?.tax || 0).toFixed(2);
    const discount = Number(booking.fare?.discount || 0);
    const totalFare = Number(booking.fare?.totalFare || 0).toFixed(2);
    const distanceKm = booking.distanceKm ? `${booking.distanceKm} km` : '';

    const tableBody: any[] = [
      ['Base Fare', `Rs. ${baseFare}`],
      [`Distance Fare ${distanceKm ? `(${distanceKm})` : ''}`, `Rs. ${distFare}`],
      ['Platform Fee', `Rs. ${platformFee}`],
      ['GST Tax (5%)', `Rs. ${tax}`],
    ];

    if (discount > 0) {
      tableBody.push(['Coupon Discount', `- Rs. ${discount.toFixed(2)}`]);
    }

    const paymentLabel = booking.paymentMethod ? `Total Amount Paid (${booking.paymentMethod})` : 'Total Amount Paid';

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Amount (Rs.)']],
      body: tableBody,
      foot: [[paymentLabel, `Rs. ${totalFare}`]],
      theme: 'striped',
      margin: { left: 14, right: 14 },
      headStyles: {
        fillColor: darkHeader,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 6 },
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: textDark,
        cellPadding: { top: 3, bottom: 3, left: 5, right: 6 },
      },
      footStyles: {
        fillColor: darkHeader,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9.5,
        cellPadding: { top: 4, bottom: 4, left: 5, right: 6 },
      },
      columnStyles: {
        0: { cellWidth: 125, fontStyle: 'normal' },
        1: { cellWidth: 57, halign: 'right', fontStyle: 'bold' },
      },
      tableLineColor: [226, 232, 240],
      tableLineWidth: 0.1,
    });

    // 9. Footer Notes & Support
    const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 14 : 240;

    doc.setDrawColor(...cardBorder);
    doc.line(14, finalY, 196, finalY);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text('This is a computer-generated tax invoice and does not require a physical signature.', 105, finalY + 6, { align: 'center' });
    doc.text('Thank you for riding with Jitta Drives! For support, email support@jittadrives.com or call 24x7 support.', 105, finalY + 11, { align: 'center' });

    // Save PDF
    doc.save(`Jitta_Drives_Invoice_${booking.id}.pdf`);
    setInvoiceDownloaded(true);

    // Reset indicator after 3 seconds
    setTimeout(() => setInvoiceDownloaded(false), 3000);
  };

  // 25 & 26. Trip Completed & Payment Receipt Screen
  if (customerScreen === 'TRIP_COMPLETED' || customerScreen === 'PAYMENT_COMPLETED') {
    return (
      <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-4 sm:p-6 overflow-y-auto">
        <div>
          <div className="flex justify-center mb-4 sm:mb-6">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#22A06B]/10 text-[#22A06B] rounded-full flex items-center justify-center ring-8 ring-[#22A06B]/10 border border-[#22A06B]/30">
              <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
          </div>

          <div className="text-center space-y-1 mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#171717]">
              {language === 'ta' ? 'பயணம் நிறைவடைந்தது!' : 'Ride Completed!'}
            </h2>
            <p className="text-[#737373] text-xs">
              {language === 'ta'
                ? `${booking.paymentMethod} மூலம் பணம் செலுத்தப்பட்டது`
                : `Payment Successful via ${booking.paymentMethod}`}
            </p>
            <div className="text-2xl sm:text-3xl font-black text-[#E85D04] mt-2">₹{booking.fare.totalFare}</div>
          </div>

          {/* Trip Summary Details */}
          <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 space-y-3 shadow-xl text-xs mb-4 sm:mb-6">
            <div className="flex items-center justify-between border-b border-black/5 pb-2 gap-2">
              <span className="text-[#737373] shrink-0">{language === 'ta' ? 'முன்பதிவு எண்' : 'Booking ID'}</span>
              <span className="font-bold text-[#171717] truncate max-w-[150px] sm:max-w-none">{booking.id}</span>
            </div>
            <div className="space-y-1 border-b border-black/5 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#22A06B]" />
                <span className="text-[#525252] truncate">{booking.pickup.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <span className="text-[#525252] truncate">{booking.drop.name}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
              <div className="bg-[#F9F5F0] p-2 rounded-xl border border-black/5">
                <span className="text-[#A3A3A3] block">{language === 'ta' ? 'தொலைவு' : 'Distance'}</span>
                <span className="font-bold text-[#171717]">{booking.distanceKm} KM</span>
              </div>
              <div className="bg-[#F9F5F0] p-2 rounded-xl border border-black/5">
                <span className="text-[#A3A3A3] block">{language === 'ta' ? 'நேரம்' : 'Duration'}</span>
                <span className="font-bold text-[#171717]">{booking.durationMin} mins</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => dismissCompletedRide('RATING')}
            className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2"
          >
            <span>{language === 'ta' ? 'மதிப்பீடு செய்து ரசீதை காண்க' : 'Rate Driver & View Invoice'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => dismissCompletedRide('INVOICE')}
            className="w-full bg-white hover:bg-[#F5F5F3] text-[#171717] font-bold py-2.5 rounded-2xl border border-black/10 flex items-center justify-center gap-2 text-xs transition"
          >
            <span>{language === 'ta' ? 'ரசீதை மட்டும் காண்க' : 'View Tax Invoice Directly'}</span>
          </button>

          <button
            onClick={() => dismissCompletedRide('HOME')}
            className="w-full text-xs text-[#737373] hover:text-[#171717] py-1.5 transition text-center"
          >
            {language === 'ta' ? 'முகப்புக்குச் செல்' : 'Skip to Home'}
          </button>
        </div>
      </div>
    );
  }

  // 27. Rating Screen
  if (customerScreen === 'RATING') {
    return (
      <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-4 sm:p-6 overflow-y-auto">
        <div>
          <div className="text-center space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
            {(booking.driverPhoto || driverProfile.photo) ? (
              <img
                src={booking.driverPhoto || driverProfile.photo}
                alt="Driver"
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full mx-auto object-cover border-2 border-[#E85D04] shadow-lg"
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full mx-auto bg-gray-100 border-2 border-[#E85D04]/30 flex items-center justify-center text-[#E85D04] shadow-lg">
                <User className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
            )}
            <h2 className="text-base sm:text-xl font-bold">How was your ride with {booking.driverName || driverProfile.name}?</h2>
            <p className="text-[#737373] text-xs">Your rating helps us maintain top quality service.</p>
          </div>

          {/* Interactive Star Selection */}
          <div className="flex justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRatingStars(star)}
                className="p-1 transition transform active:scale-110 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={`Rate ${star} star`}
              >
                <Star
                  className={`w-7 h-7 sm:w-8 sm:h-8 ${
                    star <= ratingStars
                      ? 'text-amber-400 fill-amber-400 drop-shadow-md'
                      : 'text-[#E8D9C4] fill-[#F4EADC]'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Tag Badges */}
          <div className="space-y-2 mb-4 sm:mb-6">
            <span className="text-xs text-[#737373] font-semibold block text-center">What did you like most?</span>
            <div className="flex flex-wrap justify-center gap-2">
              {ratingBadges.map((tag) => {
                const isSel = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-3 py-1.5 rounded-xl border transition ${
                      isSel
                        ? 'bg-[#E85D04] text-white border-[#E85D04] font-bold shadow'
                        : 'bg-white text-[#737373] border-black/10 hover:border-black/20'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Review Text Area */}
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Write a comment..."
            maxLength={500}
            className="w-full bg-white border border-black/10 rounded-2xl p-3 text-xs text-[#171717] outline-none focus:border-[#E85D04] h-20 resize-none placeholder-[#A3A3A3]"
          />
        </div>

        <div className="space-y-2">
          <button
            disabled={isSubmitting}
            onClick={async (e) => {
              e.preventDefault();
              if (isSubmitting) return;
              setIsSubmitting(true);
              try {
                await rateDriver(ratingStars, reviewText);
              } catch (err) {
                console.warn('Rating submission error:', err);
              } finally {
                setIsSubmitting(false);
                dismissCompletedRide('INVOICE');
              }
            }}
            className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold py-3.5 rounded-2xl shadow-lg transition disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{language === 'ta' ? 'சமர்ப்பிக்கப்படுகிறது...' : 'Submitting...'}</span>
              </>
            ) : (
              <span>{language === 'ta' ? 'மதிப்பீட்டைச் சமர்ப்பித்து ரசீதை காண்க' : 'Submit & View Invoice'}</span>
            )}
          </button>

          <button
            onClick={() => dismissCompletedRide('INVOICE')}
            className="w-full text-xs text-[#E85D04] hover:underline py-1.5 transition text-center font-bold"
          >
            {language === 'ta' ? 'மதிப்பீட்டைத் தவிர்த்து ரசீதை காண்க' : 'View Invoice Directly'}
          </button>

          <button
            onClick={() => dismissCompletedRide('HOME')}
            className="w-full text-xs text-[#737373] hover:text-[#171717] py-1 transition text-center"
          >
            {language === 'ta' ? 'தவிர்த்து முகப்புக்குச் செல்' : 'Skip for Now'}
          </button>
        </div>
      </div>
    );
  }

  // 28. Professional Tax Invoice Screen
  if (customerScreen === 'INVOICE') {
    if (!booking) {
      return (
        <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-6">
          <div className="text-center py-12 space-y-3">
            <h2 className="text-lg font-bold">Tax Invoice</h2>
            <p className="text-xs text-[#737373]">No invoice details found for this selection.</p>
          </div>
          <button
            onClick={() => {
              setActiveBooking(null);
              setSelectedInvoiceBooking(null);
              setCustomerScreen('HOME');
            }}
            className="w-full bg-[#E85D04] text-white font-bold py-3.5 rounded-2xl shadow-lg"
          >
            Back to Home
          </button>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col justify-between bg-[#FAFAF8] text-[#171717] p-3.5 sm:p-6 overflow-y-auto">
        <div>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <button
              onClick={() => dismissCompletedRide('HOME')}
              className="w-9 h-9 bg-white rounded-xl border border-black/10 flex items-center justify-center text-[#737373] hover:text-[#171717] min-h-[36px] min-w-[36px]"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-sm sm:text-base font-bold">Tax Invoice</h2>
            <div className="w-9" />
          </div>

          {/* Invoice Card UI */}
          <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 space-y-3 sm:space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#E85D04] text-white text-[9px] font-extrabold px-2.5 sm:px-3 py-1 rounded-bl-2xl uppercase">
              PAID RECEIPT
            </div>

            <div className="border-b border-black/10 pb-2.5 sm:pb-3">
              <h3 className="font-black text-base sm:text-lg tracking-wider text-[#171717]">Jitta <span className="text-[#E85D04]">Drives</span></h3>
              <p className="text-[9px] sm:text-[10px] text-[#737373] truncate">GSTIN: 33AAAAA0000A1Z5 • Jitta Drives India Pvt Ltd</p>
            </div>

            {/* Booking & Date */}
            <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-black/10 pb-2.5">
              <div className="min-w-0">
                <span className="text-[#A3A3A3] block text-[10px]">Booking ID</span>
                <span className="font-bold text-[#171717] truncate block max-w-[120px] sm:max-w-none">{booking.id}</span>
              </div>
              <div className="min-w-0">
                <span className="text-[#A3A3A3] block text-[10px]">Date & Time</span>
                <span className="font-bold text-[#171717] truncate block">{booking.createdAt ? booking.createdAt.substring(0, 16) : 'N/A'}</span>
              </div>
            </div>

            {/* Customer & Vehicle Details */}
            <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-black/10 pb-2.5">
              <div>
                <span className="text-[#A3A3A3] block">Customer</span>
                <span className="font-bold text-[#171717] truncate block">{booking.customerName || customerProfile.name}</span>
                <span className="text-[10px] text-[#737373]">{booking.customerPhone || customerProfile.phone}</span>
              </div>
              <div>
                <span className="text-[#A3A3A3] block">Vehicle</span>
                <span className="font-bold text-[#171717] truncate block">{(typeof booking.vehicleCategory === 'object' ? (booking.vehicleCategory as any)?.name : booking.vehicleCategory) || booking.vehicleModel || 'Jitta Drives'}</span>
                <span className="text-[10px] text-[#22A06B] font-semibold">{booking.vehicleNumber || 'Standard Fleet'}</span>
              </div>
            </div>

            {/* Route */}
            <div className="space-y-1.5 text-xs border-b border-black/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#22A06B]" />
                <span className="text-[#525252] truncate">{booking.pickup.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <span className="text-[#525252] truncate">{booking.drop.name}</span>
              </div>
            </div>

            {/* Price Table */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[#737373]">
                <span>Base Fare</span>
                <span>₹{booking.fare.baseFare}</span>
              </div>
              <div className="flex justify-between text-[#737373]">
                <span>Distance Fare ({booking.distanceKm} km)</span>
                <span>₹{booking.fare.distanceFare}</span>
              </div>
              <div className="flex justify-between text-[#737373]">
                <span>Platform Fee</span>
                <span>₹{booking.fare.platformFee}</span>
              </div>
              <div className="flex justify-between text-[#737373]">
                <span>GST Tax (5%)</span>
                <span>₹{booking.fare.tax}</span>
              </div>
              {booking.fare.discount > 0 && (
                <div className="flex justify-between text-[#22A06B] font-bold">
                  <span>Coupon Discount</span>
                  <span>-₹{booking.fare.discount}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-[#171717] border-t border-black/10 pt-2.5 mt-1">
                <span>Total Amount Paid</span>
                <span className="text-[#E85D04]">₹{booking.fare.totalFare}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={downloadInvoice}
            disabled={invoiceDownloaded}
            className="w-full bg-white hover:bg-black/5 text-[#171717] font-bold py-3.5 rounded-2xl border border-black/10 flex items-center justify-center gap-2 text-xs shadow disabled:opacity-70"
          >
            <Download className="w-4 h-4 text-[#22A06B]" />
            <span>{invoiceDownloaded ? '✓ Invoice Downloaded (PDF)' : 'Download Invoice PDF'}</span>
          </button>

          <button
            onClick={() => dismissCompletedRide('HOME')}
            className="w-full bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold py-3.5 rounded-2xl shadow-lg"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return null;
};