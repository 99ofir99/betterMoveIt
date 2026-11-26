/** Moovit-style section header: dim title + optional Add action. */

import type { SectionHeaderProps } from './types';

export function SectionHeader({ title, actionLabel, onAction, actionAriaLabel }: SectionHeaderProps) {
  return (
    <div className="fav-section__header">
      <h2 className="fav-section__title">{title}</h2>
      {actionLabel && onAction && (
        <button
          type="button"
          className="fav-section__action"
          onClick={onAction}
          aria-label={actionAriaLabel ?? actionLabel}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
