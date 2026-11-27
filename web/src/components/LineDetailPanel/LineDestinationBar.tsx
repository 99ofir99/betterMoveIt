/** Moovit "Where do you want to go?" after picking a board stop. */

import { Icon } from '../icons/Icon';
import type { LineDestinationBarProps } from './types';
import { t } from '../../lib/i18n';

export function LineDestinationBar({ boardName, onCancel }: LineDestinationBarProps) {
  return (
    <div className="lnd-dest" role="status">
      <div className="lnd-dest__body">
        <span className="lnd-dest__title">{t("Where do you want to go?")}</span>
        <span className="lnd-dest__sub" dir="auto">
          {t('From {name} — tap your get-off stop', { name: boardName })}
        </span>
      </div>
      <button type="button" className="lnd-dest__cancel" aria-label={t("Cancel")} onClick={onCancel}>
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
