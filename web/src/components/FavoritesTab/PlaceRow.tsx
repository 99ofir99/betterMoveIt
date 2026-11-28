/** Home / Work / custom favourite row — Moovit list style. Visual only. */

import { useState } from 'react';
import { isPlaceholderAddress } from '../../lib/placeAddress';
import { ChevronRightIcon, HomeIcon, StarIcon, WorkIcon } from '../shared/icons';
import type { PlaceRowProps } from './types';
import { t } from '../../lib/i18n';

function PencilIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

export function PlaceRow({ kind, place, label, onSet, onGo, onClear, onEditAddress }: PlaceRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const title =
    label ? t(label) : kind === 'home' ? t('Home') : kind === 'work' ? t('Work') : place?.label ?? t('Place');
  const raw = place?.place.label?.trim() || null;
  const address = raw && !isPlaceholderAddress(raw) && raw !== title ? raw : null;
  const icon =
    kind === 'home' ? (
      <HomeIcon size={22} />
    ) : kind === 'work' ? (
      <WorkIcon size={22} />
    ) : (
      <StarIcon size={22} />
    );

  if (!place) {
    return (
      <button type="button" className="fav-row fav-row--place" onClick={onSet}>
        <span className={`fav-row__icon fav-row__icon--${kind}`}>{icon}</span>
        <span className="fav-row__body">
          <span className="fav-row__name">{title}</span>
          <span className="fav-row__meta">{t("Tap to set")}</span>
        </span>
        <ChevronRightIcon size={16} className="fav-row__chevron" />
      </button>
    );
  }

  if (editing) {
    const save = () => {
      const text = draft.trim();
      if (text) onEditAddress?.(text);
      setEditing(false);
    };
    return (
      <form
        className="fav-row fav-row--place fav-row--set fav-row--editing"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <span className={`fav-row__icon fav-row__icon--${kind}`}>{icon}</span>
        <span className="fav-row__body">
          <span className="fav-row__name">{title}</span>
          <input
            className="fav-row__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('Street and number, city')}
            aria-label={t('Address')}
            autoFocus
            dir="auto"
          />
          <span className="fav-row__edit-actions">
            <button type="submit" className="fav-row__save" disabled={!draft.trim()}>
              {t('Save')}
            </button>
            <button type="button" className="fav-row__cancel" onClick={() => setEditing(false)}>
              {t('Cancel')}
            </button>
          </span>
        </span>
      </form>
    );
  }

  return (
    <div className="fav-row fav-row--place fav-row--set">
      <button type="button" className="fav-row__main" onClick={onGo}>
        <span className={`fav-row__icon fav-row__icon--${kind}`}>{icon}</span>
        <span className="fav-row__body">
          <span className="fav-row__name">{title}</span>
          {address && <span className="fav-row__meta">{address}</span>}
        </span>
      </button>
      {onEditAddress && (
        <button
          type="button"
          className="fav-row__overflow"
          onClick={() => {
            setDraft(address ?? '');
            setEditing(true);
          }}
          aria-label={t('Edit address of {name}', { name: title })}
        >
          <PencilIcon />
        </button>
      )}
      <button
        type="button"
        className="fav-row__overflow"
        onClick={onClear}
        aria-label={t('Clear {name}', { name: title })}
      >
        ×
      </button>
    </div>
  );
}
