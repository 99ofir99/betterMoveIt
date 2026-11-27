/**
 * Line detail state: schedule fetch, direction swap, board→alight picking.
 *
 * Direction swap prefers, in order:
 * 1. Multiple GTFS direction_ids on the same route
 * 2. Paired opposite-corridor route (Israel A↔B / B↔A as separate routes)
 * 3. Client-side stop/geometry flip when the feed only has one pattern
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { buildLineRideJourney } from '../../lib/buildLineRideJourney';
import { isFavoriteLine, toggleFavoriteLine } from '../../lib/favorites';
import { formatRailFinalCity } from '../../lib/lineCategory';
import { isHeavyRailRoute, isRailTrainNumber } from '../../lib/railLabel';
import type {
  Journey,
  Line,
  LineDirectionOption,
  LineScheduleResponse,
  LineScheduleStop,
} from '../../types';

export function useLineDetail(
  lineId: string,
  onGeometryChange?: (geometry: [number, number][] | null) => void,
  onSwitchLine?: (lineId: string) => void,
) {
  const [data, setData] = useState<LineScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favTick, setFavTick] = useState(0);
  const [tick, setTick] = useState(0);
  const [direction, setDirection] = useState<number | undefined>(undefined);
  const [directionOptions, setDirectionOptions] = useState<LineDirectionOption[]>([]);
  const [oppositeLineId, setOppositeLineId] = useState<string | null>(null);
  const [geometry, setGeometry] = useState<[number, number][] | null>(null);
  /** Client-side flip when feed has only one GTFS direction and no opposite route. */
  const [reversed, setReversed] = useState(false);
  const [boardIndex, setBoardIndex] = useState<number | null>(null);
  const [pickingDestination, setPickingDestination] = useState(false);
  /** Moovit expands one stop’s schedule card; defaults to the first stop. */
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    setDirection(undefined);
    setDirectionOptions([]);
    setOppositeLineId(null);
    setData(null);
    setBoardIndex(null);
    setPickingDestination(false);
    setFocusedIndex(0);
    setGeometry(null);
    setReversed(false);
  }, [lineId]);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .lineSchedule(lineId, direction !== undefined ? { direction } : undefined, ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setError(null);
        setData(d);
        if (d.directions?.length) setDirectionOptions(d.directions);
        setOppositeLineId(d.oppositeLineId ?? null);
        // Keep direction in state for Change direction, without forcing a refetch loop.
        if (direction === undefined && d.direction !== undefined) {
          setDirection(d.direction);
        }
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        // Keep last good schedule visible if a refresh fails (e.g. brief API blip).
        setData((cur) => {
          if (cur) return cur;
          setError(String(e.message ?? e));
          return cur;
        });
      });
    return () => ctrl.abort();
  }, [lineId, tick, direction]);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .lineDetail(lineId, direction !== undefined ? { direction } : undefined, ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        const geo = d.geometry ?? null;
        setGeometry(geo);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setGeometry(null);
      });
    return () => ctrl.abort();
  }, [lineId, direction]);

  const displayGeometry = useMemo(() => {
    if (!geometry) return null;
    return reversed ? [...geometry].reverse() : geometry;
  }, [geometry, reversed]);

  useEffect(() => {
    onGeometryChange?.(displayGeometry);
  }, [displayGeometry, onGeometryChange]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 45_000);
    return () => clearInterval(t);
  }, []);

  const line: Line | undefined = data?.line;
  const favored = line ? isFavoriteLine(line.id) : false;

  const displayStops: LineScheduleStop[] = useMemo(() => {
    if (!data?.stops) return [];
    return reversed ? [...data.stops].reverse() : data.stops;
  }, [data, reversed]);

  const originName = displayStops[0]?.name ?? '';
  const rawFeedDestination =
    data?.headsign ||
    directionOptions.find((o) => o.direction === direction)?.headsign ||
    '';
  // Israel Railways trip_headsign is the train number — prefer city / last stop.
  const feedDestination =
    line && isHeavyRailRoute(line) && isRailTrainNumber(rawFeedDestination)
      ? formatRailFinalCity(line.longName) ||
        displayStops[displayStops.length - 1]?.name ||
        ''
      : rawFeedDestination;
  const destinationName = reversed
    ? originName && displayStops.length
      ? displayStops[displayStops.length - 1]?.name || feedDestination
      : feedDestination
    : feedDestination || displayStops[displayStops.length - 1]?.name || '';

  /** Moovit: "Destination ← Origin" (clean GTFS headsign noise like underscores). */
  const directionLabel = useMemo(() => {
    const clean = (s: string) => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    const destRaw = reversed
      ? displayStops[displayStops.length - 1]?.name || feedDestination
      : feedDestination || displayStops[displayStops.length - 1]?.name || '';
    const dest = clean(destRaw);
    const origin = clean(displayStops[0]?.name ?? '');
    if (dest && origin) return `${dest} ← ${origin}`;
    return dest || origin || 'Line';
  }, [displayStops, feedDestination, reversed]);

  const multiGtfs = directionOptions.length > 1;
  const canChangeDirection =
    multiGtfs || Boolean(oppositeLineId && onSwitchLine) || displayStops.length > 1;

  const changeDirection = useCallback(() => {
    setBoardIndex(null);
    setPickingDestination(false);
    setFocusedIndex(0);
    if (multiGtfs) {
      const cur = direction ?? directionOptions[0]?.direction;
      const next = directionOptions.find((o) => o.direction !== cur) ?? directionOptions[0];
      setReversed(false);
      setDirection(next.direction);
      return;
    }
    // Separate GTFS route for the opposite corridor — open that line for real schedules.
    if (oppositeLineId && onSwitchLine) {
      onSwitchLine(oppositeLineId);
      return;
    }
    // Single GTFS direction — flip the pattern locally (Moovit still offers Change).
    setReversed((r) => !r);
  }, [multiGtfs, direction, directionOptions, oppositeLineId, onSwitchLine]);

  const toggleFavourite = useCallback(() => {
    if (!line) return;
    toggleFavoriteLine(line);
    setFavTick((x) => x + 1);
  }, [line]);

  const cancelPick = useCallback(() => {
    setBoardIndex(null);
    setPickingDestination(false);
  }, []);

  /**
   * Browse mode: tap focuses the schedule card.
   * After Start / board pick: first tap = board, later tap = alight → ride.
   */
  const selectStopForRide = useCallback(
    (index: number): Journey | null => {
      if (!line || displayStops.length < 2) return null;
      setFocusedIndex(index);

      if (!pickingDestination || boardIndex == null) {
        // Focusing only — Start button (or a second intentional start) begins pick mode.
        return null;
      }

      if (index <= boardIndex) {
        if (index < displayStops.length - 1) {
          setBoardIndex(index);
          setFocusedIndex(index);
        }
        return null;
      }

      const journey = buildLineRideJourney({
        line,
        headsign: directionLabel.split('←')[0]?.trim() || destinationName,
        stops: displayStops,
        boardIndex,
        alightIndex: index,
        geometry: displayGeometry,
      });
      setBoardIndex(null);
      setPickingDestination(false);
      return journey;
    },
    [
      line,
      displayStops,
      pickingDestination,
      boardIndex,
      directionLabel,
      destinationName,
      displayGeometry,
    ],
  );

  /** Tap a stop while browsing → focus it; long-press alternative is Start from focused. */
  const focusStop = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  /** Start button: board at focused stop, then ask where to get off. */
  const beginStartFromSelection = useCallback(() => {
    if (displayStops.length < 2) return;
    const idx = Math.min(focusedIndex, displayStops.length - 2);
    if (idx < 0) return;
    setBoardIndex(idx);
    setFocusedIndex(idx);
    setPickingDestination(true);
  }, [displayStops, focusedIndex]);

  const dataForUi = data
    ? { ...data, stops: displayStops, headsign: directionLabel }
    : null;

  return {
    data: dataForUi,
    error,
    line,
    favored,
    favTick,
    direction,
    directionOptions,
    directionLabel,
    canChangeDirection,
    changeDirection,
    toggleFavourite,
    boardIndex,
    focusedIndex,
    pickingDestination,
    cancelPick,
    selectStopForRide,
    focusStop,
    beginStartFromSelection,
    geometry: displayGeometry,
  };
}
