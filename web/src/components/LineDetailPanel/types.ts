/** Types for Moovit-style line detail (direction swap + ride-from-stop). */

import type { Journey, Line, LineScheduleStop, Stop } from '../../types';

export interface LineDetailPanelProps {
  lineId: string;
  onClose: () => void;
  onOpenStop: (stop: Stop) => void;
  onGeometryChange?: (geometry: [number, number][] | null) => void;
  /** Start live onboard navigation for a board→alight slice of this line. */
  onStartLineRide?: (journey: Journey) => void;
  /** Line metadata loaded (App derives live-bus match keys from it). */
  onLineLoaded?: (line: Line) => void;
  /** "Live location" on a stop card: show this line's buses heading there. */
  onLiveLocation?: (stop: Stop) => void;
}

export interface LineDirectionHeaderProps {
  /** Moovit-style "Destination ← Origin" label. */
  label: string;
  canChange: boolean;
  onChangeDirection: () => void;
}

export interface LineDestinationBarProps {
  boardName: string;
  onCancel: () => void;
}

export interface LineStopRowProps {
  stop: LineScheduleStop;
  index: number;
  /** Expanded schedule card (Moovit selects one stop at a time). */
  focused: boolean;
  isBoard: boolean;
  isLast: boolean;
  pickingDestination: boolean;
  disabled: boolean;
  onSelect: (index: number) => void;
  /** Present only for bus lines (light rail / trains have no live location). */
  onLiveLocation?: (stop: Stop) => void;
}

export interface LineStopListProps {
  stops: LineScheduleStop[];
  focusedIndex: number;
  boardIndex: number | null;
  pickingDestination: boolean;
  onSelectStop: (index: number) => void;
  onLiveLocation?: (stop: Stop) => void;
}

export interface LineDetailActionsProps {
  canStart: boolean;
  pickingDestination: boolean;
  favored: boolean;
  onStart: () => void;
  onToggleFavourite: () => void;
}
