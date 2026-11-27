import type { Journey, Leg, RouteInfo, TransitLeg, WalkLeg } from '../../types';
import type { LeaveEtaEntry } from '../../lib/boardingEta';

export interface DirectionsSheetProps {
  journey: Journey;
  /** Moovit alternative lines per transit-leg index (from journey clamping). */
  transitAlternatives?: RouteInfo[][];
  onEarlier: () => void;
  onLater: () => void;
  onStartTrip: () => void;
  onToggleLiveBuses?: () => void;
  liveBusesActive?: boolean;
  /** Live buses of this trip's lines now on the map (badge on the pill). */
  liveBusCount?: number;
  onShare?: () => void;
  onStopClick: (stopId: string) => void;
  /** Called when the star is toggled (`next` = new saved state). */
  onFavorite?: (next: boolean) => void;
}

export interface DirectionsSummaryProps {
  durationSec: number;
  /** Day the trip arrives ("Tomorrow", a weekday), '' when soon today. */
  dayLabel?: string;
  arrivalSeconds: number;
  /** Optional formatted fare (e.g. `₪16.00`) — omitted when the journey has none. */
  fare?: string;
  saved: boolean;
  onToggleSaved: () => void;
}

export interface RouteSequenceProps {
  legs: Leg[];
  /** Alternative lines per transit-leg index; omitted = primary route only. */
  transitAlternatives?: RouteInfo[][];
}

export interface ShiftStripProps {
  departSeconds: number;
  /** Day the trip leaves ("Tomorrow", a weekday), '' when soon today. */
  dayLabel?: string;
  arrivalSeconds: number;
  onEarlier: () => void;
  onLater: () => void;
}

export interface ItineraryTimelineProps {
  journey: Journey;
  /** Alternative lines per transit-leg index (from Moovit clamping). */
  transitAlternatives?: RouteInfo[][];
  onStopClick: (stopId: string) => void;
}

export interface DirectionsActionBarProps {
  onStartTrip: () => void;
  onToggleLiveBuses?: () => void;
  liveBusesActive?: boolean;
  /** Live buses of this trip's lines now on the map (badge on the pill). */
  liveBusCount?: number;
  onShare?: () => void;
}

export type ItineraryNodeKind = 'origin' | 'walk' | 'transit' | 'destination';

export interface ItineraryRowProps {
  node: ItineraryNodeKind;
  /** Style of the connector drawn below the node (`none` for the last row). */
  connector: 'solid' | 'dotted' | 'none';
  /** Destination is the saved Home / Work: show that place's icon instead of the pin. */
  place?: 'home' | 'work' | null;
  children: import('react').ReactNode;
}

export interface ItineraryTransitRowProps {
  leg: TransitLeg;
  /** Hide the boarding-stop button when the origin row already shows it. */
  hideBoardStop: boolean;
  onStopClick: (stopId: string) => void;
  /**
   * All clamped alternative routes for this transit slot (including primary).
   * When length > 1, the row shows slash-joined badges + a user tip.
   */
  alternatives?: RouteInfo[];
}

export interface ItineraryWalkRowProps {
  leg: WalkLeg;
}

export interface TransitLegEtaBadgeProps {
  eta: LeaveEtaEntry;
}
