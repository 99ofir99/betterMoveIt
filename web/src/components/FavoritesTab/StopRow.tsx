/** Favourite stop row. Visual only. */

import { ChevronRightIcon, StarIcon } from '../shared/icons';
import type { StopRowProps } from './types';

export function StopRow({ item, onOpen, onRemove }: StopRowProps) {
  return (
    <div className="fav-row fav-row--stop">
      <button type="button" className="fav-row__main" onClick={onOpen}>
        <span className="fav-row__icon fav-row__icon--stop" aria-hidden="true">
          <StopPinIcon />
        </span>
        <span className="fav-row__body">
          <span className="fav-row__name">{item.stop.name}</span>
          {item.stop.code && <span className="fav-row__meta">Stop {item.stop.code}</span>}
        </span>
        <ChevronRightIcon size={16} className="fav-row__chevron" />
      </button>
      <button
        type="button"
        className="fav-row__star is-on"
        onClick={onRemove}
        aria-label="Remove favourite stop"
      >
        <StarIcon size={20} filled />
      </button>
    </div>
  );
}

function StopPinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );
}
