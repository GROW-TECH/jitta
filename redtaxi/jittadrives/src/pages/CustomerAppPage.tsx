import React, { useEffect } from 'react';
import { useTaxiApp } from '../context/TaxiAppContext';
import { CustomerAuthFlow } from '../components/customer/CustomerAuthFlow';
import { CustomerHomeView } from '../components/customer/CustomerHomeView';
import { CustomerBookingFlow } from '../components/customer/CustomerBookingFlow';
import { CustomerActiveTripView } from '../components/customer/CustomerActiveTripView';
import { CustomerPostTripView } from '../components/customer/CustomerPostTripView';
import { CustomerAccountViews } from '../components/customer/CustomerAccountViews';
import { CustomerFooterNav } from '../components/customer/CustomerFooterNav';

const AUTH_SCREENS = ['SPLASH', 'ONBOARDING', 'LOGIN', 'OTP', 'REGISTER'];

const GUEST_ALLOWED_SCREENS = [
  'HOME',
  'SEARCH_LOCATION',
  'PICKUP_PIN',
  'DESTINATION_CONFIRM',
  'ADD_STOP',
  'RIDE_TYPES',
  'VEHICLE_SELECT',
  'FARE_DETAILS',
  'COUPONS',
  'PAYMENT_METHOD',
  'BOOKING_CONFIRM',
  'PROFILE',
  'OFFERS',
];

const SCREENS_WITHOUT_FOOTER = [
  ...AUTH_SCREENS,
  'PICKUP_PIN',
  'SEARCHING_DRIVER',
  'DRIVER_ASSIGNED',
  'DRIVER_EN_ROUTE',
  'DRIVER_ARRIVED',
  'TRIP_STARTED',
  'LIVE_TRIP',
  'SOS',
  'CHAT',
  'SHARE_TRIP',
  'TRIP_COMPLETED',
  'PAYMENT_COMPLETED',
  'RATING',
  'INVOICE',
];

export const CustomerAppPage: React.FC = () => {
  const {
    customerScreen,
    setCustomerScreen,
    isCustomerAuthenticated,
    setPickupLocation,
    setDropLocation,
  } = useTaxiApp();

  // Read incoming pickup and drop locations from marketing hero search
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const pickupParam = searchParams.get('pickup');
    const dropParam = searchParams.get('drop');

    if (pickupParam || dropParam) {
      if (pickupParam) {
        setPickupLocation({
          name: pickupParam,
          address: pickupParam,
          lat: 11.6643,
          lng: 78.1460,
          category: 'POPULAR',
        });
      }
      if (dropParam) {
        setDropLocation({
          name: dropParam,
          address: dropParam,
          lat: 11.6500,
          lng: 78.1600,
          category: 'POPULAR',
        });
      }
      setCustomerScreen('SEARCH_LOCATION');
      // Clean query params from address bar so it never re-triggers on screen transitions
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [setPickupLocation, setDropLocation, setCustomerScreen]);

  // Route guard: only protect private account and active trip screens, allow full guest exploration
  useEffect(() => {
    if (
      !isCustomerAuthenticated &&
      !AUTH_SCREENS.includes(customerScreen) &&
      !GUEST_ALLOWED_SCREENS.includes(customerScreen)
    ) {
      sessionStorage.setItem('jitta_pending_customer_screen', customerScreen);
      setCustomerScreen('LOGIN');
    }
  }, [isCustomerAuthenticated, customerScreen, setCustomerScreen]);

  const isFixedLayoutScreen = [
    'HOME',
    'LIVE_TRIP',
    'DRIVER_EN_ROUTE',
    'DRIVER_ARRIVED',
    'TRIP_STARTED',
    'SEARCHING_DRIVER',
    'DRIVER_ASSIGNED',
  ].includes(customerScreen);

  const shouldShowFooter = !SCREENS_WITHOUT_FOOTER.includes(customerScreen);

  return (
    <div className="relative h-[100dvh] w-full max-w-full overflow-hidden flex flex-col bg-[#FAFAF8] text-[#171717]">
      <div
        className={`flex-1 min-h-0 ${isFixedLayoutScreen ? 'overflow-hidden' : 'overflow-y-auto'} overflow-x-hidden relative flex flex-col scrollbar-none`}
      >
        <div className="w-full h-full flex-1 flex flex-col min-w-0">
          {/* Auth Screen */}
          {AUTH_SCREENS.includes(customerScreen) && <CustomerAuthFlow />}

          {/* Home View: Open to both Guests & Authenticated Users */}
          {customerScreen === 'HOME' && <CustomerHomeView />}

          {/* Booking Flow: Open to both Guests & Authenticated Users for Route picking, Vehicle Selection & Fare Estimation */}
          {[
            'SEARCH_LOCATION',
            'PICKUP_PIN',
            'DESTINATION_CONFIRM',
            'ADD_STOP',
            'RIDE_TYPES',
            'VEHICLE_SELECT',
            'FARE_DETAILS',
            'COUPONS',
            'PAYMENT_METHOD',
            'BOOKING_CONFIRM',
          ].includes(customerScreen) && <CustomerBookingFlow />}

          {/* Active Trip Views: Requires Authenticated Customer */}
          {isCustomerAuthenticated &&
            [
              'SEARCHING_DRIVER',
              'NO_DRIVERS_AVAILABLE',
              'DRIVER_ASSIGNED',
              'DRIVER_EN_ROUTE',
              'DRIVER_ARRIVED',
              'TRIP_STARTED',
              'LIVE_TRIP',
              'SOS',
              'CHAT',
              'SHARE_TRIP',
            ].includes(customerScreen) && <CustomerActiveTripView />}

          {/* Post Trip Views: Requires Authenticated Customer */}
          {isCustomerAuthenticated &&
            ['TRIP_COMPLETED', 'PAYMENT_COMPLETED', 'RATING', 'INVOICE'].includes(customerScreen) && (
              <CustomerPostTripView />
            )}

          {/* Account Views: Open if authenticated, or if viewing guest-accessible screens (PROFILE, OFFERS) */}
          {([
            'MY_RIDES',
            'RIDE_DETAILS',
            'RENTAL_BOOKING',
            'OUTSTATION_BOOKING',
            'AIRPORT_BOOKING',
            'DRIVER_ONLY_BOOKING',
            'GIFT_CARD',
            'OFFERS',
            'NOTIFICATIONS',
            'PROFILE',
            'SAVED_PLACES',
            'SUPPORT',
          ].includes(customerScreen) && (isCustomerAuthenticated || ['PROFILE', 'OFFERS'].includes(customerScreen))) && (
            <CustomerAccountViews />
          )}
        </div>
      </div>
      {shouldShowFooter && <CustomerFooterNav />}
    </div>
  );
};
