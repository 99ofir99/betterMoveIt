/**
 * "What line are you on?" sheet.
 * Rendered as an overlay inside .ld-shell when the user taps "Change" in
 * TransitRideCard. Visually matches Moovit's line-picker bottom sheet.
 */
import { RouteBadge } from '../common/RouteBadge';
import { Icon } from '../icons/Icon';
import type { RouteInfo } from '../../types';

export interface LinePickerProps {
  alternatives: RouteInfo[];
  onPick: (route: RouteInfo) => void;
  onClose: () => void;
}

export function LinePicker({ alternatives, onPick, onClose }: LinePickerProps) {
  if (alternatives.length === 0) return null;

  return (
    /* Backdrop — tap outside to dismiss */
    <div
      className="ld-line-picker-backdrop"
      role="presentation"
      onClick={onClose}
    >
      {/* Sheet — stop propagation so inner taps don't close */}
      <div
        className="ld-line-picker"
        role="dialog"
        aria-modal="true"
        aria-label="Choose your line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ld-line-picker__header">
          <span className="ld-line-picker__title">What line are you on?</span>
          <button
            type="button"
            className="ld-line-picker__close"
            aria-label="Close line picker"
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <ul className="ld-line-picker__list" role="listbox" aria-label="Available lines">
          {alternatives.map((route) => (
            <li
              key={`${route.index}-${route.shortName}`}
              role="option"
              aria-selected={false}
            >
              <button
                type="button"
                className="ld-line-picker__row"
                onClick={() => onPick(route)}
              >
                <RouteBadge
                  label={route.displayName}
                  typeName={route.typeName}
                  color={route.color}
                />
                <span className="ld-line-picker__route-name">{route.longName}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
