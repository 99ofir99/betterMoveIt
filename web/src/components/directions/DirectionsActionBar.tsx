/**
 * Sticky bottom bar of the route details: one clear primary action ("Start ride",
 * green, takes the free width) and quiet secondary ones (Live location, Share as
 * an icon) so the row always fits a narrow phone without scrolling.
 * Same look as the line screen's Start / Save bar.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { ActionPill } from '../common/ActionPill';
import { LiveBusIcon, ShareIcon } from '../icons';
import { NavigateIcon } from '../shared/icons';
import type { DirectionsActionBarProps } from './types';
import { t } from '../../lib/i18n';

export function DirectionsActionBar({
  onStartTrip,
  onToggleLiveBuses,
  liveBusesActive,
  liveBusCount,
  onShare,
}: DirectionsActionBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  /** Large phone font: Live location shrinks to its icon rather than a cut-off label. */
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    // Text widths (scrollWidth is the full text even while clipped) plus the fixed
    // icons, paddings and gaps; independent of `compact`, so it can't flip-flop.
    const check = () => {
      const labels = [...bar.querySelectorAll<HTMLElement>('.action-pill__label')];
      const [start, live] = labels;
      if (!start || !live || !bar.querySelector('.action-pill--quiet:not(.action-pill--icon-only)')) {
        setCompact(false);
        return;
      }
      const fixed = 16 + 18 + 5 + 16 + (12 + 20 + 5 + 12 + 2) + (labels.length > 2 ? 46 + 6 : 0) + 6 + 24 + 4;
      setCompact(start.scrollWidth + live.scrollWidth + fixed > bar.clientWidth);
    };
    check();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(bar);
    return () => ro?.disconnect();
  }, []);
  return (
    <div className={`directions__actions${compact ? ' is-compact' : ''}`} ref={barRef}>
      <ActionPill
        tone="green"
        className="action-pill--primary"
        label={t("Start ride")}
        icon={<NavigateIcon size={18} className="rtl-flip" />}
        onClick={onStartTrip}
      />
      {onToggleLiveBuses && (
        <ActionPill
          tone="blue"
          className="action-pill--quiet"
          label={t("Live location")}
          icon={<LiveBusIcon size={20} />}
          onClick={onToggleLiveBuses}
          pressed={liveBusesActive}
          badge={liveBusCount}
        />
      )}
      {onShare && (
        <ActionPill
          tone="blue"
          className="action-pill--quiet action-pill--icon-only"
          label={t("Share")}
          icon={<ShareIcon size={18} />}
          onClick={onShare}
        />
      )}
    </div>
  );
}
