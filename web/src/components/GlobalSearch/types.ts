import type { LatLon, Line, Place, Stop } from '../../types';

export type SearchTarget = 'from' | 'to' | 'any';

export interface GlobalSearchProps {
  bias: LatLon | null;
  target?: SearchTarget;
  title?: string;
  /** Overrides the default placeholder derived from `target`. */
  placeholder?: string;
  /** Label for the GPS row (default: "Current location"). */
  currentLocationLabel?: string;
  onClose: () => void;
  onPickStop: (stop: Stop) => void;
  onPickPlace: (place: Place) => void;
  onPickLine: (line: Line) => void;
  onPickCurrentLocation?: () => void;
  /** Moovit “Find on Map” / Choose on map — pick any lat/lon, not only stops. */
  onChooseOnMap?: () => void;
}

export interface SearchFavButtonProps {
  favored: boolean;
  label: string;
  onToggle: () => void;
}
