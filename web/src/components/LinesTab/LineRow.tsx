import { formatLineLongName } from '../../lib/lineCategory';
import { isLightRailRoute } from '../../lib/transportMode';
import { LineBadge } from '../shared/LineBadge';
import type { LineRowProps } from './types';

function lineBadgeMode(line: LineRowProps['line']): 'bus' | 'rail' | 'tram' {
  if (isLightRailRoute(line)) return 'tram';
  const t = line.typeName.toLowerCase();
  if (t === 'bus' || t === 'trolleybus' || line.type === 3) return 'bus';
  return 'rail';
}

export function LineRow({ line, onOpen, showDivider = true }: LineRowProps) {
  const name = line.displayName || line.shortName;

  return (
    <div className={`line-row ${showDivider ? 'line-row--divided' : ''}`}>
      <button type="button" className="line-row__btn" onClick={() => onOpen(line)}>
        <LineBadge label={name} mode={lineBadgeMode(line)} />
        <span className="line-row__name" dir="auto">
          {formatLineLongName(line.longName)}
        </span>
      </button>
    </div>
  );
}
