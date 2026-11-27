import type { LinesCategoryTabsProps } from './types';
import { t } from '../../lib/i18n';

export function LinesCategoryTabs({ tabs, active, onSelect }: LinesCategoryTabsProps) {
  return (
    <div className="lines-categories" role="tablist" aria-label={t("Line type")}>
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          className={`lines-categories__chip ${active === id ? 'is-active' : ''}`}
          onClick={() => onSelect(id)}
        >
          {t(label)}
        </button>
      ))}
    </div>
  );
}
