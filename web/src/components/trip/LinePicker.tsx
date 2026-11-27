/**
 * "What line are you on?" sheet.
 * Rendered as an overlay inside .ld-shell when the user taps "Change" in
 * TransitRideCard. Visually matches Moovit's line-picker bottom sheet.
 */
import { formatRailFinalCity } from '../../lib/lineCategory';
import { isHeavyRailRoute, railTrainNumber } from '../../lib/railLabel';
import { RouteBadge } from '../common/RouteBadge';
import { Icon } from '../icons/Icon';
import type { RouteInfo } from '../../types';
import { t } from '../../lib/i18n';

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
        aria-label={t("Choose your line")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ld-line-picker__header">
          <span className="ld-line-picker__title">{t("What line are you on?")}</span>
          <button
            type="button"
            className="ld-line-picker__close"
            aria-label={t("Close line picker")}
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <ul className="ld-line-picker__list" role="listbox" aria-label={t("Available lines")}>
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
                  label={railTrainNumber(route)}
                  typeName={route.typeName}
                  color={route.color}
                />
                <span className="ld-line-picker__route-name">
                  {isHeavyRailRoute(route)
                    ? formatRailFinalCity(route.longName) || route.longName
                    : route.longName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
