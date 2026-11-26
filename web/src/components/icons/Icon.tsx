/** Presentational inline SVG icon; colour comes from CSS `color`. */

import { ICON_PATHS } from './iconPaths';
import type { NamedIconProps } from './types';

export function Icon({ name, size = 20, className }: NamedIconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
