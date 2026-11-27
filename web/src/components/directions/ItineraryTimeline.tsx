/** Vertical itinerary (Moovit style): orange origin ring, white track, leg rows, destination. */

import { displayPlaceLabel, placeKindOf } from '../../lib/placeLabel';
import type { Leg } from '../../types';
import { formatClock12h, formatDistance, formatDuration } from '../../lib/format';
import { transitDestinationLabel } from '../../lib/railLabel';
import { BundledLineBadge } from '../common/BundledLineBadge';
import { SwipeRail } from '../common/SwipeRail';
import { ItineraryRow } from './ItineraryRow';
import { TransitLegEtaBadge } from './TransitLegEtaBadge';
import { useTransitLegEta } from './useTransitLegEta';
import type {
  ItineraryTimelineProps,
  ItineraryTransitRowProps,
  ItineraryWalkRowProps,
} from './types';
import { t } from '../../lib/i18n';

interface Endpoint {
  name: string;
  stopId?: string;
}

function cleanPlaceName(name: string | undefined | null): string | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  // Server / geocode placeholders — prefer a real stop name when available.
  if (/^(origin|start|your location|current location)$/i.test(trimmed)) return undefined;
  return trimmed;
}

function originOf(legs: Leg[]): Endpoint {
  const first = legs[0];
  if (!first) return { name: t('Starting point') };

  if (first.mode === 'transit') {
    return {
      name: cleanPlaceName(first.fromName) ?? t('Boarding stop'),
      stopId: first.from.stopId,
    };
  }

  const fromWalk = cleanPlaceName(first.fromName);
  if (fromWalk) return { name: fromWalk, stopId: first.from?.stopId };

  // Walk-to-first-stop: Moovit shows the boarding stop as the origin label.
  const board = legs.find((l): l is Extract<Leg, { mode: 'transit' }> => l.mode === 'transit');
  if (board) {
    return {
      name: cleanPlaceName(board.fromName) ?? t('Starting point'),
      stopId: board.from.stopId,
    };
  }

  return { name: t('Starting point'), stopId: first.from?.stopId };
}

function destinationOf(leg: Leg | undefined): string {
  if (!leg) return t('Destination');
  return leg.toName ? displayPlaceLabel(leg.toName) : t('Destination');
}

function WalkRow({ leg }: ItineraryWalkRowProps) {
  return (
    <>
      <div className="itin__title">{t('Walk {dist}', { dist: formatDistance(leg.distanceM) })}</div>
      <div className="itin__sub">
        {t('{n} min', { n: Math.max(1, Math.round(leg.durationSec / 60)) })}
        {leg.toName ? ` · ${t('to {name}', { name: displayPlaceLabel(leg.toName) })}` : ''}
      </div>
    </>
  );
}

function TransitRow({ leg, hideBoardStop, onStopClick, alternatives }: ItineraryTransitRowProps) {
  const middle = leg.intermediateStops.slice(1, -1);
  const routes = alternatives && alternatives.length > 0 ? alternatives : [leg.route];
  const eta = useTransitLegEta(leg, alternatives);
  const destination = transitDestinationLabel(leg.route, leg.headsign);

  return (
    <>
      <div className="itin__line-row">
        <SwipeRail className="itin__line">
          <BundledLineBadge routes={routes} />
          {destination ? <span className="itin__headsign">{destination}</span> : null}
        </SwipeRail>
        <TransitLegEtaBadge eta={eta} />
      </div>

      {!hideBoardStop && (
        <button
          type="button"
          className="itin__stop"
          onClick={() => leg.from.stopId && onStopClick(leg.from.stopId)}
        >
          <span>{leg.fromName}</span>
          <span className={`itin__stop-eta ${eta.confidence ? `is-acc-${eta.confidence}` : eta.live ? 'is-acc-high' : 'is-acc-none'}`}>
            {formatClock12h(eta.departure)}
          </span>
        </button>
      )}

      {middle.length > 0 && (
        <details className="itin__mids">
          <summary>
            {middle.length === 1 ? t('1 stop') : t('{n} stops', { n: middle.length })}
          </summary>
          <ol>
            {middle.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="itin__stop itin__stop--sm"
                  onClick={() => onStopClick(s.id)}
                >
                  <span>{s.name}</span>
                  <span>{formatClock12h(s.arrival)}</span>
                </button>
              </li>
            ))}
          </ol>
        </details>
      )}

      <button
        type="button"
        className="itin__stop"
        onClick={() => leg.to.stopId && onStopClick(leg.to.stopId)}
      >
        <span>{leg.toName}</span>
        <span>{formatClock12h(leg.arrival)}</span>
      </button>
      <div className="itin__sub">
        {leg.route.agency} · {t('{time} ride', { time: formatDuration(leg.durationSec) })}
      </div>
    </>
  );
}

export function ItineraryTimeline({ journey, transitAlternatives, onStopClick }: ItineraryTimelineProps) {
  const { legs } = journey;
  const first = legs[0];
  const last = legs[legs.length - 1];
  const origin = originOf(legs);
  const firstIsTransit = first?.mode === 'transit';

  let transitIdx = 0;

  return (
    <ol className="itin" aria-label={t("Itinerary")}>
      <ItineraryRow node="origin" connector={firstIsTransit ? 'solid' : 'dotted'}>
        <div className="itin__head">
          <div>
            <div className="itin__place">{origin.name}</div>
            {origin.stopId && <div className="itin__id">{t("ID")} {origin.stopId}</div>}
          </div>
          <div className="itin__when">
            <div className="itin__clock">{formatClock12h(journey.departSeconds)}</div>
            <div className="itin__when-label">{t("Leave at")}</div>
          </div>
        </div>
      </ItineraryRow>

      {legs.map((leg, i) => {
        if (leg.mode === 'walk') {
          return (
            <ItineraryRow key={i} node="walk" connector="dotted">
              <WalkRow leg={leg} />
            </ItineraryRow>
          );
        }
        const alts = transitAlternatives?.[transitIdx];
        transitIdx += 1;
        return (
          <ItineraryRow key={i} node="transit" connector="solid">
            <TransitRow
              leg={leg}
              hideBoardStop={i === 0}
              onStopClick={onStopClick}
              alternatives={alts}
            />
          </ItineraryRow>
        );
      })}

      <ItineraryRow node="destination" connector="none" place={placeKindOf(last?.toName)}>
        <div className="itin__head">
          <div className="itin__place">{destinationOf(last)}</div>
          <div className="itin__when">
            <div className="itin__clock">{formatClock12h(journey.arrivalSeconds)}</div>
            <div className="itin__when-label">{t("Arrive")}</div>
          </div>
        </div>
      </ItineraryRow>
    </ol>
  );
}