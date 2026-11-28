/** Moovit bottom action strip: green "Start ride" + a quiet "Save". */

import { useLayoutEffect, useRef, useState } from 'react';
import type { LineDetailActionsProps } from './types';
import { t } from '../../lib/i18n';
import { NavigateIcon, StarIcon } from '../shared/icons';

export function LineDetailActions({
  canStart,
  pickingDestination,
  favored,
  onStart,
  onToggleFavourite,
}: LineDetailActionsProps) {
  const startLabelRef = useRef<HTMLSpanElement>(null);
  /** Narrow screen / large phone font: Save shrinks to a star so Start keeps its full label. */
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    const el = startLabelRef.current;
    if (!el) return;
    const check = () => {
      if (!compact && el.scrollWidth > el.clientWidth + 1) setCompact(true);
    };
    check();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [compact, pickingDestination]);

  if (pickingDestination) return null;
  const favLabel = favored ? t('Saved') : t('Save line');
  return (
    <div className={`lnd-actions${compact ? ' is-compact' : ''}`}>
      <button
        type="button"
        className="lnd-actions__start"
        disabled={!canStart}
        onClick={onStart}
      >
        <span className="lnd-actions__start-icon" aria-hidden>
          {/* Points the way you read: left in Hebrew. */}
          <NavigateIcon size={18} className="rtl-flip" />
        </span>
        <span className="lnd-actions__start-label" ref={startLabelRef}>
          {t("Start ride")}
        </span>
      </button>
      <button
        type="button"
        className={`lnd-actions__fav${favored ? ' is-on' : ''}`}
        onClick={onToggleFavourite}
        aria-pressed={favored}
        aria-label={favored ? t('Remove from saved lines') : t('Save line')}
        title={favLabel}
      >
        <StarIcon size={18} filled={favored} />
        {!compact && favLabel}
      </button>
    </div>
  );
}
