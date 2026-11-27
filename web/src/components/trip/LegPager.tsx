/** Step dots with prev/next chevrons (Moovit Live Directions pager). */

import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import type { JourneyStage } from './journeyStages';
import type { LegPagerProps } from './types';
import { t } from '../../lib/i18n';

function stageLabel(stage: JourneyStage | undefined, fallbackIndex: number): string {
  if (!stage) return t('Step {n}', { n: fallbackIndex + 1 });
  if (stage.kind === 'walk') return t('walk');
  if (stage.kind === 'wait') return t('wait for bus');
  return t('ride');
}

export function LegPager({
  stages,
  legs,
  viewIndex,
  activeIndex,
  done,
  onSelect,
  onPrev,
  onNext,
}: LegPagerProps) {
  const count = stages?.length ?? legs?.length ?? 0;
  if (count === 0) return null;

  const canPrev = viewIndex > 0;
  const canNext = viewIndex < count - 1;

  return (
    <div className="ld-pager" role="group" aria-label={t("Journey steps")}>
      <button
        type="button"
        className={['ld-pager__chev', !canPrev ? 'ld-pager__chev--hidden' : ''].filter(Boolean).join(' ')}
        onClick={onPrev}
        disabled={!canPrev}
        aria-label={t("Previous step")}
        aria-hidden={!canPrev}
        tabIndex={canPrev ? 0 : -1}
      >
        <ChevronLeftIcon size={22} />
      </button>

      <div className="ld-pager__dots">
        {Array.from({ length: count }, (_, i) => {
          const stage = stages?.[i];
          const isViewed = i === viewIndex;
          const isPast = i < activeIndex || done;
          return (
            <button
              key={i}
              type="button"
              className={[
                'ld-pager__dot',
                isViewed ? 'is-viewed' : '',
                i === activeIndex && !done ? 'is-active' : '',
                isPast ? 'is-past' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelect(i)}
              aria-label={t('Step {n} of {count}: {label}', { n: i + 1, count, label: stageLabel(stage, i) })}
              aria-current={isViewed ? 'step' : undefined}
            />
          );
        })}
      </div>

      <button
        type="button"
        className={['ld-pager__chev', !canNext ? 'ld-pager__chev--hidden' : ''].filter(Boolean).join(' ')}
        onClick={onNext}
        disabled={!canNext}
        aria-label={t("Next step")}
        aria-hidden={!canNext}
        tabIndex={canNext ? 0 : -1}
      >
        <ChevronRightIcon size={22} />
      </button>
    </div>
  );
}
