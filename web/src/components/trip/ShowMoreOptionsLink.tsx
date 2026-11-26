/** Moovit-style "Show N more options" — opens the Upcoming Arrivals sheet. */

import type { ShowMoreOptionsLinkProps } from './types';

export function ShowMoreOptionsLink({ hiddenCount, onOpen }: ShowMoreOptionsLinkProps) {
  if (hiddenCount <= 0) return null;

  return (
    <button type="button" className="ld-wait__more" onClick={onOpen}>
      {`Show ${hiddenCount} more option${hiddenCount === 1 ? '' : 's'}`}
    </button>
  );
}
