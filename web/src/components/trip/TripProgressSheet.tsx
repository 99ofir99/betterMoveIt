/**
 * Moovit Live Directions — top app bar + dots, bottom card with ViewPager stages.
 *
 * Transit legs are TWO pager stages:
 *  1. wait  — only "Wait for one of these options" (lines you can board)
 *  2. ride  — single assumed/picked line + Switch + stop rail (on / will board)
 */

import { useEffect, useMemo, type ReactNode } from 'react';
import { sameCorridorRoute } from '../../lib/corridorLine';
import { formatClock12h, formatDuration } from '../../lib/format';
import { formatBundledLineLabel } from '../common/bundledLineLabel';
import { useSheetDrag } from '../sheet/useSheetDrag';
import { PinIcon } from '../icons';
import { buildWaitOptions } from './buildWaitOptions';
import { activeStageIndex, buildJourneyStages } from './journeyStages';
import { LegPager } from './LegPager';
import { LinePicker } from './LinePicker';
import { LiveDirectionsHeader } from './LiveDirectionsHeader';
import { TripActionPills } from './TripActionPills';
import { DonePhaseCard, WalkPhaseCard } from './TripPhaseCards';
import { TransitRideCard } from './TransitRideCard';
import { WaitOptionsCard } from './WaitOptionsCard';
import { useAlerts } from './useAlerts';
import { useLegPager } from './useLegPager';
import { useLegStageScroll } from './useLegStageScroll';
import { useLinePicker } from './useLinePicker';
import { useTripShare } from './useTripShare';
import { useWaitOptions } from './useWaitOptions';
import type { RouteInfo, TransitLeg, WalkLeg } from '../../types';
import type { TripProgressSheetProps } from './types';
import { t } from '../../lib/i18n';
import { secondsSinceLocalMidnight } from '../../lib/format';

export type { TripProgressSheetProps } from './types';

function WalkStage({
  leg,
  nextLine,
}: {
  leg: WalkLeg;
  nextLine?: string;
}) {
  const mins = Math.max(1, Math.round(leg.durationSec / 60));
  return (
    <div className="ld-walk">
      <div className="ld-ride__strip" data-sheet-drag>
        <span>{t('Walk {n} m', { n: Math.round(leg.distanceM) })}</span>
        <span className="ld-ride__strip-time">{t('{n} min', { n: mins })}</span>
      </div>
      <div className="ld-walk__body">
        <div className="ld-walk__title">
          {leg.toName ? t('Walk to {name}', { name: leg.toName }) : t('Walk')}
        </div>
        {nextLine && <div className="ld-walk__sub">{t('Then take {line}', { line: nextLine })}</div>}
      </div>
    </div>
  );
}

export function TripProgressSheet({
  state,
  onEnd,
  onBack,
  onToggleLiveBuses,
  liveBusesActive = false,
  liveBusCount,
  onSelectLeg,
  onToggleAlerts,
  onSelectCorridorLine,
}: TripProgressSheetProps) {
  const { journey, phase, legIndex, gpsAllowed, alertsEnabled, transitAlternatives } = state;
  const { legs } = journey;
  const isDone = phase === 'done';

  const stages = useMemo(() => buildJourneyStages(legs), [legs]);
  const activeStage = activeStageIndex(stages, legIndex, phase);

  const { bind, snap, forceSnap } = useSheetDrag({
    initialSnap: 'peek',
    withNav: false,
    behavior: 'free',
  });

  const handleSelectStage = (stageIndex: number) => {
    const stage = stages[stageIndex];
    if (stage) onSelectLeg?.(stage.legIndex);
  };

  const pager = useLegPager(activeStage, stages.length, handleSelectStage);
  const stageScroll = useLegStageScroll(pager.viewIndex, stages.length, pager.select);
  const waitOptions = useWaitOptions(state);
  const handleShare = useTripShare(journey);
  const linePicker = useLinePicker();

  useAlerts(state, alertsEnabled);

  // Wait stage: assume soonest corridor arrival. Switch / row tap locks it.
  useEffect(() => {
    if (phase !== 'waiting') return;
    const active = legs[legIndex];
    if (!active || active.mode !== 'transit') return;

    let transitIdx = 0;
    for (let i = 0; i < legIndex; i++) {
      if (legs[i]?.mode === 'transit') transitIdx++;
    }
    const alts = transitAlternatives?.[transitIdx];
    if (!alts || alts.length < 2 || waitOptions.length === 0) return;

    const soonestPreferred = waitOptions.find((g) =>
      alts.some((alt) => sameCorridorRoute(g.route, alt)),
    );
    if (!soonestPreferred) return;
    linePicker.assumeRoute(transitIdx, soonestPreferred.route);
  }, [phase, legIndex, legs, transitAlternatives, waitOptions, linePicker.assumeRoute]);

  // Apply assumed / Switch-picked line so ride-stage stops + alerts match.
  useEffect(() => {
    if (phase !== 'waiting' && phase !== 'onboard' && phase !== 'alight') return;
    const active = legs[legIndex];
    if (!active || active.mode !== 'transit') return;

    let transitIdx = 0;
    for (let i = 0; i < legIndex; i++) {
      if (legs[i]?.mode === 'transit') transitIdx++;
    }
    const chosen = linePicker.selectedRoutes[transitIdx];
    if (!chosen || !onSelectCorridorLine) return;
    onSelectCorridorLine(transitIdx, chosen);
  }, [phase, legIndex, legs, linePicker.selectedRoutes, onSelectCorridorLine]);

  useEffect(() => {
    if (isDone) {
      forceSnap('half');
      return;
    }
    const viewed = stages[pager.viewIndex];
    forceSnap(viewed && viewed.kind !== 'walk' ? 'half' : 'peek');
    requestAnimationFrame(() => {
      document
        .querySelectorAll<HTMLElement>('.ld-stage__page')
        .forEach((p) => {
          p.scrollTop = 0;
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on page / done
  }, [pager.viewIndex, isDone, forceSnap]);

  const headerSubtitle = `${formatDuration(journey.durationSec)} • ${formatClock12h(journey.arrivalSeconds)}`;

  const liveWaitCountdownSec = (() => {
    if (phase !== 'waiting') return state.nextAction.countdownSec;
    const soonest = waitOptions[0]?.next?.[0];
    if (soonest && Number.isFinite(soonest.minutes)) {
      return Math.max(0, soonest.minutes * 60);
    }
    return state.nextAction.countdownSec;
  })();

  const claimCorridorLine = (transitIdx: number, route: RouteInfo) => {
    linePicker.confirmRoute(transitIdx, route);
    onSelectCorridorLine?.(transitIdx, route);
  };

  const renderStagePage = (stageIndex: number): ReactNode => {
    const stage = stages[stageIndex];
    if (!stage) return null;
    const leg = legs[stage.legIndex];
    if (!leg) return null;

    const isActiveLeg = stage.legIndex === legIndex && !isDone;
    const isActiveStage = stageIndex === activeStage && !isDone;

    if (stage.kind === 'walk') {
      if (isActiveLeg && phase === 'walking') {
        return <WalkPhaseCard state={state} />;
      }
      const next = legs[stage.legIndex + 1];
      const nextLine =
        next?.mode === 'transit' ? next.route.displayName : undefined;
      if (!isActiveLeg) {
        return (
          <div className="ld-preview">
            <WalkStage leg={leg as WalkLeg} nextLine={nextLine} />
          </div>
        );
      }
      return <WalkStage leg={leg as WalkLeg} nextLine={nextLine} />;
    }

    const transitLeg = leg as TransitLeg;
    const transitIdx = stage.transitOrdinal ?? 0;
    const alts = transitAlternatives?.[transitIdx];
    const selectedRoute = linePicker.selectedRoutes[transitIdx];
    const canSwitch = Boolean(alts && alts.length > 1);
    const openSwitch = canSwitch
      ? () => linePicker.openFor(transitIdx, alts!)
      : undefined;

    // ── Stage 1: WAIT — only the lines you can board ───────────────────────
    if (stage.kind === 'wait') {
      const preferred =
        alts && alts.length > 0 ? alts : [transitLeg.route];
      const waitForLabel = formatBundledLineLabel(preferred);
      const countdown =
        isActiveLeg && phase === 'waiting'
          ? liveWaitCountdownSec
          : Math.max(0, transitLeg.departure - secondsNow());
      const optionsForPage =
        isActiveLeg && phase === 'waiting'
          ? waitOptions
          : buildWaitOptions({
              plannedLeg: transitLeg,
              preferredRoutes: preferred,
              stopDepartures: [],
              countdownSec: countdown,
            });

      return (
        <WaitOptionsCard
          options={optionsForPage}
          waitForLabel={waitForLabel}
          countdownSec={countdown}
          fromName={transitLeg.fromName}
          toName={transitLeg.toName}
          selectedRoute={selectedRoute ?? transitLeg.route}
          onSelectRoute={
            isActiveLeg && phase === 'waiting'
              ? (route) => {
                  claimCorridorLine(transitIdx, route);
                  // Picking a line advances to the ride / will-board stage.
                  const rideIdx = stages.findIndex(
                    (s) => s.kind === 'ride' && s.legIndex === stage.legIndex,
                  );
                  if (rideIdx >= 0) pager.select(rideIdx);
                }
              : undefined
          }
        />
      );
    }

    // ── Stage 2: RIDE — one line you are on / will get on + Switch + stops ─
    const liveRide =
      isActiveStage && (phase === 'onboard' || phase === 'alight' || phase === 'waiting');

    return (
      <TransitRideCard
        state={state}
        leg={transitLeg}
        live={liveRide && isActiveLeg}
        alternatives={alts}
        selectedRoute={selectedRoute}
        onChangeRoute={openSwitch}
      />
    );
  };

  return (
    <div className="ld-shell">
      <LiveDirectionsHeader
        subtitle={headerSubtitle}
        onBack={onBack ?? onEnd}
        alertsEnabled={alertsEnabled}
        onToggleAlerts={onToggleAlerts ?? (() => {})}
      />

      <div className="ld-shell__pager">
        <LegPager
          stages={stages}
          viewIndex={pager.viewIndex}
          activeIndex={activeStage}
          done={isDone}
          onSelect={pager.select}
          onPrev={pager.prev}
          onNext={pager.next}
        />
      </div>

      <div
        ref={bind.ref}
        className={[
          'trip-progress',
          'trip-progress--free',
          `trip-progress--snap-${snap}`,
          isDone ? 'trip-progress--done' : '',
          bind.className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={bind.style}
        role="complementary"
        aria-label={t("Trip progress")}
        data-snap={bind['data-snap']}
        data-dragging={bind['data-dragging']}
        onPointerDown={bind.onPointerDown}
      >
        <div className="trip-progress__grabber" data-sheet-grabber aria-hidden="true" />

        <div className="ld-body">
          {!gpsAllowed && !isDone && (
            <div className="trip-progress__gps-warn">
              <PinIcon size={14} />
              {legs.some((l) => l.mode === 'transit')
                ? t("Using schedule · GPS unavailable")
                : t("GPS unavailable")}
            </div>
          )}

          {isDone ? (
            <div className="ld-scroll" data-sheet-scroll>
              <DonePhaseCard state={state} />
            </div>
          ) : (
            <div
              className={`ld-stage${stageScroll.dragging ? ' is-paging' : ''}`}
              ref={stageScroll.viewportRef}
            >
              <div className="ld-stage__track" style={stageScroll.trackStyle}>
                {stages.map((s, i) => (
                  <div
                    className="ld-stage__page"
                    key={`${s.kind}-${s.legIndex}`}
                    aria-hidden={i !== pager.viewIndex}
                  >
                    <div className="ld-stage__page-inner" data-sheet-scroll>
                      {renderStagePage(i)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <TripActionPills
        onStop={onEnd}
        onToggleLiveBuses={onToggleLiveBuses}
        liveBusesActive={liveBusesActive}
        liveBusCount={liveBusCount}
        onShare={handleShare}
      />

      {linePicker.pickerOpen && (
        <LinePicker
          alternatives={linePicker.pickingAlternatives}
          onPick={(route) => {
            linePicker.pickRoute(route);
            onSelectCorridorLine?.(linePicker.pickingTransitIdx, route);
          }}
          onClose={linePicker.close}
        />
      )}
    </div>
  );
}

function secondsNow(): number {
  return secondsSinceLocalMidnight();
}
