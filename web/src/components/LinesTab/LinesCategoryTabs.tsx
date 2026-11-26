import type { LinesCategoryTabsProps } from './types';

export function LinesCategoryTabs({ tabs, active, onSelect }: LinesCategoryTabsProps) {
  return (
    <div className="lines-categories" role="tablist" aria-label="Line type">
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          className={`lines-categories__chip ${active === id ? 'is-active' : ''}`}
          onClick={() => onSelect(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
