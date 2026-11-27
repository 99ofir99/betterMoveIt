/** Moovit-style "Show N more options" — opens the Upcoming Arrivals sheet. */

import type { ShowMoreOptionsLinkProps } from './types';
import { t } from '../../lib/i18n';

export function ShowMoreOptionsLink({ hiddenCount, onOpen }: ShowMoreOptionsLinkProps) {
  if (hiddenCount <= 0) return null;

  return (
    <button type="button" className="ld-wait__more" onClick={onOpen}>
      {hiddenCount === 1 ? t('Show 1 more option') : t('Show {n} more options', { n: hiddenCount })}
    </button>
  );
}
