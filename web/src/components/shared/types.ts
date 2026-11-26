/** Types shared by the home and lines components (icons, line badge). */

export interface IconProps {
  /** Pixel size (square). */
  size?: number;
  className?: string;
}

export type LineBadgeAccent = 'teal' | 'orange' | 'red';

export interface LineBadgeProps {
  /** Short line number / name shown in the badge. */
  label: string;
  /** Mode icon variant. Light rail uses Moovit circular R1/R3 style. */
  mode: 'bus' | 'rail' | 'tram';
  /** Bottom accent colour. Defaults by mode: bus → teal, rail → orange. */
  accent?: LineBadgeAccent;
  /** Compact variant (home card). */
  size?: 'sm' | 'md';
}
