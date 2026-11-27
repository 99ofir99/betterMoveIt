/**
 * Stop / station detail — Moovit sheet:
 * back + name/code + favorite star, route from/to row, upcoming arrivals board.
 */

import { StopActions } from './StopActions';
import { StopDepartureList } from './StopDepartureList';
import { StopHeader } from './StopHeader';
import type { StopPanelProps } from './types';
import { useStopPanel } from './useStopPanel';
import { t } from '../../lib/i18n';

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
      <StopHeader
        name={name}
        code={code}
        onClose={onClose}
        favored={s.favored}
        onToggleFavourite={s.toggleFavourite}
      />
      <StopActions onFromHere={onSetOrigin} onToHere={onSetDestination} />

      <div className="stop-panel__body">
        <div className="stp-section-title">{t("Upcoming Arrivals")}</div>

        {s.error && <p className="error-text">{s.error}</p>}
        {s.loading && <p className="muted stp-loading">{t("Loading departures…")}</p>}

        {s.data && (
          <StopDepartureList
            departures={s.data.departures}
            nextDeparture={s.data.nextDeparture}
            dow={s.data.time?.dow}
            onOpenLine={onOpenLine}
          />
        )}
      </div>

    </div>
  );
}
