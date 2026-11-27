import type { Journey, Place } from '../../types';
import type { SortMode } from '../../lib/sort';
import type { TransportPrefs } from '../../lib/settings';
import type { IconName } from '../icons/types';

// ── Results chrome ───────────────────────────────────────────────────────────

export interface ResultsHeaderProps {
  from: Place | null | undefined;
  to: Place | null | undefined;
  fromIsCurrentLocation: boolean;
  onBack: () => void;
  onSwap: () => void;
  onEditFrom: () => void;
  onEditTo: () => void;
  onOpenPreferences: () => void;
  prefsBadgeCount?: number;
}

export interface SortChip {
  mode: SortMode;
  label: string;
  icon: IconName;
}

export interface ResultsToolbarProps {
  departLabel: string;
  onOpenDepartSheet: () => void;
  mapPeek: boolean;
  onToggleMapView: () => void;
  sortMode: SortMode;
  onSortMode: (mode: SortMode) => void;
}

// ── Preferences ──────────────────────────────────────────────────────────────

export interface RouteOption {
  mode: SortMode;
  label: string;
  icon: IconName;
}

export interface TransportOption {
  key: keyof TransportPrefs;
  label: string;
  icon: IconName;
}

export interface PreferencesSheetProps {
  sortMode: SortMode;
  onSortMode: (mode: SortMode) => void;
  onClose: () => void;
  onTransportPrefsChange?: (prefs: TransportPrefs) => void;
}

// ── Best time to leave ───────────────────────────────────────────────────────

export interface BestTimeBar {
  id: number;
  label: string;
  durationMin: number;
  /** 0–1, taller = shorter trip. */
  height: number;
  isBest: boolean;
}

export interface BestTimeCardProps {
  journeys: readonly Journey[];
  onDismiss: () => void;
}

// ── Depart-at sheet ──────────────────────────────────────────────────────────

export type DepartAtAction =
  | { type: 'now' }
  | { type: 'departAt'; time: string; date?: string }
  | { type: 'arriveBy'; time: string; date?: string }
  | { type: 'latest' }
  | { type: 'plus15' };

export interface DepartAtSheetProps {
  onClose: () => void;
  onSelect: (action: DepartAtAction) => void;
  /** Open on a time form instead of the menu (home card clock chip). */
  startMode?: Exclude<DepartSheetMode, 'menu'>;
}

export type DepartSheetMode = 'menu' | 'depart' | 'arrive';

export interface DepartTimeFormProps {
  mode: Exclude<DepartSheetMode, 'menu'>;
  /** When set, the form shows a Depart at / Arrive by switch. */
  onModeChange?: (mode: Exclude<DepartSheetMode, 'menu'>) => void;
  onBack: () => void;
  onApply: (action: DepartAtAction) => void;
}
