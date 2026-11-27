/** Favourite line row — uses shared LineBadge. Visual only. */

import { LineBadge } from '../shared/LineBadge';
import { StarIcon } from '../shared/icons';
import { formatLineLongName, formatRailFinalCity } from '../../lib/lineCategory';
import { isHeavyRailRoute, railTrainNumber } from '../../lib/railLabel';
import { isLightRailRoute } from '../../lib/transportMode';
import type { LineRowProps } from './types';

function favLineMode(line: LineRowProps['item']['line']): 'bus' | 'rail' | 'tram' {
  if (isLightRailRoute(line)) return 'tram';
  const t = line.typeName.toLowerCase();
  if (t === 'bus' || t === 'trolleybus' || line.type === 3) return 'bus';
  return 'rail';
}

export function LineFavRow({ item, onOpen, onRemove }: LineRowProps) {
  const rail = isHeavyRailRoute(item.line);
  const name = rail ? railTrainNumber(item.line) : item.line.displayName || item.line.shortName;
  const subtitle = rail
    ? formatRailFinalCity(item.line.longName) || formatLineLongName(item.line.longName)
    : formatLineLongName(item.line.longName);

  return (
    <div className="fav-row fav-row--line">
      <button type="button" className="fav-row__main fav-row__main--line" onClick={onOpen}>
        <LineBadge label={name} mode={favLineMode(item.line)} />
        <span className="fav-row__body">
          <span className="fav-row__name" dir="auto">
            {subtitle || item.line.agency}
          </span>
          {item.stopName && <span className="fav-row__meta">{item.stopName}</span>}
        </span>
      </button>
      <button
        type="button"
        className="fav-row__star is-on"
        onClick={onRemove}
        aria-label="Remove favourite line"
      >
        <StarIcon size={20} filled />
      </button>
    </div>
  );
}
