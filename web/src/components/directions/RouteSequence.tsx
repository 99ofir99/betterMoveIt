/** Horizontal chip sequence of the journey's legs (bus badges + walk glyphs). */

import { BundledLineBadge } from '../common/BundledLineBadge';
import { SwipeRail } from '../common/SwipeRail';
import { WalkIcon, ChevronRightIcon } from '../icons';
import type { RouteSequenceProps } from './types';

export function RouteSequence({ legs, transitAlternatives }: RouteSequenceProps) {
  let transitIdx = 0;
  return (
    <SwipeRail className="directions__timeline" aria-label="Route legs">
      {legs.map((leg, i) => {
        const arrow =
          i > 0 ? <ChevronRightIcon size={16} className="directions__timeline-arrow" /> : null;

        if (leg.mode === 'walk') {
          return (
            <span key={i} className="directions__timeline-item">
              {arrow}
              <span className="directions__chip-walk" role="img" aria-label="Walk">
                <WalkIcon size={20} />
              </span>
            </span>
          );
        }

        const routes = transitAlternatives?.[transitIdx] ?? [leg.route];
        transitIdx += 1;
        return (
          <span key={i} className="directions__timeline-item">
            {arrow}
            <BundledLineBadge routes={routes} />
          </span>
        );
      })}
    </SwipeRail>
  );
}
