/**
 * Stations / Nearby — Moovit-style list that sits in a draggable map sheet.
 * Visual composition only; fetch logic lives in useNearbyTab.
 */

import { NearbyHeader } from './NearbyHeader';
import { NearbyStopRow } from './NearbyStopRow';
import { useNearbyTab } from './useNearbyTab';
import type { NearbyTabProps } from './types';

export function NearbyTab({
  center,
  onOpenStop,
  onLocate,
  locating,
  mapPeek = false,
  onToggleMapView,
}: NearbyTabProps) {
  const { stops, loading, error, outOfCoverage } = useNearbyTab(center, locating);

  return (
    <div className="nearby-tab">
      <NearbyHeader
        stopCount={stops.length}
        loading={loading}
        mapPeek={mapPeek}
        onToggleMapView={onToggleMapView}
        onLocate={onLocate}
        locating={locating}
      />

      <div className="nearby-tab__scroll">
        {error && <p className="error-text nearby-tab__status">{error}</p>}
        {loading && <p className="muted nearby-tab__status">Finding nearby stops…</p>}
        {!loading && !error && stops.length === 0 && (
          <p className="muted nearby-tab__status">
            {outOfCoverage
              ? 'Your location is outside the covered transit area.'
              : 'No stops found nearby. Try a different location.'}
          </p>
        )}

        <ul className="nearby-board">
          {stops.map((stop, idx) => (
            <NearbyStopRow
              key={stop.id}
              stop={stop}
              onPress={onOpenStop}
              showDivider={idx < stops.length - 1}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
