import type { LatLon, Place } from '../../types';

export type MapPickSlot = 'from' | 'to';

export interface MapLocationPickerProps {
  /** Initial map center (usually GPS or last search bias). */
  initialCenter: LatLon;
  slot: MapPickSlot;
  onCancel: () => void;
  onConfirm: (place: Place) => void;
}

export interface UseMapLocationPickerArgs {
  initialCenter: LatLon;
  onConfirm: (place: Place) => void;
}
