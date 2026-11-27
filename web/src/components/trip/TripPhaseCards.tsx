/** Phase cards for walking / onboard / alight / done, plus the preview for a paged-to leg. */

import { formatClock12h, formatDistance, formatDuration, routeColor } from '../../lib/format';
import { railTrainNumber, transitDestinationLabel } from '../../lib/railLabel';
import { RouteBadge } from '../common/RouteBadge';
import { CheckCircleIcon, WalkIcon } from '../icons';
import type { TransitLeg, WalkLeg } from '../../types';
import type { LegPreviewCardProps, TripPhaseCardProps } from './types';
import { t, seqArrow } from '../../lib/i18n';

function countdownLabel(sec: number): string {
  if (sec <= 0) return t('now');
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  // Long waits (hours until first bus) — don't show mm:ss.
  if (m >= 60) return t('{n} min', { n: Math.round(sec / 60) });
  if (m === 0) return t('{n}s', { n: s });
  if (s === 0 || m >= 10) return t('{n} min', { n: m });
  return `${m}:${String(s).padStart(2, '0')}`;
}

function resolveColor(raw: string | null | undefined, leg: TransitLeg | null): string {
  if (raw) return raw.startsWith('#') ? raw : `#${raw}`;
  return leg ? routeColor(leg.route.color, leg.route.typeName) : '#1a65e5';
}

export function WalkPhaseCard({ state }: TripPhaseCardProps) {
  const { nextAction, journey, legIndex } = state;
  const rawLeg = journey.legs[legIndex];
  const walkLeg: WalkLeg | null = rawLeg?.mode === 'walk' ? (rawLeg as WalkLeg) : null;

  const distM = walkLeg != null ? Math.round(walkLeg.distanceM) : null;
  // Remaining walk time (from guidance progress), never the bus-schedule window.
  const walkSec =
    nextAction.countdownSec != null
      ? nextAction.countdownSec
      : walkLeg != null
        ? walkLeg.durationSec
        : null;
  const timeLabel =
    walkSec != null ? t('{n} min', { n: Math.max(1, Math.round(walkSec / 60)) }) : '';

  // Destination name: use the leg's toName directly for a clean display.
  const toName = walkLeg?.toName ?? '';

  return (
    <div className="ld-walk">
      {/* Strip — mirrors TransitRideCard's ld-ride__strip for visual parity */}
      <div className="ld-ride__strip" data-sheet-drag>
        <span className="ld-walk__strip-label">
          <WalkIcon size={14} className="ld-walk__strip-icon" />
          {distM != null ? t('Walk {n} m', { n: distM }) : t('Walk')}
        </span>
        <span className="ld-ride__strip-time">{timeLabel}</span>
      </div>

      {/* Body — destination name large, secondary instruction below */}
      <div className="ld-walk__body">
        <div className="ld-walk__title">{toName || nextAction.title}</div>
        {nextAction.subtitle && (
          <div className="ld-walk__sub">{nextAction.subtitle}</div>
        )}
      </div>
    </div>
  );
}

/** @deprecated Prefer TransitRideCard for onboard/alight — kept for previews. */
export function TransitPhaseCard({ state }: TripPhaseCardProps) {
  const { nextAction, journey, legIndex } = state;
  const leg = journey.legs[legIndex];
  const transitLeg = leg?.mode === 'transit' ? leg : null;
  const color = resolveColor(nextAction.routeColor, transitLeg);

  return (
    <div className="ld-phase ld-phase--transit">
      {nextAction.routeLabel && (
        <RouteBadge
          label={nextAction.routeLabel}
          typeName={nextAction.typeName ?? 'bus'}
          color={color}
          className="ld-phase__badge"
        />
      )}
      <div className="trip-progress__subtitle">{nextAction.subtitle}</div>
      <div className="trip-progress__title">{nextAction.title}</div>
      {nextAction.countdownSec != null && (
        <div className="trip-progress__countdown">
          {t('~{time} remaining', { time: countdownLabel(nextAction.countdownSec) })}
        </div>
      )}
    </div>
  );
}

export function DonePhaseCard({ state }: TripPhaseCardProps) {
  const { nextAction } = state;
  return (
    <div className="ld-phase ld-phase--done">
      <div className="ld-phase__icon ld-phase__icon--done">
        <CheckCircleIcon size={32} />
      </div>
      <div className="trip-progress__title">{nextAction.title}</div>
      <div className="trip-progress__subtitle">{nextAction.subtitle}</div>
    </div>
  );
}

/**
 * Read-only summary shown when the user pages to a leg other than the active one.
 * @deprecated TripProgressSheet now renders WalkStage / TransitRideCard for all pages;
 * this card is kept for compatibility but is not currently wired into the shell.
 */
export function LegPreviewCard({ leg, isPast }: LegPreviewCardProps) {
  return (
    <div className="ld-phase ld-phase--preview">
      {leg.mode === 'walk' ? (
        <>
          <div className="trip-progress__title">{t('Walk {dist}', { dist: formatDistance(leg.distanceM) })}</div>
          <div className="trip-progress__subtitle">
            {t('{n} min', { n: Math.max(1, Math.round(leg.durationSec / 60)) })}{leg.toName ? ` · ${t('to {name}', { name: leg.toName })}` : ''}
          </div>
        </>
      ) : (
        <>
          <RouteBadge
            label={railTrainNumber(leg.route, leg.headsign)}
            typeName={leg.route.typeName}
            color={leg.route.color}
            className="ld-phase__badge"
          />
          <div className="trip-progress__title">
            {transitDestinationLabel(leg.route, leg.headsign) || leg.headsign}
          </div>
          <div className="trip-progress__subtitle">
            {leg.fromName} {formatClock12h(leg.departure)} {seqArrow()} {leg.toName} {formatClock12h(leg.arrival)}
          </div>
          <div className="trip-progress__subtitle">{t('{time} ride', { time: formatDuration(leg.durationSec) })}</div>
        </>
      )}
      <div className="ld-phase__hint">{isPast ? t('Completed step') : t('Upcoming step')}</div>
    </div>
  );
}
