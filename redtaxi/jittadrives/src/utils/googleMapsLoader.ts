// Singleton Google Maps Loader for JittaDrives
let mapsPromise: Promise<boolean> | null = null;

export const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
  'AIzaSyAAWIhBoOW_zfNpovZWlMY5eadSoNRl1PU';

// Immediate global auth failure handler
if (typeof window !== 'undefined') {
  const notifyAuthFailure = () => {
    (window as any).__googleMapsAuthFailed = true;
    window.dispatchEvent(new CustomEvent('jitta:gmaps-error'));
  };

  (window as any).gm_authFailure = () => {
    notifyAuthFailure();
  };

  // Intercept Google Maps console errors (e.g. RefererNotAllowedMapError, BillingNotEnabledMapError)
  const origConsoleError = console.error;
  console.error = function (...args: any[]) {
    try {
      const msg = args.map((a) => (typeof a === 'string' ? a : a?.message || '')).join(' ');
      if (
        msg.includes('Google Maps') ||
        msg.includes('RefererNotAllowedMapError') ||
        msg.includes('BillingNotEnabledMapError') ||
        msg.includes('ApiNotActivatedMapError') ||
        msg.includes('Your site URL to be authorized')
      ) {
        notifyAuthFailure();
        return; // Suppress console error to keep browser DevTools clean
      }
    } catch {
      // ignore
    }
    return origConsoleError.apply(console, args);
  };

  // Intercept Google Maps console warnings (e.g. loading=async, switching to Leaflet)
  const origConsoleWarn = console.warn;
  console.warn = function (...args: any[]) {
    try {
      const msg = args.map((a) => (typeof a === 'string' ? a : a?.message || '')).join(' ');
      if (
        msg.includes('Google Maps JavaScript API has been loaded directly without loading=async') ||
        msg.includes('Element with name "gmp-') ||
        msg.includes('As of March 1st, 2025, google.maps.places') ||
        msg.includes('[JittaDrives] Google Maps')
      ) {
        return; // Suppress harmless warning
      }
    } catch {
      // ignore
    }
    return origConsoleWarn.apply(console, args);
  };
}

export function isGoogleMapsAuthFailed(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).__googleMapsAuthFailed);
}

export function loadGoogleMaps(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);

  // If already authenticated and available
  if ((window as any).google && (window as any).google.maps && (window as any).google.maps.Map && !isGoogleMapsAuthFailed()) {
    return Promise.resolve(true);
  }

  if (isGoogleMapsAuthFailed()) {
    return Promise.resolve(false);
  }

  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<boolean>((resolve) => {
    let resolved = false;

    const finish = (success: boolean) => {
      if (resolved) return;
      resolved = true;
      resolve(success);
    };

    // Listen for custom failure event
    window.addEventListener('jitta:gmaps-error', () => {
      finish(false);
    }, { once: true });

    // Success callback
    (window as any).__jittaGoogleMapsInit = () => {
      if ((window as any).google?.maps?.Map) {
        finish(true);
      } else {
        finish(false);
      }
    };

    // Check if script tag already in DOM (injected by us) OR Google Maps already loaded by index.html script tag
    const existing = document.querySelector('script[data-jitta-gmaps]');
    if (existing || (window as any).google?.maps) {
      // Google Maps already on the page — just wait a tick for it to fully initialize
      const checkReady = () => {
        if ((window as any).google?.maps?.Map && !isGoogleMapsAuthFailed()) {
          finish(true);
        } else if (!isGoogleMapsAuthFailed()) {
          // Give it a bit more time (async script from index.html still loading)
          setTimeout(checkReady, 200);
        } else {
          finish(false);
        }
      };
      checkReady();
      return;
    }

    const script = document.createElement('script');
    script.setAttribute('data-jitta-gmaps', 'true');
    // Do NOT use loading=async here — classic mode ensures new google.maps.Geocoder() etc. work directly
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_MAPS_API_KEY
    )}&libraries=places,geometry&callback=__jittaGoogleMapsInit`;
    script.async = true;
    script.defer = true;

    script.onerror = (e) => {
      console.warn('[JittaDrives] Google Maps script network load error:', e);
      finish(false);
    };

    document.head.appendChild(script);

    // Timeout safety: if not loaded or blocked within 4.5 seconds, fall back seamlessly
    setTimeout(() => {
      if (!resolved) {
        const ready = Boolean((window as any).google?.maps?.Map) && !isGoogleMapsAuthFailed();
        finish(ready);
      }
    }, 4500);
  });

  return mapsPromise;
}
