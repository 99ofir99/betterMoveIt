/**
 * LineBadge — Moovit-style line badge for Lines / favourites rows.
 * Bus: dark rect + bus icon + teal underline.
 * Light rail: red circle with R1/R3 label.
 * Rail: dark rect + tram icon + orange underline.
 */

import type { LineBadgeProps } from './types';
import { BusIcon, TramIcon } from './icons';

export function LineBadge({ label, mode, accent, size = 'md' }: LineBadgeProps) {
  if (mode === 'tram') {
    return (
      <span className={`line-badge line-badge--tram line-badge--${size}`}>
        <span className="line-badge__num">{label}</span>
      </span>
    );
  }

  const resolved = accent ?? (mode === 'bus' ? 'teal' : 'orange');
  return (
    <span className={`line-badge line-badge--${size} line-badge--${resolved}`}>
      {mode === 'bus' ? <BusIcon size={size === 'sm' ? 14 : 16} /> : <TramIcon size={size === 'sm' ? 14 : 16} />}
      <span className="line-badge__num">{label}</span>
    </span>
  );
}
