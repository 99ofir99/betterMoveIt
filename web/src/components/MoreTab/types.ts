import type { AppSettings } from '../../lib/settings';
import type { TripHistoryEntry } from '../../lib/history';
import type { Place, ServiceAlert } from '../../types';
import type { ReactNode } from 'react';

export type MorePanel = 'menu' | 'settings' | 'alerts' | 'history' | 'about';

export interface MoreTabProps {
  onReplayTrip: (from: Place, to: Place) => void;
  onOpenSearch: () => void;
}

export interface MenuItemProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  accessory?: ReactNode;
  destructive?: boolean;
}

export interface MenuToggleProps {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

export interface SettingsPanelProps {
  settings: AppSettings;
  onPatch: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onBack: () => void;
}

export interface AlertsPanelProps {
  alerts: ServiceAlert[];
  loading: boolean;
  onBack: () => void;
}

export interface HistoryPanelProps {
  history: TripHistoryEntry[];
  onReplay: (from: Place, to: Place) => void;
  onRemove: (id: string) => void;
  onNewTrip: () => void;
  onBack: () => void;
}

export interface AboutPanelProps {
  onBack: () => void;
}
