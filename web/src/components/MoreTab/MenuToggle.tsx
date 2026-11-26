/** Menu row with On/Off pill — Moovit live-buses style. Visual only. */

import type { MenuToggleProps } from './types';

export function MenuToggle({ icon, label, checked, onChange }: MenuToggleProps) {
  return (
    <button
      type="button"
      className="more-menu-row"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="more-menu-row__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="more-menu-row__label">{label}</span>
      <span className={`more-toggle-pill${checked ? ' is-on' : ''}`}>{checked ? 'On' : 'Off'}</span>
    </button>
  );
}
