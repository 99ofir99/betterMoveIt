/** Moovit "Where do you want to go?" after picking a board stop. */

import { Icon } from '../icons/Icon';
import type { LineDestinationBarProps } from './types';

export function LineDestinationBar({ boardName, onCancel }: LineDestinationBarProps) {
  return (
    <div className="lnd-dest" role="status">
      <div className="lnd-dest__body">
        <span className="lnd-dest__title">Where do you want to go?</span>
        <span className="lnd-dest__sub" dir="auto">
          From {boardName} — tap your get-off stop
        </span>
      </div>
      <button type="button" className="lnd-dest__cancel" aria-label="Cancel" onClick={onCancel}>
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
