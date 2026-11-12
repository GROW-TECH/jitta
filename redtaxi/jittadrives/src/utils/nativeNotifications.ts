/**
 * Fires an Android native status-bar notification when running inside Capacitor's
 * MainActivity NativeNotificationBridge, falling back to browser Notification API.
 */
export function triggerNativeAlert(title: string, body: string): void {
  if (typeof window === 'undefined') return;

  try {
    const nativeBridge = (window as any).NativeNotificationBridge;
    if (nativeBridge && typeof nativeBridge.showNotification === 'function') {
      nativeBridge.showNotification(title, body);
      return;
    }
  } catch {
    // Fall through to web Notification fallback
  }

  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/logo.png' });
      } catch {}
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission()
        .then((perm) => {
          if (perm === 'granted') {
            try {
              new Notification(title, { body, icon: '/logo.png' });
            } catch {}
          }
        })
        .catch(() => {});
    }
  }
}

