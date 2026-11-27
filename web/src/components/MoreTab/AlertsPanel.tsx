/** Service alerts sub-panel. Visual only. */

import { PanelHeader } from './PanelHeader';
import type { AlertsPanelProps } from './types';
import { t } from '../../lib/i18n';

export function AlertsPanel({ alerts, loading, onBack }: AlertsPanelProps) {
  return (
    <div className="more-panel">
      <PanelHeader title={t("Service alerts")} onBack={onBack} />

      {loading && <p className="fav-empty">{t("Loading alerts…")}</p>}
      {!loading && alerts.length === 0 && (
        <p className="fav-empty">{t("No active service alerts right now.")}</p>
      )}
      {!loading && alerts.length > 0 && (
        <ul className="more-alert-list">
          {alerts.map((a) => (
            <li key={a.id} className={`more-alert more-alert--${a.severity}`}>
              <strong>{a.title}</strong>
              {a.description && <p>{a.description}</p>}
              {a.affectedRoutes.length > 0 && (
                <p className="more-alert__routes">{t("Lines:")} {a.affectedRoutes.join(', ')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
