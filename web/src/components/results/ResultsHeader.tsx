/**
 * Moovit-style results chrome: back + stacked Current location / destination + swap + prefs.
 * Visual only — App owns selection and search open.
 */

import { Icon } from '../icons/Icon';
import type { ResultsHeaderProps } from './types';
import { t } from '../../lib/i18n';

export function ResultsHeader({
  from,
  to,
  fromIsCurrentLocation,
  onBack,
  onSwap,
  onEditFrom,
  onEditTo,
  onOpenPreferences,
  prefsBadgeCount = 0,
}: ResultsHeaderProps) {
  const showBadge = prefsBadgeCount > 0;
  return (
    <div className="results-header">
      <div className="results-header__top">
        <button type="button" className="icon-button icon-button--ghost" onClick={onBack} aria-label={t("Back")}>
          <Icon name="arrow-back" />
        </button>
        <div className="results-header__fields">
          <button type="button" className="results-header__field" onClick={onEditFrom}>
            <span className="results-header__dot" aria-hidden="true" />
            <span className="results-header__field-text">
              {fromIsCurrentLocation ? t('Current location') : from?.label || t('Choose origin')}
            </span>
          </button>
          <button type="button" className="results-header__field results-header__field--to" onClick={onEditTo}>
            <span className="results-header__pin" aria-hidden="true" />
            <span className="results-header__field-text">
              {to?.label || t('Where to?')}
            </span>
          </button>
          <button
            type="button"
            className="results-header__swap"
            onClick={onSwap}
            aria-label={t("Swap origin and destination")}
          >
            <Icon name="swap-vert" size={18} />
          </button>
        </div>
        <button
          type="button"
          className="icon-button icon-button--ghost results-header__prefs"
          onClick={onOpenPreferences}
          aria-label={showBadge ? t('Preferences, {n} active', { n: prefsBadgeCount }) : t('Preferences')}
        >
          <Icon name="sliders" />
          {showBadge && (
            <span className="results-header__badge" aria-hidden="true">
              {prefsBadgeCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
