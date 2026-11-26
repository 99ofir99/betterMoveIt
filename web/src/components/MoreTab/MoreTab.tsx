/**
 * More tab — Moovit drawer-style menu with nested panels.
 * Composition only; state lives in useMoreTab.
 */

import { BrandCard } from './BrandCard';
import { MenuItem } from './MenuItem';
import { MenuToggle } from './MenuToggle';
import { SettingsPanel } from './SettingsPanel';
import { AlertsPanel } from './AlertsPanel';
import { HistoryPanel } from './HistoryPanel';
import { AboutPanel } from './AboutPanel';
import { useMoreTab } from './useMoreTab';
import {
  AccessibilityIcon,
  BellIcon,
  CardsIcon,
  HistoryIcon,
  InfoIcon,
  MapLayersIcon,
  SettingsIcon,
} from '../shared/icons';
import type { MoreTabProps } from './types';

export function MoreTab({ onReplayTrip, onOpenSearch }: MoreTabProps) {
  const s = useMoreTab();

  if (s.panel === 'settings') {
    return <SettingsPanel settings={s.settings} onPatch={s.patch} onBack={() => s.setPanel('menu')} />;
  }
  if (s.panel === 'alerts') {
    return (
      <AlertsPanel
        alerts={s.alerts}
        loading={s.alertsLoading}
        onBack={() => s.setPanel('menu')}
      />
    );
  }
  if (s.panel === 'history') {
    return (
      <HistoryPanel
        history={s.history}
        onReplay={onReplayTrip}
        onRemove={s.removeHistory}
        onNewTrip={onOpenSearch}
        onBack={() => s.setPanel('menu')}
      />
    );
  }
  if (s.panel === 'about') {
    return <AboutPanel onBack={() => s.setPanel('menu')} />;
  }

  return (
    <div className="more-tab">
      <BrandCard />

      <div className="more-menu-group">
        <MenuToggle
          icon={<MapLayersIcon />}
          label="Live buses on map"
          checked={s.settings.showLiveBuses}
          onChange={(v) => s.patch('showLiveBuses', v)}
        />
        <MenuItem
          icon={<AccessibilityIcon />}
          label="Accessibility"
          onClick={() => s.setPanel('settings')}
          accessory={
            <span className={`more-toggle-pill${s.settings.wheelchair ? ' is-on' : ''}`}>
              {s.settings.wheelchair ? 'On' : 'Off'}
            </span>
          }
        />
        <MenuItem
          icon={<SettingsIcon />}
          label="Settings"
          onClick={() => s.setPanel('settings')}
        />
      </div>

      <p className="more-menu-section">Payment for Public Transit</p>
      <div className="more-menu-group">
        <MenuItem
          icon={<CardsIcon />}
          label="Tickets & payment"
          onClick={() =>
            window.alert(
              'BetterMoovit does not process payments. Use Rav-Kav, HopOn, or the operator app.'
            )
          }
        />
      </div>

      <div className="more-menu-group">
        <MenuItem
          icon={<BellIcon />}
          label="Service alerts"
          onClick={() => s.setPanel('alerts')}
          accessory={
            !s.alertsLoading && s.alerts.length > 0 ? (
              <span className="more-badge">{s.alerts.length}</span>
            ) : undefined
          }
        />
        <MenuItem
          icon={<HistoryIcon />}
          label="Trip history"
          onClick={() => s.setPanel('history')}
        />
        <MenuItem icon={<InfoIcon />} label="About" onClick={() => s.setPanel('about')} />
      </div>
    </div>
  );
}
