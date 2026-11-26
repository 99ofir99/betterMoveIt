/** Moovit stop header: back, stop name, Stop {code}. */

import { Icon } from '../icons/Icon';
import type { StopHeaderProps } from './types';

export function StopHeader({ name, code, onClose }: StopHeaderProps) {
  return (
    <header className="stp-header">
      <button type="button" className="stp-header__back" onClick={onClose} aria-label="Back">
        <Icon name="arrow-back" size={22} />
      </button>
      <div className="stp-header__titles">
        <h2 className="stp-header__name" dir="auto">
          {name}
        </h2>
        {code ? <div className="stp-header__meta">Stop {code}</div> : null}
      </div>
    </header>
  );
}
