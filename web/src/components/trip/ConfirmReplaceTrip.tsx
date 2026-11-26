/**
 * Confirm dialog — shown when the user taps "Start trip" while one is already active.
 * Visual-only: all logic lives in App.handleStartTrip.
 * Matches the existing .modal/.modal__card shell used by other overlays.
 */
import type { ConfirmReplaceTripProps } from './types';

export function ConfirmReplaceTrip({ onConfirm, onCancel }: ConfirmReplaceTripProps) {
  return (
    <div className="modal" role="presentation">
      <div className="modal__backdrop" onClick={onCancel} />
      <div
        className="modal__card trip-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="trip-confirm-title"
        aria-describedby="trip-confirm-desc"
      >
        <div className="modal__head">
          <div>
            <h2 id="trip-confirm-title">Start a new trip?</h2>
            <p id="trip-confirm-desc" className="modal__head-desc">
              Starting a new trip will end the current one
            </p>
          </div>
        </div>

        <div className="trip-confirm__actions">
          <button
            type="button"
            className="trip-confirm__btn trip-confirm__btn--primary"
            onClick={onConfirm}
          >
            Start
          </button>
          <button
            type="button"
            className="trip-confirm__btn trip-confirm__btn--ghost"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
