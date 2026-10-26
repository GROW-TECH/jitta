import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TaxiAppProvider } from './context/TaxiAppContext';
import { CustomerAppPage } from './pages/CustomerAppPage';
import { DriverAppPage } from './pages/DriverAppPage';
import { MarketingLandingPage } from './pages/MarketingLandingPage';

function isNativeMobileApp(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Explicit Capacitor Native Bridge check
  const cap = (window as any).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  if (typeof cap?.getPlatform === 'function' && cap.getPlatform() !== 'web') return true;

  // 2. Query parameter or hash overrides (for testing app mode directly in browser)
  const search = window.location.search || '';
  if (search.includes('mode=app') || search.includes('app=customer') || window.location.hash === '#app') {
    return true;
  }

  // 3. User Agent Inspection for WebView / Capacitor
  const ua = (navigator.userAgent || '').toLowerCase();
  if (ua.includes('capacitor')) return true;

  // Android WebView indicators
  const isAndroid = ua.includes('android');
  const isWebView = ua.includes('; wv') || ua.includes('version/4.0') || (isAndroid && ua.includes('wv'));
  if (isAndroid && isWebView) return true;

  return false;
}

function getDynamicBasename(): string {
  const knownRoutes = ['customer', 'driver', 'user', 'admin', 'book'];
  const segments = window.location.pathname.split('/').filter(Boolean);
  if (segments.length > 0 && !knownRoutes.includes(segments[0].toLowerCase())) {
    return '/' + segments[0];
  }
  return '';
}

export function App() {
  const basename = getDynamicBasename();
  const envRole = (import.meta.env.VITE_APP_ROLE || '').toLowerCase();
  const isDriver = envRole === 'driver' || window.location.port === '5175';
  const isNative = isNativeMobileApp();

  return (
    <TaxiAppProvider>
      <BrowserRouter basename={basename}>
        <Routes>
          {/* Root Route:
              - Driver APK/dev -> DriverAppPage
              - Native Customer APK -> CustomerAppPage (bypasses website completely)
              - Standard Web Browser -> MarketingLandingPage (Rapido-style site)
          */}
          <Route
            path="/"
            element={
              isDriver ? (
                <DriverAppPage />
              ) : isNative ? (
                <CustomerAppPage />
              ) : (
                <MarketingLandingPage />
              )
            }
          />
          <Route path="/customer" element={<CustomerAppPage />} />
          <Route path="/customer/*" element={<CustomerAppPage />} />
          <Route path="/book" element={<CustomerAppPage />} />
          <Route path="/driver" element={<DriverAppPage />} />
          <Route path="/driver/*" element={<DriverAppPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TaxiAppProvider>
  );
}

export default App;