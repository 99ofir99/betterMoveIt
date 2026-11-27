/** Moovit bottom action strip: green Start + Favorite. */

import type { LineDetailActionsProps } from './types';
import { t } from '../../lib/i18n';
import { StarIcon } from '../shared/icons';
import { PlayIcon } from '../icons';

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
          <PlayIcon size={18} />
        </span>
        {t("Start")}
      </button>
      <button
        type="button"
        className={`lnd-actions__fav${favored ? ' is-on' : ''}`}
        onClick={onToggleFavourite}
        aria-label={favored ? t('Unfavorite') : t('Favorite')}
      >
        <StarIcon size={18} filled={favored} />
        {t("Favorite")}
      </button>
    </div>
  );
}
