/**
 * Lines tab — Moovit-style: search bar, category tabs, recent + results.
 * Visual composition only; state lives in useLinesTab.
 */

import type { Line } from '../types';
import { LineRow } from './LinesTab/LineRow';
import { LineFavButton } from './LinesTab/LineFavButton';
import { LineRecentRemoveButton } from './LinesTab/LineRecentRemoveButton';
import { LinesSearchBar } from './LinesTab/LinesSearchBar';
import { LinesCategoryTabs } from './LinesTab/LinesCategoryTabs';
import { RecentHeader } from './LinesTab/RecentHeader';
import { LINES_TABS, useLinesTab } from './LinesTab/useLinesTab';
import type { LinesTabProps } from './LinesTab/types';
import { t } from '../lib/i18n';

interface LineListProps {
  lines: Line[];
  favouriteIds: Set<string>;
  onOpen: (line: Line) => void;
  onToggleFavourite: (line: Line) => void;
  /** When set, shows a small × next to the star (Recent section). */
  onRemoveRecent?: (line: Line) => void;
}

function LineList({
  lines,
  favouriteIds,
  onOpen,
  onToggleFavourite,
  onRemoveRecent,
}: LineListProps) {
  return (
    <div className="lines-list lines-list--moovit">
      {lines.map((line, idx) => (
        <div key={line.id} className="line-item-row line-item-row--moovit">
          <LineRow line={line} onOpen={onOpen} showDivider={idx < lines.length - 1} />
          <LineFavButton
            favored={favouriteIds.has(line.id)}
            onToggle={() => onToggleFavourite(line)}
          />
          {onRemoveRecent && (
            <LineRecentRemoveButton
              lineName={line.displayName || line.shortName || 'line'}
              onRemove={() => onRemoveRecent(line)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function LinesTab({ onOpenLine }: LinesTabProps) {
  const s = useLinesTab(onOpenLine);

  const searching = s.query.length > 0;
  const mainLines = s.isFavouritesTab ? s.favouriteLines : s.filteredLines;
  const noResults = !s.loading && mainLines.length === 0 && !s.error;

  return (
    <div className="lines-tab">
      <div className="lines-header">
        <LinesSearchBar value={s.searchQuery} onChange={s.setSearchQuery} />
        <LinesCategoryTabs tabs={LINES_TABS} active={s.tab} onSelect={s.setTab} />
      </div>

      <div className="lines-content">
        {s.error && <p className="error-text lines-error">{s.error}</p>}

        {searching && s.loading && !s.isFavouritesTab && (
          <div className="lines-empty">
            <p className="lines-empty__text">{t("Searching…")}</p>
          </div>
        )}

        {s.isFavouritesTab && noResults && (
          <div className="lines-empty">
            <p className="lines-empty__text">
              {searching ? t('No favourite lines match') : t('No favourite lines yet — tap the star on a line to save it')}
            </p>
          </div>
        )}

        {!s.isFavouritesTab && searching && noResults && (
          <div className="lines-empty">
            <p className="lines-empty__text">{t("No lines found")}</p>
          </div>
        )}

        {s.showRecent && (
          <section className="lines-recent" aria-label={t("Recent lines")}>
            <RecentHeader onClear={s.clearRecent} />
            <LineList
              lines={s.filteredRecent}
              favouriteIds={s.favouriteIds}
              onOpen={s.openLine}
              onToggleFavourite={s.toggleFavourite}
              onRemoveRecent={s.removeRecent}
            />
          </section>
        )}

        {mainLines.length > 0 && (
          <>
            {s.isFavouritesTab && <p className="lines-section-label">{t("Favourites")}</p>}
            {!s.isFavouritesTab && s.isPopular && !searching && (
              <p className="lines-section-label">{t("Popular lines")}</p>
            )}
            {!s.isFavouritesTab && searching && <p className="lines-section-label">{t("Results")}</p>}
            <LineList
              lines={mainLines}
              favouriteIds={s.favouriteIds}
              onOpen={s.openLine}
              onToggleFavourite={s.toggleFavourite}
            />
          </>
        )}
      </div>
    </div>
  );
}
