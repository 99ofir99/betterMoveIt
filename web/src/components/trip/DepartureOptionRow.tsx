/** Shared Moovit-style departure row with arrival-accuracy colors (v5.125). */

import { useState, type ReactNode } from 'react';
import { formatClock12h } from '../../lib/format';
import {
  accuracyCaption,
  confidenceClass,
  formatDelayLabel,
  formatEtaLabel,
  formatSignalUpdated,
  isLiveConfidence,
  resolveConfidence,
  resolveSource,
  shouldShowRelativeEta,
} from '../../lib/arrivalAccuracy';
import { railTrainNumber, transitDestinationLabel } from '../../lib/railLabel';
import { RouteBadge } from '../common/RouteBadge';
import { LiveSignalIcon } from '../icons';
import type { DepartureGroup, DepartureNext } from '../../types';
import type { OptionRowProps } from './types';

function EtaPillContent({ next }: { next: DepartureNext | null | undefined }) {
  const minutes = next != null ? Math.max(0, next.minutes) : null;
  const confidence = resolveConfidence(next);
  const live = isLiveConfidence(confidence);
  const showRelative = minutes != null && shouldShowRelativeEta(minutes);
  const label =
    minutes == null ? '—' : formatEtaLabel(minutes, { departureSec: next?.departure });

  return (
    <>
      {live && confidence !== 'off_route' && (
        <LiveSignalIcon size={12} className="ld-signal-icon" />
      )}
      {confidence === 'off_route' && (
        <span className="ld-option__warn" aria-label="Off route">
          !
        </span>
      )}
      {minutes != null && showRelative && minutes > 0 && !label.includes(':') ? (
        <>
          <span className="ld-option__minutes">{minutes}</span>
          <span className="ld-option__unit">min</span>
        </>
      ) : (
        <span
          className={`ld-option__minutes${
            minutes != null && !showRelative ? ' ld-option__minutes--clock' : ''
          }`}
        >
          {label}
        </span>
      )}
    </>
  );
}

function LineInfo({
  group,
  confidence,
  source,
  delayLabel,
  updatedLabel,
  live,
  delayLate,
}: {
  group: DepartureGroup;
  confidence: ReturnType<typeof resolveConfidence>;
  source: ReturnType<typeof resolveSource>;
  delayLabel: string | null;
  updatedLabel: string | null;
  live: boolean;
  delayLate: boolean;
}) {
  const badgeLabel = railTrainNumber(group.route, group.headsign);
  const destination = transitDestinationLabel(group.route, group.headsign);

  return (
    <>
      <RouteBadge
        label={badgeLabel}
        typeName={group.route.typeName}
        color={group.route.color}
      />
      <div className="ld-option__info">
        <div className="ld-option__headline">
          {group.platform && <span>Platform: {group.platform}</span>}
          {group.platform && destination && (
            <span className="ld-option__dot" aria-hidden="true">
              •
            </span>
          )}
          {destination ? (
            <span className="ld-option__headsign" dir="auto">
              {destination}
            </span>
          ) : null}
        </div>
        <div className={`ld-option__acc-label ${confidenceClass(confidence)}`}>
          {accuracyCaption(confidence, source)}
        </div>
        {delayLabel && (
          <div className={`ld-option__delay${delayLate ? ' is-late' : ' is-early'}`}>
            {delayLabel}
          </div>
        )}
        {updatedLabel && live && <div className="ld-option__updated">{updatedLabel}</div>}
      </div>
    </>
  );
}

function NextArrivalChip({ next }: { next: DepartureNext }) {
  const confidence = resolveConfidence(next);
  const minutes = Math.max(0, next.minutes);
  return (
    <li className={`ld-acc-next ${confidenceClass(confidence)}`}>
      <span className="ld-acc-next__eta">
        {formatEtaLabel(minutes, { departureSec: next.departure })}
        {confidence === 'off_route' ? ' !' : ''}
      </span>
      <span className="ld-acc-next__caption">
        {accuracyCaption(confidence, resolveSource(next))}
      </span>
    </li>
  );
}

function HitWrap({
  selectable,
  onSelect,
  highlighted,
  label,
  children,
}: {
  selectable: boolean;
  onSelect?: () => void;
  highlighted?: boolean;
  label: string;
  children: ReactNode;
}) {
  if (selectable && onSelect) {
    return (
      <button
        type="button"
        className="ld-option__hit"
        onClick={onSelect}
        aria-pressed={highlighted === true}
        aria-label={`Select line ${label}`}
      >
        {children}
      </button>
    );
  }
  return (
    <div className="ld-option__hit" aria-label={`Line ${label}`}>
      {children}
    </div>
  );
}

export function DepartureOptionRow({ group, highlighted, onSelect }: OptionRowProps) {
  const [accuracyOpen, setAccuracyOpen] = useState(false);
  const first = group.next[0];
  const second = group.next[1];
  const confidence = resolveConfidence(first);
  const source = resolveSource(first);
  const live = isLiveConfidence(confidence);
  const minutes = first != null ? Math.max(0, first.minutes) : null;
  const showRelative = minutes != null && shouldShowRelativeEta(minutes);
  const delayLabel = formatDelayLabel(first?.delayMin);
  const updatedLabel = formatSignalUpdated(first);
  const selectable = onSelect != null;
  const className = [
    'ld-option',
    highlighted ? 'ld-option--highlight' : '',
    selectable ? 'ld-option--selectable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <div className="ld-option__main">
        <HitWrap
          selectable={selectable}
          onSelect={onSelect ? () => onSelect(group.route) : undefined}
          highlighted={highlighted}
          label={railTrainNumber(group.route, group.headsign)}
        >
          <LineInfo
            group={group}
            confidence={confidence}
            source={source}
            delayLabel={delayLabel}
            updatedLabel={updatedLabel}
            live={live}
            delayLate={Boolean(first?.delayMin && first.delayMin > 0)}
          />
        </HitWrap>

        <div className="ld-option__eta">
          {/* Moovit: tap the time to see accuracy for next arrivals of this line */}
          <button
            type="button"
            className={`ld-option__pill ld-option__pill--tappable ${confidenceClass(
              confidence
            )}${accuracyOpen ? ' is-expanded' : ''}`}
            onClick={() => setAccuracyOpen((v) => !v)}
            aria-expanded={accuracyOpen}
            aria-label="Show arrival accuracy for next arrivals"
          >
            <EtaPillContent next={first} />
          </button>
          {first != null && showRelative && (
            <div className="ld-option__times">
              {formatClock12h(first.departure)}
              {second != null && `, ${formatClock12h(second.departure)}`}
            </div>
          )}
          {first != null && !showRelative && second != null && (
            <div className="ld-option__times">{formatClock12h(second.departure)}</div>
          )}
        </div>
      </div>

      {accuracyOpen && (
        <div className="ld-acc-detail" role="region" aria-label="Arrival accuracy">
          <p className="ld-acc-detail__intro">
            Accuracy for the next arrivals of this line
          </p>
          <ul className="ld-acc-detail__list">
            {group.next.map((n, i) => (
              <NextArrivalChip key={`${n.tripId}-${n.departure}-${i}`} next={n} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
