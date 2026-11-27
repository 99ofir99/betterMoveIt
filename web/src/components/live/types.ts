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
  /** Turn Live location off. */
  onClose: () => void;
}
