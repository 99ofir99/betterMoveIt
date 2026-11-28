/**
 * Moovit "Directions" trip detail — composition only.
 * Scrollable itinerary + sticky footer actions (outside the scroll area).
 */

import { useState } from 'react';
import { DirectionsActionBar } from './DirectionsActionBar';
import { DirectionsSummary } from './DirectionsSummary';
import { ItineraryTimeline } from './ItineraryTimeline';
import { RouteSequence } from './RouteSequence';
import { ShiftStrip } from './ShiftStrip';
import type { DirectionsSheetProps } from './types';
import { dayOffsetOf, departureDayLabel, journeyDayLabel } from '../../lib/journeyStale';

function formatFare(fareIls: number | undefined): string | undefined {
  return fareIls != null && Number.isFinite(fareIls) ? `₪${fareIls.toFixed(2)}` : undefined;
}

export function DirectionsSheet({
  journey,
  transitAlternatives,
  departNow = false,
  onEarlier,
  onLater,
  onStartTrip,
  onToggleLiveBuses,
  liveBusesActive,
  liveBusCount,
  onShare,
  onStopClick,
  onFavorite,
}: DirectionsSheetProps) {
  const [saved, setSaved] = useState(false);
  const departDay = journeyDayLabel(journey);
  const arrivalDay = departureDayLabel(journey.arrivalSeconds, dayOffsetOf(journey));

  const handleToggleSaved = () => {
    const next = !saved;
    setSaved(next);
    onFavorite?.(next);
  };

  return (
    <div className="directions">
      <div className="directions__scroll">
        <div data-sheet-drag>
          <DirectionsSummary
            durationSec={journey.durationSec}
            arrivalSeconds={journey.arrivalSeconds}
            dayLabel={arrivalDay}
            fare={formatFare(journey.fareIls)}
            saved={saved}
            onToggleSaved={handleToggleSaved}
          />

          <RouteSequence legs={journey.legs} transitAlternatives={transitAlternatives} />
        </div>

        {/* Earlier / later means nothing for a walk: it is the same whenever you leave. */}
        {journey.legs.some((l) => l.mode === 'transit') && (
        <ShiftStrip
          departSeconds={journey.departSeconds}
          arrivalSeconds={journey.arrivalSeconds}
          dayLabel={departDay}
          onEarlier={onEarlier}
          onLater={onLater}
        />
        )}

        <ItineraryTimeline
          journey={journey}
          transitAlternatives={transitAlternatives}
          departNow={departNow}
          onStopClick={onStopClick}
        />
      </div>

      <DirectionsActionBar
        onStartTrip={onStartTrip}
        onToggleLiveBuses={onToggleLiveBuses}
        liveBusesActive={liveBusesActive}
        liveBusCount={liveBusCount}
        onShare={onShare}
      />
    </div>
  );
}
