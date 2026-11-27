import type { ReactNode } from 'react';
import type { RouteInfo } from '../../types';

export interface RouteBadgeProps {
  /** Line number / name shown in the badge. */
  label: string;
  /** Route `typeName` — drives the glyph and the bus-vs-rail styling. */
  typeName: string;
  /** Raw route colour (used as the fill for non-bus modes). */
  color?: string | null;
  className?: string;
  /** Native tooltip (full untruncated line list). */
  title?: string;
  /** Accessible name when it differs from the visible label. */
  ariaLabel?: string;
}

export interface BundledLineBadgeProps {
  routes: readonly RouteInfo[];
  className?: string;
}

export type ActionPillTone = 'green' | 'blue' | 'red';

export interface ActionPillProps {
  tone: ActionPillTone;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** Toggle state (e.g. live location on). */
  pressed?: boolean;
  /** Small count bubble (e.g. live buses on the map). */
  badge?: number;
  /** Overrides the accessible name when it differs from `label`. */
  ariaLabel?: string;
  className?: string;
}
