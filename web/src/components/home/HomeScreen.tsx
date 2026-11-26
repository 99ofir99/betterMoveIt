/**
 * HomeScreen — visual composition for the Directions idle state.
 * Matches Moovit HOME layout: hero band → search pill → frequent destination card → favourites.
 * No logic lives here; all data arrives via props.
 */

import type { HomeScreenProps } from './types';
import { FrequentDestinationCard } from './FrequentDestinationCard';
import { FavoriteItem } from './FavoriteItem';
import { HeroArt } from './HeroArt';
import { HamburgerIcon, SearchIcon } from '../shared/icons';

export function HomeScreen({
  frequentDest,
  favorites,
  onOpenSearch,
  onPlanTo,
  onOpenMore,
  onAddFavorite,
  onPlanManually,
}: HomeScreenProps) {
  return (
    <div className="home-screen">
      {/* ── Hero band ─────────────────────────────────────────────────── */}
      <div className="home-hero">
        <div className="home-hero__city-art" aria-hidden="true">
          <HeroArt />
        </div>

        <div className="home-hero__topbar">
          <button
            type="button"
            className="home-hero__menu-btn"
            onClick={onOpenMore}
            aria-label="Open menu"
          >
            <HamburgerIcon />
          </button>
          <span className="home-hero__country">Israel</span>
        </div>

        <button
          type="button"
          className="home-search-pill"
          onClick={onOpenSearch}
          aria-label="Search destination"
        >
          <span className="home-search-pill__text">Where do you want to go?</span>
          <span className="home-search-pill__icon" aria-hidden="true">
            <SearchIcon size={20} />
          </span>
        </button>
      </div>

      {/* ── Frequent Destination Card ──────────────────────────────────── */}
      {frequentDest && (
        <div className="home-card-band">
          <FrequentDestinationCard
            dest={frequentDest}
            onTap={() => onPlanTo(frequentDest.place)}
          />
          <div className="home-card-dots" aria-hidden="true">
            <span className="home-card-dots__dot is-active" />
          </div>
        </div>
      )}

      {/* ── Favourites section ─────────────────────────────────────────── */}
      <section className="home-section" aria-label="Favourites">
        <div className="home-section__header">
          <h2 className="home-section__title">Favourites</h2>
          <button
            type="button"
            className="home-section__action"
            onClick={onAddFavorite}
            aria-label="Add favourite"
          >
            Add
          </button>
        </div>

        {favorites.length === 0 ? (
          <p className="muted home-section__empty">
            Save places you go often for quick access.
          </p>
        ) : (
          <ul className="home-fav-list">
            {favorites.map((fav) => (
              <FavoriteItem key={fav.id} fav={fav} onTap={() => onPlanTo(fav.place)} />
            ))}
          </ul>
        )}
      </section>

      {/* Advanced planner — kept accessible, visually subtle */}
      <div className="home-plan-link">
        <button
          type="button"
          className="home-plan-link__btn"
          onClick={onPlanManually}
          aria-label="Open From and To planner"
        >
          From · To planner
        </button>
      </div>
    </div>
  );
}
