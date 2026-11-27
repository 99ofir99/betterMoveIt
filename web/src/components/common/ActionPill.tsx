/** Colourful Moovit pill button (Start / Live location / Share / Stop). */

import type { ActionPillProps } from './types';

export function ActionPill({
  tone,
  label,
  icon,
  onClick,
  pressed,
  ariaLabel,
  className,
  badge,
}: ActionPillProps) {
  // Moovit keeps the "Live location" label; pressed = green glow, not a label swap.
  const liveOn = Boolean(pressed && tone === 'blue' && /live/i.test(label));

  return (
    <button
      type="button"
      className={[
        'action-pill',
        `action-pill--${tone}`,
        pressed ? 'is-active' : '',
        liveOn ? 'action-pill--live-on' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      aria-pressed={pressed}
    >
      {liveOn && <span className="action-pill__live-dot" aria-hidden="true" />}
      <span className="action-pill__icon">{icon}</span>
      <span className="action-pill__label">{label}</span>
      {badge != null && badge > 0 && (
        <span className="action-pill__badge" aria-label={String(badge)}>
          {badge}
        </span>
      )}
    </button>
  );
}
