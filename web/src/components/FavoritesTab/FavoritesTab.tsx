/**
 * Favourites tab — Moovit-style places / stops / lines lists.
 * Composition only; state lives in useFavoritesTab.
 */

import { SectionHeader } from './SectionHeader';
import { PlaceRow } from './PlaceRow';
import { StopRow } from './StopRow';
import { LineFavRow } from './LineFavRow';
import { SetPlacePicker } from './SetPlacePicker';
import { SavePlaceSheet } from './SavePlaceSheet';
import { useFavoritesTab } from './useFavoritesTab';
import type { FavoritesTabProps } from './types';
import { t } from '../../lib/i18n';

export function FavoritesTab({
  onPlanTo,
  onOpenStop,
  onOpenLine,
  searchBias = null,
}: FavoritesTabProps) {
  const s = useFavoritesTab();

  return (
    <div className="fav-tab">
      <header className="fav-tab__header">
        <h1 className="fav-tab__title">{t("Favourites")}</h1>
      </header>

      <section className="fav-section" aria-label={t("Places")}>
        <SectionHeader
          title={t("Places")}
          actionLabel={t("Add")}
          onAction={() => s.beginSetSlot('custom')}
          actionAriaLabel={t("Add favourite place")}
        />
        <div className="fav-list">
          <PlaceRow
            kind="home"
            place={s.home}
            onSet={() => s.beginSetSlot('home')}
            onGo={() => s.home && onPlanTo(s.home.place)}
            onClear={() => s.clearPlace('home')}
            onEditAddress={(a) => s.editAddress('home', a)}
          />
          <PlaceRow
            kind="work"
            place={s.work}
            onSet={() => s.beginSetSlot('work')}
            onGo={() => s.work && onPlanTo(s.work.place)}
            onClear={() => s.clearPlace('work')}
            onEditAddress={(a) => s.editAddress('work', a)}
          />
          {s.customPlaces.map((p) => (
            <PlaceRow
              key={p.id}
              kind="custom"
              place={p}
              label={p.label}
              onSet={() => undefined}
              onGo={() => onPlanTo(p.place)}
              onClear={() => s.clearPlace(p.id)}
              onEditAddress={(a) => s.editAddress(p.id, a)}
            />
          ))}
        </div>
      </section>

      <section className="fav-section" aria-label={t("Favourite stops")}>
        <SectionHeader title={t("Stops")} />
        {s.stops.length === 0 ? (
          <p className="fav-empty">{t("Search for a stop and tap the star to save it here.")}</p>
        ) : (
          <div className="fav-list">
            {s.stops.map((item) => (
              <StopRow
                key={item.id}
                item={item}
                onOpen={() => onOpenStop(item.stop)}
                onRemove={() => s.removeStop(item.stop)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="fav-section" aria-label={t("Favourite lines")}>
        <SectionHeader title={t("Lines")} />
        {s.lines.length === 0 ? (
          <p className="fav-empty">{t("Search for a line and tap the star to save it here.")}</p>
        ) : (
          <div className="fav-list">
            {s.lines.map((item) => (
              <LineFavRow
                key={item.id}
                item={item}
                onOpen={() => onOpenLine(item.line.id)}
                onRemove={() => s.removeLine(item.line)}
              />
            ))}
          </div>
        )}
      </section>

      {s.settingKind && (
        <SetPlacePicker
          kind={s.settingKind}
          bias={searchBias}
          onClose={s.cancelSetSlot}
          onPickPlace={s.confirmPlace}
          onPickCurrentLocation={s.confirmCurrentLocation}
        />
      )}

      {s.pendingPlace && (
        <SavePlaceSheet
          place={s.pendingPlace}
          hasHome={Boolean(s.home)}
          hasWork={Boolean(s.work)}
          onSave={s.savePending}
          onCancel={s.cancelPending}
        />
      )}
    </div>
  );
}
