/**
 * Logic for the Lines tab: search, category / favourites filtering, recents.
 * The visual components receive everything via the returned values.
 */

import { useCallback, useMemo, useState } from 'react';
import type { Line } from '../../types';
import { useSuggestedLines } from '../../lib/useSuggestedLines';
import { t } from '../../lib/i18n';
import { loadFavorites, toggleFavoriteLine } from '../../lib/favorites';
import { useLinesSearch } from '../../lib/useLinesSearch';
import {
  clearRecentLines,
  loadRecentLines,
  recordRecentLine,
  removeRecentLine,
} from '../../lib/linesRecent';
import { lineMatchesCategory } from '../../lib/lineCategory';
import { dedupeLines } from '../../lib/dedupeSearch';
import type { LineCategoryFilter, LinesTabId, LinesTabOption, LinesTabProps } from './types';

export interface LinesSection {
  key: string;
  title: string;
  lines: Line[];
}

export const LINES_TABS: LinesTabOption[] = [
  { id: 'favourites', label: 'Favourites' },
  { id: 'all', label: 'All' },
  { id: 'bus', label: 'Bus' },
  { id: 'light-rail', label: 'Light rail' },
];

function matchesQuery(line: Line, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [line.shortName, line.displayName, line.longName]
    .filter(Boolean)
    .some((s) => s.toLowerCase().includes(needle));
}

export function useLinesTab({ onOpenLine, near, nearIsLive, destination }: LinesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<LinesTabId>('all');
  const [favTick, setFavTick] = useState(0);
  const [recentTick, setRecentTick] = useState(0);

  const isFavouritesTab = tab === 'favourites';
  const category: LineCategoryFilter = isFavouritesTab ? 'all' : tab;
  const query = searchQuery.trim();

  const { lines, loading, error, isPopular } = useLinesSearch(isFavouritesTab ? '' : searchQuery);

  const recent = useMemo(() => loadRecentLines(), [recentTick, searchQuery]);

  const favouriteLines = useMemo(
    () => loadFavorites().lines.map((f) => f.line).filter((l) => matchesQuery(l, query)),
    [favTick, query]
  );

  const filteredLines = useMemo(
    () => dedupeLines(lines.filter((l) => lineMatchesCategory(l, category))),
    [lines, category]
  );
  const filteredRecent = useMemo(
    () => dedupeLines(recent.filter((l) => lineMatchesCategory(l, category))),
    [recent, category]
  );

  const suggested = useSuggestedLines(near ?? null, destination?.journey, favTick + recentTick);

  /**
   * Empty-query sections, most specific first. A line shows once: in Recent,
   * or else in the first section that has it.
   */
  const sections = useMemo<LinesSection[]>(() => {
    const used = new Set(filteredRecent.map((l) => l.id));
    const take = (list: Line[]) =>
      dedupeLines(list.filter((l) => lineMatchesCategory(l, category) && !used.has(l.id))).filter(
        (l) => {
          used.add(l.id);
          return true;
        },
      );
    const place = destination?.label ? t(destination.label) : '';
    const out: LinesSection[] = [
      {
        key: 'toward',
        title: destination?.label === 'Home' ? t('Toward home') : t('Toward {place}', { place }),
        lines: place ? take(suggested.toward) : [] },
      { key: 'personal', title: t('For you'), lines: take(suggested.personal) },
      {
        key: 'nearby',
        title: nearIsLive ? t('Near you') : t('In this area'),
        lines: take(suggested.nearby),
      },
    ];
    return out.filter((s) => s.lines.length > 0);
  }, [suggested, filteredRecent, category, destination?.label, nearIsLive]);

  const favouriteIds = useMemo(
    () => new Set(loadFavorites().lines.map((f) => f.id)),
    [favTick]
  );

  const openLine = useCallback(
    (line: Line) => {
      recordRecentLine(line);
      setRecentTick((t) => t + 1);
      onOpenLine(line);
    },
    [onOpenLine]
  );

  const toggleFavourite = useCallback(
    (line: Line) => {
      // Only toggle the star; opening the line is the row's job.
      toggleFavoriteLine(line);
      setFavTick((t) => t + 1);
    },
    [],
  );

  const clearRecent = useCallback(() => {
    clearRecentLines();
    setRecentTick((t) => t + 1);
  }, []);

  const removeRecent = useCallback((line: Line) => {
    removeRecentLine(line.id);
    setRecentTick((t) => t + 1);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    tab,
    setTab,
    isFavouritesTab,
    query,
    loading,
    error,
    isPopular,
    sections,
    suggestLoading: suggested.nearbyLoading,
    filteredLines,
    filteredRecent,
    favouriteLines,
    favouriteIds,
    showRecent: !isFavouritesTab && !query && filteredRecent.length > 0,
    openLine,
    toggleFavourite,
    clearRecent,
    removeRecent,
  };
}
