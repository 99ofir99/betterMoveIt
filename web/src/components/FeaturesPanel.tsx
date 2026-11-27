/**
 * Feature overview - Core transit functionality.
 *
 * Shows what's working now and what's coming next. No AI features,
 * no unnecessary extras - just solid transit tracking and planning.
 */

import { ALL_FEATURES, type FeatureStatus } from '../lib/features';
import { Icon } from './icons/Icon';
import { t } from '../lib/i18n';

export function FeaturesPanel({ onClose }: { onClose: () => void }) {
  const grouped = new Map<string, typeof ALL_FEATURES>();
  for (const f of ALL_FEATURES) {
    const list = grouped.get(f.group) ?? [];
    list.push(f);
    grouped.set(f.group, list);
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t("Features")}>
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__card">
        <div className="modal__head">
          <div>
            <h2>{t("Core Features")}</h2>
            <p className="muted">
              {t("Essential transit tools. No ads, no AI, no subscriptions.")}
            </p>
          </div>
          <button
            type="button"
            className="icon-button icon-button--ghost"
            onClick={onClose}
            aria-label={t("Close")}
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="modal__body">
          {[...grouped.entries()].map(([group, items]) => (
            <section key={group} className="feature-group">
              <h3>{group}</h3>
              <ul>
                {items.map((f) => (
                  <li key={f.id} className="feature">
                    <span className={`feature__dot feature__dot--${f.status}`} aria-hidden="true" />
                    <div>
                      <div className="feature__name">{f.name}</div>
                      <div className="feature__desc">{f.description}</div>
                    </div>
                    <span className={`feature__badge feature__badge--${f.status}`}>{statusLabel(f.status)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function statusLabel(s: FeatureStatus): string {
  switch (s) {
    case 'live':
      return t('Live');
    case 'partial':
      return t('Partial');
    default:
      return t('Planned');
  }
}
