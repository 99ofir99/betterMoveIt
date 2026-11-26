/** Moovit drawer-style menu row. Visual only. */

import { ChevronRightIcon } from '../shared/icons';
import type { MenuItemProps } from './types';

export function MenuItem({ icon, label, onClick, accessory, destructive }: MenuItemProps) {
  return (
    <button
      type="button"
      className={`more-menu-row${destructive ? ' more-menu-row--danger' : ''}`}
      onClick={onClick}
    >
      <span className="more-menu-row__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="more-menu-row__label">{label}</span>
      {accessory ?? <ChevronRightIcon size={16} className="more-menu-row__chevron" />}
    </button>
  );
}
