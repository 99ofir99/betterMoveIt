/**
 * Moovit corridor badge: one bus chip with `37 / 66 / 51 / 50 / 1`.
 * Extra numbers clip at the row edge — no tip text, no info mark.
 */

import { RouteBadge } from './RouteBadge';
import { formatBundledLineLabel, lineLabel } from './bundledLineLabel';
import type { BundledLineBadgeProps } from './types';

export function BundledLineBadge({ routes, className }: BundledLineBadgeProps) {
  if (!routes.length) return null;

  if (routes.length === 1) {
    const r = routes[0]!;
    return (
      <RouteBadge
        label={lineLabel(r)}
        typeName={r.typeName}
        color={r.color}
        className={className}
      />
    );
  }

  const label = formatBundledLineLabel(routes);
  const primary = routes[0]!;

  return (
    <RouteBadge
      label={label}
      typeName={primary.typeName}
      color={primary.color}
      className={['route-badge--bundled', className].filter(Boolean).join(' ')}
      title={label}
      ariaLabel={`Lines ${label}`}
    />
  );
}
