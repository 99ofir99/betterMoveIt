/**
 * Shared SVG icons (stroke / fill follow currentColor).
 * Purely visual — no logic.
 */

import type { IconProps } from './types';

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  'aria-hidden': true as const,
  focusable: false as const,
});

export function SearchIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20.5 20.5l-4.6-4.6" />
    </svg>
  );
}

export function HamburgerIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function BusIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM18 11H6V6h12v5z" />
    </svg>
  );
}

export function TramIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <path d="M12 2C8 2 4 2.5 4 6v9.5C4 17.43 5.57 19 7.5 19L6 20.5V21h2.23l2-2h3.54l2 2H18v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm5.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6h-5V6h5v5z" />
    </svg>
  );
}

export function WalkIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />
    </svg>
  );
}

export function ClockIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={['rtl-flip', className].filter(Boolean).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

/** Live real-time signal (dot + two arcs), Moovit "live" glyph. */
export function LiveSignalIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="17" r="1.6" fill="currentColor" stroke="none" />
      <path d="M8.2 13.2a5.4 5.4 0 0 1 7.6 0" />
      <path d="M4.9 9.9a10 10 0 0 1 14.2 0" />
    </svg>
  );
}

export function HomeIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3.5 11.2 12 4l8.5 7.2" />
      <path d="M5.5 10v9.5h4.2v-5.2h4.6v5.2h4.2V10" />
    </svg>
  );
}

export function WorkIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round">
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 13h17" />
    </svg>
  );
}

export function StarIcon({ size = 20, className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(size)} className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
      <path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8L12 3.6z" />
    </svg>
  );
}

export function KebabIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  );
}

export function TrashIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.2A1.8 1.8 0 0 0 8.8 21h6.4a1.8 1.8 0 0 0 1.8-1.8L18 7M9 7V4.5h6V7" />
    </svg>
  );
}

export function MapLayersIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3.5 8.5 12 4l8.5 4.5L12 13 3.5 8.5z" />
      <path d="M3.5 12.5 12 17l8.5-4.5" />
      <path d="M3.5 16.5 12 21l8.5-4.5" />
    </svg>
  );
}

export function AccessibilityIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <circle cx="12" cy="4.5" r="2.2" />
      <path d="M7 9.2h10v2H14.2l-.8 8.3h-2.6L9.8 11.2H7V9.2z" />
    </svg>
  );
}

export function SettingsIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <path d="M19.4 13.1c.04-.36.06-.73.06-1.1s-.02-.74-.06-1.1l2.05-1.6a.5.5 0 0 0 .12-.63l-1.94-3.36a.5.5 0 0 0-.6-.22l-2.42.97a8.1 8.1 0 0 0-1.9-1.1l-.36-2.57A.5.5 0 0 0 13.85 2h-3.7a.5.5 0 0 0-.5.42l-.36 2.57c-.68.27-1.32.63-1.9 1.1l-2.42-.97a.5.5 0 0 0-.6.22L2.43 8.7a.5.5 0 0 0 .12.63l2.05 1.6c-.04.36-.06.73-.06 1.1s.02.74.06 1.1l-2.05 1.6a.5.5 0 0 0-.12.63l1.94 3.36c.14.24.43.34.7.22l2.42-.97c.58.46 1.22.83 1.9 1.1l.36 2.57c.05.24.26.42.5.42h3.7c.24 0 .45-.18.5-.42l.36-2.57c.68-.27 1.32-.63 1.9-1.1l2.42.97c.26.12.56.02.7-.22l1.94-3.36a.5.5 0 0 0-.12-.63l-2.05-1.6zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" />
    </svg>
  );
}

export function BellIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M6.5 16.5h11M8 16.5V10a4 4 0 1 1 8 0v6.5" />
      <path d="M10.2 18.5a1.8 1.8 0 0 0 3.6 0" />
    </svg>
  );
}

export function HistoryIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 5.5v4h4M12 8v4.5l3 1.8" />
    </svg>
  );
}

export function InfoIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 10.5V17M12 7.2v.2" />
    </svg>
  );
}

export function CardsIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="3.5" y="7" width="13" height="9.5" rx="1.5" />
      <path d="M7.5 7V5.8A1.8 1.8 0 0 1 9.3 4h9.2A1.8 1.8 0 0 1 20.3 5.8V13a1.8 1.8 0 0 1-1.8 1.8H16.5" />
    </svg>
  );
}

export function BackIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={['rtl-flip', className].filter(Boolean).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function BrandMarkIcon({ size = 28, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 28 28" fill="none">
      <path
        d="M14 2.5c-5.2 0-9.5 4-9.5 9.2 0 6.4 7.4 13.3 9.1 14.8a.6.6 0 0 0 .8 0c1.7-1.5 9.1-8.4 9.1-14.8C23.5 6.5 19.2 2.5 14 2.5z"
        fill="currentColor"
      />
      <circle cx="14" cy="11.2" r="3.4" fill="#1a1a1c" />
    </svg>
  );
}

/** Calendar with a clock: a line's timetable at a stop. */
export function TimetableIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" />
      <path d="M4 10h16M8 3v4M16 3v4" />
      <circle cx="17" cy="17" r="4.2" />
      <path d="M17 15.2V17l1.2.9" />
    </svg>
  );
}

/**
 * Navigation arrow (Moovit "Start navigation"), pointing in the reading
 * direction. Add `.rtl-flip` so it points left in Hebrew.
 */
export function NavigateIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <path d="M21.4 11.1 4.3 3.3a1 1 0 0 0-1.35 1.25L5.9 12l-2.95 7.45a1 1 0 0 0 1.35 1.25l17.1-7.8a1 1 0 0 0 0-1.8z" />
    </svg>
  );
}
