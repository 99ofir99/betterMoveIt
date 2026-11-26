/**
 * Feature inventory.
 *
 * Core transit features focused on real-time bus tracking and trip planning.
 * No AI, no gimmicks - just the essential tools for getting around.
 */

export type FeatureStatus = "live" | "partial" | "planned";

export interface Feature {
  id: string;
  group: string;
  name: string;
  description: string;
  status: FeatureStatus;
}

/**
 * Essential transit features - everything you need, nothing you don't.
 */
export const ALL_FEATURES: Feature[] = [
  {
    id: "planner",
    group: "Core",
    name: "Trip planning",
    description:
      "Door-to-door journeys across bus, rail, tram, and walking with real transfer times.",
    status: "live",
  },
  {
    id: "departures",
    group: "Core",
    name: "Live departure boards",
    description: "Every line serving a stop with its next three departures.",
    status: "live",
  },
  {
    id: "stops",
    group: "Core",
    name: "Stop search and map",
    description: "Find any stop by name or tap the map to explore nearby.",
    status: "live",
  },

  // ---- the 16 gated packages
  {
    id: "trip_plan_sort",
    group: "Core",
    name: "Route sorting",
    description: "Compare routes by speed, transfers, or walking distance.",
    status: "live",
  },
  {
    id: "advanced_time_picker",
    group: "Core",
    name: "Time planning",
    description: 'Plan trips for any departure or arrival time, not just "now".',
    status: "live",
  },
  {
    id: "trip_insights",
    group: "Core",
    name: "Journey details",
    description: "See total time, walking distance, and number of transfers for each route.",
    status: "live",
  },
  {
    id: "trip_on_map",
    group: "Core",
    name: "Route visualization",
    description: "See your complete route on the map with all stops and walking segments.",
    status: "live",
  },
  {
    id: "vehicle_on_map",
    group: "Core",
    name: "Live bus locations",
    description: "Live vehicle markers on the map for your favourite lines.",
    status: "live",
  },
  {
    id: "favorites",
    group: "Core",
    name: "Favorites",
    description: "Home, Work, saved stops and lines for one-tap access.",
    status: "live",
  },
  {
    id: "lines_tab",
    group: "Core",
    name: "Lines + schedule",
    description: "Search lines and open stop-by-stop upcoming departures.",
    status: "live",
  },
  {
    id: "nearby_tab",
    group: "Core",
    name: "Nearby with departures",
    description: "Stops around you with next buses on each card.",
    status: "live",
  },
  {
    id: "global_search",
    group: "Core",
    name: "Global search",
    description: "Search stops and lines together, with favorites and recent trips.",
    status: "live",
  },
  {
    id: "trip_history",
    group: "Core",
    name: "Trip history",
    description: "Automatically save planned trips and replay them from More.",
    status: "live",
  },
  {
    id: "accessibility",
    group: "Core",
    name: "Accessibility prefs",
    description: "Wheelchair preference and walking distance controls in More.",
    status: "partial",
  },
  {
    id: "compare_on_map",
    group: "Core",
    name: "Route comparison",
    description: "View multiple route options simultaneously on the map.",
    status: "partial",
  },
  {
    id: "trip_notifications",
    group: "Enhancements",
    name: "Trip alerts",
    description: "Get notified when your bus is approaching or if there are delays.",
    status: "planned",
  },
  {
    id: "share_ride",
    group: "Enhancements",
    name: "Share trips",
    description: "Send your route to others so they can follow the same journey.",
    status: "partial",
  },
];
