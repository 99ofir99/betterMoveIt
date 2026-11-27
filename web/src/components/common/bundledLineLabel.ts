/** Format clamped corridor lines as Moovit `37 / 66 / 51 / 50 / 1`. */

import { isHeavyRailRoute, railTrainNumber } from '../../lib/railLabel';

export interface LineLabelSource {
  shortName?: string;
  displayName?: string;
  type?: number;
  typeName?: string;
  longName?: string;
}

export function lineLabel(route: LineLabelSource): string {
  if (
    route.type != null &&
    route.typeName &&
    isHeavyRailRoute({ type: route.type, typeName: route.typeName })
  ) {
    return railTrainNumber({
      type: route.type,
      typeName: route.typeName,
      shortName: route.shortName || '',
      displayName: route.displayName || '',
      longName: route.longName || '',
    });
  }
  return (route.displayName || route.shortName || '').trim();
}

/**
 * Join every line with ` / `. Overflow is clipped by CSS at the card edge
 * (Moovit), not by slicing the list here.
 */
export function formatBundledLineLabel(routes: readonly LineLabelSource[]): string {
  return routes.map(lineLabel).filter(Boolean).join(' / ');
}
