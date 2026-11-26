/**
 * Recently opened lines (Lines tab), persisted in localStorage.
 */

import type { Line } from '../types';

const KEY = 'bmi.lines.recent.v1';
const MAX = 24;

export function loadRecentLines(): Line[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Line[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearRecentLines(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

export function removeRecentLine(lineId: string): Line[] {
  const next = loadRecentLines().filter((l) => l.id !== lineId);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
}

export function recordRecentLine(line: Line): void {
  const prev = loadRecentLines().filter((l) => l.id !== line.id);
  const next = [line, ...prev].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
}