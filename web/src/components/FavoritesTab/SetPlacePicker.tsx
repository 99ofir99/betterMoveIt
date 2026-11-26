/** Overlay to choose Home / Work — search any place or use current location. Visual only. */

import { GlobalSearch } from '../GlobalSearch';
import type { SetPlacePickerProps } from './types';

export function SetPlacePicker({
  kind,
  bias,
  onClose,
  onPickPlace,
  onPickCurrentLocation,
  onChooseOnMap,
}: SetPlacePickerProps) {
  const title = kind === 'home' ? 'Set Home' : 'Set Work';

  return (
    <GlobalSearch
      bias={bias}
      target="from"
      title={title}
      placeholder="Search for an address or place"
      currentLocationLabel="Use current location"
      onClose={onClose}
      onPickPlace={onPickPlace}
      onPickCurrentLocation={onPickCurrentLocation}
      onChooseOnMap={onChooseOnMap}
      onPickStop={(stop) =>
        onPickPlace({
          label: stop.name,
          lat: stop.lat,
          lon: stop.lon,
          stopId: stop.id,
        })
      }
      onPickLine={() => undefined}
    />
  );
}
