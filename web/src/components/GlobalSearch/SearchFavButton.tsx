/** Empty/filled star on a search location row — visual only. */

import { StarIcon } from '../shared/icons';
import type { SearchFavButtonProps } from './types';
import { t } from '../../lib/i18n';

export function SearchFavButton({ favored, label, onToggle }: SearchFavButtonProps) {
  return (
    <button
      type="button"
      className={`search-fav-btn ${favored ? 'is-fav' : ''}`}
      aria-label={favored ? t('Remove {name} from favorites', { name: label }) : t('Add {name} to favorites', { name: label })}
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
