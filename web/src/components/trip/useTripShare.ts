/** Web Share (with clipboard fallback) for the active journey. */

import { useCallback } from 'react';
import { formatClock12h, formatDuration } from '../../lib/format';
import type { Journey } from '../../types';
import { t } from '../../lib/i18n';

export function useTripShare(journey: Journey): () => void {
  return useCallback(() => {
    const last = journey.legs[journey.legs.length - 1];
    const destName = last?.toName ?? '';
    const text = t('{time} to {dest}, arriving {arrive}', { time: formatDuration(journey.durationSec), dest: destName, arrive: formatClock12h(journey.arrivalSeconds) });
    if (typeof navigator === 'undefined') return;
    if (navigator.share) {
      navigator.share({ title: t('Live Directions'), text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }, [journey]);
}
