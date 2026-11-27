/**
 * Moovit Preferences — route ranking + transport toggles.
 * Persists via settings helpers; visual radio/toggle list only.
 */

import { useState } from 'react';
import { loadSettings, saveSettings, type TransportPrefs } from '../../lib/settings';
import { Icon } from '../icons/Icon';
import type { PreferencesSheetProps, RouteOption, TransportOption } from './types';
import { t } from '../../lib/i18n';

const ROUTE_OPTS: RouteOption[] = [
  { mode: 'fastest', label: 'Fastest route', icon: 'trophy' },
  { mode: 'fewest-transfers', label: 'Fewest transfers', icon: 'swap-horiz' },
  { mode: 'least-walking', label: 'Least walking', icon: 'walk' },
];

const TRANSPORT_OPTS: TransportOption[] = [
  { key: 'bus', label: 'Bus', icon: 'bus' },
  { key: 'lightRail', label: 'Light rail', icon: 'light-rail' },
  { key: 'rail', label: 'Israel Railways', icon: 'train' },
  { key: 'cable', label: 'Carmelit / Rachbalit', icon: 'cable' },
  { key: 'shuttle', label: 'Shuttle', icon: 'shuttle' },
  { key: 'bike', label: 'Bike', icon: 'bike' },
];

export function PreferencesSheet({
  sortMode,
  onSortMode,
  onClose,
  onTransportPrefsChange,
}: PreferencesSheetProps) {
  const [transport, setTransport] = useState<TransportPrefs>(
    () => loadSettings().transportPrefs ?? defaultTransport()
  );

  const toggle = (key: keyof TransportPrefs) => {
    const next = { ...transport, [key]: !transport[key] };
    setTransport(next);
    saveSettings({ transportPrefs: next });
    onTransportPrefsChange?.(next);
  };

  return (
    <div className="prefs-sheet" role="dialog" aria-label={t("Preferences")}>
      <header className="prefs-sheet__head">
        <button type="button" className="icon-button icon-button--ghost" onClick={onClose} aria-label={t("Back")}>
          <Icon name="arrow-back" />
        </button>
        <h1 className="prefs-sheet__title">{t("Preferences")}</h1>
      </header>

      <section className="prefs-sheet__section">
        <h2 className="prefs-sheet__section-title">{t("Route Preference")}</h2>
        <ul className="prefs-sheet__list" role="radiogroup" aria-label={t("Route preference")}>
          {ROUTE_OPTS.map(({ mode, label, icon }) => (
            <li key={mode}>
              <button
                type="button"
                role="radio"
                aria-checked={sortMode === mode}
                className="prefs-sheet__row"
                onClick={() => onSortMode(mode)}
              >
                <Icon name={icon} size={24} className="prefs-sheet__icon" />
                <span className="prefs-sheet__label">{t(label)}</span>
                <span
                  className={`prefs-sheet__radio ${sortMode === mode ? 'is-on' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="prefs-sheet__section">
        <h2 className="prefs-sheet__section-title">{t("Transport Type Preferences")}</h2>
        <p className="prefs-sheet__caption">
          {t("The selected transport types will get higher priority in your suggested routes.")}
        </p>
        <ul className="prefs-sheet__list">
          {TRANSPORT_OPTS.map(({ key, label, icon }) => (
            <li key={key}>
              <div className="prefs-sheet__row prefs-sheet__row--static">
                <Icon name={icon} size={24} className="prefs-sheet__icon" />
                <span className="prefs-sheet__label">{t(label)}</span>
                <button
                  type="button"
                  role="switch"
                  className={`prefs-sheet__switch ${transport[key] ? 'is-on' : ''}`}
                  aria-checked={transport[key]}
                  aria-label={t(label)}
                  onClick={() => toggle(key)}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function defaultTransport(): TransportPrefs {
  return {
    bus: true,
    lightRail: true,
    rail: true,
    cable: true,
    shuttle: true,
    bike: true,
  };
}
