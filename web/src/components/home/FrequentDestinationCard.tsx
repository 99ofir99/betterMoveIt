/**
 * FrequentDestinationCard — visual component only.
 * Logic and data come from props (computed by useFrequentDestination).
 */

import type { Journey, TransitLeg, WalkLeg } from '../../types';
import type { FrequentDestinationCardProps } from './types';
import {
  accuracyCaption,
  confidenceClass,
  formatEtaLabel,
  shouldShowRelativeEta,
} from '../../lib/arrivalAccuracy';
import { railTrainNumber, transitDestinationLabel } from '../../lib/railLabel';
import { LineBadge } from '../shared/LineBadge';
import {
  BusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  LiveSignalIcon,
  WalkIcon,
} from '../shared/icons';
import { t } from '../../lib/i18n';

// ── Leg chip renderers ───────────────────────────────────────────────────────

function WalkChip({ leg }: { leg: WalkLeg }) {
  const mins = leg.durationSec ? Math.round(leg.durationSec / 60) : null;
  return (
    <span className="fdcard__walk-chip" aria-label={mins ? t('Walk {n} min', { n: mins }) : t('Walk')}>
      <WalkIcon size={16} />
      {mins !== null && mins > 0 && <span>{mins}</span>}
    </span>
  );
}

function TransitChip({ leg }: { leg: TransitLeg }) {
  const typeName = (leg.route.typeName ?? 'bus').toLowerCase();
  const isTram =
    typeName === 'tram' || typeName === 'subway' || typeName === 'light_rail' || typeName === 'light rail';
  const isBus = typeName === 'bus' || typeName === '' || typeName === 'trolleybus';
  const isRail = !isTram && !isBus;
  const label = isRail
    ? railTrainNumber(leg.route, leg.headsign)
    : leg.route.displayName || leg.route.shortName;
  const dest = isRail ? transitDestinationLabel(leg.route, leg.headsign) : '';
  return (
    <span className="fdcard__transit-chip">
      <LineBadge label={label} mode={isTram ? 'tram' : isBus ? 'bus' : 'rail'} size="sm" />
      {dest ? (
        <span className="fdcard__rail-dest" dir="auto">
          {dest}
        </span>
      ) : null}
    </span>
  );
}

function LegChips({ journey }: { journey: Journey }) {
  return (
    <div className="fdcard__legs" aria-label={t("Route legs")}>
      {journey.legs.map((leg, i) => (
        <span key={i} className="fdcard__legs-group">
          {i > 0 && <ChevronRightIcon size={14} className="fdcard__arrow" />}
          {leg.mode === 'walk'
            ? <WalkChip leg={leg as WalkLeg} />
            : <TransitChip leg={leg as TransitLeg} />}
        </span>
      ))}
    </div>
  );
}

// ── Main card ────────────────────────────────────────────────────────────────

export function FrequentDestinationCard({ dest, onTap }: FrequentDestinationCardProps) {
  const {
    place,
    journey,
    loading,
    leavesInMin,
    leavesDepartureSec,
    leavesLive,
    leavesConfidence,
    leavesSource,
    arriveLabel,
    durationMin,
    boardingStop,
  } = dest;

  const leaveLabel =
    leavesInMin != null
      ? formatEtaLabel(leavesInMin, { departureSec: leavesDepartureSec ?? undefined })
      : null;
  const relativeLeave = leavesInMin != null && shouldShowRelativeEta(leavesInMin);
  const accClass = confidenceClass(leavesConfidence);

  return (
    <button type="button" className="fdcard" onClick={onTap} aria-label={t('Quick trip to {name}', { name: place.label })}>
      <div className="fdcard__header">
        <span className="fdcard__label">{t("My Frequent Destination")}</span>
        <span className="fdcard__chips" aria-hidden="true">
          <span className="fdcard__chip">
            <ClockIcon size={16} />
            <ChevronDownIcon size={12} />
          </span>
          <span className="fdcard__chip">
            <LiveSignalIcon size={14} />
            <BusIcon size={16} />
          </span>
        </span>
      </div>

      <div className="fdcard__body">
        <p className="fdcard__destination" dir="auto">
          <span className="fdcard__to-prefix">{t("To:")} </span>
          <span className="fdcard__to-name">{place.label}</span>
        </p>

        {loading && !journey && (
          <p className="fdcard__loading muted">{t("Planning route…")}</p>
        )}

        {journey && (
          <>
            <p className="fdcard__time">
              {durationMin !== null && <strong>{t('{n} min', { n: durationMin })}</strong>}
              {arriveLabel && (
                <span className="fdcard__arrive"> · {t('Arrive at {time}', { time: arriveLabel })}</span>
              )}
            </p>

            <LegChips journey={journey} />

            {(leaveLabel != null || boardingStop) && (
              <div className="fdcard__leaves-block">
                <p className="fdcard__leaves">
                  {leaveLabel != null ? (
                    <>
                      <span className="fdcard__leaves-label">
                        {relativeLeave ? t('Leaves in') : t('Leaves at')}
                      </span>
                      {leavesLive && leavesConfidence !== 'off_route' && (
                        <LiveSignalIcon size={14} className={`fdcard__live-icon ${accClass}`} />
                      )}
                      {leavesConfidence === 'off_route' && (
                        <span className="fdcard__off-route" aria-label={t("Off route")}>
                          !
                        </span>
                      )}
                      <span className={`fdcard__leaves-min ${accClass}`}>
                        {leaveLabel}
                      </span>
                    </>
                  ) : (
                    <span className="fdcard__leaves-label">{t("Departs soon")}</span>
                  )}
                  {boardingStop && (
                    <span className="fdcard__boarding" dir="auto">{t('from {stop}', { stop: boardingStop })}</span>
                  )}
                </p>
                <p className={`fdcard__acc-caption ${accClass}`}>
                  {accuracyCaption(leavesConfidence, leavesSource)}
                </p>
              </div>
            )}
          </>
        )}

        {!loading && !journey && (
          <p className="fdcard__tap-hint muted">{t("Tap to plan a trip")}</p>
        )}
      </div>
    </button>
  );
}
