/** Sub-panel header with back chevron. Visual only. */

import { BackIcon } from '../shared/icons';
import { t } from '../../lib/i18n';

export function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="more-panel__header">
      <button type="button" className="more-panel__back" onClick={onBack} aria-label={t("Back")}>
        <BackIcon size={22} />
      </button>
      <h1 className="more-panel__title">{title}</h1>
    </header>
  );
}
