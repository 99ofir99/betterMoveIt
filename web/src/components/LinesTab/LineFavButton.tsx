import type { LineFavButtonProps } from './types';
import { StarIcon } from '../shared/icons';

export function LineFavButton({ favored, onToggle }: LineFavButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button lines-fav-btn ${favored ? 'is-fav' : ''}`}
      aria-label={favored ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={favored}
      onClick={onToggle}
    >
      <StarIcon size={20} filled={favored} />
    </button>
  );
}
