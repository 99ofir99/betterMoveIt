/**
 * Board → alight label. A flex row of separate items, so Hebrew stop names cannot
 * bidi-swap around the arrow; it follows the page direction (from on the right,
 * ← in Hebrew).
 */

import type { LegEndpointsProps } from './types';
import { t, seqArrow } from '../../lib/i18n';

export function LegEndpoints({ from, to, onSwitch }: LegEndpointsProps) {
  return (
    <div className="ld-endpoints">
      <div className="ld-endpoints__route">
        <span className="ld-endpoints__stop" dir="auto">
          {from}
        </span>
        <span className="ld-endpoints__arrow" aria-hidden="true">
          {seqArrow()}
        </span>
        <span className="ld-endpoints__stop" dir="auto">
          {to}
        </span>
      </div>
      {onSwitch ? (
        <button type="button" className="ld-endpoints__switch" onClick={onSwitch}>
          {t("Switch")}
        </button>
      ) : null}
    </div>
  );
}
