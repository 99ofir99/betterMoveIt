/** User preferences (accessibility, live map, units, Moovit prefs). */

export interface TransportPrefs {
  bus: boolean;
  lightRail: boolean;
  rail: boolean;
  cable: boolean;
  shuttle: boolean;
  bike: boolean;
}

export interface AppSettings {
  wheelchair: boolean;
  showLiveBuses: boolean;
  maxWalkM: number;
  locale: 'he' | 'en';
  transportPrefs?: TransportPrefs;
}

const KEY = 'bmi.settings.v1';
/** Dispatched after settings are written — App syncs live-buses / walk prefs. */
export const SETTINGS_CHANGED_EVENT = 'bmi:settings-changed';

const DEFAULTS: AppSettings = {
  wheelchair: false,
  showLiveBuses: true,
  maxWalkM: 1200,
  locale: 'en',
  transportPrefs: {
    bus: true,
    lightRail: true,
    rail: true,
    cable: true,
    shuttle: true,
    bike: true,
  },
};

export function loadSettings(): AppSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...loadSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: next }));
  return next;
}
