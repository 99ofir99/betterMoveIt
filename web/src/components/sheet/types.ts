import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

export type SheetSnap = 'peek' | 'half' | 'full';

/** `free` = continuous finger height (Moovit-like). `snap` = peek/half/full rests. */
export type SheetDragBehavior = 'free' | 'snap';

export interface SheetSnapHeights {
  peek: number;
  half: number;
  full: number;
}

export interface UseSheetDragOptions {
  /** Initial / controlled snap. Defaults to `full`. */
  initialSnap?: SheetSnap;
  /** When true, subtract the tab bar height from available space. */
  withNav?: boolean;
  /** Disable drag. */
  enabled?: boolean;
  /**
   * `free` — height follows the finger with no discrete states (default for trip/directions).
   * `snap` — settles to peek / half / full.
   */
  behavior?: SheetDragBehavior;
  /** Called when the soft zone changes (also in free mode, derived from height). */
  onSnapChange?: (snap: SheetSnap) => void;
  /** Continuous height updates (px) — useful for map floats above the sheet. */
  onHeightChange?: (heightPx: number) => void;
  /**
   * Only the grabber / `[data-sheet-drag]` header resizes the sheet. Gestures in the
   * body just scroll the list and never collapse or expand the sheet.
   */
  grabberOnly?: boolean;
}

export interface SheetDragBind {
  ref: (node: HTMLElement | null) => void;
  style: CSSProperties;
  className: string;
  'data-snap': SheetSnap;
  'data-dragging': 'true' | 'false';
  onPointerDown: (e: ReactPointerEvent) => void;
}
