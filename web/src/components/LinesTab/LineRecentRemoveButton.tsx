/** Small × to drop a line from Recents — visual only. */

import type { LineRecentRemoveButtonProps } from './types';

export function LineRecentRemoveButton({ lineName, onRemove }: LineRecentRemoveButtonProps) {
  return (
    <button
      type="button"
      className="lines-recent-remove"
      aria-label={`Remove ${lineName} from recent`}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
    >
      ×
    </button>
  );
}
