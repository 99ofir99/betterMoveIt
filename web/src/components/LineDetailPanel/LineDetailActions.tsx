/** Moovit bottom action strip: green Start + Favorite. */

import type { LineDetailActionsProps } from './types';
import { t } from '../../lib/i18n';
import { NavigateIcon, StarIcon } from '../shared/icons';

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
          {/* Points the way you read: left in Hebrew. */}
          <NavigateIcon size={18} className="rtl-flip" />
        </span>
        {t("Start ride")}
      </button>
      <button
        type="button"
        className={`lnd-actions__fav${favored ? ' is-on' : ''}`}
        onClick={onToggleFavourite}
        aria-pressed={favored}
        aria-label={favored ? t('Remove from saved lines') : t('Save line')}
      >
        <StarIcon size={18} filled={favored} />
        {favored ? t('Saved') : t('Save line')}
      </button>
    </div>
  );
}
