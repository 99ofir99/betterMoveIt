/** Bottom action pills: Stop (red) · Live location (blue) · Share (blue). */

import { ActionPill } from '../common/ActionPill';
import { LiveBusIcon, ShareIcon, StopSquareIcon } from '../icons';
import type { TripActionPillsProps } from './types';
import { t } from '../../lib/i18n';

export function TripActionPills({
  onStop,
  onToggleLiveBuses,
  liveBusesActive = false,
  liveBusCount,
  onShare,
}: TripActionPillsProps) {
  return (
    <div className="ld-pills">
      <ActionPill
        tone="red"
        label={t("Stop trip")}
        ariaLabel={t("End trip")}
        icon={<StopSquareIcon size={20} />}
        onClick={onStop}
      />
      {onToggleLiveBuses && (
        <ActionPill
          tone="blue"
          label={t("Live location")}
          ariaLabel={t("Toggle live location")}
          icon={<LiveBusIcon size={22} />}
          onClick={onToggleLiveBuses}
          pressed={liveBusesActive}
          badge={liveBusCount}
        />
      )}
      <ActionPill
        tone="blue"
        label={t("Share")}
        ariaLabel={t("Share trip")}
        icon={<ShareIcon size={18} />}
        onClick={onShare}
      />
    </div>
  );
}
