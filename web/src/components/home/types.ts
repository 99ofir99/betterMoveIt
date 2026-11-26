/**
 * Types local to the home/ folder.
 * Global types (Journey, Place, etc.) live in src/types.ts.
 */
import type { FavoritePlace, Journey, Place } from '../../types';

/** Result returned by useFrequentDestination. */
export interface FrequentDestResult {
  place: Place;
  journey: Journey | null;
  loading: boolean;
  /** Rounded minutes until departure (null if unavailable or past). */
  leavesInMin: number | null;
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
  favorites: FavoritePlace[];
  onOpenSearch: () => void;
  onPlanTo: (place: Place) => void;
  onOpenMore: () => void;
  onAddFavorite: () => void;
  onPlanManually: () => void;
}

/** Props for the FrequentDestinationCard visual component. */
export interface FrequentDestinationCardProps {
  dest: FrequentDestResult;
  onTap: () => void;
}

/** Props for a single Favourites row. */
export interface FavoriteItemProps {
  fav: FavoritePlace;
  onTap: () => void;
}
