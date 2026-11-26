import type { Journey, RouteInfo } from '../types';
import type { TripInsightMap } from '../lib/types';
import type { ClampedJourney } from '../lib/clampJourneys';

export interface JourneyListProps {
  /** Moovit-clamped route cards (alternatives merged onto first/last legs). */
  journeys: ClampedJourney[];
  selected: number;
  onSelect: (index: number) => void;
  /** When true, footer may show live-style minutes-until departure. */
  departNow?: boolean;
  /** Smart Tips badges keyed by index into `journeys`. */
  insights?: TripInsightMap;
}

export interface JourneyDetailProps {
  journey: Journey;
  /**
   * Alternative lines per transit-leg index (from Moovit clamping).
   * When present, transit legs with multiple alts show slash-joined badges + a tip.
   */
  transitAlternatives?: RouteInfo[][];
  /** Go back to the journey list (keeps plan data). */
  onClose: () => void;
  onStopClick: (stopId: string) => void;
  /** Called when the user taps "Start trip". */
  onStartTrip?: () => void;
}
