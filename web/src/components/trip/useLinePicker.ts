/**
 * Manages which route alternative the user has selected for each transit leg.
 * Keyed by transit-leg ordinal (0, 1, …) — independent of walking legs.
 *
 * Lives in TripProgressSheet, not in useActiveTrip, because the picker UI is
 * display-owned here; journey swaps for the chosen line go through
 * onSelectCorridorLine on the sheet.
 */
import { useCallback, useRef, useState } from 'react';
import { sameCorridorRoute } from '../../lib/corridorLine';
import type { RouteInfo } from '../../types';

export interface LinePickerHookState {
  /** Is the picker sheet currently open? */
  pickerOpen: boolean;
  /** Transit-leg ordinal currently being picked. */
  pickingTransitIdx: number;
  /** The alternatives being shown when the picker is open. */
  pickingAlternatives: RouteInfo[];
  /** Displayed route per transit-leg ordinal (assumed or user-confirmed). */
  selectedRoutes: Record<number, RouteInfo>;
  /** True once the rider explicitly picked via Switch for that ordinal. */
  userPicked: Record<number, true>;
  /** Open the picker for a specific transit leg. */
  openFor: (transitIdx: number, alts: RouteInfo[]) => void;
  /** Close without picking. */
  close: () => void;
  /** Confirm a choice (closes picker; locks against further auto-assume). */
  pickRoute: (route: RouteInfo) => void;
  /**
   * Confirm a line for a transit leg without opening the picker
   * (wait-row tap / arrivals modal). Locks against further auto-assume.
   */
  confirmRoute: (transitIdx: number, route: RouteInfo) => void;
  /**
   * Soft-select from soonest arrival. Ignored once the rider has used Switch
   * for that transit leg.
   */
  assumeRoute: (transitIdx: number, route: RouteInfo) => void;
}

export function useLinePicker(): LinePickerHookState {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickingTransitIdx, setPickingTransitIdx] = useState(0);
  const [pickingAlternatives, setPickingAlternatives] = useState<RouteInfo[]>([]);
  const [selectedRoutes, setSelectedRoutes] = useState<Record<number, RouteInfo>>({});
  const [userPicked, setUserPicked] = useState<Record<number, true>>({});
  const userPickedRef = useRef(userPicked);
  userPickedRef.current = userPicked;

  const openFor = useCallback((transitIdx: number, alts: RouteInfo[]) => {
    setPickingTransitIdx(transitIdx);
    setPickingAlternatives(alts.length > 0 ? alts : []);
    setPickerOpen(true);
  }, []);

  const close = useCallback(() => setPickerOpen(false), []);

  const confirmRoute = useCallback((transitIdx: number, route: RouteInfo) => {
    setSelectedRoutes((prev) => ({ ...prev, [transitIdx]: route }));
    setUserPicked((prev) => ({ ...prev, [transitIdx]: true }));
    setPickerOpen(false);
  }, []);

  const pickRoute = useCallback(
    (route: RouteInfo) => {
      confirmRoute(pickingTransitIdx, route);
    },
    [confirmRoute, pickingTransitIdx],
  );

  const assumeRoute = useCallback((transitIdx: number, route: RouteInfo) => {
    if (userPickedRef.current[transitIdx]) return;
    setSelectedRoutes((prev) => {
      const cur = prev[transitIdx];
      if (cur && sameCorridorRoute(cur, route)) return prev;
      return { ...prev, [transitIdx]: route };
    });
  }, []);

  return {
    pickerOpen,
    pickingTransitIdx,
    pickingAlternatives,
    selectedRoutes,
    userPicked,
    openFor,
    close,
    pickRoute,
    confirmRoute,
    assumeRoute,
  };
}
