/** Sticky primary CTA shown at the bottom of JourneyDetail. Visual only. */

interface TripStartBarProps {
  onStart: () => void;
}

export function TripStartBar({ onStart }: TripStartBarProps) {
  return (
    <div className="trip-start">
      <button type="button" className="trip-start__btn" onClick={onStart}>
        <span aria-hidden="true" className="trip-start__icon">▶</span>
        Start trip
      </button>
    </div>
  );
}
