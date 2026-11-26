/** Empty/filled star on a search location row — visual only. */

import { StarIcon } from '../shared/icons';
import type { SearchFavButtonProps } from './types';

export function SearchFavButton({ favored, label, onToggle }: SearchFavButtonProps) {
  return (
    <button
      type="button"
      className={`search-fav-btn ${favored ? 'is-fav' : ''}`}
      aria-label={favored ? `Remove ${label} from favorites` : `Add ${label} to favorites`}
      aria-pressed={favored}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      <StarIcon size={22} filled={favored} />
    </button>
  );
}
