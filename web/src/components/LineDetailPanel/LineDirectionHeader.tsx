/** Moovit direction strip: title + blue "Change direction". */

import type { LineDirectionHeaderProps } from './types';

export function LineDirectionHeader({
  label,
  canChange,
  onChangeDirection,
}: LineDirectionHeaderProps) {
  return (
    <button
      type="button"
      className="lnd-dir"
      onClick={onChangeDirection}
      disabled={!canChange}
      aria-label={canChange ? `Direction: ${label}. Double tap to change direction` : label}
    >
      <span className="lnd-dir__text">
        <span className="lnd-dir__label" dir="auto">
          {label}
        </span>
        {canChange && <span className="lnd-dir__change">Change direction</span>}
      </span>
    </button>
  );
}
