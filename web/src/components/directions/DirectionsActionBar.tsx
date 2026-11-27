/** Sticky bottom pill bar: Start (green) · Live location (blue) · Share (blue). */

import { ActionPill } from '../common/ActionPill';
import { LiveBusIcon, PlayIcon, ShareIcon } from '../icons';
import type { DirectionsActionBarProps } from './types';
import { t } from '../../lib/i18n';

export function DirectionsActionBar({
  onStartTrip,
  onToggleLiveBuses,
  liveBusesActive,
  onShare,
}: DirectionsActionBarProps) {
  return (
    <div className="directions__actions">
      <ActionPill tone="green" label={t("Start")} icon={<PlayIcon size={20} />} onClick={onStartTrip} />
      {onToggleLiveBuses && (
        <ActionPill
          tone="blue"
          label={t("Live location")}
          icon={<LiveBusIcon size={22} />}
          onClick={onToggleLiveBuses}
          pressed={liveBusesActive}
        />
      )}
      {onShare && (
        <ActionPill tone="blue" label={t("Share")} icon={<ShareIcon size={18} />} onClick={onShare} />
      )}
    </div>
  );
}
