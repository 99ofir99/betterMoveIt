import { PlayIcon } from '../icons';
import { t } from '../../lib/i18n';
/** Sticky primary CTA shown at the bottom of JourneyDetail. Visual only. */

interface TripStartBarProps {
  onStart: () => void;
}

export function TripStartBar({ onStart }: TripStartBarProps) {
  return (
    <div className="trip-start">
      <button type="button" className="trip-start__btn" onClick={onStart}>
        <span aria-hidden="true" className="trip-start__icon"><PlayIcon size={18} /></span>
        {t("Start trip")}
      </button>
    </div>
  );
}
