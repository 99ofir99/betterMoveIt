/** Settings sub-panel. Visual + form controls. */

import { PanelHeader } from './PanelHeader';
import type { SettingsPanelProps } from './types';

export function SettingsPanel({ settings, onPatch, onBack }: SettingsPanelProps) {
  return (
    <div className="more-panel">
      <PanelHeader title="Settings" onBack={onBack} />

      <label className="more-setting">
        <span className="more-setting__text">
          <span className="more-setting__label">Wheelchair accessible</span>
          <span className="more-setting__hint">Prefer accessible routes</span>
        </span>
        <input
          type="checkbox"
          checked={settings.wheelchair}
          onChange={(e) => onPatch('wheelchair', e.target.checked)}
        />
      </label>

      <div className="more-setting more-setting--stack">
        <div className="more-setting__text">
          <span className="more-setting__label">Max walking</span>
          <span className="more-setting__hint">{settings.maxWalkM} m</span>
        </div>
        <input
          type="range"
          min={300}
          max={3000}
          step={100}
          value={settings.maxWalkM}
          onChange={(e) => onPatch('maxWalkM', Number(e.target.value))}
          aria-label="Maximum walking distance"
          className="more-setting__range"
        />
      </div>

      <label className="more-setting">
        <span className="more-setting__text">
          <span className="more-setting__label">Language</span>
        </span>
        <select
          value={settings.locale}
          onChange={(e) => onPatch('locale', e.target.value as 'en' | 'he')}
          aria-label="Language"
          className="more-setting__select"
        >
          <option value="en">English</option>
          <option value="he">עברית</option>
        </select>
      </label>
    </div>
  );
}
