/** Green Moovit app bar: back/end, "Live Directions", `41 min • 12:02 am`, bell toggle. */

import { ArrowBackIcon, BellIcon } from '../icons';
import type { LiveDirectionsHeaderProps } from './types';

export function LiveDirectionsHeader({
  subtitle,
  onBack,
  alertsEnabled,
  onToggleAlerts,
}: LiveDirectionsHeaderProps) {
  return (
    <div className="ld-header">
      <button type="button" className="ld-header__back" onClick={onBack} aria-label="Back">
        <ArrowBackIcon size={24} />
      </button>
      <div className="ld-header__center">
        <div className="ld-header__title">Live Directions</div>
        <div className="ld-header__subtitle">{subtitle}</div>
      </div>
      <button
        type="button"
        className={['ld-header__bell', alertsEnabled ? 'is-active' : ''].filter(Boolean).join(' ')}
        onClick={onToggleAlerts}
        aria-label={alertsEnabled ? 'Disable trip alerts' : 'Enable trip alerts'}
        aria-pressed={alertsEnabled}
        title={alertsEnabled ? 'Alerts on' : 'Alerts off'}
      >
        <BellIcon size={22} />
      </button>
    </div>
  );
}
