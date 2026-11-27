/**
 * Visual — Moovit-colored leave minutes for a transit line in the trip preview.
 * Logic comes from useTransitLegEta.
 */

import {
  accuracyCaption,
  confidenceClass,
  formatEtaLabel,
  isLiveConfidence,
} from '../../lib/arrivalAccuracy';
import { LiveSignalIcon } from '../icons';
import type { TransitLegEtaBadgeProps } from './types';
import { t } from '../../lib/i18n';

export function TransitLegEtaBadge({ eta }: TransitLegEtaBadgeProps) {
  const confidence = eta.confidence ?? (eta.live ? 'high' : 'none');
  const source = eta.source ?? (eta.live ? 'live' : 'schedule');
  const live = isLiveConfidence(confidence);
  const label = formatEtaLabel(eta.minutes, {
    departureSec: eta.departure,
    nextDay: eta.nextDay,
  });

  return (
    <div
      className={`itin__eta ${confidenceClass(confidence)}`}
      title={accuracyCaption(confidence, source)}
      aria-label={accuracyCaption(confidence, source)}
    >
      <div className={`itin__eta-pill ${confidenceClass(confidence)}`}>
        {live && confidence !== 'off_route' && (
          <LiveSignalIcon size={11} className="itin__eta-signal" />
        )}
        {confidence === 'off_route' && (
          <span className="itin__eta-warn" aria-label={t("Off route")}>
            !
          </span>
        )}
        <span className="itin__eta-value">{label}</span>
      </div>
    </div>
  );
}
