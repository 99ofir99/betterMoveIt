export interface LiveStatusChipProps {
  /** Line numbers being tracked (bus lines only). */
  lines: string[];
  /** Matching buses currently on the map. */
  count: number;
  /** First poll still in flight. */
  loading: boolean;
  /** Server snapshot time (ms). */
  updatedAt: number | null;
  /** Fly to the nearest buses and make them blink. */
  onFind: () => void;
  /** When Live location was last pressed (ms); a "none" answer shows only then. */
  requestedAt?: number | null;
  /** Turn Live location off. */
  onClose: () => void;
}
