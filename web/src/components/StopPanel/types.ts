/** Types for Moovit-style stop / station detail. */

import type { DepartureGroup, Stop } from '../../types';

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
}

export interface StopDepartureListProps {
  departures: DepartureGroup[];
  onOpenLine?: (lineId: string) => void;
}

export interface StopActionsProps {
  favored: boolean;
  onFromHere: () => void;
  onToHere: () => void;
  onToggleFavourite: () => void;
}
