/** Earlier ⟷ Later strip around the trip's departure–arrival window. */

import { formatClock12h } from '../../lib/format';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import type { ShiftStripProps } from './types';
import { t } from '../../lib/i18n';

export function ShiftStrip({ departSeconds, arrivalSeconds, onEarlier, onLater }: ShiftStripProps) {
  return (
    <div className="directions__shift">
      <button type="button" className="directions__shift-btn" onClick={onEarlier}>
        <ChevronLeftIcon size={18} />
        {t("Earlier")}
      </button>
      <span className="directions__shift-range">
        {formatClock12h(departSeconds)} - {formatClock12h(arrivalSeconds)}
      </span>
      <button type="button" className="directions__shift-btn" onClick={onLater}>
        {t("Later")}
        <ChevronRightIcon size={18} />
      </button>
    </div>
  );
}
