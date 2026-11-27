/** "Wait for one of these options" card — collapsed board + arrivals modal. */

import { useState } from 'react';
import { sameCorridorRoute } from '../../lib/corridorLine';
import { DepartureOptionRow } from './DepartureOptionRow';
import { LegEndpoints } from './LegEndpoints';
import { ShowMoreOptionsLink } from './ShowMoreOptionsLink';
import { UpcomingArrivalsModal } from './UpcomingArrivalsModal';
import { visibleWaitOptions, waitOptionsHiddenCount } from './waitOptionsCollapse';
import type { WaitOptionsCardProps } from './types';
import { t } from '../../lib/i18n';

function waitCountdownLabel(sec: number | undefined): string {
  if (sec == null) return '';
  if (sec <= 0) return t('now');
  const m = Math.max(0, Math.round(sec / 60));
  if (m === 0) return t('<1 min');
  return t('{n} min', { n: m });
}

export function WaitOptionsCard({
  options,
  waitForLabel,
  countdownSec,
  fromName,
  toName,
  onSwitch,
  selectedRoute,
  onSelectRoute,
}: WaitOptionsCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const timeLabel = waitCountdownLabel(countdownSec);
  const visible = visibleWaitOptions(options, false);
  const hiddenCount = waitOptionsHiddenCount(options.length);

  return (
    <>
      <div className="ld-wait">
        <div className="ld-ride__strip" data-sheet-drag>
          <span>{t('Wait for {line}', { line: waitForLabel })}</span>
          {timeLabel ? <span className="ld-ride__strip-time">{timeLabel}</span> : null}
        </div>
        {fromName && toName ? (
          <div className="ld-wait__endpoints">
            <LegEndpoints from={fromName} to={toName} onSwitch={onSwitch} />
          </div>
        ) : null}
        <div className="ld-wait__title">{t("Wait for one of these options")}</div>
        {options.length > 0 ? (
          <>
            {visible.map((g, i) => {
              const highlighted = selectedRoute
                ? sameCorridorRoute(g.route, selectedRoute)
                : i === 0;
              return (
                <DepartureOptionRow
                  key={`${g.route.index}-${g.headsign}-${i}`}
                  group={g}
                  highlighted={highlighted}
                  onSelect={onSelectRoute}
                />
              );
            })}
            <ShowMoreOptionsLink
              hiddenCount={hiddenCount}
              onOpen={() => setModalOpen(true)}
            />
          </>
        ) : (
          <div className="ld-wait__loading">{t("Loading departures…")}</div>
        )}
      </div>

      <UpcomingArrivalsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        options={options}
        stopName={fromName}
        fromName={fromName}
        toName={toName}
        onSwitch={onSwitch}
        selectedRoute={selectedRoute}
        onSelectRoute={
          onSelectRoute
            ? (route) => {
                onSelectRoute(route);
                setModalOpen(false);
              }
            : undefined
        }
      />
    </>
  );
}
