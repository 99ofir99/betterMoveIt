/**
 * Favourites tab logic — load/persist Home/Work/stops/lines.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Place } from '../../types';
import { api } from '../../lib/api';
import {
  FAVORITES_CHANGED_EVENT,
  loadFavorites,
  removePlace,
  toggleFavoriteLine,
  toggleFavoriteStop,
  upsertPlace,
  type FavoritesState,
} from '../../lib/favorites';
import { t } from '../../lib/i18n';
import { fillPlaceAddress, fillSavedPlaceAddresses } from '../../lib/placeAddress';

export function useFavoritesTab() {
  const [favs, setFavs] = useState<FavoritesState>(() => loadFavorites());
  const [settingKind, setSettingKind] = useState<'home' | 'work' | 'custom' | null>(null);
  /** Picked in the Add flow, waiting for a name and type. */
  const [pendingPlace, setPendingPlace] = useState<Place | null>(null);

  useEffect(() => {
    const refresh = () => setFavs(loadFavorites());
    refresh();
    window.addEventListener(FAVORITES_CHANGED_EVENT, refresh);
    fillSavedPlaceAddresses();
    return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, refresh);
  }, []);

  const beginSetSlot = useCallback((kind: 'home' | 'work' | 'custom') => {
    setSettingKind(kind);
  }, []);

  const cancelSetSlot = useCallback(() => {
    setSettingKind(null);
  }, []);

  const confirmPlace = useCallback(
    (place: Place) => {
      if (!settingKind) return;
      if (settingKind === 'custom') {
        setPendingPlace(place);
        setSettingKind(null);
        return;
      }
      const labelDefault = settingKind === 'home' ? 'Home' : 'Work';
      setFavs(upsertPlace(settingKind, place, labelDefault));
      fillPlaceAddress(settingKind, place, labelDefault);
      setSettingKind(null);
    },
    [settingKind]
  );

  const confirmCurrentLocation = useCallback(() => {
    if (!settingKind) return;
    const kind = settingKind;
    const labelDefault = kind === 'home' ? 'Home' : 'Work';
    setSettingKind(null);

    if (!navigator.geolocation) {
      window.alert(t('Location is not available on this device.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        void api.reverseGeocode(lat, lon).then((address) => {
          const place: Place = {
            label: address || labelDefault,
            lat,
            lon,
          };
          if (kind === 'custom') setPendingPlace(place);
          else setFavs(upsertPlace(kind, place, labelDefault));
        });
      },
      () => window.alert(t('Could not get your location. Check permissions.'))
    );
  }, [settingKind]);

  /** Add flow, last step: save the picked place as Home, Work or a named place. */
  const savePending = useCallback(
    (kind: 'home' | 'work' | 'custom', name: string) => {
      const place = pendingPlace;
      setPendingPlace(null);
      if (!place) return;
      if (kind === 'custom') {
        setFavs(upsertPlace('custom', place, name.trim() || place.label));
      } else {
        const labelDefault = kind === 'home' ? 'Home' : 'Work';
        setFavs(upsertPlace(kind, place, labelDefault));
        fillPlaceAddress(kind, place, labelDefault);
      }
    },
    [pendingPlace]
  );

  /** Hand-typed address for a saved place; the coordinates stay as saved. */
  const editAddress = useCallback((id: string, address: string) => {
    const fav = loadFavorites().places.find((p) => p.id === id);
    if (!fav) return;
    setFavs(upsertPlace(fav.kind, { ...fav.place, label: address }, fav.label));
  }, []);

  const clearPlace = useCallback((id: string) => {
    setFavs(removePlace(id));
  }, []);

  const removeStop = useCallback((stop: FavoritesState['stops'][number]['stop']) => {
    setFavs(toggleFavoriteStop(stop));
  }, []);

  const removeLine = useCallback((line: FavoritesState['lines'][number]['line']) => {
    setFavs(toggleFavoriteLine(line));
  }, []);

  return {
    home: favs.places.find((p) => p.kind === 'home'),
    work: favs.places.find((p) => p.kind === 'work'),
    customPlaces: favs.places.filter((p) => p.kind === 'custom'),
    stops: favs.stops,
    lines: favs.lines,
    settingKind,
    beginSetSlot,
    cancelSetSlot,
    confirmPlace,
    confirmCurrentLocation,
    clearPlace,
    editAddress,
    pendingPlace,
    savePending,
    cancelPending: () => setPendingPlace(null),
    removeStop,
    removeLine,
  };
}
