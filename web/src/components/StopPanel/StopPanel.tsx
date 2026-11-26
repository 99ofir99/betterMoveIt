/**
 * Stop / station detail — Moovit sheet:
 * back + name/code, upcoming arrivals board, From/To/Favorite pills.
 */

import { StopActions } from './StopActions';
import { StopDepartureList } from './StopDepartureList';
import { StopHeader } from './StopHeader';
import type { StopPanelProps } from './types';
import { useStopPanel } from './useStopPanel';

export function StopPanel({
  stopId,
  stopName,
  stop,
  onClose,
  onSetOrigin,
  onSetDestination,
  onOpenLine,
}: StopPanelProps) {
  const s = useStopPanel(stopId, stop);
  const name = s.data?.stop.name ?? stopName;
  const code = s.data?.stop.code ?? stop.code;

  return (
    <div className="stop-panel">
      <StopHeader name={name} code={code} onClose={onClose} />

      <div className="stop-panel__body">
        <div className="stp-section-title">Upcoming Arrivals</div>

        {s.error && <p className="error-text">{s.error}</p>}
        {s.loading && <p className="muted stp-loading">Loading departures…</p>}

        {s.data && (
          <StopDepartureList departures={s.data.departures} onOpenLine={onOpenLine} />
        )}
      </div>

      <StopActions
        favored={s.favored}
        onFromHere={onSetOrigin}
        onToHere={onSetDestination}
        onToggleFavourite={s.toggleFavourite}
      />
    </div>
  );
}
