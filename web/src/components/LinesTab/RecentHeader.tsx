/**
 * RecentHeader — "Recent" section title with a ⋮ menu offering "Clear recent".
 * Menu open state is purely presentational.
 */

import { useEffect, useRef, useState } from 'react';
import type { RecentHeaderProps } from './types';
import { KebabIcon, TrashIcon } from '../shared/icons';

export function RecentHeader({ onClear }: RecentHeaderProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <div className="lines-recent__header" ref={rootRef}>
      <h2 className="lines-recent__title">Recent</h2>
      <button
        type="button"
        className="lines-recent__menu-btn"
        aria-label="Recent lines options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <KebabIcon size={20} />
      </button>
      {open && (
        <div className="lines-recent__menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="lines-recent__menu-item"
            onClick={() => {
              setOpen(false);
              onClear();
            }}
          >
            <TrashIcon size={18} />
            Clear recent
          </button>
        </div>
      )}
    </div>
  );
}
