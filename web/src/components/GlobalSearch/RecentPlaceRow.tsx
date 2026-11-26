/** Recent location row with favourite star — visual only. */

import type { Place } from '../../types';
import { SearchFavButton } from './SearchFavButton';

interface RecentPlaceRowProps {
  place: Place;
  favored: boolean;
  onPick: () => void;
  onToggleFavorite: () => void;
}

export function RecentPlaceRow({
  place,
  favored,
  onPick,
  onToggleFavorite,
}: RecentPlaceRowProps) {
  return (
    <div className="search-result-row">
      <button type="button" className="suggestions__row" onClick={onPick}>
        <span className="suggestions__icon">🕘</span>
        <span className="suggestions__text">
          <span className="suggestions__name">{place.label}</span>
        </span>
      </button>
      <SearchFavButton
        favored={favored}
        label={place.label}
        onToggle={onToggleFavorite}
      />
    </div>
  );
}
