/** Types for Moovit-style stop / station detail. */

import type { DepartureGroup, Stop, StopDeparturesResponse } from '../../types';

export interface StopPanelProps {
  stopId: string;
  stopName: string;
  /** Full stop — used for favorites and "From/To here". */
  stop: Stop;
  onClose: () => void;
  onSetOrigin: () => void;
  onSetDestination: () => void;
  /** Optional: tap a departure to open that line. */
  onOpenLine?: (lineId: string) => void;
}

export interface StopHeaderProps {
  name: string;
  code?: string;
  onClose: () => void;
  favored: boolean;
  onToggleFavourite: () => void;
}

export interface StopDepartureListProps {
  departures: DepartureGroup[];
  /** Shown in the empty state: first departure after the board runs dry. */
  nextDeparture?: StopDeparturesResponse['nextDeparture'];
  /** Feed day-of-week (0 = Sunday) the board was computed for. */
  dow?: number;
  onOpenLine?: (lineId: string) => void;
}

export interface StopActionsProps {
  onFromHere: () => void;
  onToHere: () => void;
}
