/** One row of the vertical itinerary: icon node + white connector track + content. */

import { BusIcon, PinIcon, WalkIcon } from '../icons';
import type { ItineraryRowProps } from './types';

function NodeGlyph({ node }: Pick<ItineraryRowProps, 'node'>) {
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
          <PinIcon size={16} />
        </span>
      );
  }
}

export function ItineraryRow({ node, connector, children }: ItineraryRowProps) {
  return (
    <li className={`itin__row itin__row--${node} itin__row--line-${connector}`}>
      <div className="itin__track">
        <NodeGlyph node={node} />
      </div>
      <div className="itin__content">{children}</div>
    </li>
  );
}
