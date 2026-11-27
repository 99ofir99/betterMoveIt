export interface LiveToastState {
  /** Changes on every Live location press so the toast re-animates. */
  key: number;
  /** null while the first answer is pending. */
  count: number | null;
}

export interface LiveToastProps {
  toast: LiveToastState | null;
  /** Tracked line numbers (bus lines only). */
  lines: string[];
  onDismiss: () => void;
  /** Turn Live location off. */
  onTurnOff: () => void;
}
