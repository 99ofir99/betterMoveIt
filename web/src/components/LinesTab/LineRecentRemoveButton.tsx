/** Small × to drop a line from Recents — visual only. */

import type { LineRecentRemoveButtonProps } from './types';
import { t } from '../../lib/i18n';

export function LineRecentRemoveButton({ lineName, onRemove }: LineRecentRemoveButtonProps) {
  return (
    <button
      type="button"
      className="lines-recent-remove"
      aria-label={t('Remove {name} from recent', { name: lineName })}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
    >
      ×
    </button>
  );
}
