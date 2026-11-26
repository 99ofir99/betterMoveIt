/**
 * Moovit-style line badge:
 *  - Bus: dark pill + bus glyph + teal underline
 *  - Light rail (R1/R3): solid red circle/pill, white label, no glyph
 *  - Other rail: solid coloured pill + train glyph
 */

import { contrastText, routeColor } from '../../lib/format';
import { TransitModeIcon } from '../icons';
import type { RouteBadgeProps } from './types';

function isTramTypeName(typeName: string): boolean {
  const t = typeName.toLowerCase();
  return t === 'tram' || t === 'subway' || t === 'light_rail' || t === 'light rail';
}

export function RouteBadge({
  label,
  typeName,
  color,
  className,
  title,
  ariaLabel,
}: RouteBadgeProps) {
  const normalized = typeName.toLowerCase();
  const isBus = normalized === 'bus' || normalized === 'trolleybus' || !typeName;

  if (isBus) {
    return (
      <span
        className={['route-badge', 'route-badge--bus', className].filter(Boolean).join(' ')}
        title={title}
        aria-label={ariaLabel}
      >
        <TransitModeIcon typeName={typeName || 'bus'} size={16} />
        <span className="route-badge__label">{label}</span>
      </span>
    );
  }

  if (isTramTypeName(typeName)) {
    const bg = routeColor(color || '#E53935', 'tram');
    return (
      <span
        className={['route-badge', 'route-badge--tram', className].filter(Boolean).join(' ')}
        style={{ background: bg, color: contrastText(bg) }}
        title={title}
        aria-label={ariaLabel}
      >
        <span className="route-badge__label">{label}</span>
      </span>
    );
  }

  const bg = routeColor(color, typeName);
  return (
    <span
      className={['route-badge', 'route-badge--solid', className].filter(Boolean).join(' ')}
      style={{ background: bg, color: contrastText(bg) }}
      title={title}
      aria-label={ariaLabel}
    >
      <TransitModeIcon typeName={typeName} size={16} />
      <span className="route-badge__label">{label}</span>
    </span>
  );
}
