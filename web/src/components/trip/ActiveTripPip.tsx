/**
 * Moovit multi_leg_nav_pip_layout — draggable floating chip.
 * Tap reveals close / expand controls overlaid on the card itself.
 */

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { BusIcon, ClockIcon, WalkIcon } from '../icons';
import { buildPipContent } from '../../lib/tripGuidance';
import { secondsSinceLocalMidnight } from '../../lib/format';
import { usePipDrag } from './usePipDrag';
import type { ActiveTripPipProps } from './types';

function PipIcon({ kind, color }: { kind: string; color?: string | null }) {
  if (kind === 'walk') {
    return (
      <span className="trip-pip__icon trip-pip__icon--walk" aria-hidden="true">
        <WalkIcon size={16} />
      </span>
    );
  }
  if (kind === 'wait') {
    return (
      <span className="trip-pip__icon trip-pip__icon--wait" aria-hidden="true">
        <ClockIcon size={16} />
      </span>
    );
  }
  const style = color
    ? { background: color.startsWith('#') ? color : `#${color}` }
    : undefined;
  return (
    <span className="trip-pip__icon trip-pip__icon--ride" style={style} aria-hidden="true">
      <BusIcon size={15} />
    </span>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
      <path d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4L10.6 12l-4.9 4.9a1 1 0 1 0 1.4 1.4L12 13.4l4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z" />
    </svg>
  );
}

function ExpandGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
    </svg>
  );
}

function isActionTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[data-pip-action]'));
}

type PipExitMode = 'expand' | 'close' | null;

const EXPAND_MS = 320;
const CLOSE_MS = 260;

export function ActiveTripPip({ state, onExpand, onClose }: ActiveTripPipProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 228, h: 96 });
  const [controlsOpen, setControlsOpen] = useState(false);
  const [exitMode, setExitMode] = useState<PipExitMode>(null);
  const actionLockRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const drag = usePipDrag(size.w, size.h);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [controlsOpen]);

  useLayoutEffect(() => {
    return () => {
      if (exitTimerRef.current != null) window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  const ensureVisibleForControls = useCallback(() => {
    if (!drag.tucked) return;
    const vw = window.innerWidth;
    if (drag.tuckSide === 'right') {
      drag.setPosition({ ...drag.position, x: Math.max(8, vw - size.w - 8) });
    } else if (drag.tuckSide === 'left') {
      drag.setPosition({ ...drag.position, x: 12 });
    }
  }, [drag, size.w]);

  const handleRootPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (exitMode || isActionTarget(e.target)) return;
      drag.onPointerDown(e);
    },
    [drag, exitMode]
  );

  const handleRootPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      if (exitMode || isActionTarget(e.target) || actionLockRef.current) {
        drag.endGesture(e.pointerId);
        return;
      }
      const wasDrag = drag.endGesture(e.pointerId);
      if (wasDrag) return;
      if (controlsOpen) {
        setControlsOpen(false);
        return;
      }
      ensureVisibleForControls();
      setControlsOpen(true);
    },
    [controlsOpen, drag, ensureVisibleForControls, exitMode]
  );

  const runAnimatedExit = useCallback((mode: 'expand' | 'close', fn: () => void) => {
    if (exitMode || actionLockRef.current) return;
    actionLockRef.current = true;
    setControlsOpen(true);
    setExitMode(mode);
    const ms = mode === 'expand' ? EXPAND_MS : CLOSE_MS;
    if (exitTimerRef.current != null) window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = window.setTimeout(() => {
      fn();
      actionLockRef.current = false;
      exitTimerRef.current = null;
    }, ms);
  }, [exitMode]);

  const handleClose = useCallback(
    (e: ReactPointerEvent | ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      runAnimatedExit('close', onClose);
    },
    [onClose, runAnimatedExit]
  );

  const handleExpand = useCallback(
    (e: ReactPointerEvent | ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      runAnimatedExit('expand', onExpand);
    },
    [onExpand, runAnimatedExit]
  );

  const nowSec = secondsSinceLocalMidnight();
  const pip = buildPipContent(
    state.journey,
    state.legIndex,
    state.phase,
    nowSec,
    state.progress,
    state.position
  );

  const className = [
    'trip-pip',
    drag.dragging ? 'is-dragging' : '',
    drag.tucked ? 'is-tucked' : '',
    drag.tuckSide ? `is-tucked-${drag.tuckSide}` : '',
    controlsOpen || exitMode ? 'is-controls' : '',
    exitMode === 'expand' ? 'is-expanding' : '',
    exitMode === 'close' ? 'is-closing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ left: drag.position.x, top: drag.position.y }}
      onPointerDown={handleRootPointerDown}
      onPointerUp={handleRootPointerUp}
      role="dialog"
      aria-label={`Active trip: ${pip.title}. ${pip.detail}. Arrive ${pip.arriveRelative}`}
    >
      <div className="trip-pip__card">
        <div className="trip-pip__body">
          <PipIcon kind={pip.kind} color={pip.routeColor} />
          <div className="trip-pip__meta">
            <div className="trip-pip__title">{pip.title}</div>
            {pip.detail ? <div className="trip-pip__detail">{pip.detail}</div> : null}
          </div>
        </div>
        <div className="trip-pip__footer">
          <span className="trip-pip__dude" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <circle cx="12" cy="7" r="3.2" />
              <path d="M6.5 20c.4-3.4 2.7-5.5 5.5-5.5s5.1 2.1 5.5 5.5" />
            </svg>
          </span>
          <span className="trip-pip__clock">{pip.arriveClock}</span>
          <span className="trip-pip__arrive">
            Arrive <strong>{pip.arriveRelative}</strong>
          </span>
        </div>

        {(controlsOpen || exitMode) && (
          <div className="trip-pip__controls" aria-hidden="false">
            <div className="trip-pip__scrim" />
            <button
              type="button"
              data-pip-action="close"
              className="trip-pip__action trip-pip__action--close"
              aria-label="Close floating trip"
              disabled={Boolean(exitMode)}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => {
                e.stopPropagation();
                handleClose(e);
              }}
            >
              <CloseGlyph />
            </button>
            <button
              type="button"
              data-pip-action="expand"
              className="trip-pip__action trip-pip__action--expand"
              aria-label="Open full Live Directions"
              disabled={Boolean(exitMode)}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => {
                e.stopPropagation();
                handleExpand(e);
              }}
            >
              <ExpandGlyph />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
