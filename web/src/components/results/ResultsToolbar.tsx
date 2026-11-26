import { Icon } from '../icons/Icon';
import type { ResultsToolbarProps, SortChip } from './types';

const SORT_CHIPS: SortChip[] = [
  { mode: 'fastest', label: 'Fastest', icon: 'sliders' },
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
}: ResultsToolbarProps) {
  return (
    <div className="results-toolbar">
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
          aria-label={mapPeek ? 'Show journey list' : 'Show map'}
        >
          <Icon name={mapPeek ? 'list' : 'map'} size={18} />
          <span>{mapPeek ? 'List' : 'Map'}</span>
        </button>
      </div>
      <div className="results-toolbar__chips" role="group" aria-label="Sort journeys">
        {SORT_CHIPS.map(({ mode, label, icon }) => (
          <button
            key={mode}
            type="button"
            className={`results-toolbar__chip ${sortMode === mode ? 'is-active' : ''}`}
            aria-pressed={sortMode === mode}
            onClick={() => onSortMode(mode)}
          >
            <Icon name={icon} size={16} className="results-toolbar__chip-icon" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
