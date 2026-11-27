/** Rider-facing wording for a failed API call (never "Failed to fetch" or "502 … for /api/…"). */

import { t } from './i18n';

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function friendlyError(fallback = "Couldn't load. Try again in a moment."): string {
  return isOffline() ? t('No internet connection.') : t(fallback);
}
