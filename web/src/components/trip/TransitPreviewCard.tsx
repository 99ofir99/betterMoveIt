/**
 * Non-active transit leg in Live Directions — strip + board→alight + stop rail.
 * Clamped corridors: Switch + Show more opens Upcoming Arrivals (soonest pickup).
 */

import { useMemo, useState } from 'react';
import { formatClock12h } from '../../lib/format';
import { transitDestinationLabel } from '../../lib/railLabel';
import { formatBundledLineLabel } from '../common/bundledLineLabel';
import { buildWaitOptions } from './buildWaitOptions';
import { DepartureOptionRow } from './DepartureOptionRow';
import { LegEndpoints } from './LegEndpoints';
import { ShowMoreOptionsLink } from './ShowMoreOptionsLink';
import { StopProgressList } from './StopProgressList';
import { UpcomingArrivalsModal } from './UpcomingArrivalsModal';
import { useStopDepartures } from './useStopDepartures';
import { visibleWaitOptions, waitOptionsHiddenCount } from './waitOptionsCollapse';
import type { TransitPreviewCardProps } from './types';

export function TransitPreviewCard({
  leg,
  alternatives,
  selectedRoute,
  onSwitch,
}: TransitPreviewCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const routes =
    alternatives && alternatives.length > 0 ? alternatives : [selectedRoute ?? leg.route];
  const displayRoute = selectedRoute ?? routes[0] ?? leg.route;
  const previewLines = formatBundledLineLabel(
    routes[0] === displayRoute
      ? routes
      : [displayRoute, ...routes.filter((r) => r.index !== displayRoute.index)],
  );

  const stopDepartures = useStopDepartures(leg.from.stopId);
  const options = useMemo(
    () =>
      buildWaitOptions({
        plannedLeg: leg,
        preferredRoutes: routes,
        stopDepartures,
        countdownSec: undefined,
      }),
    [leg, routes, stopDepartures],
  );

  const showBoard = routes.length > 1 || options.length > 1;
  const visible = visibleWaitOptions(options, false);
  const hiddenCount = waitOptionsHiddenCount(options.length);
  const destination = transitDestinationLabel(displayRoute, leg.headsign);

  return (
    <>
      <div className="ld-preview">
        <div className="ld-ride__strip" data-sheet-drag>
          <span>
            {previewLines}
            {destination ? ` · ${destination}` : ''}
          </span>
          <span className="ld-ride__strip-time">{formatClock12h(leg.departure)}</span>
        </div>

        <div className="ld-preview__body" data-sheet-drag>
          <LegEndpoints
            from={leg.fromName}
            to={leg.toName}
            onSwitch={routes.length > 1 && onSwitch ? onSwitch : undefined}
          />
        </div>

        {showBoard && (
          <div className="ld-preview__alts">
            <div className="ld-preview__alts-title">Wait for one of these options</div>
            {options.length === 0 ? (
              <div className="ld-wait__loading">Loading departures…</div>
            ) : (
              <>
                {visible.map((g, i) => (
                  <DepartureOptionRow
                    key={`${g.route.index}-${g.headsign}-${i}`}
                    group={g}
                    highlighted={i === 0}
                  />
                ))}
                <ShowMoreOptionsLink
                  hiddenCount={hiddenCount}
                  onOpen={() => setModalOpen(true)}
                />
              </>
            )}
          </div>
        )}

        {leg.intermediateStops.length > 0 && (
          <StopProgressList stops={leg.intermediateStops} cursor={0} />
        )}
      </div>

      <UpcomingArrivalsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        options={options}
        stopName={leg.fromName}
        fromName={leg.fromName}
        toName={leg.toName}
      />
    </>
  );
}
