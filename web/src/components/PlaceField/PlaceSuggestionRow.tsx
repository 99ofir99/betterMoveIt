/** One planner suggestion with empty/filled favourite star — visual only. */

import { SearchFavButton } from '../GlobalSearch/SearchFavButton';
import type { PlaceSuggestionRowProps } from './types';

export function PlaceSuggestionRow({
  result: r,
  favored,
  onPick,
  onToggleFavorite,
}: PlaceSuggestionRowProps) {
  return (
    <li className="search-result-row">
      <button type="button" className="suggestions__row" onClick={onPick}>
        <span className="suggestions__icon">{r.kind === 'place' ? '📍' : '🚏'}</span>
        <span className="suggestions__text">
          <span className="suggestions__name">{r.name}</span>
          {r.kind !== 'place' && (r.nameEn || r.code) && (
            <span className="suggestions__meta">
              {r.nameEn}
              {r.nameEn && r.code ? ' · ' : ''}
              {r.code ? `Stop ${r.code}` : ''}
            </span>
          )}
        </span>
      </button>
      <SearchFavButton favored={favored} label={r.name} onToggle={onToggleFavorite} />
    </li>
  );
}
