/**
 * Dismissible banner that surfaces service alerts returned by /api/alerts.
 * Pure visual component — all logic lives in useServiceAlerts.
 */

import type { ServiceAlert } from '../types';

const SEVERITY_ICON: Record<ServiceAlert['severity'], string> = {
  info: 'ℹ️',
  warning: '⚠️',
  critical: '🚨',
};

interface ServiceAlertsBannerProps {
  alerts: ServiceAlert[];
  onDismiss: (id: string) => void;
}

export function ServiceAlertsBanner({ alerts, onDismiss }: ServiceAlertsBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="alerts-banner" role="status" aria-live="polite">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`alerts-banner__item alerts-banner__item--${alert.severity}`}
        >
          <span className="alerts-banner__icon" aria-hidden="true">
            {SEVERITY_ICON[alert.severity]}
          </span>
          <span className="alerts-banner__text">
            <strong className="alerts-banner__title">{alert.title}</strong>
            {alert.description && (
              <span className="alerts-banner__desc"> — {alert.description}</span>
            )}
          </span>
          <button
            type="button"
            className="alerts-banner__dismiss"
            onClick={() => onDismiss(alert.id)}
            aria-label={`Dismiss: ${alert.title}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
