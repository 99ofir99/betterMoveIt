/** Top brand card — opens the About page. */

import { ChevronRightIcon } from '../shared/icons';
import { t } from '../../lib/i18n';

export function BrandCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="more-brand-card" onClick={onOpen} aria-label={t("About")}>
      <span className="more-brand-card__mark" aria-hidden="true">
        <img src="/icon.svg" width={34} height={34} alt="" />
      </span>
      <span className="more-brand-card__text">
        <span className="more-brand-card__title">{t("BetterMoveIt")}</span>
        <span className="more-brand-card__sub">{t("No ads · Live map · Open source")}</span>
      </span>
      <ChevronRightIcon size={16} className="more-brand-card__chevron" />
    </button>
  );
}
