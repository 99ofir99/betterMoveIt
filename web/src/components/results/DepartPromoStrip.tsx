/** Purple "See when your trip is fastest" promo strip (visual only). */

import { ClockIcon } from '../icons';
import { t } from '../../lib/i18n';

export function DepartPromoStrip() {
  return (
    <div className="depart-sheet__promo">
      <span className="depart-sheet__promo-tile" aria-hidden="true">
        <ClockIcon size={22} />
      </span>
      <span className="depart-sheet__promo-text">
        <span className="depart-sheet__promo-title">{t("See when your trip is fastest")}</span>
        <span className="depart-sheet__promo-sub">{t("Compare trip durations")}</span>
      </span>
    </div>
  );
}
