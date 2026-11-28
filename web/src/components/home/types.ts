/**
 * Types local to the home/ folder.
 * Global types (Journey, Place, etc.) live in src/types.ts.
 */
import type { NearestStopResult } from '../../lib/useNearestStop';
import type { DepartureGroup, FavoritePlace, Journey, Place, Stop } from '../../types';

/** Result returned by useFrequentDestination. */
export interface FrequentDestResult {
  place: Place;
  journey: Journey | null;
  loading: boolean;
  /** Still waiting for the user's location, so the destination isn't decided yet (skeleton). */
  pending?: boolean;
  /** Rounded minutes until departure (null if unavailable or past). */
  leavesInMin: number | null;
  /** The planned trip runs tomorrow (no more service today). */
  leavesTomorrow?: boolean;
  /** Seconds-from-midnight for the next boarding, for clock labels when far out. */
  leavesDepartureSec: number | null;
  /** True when boarding ETA is backed by live vehicle GPS. */
  leavesLive: boolean;
  /** Moovit accuracy tier for the boarding ETA color. */
  leavesConfidence: import('../../types').ArrivalConfidence;
  /** Schedule vs historical disclosure when not live. */
  leavesSource: import('../../types').ArrivalSource;
  /** Human-readable arrival time, e.g. "11:19 PM". */
  arriveLabel: string | null;
  /** Duration in minutes. */
  durationMin: number | null;
  /** Name of the first boarding stop. */
  boardingStop: string | null;
}

/** Props for the HomeScreen visual component. */
export interface HomeScreenProps {
  frequentDest: FrequentDestResult | null;
  /** Home "Nearest station" card; null while locating or when no stop is near. */
  nearestStop?: NearestStopResult | null;
  favorites: FavoritePlace[];
  onOpenSearch: () => void;
  /** seed: a trip already planned for this place, shown while the full plan loads. */
  onPlanTo: (place: Place, seed?: Journey | null) => void;
  /** Plan to a place with the "Depart at" time picker open. */
  onPlanAtTime?: (place: Place) => void;
  /** Open a stop's live departures board. */
  onOpenStop?: (stop: Stop) => void;
  /** Nearest station row: open that line in the direction it leaves this stop. */
  onOpenLineAtStop?: (group: DepartureGroup, stop: Stop) => void;
  onOpenMore: () => void;
  onAddFavorite: () => void;
  onPlanManually: () => void;
  /** Location permission was denied: show a hint card instead of the nearest station. */
  locationDenied?: boolean;
  onRetryLocation?: () => void;
}

/** Props for the FrequentDestinationCard visual component. */
export interface FrequentDestinationCardProps {
  dest: FrequentDestResult;
  onTap: () => void;
  /** Clock chip: plan to this destination with a chosen departure time. */
  onPickTime?: () => void;
  /** Live-bus chip: live arrivals at the trip's boarding stop. */
  onLiveBoarding?: () => void;
}

/** Props for a single Favourites row. */
export interface FavoriteItemProps {
  fav: FavoritePlace;
  onTap: () => void;
}
