/**
 * Tiny i18n: English source strings are the keys, Hebrew lives in `i18n.he.ts`.
 * `t('Walk to {name}', { name })` — a missing Hebrew entry falls back to English.
 * The active locale comes from settings; `useLocale()` re-renders on change and
 * `applyLocale()` keeps `<html lang/dir>` in sync (Hebrew is RTL).
 */

import { useSyncExternalStore } from 'react';
import { loadSettings, SETTINGS_CHANGED_EVENT, type AppSettings } from './settings';
import { HE } from './i18n.he';

export type Locale = AppSettings['locale'];

let current: Locale = initialLocale();
const listeners = new Set<() => void>();

function initialLocale(): Locale {
  try {
    return loadSettings().locale === 'he' ? 'he' : 'en';
  } catch {
    return 'en';
  }
}

export function getLocale(): Locale {
  return current;
}

export function isRtl(locale: Locale = current): boolean {
  return locale === 'he';
}

/** Set `<html lang dir>` and notify `useLocale()` subscribers. */
export function applyLocale(locale: Locale): void {
  const changed = locale !== current;
  current = locale;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
  }
  if (changed) listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  applyLocale(current);
  window.addEventListener(SETTINGS_CHANGED_EVENT, (e) => {
    const next = (e as CustomEvent<AppSettings>).detail?.locale;
    if (next === 'he' || next === 'en') applyLocale(next);
  });
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Current locale; the calling component re-renders when it changes. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}

export type TVars = Record<string, string | number | null | undefined>;

/** Translate an English source string, filling `{name}` placeholders from `vars`. */
export function t(source: string, vars?: TVars): string {
  const text = current === 'he' ? (HE[source] ?? source) : source;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vars[k];
    return v == null ? m : String(v);
  });
}

/** Plural helper: `tn(n, '1 stop', '{n} stops')`. */
export function tn(n: number, one: string, many: string, vars?: TVars): string {
  return t(n === 1 ? one : many, { n, ...vars });
}
