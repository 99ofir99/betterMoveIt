/**
 * Moovit-style search overlay — stops, places, lines + Current location.
 * Composition only; state lives in useGlobalSearch.
 */

import { placeDedupeKey } from '../../lib/dedupeSearch';
import { Icon } from '../icons/Icon';
import { RecentPlaceRow } from './RecentPlaceRow';
import { SearchResultItem } from './SearchResultItem';
import { useGlobalSearch } from './useGlobalSearch';
import type { GlobalSearchProps } from './types';
import { t } from '../../lib/i18n';

export function GlobalSearch({
  bias,
  target = 'any',
  title,
  placeholder: placeholderProp,
  currentLocationLabel,
  onClose,
  onPickStop,
  onPickPlace,
  onPickLine,
  onPickCurrentLocation,
  onChooseOnMap,
}: GlobalSearchProps) {
  const s = useGlobalSearch(bias, target);
  const placeholder = placeholderProp ?? s.placeholder;

  return (
    <div className="global-search" role="dialog" aria-label={title || t('Search')}>
      <div className="global-search__bar">
        <button
          type="button"
          className="icon-button icon-button--ghost"
          onClick={onClose}
          aria-label={t("Back")}
        >
          <Icon name="arrow-back" />
        </button>
        <div className="global-search__field">
          <input
            className="global-search__input"
            value={s.q}
            onChange={(e) => s.setQ(e.target.value)}
            placeholder={placeholder}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            inputMode="search"
          />
          {s.q && (
            <button
              type="button"
              className="global-search__clear"
              onClick={() => s.setQ('')}
              aria-label={t("Clear")}
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
        {onChooseOnMap && (
          <button
            type="button"
            className="icon-button icon-button--ghost"
            onClick={() => {
              onChooseOnMap();
              onClose();
            }}
            aria-label={t("Choose on map")}
            title={t("Choose on map")}
          >
            <Icon name="map" />
          </button>
        )}
      </div>

      <div className="global-search__body">
        {!s.q.trim() && (
          <>
            {(target === 'from' || target === 'any') && onPickCurrentLocation && (
              <button
                type="button"
                className="suggestions__row suggestions__row--current"
                onClick={() => {
                  onPickCurrentLocation();
                  onClose();
                }}
              >
                <span className="suggestions__icon suggestions__icon--locate" aria-hidden="true">
                  <Icon name="my-location" size={16} />
                </span>
                <span className="suggestions__text">
                  <span className="suggestions__name">{currentLocationLabel ?? t('Current location')}</span>
                  <span className="suggestions__meta">{t("Use GPS")}</span>
                </span>
              </button>
            )}

            {(s.favs.places.length > 0 || s.favs.stops.length > 0) && (
              <section className="global-search__section">
                <h3>{t("Favorites")}</h3>
                {s.favs.places.map((p) => {
                  const slotName =
                    p.kind === 'home' ? t('Home') : p.kind === 'work' ? t('Work') : p.label;
                  const address = p.place.label?.trim();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="suggestions__row"
                      onClick={() => {
                        onPickPlace(p.place);
                        onClose();
                      }}
                    >
                      <span className="suggestions__icon">
                        {p.kind === 'home' ? '🏠' : p.kind === 'work' ? '🏢' : '★'}
                      </span>
                      <span className="suggestions__text">
                        <span className="suggestions__name">{slotName}</span>
                        {address && (
                          <span className="suggestions__meta">{address}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
                {s.favs.stops.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="suggestions__row"
                    onClick={() => {
                      onPickStop(item.stop);
                      onClose();
                    }}
                  >
                    <span className="suggestions__icon">🚏</span>
                    <span className="suggestions__text">
                      <span className="suggestions__name">{item.stop.name}</span>
                    </span>
                  </button>
                ))}
              </section>
            )}

            {s.recentPlaces.length > 0 && (
              <section className="global-search__section">
                <h3>{t("Recent")}</h3>
                {s.recentPlaces.map((place) => (
                  <RecentPlaceRow
                    key={placeDedupeKey(place)}
                    place={place}
                    favored={s.placeIsFavored(place)}
                    onPick={() => {
                      onPickPlace(place);
                      onClose();
                    }}
                    onToggleFavorite={() => s.togglePlace(place)}
                  />
                ))}
              </section>
            )}
          </>
        )}

        {s.q.trim() && s.loading && <p className="global-search__status">{t("Searching…")}</p>}
        {s.error && <p className="global-search__status global-search__status--err">{s.error}</p>}
        {s.q.trim() && !s.loading && !s.error && s.results.length === 0 && (
          <p className="global-search__status">{t("No results")}</p>
        )}

        <ul className="global-search__results">
          {s.results.map((r, i) => {
            const place =
              r.kind === 'place' && r.lat != null && r.lon != null
                ? { label: r.name, lat: r.lat, lon: r.lon }
                : null;
            const lineId =
              r.kind === 'line' ? String(r.id ?? r.index ?? i) : '';
            return (
              <SearchResultItem
                key={
                  r.kind === 'line'
                    ? `line-${lineId}-${i}`
                    : r.kind === 'place'
                      ? `place-${r.name}-${i}`
                      : `stop-${r.id}-${i}`
                }
                result={r}
                index={i}
                placeFavored={place ? s.placeIsFavored(place) : false}
                stopFavored={r.kind === 'stop' && r.id ? s.stopIsFavored(r.id) : false}
                lineFavored={r.kind === 'line' && lineId ? s.lineIsFavored(lineId) : false}
                onPickLine={(line) => {
                  onPickLine(line);
                  onClose();
                }}
                onPickPlace={(p) => {
                  onPickPlace(p);
                  onClose();
                }}
                onPickStop={(stop) => {
                  onPickStop(stop);
                  onClose();
                }}
                onTogglePlace={s.togglePlace}
                onToggleStop={s.toggleStop}
                onToggleLine={s.toggleLine}
              />
            );
          })}
        </ul>

        {onChooseOnMap && (
          <div className="global-search__find-map">
            <p className="global-search__find-map-hint">{t("Didn't find what you're looking for?")}</p>
            <button
              type="button"
              className="global-search__find-map-btn"
              onClick={() => {
                onChooseOnMap();
                onClose();
              }}
            >
              <Icon name="map" size={18} />
              {t("Find on Map")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
