/** Presentational inline SVG icon; colour comes from CSS `color`. */

import { ICON_PATHS } from './iconPaths';
import type { NamedIconProps } from './types';

/** Direction-bearing glyphs that mirror in right-to-left (Hebrew) layout. */
const RTL_FLIP = new Set<string>(['arrow-back', 'arrow-forward', 'chevron-left', 'chevron-right']);

export function Icon({ name, size = 20, className }: NamedIconProps) {
  const cls = ['icon', RTL_FLIP.has(name) ? 'rtl-flip' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <svg
      className={cls}
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
