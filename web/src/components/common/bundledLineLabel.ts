/** Format clamped corridor lines as Moovit `37 / 66 / 51 / 50 / 1`. */

export interface LineLabelSource {
  shortName?: string;
  displayName?: string;
}

export function lineLabel(route: LineLabelSource): string {
  return (route.displayName || route.shortName || '').trim();
}

/**
 * Join every line with ` / `. Overflow is clipped by CSS at the card edge
 * (Moovit), not by slicing the list here.
 */
export function formatBundledLineLabel(routes: readonly LineLabelSource[]): string {
  return routes.map(lineLabel).filter(Boolean).join(' / ');
}
