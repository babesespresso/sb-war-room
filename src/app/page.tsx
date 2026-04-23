'use client';

import { useEffect, useState } from 'react';
import StatsGrid from '@/components/dashboard/StatsGrid';
import DailyBriefPanel from '@/components/dashboard/DailyBriefPanel';
import ContentQueuePanel from '@/components/dashboard/ContentQueuePanel';
import CompetitorFeed from '@/components/dashboard/CompetitorFeed';
import HeatMap from '@/components/dashboard/HeatMap';
import QuickActions from '@/components/dashboard/QuickActions';
import NewsFeed from '@/components/dashboard/NewsFeed';
import ThreatMonitor from '@/components/dashboard/ThreatMonitor';
import MMDBPulse from '@/components/dashboard/MMDBPulse';
import TodaysPriorities from '@/components/dashboard/TodaysPriorities';
import SupporterFunnel from '@/components/dashboard/SupporterFunnel';
import WorkflowMonitor from '@/components/dashboard/WorkflowMonitor';
import WebTrafficMonitor from '@/components/dashboard/WebTrafficMonitor';
import SocialPerformance from '@/components/dashboard/SocialPerformance';

export default function WarRoom() {
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [rapidOpen, setRapidOpen] = useState(false);

  // Listen for TopBar global events
  useEffect(() => {
    const onRefresh = () => setRefreshKey(Date.now());
    const onRapid = () => setRapidOpen(true);
    window.addEventListener('warroom:refresh', onRefresh);
    window.addEventListener('warroom:rapid-response', onRapid);
    return () => {
      window.removeEventListener('warroom:refresh', onRefresh);
      window.removeEventListener('warroom:rapid-response', onRapid);
    };
  }, []);

  // Honor ?rr=1 coming from other pages via the global Rapid Response hotkey/button.
  // Read from window to avoid the Next 15 useSearchParams Suspense requirement.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('rr') === '1') setRapidOpen(true);
  }, []);

  return (
    <div
      style={{
        padding: 'var(--pad-section)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--gap)',
        background: 'var(--bg-0)',
        minHeight: '100%',
      }}
    >
      {/* Page eyebrow + title */}
      <header style={{ marginBottom: 4 }}>
        <div className="wb-eyebrow" style={{ marginBottom: 6 }}>Command center</div>
        <h1 className="wb-h-display" style={{ margin: 0, fontSize: 32, lineHeight: 1.1, color: 'var(--ink-0)' }}>
          Today at a glance
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-2)', maxWidth: 720 }}>
          Scott Bottoms for Colorado Governor · 2026 GOP primary. Live intelligence, draft queue, and competitor signals.
        </p>
      </header>

      {/* Hero: priorities */}
      <div className="animate-fade-in animate-fade-in-delay-1">
        <TodaysPriorities />
      </div>

      {/* Stats */}
      <div className="animate-fade-in animate-fade-in-delay-1">
        <StatsGrid refreshKey={refreshKey} />
      </div>

      {/* Quick Actions (includes RapidResponse modal) */}
      <div className="fixed bottom-16 left-0 right-0 z-40 p-3 md:relative md:bottom-auto md:p-0 pointer-events-none">
        <div className="pointer-events-auto">
          <QuickActions
            initialRapidResponse={rapidOpen}
            onRapidResponseClose={() => setRapidOpen(false)}
          />
        </div>
      </div>

      {/* Supporter pulse */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 animate-fade-in animate-fade-in-delay-2">
        <MMDBPulse />
        <SupporterFunnel />
      </div>

      {/* Web + social perf */}
      <div className="animate-fade-in animate-fade-in-delay-2">
        <WebTrafficMonitor />
      </div>
      <div className="animate-fade-in animate-fade-in-delay-2">
        <SocialPerformance />
      </div>

      {/* Threat + automations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 animate-fade-in animate-fade-in-delay-2">
        <div className="lg:col-span-8">
          <ThreatMonitor />
        </div>
        <div className="lg:col-span-4">
          <WorkflowMonitor />
        </div>
      </div>

      {/* Main grid — Brief + Queue left, Intel rail right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        <div className="lg:col-span-8 space-y-4 md:space-y-6 min-w-0">
          <div className="animate-fade-in animate-fade-in-delay-2">
            <DailyBriefPanel />
          </div>
          <div className="animate-fade-in animate-fade-in-delay-3">
            <ContentQueuePanel />
          </div>
        </div>
        <div className="lg:col-span-4 space-y-4 md:space-y-6">
          <div className="animate-fade-in animate-fade-in-delay-2">
            <HeatMap />
          </div>
          <div className="animate-fade-in animate-fade-in-delay-3">
            <CompetitorFeed />
          </div>
          <div className="animate-fade-in animate-fade-in-delay-4">
            <NewsFeed />
          </div>
        </div>
      </div>
    </div>
  );
}
