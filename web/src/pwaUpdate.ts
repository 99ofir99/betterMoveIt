/**
 * Keep the installed PWA on the latest deploy without a manual refresh.
 *
 * The service worker only looks for a new version when a page is navigated, and a
 * phone resumes the app from the background without navigating, so an open app ran
 * an old bundle for hours. We check for an update whenever the app comes back to the
 * front (and every 15 minutes while open). With registerType 'autoUpdate' a new
 * worker activates at once and the page reloads onto the new bundle.
 */
import { registerSW } from 'virtual:pwa-register';

const CHECK_EVERY_MS = 15 * 60 * 1000;
/** Don't hammer the server when the app flips foreground/background quickly. */
const MIN_GAP_MS = 30 * 1000;

export function startPwaAutoUpdate(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      let last = 0;
      const check = () => {
        if (document.visibilityState === 'hidden' || !navigator.onLine) return;
        if (Date.now() - last < MIN_GAP_MS) return;
        last = Date.now();
        void registration.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', check);
      window.addEventListener('focus', check);
      window.setInterval(check, CHECK_EVERY_MS);
    },
  });
}
