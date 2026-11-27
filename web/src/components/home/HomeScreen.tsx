/**
 * HomeScreen — visual composition for the Directions idle state.
 * Matches Moovit HOME layout: hero band → search pill → frequent destination card → favourites.
 * No logic lives here; all data arrives via props.
 */

import type { HomeScreenProps } from './types';
import type { Journey, Stop, TransitLeg } from '../../types';
import { FrequentDestinationCard } from './FrequentDestinationCard';
import { FavoriteItem } from './FavoriteItem';
import { HeroArt } from './HeroArt';
import { HamburgerIcon, SearchIcon } from '../shared/icons';
import { t } from '../../lib/i18n';

export function HomeScreen({
  frequentDest,
  favorites,
  onOpenSearch,
  onPlanTo,
  onPlanAtTime,
  onOpenStop,
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
            aria-label={t("Open menu")}
          >
            <HamburgerIcon />
          </button>
          <span className="home-hero__country">{t("Israel")}</span>
        </div>

        <button
          type="button"
          className="home-search-pill"
          onClick={onOpenSearch}
          aria-label={t("Search destination")}
        >
          <span className="home-search-pill__text">{t("Where do you want to go?")}</span>
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
            onPickTime={onPlanAtTime ? () => onPlanAtTime(frequentDest.place) : undefined}
            onLiveBoarding={(() => {
              const stop = boardingStopOf(frequentDest.journey);
              return stop && onOpenStop ? () => onOpenStop(stop) : undefined;
            })()}
          />
          <div className="home-card-dots" aria-hidden="true">
            <span className="home-card-dots__dot is-active" />
          </div>
        </div>
      )}

      {/* ── Favourites section ─────────────────────────────────────────── */}
      <section className="home-section" aria-label={t("Favourites")}>
        <div className="home-section__header">
          <h2 className="home-section__title">{t("Favourites")}</h2>
          <button
            type="button"
            className="home-section__action"
            onClick={onAddFavorite}
            aria-label={t("Add favourite")}
          >
            {t("Add")}
          </button>
        </div>

        {favorites.length === 0 ? (
          <p className="muted home-section__empty">
            {t("Save places you go often for quick access.")}
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
          aria-label={t("Open From and To planner")}
        >
          {t("From · To planner")}
        </button>
      </div>
    </div>
  );
}

/** The stop where the trip's first ride is boarded, as a Stop for the stop panel. */
function boardingStopOf(journey: Journey | null): Stop | null {
  const leg = journey?.legs.find((l): l is TransitLeg => l.mode === 'transit');
  const id = leg?.from?.stopId;
  if (!leg || !id || !leg.from) return null;
  return { id, name: leg.fromName ?? '', lat: leg.from.lat, lon: leg.from.lon };
}
