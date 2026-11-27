import { Icon } from '../icons/Icon';
import type { ResultsToolbarProps, SortChip } from './types';
import { t } from '../../lib/i18n';

const SORT_CHIPS: SortChip[] = [
  { mode: 'fastest', label: 'Fastest', icon: 'trophy' },
  { mode: 'least-walking', label: 'Less walking', icon: 'walk' },
  { mode: 'fewest-transfers', label: 'Fewer transfers', icon: 'swap-horiz' },
];

export function ResultsToolbar({
  departLabel,
  onOpenDepartSheet,
  mapPeek,
  onToggleMapView,
  sortMode,
  onSortMode,
  onOpenPreferences,
  prefsBadgeCount = 0,
  part = 'all',
}: ResultsToolbarProps) {
  return (
    <div className={`results-toolbar results-toolbar--${part}`}>
      {part !== 'chips' && (
      <div className="results-toolbar__row">
        <button
          type="button"
          className="results-toolbar__pill results-toolbar__pill--depart"
          onClick={onOpenDepartSheet}
        >
          <span className="results-toolbar__pill-label">{departLabel}</span>
          <Icon name="expand-more" size={18} className="results-toolbar__chevron" />
        </button>
        <button
          type="button"
          className={`results-toolbar__pill results-toolbar__pill--map ${mapPeek ? 'is-active' : ''}`}
          onClick={onToggleMapView}
          aria-pressed={mapPeek}
          aria-label={mapPeek ? t('Show journey list') : t('Show map')}
        >
          <Icon name={mapPeek ? 'list' : 'map'} size={18} />
          <span>{mapPeek ? t('List') : t('Map')}</span>
        </button>
      </div>
      )}
      {part !== 'row' && (
      <div className="results-toolbar__chips" role="group" aria-label={t("Sort journeys")}>
        {onOpenPreferences ? (
          <button
            type="button"
            className={`results-toolbar__chip results-toolbar__chip--prefs ${prefsBadgeCount > 0 ? 'has-badge' : ''}`}
            onClick={onOpenPreferences}
            aria-label={
              prefsBadgeCount > 0
                ? t('Preferences, {n} active', { n: prefsBadgeCount })
                : t('Preferences')
            }
          >
            <Icon name="sliders" size={16} className="results-toolbar__chip-icon" />
            {t('Preferences')}
            {prefsBadgeCount > 0 ? (
              <span className="results-toolbar__chip-badge" aria-hidden="true">
                {prefsBadgeCount}
              </span>
            ) : null}
          </button>
        ) : null}
        {SORT_CHIPS.map(({ mode, label, icon }) => (
          <button
            key={mode}
            type="button"
            className={`results-toolbar__chip ${sortMode === mode ? 'is-active' : ''}`}
            aria-pressed={sortMode === mode}
            onClick={() => onSortMode(mode)}
          >
            <Icon name={icon} size={16} className="results-toolbar__chip-icon" />
            {t(label)}
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
