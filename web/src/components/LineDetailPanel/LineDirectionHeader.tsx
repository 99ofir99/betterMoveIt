/** Moovit direction strip: title + blue "Change direction". */

import type { LineDirectionHeaderProps } from './types';
import { t } from '../../lib/i18n';

export function LineDirectionHeader({
  label,
  canChange,
  onChangeDirection,
}: LineDirectionHeaderProps) {
  return (
    <button
      type="button"
      className="lnd-dir"
      onClick={onChangeDirection}
      disabled={!canChange}
      aria-label={canChange ? t('Direction: {name}. Double tap to change direction', { name: label }) : label}
    >
      <span className="lnd-dir__text">
        <span className="lnd-dir__label" dir="auto">
          {label}
        </span>
        {canChange && <span className="lnd-dir__change">{t("Change direction")}</span>}
      </span>
    </button>
  );
}
