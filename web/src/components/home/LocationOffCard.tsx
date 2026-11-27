/**
 * Home carousel card shown in place of "Nearest station" when location access is
 * denied — otherwise the home screen just loses the card with no hint why.
 */

import { Icon } from '../icons/Icon';
import { t } from '../../lib/i18n';

export function LocationOffCard({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="fdcard locoff-card">
      <div className="fdcard__header">
        <span className="fdcard__label">{t('Nearest station')}</span>
      </div>
      <div className="fdcard__body locoff-card__body">
        <span className="locoff-card__icon" aria-hidden="true">
          <Icon name="my-location" size={22} />
        </span>
        <p className="fdcard__destination">{t('Location is off')}</p>
        <p className="locoff-card__hint">
          {t('Allow location access in your browser or phone settings to see the nearest station and its departures.')}
        </p>
        {onRetry ? (
          <button type="button" className="results-empty__action locoff-card__action" onClick={onRetry}>
            {t('Try again')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
