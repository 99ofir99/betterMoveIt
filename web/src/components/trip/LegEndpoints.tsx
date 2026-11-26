/**
 * Board → alight label. Forced LTR flex so Hebrew stop names cannot bidi-swap
 * around the arrow (which looked like the trip ran the wrong way).
 */

import type { LegEndpointsProps } from './types';

export function LegEndpoints({ from, to, onSwitch }: LegEndpointsProps) {
  return (
    <div className="ld-endpoints">
      <div className="ld-endpoints__route" dir="ltr">
        <span className="ld-endpoints__stop" dir="auto">
          {from}
        </span>
        <span className="ld-endpoints__arrow" aria-hidden="true">
          →
        </span>
        <span className="ld-endpoints__stop" dir="auto">
          {to}
        </span>
      </div>
      {onSwitch ? (
        <button type="button" className="ld-endpoints__switch" onClick={onSwitch}>
          Switch
        </button>
      ) : null}
    </div>
  );
}
