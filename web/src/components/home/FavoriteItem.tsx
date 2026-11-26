/**
 * FavoriteItem — one row in the home Favourites list. Visual only.
 */

import type { FavoriteItemProps } from './types';
import { ChevronRightIcon, HomeIcon, StarIcon, WorkIcon } from '../shared/icons';

function FavoriteKindIcon({ kind }: { kind: FavoriteItemProps['fav']['kind'] }) {
  if (kind === 'home') return <HomeIcon size={22} />;
  if (kind === 'work') return <WorkIcon size={22} />;
  return <StarIcon size={22} />;
}

function slotTitle(fav: FavoriteItemProps['fav']): string {
  if (fav.kind === 'home') return 'Home';
  if (fav.kind === 'work') return 'Work';
  return fav.label;
}

/** Address / place name under Home · Work (always), or under custom when distinct. */
function placeAddress(fav: FavoriteItemProps['fav']): string | null {
  const addr = fav.place.label?.trim();
  if (!addr) return null;
  if (fav.kind === 'home' || fav.kind === 'work') return addr;
  return addr !== fav.label ? addr : null;
}

export function FavoriteItem({ fav, onTap }: FavoriteItemProps) {
  const title = slotTitle(fav);
  const address = placeAddress(fav);

  return (
    <li>
      <button type="button" className="home-fav-item" onClick={onTap}>
        <span className={`home-fav-item__icon home-fav-item__icon--${fav.kind}`}>
          <FavoriteKindIcon kind={fav.kind} />
        </span>
        <span className="home-fav-item__body">
          <span className="home-fav-item__label">{title}</span>
          {address && <span className="home-fav-item__address">{address}</span>}
        </span>
        <ChevronRightIcon size={16} className="home-fav-item__chevron" />
      </button>
    </li>
  );
}
