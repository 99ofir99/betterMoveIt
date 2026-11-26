import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppState, useStopSearch, type AppState } from "./lib/useAppState";
import { MapCanvas } from "./components/MapCanvas";
import { PlaceField } from "./components/PlaceField";
import { JourneyList } from "./components/JourneyList";
import { StopPanel } from "./components/StopPanel";
import { BottomNavigation } from "./components/BottomNavigation";
import { FavoritesTab } from "./components/FavoritesTab";
import { LinesTab } from "./components/LinesTab";
import { NearbyTab } from "./components/NearbyTab";
import { MoreTab } from "./components/MoreTab";
import { LineDetailPanel } from "./components/LineDetailPanel";
import { GlobalSearch, type SearchTarget } from "./components/GlobalSearch";
import { MapLocationPicker, type MapPickSlot } from "./components/MapLocationPicker";
import { ServiceAlertsBanner } from "./components/ServiceAlertsBanner";
import { TripProgressSheet } from "./components/trip/TripProgressSheet";
import { ActiveTripPip } from "./components/trip/ActiveTripPip";
import { ConfirmReplaceTrip } from "./components/trip/ConfirmReplaceTrip";
import { HomeScreen } from "./components/home/HomeScreen";
import { ResultsToolbar } from "./components/results/ResultsToolbar";
import { ResultsHeader } from "./components/results/ResultsHeader";
import { PreferencesSheet } from "./components/results/PreferencesSheet";
import { DepartAtSheet, type DepartAtAction } from "./components/results/DepartAtSheet";
import { DirectionsSheet } from "./components/directions/DirectionsSheet";
import { formatClock12h, secondsSinceLocalMidnight } from "./lib/format";
import { DraggableSheet } from "./components/sheet/DraggableSheet";
import type { SheetSnap } from "./components/sheet/types";
import { useFrequentDestination } from "./lib/useFrequentDestination";
import { api } from "./lib/api";
import {
  loadSettings,
  saveSettings,
  SETTINGS_CHANGED_EVENT,
  type TransportPrefs,
} from "./lib/settings";
import { computeTripInsights } from "./lib/tripInsights";
import { countDisabledTransport } from "./lib/transportMode";
import { BestTimeCard } from "./components/results/BestTimeCard";
import { Icon } from "./components/icons/Icon";
import { useServiceAlerts } from "./lib/useServiceAlerts";
import { useVehicles } from "./lib/useVehicles";
import { useActiveTrip } from "./lib/useActiveTrip";
import type { Journey, LatLon, Line, Place, Stop, TabName } from "./types";
import { rankJourneys, type SortMode } from "./lib/sort";
import { clampJourneys } from "./lib/clampJourneys";
import { requestCompassPermission, useCompassHeading } from "./lib/useCompassHeading";
import { FAVORITES_CHANGED_EVENT, loadFavorites } from "./lib/favorites";
import { ghostJourneyPolylines } from "./lib/journeyMap";
import {
  lineKeysFromFavoriteLines,
  lineKeysFromJourneys,
  prioritizeVehicles,
} from "./lib/prioritizeVehicles";

export default function App() {
  const state = useAppState({ watchLocation: true });
  const {
    activeTrip,
    tripActive,
    restoredMinimized,
    startTrip,
    selectCorridorLine,
    endTrip,
    setMinimized,
    setAlertsEnabled,
  } = useActiveTrip(state.userLocation, state.gpsAllowed);
  const [activeTab, setActiveTab] = useState<TabName>("directions");
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchTarget>("to");
  /** Moovit Choose Location — pick any map point as from/to (not only stops). */
  const [mapPickSlot, setMapPickSlot] = useState<MapPickSlot | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showDepartSheet, setShowDepartSheet] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("fastest");
  const [transportPrefs, setTransportPrefs] = useState<TransportPrefs | undefined>(
    () => loadSettings().transportPrefs,
  );
  // Best-time card stays dismissed for the rest of the session.
  const [bestTimeDismissed, setBestTimeDismissed] = useState(false);
  // Directions detail (Moovit trip sheet) — separate from the results list.
  const [showJourneyDetail, setShowJourneyDetail] = useState(false);
  const [resultsSnap, setResultsSnap] = useState<SheetSnap>("half");
  /** Directions detail sheet snap — peek keeps the route path visible above Start. */
  const [detailSnap, setDetailSnap] = useState<SheetSnap>("peek");
  /** Stations sheet snap — peek reveals map markers; half/full shows the nearby list. */
  const [nearbySnap, setNearbySnap] = useState<SheetSnap>("half");
  /** Bumped when opening / selecting a trip so the map re-fits the path before Start. */
  const [journeyFitKey, setJourneyFitKey] = useState(0);
  const [maxWalk, setMaxWalkState] = useState(() => loadSettings().maxWalkM);
  const setMaxWalk = useCallback((v: number) => {
    setMaxWalkState(v);
    saveSettings({ maxWalkM: v });
  }, []);
  const [nearbyStops, setNearbyStops] = useState<Stop[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  /** Match tokens for the line currently open in Line Detail (shown even before favourite). */
  const [focusedLineKeys, setFocusedLineKeys] = useState<string[]>([]);
  const [lineGeometry, setLineGeometry] = useState<[number, number][] | null>(null);
  const [favTick, setFavTick] = useState(0);
  const [liveBuses, setLiveBuses] = useState(() => loadSettings().showLiveBuses);
  // Whether the advanced PlanForm overlay is open (instead of HomeScreen)
  const [showPlanForm, setShowPlanForm] = useState(false);
  // Active-trip: which leg the user has focused on the map via the leg pager dots.
  const [tripFocusLegIndex, setTripFocusLegIndex] = useState<number | null>(null);
  // Active-trip: whether the user has manually panned away from their location.
  const [mapUserPanned, setMapUserPanned] = useState(false);
  // Pending "start trip" confirmation when a trip is already active.
  const [showTripConfirm, setShowTripConfirm] = useState(false);
  /** Line-detail ride waiting on ConfirmReplaceTrip (null = normal plan start). */
  const [pendingLineRide, setPendingLineRide] = useState<Journey | null>(null);
  // Moovit: Back minimizes Live Directions into a floating PiP (trip stays alive).
  const [tripMinimized, setTripMinimized] = useState(() => restoredMinimized === true);
  const tripLive = tripActive && !tripMinimized;

  /** UI to restore when leaving Live Directions (Back minimize / Stop). */
  const liveReturnRef = useRef<{
    tab: TabName;
    showJourneyDetail: boolean;
    selectedLineId: string | null;
  } | null>(null);

  const captureLiveReturn = useCallback(() => {
    liveReturnRef.current = {
      tab: activeTab,
      showJourneyDetail,
      selectedLineId,
    };
  }, [activeTab, showJourneyDetail, selectedLineId]);

  const restoreLiveReturn = useCallback(() => {
    const ret = liveReturnRef.current;
    if (!ret) return false;
    setActiveTab(ret.tab);
    setShowJourneyDetail(ret.showJourneyDetail);
    if (ret.tab === "lines") {
      setSelectedLineId(ret.selectedLineId);
      setFocusedLineKeys(ret.selectedLineId ? [ret.selectedLineId] : []);
      if (!ret.selectedLineId) setLineGeometry(null);
    }
    return true;
  }, []);

  // Apply restored minimize flag once trip hydration finishes.
  useEffect(() => {
    if (restoredMinimized == null) return;
    if (tripActive && restoredMinimized) {
      setTripMinimized(true);
      setShowJourneyDetail(true);
    }
  }, [restoredMinimized, tripActive]);

  const showAlerts = activeTab === "directions" || activeTab === "nearby";
  const { visible: serviceAlerts, dismiss: dismissAlert } = useServiceAlerts(showAlerts);

  const searchBias = state.userLocation ?? state.center;
  const fromSearch = useStopSearch(fromQuery, searchBias);
  const toSearch = useStopSearch(toQuery, searchBias);

  // Frequent destination for the home screen card (logic in hook, visuals in FrequentDestinationCard)
  const frequentDest = useFrequentDestination(state.userLocation, favTick);
  // Favourite places list for the home screen section
  const homeFavorites = useMemo(() => loadFavorites().places, [favTick]);

  // The home screen is the idle Directions view before any trip is planned.
  // Minimized trips keep browsing UI (home / results / detail) with a PiP chip.
  const isHomeScreenVisible =
    activeTab === "directions" && state.panel === "plan" && !showPlanForm && !tripLive;

  // Hide the map on the home screen to show the full hero band.
  const showMap =
    !isHomeScreenVisible &&
    (activeTab === "directions" || activeTab === "nearby" || !!selectedLineId);

  const favoriteLineKeys = useMemo(
    () => lineKeysFromFavoriteLines(loadFavorites().lines),
    [favTick],
  );

  const vehicleBbox = useMemo((): [number, number, number, number] | null => {
    const c = state.userLocation ?? state.center;
    const d = 0.25;
    return [c.lat - d, c.lon - d, c.lat + d, c.lon + d];
  }, [state.userLocation?.lat, state.userLocation?.lon, state.center.lat, state.center.lon]);
  const headingDeg = useCompassHeading(showMap);

  const loadNearby = useCallback(async (center: LatLon) => {
    try {
      const r = await api.nearby(center.lat, center.lon, 900);
      setNearbyStops(r.stops);
    } catch {
      setNearbyStops([]);
    }
  }, []);

  // Map taps must not overwrite From/To — destination is only set via search,
  // favorites, or home shortcuts. Accidental map clicks were wiping the To field.
  const onMapClick = useCallback((_point: LatLon) => {}, []);

  const rankedJourneys = useMemo(
    () => rankJourneys(state.plan.journeys, sortMode, transportPrefs),
    [state.plan.journeys, sortMode, transportPrefs],
  );
  // Moovit: merge options that share structure and only differ on first/last line.
  const journeys = useMemo(() => clampJourneys(rankedJourneys), [rankedJourneys]);
  const primaryJourneys = useMemo(() => journeys.map((c) => c.journey), [journeys]);
  const tripInsights = useMemo(() => computeTripInsights(primaryJourneys), [primaryJourneys]);
  const prefsBadgeCount = (sortMode !== "fastest" ? 1 : 0) + countDisabledTransport(transportPrefs);
  const activeJourney: Journey | null =
    journeys[state.selectedJourney]?.journey ?? journeys[0]?.journey ?? null;

  // Live buses: favourites + trip lines + the line currently open on the map.
  const journeyLineKeys = useMemo(
    () =>
      lineKeysFromJourneys([
        activeTab === "directions" ? activeJourney : null,
        activeTrip?.journey,
      ]),
    [activeTab, activeJourney, activeTrip?.journey],
  );
  const preferredLineKeys = useMemo(() => {
    const keys = [...favoriteLineKeys, ...journeyLineKeys, ...focusedLineKeys];
    return [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
  }, [favoriteLineKeys, journeyLineKeys, focusedLineKeys]);

  // Prefetch whenever we have lines to track — markers appear as soon as any map shows.
  const showVehicles = liveBuses && preferredLineKeys.length > 0;
  const { vehicles: rawVehicles } = useVehicles(showVehicles, vehicleBbox);

  const vehicles = useMemo(
    () =>
      prioritizeVehicles(rawVehicles, {
        near: state.userLocation ?? state.center,
        preferredKeys: preferredLineKeys,
        preferredOnly: true,
        limit: 100,
      }),
    [
      rawVehicles,
      preferredLineKeys,
      state.userLocation?.lat,
      state.userLocation?.lon,
      state.center.lat,
      state.center.lon,
    ],
  );

  const journeyGhosts = useMemo(() => {
    if (activeTab !== "directions" || state.panel !== "journeys" || primaryJourneys.length < 2) {
      return [];
    }
    return ghostJourneyPolylines(primaryJourneys, state.selectedJourney);
  }, [activeTab, primaryJourneys, state.panel, state.selectedJourney]);

  // Keep selection in range after clamping merges cards.
  useEffect(() => {
    if (journeys.length === 0) return;
    if (state.selectedJourney >= journeys.length) state.setSelectedJourney(0);
  }, [journeys.length, state.selectedJourney, state.setSelectedJourney]);

  // Keep results list-first (Moovit); collapse detail when leaving journeys.
  useEffect(() => {
    if (state.panel !== "journeys") {
      setShowJourneyDetail(false);
      setResultsSnap("half");
    }
  }, [state.panel]);

  /**
   * Start a route search and always land on the results list.
   * Never auto-enter a journey (including when there is only one option).
   * Earlier/Later on DirectionsSheet still calls planTrip directly so detail stays open.
   */
  const searchRoutes = useCallback(
    (...args: Parameters<AppState["planTrip"]>) => {
      setShowJourneyDetail(false);
      return state.planTrip(...args);
    },
    [state],
  );

  // Reset PlanForm when navigating away from the plan panel.
  useEffect(() => {
    if (state.panel !== "plan") setShowPlanForm(false);
  }, [state.panel]);

  // Re-read favourite lines when any tab toggles a favourite (live buses filter).
  // Favouriting a line turns Live Location on so buses appear right away on the map.
  useEffect(() => {
    const onFavoritesChanged = () => {
      setFavTick((x) => x + 1);
      if (loadFavorites().lines.length > 0) {
        setLiveBuses(true);
        saveSettings({ showLiveBuses: true });
      }
    };
    window.addEventListener(FAVORITES_CHANGED_EVENT, onFavoritesChanged);
    return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, onFavoritesChanged);
  }, []);

  // More tab writes settings to localStorage — keep live-buses / walk in sync.
  useEffect(() => {
    const onSettingsChanged = () => {
      const s = loadSettings();
      setLiveBuses(s.showLiveBuses);
      setMaxWalk(s.maxWalkM);
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
  }, []);

  const fromIsCurrentLocation = useMemo(() => {
    if (!state.from || !state.userLocation) return false;
    const dLat = Math.abs(state.from.lat - state.userLocation.lat);
    const dLon = Math.abs(state.from.lon - state.userLocation.lon);
    return dLat < 0.0008 && dLon < 0.0008;
  }, [state.from, state.userLocation]);

  const openSearch = useCallback((target: SearchTarget = "to") => {
    setSearchTarget(target);
    setShowSearch(true);
  }, []);

  /** ← returns to the previous screen in the trip flow. */
  const goBack = useCallback(() => {
    if (showDepartSheet) {
      setShowDepartSheet(false);
      return;
    }
    if (showPreferences) {
      setShowPreferences(false);
      return;
    }
    if (showSearch) {
      setShowSearch(false);
      return;
    }
    if (tripLive) {
      // Moovit: back keeps the trip running as a floating chip and returns
      // to the screen the user was on before Live Directions took over.
      setTripMinimized(true);
      setMinimized(true);
      if (!restoreLiveReturn()) setShowJourneyDetail(true);
      setTripFocusLegIndex(null);
      setMapUserPanned(false);
      return;
    }
    if (showJourneyDetail) {
      setShowJourneyDetail(false);
      return;
    }
    if (state.panel === "stop") {
      state.clearStop();
      return;
    }
    if (state.panel === "journeys") {
      state.resetPlan();
      setShowPlanForm(false);
      return;
    }
    if (showPlanForm) {
      setShowPlanForm(false);
      return;
    }
  }, [
    showDepartSheet,
    showPreferences,
    showSearch,
    tripLive,
    showJourneyDetail,
    state,
    showPlanForm,
    setMinimized,
    restoreLiveReturn,
  ]);

  /** Core start logic, shared by handleStartTrip and handleConfirmReplaceTrip. */
  const doStartTrip = useCallback(() => {
    if (!activeJourney) return;
    const card = journeys[state.selectedJourney] ?? journeys[0];
    const alts = card?.transitAlternatives;
    // Member itineraries let Switch / soonest-arrival assumption swap the stop rail.
    const members = (card?.sourceIndices ?? [])
      .map((i) => rankedJourneys[i])
      .filter((j): j is Journey => j != null);
    captureLiveReturn();
    startTrip(activeJourney, alts, members.length > 0 ? members : undefined);
    setTripMinimized(false);
    setMinimized(false);
    setShowJourneyDetail(false);
    setTripFocusLegIndex(null);
    setMapUserPanned(false);
  }, [
    activeJourney,
    startTrip,
    journeys,
    rankedJourneys,
    state.selectedJourney,
    setMinimized,
    captureLiveReturn,
  ]);

  /**
   * Called when user taps "Start trip". If a trip is already running we surface
   * a confirm dialog (Moovit: existing-trip warning) instead of silently replacing.
   */
  const handleStartTrip = useCallback(() => {
    if (!activeJourney) return;
    if (tripActive) {
      setShowTripConfirm(true);
      return;
    }
    doStartTrip();
  }, [activeJourney, tripActive, doStartTrip]);

  /** User confirmed they want to replace the active trip. */
  const handleConfirmReplaceTrip = useCallback(() => {
    setShowTripConfirm(false);
    if (pendingLineRide) {
      captureLiveReturn();
      startTrip(pendingLineRide);
      setPendingLineRide(null);
      setSelectedLineId(null);
      setFocusedLineKeys([]);
      setLineGeometry(null);
      setActiveTab("directions");
      setTripMinimized(false);
      setShowJourneyDetail(false);
      setTripFocusLegIndex(null);
      setMapUserPanned(false);
      return;
    }
    doStartTrip();
  }, [captureLiveReturn, doStartTrip, pendingLineRide, startTrip]);

  /** Expand the minimized PiP back into full Live Directions. */
  const handleExpandTrip = useCallback(() => {
    captureLiveReturn();
    setTripMinimized(false);
    setMinimized(false);
    setShowJourneyDetail(false);
    setActiveTab("directions");
    setTripFocusLegIndex(null);
    setMapUserPanned(false);
  }, [captureLiveReturn, setMinimized]);

  const handleEndTrip = useCallback(() => {
    endTrip();
    setTripMinimized(false);
    if (!restoreLiveReturn()) setShowJourneyDetail(false);
    liveReturnRef.current = null;
    setTripFocusLegIndex(null);
    setMapUserPanned(false);
  }, [endTrip, restoreLiveReturn]);

  /** PiP X — dismiss floating window and end navigation; stay on the current tab. */
  const handleClosePip = useCallback(() => {
    endTrip();
    liveReturnRef.current = null;
    setTripMinimized(false);
    setTripFocusLegIndex(null);
    setMapUserPanned(false);
  }, [endTrip]);

  const shiftPlanByMinutes = useCallback(
    (deltaMin: number) => {
      if (!activeJourney) return;
      const daySec = (((activeJourney.departSeconds + deltaMin * 60) % 86400) + 86400) % 86400;
      const h = Math.floor(daySec / 3600);
      const m = Math.floor((daySec % 3600) / 60);
      const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      void state.planTrip(undefined, undefined, { leaveAt: time });
    },
    [activeJourney, state],
  );

  const shareTrip = useCallback(async () => {
    if (!activeJourney || !state.from || !state.to) return;
    const text = `${state.from.label} → ${state.to.label}\n${formatClock12h(activeJourney.departSeconds)} – ${formatClock12h(activeJourney.arrivalSeconds)}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* user cancelled */
    }
  }, [activeJourney, state.from, state.to]);

  const departLabel = useMemo(() => {
    if (state.when === "now") return "Depart now";
    if (state.departTime) return `Depart at ${state.departTime}`;
    return "Depart at";
  }, [state.when, state.departTime]);

  const handleDepartAction = useCallback(
    (action: DepartAtAction) => {
      if (action.type === "now") {
        void searchRoutes(undefined, undefined, { forceNow: true });
        return;
      }
      if (action.type === "plus15") {
        const base =
          state.when === "leave" && state.departTime
            ? state.departTime
                .split(":")
                .reduce((acc, v, i) => acc + Number(v) * (i === 0 ? 3600 : 60), 0)
            : secondsSinceLocalMidnight();
        const next = (base + 15 * 60) % 86400;
        const hh = String(Math.floor(next / 3600)).padStart(2, "0");
        const mm = String(Math.floor((next % 3600) / 60)).padStart(2, "0");
        void searchRoutes(undefined, undefined, { leaveAt: `${hh}:${mm}` });
        return;
      }
      if (action.type === "latest") {
        void searchRoutes(undefined, undefined, { leaveAt: "21:00" });
        return;
      }
      if (action.type === "departAt") {
        void searchRoutes(undefined, undefined, {
          leaveAt: action.time,
          leaveDate: action.date,
        });
        return;
      }
      if (action.type === "arriveBy") {
        void searchRoutes(undefined, undefined, {
          arriveBy: action.time,
          arriveDate: action.date,
        });
      }
    },
    [searchRoutes, state.when, state.departTime],
  );

  // Toggle live-vehicle overlay from the Live Directions sheet.
  const handleToggleLiveBuses = useCallback(() => {
    setLiveBuses((prev) => {
      const next = !prev;
      saveSettings({ showLiveBuses: next });
      return next;
    });
  }, []);

  /** Recenter + unlock compass (iOS needs a gesture for heading). */
  const handleLocate = useCallback(async () => {
    await requestCompassPermission();
    await state.locate();
  }, [state]);

  /** Called when user pages the LegPager dots during active trip. */
  const handleSelectTripLeg = useCallback((legIndex: number) => {
    setTripFocusLegIndex(legIndex);
    // Previewing another step pauses auto-follow (Moovit behaviour).
    setMapUserPanned(true);
  }, []);

  /** Recenter map on user during active trip + hide the recenter button. */
  const handleTripRecenter = useCallback(async () => {
    setMapUserPanned(false);
    setTripFocusLegIndex(null);
    await requestCompassPermission();
    await state.locate();
  }, [state]);

  // Refresh map nearby markers when GPS moves meaningfully (~100m).
  const lastNearbyFetchRef = useRef<{ lat: number; lon: number } | null>(null);
  useEffect(() => {
    const c = state.userLocation ?? state.center;
    const prev = lastNearbyFetchRef.current;
    const moved =
      !prev ||
      Math.abs(prev.lat - c.lat) >= 0.0009 ||
      Math.abs(prev.lon - c.lon) >= 0.0009;
    if (!moved) return;
    lastNearbyFetchRef.current = { lat: c.lat, lon: c.lon };
    void loadNearby(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.userLocation?.lat, state.userLocation?.lon]);

  useEffect(() => {
    void state.locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showFullScreenTab =
    activeTab === "favorites" ||
    activeTab === "more" ||
    (activeTab === "lines" && !selectedLineId) ||
    isHomeScreenVisible;

  const openStop = useCallback(
    (stop: Stop) => {
      state.openStop(stop);
      setActiveTab(activeTab === "nearby" ? "nearby" : "directions");
      setSelectedLineId(null);
      setFocusedLineKeys([]);
      setLineGeometry(null);
      setShowSearch(false);
    },
    [state, activeTab],
  );

  const openLine = useCallback(async (line: Line | string) => {
    const id = typeof line === "string" ? line : line.id;
    const keys =
      typeof line === "string"
        ? [line]
        : [line.id, line.shortName, line.displayName].filter(Boolean);
    setSelectedLineId(id);
    setFocusedLineKeys(keys);
    setActiveTab("lines");
    setShowSearch(false);
    // Ensure live buses are on while inspecting a line on the map.
    setLiveBuses(true);
    saveSettings({ showLiveBuses: true });
    try {
      const detail = await api.lineDetail(id);
      setLineGeometry(detail.geometry ?? null);
      const short = detail.line?.shortName;
      const display = detail.line?.displayName;
      if (short || display) {
        setFocusedLineKeys((prev) =>
          [...new Set([...prev, short, display].filter(Boolean) as string[])],
        );
      }
    } catch {
      setLineGeometry(null);
    }
  }, []);

  const planToFavorite = useCallback(
    (place: Place) => {
      state.selectPlace(place, "to");
      setToQuery("");
      setActiveTab("directions");
      void state.useMyLocationAsOrigin();
    },
    [state],
  );

  /** Confirm a map-picked place (no stopId) and plan door-to-door with egress walk. */
  const handleMapPickConfirm = useCallback(
    (place: Place) => {
      const slot = mapPickSlot ?? "to";
      setMapPickSlot(null);
      state.selectPlace(place, slot);
      if (slot === "from") setFromQuery("");
      else setToQuery("");
      setActiveTab("directions");
      setShowPlanForm(true);
      if (slot === "to") {
        if (state.from) void searchRoutes(state.from, place);
        else {
          void state.useMyLocationAsOrigin().then((origin) => {
            if (origin) void searchRoutes(origin, place);
          });
        }
      } else if (state.to) {
        void searchRoutes(place, state.to);
      }
    },
    [mapPickSlot, searchRoutes, state],
  );

  /**
   * Tap a destination from the home screen: set it, acquire GPS as origin,
   * then immediately plan the trip. Falls back to PlanForm if no location.
   */
  const handlePlanFromHome = useCallback(
    async (place: Place) => {
      state.selectPlace(place, "to");
      setToQuery("");
      setActiveTab("directions");
      const origin = await state.useMyLocationAsOrigin();
      if (origin) {
        void searchRoutes(origin, place);
      } else {
        setShowPlanForm(true);
      }
    },
    [searchRoutes, state],
  );

  const replayTrip = useCallback(
    (from: Place, to: Place) => {
      state.selectPlace(from, "from");
      state.selectPlace(to, "to");
      setActiveTab("directions");
      void searchRoutes(from, to);
    },
    [searchRoutes, state],
  );

  // Sheet is only rendered when it has content.
  // Minimized trips still show plan/results/detail under the PiP chip.
  const showDirectionsSheet =
    activeTab === "directions" &&
    !tripLive &&
    (state.panel === "stop" ||
      state.panel === "journeys" ||
      (state.panel === "plan" && showPlanForm));

  // Topbar over map for nearby / plan form — not on home, results, or live trip.
  const showTopbar =
    activeTab === "nearby" ||
    (activeTab === "directions" &&
      !isHomeScreenVisible &&
      state.panel !== "journeys" &&
      !tripLive);

  return (
    <div className={`app app--tab-${activeTab}`}>
      {showMap && (
        <MapCanvas
          center={state.center}
          stops={nearbyStops}
          journey={activeTab === "directions" ? activeJourney : null}
          userLocation={state.userLocation}
          headingDeg={headingDeg}
          onStopClick={(s) => openStop(s)}
          onMapClick={onMapClick}
          onLocate={() => void handleLocate()}
          fitToJourney={state.panel === "journeys" && activeTab === "directions" && !tripLive}
          fitKey={journeyFitKey}
          lineGeometry={lineGeometry}
          ghostJourneyPolylines={tripLive ? [] : journeyGhosts}
          vehicles={vehicles}
          activeLegIndex={tripLive ? (activeTrip?.legIndex ?? null) : null}
          followUser={
            tripLive &&
            !mapUserPanned &&
            (tripFocusLegIndex == null || tripFocusLegIndex === activeTrip?.legIndex)
          }
          focusLegIndex={
            tripLive && tripFocusLegIndex != null && tripFocusLegIndex !== activeTrip?.legIndex
              ? tripFocusLegIndex
              : null
          }
          onUserPan={tripLive ? () => setMapUserPanned(true) : undefined}
        />
      )}

      {/* Recenter button — shown when user has manually panned away during a trip */}
      {tripLive && mapUserPanned && (
        <button
          type="button"
          className="trip-recenter-btn"
          onClick={() => void handleTripRecenter()}
          aria-label="Recenter map on my location"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
            <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
          </svg>
        </button>
      )}

      {showFullScreenTab && (
        <main className="tab-screen">
          {activeTab === "favorites" && (
            <FavoritesTab
              onPlanTo={planToFavorite}
              onOpenStop={openStop}
              onOpenLine={(id) => void openLine(id)}
              onGoDirections={() => setActiveTab("directions")}
              onAddPlace={() => openSearch("to")}
              searchBias={searchBias}
            />
          )}
          {activeTab === "lines" && <LinesTab onOpenLine={(line) => void openLine(line)} />}
          {activeTab === "more" && (
            <MoreTab onReplayTrip={replayTrip} onOpenSearch={() => openSearch("any")} />
          )}
          {isHomeScreenVisible && (
            <HomeScreen
              frequentDest={frequentDest}
              favorites={homeFavorites}
              onOpenSearch={() => openSearch("to")}
              onPlanTo={(place) => void handlePlanFromHome(place)}
              onOpenMore={() => setActiveTab("more")}
              onAddFavorite={() => openSearch("to")}
              onPlanManually={() => setShowPlanForm(true)}
            />
          )}
        </main>
      )}

      {showTopbar && !showJourneyDetail && (
        <header className="topbar">
          <button
            type="button"
            className="topbar__search"
            onClick={() => openSearch("any")}
            aria-label="Search"
          >
            <span className="topbar__search-text">Search stops, lines, places…</span>
            <span aria-hidden="true">🔍</span>
          </button>
          <button
            type="button"
            className="icon-button icon-button--light"
            onClick={() => void handleLocate()}
            aria-label="Recenter on my location"
          >
            {state.locating ? "…" : "◎"}
          </button>
        </header>
      )}

      {showAlerts && <ServiceAlertsBanner alerts={serviceAlerts} onDismiss={dismissAlert} />}

      {/* Active trip — full Live Directions (not minimized) */}
      {activeTab === "directions" && tripLive && activeTrip && (
        <TripProgressSheet
          state={activeTrip}
          onEnd={handleEndTrip}
          onBack={goBack}
          onToggleLiveBuses={handleToggleLiveBuses}
          liveBusesActive={liveBuses}
          onSelectLeg={handleSelectTripLeg}
          onToggleAlerts={() => setAlertsEnabled(!activeTrip.alertsEnabled)}
          onSelectCorridorLine={selectCorridorLine}
        />
      )}

      {/* Moovit PiP: draggable chip (fixed so it stays across tabs / after reopen) */}
      {tripActive && tripMinimized && activeTrip && (
        <ActiveTripPip
          state={activeTrip}
          onExpand={handleExpandTrip}
          onClose={handleClosePip}
        />
      )}

      {showDirectionsSheet && state.panel === "journeys" && showJourneyDetail && activeJourney ? (
        <>
          <header className="directions-topbar">
            <button
              type="button"
              className="icon-button icon-button--ghost directions-topbar__back"
              onClick={goBack}
              aria-label="Back"
            >
              <Icon name="arrow-back" />
            </button>
            <h1 className="directions-topbar__title">Directions</h1>
          </header>
          <DraggableSheet
            ariaLabel="Directions"
            className="sheet--directions"
            withNav
            overlay
            behavior="free"
            initialSnap="peek"
            snap={detailSnap}
            onSnapChange={setDetailSnap}
          >
            <DirectionsSheet
              journey={activeJourney}
              transitAlternatives={
                journeys[state.selectedJourney]?.transitAlternatives ??
                journeys[0]?.transitAlternatives
              }
              onEarlier={() => shiftPlanByMinutes(-20)}
              onLater={() => shiftPlanByMinutes(20)}
              onStartTrip={handleStartTrip}
              onToggleLiveBuses={handleToggleLiveBuses}
              liveBusesActive={liveBuses}
              onShare={() => void shareTrip()}
              onStopClick={async (stopId) => {
                const detail = await api.stopDetail(stopId).catch(() => null);
                if (detail) state.openStop(detail.stop);
              }}
            />
          </DraggableSheet>
        </>
      ) : showDirectionsSheet && state.panel === "journeys" ? (
        <DraggableSheet
          ariaLabel="Trip results"
          withNav
          overlay
          behavior="free"
          initialSnap="half"
          snap={resultsSnap}
          onSnapChange={setResultsSnap}
        >
          <div className="results">
            <ResultsHeader
              from={state.from}
              to={state.to}
              fromIsCurrentLocation={fromIsCurrentLocation}
              onBack={goBack}
              onSwap={() => {
                if (!state.from || !state.to) {
                  state.swapEnds();
                  return;
                }
                void searchRoutes(state.to, state.from);
                state.swapEnds();
              }}
              onEditFrom={() => openSearch("from")}
              onEditTo={() => openSearch("to")}
              onOpenPreferences={() => setShowPreferences(true)}
              prefsBadgeCount={prefsBadgeCount}
            />

            <ResultsToolbar
              departLabel={departLabel}
              onOpenDepartSheet={() => setShowDepartSheet(true)}
              mapPeek={resultsSnap === "peek"}
              onToggleMapView={() =>
                setResultsSnap((s) => (s === "peek" ? "half" : "peek"))
              }
              sortMode={sortMode}
              onSortMode={setSortMode}
            />

            {state.plan.loading && <p className="muted">Finding the best routes…</p>}
            {state.plan.error && <p className="error-text">{state.plan.error}</p>}
            {!state.plan.loading && !state.plan.error && journeys.length === 0 && (
              <p className="muted">No route found. Try a different departure time.</p>
            )}

            {journeys.length >= 2 && !bestTimeDismissed && (
              <BestTimeCard
                journeys={primaryJourneys}
                onDismiss={() => setBestTimeDismissed(true)}
              />
            )}

            {journeys.length > 0 && (
              <JourneyList
                journeys={journeys}
                insights={tripInsights}
                selected={state.selectedJourney}
                departNow={state.when === "now"}
                onSelect={(i) => {
                  state.setSelectedJourney(i);
                  setDetailSnap("peek");
                  setJourneyFitKey((k) => k + 1);
                  setShowJourneyDetail(true);
                }}
              />
            )}
          </div>
        </DraggableSheet>
      ) : showDirectionsSheet ? (
        <section
          className={`sheet sheet--with-nav${state.panel === "stop" ? " sheet--stop-detail" : ""}`}
          aria-label="Trip planner"
        >
          {state.panel === "stop" && state.selectedStop ? (
            <div className="sheet-stop-host">
              <StopPanel
                stopId={state.selectedStop.id}
                stopName={state.selectedStop.name}
                stop={state.selectedStop}
                onClose={state.clearStop}
                onOpenLine={(id) => void openLine(id)}
                onSetOrigin={() => {
                  state.selectPlace(
                    {
                      label: state.selectedStop!.name,
                      lat: state.selectedStop!.lat,
                      lon: state.selectedStop!.lon,
                      stopId: state.selectedStop!.id,
                    },
                    "from",
                  );
                  state.clearStop();
                }}
                onSetDestination={() => {
                  state.selectPlace(
                    {
                      label: state.selectedStop!.name,
                      lat: state.selectedStop!.lat,
                      lon: state.selectedStop!.lon,
                      stopId: state.selectedStop!.id,
                    },
                    "to",
                  );
                  state.clearStop();
                }}
              />
            </div>
          ) : state.panel === "plan" && showPlanForm ? (
            <PlanForm
              state={state}
              fromQuery={fromQuery}
              toQuery={toQuery}
              setFromQuery={setFromQuery}
              setToQuery={setToQuery}
              fromResults={fromSearch.results}
              toResults={toSearch.results}
              fromLoading={fromSearch.loading}
              toLoading={toSearch.loading}
              maxWalk={maxWalk}
              setMaxWalk={setMaxWalk}
              onOpenSearch={() => openSearch("any")}
              onPlan={() => void searchRoutes()}
              onBack={goBack}
            />
          ) : null}
        </section>
      ) : null}

      {activeTab === "nearby" && state.panel !== "stop" && (
        <DraggableSheet
          ariaLabel="Nearby stations"
          className="sheet--stations"
          withNav
          overlay
          behavior="free"
          initialSnap="half"
          snap={nearbySnap}
          onSnapChange={setNearbySnap}
        >
          <NearbyTab
            center={state.userLocation ?? state.center}
            onOpenStop={openStop}
            onLocate={() => void handleLocate()}
            locating={state.locating}
            mapPeek={nearbySnap === "peek"}
            onToggleMapView={() =>
              setNearbySnap((s) => (s === "peek" ? "half" : "peek"))
            }
          />
        </DraggableSheet>
      )}

      {activeTab === "nearby" && state.panel === "stop" && state.selectedStop && (
        <section
          className="sheet sheet--overlay sheet--with-nav sheet--stop-detail"
          aria-label="Stop"
        >
          <div className="sheet__grabber" aria-hidden="true" />
          <StopPanel
            stopId={state.selectedStop.id}
            stopName={state.selectedStop.name}
            stop={state.selectedStop}
            onClose={state.clearStop}
            onOpenLine={(id) => void openLine(id)}
            onSetOrigin={() => {
              state.selectPlace(
                {
                  label: state.selectedStop!.name,
                  lat: state.selectedStop!.lat,
                  lon: state.selectedStop!.lon,
                  stopId: state.selectedStop!.id,
                },
                "from",
              );
              state.clearStop();
              setActiveTab("directions");
            }}
            onSetDestination={() => {
              state.selectPlace(
                {
                  label: state.selectedStop!.name,
                  lat: state.selectedStop!.lat,
                  lon: state.selectedStop!.lon,
                  stopId: state.selectedStop!.id,
                },
                "to",
              );
              state.clearStop();
              setActiveTab("directions");
            }}
          />
        </section>
      )}

      {activeTab === "lines" && selectedLineId && (
        <section className="sheet sheet--overlay sheet--with-nav sheet--line-detail" aria-label="Line detail">
          <LineDetailPanel
            lineId={selectedLineId}
            onClose={() => {
              setSelectedLineId(null);
              setFocusedLineKeys([]);
              setLineGeometry(null);
            }}
            onOpenStop={openStop}
            onGeometryChange={setLineGeometry}
            onStartLineRide={(journey) => {
              if (tripActive) {
                setPendingLineRide(journey);
                setShowTripConfirm(true);
                return;
              }
              captureLiveReturn();
              startTrip(journey);
              setSelectedLineId(null);
              setFocusedLineKeys([]);
              setLineGeometry(null);
              setActiveTab("directions");
              setTripMinimized(false);
              setShowJourneyDetail(false);
              setTripFocusLegIndex(null);
              setMapUserPanned(false);
            }}
          />
        </section>
      )}

      {!tripLive && (
        <BottomNavigation
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab !== "lines") {
              setSelectedLineId(null);
              setFocusedLineKeys([]);
              setLineGeometry(null);
            }
            if (tab !== "directions" && tab !== "nearby") {
              state.clearStop();
            }
            if (tab === "nearby") {
              setNearbySnap("half");
            }
            // Return to home screen when tapping Directions from another tab
            if (tab === "directions") {
              setShowPlanForm(false);
            }
          }}
        />
      )}

      {showPreferences && (
        <PreferencesSheet
          sortMode={sortMode}
          onSortMode={(mode) => {
            setSortMode(mode);
            setShowPreferences(false);
          }}
          onClose={() => setShowPreferences(false)}
          onTransportPrefsChange={setTransportPrefs}
        />
      )}

      {showDepartSheet && (
        <DepartAtSheet onClose={() => setShowDepartSheet(false)} onSelect={handleDepartAction} />
      )}

      {showTripConfirm && (
        <ConfirmReplaceTrip
          onConfirm={handleConfirmReplaceTrip}
          onCancel={() => {
            setShowTripConfirm(false);
            setPendingLineRide(null);
          }}
        />
      )}

      {mapPickSlot && (
        <MapLocationPicker
          initialCenter={searchBias ?? state.center}
          slot={mapPickSlot}
          onCancel={() => setMapPickSlot(null)}
          onConfirm={handleMapPickConfirm}
        />
      )}

      {showSearch && (
        <GlobalSearch
          bias={searchBias}
          target={searchTarget}
          onClose={() => setShowSearch(false)}
          onChooseOnMap={() => {
            setMapPickSlot(searchTarget === "from" ? "from" : "to");
            setShowSearch(false);
          }}
          onPickCurrentLocation={() => {
            void state.useMyLocationAsOrigin().then((origin) => {
              if (origin && state.to) void searchRoutes(origin, state.to);
            });
          }}
          onPickStop={(stop) => {
            const place: Place = {
              label: stop.name,
              lat: stop.lat,
              lon: stop.lon,
              stopId: stop.id,
            };
            if (searchTarget === "from") {
              state.selectPlace(place, "from");
              if (state.to) void searchRoutes(place, state.to);
            } else if (searchTarget === "to") {
              state.selectPlace(place, "to");
              setActiveTab("directions");
              if (state.from) void searchRoutes(state.from, place);
              else {
                void state.useMyLocationAsOrigin().then((origin) => {
                  if (origin) void searchRoutes(origin, place);
                });
              }
            } else {
              openStop(stop);
            }
          }}
          onPickPlace={(place) => {
            if (searchTarget === "from") {
              state.selectPlace(place, "from");
              if (state.to) void searchRoutes(place, state.to);
            } else if (searchTarget === "to") {
              state.selectPlace(place, "to");
              setActiveTab("directions");
              if (state.from) void searchRoutes(state.from, place);
              else {
                void state.useMyLocationAsOrigin().then((origin) => {
                  if (origin) void searchRoutes(origin, place);
                });
              }
            } else {
              state.selectPlace(place, "to");
              setActiveTab("directions");
              void state.useMyLocationAsOrigin().then((origin) => {
                if (origin) void searchRoutes(origin, place);
              });
            }
          }}
          onPickLine={(line) => void openLine(line)}
        />
      )}
    </div>
  );
}

interface PlanFormProps {
  state: AppState;
  fromQuery: string;
  toQuery: string;
  setFromQuery: (v: string) => void;
  setToQuery: (v: string) => void;
  fromResults: ReturnType<typeof useStopSearch>["results"];
  toResults: ReturnType<typeof useStopSearch>["results"];
  fromLoading: boolean;
  toLoading: boolean;
  maxWalk: number;
  setMaxWalk: (v: number) => void;
  onOpenSearch: () => void;
  onPlan: () => void;
  onBack?: () => void;
}

function PlanForm({
  state,
  fromQuery,
  toQuery,
  setFromQuery,
  setToQuery,
  fromResults,
  toResults,
  fromLoading,
  toLoading,
  maxWalk,
  setMaxWalk,
  onOpenSearch,
  onPlan,
  onBack,
}: PlanFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const pick = (place: Place, slot: "from" | "to") => {
    state.selectPlace(place, slot);
    if (slot === "from") setFromQuery("");
    else setToQuery("");
  };

  return (
    <div className="planner">
      {onBack && (
        <button
          type="button"
          className="icon-button icon-button--ghost planner__back"
          onClick={onBack}
          aria-label="Back to home"
        >
          <Icon name="arrow-back" />
        </button>
      )}

      <button type="button" className="planner__hero-search" onClick={onOpenSearch}>
        <span>Where to?</span>
        <span aria-hidden="true">🔍</span>
      </button>

      <div className="planner__fields">
        <PlaceField
          id="from-field"
          label="From"
          accent="origin"
          value={state.from}
          placeholder="Where are you starting?"
          query={fromQuery}
          onQueryChange={setFromQuery}
          results={fromResults}
          searchLoading={fromLoading}
          onPick={(p) => pick(p, "from")}
          onClear={() => state.setFrom(null)}
          onUseMyLocation={async () => {
            await state.useMyLocationAsOrigin();
            setFromQuery("");
          }}
          locating={state.locating}
          recent={state.recent}
        />
        <button
          type="button"
          className="planner__swap"
          onClick={state.swapEnds}
          aria-label="Swap origin and destination"
          title="Swap"
        >
          ⇅
        </button>
        <PlaceField
          id="to-field"
          label="To"
          accent="destination"
          value={state.to}
          placeholder="Where to?"
          query={toQuery}
          onQueryChange={setToQuery}
          results={toResults}
          searchLoading={toLoading}
          onPick={(p) => pick(p, "to")}
          onClear={() => state.setTo(null)}
          recent={state.recent}
        />
      </div>

      <div className="planner__when">
        <div className="segmented" role="group" aria-label="Departure timing">
          <button
            type="button"
            className={state.when === "now" ? "is-active" : ""}
            onClick={() => state.setWhen("now")}
          >
            Leave now
          </button>
          <button
            type="button"
            className={state.when === "leave" ? "is-active" : ""}
            onClick={() => state.setWhen("leave")}
          >
            Depart at
          </button>
        </div>
        {state.when === "leave" && (
          <div className="planner__datetime">
            <input
              className="date-input"
              type="date"
              value={state.planDate}
              onChange={(e) => state.setPlanDate(e.target.value)}
              aria-label="Travel date"
            />
            <input
              className="time-input"
              type="time"
              value={state.departTime}
              onChange={(e) => state.setDepartTime(e.target.value)}
              aria-label="Departure time"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        className="planner__advanced-toggle"
        onClick={() => setShowAdvanced((v) => !v)}
        aria-expanded={showAdvanced}
      >
        {showAdvanced ? "▾" : "▸"} Advanced options
      </button>

      {showAdvanced && (
        <div className="advanced">
          <label className="advanced__row">
            <span>Maximum walking</span>
            <input
              type="range"
              min={300}
              max={3000}
              step={100}
              value={maxWalk}
              onChange={(e) => setMaxWalk(Number(e.target.value))}
            />
            <span className="advanced__value">{maxWalk} m</span>
          </label>
        </div>
      )}

      <button
        type="button"
        className="planner__go"
        disabled={!state.from || !state.to || state.plan.loading}
        onClick={onPlan}
      >
        {state.plan.loading ? "Planning…" : "Find routes"}
      </button>

      {state.plan.error && <p className="error-text">{state.plan.error}</p>}
    </div>
  );
}
