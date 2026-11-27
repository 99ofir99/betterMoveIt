/** Types for the Lines tab (Moovit-style category tabs, rows). */
import type { Journey, LatLon, Line } from '../../types';

/** Line category filters applied to line lists. */
export type LineCategoryFilter = 'all' | 'bus' | 'light-rail';

/** Tabs shown in the Lines header (Favourites is a filter on saved lines). */
export type LinesTabId = 'favourites' | LineCategoryFilter;

export interface LinesTabOption {
  id: LinesTabId;
  label: string;
}

export interface LinesTabProps {
  onOpenLine: (line: Line) => void;
  /** Where to look for nearby lines: live location, else the map centre. */
  near?: LatLon | null;
  /** `near` is the user's live location (vs. the map centre). */
  nearIsLive?: boolean;
  /** The user's frequent destination and the trip planned to it from here. */
  destination?: { label: string; journey: Journey | null } | null;
}

export interface LineRowProps {
  line: Line;
  onOpen: (line: Line) => void;
  showDivider?: boolean;
}

export interface LinesSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export interface LinesCategoryTabsProps {
  tabs: LinesTabOption[];
  active: LinesTabId;
  onSelect: (id: LinesTabId) => void;
}

export interface RecentHeaderProps {
  onClear: () => void;
}

export interface LineFavButtonProps {
  favored: boolean;
  onToggle: () => void;
}

export interface LineRecentRemoveButtonProps {
  lineName: string;
  onRemove: () => void;
}
