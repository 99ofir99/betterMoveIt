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

function formatFare(fareIls: number | undefined): string | undefined {
  return fareIls != null && Number.isFinite(fareIls) ? `₪${fareIls.toFixed(2)}` : undefined;
}

export function DirectionsSheet({
  journey,
  transitAlternatives,
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
            fare={formatFare(journey.fareIls)}
            saved={saved}
            onToggleSaved={handleToggleSaved}
          />

          <RouteSequence legs={journey.legs} transitAlternatives={transitAlternatives} />
        </div>

        <ShiftStrip
          departSeconds={journey.departSeconds}
          arrivalSeconds={journey.arrivalSeconds}
          onEarlier={onEarlier}
          onLater={onLater}
        />

        <ItineraryTimeline
          journey={journey}
          transitAlternatives={transitAlternatives}
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
