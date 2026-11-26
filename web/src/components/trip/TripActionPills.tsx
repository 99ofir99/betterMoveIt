/** Bottom action pills: Stop (red) · Live location (blue) · Share (blue). */

import { ActionPill } from '../common/ActionPill';
import { LiveBusIcon, ShareIcon, StopSquareIcon } from '../icons';
import type { TripActionPillsProps } from './types';

export function TripActionPills({
  onStop,
  onToggleLiveBuses,
  liveBusesActive = false,
  onShare,
}: TripActionPillsProps) {
  return (
    <div className="ld-pills">
      <ActionPill
        tone="red"
        label="Stop"
        ariaLabel="End trip"
        icon={<StopSquareIcon size={20} />}
        onClick={onStop}
      />
      {onToggleLiveBuses && (
        <ActionPill
          tone="blue"
          label="Live location"
          ariaLabel="Toggle live location"
          icon={<LiveBusIcon size={22} />}
          onClick={onToggleLiveBuses}
          pressed={liveBusesActive}
        />
      )}
      <ActionPill
        tone="blue"
        label="Share"
        ariaLabel="Share trip"
        icon={<ShareIcon size={18} />}
        onClick={onShare}
      />
    </div>
  );
}
