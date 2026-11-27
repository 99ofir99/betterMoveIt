/**
 * Moovit "Showing stops for" + Switch — which corridor line the stop rail
 * (and get-off alerts) currently follow.
 */

import { BundledLineBadge } from '../common/BundledLineBadge';
import { SwipeRail } from '../common/SwipeRail';
import type { ShowingStopsForBarProps } from './types';
import { t } from '../../lib/i18n';

export function ShowingStopsForBar({
  route,
  headsign,
  onSwitch,
}: ShowingStopsForBarProps) {
  return (
    <div className="ld-ride__line-block ld-wait-stack__showing">
      <div className="ld-ride__line-head">
        <span className="ld-ride__line-label">{t("Showing stops for")}</span>
        {onSwitch ? (
          <button
            type="button"
            className="ld-ride__change ld-ride__change--active"
            onClick={onSwitch}
            aria-label={t("Switch line")}
          >
            {t("Switch")}
          </button>
        ) : null}
      </div>
      <SwipeRail className="ld-ride__line-row">
        <BundledLineBadge routes={[route]} />
        {headsign ? (
          <span className="ld-ride__headsign" dir="auto">
            {headsign}
          </span>
        ) : null}
      </SwipeRail>
    </div>
  );
}
