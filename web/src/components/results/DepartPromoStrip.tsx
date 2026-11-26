/** Purple "See when your trip is fastest" promo strip (visual only). */

import { ClockIcon } from '../icons';

export function DepartPromoStrip() {
  return (
    <div className="depart-sheet__promo">
      <span className="depart-sheet__promo-tile" aria-hidden="true">
        <ClockIcon size={22} />
      </span>
      <span className="depart-sheet__promo-text">
        <span className="depart-sheet__promo-title">See when your trip is fastest</span>
        <span className="depart-sheet__promo-sub">Compare trip durations</span>
      </span>
    </div>
  );
}
