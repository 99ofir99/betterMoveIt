import type { LatLon, NearbyStopBoard, Stop } from '../../types';

export interface NearbyTabProps {
  center: LatLon;
  onOpenStop: (stop: Stop) => void;
  onLocate: () => void;
  locating: boolean;
  /** False when the list is around the map centre, not the user's own position. */
  hasLocation?: boolean;
  /** True when the stations sheet is collapsed to peek (map-first). */
  mapPeek?: boolean;
  onToggleMapView?: () => void;
}

export interface NearbyHeaderProps {
  stopCount: number;
  loading: boolean;
  mapPeek: boolean;
  onToggleMapView?: () => void;
  onLocate: () => void;
  locating: boolean;
  hasLocation?: boolean;
}

export interface NearbyStopRowProps {
  stop: NearbyStopBoard;
  onPress: (stop: Stop) => void;
  showDivider?: boolean;
}
