/**
 * Hook for the Lines tab.
 * Returns search results when the user types, or a "popular lines" list when
 * the query is empty (populated by a few short parallel searches on mount).
 */

import { useEffect, useState } from 'react';
import { api } from './api';
import type { Line } from '../types';
import { dedupeLines } from './dedupeSearch';

export interface UseLinesSearchResult {
  lines: Line[];
  loading: boolean;
  error: string | null;
  /** True when showing the automatic popular-lines list (empty query). */
  isPopular: boolean;
}

export type { LineCategoryFilter } from '../components/LinesTab/types';
export { lineMatchesCategory } from './lineCategory';

/** Short seed queries that together cover the most common Israeli bus numbers. */
const POPULAR_SEEDS = ['1', '2', '3', '4', '5'];

export function useLinesSearch(query: string): UseLinesSearchResult {
  const [lines, setLines] = useState<Line[]>([]);
  const [popularLines, setPopularLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch popular lines once on mount.
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all(POPULAR_SEEDS.map((seed) => api.searchLines(seed, ctrl.signal).catch(() => [])))
      .then((results) => {
        if (!ctrl.signal.aborted) {
          setPopularLines(dedupeLines(results.flat()).slice(0, 24));
        }
      })
      .catch(() => {/* ignore */});
    return () => ctrl.abort();
  }, []);

  // Debounced search when the query changes.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setLines([]);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      api
        .searchLines(q, ctrl.signal)
        .then((results) => {
          if (!ctrl.signal.aborted) setLines(dedupeLines(results));
        })
        .catch((e: Error) => {
          if (ctrl.signal.aborted || e.name === 'AbortError') return;
          setError(String(e.message ?? e));
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  if (!query.trim()) {
    return { lines: popularLines, loading: false, error: null, isPopular: true };
  }

  return { lines, loading, error, isPopular: false };
}
