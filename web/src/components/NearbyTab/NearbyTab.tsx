/**
 * Stations / Nearby — Moovit-style list that sits in a draggable map sheet.
 * Visual composition only; fetch logic lives in useNearbyTab.
 */

import { NearbyHeader } from './NearbyHeader';
import { NearbyStopRow } from './NearbyStopRow';
import { useNearbyTab } from './useNearbyTab';
import type { NearbyTabProps } from './types';
import { t } from '../../lib/i18n';
import { RippleLoader } from '../common/RippleLoader';

export function NearbyTab({
  center,
  onOpenStop,
  onLocate,
  locating,
  hasLocation = true,
  mapPeek = false,
  onToggleMapView,
}: NearbyTabProps) {
  const { stops, loading, error, outOfCoverage } = useNearbyTab(center, locating);

  return (
    <div className="nearby-tab">
      <NearbyHeader
        stopCount={stops.length}
        loading={loading || (Boolean(error) && stops.length === 0)}
        mapPeek={mapPeek}
        onToggleMapView={onToggleMapView}
        onLocate={onLocate}
        locating={locating}
        hasLocation={hasLocation}
      />

      <div className="nearby-tab__scroll">
        {error && <p className="error-text nearby-tab__status">{error}</p>}
        {loading && <RippleLoader label={t("Finding nearby stops…")} />}
        {!loading && !error && stops.length === 0 && (
          <p className="muted nearby-tab__status">
            {outOfCoverage
              ? t('Your location is outside the covered transit area.')
              : t('No stops found nearby. Try a different location.')}
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
