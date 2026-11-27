/** Moovit bottom quick actions: From here · To here · Favorite. */

import type { StopActionsProps } from './types';
import { t } from '../../lib/i18n';

export function StopActions({
  favored,
  onFromHere,
  onToHere,
  onToggleFavourite,
}: StopActionsProps) {
  return (
    <div className="stp-actions">
      <button type="button" className="stp-actions__primary" onClick={onFromHere}>
        {t("From here")}
      </button>
      <button type="button" className="stp-actions__secondary" onClick={onToHere}>
        {t("To here")}
      </button>
      <button
        type="button"
        className={`stp-actions__fav${favored ? ' is-on' : ''}`}
        onClick={onToggleFavourite}
        aria-label={favored ? t('Unfavorite') : t('Favorite')}
      >
        <span aria-hidden>{favored ? '★' : '☆'}</span>
        {t("Favorite")}
      </button>
    </div>
  );
}
