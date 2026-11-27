/** Summary row: `42 min | Arrival time: 12:02 am | ₪16.00` + favourite star. */

import { formatClock12h, formatDuration } from '../../lib/format';
import { StarIcon } from '../icons';
import type { DirectionsSummaryProps } from './types';
import { t } from '../../lib/i18n';

export function DirectionsSummary({
  durationSec,
  arrivalSeconds,
  dayLabel,
  fare,
  saved,
  onToggleSaved,
}: DirectionsSummaryProps) {
  return (
    <div className="directions__summary">
      <div className="directions__summary-text">
        <strong>{formatDuration(durationSec)}</strong>
        <span className="directions__sep" aria-hidden="true">
          |
        </span>
        <span>{t("Arrival time:")} {formatClock12h(arrivalSeconds)}
          {dayLabel ? ` (${dayLabel})` : ''}</span>
        {fare && (
          <>
            <span className="directions__sep" aria-hidden="true">
              |
            </span>
            <span className="directions__fare">{fare}</span>
          </>
        )}
      </div>
      <button
        type="button"
        className={`directions__fav${saved ? ' is-saved' : ''}`}
        onClick={onToggleSaved}
        aria-label={saved ? t('Remove saved trip') : t('Save trip')}
        aria-pressed={saved}
      >
        <StarIcon size={20} filled={saved} />
      </button>
    </div>
  );
}
