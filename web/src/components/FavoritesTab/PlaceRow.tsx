/** Home / Work / custom favourite row — Moovit list style. Visual only. */

import { ChevronRightIcon, HomeIcon, StarIcon, WorkIcon } from '../shared/icons';
import type { PlaceRowProps } from './types';

export function PlaceRow({ kind, place, label, onSet, onGo, onClear }: PlaceRowProps) {
  const title =
    label ?? (kind === 'home' ? 'Home' : kind === 'work' ? 'Work' : place?.label ?? 'Place');
  const address = place?.place.label?.trim() || null;
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
          <span className="fav-row__meta">Tap to set</span>
        </span>
        <ChevronRightIcon size={16} className="fav-row__chevron" />
      </button>
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
        <ChevronRightIcon size={16} className="fav-row__chevron" />
      </button>
      <button
        type="button"
        className="fav-row__overflow"
        onClick={onClear}
        aria-label={`Clear ${title}`}
      >
        ×
      </button>
    </div>
  );
}
