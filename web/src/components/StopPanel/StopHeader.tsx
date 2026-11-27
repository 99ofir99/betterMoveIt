/** Stop header: back, stop name + code, favorite star. */

import { Icon } from '../icons/Icon';
import type { StopHeaderProps } from './types';
import { t } from '../../lib/i18n';

export function StopHeader({ name, code, onClose, favored, onToggleFavourite }: StopHeaderProps) {
  return (
    <header className="stp-header">
      <button type="button" className="stp-header__btn" onClick={onClose} aria-label={t("Back")}>
        <Icon name="arrow-back" size={22} />
      </button>
      <div className="stp-header__titles">
        <h2 className="stp-header__name" dir="auto">
          {name}
        </h2>
        {code ? <div className="stp-header__meta">{t("Stop")} {code}</div> : null}
      </div>
      <button
        type="button"
        className={`stp-header__btn stp-header__fav${favored ? ' is-on' : ''}`}
        onClick={onToggleFavourite}
        aria-pressed={favored}
        aria-label={favored ? t('Unfavorite') : t('Favorite')}
      >
        <Icon name={favored ? 'star' : 'star-outline'} size={24} />
      </button>
    </header>
  );
}
