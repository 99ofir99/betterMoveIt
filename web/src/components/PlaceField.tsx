/** Presentational pieces for the planner form. Favourite logic: usePlaceFavorites. */

import type { Place } from '../types';
import { dedupePlaces, placeDedupeKey } from '../lib/dedupeSearch';
import { PlaceSuggestionRow } from './PlaceField/PlaceSuggestionRow';
import { usePlaceFavorites } from './PlaceField/usePlaceFavorites';
import type { PlaceFieldProps } from './PlaceField/types';

export function PlaceField({
  id,
  label,
  value,
  placeholder,
  accent,
  query,
  onQueryChange,
  results,
  searchLoading,
  onPick,
  onClear,
  onUseMyLocation,
  locating,
  recent,
}: PlaceFieldProps) {
  const open = query.trim().length >= 1;
  const favs = usePlaceFavorites();

  return (
    <div className={`place-field place-field--${accent}`}>
      <span className="place-field__bullet" aria-hidden="true" />
      <div className="place-field__body">
        <label className="place-field__label" htmlFor={id}>
          {label}
        </label>
        <input
          id={id}
          className="place-field__input"
          value={query}
          placeholder={value?.label ?? placeholder}
          onChange={(e) => onQueryChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          inputMode="search"
        />
        {value && !open && (
          <button className="place-field__clear" onClick={onClear} aria-label={`Clear ${label}`} type="button">
            ×
          </button>
        )}
        {onUseMyLocation && !open && (
          <button
            className="place-field__locate"
            onClick={onUseMyLocation}
            type="button"
            aria-label="Use my location"
            disabled={locating}
          >
            {locating ? '…' : '◎'}
          </button>
        )}

        {open && (
          <ul className="suggestions" role="listbox" aria-label={`${label} suggestions`}>
            {searchLoading && <li className="suggestions__status">Searching…</li>}
            {!searchLoading && results.length === 0 && <li className="suggestions__status">No results found</li>}
            {results.slice(0, 12).map((r) => {
              if (r.lat == null || r.lon == null) return null;
              const place: Place = {
                label: r.name,
                lat: r.lat,
                lon: r.lon,
                stopId: r.kind === 'stop' ? r.id : undefined,
              };
              return (
                <PlaceSuggestionRow
                  key={r.id ?? `${r.name}-${r.lat}-${r.lon}`}
                  result={r}
                  favored={favs.isFavored(r)}
                  onPick={() => {
                    onPick(place);
                    onQueryChange('');
                  }}
                  onToggleFavorite={() => favs.toggle(r)}
                />
              );
            })}
            {results.length === 0 && recent.length > 0 && (
              <>
                <li className="suggestions__heading">Recent</li>
                {dedupePlaces(recent)
                  .slice(0, 4)
                  .map((p) => {
                    const asResult = {
                      kind: (p.stopId ? 'stop' : 'place') as 'stop' | 'place',
                      id: p.stopId,
                      name: p.label,
                      lat: p.lat,
                      lon: p.lon,
                    };
                    return (
                      <PlaceSuggestionRow
                        key={placeDedupeKey(p)}
                        result={asResult}
                        favored={favs.isFavored(asResult)}
                        onPick={() => {
                          onPick(p);
                          onQueryChange('');
                        }}
                        onToggleFavorite={() => favs.toggle(asResult)}
                      />
                    );
                  })}
              </>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
