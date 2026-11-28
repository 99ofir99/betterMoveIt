/**
 * NearestStopCard — home carousel card (Moovit "Nearest station"): the closest stop,
 * its distance, and the next departures of its lines. Data from useNearestStop.
 */

import type { DepartureGroup } from '../../types';
import type { NearestStopResult } from '../../lib/useNearestStop';
import { confidenceClass, formatEtaLabel } from '../../lib/arrivalAccuracy';
import { railTrainNumber } from '../../lib/railLabel';
import { modeFamilyForRoute } from '../../lib/transportMode';
import { formatClock, formatDistance } from '../../lib/format';
import { StopDepartureList } from '../StopPanel/StopDepartureList';
import { LineBadge } from '../shared/LineBadge';
import { BusIcon, ClockIcon, LiveSignalIcon } from '../shared/icons';
import { t } from '../../lib/i18n';

/** Two lines keep this card about as tall as the saved-destination card beside it
 *  (the carousel gives both the same height), so neither shows an empty area. */
const MAX_ROWS = 2;
/** Walking speed used for the "n min walk" hint (same 80 m/min as the planner). */
const WALK_M_PER_MIN = 80;

function DepartureRow({
  group,
  onOpen,
}: {
  group: DepartureGroup;
  /** Open this line in the direction it leaves this stop. */
  onOpen?: () => void;
}) {
  const family = modeFamilyForRoute(group.route);
  const mode = family === 'tram' ? 'tram' : family === 'rail' ? 'rail' : 'bus';
  const label =
    family === 'rail'
      ? railTrainNumber(group.route, group.headsign)
      : group.route.displayName || group.route.shortName;
  const [first, ...rest] = group.next;
  const later = rest
    .slice(0, 2)
    .map((n) => formatClock(n.departure))
    .join(', ');
  return (
    <li
      className={`nscard__row${onOpen ? ' nscard__row--tap' : ''}`}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={
        onOpen ? t('Line {line} to {headsign}', { line: label, headsign: group.headsign }) : undefined
      }
      onClick={
        onOpen
          ? (e) => {
              // The card itself opens the stop board; a row opens its line.
              e.stopPropagation();
              onOpen();
            }
          : undefined
      }
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              onOpen();
            }
          : undefined
      }
    >
      <LineBadge label={label} mode={mode} size="sm" />
      <span className="nscard__headsign" dir="auto">
        {group.headsign}
      </span>
      <span className="nscard__times">
        <span className={`nscard__eta ${confidenceClass(first.confidence ?? 'none')}`}>
          {first.live ? <LiveSignalIcon size={12} /> : <ClockIcon size={14} />}
          {formatEtaLabel(first.minutes, { departureSec: first.departure })}
        </span>
        {later ? <span className="nscard__later">{later}</span> : null}
      </span>
    </li>
  );
}

export function NearestStopCard({
  data,
  onOpen,
  onOpenLine,
}: {
  data: NearestStopResult;
  onOpen: () => void;
  /** Tap a departure row: that line, in its direction from this stop. */
  onOpenLine?: (group: DepartureGroup) => void;
}) {
  const { stop, distanceM, groups, loading } = data;
  const walkMin = distanceM != null ? Math.max(1, Math.round(distanceM / WALK_M_PER_MIN)) : null;
  return (
    <div
      role="button"
      tabIndex={0}
      className="fdcard nscard"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={t('Nearest station: {name}', { name: stop.name })}
    >
      <div className="fdcard__header">
        <span className="fdcard__label">{t('Nearest station')}</span>
        <span className="fdcard__chips">
          <button
            type="button"
            className="fdcard__chip"
            aria-label={t('Live arrivals')}
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <LiveSignalIcon size={14} />
            <BusIcon size={16} />
          </button>
        </span>
      </div>
      <div className="fdcard__body">
        <p className="fdcard__destination nscard__name" dir="auto">
          {stop.name}
        </p>
        {distanceM != null && walkMin != null ? (
          <p className="nscard__distance">
            {formatDistance(distanceM)} · {t('{n} min walk', { n: walkMin })}
          </p>
        ) : null}
        {groups.length > 0 ? (
          <ul className="nscard__rows">
            {groups.slice(0, MAX_ROWS).map((g) => (
              <DepartureRow
                key={`${g.route.index}-${g.direction}-${g.headsign}`}
                group={g}
                onOpen={onOpenLine ? () => onOpenLine(g) : undefined}
              />
            ))}
          </ul>
        ) : loading ? (
          <p className="fdcard__loading muted">{t('Loading departures…')}</p>
        ) : (
          <StopDepartureList
            departures={[]}
            nextDeparture={data.nextDeparture}
            dow={data.dow}
            onOpenLine={() => undefined}
          />
        )}
      </div>
    </div>
  );
}

/** Same frame as the real card while the location and nearest stop load. */
export function NearestStopSkeleton() {
  return (
    <div className="fdcard nscard is-loading" aria-busy="true" aria-label={t('Nearest station')}>
      <div className="fdcard__header">
        <span className="fdcard__label">{t('Nearest station')}</span>
      </div>
      <div className="fdcard__body" aria-hidden="true">
        <span className="fdcard__skel fdcard__skel--title" />
        <span className="fdcard__skel fdcard__skel--line" />
        <span className="fdcard__skel fdcard__skel--legs" />
        <span className="fdcard__skel fdcard__skel--short" />
      </div>
    </div>
  );
}
