/** Purple Smart Tips pills shown under a journey card footer. */

import type { TripInsightLabel } from '../../lib/types';
import { Icon } from '../icons/Icon';

interface TripTipsProps {
  labels: readonly TripInsightLabel[];
}

export function TripTips({ labels }: TripTipsProps) {
  if (labels.length === 0) return null;
  return (
    <div className="journey-card__tips">
      {labels.map((label) => (
        <span key={label} className="journey-card__tip">
          <Icon name="sparkle" size={12} />
          {label}
        </span>
      ))}
    </div>
  );
}
