/** Overlay to choose Home / Work — search any place or use current location. Visual only. */

import { GlobalSearch } from '../GlobalSearch';
import type { SetPlacePickerProps } from './types';
import { t } from '../../lib/i18n';

export function SetPlacePicker({
  kind,
  bias,
  onClose,
  onPickPlace,
  onPickCurrentLocation,
  onChooseOnMap,
}: SetPlacePickerProps) {
  const title = kind === 'home' ? t('Set Home') : t('Set Work');

  return (
    <GlobalSearch
      bias={bias}
      target="from"
      title={title}
      placeholder={t("Search for an address or place")}
      currentLocationLabel={t("Use current location")}
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
