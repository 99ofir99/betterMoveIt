/** About sub-panel. Visual only. */

import { PanelHeader } from './PanelHeader';
import type { AboutPanelProps } from './types';
import { t } from '../../lib/i18n';

export function AboutPanel({ onBack }: AboutPanelProps) {
  return (
    <div className="more-panel">
      <PanelHeader title={t("About")} onBack={onBack} />
      <div className="more-about">
        <p className="more-about__title">{t("betterMoveIt")}</p>
        <p className="more-about__body">
          {t("A free, ad-free transit companion for Israel — live buses, directions, and favourites. Open source. No tracking.")}
        </p>
      </div>
    </div>
  );
}
