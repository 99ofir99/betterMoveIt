/** Web Share (with clipboard fallback) for the active journey. */

import { useCallback } from 'react';
import { formatClock12h, formatDuration } from '../../lib/format';
import type { Journey } from '../../types';

export function useTripShare(journey: Journey): () => void {
  return useCallback(() => {
    const last = journey.legs[journey.legs.length - 1];
    const destName = last?.toName ?? '';
    const text = `${formatDuration(journey.durationSec)} to ${destName}, arriving ${formatClock12h(journey.arrivalSeconds)}`;
    if (typeof navigator === 'undefined') return;
    if (navigator.share) {
      navigator.share({ title: 'Live Directions', text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }, [journey]);
}
