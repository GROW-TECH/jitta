// Singleton Google Maps Loader for JittaDrives (Admin)
let mapsPromise: Promise<boolean> | null = null;

export const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
  'AIzaSyAAWIhBoOW_zfNpovZWlMY5eadSoNRl1PU';

if (typeof window !== 'undefined') {
  const notifyAuthFailure = () => {
    (window as any).__googleMapsAuthFailed = true;
    window.dispatchEvent(new CustomEvent('jitta:gmaps-error'));
  };

  (window as any).gm_authFailure = () => {
    notifyAuthFailure();
  };

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

  const origConsoleWarn = console.warn;
  console.warn = function (...args: any[]) {
    try {
      const msg = args.map((a) => (typeof a === 'string' ? a : a?.message || '')).join(' ');
      if (
        msg.includes('Google Maps JavaScript API has been loaded directly without loading=async') ||
        msg.includes('[JittaDrives')
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

    window.addEventListener('jitta:gmaps-error', () => {
      finish(false);
    }, { once: true });

    (window as any).__jittaGoogleMapsInitAdmin = () => {
      if ((window as any).google?.maps?.Map) {
        finish(true);
      } else {
        finish(false);
      }
    };

    const existing = document.querySelector('script[data-jitta-gmaps]');
    if (existing) {
      if ((window as any).google?.maps?.Map && !isGoogleMapsAuthFailed()) {
        finish(true);
      }
      return;
    }

    const script = document.createElement('script');
    script.setAttribute('data-jitta-gmaps', 'true');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_MAPS_API_KEY
    )}&loading=async&libraries=places,geometry&callback=__jittaGoogleMapsInitAdmin`;
    script.async = true;
    script.defer = true;

    script.onerror = (e) => {
      console.warn('Google Maps script failed to load:', e);
      finish(false);
    };

    document.head.appendChild(script);

    setTimeout(() => {
      if (!resolved) {
        const ready = Boolean((window as any).google?.maps?.Map) && !isGoogleMapsAuthFailed();
        finish(ready);
      }
    }, 4500);
  });

  return mapsPromise;
}
