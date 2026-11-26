/** Shared lib types (insights, clamping display models, etc.). */

export type TripInsightLabel =
  | 'Direct'
  | 'Fewest transfers'
  | 'Least walking'
  | 'Earliest arrival'
  | 'Fastest'
  | 'High frequency';

/** Smart Tips badges keyed by index into the journeys list they were computed for. */
export type TripInsightMap = Map<number, TripInsightLabel[]>;
