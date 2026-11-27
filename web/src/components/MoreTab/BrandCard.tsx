/** Top brand promo card — Moovit+ style strip. Visual only. */

import { ChevronRightIcon } from '../shared/icons';
import { t } from '../../lib/i18n';

export function BrandCard() {
  return (
    <div className="more-brand-card" role="note">
      <span className="more-brand-card__mark" aria-hidden="true">
        <img src="/icon.svg" width={34} height={34} alt="" />
      </span>
      <span className="more-brand-card__text">
        <span className="more-brand-card__title">{t("betterMoveIt")}</span>
        <span className="more-brand-card__sub">{t("No ads · Live map · Open source")}</span>
      </span>
      <ChevronRightIcon size={16} className="more-brand-card__chevron" />
    </div>
  );
}
