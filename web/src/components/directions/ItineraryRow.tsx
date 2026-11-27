/** One row of the vertical itinerary: icon node + white connector track + content. */

import { BusIcon, PinIcon, WalkIcon } from '../icons';
import { HomeIcon, WorkIcon } from '../shared/icons';
import type { ItineraryRowProps } from './types';

function NodeGlyph({ node, place }: Pick<ItineraryRowProps, 'node' | 'place'>) {
  switch (node) {
    case 'origin':
      return <span className="itin__ring" aria-hidden="true" />;
    case 'walk':
      return (
        <span className="itin__node itin__node--walk">
          <WalkIcon size={16} />
        </span>
      );
    case 'transit':
      return (
        <span className="itin__node itin__node--transit">
          <BusIcon size={16} />
        </span>
      );
    case 'destination':
      return (
        <span className="itin__node itin__node--dest">
          {place === 'work' ? (
            <WorkIcon size={16} />
          ) : place === 'home' ? (
            <HomeIcon size={16} />
          ) : (
            <PinIcon size={16} />
          )}
        </span>
      );
  }
}

export function ItineraryRow({ node, connector, place, children }: ItineraryRowProps) {
  return (
    <li className={`itin__row itin__row--${node} itin__row--line-${connector}`}>
      <div className="itin__track">
        <NodeGlyph node={node} place={place} />
      </div>
      <div className="itin__content">{children}</div>
    </li>
  );
}
