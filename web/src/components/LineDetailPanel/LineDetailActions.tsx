/** Moovit bottom action strip: green Start + Favorite. */

import type { LineDetailActionsProps } from './types';

export function LineDetailActions({
  canStart,
  pickingDestination,
  favored,
  onStart,
  onToggleFavourite,
}: LineDetailActionsProps) {
  if (pickingDestination) return null;
  return (
    <div className="lnd-actions">
      <button
        type="button"
        className="lnd-actions__start"
        disabled={!canStart}
        onClick={onStart}
      >
        <span className="lnd-actions__start-icon" aria-hidden>
          ➤
        </span>
        Start
      </button>
      <button
        type="button"
        className={`lnd-actions__fav${favored ? ' is-on' : ''}`}
        onClick={onToggleFavourite}
        aria-label={favored ? 'Unfavorite' : 'Favorite'}
      >
        <span aria-hidden>{favored ? '★' : '☆'}</span>
        Favorite
      </button>
    </div>
  );
}
