/** Service alerts sub-panel. Visual only. */

import { PanelHeader } from './PanelHeader';
import type { AlertsPanelProps } from './types';

export function AlertsPanel({ alerts, loading, onBack }: AlertsPanelProps) {
  return (
    <div className="more-panel">
      <PanelHeader title="Service alerts" onBack={onBack} />

      {loading && <p className="fav-empty">Loading alerts…</p>}
      {!loading && alerts.length === 0 && (
        <p className="fav-empty">No active service alerts right now.</p>
      )}
      {!loading && alerts.length > 0 && (
        <ul className="more-alert-list">
          {alerts.map((a) => (
            <li key={a.id} className={`more-alert more-alert--${a.severity}`}>
              <strong>{a.title}</strong>
              {a.description && <p>{a.description}</p>}
              {a.affectedRoutes.length > 0 && (
                <p className="more-alert__routes">Lines: {a.affectedRoutes.join(', ')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
