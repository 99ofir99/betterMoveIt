/**
 * Saved places store their default name in English ("Home" / "Work"); show it in
 * the current language. Any other label (an address, a custom name) is left as is.
 */

import { t } from './i18n';

const DEFAULT_NAMES = new Set(['Home', 'Work']);

export function displayPlaceLabel(label: string | null | undefined): string {
  if (!label) return '';
  return DEFAULT_NAMES.has(label) ? t(label) : label;
}

/** Saved Home / Work by its label (English default or the translated name), else null. */
export function placeKindOf(label: string | null | undefined): 'home' | 'work' | null {
  if (!label) return null;
  if (label === 'Home' || label === t('Home')) return 'home';
  if (label === 'Work' || label === t('Work')) return 'work';
  return null;
}
