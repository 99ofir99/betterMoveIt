/**
 * Moovit-style "Depart now ▾" sheet — departure / arrival / +15 / latest.
 */

import { useState } from 'react';
import { DepartTimeForm } from './DepartTimeForm';
import type { DepartAtAction, DepartAtSheetProps, DepartSheetMode } from './types';
import { t } from '../../lib/i18n';

export type { DepartAtAction } from './types';

interface MenuItem {
  label: string;
  /** Immediate action, or the sub-mode to open. */
  action: DepartAtAction | { open: Exclude<DepartSheetMode, 'menu'> };
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Depart now', action: { type: 'now' } },
  { label: 'Set departure time', action: { open: 'depart' } },
  { label: 'Set desired arrival time', action: { open: 'arrive' } },
  { label: 'Latest departure', action: { type: 'latest' } },
  { label: '+15 min', action: { type: 'plus15' } },
];

export function DepartAtSheet({ onClose, onSelect, startMode }: DepartAtSheetProps) {
  const [mode, setMode] = useState<DepartSheetMode>(startMode ?? 'menu');

  const handleItem = (item: MenuItem) => {
    if ('open' in item.action) {
      setMode(item.action.open);
      return;
    }
    onSelect(item.action);
    onClose();
  };

  return (
    <div
      className="depart-sheet"
      role="dialog"
      aria-label={mode === 'menu' ? t('Departure options') : t('Set time')}
    >
      <div className="depart-sheet__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="depart-sheet__panel">
        <div className="depart-sheet__grabber" aria-hidden="true" />
        {mode === 'menu' ? (
          <>
            <ul className="depart-sheet__list">
              {MENU_ITEMS.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    className="depart-sheet__row"
                    onClick={() => handleItem(item)}
                  >
                    {t(item.label)}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <DepartTimeForm
            mode={mode}
            // Opened straight on the form (home card clock): depart/arrive toggle, Back closes.
            onModeChange={startMode ? setMode : undefined}
            onBack={() => (startMode ? onClose() : setMode('menu'))}
            onApply={(action) => {
              onSelect(action);
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}
