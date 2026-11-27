/** Trip history sub-panel. Visual only. */

import { displayPlaceLabel } from '../../lib/placeLabel';
import { PanelHeader } from './PanelHeader';
import type { HistoryPanelProps } from './types';
import type { TripHistoryEntry } from '../../lib/history';
import type { Place } from '../../types';
import { getLocale, t, tn, seqArrow } from '../../lib/i18n';
import { durationMinutes } from '../../lib/format';

export function HistoryPanel({ history, onReplay, onRemove, onNewTrip, onBack }: HistoryPanelProps) {
  return (
    <div className="more-panel">
      <PanelHeader title={t("Trip history")} onBack={onBack} />

      <div className="more-panel__actions">
        <button type="button" className="fav-section__action" onClick={onNewTrip}>
          {t("+ New trip")}
        </button>
      </div>

      {history.length === 0 ? (
        <p className="fav-empty">{t("No trips yet — plan your first journey.")}</p>
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
    new Date(entry.createdAt).toLocaleDateString(getLocale() === 'he' ? 'he-IL' : undefined),
    entry.durationSec != null ? t('{n} min', { n: durationMinutes(entry.durationSec) }) : '',
    entry.transfers != null
      ? tn(entry.transfers, '1 change', '{n} changes')
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
        aria-label={t('Replay trip from {from} to {to}', { from: entry.from.label, to: entry.to.label })}
      >
        <span className="more-history-row__route">
          {displayPlaceLabel(entry.from.label)} {seqArrow()} {displayPlaceLabel(entry.to.label)}
        </span>
        <span className="more-history-row__meta">{meta}</span>
      </button>
      <button
        type="button"
        className="fav-row__overflow"
        onClick={() => onRemove(entry.id)}
        aria-label={t("Remove from history")}
      >
        ×
      </button>
    </li>
  );
}
