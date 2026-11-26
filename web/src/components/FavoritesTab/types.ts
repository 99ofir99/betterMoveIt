import type { FavoriteLine, FavoritePlace, FavoriteStop, LatLon, Place, Stop } from '../../types';

export interface FavoritesTabProps {
  onPlanTo: (place: Place) => void;
  onOpenStop: (stop: Stop) => void;
  onOpenLine: (lineId: string) => void;
  onGoDirections: () => void;
  onAddPlace?: () => void;
  /** Map bias for place search when setting Home / Work. */
  searchBias?: LatLon | null;
}

export interface SetPlacePickerProps {
  kind: 'home' | 'work';
  bias: LatLon | null;
  onClose: () => void;
  onPickPlace: (place: Place) => void;
  onPickCurrentLocation: () => void;
  onChooseOnMap?: () => void;
}

export interface PlaceRowProps {
  kind: 'home' | 'work' | 'custom';
  place?: FavoritePlace;
  label?: string;
  onSet: () => void;
  onGo: () => void;
  onClear: () => void;
}

export interface StopRowProps {
  item: FavoriteStop;
  onOpen: () => void;
  onRemove: () => void;
}

export interface LineRowProps {
  item: FavoriteLine;
  onOpen: () => void;
  onRemove: () => void;
}

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionAriaLabel?: string;
}
