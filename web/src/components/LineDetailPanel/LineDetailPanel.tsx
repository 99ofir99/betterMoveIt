/**
 * Line detail — Moovit sheet: compact header, direction swap, stop rail,
 * expanded schedule card, Start → onboard ride.
 */

import { RouteBadge } from '../common/RouteBadge';
import { Icon } from '../icons/Icon';
import { LineDestinationBar } from './LineDestinationBar';
import { LineDetailActions } from './LineDetailActions';
import { LineDirectionHeader } from './LineDirectionHeader';
import { LineStopList } from './LineStopList';
import type { LineDetailPanelProps } from './types';
import { useLineDetail } from './useLineDetail';

function agencyLabel(agency: string | undefined): string {
  if (!agency) return '';
  // GTFS sometimes stores a bare agency_id like "34".
  if (/^\d+$/.test(agency.trim())) return '';
  return agency;
}

export function LineDetailPanel({
  lineId,
  onClose,
  onOpenStop: _onOpenStop,
  onGeometryChange,
  onStartLineRide,
}: LineDetailPanelProps) {
  const s = useLineDetail(lineId, onGeometryChange);
  const boardStop =
    s.boardIndex != null && s.data ? s.data.stops[s.boardIndex] : null;
  const agency = agencyLabel(s.line?.agency);

  const handleSelectStop = (index: number) => {
    if (s.pickingDestination) {
      const journey = s.selectStopForRide(index);
      if (journey && onStartLineRide) onStartLineRide(journey);
      return;
    }
    s.focusStop(index);
  };

  return (
    <div className="line-detail">
      <div className="lnd-header">
        <button type="button" className="lnd-header__back" onClick={onClose} aria-label="Back">
          <Icon name="arrow-back" size={22} />
        </button>
        {s.line && (
          <RouteBadge
            className="lnd-header__badge"
            label={s.line.displayName || s.line.shortName}
            typeName={s.line.typeName}
            color={s.line.color}
          />
        )}
        <div className="lnd-header__titles">
          <div className="lnd-header__agency" dir="auto">
            {agency}
          </div>
        </div>
      </div>

      {s.pickingDestination && boardStop && (
        <LineDestinationBar boardName={boardStop.name} onCancel={s.cancelPick} />
      )}

      {!s.pickingDestination && (
        <LineDirectionHeader
          label={s.directionLabel}
          canChange={s.canChangeDirection}
          onChangeDirection={s.changeDirection}
        />
      )}

      {s.error && !s.data && <p className="error-text">{s.error}</p>}
      {!s.data && !s.error && <p className="muted lnd-loading">Loading line…</p>}

      {s.data && (
        <LineStopList
          stops={s.data.stops}
          focusedIndex={s.focusedIndex}
          boardIndex={s.boardIndex}
          pickingDestination={s.pickingDestination}
          onSelectStop={handleSelectStop}
        />
      )}

      {onStartLineRide && s.data && s.data.stops.length > 1 && (
        <LineDetailActions
          canStart
          pickingDestination={s.pickingDestination}
          favored={s.favored}
          onStart={s.beginStartFromSelection}
          onToggleFavourite={s.toggleFavourite}
        />
      )}

      <span hidden>{s.favTick}</span>
    </div>
  );
}
