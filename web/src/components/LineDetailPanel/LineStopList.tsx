/** Moovit stop rail — continuous line + one expanded schedule card. */

import { LineStopRow } from './LineStopRow';
import type { LineStopListProps } from './types';
import { t } from '../../lib/i18n';

export function LineStopList({
  stops,
  focusedIndex,
  boardIndex,
  pickingDestination,
  onSelectStop,
  onLiveLocation,
}: LineStopListProps) {
  return (
    <ol className="lnd-stops" aria-label={t("Stops along this line")}>
      {stops.map((stop, i) => {
        const isBoard = boardIndex === i;
        const beforeBoard = pickingDestination && boardIndex != null && i < boardIndex;
        const isLast = i === stops.length - 1;
        // While picking a destination, board + earlier stops aren't valid alights.
        const disabled = Boolean(pickingDestination && (isBoard || beforeBoard));

        return (
          <LineStopRow
            key={`${stop.id}-${i}`}
            stop={stop}
            index={i}
            focused={focusedIndex === i}
            isBoard={isBoard}
            isLast={isLast}
            pickingDestination={pickingDestination}
            disabled={disabled}
            onSelect={onSelectStop}
            onLiveLocation={onLiveLocation}
          />
        );
      })}
    </ol>
  );
}
