/** Plan a trip from / to this stop — compact row right under the header. */

import { Icon } from '../icons/Icon';
import type { StopActionsProps } from './types';
import { t } from '../../lib/i18n';

export function StopActions({ onFromHere, onToHere }: StopActionsProps) {
  return (
    <div className="stp-actions">
      <button type="button" className="stp-actions__btn stp-actions__btn--from" onClick={onFromHere}>
        <Icon name="trip-origin" size={16} />
        {t("Route from here")}
      </button>
      <button type="button" className="stp-actions__btn stp-actions__btn--to" onClick={onToHere}>
        <Icon name="place" size={18} />
        {t("Route to here")}
      </button>
    </div>
  );
}
