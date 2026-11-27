/**
 * What the results sheet says when there is nothing to list: same start and end,
 * no stops nearby, no service at that hour (night / Shabbat), offline, or a failed
 * request. Replaces a single grey "No route found" line or a raw fetch error.
 */

import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/types';
import { t } from '../../lib/i18n';

interface ResultsEmptyStateProps {
  /** `plan.reason` from the planner (same_place, no_stops_nearby, no_service_soon, …). */
  reason?: string;
  /** `plan.error`: 'offline' | 'failed', or an already-worded message (location errors). */
  error?: string | null;
  /** Planned for a chosen time (not "now"). */
  timed?: boolean;
  onRetry?: () => void;
  onChangeTime?: () => void;
  onChangeDestination?: () => void;
}

interface EmptyCopy {
  icon: IconName;
  title: string;
  hint?: string;
  action?: { label: string; run?: () => void };
}

function copyFor(p: ResultsEmptyStateProps): EmptyCopy {
  if (p.error === 'offline') {
    return {
      icon: 'search',
      title: t("You're offline"),
      hint: t('Check your internet connection and try again.'),
      action: { label: t('Try again'), run: p.onRetry },
    };
  }
  if (p.error === 'failed') {
    return {
      icon: 'search',
      title: t("Couldn't load routes"),
      hint: t('Something went wrong on our side. Try again in a moment.'),
      action: { label: t('Try again'), run: p.onRetry },
    };
  }
  if (p.error) return { icon: 'my-location', title: p.error };
  if (p.reason === 'same_place') {
    return {
      icon: 'place',
      title: t("You're already there"),
      hint: t('The start and the destination are the same place.'),
      action: { label: t('Change destination'), run: p.onChangeDestination },
    };
  }
  if (p.reason === 'no_stops_nearby') {
    return {
      icon: 'walk',
      title: t('No public transport nearby'),
      hint: t('There are no stops within walking distance of the start or the destination.'),
    };
  }
  return {
    icon: 'history',
    title: t('No route found'),
    hint: p.timed
      ? t('There may be no service at that time (night or Shabbat). Try another departure time.')
      : t('No service in the next day (night or Shabbat). Try a later departure time.'),
    action: { label: t('Choose departure time'), run: p.onChangeTime },
  };
}

export function ResultsEmptyState(props: ResultsEmptyStateProps) {
  const c = copyFor(props);
  return (
    <div className="results-empty" role="status">
      <span className="results-empty__icon" aria-hidden="true">
        <Icon name={c.icon} size={26} />
      </span>
      <p className="results-empty__title">{c.title}</p>
      {c.hint ? <p className="results-empty__hint">{c.hint}</p> : null}
      {c.action?.run ? (
        <button type="button" className="results-empty__action" onClick={c.action.run}>
          {c.action.label}
        </button>
      ) : null}
    </div>
  );
}
