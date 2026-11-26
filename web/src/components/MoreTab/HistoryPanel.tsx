/** Trip history sub-panel. Visual only. */

import { PanelHeader } from './PanelHeader';
import type { HistoryPanelProps } from './types';
import type { TripHistoryEntry } from '../../lib/history';
import type { Place } from '../../types';

export function HistoryPanel({ history, onReplay, onRemove, onNewTrip, onBack }: HistoryPanelProps) {
  return (
    <div className="more-panel">
      <PanelHeader title="Trip history" onBack={onBack} />

      <div className="more-panel__actions">
        <button type="button" className="fav-section__action" onClick={onNewTrip}>
          + New trip
        </button>
      </div>

      {history.length === 0 ? (
        <p className="fav-empty">No trips yet — plan your first journey.</p>
      ) : (
        <ul className="more-history-list">
          {history.slice(0, 12).map((entry) => (
            <HistoryRow key={entry.id} entry={entry} onReplay={onReplay} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryRow({
  entry,
  onReplay,
  onRemove,
}: {
  entry: TripHistoryEntry;
  onReplay: (from: Place, to: Place) => void;
  onRemove: (id: string) => void;
}) {
  const meta = [
    new Date(entry.createdAt).toLocaleDateString(),
    entry.durationSec != null ? `${Math.round(entry.durationSec / 60)} min` : '',
    entry.transfers != null
      ? `${entry.transfers} change${entry.transfers !== 1 ? 's' : ''}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="more-history-row">
      <button
        type="button"
        className="more-history-row__main"
        onClick={() => onReplay(entry.from, entry.to)}
        aria-label={`Replay trip from ${entry.from.label} to ${entry.to.label}`}
      >
        <span className="more-history-row__route">
          {entry.from.label} → {entry.to.label}
        </span>
        <span className="more-history-row__meta">{meta}</span>
      </button>
      <button
        type="button"
        className="fav-row__overflow"
        onClick={() => onRemove(entry.id)}
        aria-label="Remove from history"
      >
        ×
      </button>
    </li>
  );
}
