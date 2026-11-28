/** Add flow, step 2: name the picked place and choose Home / Work / other. Visual only. */

import { useState } from 'react';
import { HomeIcon, StarIcon, WorkIcon } from '../shared/icons';
import type { SavePlaceSheetProps } from './types';
import { t } from '../../lib/i18n';

type Kind = 'home' | 'work' | 'custom';

export function SavePlaceSheet({ place, hasHome, hasWork, onSave, onCancel }: SavePlaceSheetProps) {
  const [kind, setKind] = useState<Kind>(!hasHome ? 'home' : !hasWork ? 'work' : 'custom');
  const [name, setName] = useState(place.label.split(',')[0]?.trim() ?? '');
  const replaces = (kind === 'home' && hasHome) || (kind === 'work' && hasWork);

  const options: { kind: Kind; label: string; icon: JSX.Element }[] = [
    { kind: 'home', label: t('Home'), icon: <HomeIcon size={20} /> },
    { kind: 'work', label: t('Work'), icon: <WorkIcon size={20} /> },
    { kind: 'custom', label: t('Other'), icon: <StarIcon size={20} /> },
  ];

  return (
    <div className="modal" role="presentation">
      <div className="modal__backdrop" onClick={onCancel} />
      <form
        className="modal__card save-place"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-place-title"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(kind, name);
        }}
      >
        <h2 id="save-place-title" className="save-place__title">{t('Save place')}</h2>
        <p className="save-place__address" dir="auto">{place.label}</p>

        <p className="save-place__label">{t('Save as')}</p>
        <div className="save-place__kinds" role="radiogroup" aria-label={t('Save as')}>
          {options.map((o) => (
            <button
              key={o.kind}
              type="button"
              role="radio"
              aria-checked={kind === o.kind}
              className={`save-place__kind save-place__kind--${o.kind}${kind === o.kind ? ' is-on' : ''}`}
              onClick={() => setKind(o.kind)}
            >
              {o.icon}
              <span>{o.label}</span>
            </button>
          ))}
        </div>
        {replaces && <p className="save-place__hint">{t('This replaces the one you saved before.')}</p>}

        {kind === 'custom' && (
          <label className="save-place__name">
            <span className="save-place__label">{t('Name')}</span>
            <input
              className="fav-row__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('e.g. Grandma, Gym')}
              dir="auto"
              autoFocus
            />
          </label>
        )}

        <div className="save-place__actions">
          <button type="submit" className="fav-row__save">{t('Save')}</button>
          <button type="button" className="fav-row__cancel" onClick={onCancel}>{t('Cancel')}</button>
        </div>
      </form>
    </div>
  );
}
