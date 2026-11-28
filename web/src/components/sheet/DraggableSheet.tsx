/** Visual wrapper for map bottom sheets — drag logic lives in useSheetDrag. */

import { useEffect, type ReactNode } from 'react';
import { useSheetDrag } from './useSheetDrag';
import type { SheetDragBehavior, SheetSnap } from './types';

interface DraggableSheetProps {
  children: ReactNode;
  className?: string;
  ariaLabel: string;
  withNav?: boolean;
  initialSnap?: SheetSnap;
  enabled?: boolean;
  behavior?: SheetDragBehavior;
  onSnapChange?: (snap: SheetSnap) => void;
  onHeightChange?: (heightPx: number) => void;
  /** Optional controlled snap (e.g. results Map/List toggle). Honored in free and snap modes. */
  snap?: SheetSnap;
  /** Keep bottom-sheet + drag behavior even on wide screens (map peek). */
  overlay?: boolean;
  /** Only the grabber / `[data-sheet-drag]` header resizes; body only scrolls. */
  grabberOnly?: boolean;
}

export function DraggableSheet({
  children,
  className = '',
  ariaLabel,
  withNav = true,
  initialSnap = 'full',
  enabled = true,
  behavior = 'free',
  onSnapChange,
  onHeightChange,
  snap: controlledSnap,
  overlay = true,
  grabberOnly = false,
}: DraggableSheetProps) {
  const { bind, snap, forceSnap, dragging } = useSheetDrag({
    initialSnap: controlledSnap ?? initialSnap,
    withNav,
    enabled,
    behavior,
    onSnapChange,
    onHeightChange,
    grabberOnly,
  });

  useEffect(() => {
    if (!controlledSnap || controlledSnap === snap || dragging) return;
    forceSnap(controlledSnap);
  }, [controlledSnap, snap, forceSnap, dragging]);

  const classes = [
    'sheet',
    overlay ? 'sheet--overlay' : '',
    withNav ? 'sheet--with-nav' : '',
    `sheet--snap-${snap}`,
    behavior === 'free' ? 'sheet--free' : '',
    bind.className,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      ref={bind.ref}
      className={classes}
      style={bind.style}
      aria-label={ariaLabel}
      data-snap={bind['data-snap']}
      data-dragging={bind['data-dragging']}
      onPointerDown={bind.onPointerDown}
    >
      <div className="sheet__grabber" data-sheet-grabber aria-hidden="true" />
      {children}
    </section>
  );
}
