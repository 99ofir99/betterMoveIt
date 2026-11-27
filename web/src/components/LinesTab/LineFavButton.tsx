import type { LineFavButtonProps } from './types';
import { StarIcon } from '../shared/icons';
import { t } from '../../lib/i18n';

export function LineFavButton({ favored, onToggle }: LineFavButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button lines-fav-btn ${favored ? 'is-fav' : ''}`}
      aria-label={favored ? t('Remove from favorites') : t('Add to favorites')}
      aria-pressed={favored}
      onClick={onToggle}
    >
      <StarIcon size={20} filled={favored} />
    </button>
  );
}
