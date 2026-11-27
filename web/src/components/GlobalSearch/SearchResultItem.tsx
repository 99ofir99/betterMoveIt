/** One search hit row — locations always show an empty/filled star. Visual only. */

import { Icon } from '../icons/Icon';
import { TransitModeIcon } from '../icons';
import type { Line, Place, SearchResult, Stop } from '../../types';
import { contrastText, routeColor } from '../../lib/format';
import { formatRailFinalCity } from '../../lib/lineCategory';
import { isHeavyRailRoute, railTrainNumber } from '../../lib/railLabel';
import { SearchFavButton } from './SearchFavButton';
import { t } from '../../lib/i18n';

interface SearchResultItemProps {
  result: SearchResult;
  index: number;
  placeFavored: boolean;
  stopFavored: boolean;
  lineFavored: boolean;
  onPickLine: (line: Line) => void;
  onPickPlace: (place: Place) => void;
  onPickStop: (stop: Stop) => void;
  onTogglePlace: (place: Place) => void;
  onToggleStop: (stop: Stop) => void;
  onToggleLine: (line: Line) => void;
}

export function SearchResultItem({
  result: r,
  index: i,
  placeFavored,
  stopFavored,
  lineFavored,
  onPickLine,
  onPickPlace,
  onPickStop,
  onTogglePlace,
  onToggleStop,
  onToggleLine,
}: SearchResultItemProps) {
  if (r.kind === 'line') {
    const bg = routeColor(r.color, r.typeName || 'bus');
    const line: Line = {
      id: String(r.id ?? r.index ?? i),
      index: r.index ?? Number(r.id) ?? 0,
      shortName: r.shortName || r.displayName || '',
      longName: r.longName || '',
      displayName: r.displayName || r.shortName || '',
      type: r.type ?? 3,
      typeName: r.typeName || 'bus',
      color: r.color,
      agency: r.agency,
    };
    const isTram =
      (line.typeName || '').toLowerCase() === 'tram' ||
      (line.typeName || '').toLowerCase() === 'subway' ||
      line.type === 0 ||
      line.type === 1;
    const rail = isHeavyRailRoute(line);
    const badgeLabel = rail ? railTrainNumber(line) : line.displayName;
    const subtitle = rail
      ? formatRailFinalCity(line.longName) || line.longName || t('Line')
      : line.longName || t('Line');
    return (
      <li className="search-result-row">
        <button type="button" className="suggestions__row" onClick={() => onPickLine(line)}>
          <span
            className={[
              'suggestions__line-badge',
              isTram ? 'suggestions__line-badge--tram' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ background: bg, color: contrastText(bg) }}
          >
            {isTram ? null : <TransitModeIcon typeName={line.typeName || 'bus'} size={14} />} {badgeLabel}
          </span>
          <span className="suggestions__text">
            <span className="suggestions__name">{subtitle}</span>
          </span>
        </button>
        <SearchFavButton
          favored={lineFavored}
          label={badgeLabel || 'line'}
          onToggle={() => onToggleLine(line)}
        />
      </li>
    );
  }

  if (r.lat == null || r.lon == null) return null;

  // Locations (places + stops): always show an empty star until favourited.
  const isStop = r.kind === 'stop' || (r.kind !== 'place' && Boolean(r.id));
  const place: Place = {
    label: r.name,
    lat: r.lat,
    lon: r.lon,
    stopId: isStop ? r.id : undefined,
  };

  if (isStop && r.id) {
    const stop: Stop = {
      id: r.id,
      name: r.name,
      lat: r.lat,
      lon: r.lon,
      code: r.code,
    };
    return (
      <li className="search-result-row">
        <button type="button" className="suggestions__row" onClick={() => onPickStop(stop)}>
          <span className="suggestions__icon suggestions__icon--stop" aria-hidden="true">
            <Icon name="bus" size={18} />
          </span>
          <span className="suggestions__text">
            <span className="suggestions__name">{r.name}</span>
            {(r.nameEn || r.code) && (
              <span className="suggestions__meta">
                {r.nameEn}
                {r.nameEn && r.code ? ' · ' : ''}
                {r.code ? t('Stop {code}', { code: r.code }) : ''}
              </span>
            )}
          </span>
        </button>
        <SearchFavButton
          favored={stopFavored}
          label={r.name}
          onToggle={() => onToggleStop(stop)}
        />
      </li>
    );
  }

  return (
    <li className="search-result-row">
      <button type="button" className="suggestions__row" onClick={() => onPickPlace(place)}>
        <span className="suggestions__icon suggestions__icon--pin" aria-hidden="true">
          <Icon name="place" size={18} />
        </span>
        <span className="suggestions__text">
          <span className="suggestions__name">{r.name}</span>
        </span>
      </button>
      <SearchFavButton
        favored={placeFavored}
        label={r.name}
        onToggle={() => onTogglePlace(place)}
      />
    </li>
  );
}
