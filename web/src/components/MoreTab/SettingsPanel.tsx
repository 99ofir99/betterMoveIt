/** Settings sub-panel. Visual + form controls. */

import { PanelHeader } from './PanelHeader';
import type { SettingsPanelProps } from './types';
import { t } from '../../lib/i18n';

export function SettingsPanel({ settings, onPatch, onBack }: SettingsPanelProps) {
  return (
    <div className="more-panel">
      <PanelHeader title={t("Settings")} onBack={onBack} />

      <label className="more-setting">
        <span className="more-setting__text">
          <span className="more-setting__label">{t("Wheelchair accessible")}</span>
          <span className="more-setting__hint">{t("Prefer accessible routes")}</span>
        </span>
        <input
          type="checkbox"
          checked={settings.wheelchair}
          onChange={(e) => onPatch('wheelchair', e.target.checked)}
        />
      </label>

      <div className="more-setting more-setting--stack">
        <div className="more-setting__text">
          <span className="more-setting__label">{t("Max walking")}</span>
          <span className="more-setting__hint">{t('{n} m', { n: settings.maxWalkM })}</span>
        </div>
        <input
          type="range"
          min={300}
          max={3000}
          step={100}
          value={settings.maxWalkM}
          onChange={(e) => onPatch('maxWalkM', Number(e.target.value))}
          aria-label={t("Maximum walking distance")}
          className="more-setting__range"
        />
      </div>

      <label className="more-setting">
        <span className="more-setting__text">
          <span className="more-setting__label">{t("Language")}</span>
        </span>
        <select
          value={settings.locale}
          onChange={(e) => onPatch('locale', e.target.value as 'en' | 'he')}
          aria-label={t("Language")}
          className="more-setting__select"
        >
          <option value="en">{t("English")}</option>
          <option value="he">עברית</option>
        </select>
      </label>
    </div>
  );
}
