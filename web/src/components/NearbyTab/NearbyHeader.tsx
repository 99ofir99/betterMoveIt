/** Moovit-style NEARBY section header with Map/List + locate. */

import { Icon } from '../icons/Icon';
import type { NearbyHeaderProps } from './types';

export function NearbyHeader({
  stopCount,
  loading,
  mapPeek,
  onToggleMapView,
  onLocate,
  locating,
}: NearbyHeaderProps) {
  return (
    <div className="nearby-tab__head">
      <div className="nearby-tab__titles">
        <h2 className="nearby-tab__title">Nearby</h2>
        {!loading && (
          <p className="nearby-tab__subtitle">
            {stopCount} stop{stopCount !== 1 ? 's' : ''} around you
          </p>
        )}
      </div>

      <div className="nearby-tab__actions">
        {onToggleMapView && (
          <button
            type="button"
            className={`nearby-tab__map-pill${mapPeek ? ' is-active' : ''}`}
            onClick={onToggleMapView}
            aria-pressed={mapPeek}
            aria-label={mapPeek ? 'Show station list' : 'Show map'}
          >
            <Icon name={mapPeek ? 'list' : 'map'} size={16} />
            <span>{mapPeek ? 'List' : 'Map'}</span>
          </button>
        )}
        <button
          type="button"
          className="icon-button icon-button--ghost nearby-tab__locate"
          onClick={onLocate}
          aria-label="Update my location"
        >
          {locating ? <span className="nearby-tab__locate-dot">…</span> : <LocateIcon />}
        </button>
      </div>
    </div>
  );
}

function LocateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
    </svg>
  );
}
