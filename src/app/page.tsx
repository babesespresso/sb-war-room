'use client';

/**
 * War Room — Command Center (home)
 *
 * Endpoints called directly: none. Composition page — each imported
 * dashboard panel owns its own fetching. Indirect contracts (via children):
 *   /api/intel?type=dashboard        → StatsGrid, QuickActions
 *   /api/intel?type=brief            → DailyBriefPanel
 *   /api/intel?type=competitors      → CompetitorFeed
 *   /api/intel?type=activities       → CompetitorFeed
 *   /api/intel?type=news             → NewsFeed
 *   /api/intel?type=heatmap          → HeatMap
 *   /api/content                     → ContentQueuePanel, WorkflowMonitor
 *   /api/analytics/threats           → ThreatMonitor
 *   /api/analytics/website           → WebTrafficMonitor
 *   /api/analytics/social            → SocialPerformance
 *   /api/analytics/mmdb*             → MMDBPulse, SupporterFunnel
 *   /api/analytics/priorities        → TodaysPriorities
 *
 * Preserves: existing panel composition, global refresh + rapid-response event
 * wiring (warroom:refresh / warroom:rapid-response from TopBar), ?rr=1 deep
 * link, and all panel-level animate-fade-in classes.
 */

import { useEffect, useState } from 'react';
import { Activity, Radio } from 'lucide-react';

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

interface Freshness {
  age_minutes?: {
    news?: number | null;
    competitor?: number | null;
    sentiment?: number | null;
    daily_brief?: number | null;
  };
}

export default function WarRoomHome() {
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [rapidOpen, setRapidOpen] = useState(false);
  const [freshness, setFreshness] = useState<Freshness | null>(null);

  // TopBar global events
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

  // ?rr=1 deep link from other pages
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('rr') === '1') setRapidOpen(true);
  }, []);

  // Lightweight staleness indicator for the command strip
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/intel?type=dashboard');
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled && data?.freshness) setFreshness(data.freshness);
      } catch { /* ignore */ }
    };
    load();
    const i = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(i); };
  }, [refreshKey]);

  const freshLabel = (mins?: number | null) => {
    if (mins == null) return '—';
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

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
      {/* ── Command strip ───────────────────────────────────────── */}
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="wb-eyebrow" style={{ marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span className="wb-pulse" />
            Command center · war room · live
          </div>
          <h1 className="wb-h-display" style={{ margin: 0, fontSize: 32, lineHeight: 1.1, color: 'var(--ink-0)' }}>
            Today at a glance
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-2)', maxWidth: 720 }}>
            Scott Bottoms for Colorado Governor · 2026 GOP primary. Live intelligence, draft queue, and competitor signals.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="wb-chip">
            <Activity size={11} /> news {freshLabel(freshness?.age_minutes?.news)}
          </span>
          <span className="wb-chip">
            <Radio size={11} /> intel {freshLabel(freshness?.age_minutes?.competitor)}
          </span>
          <span className="wb-chip info">
            brief {freshLabel(freshness?.age_minutes?.daily_brief)}
          </span>
        </div>
      </header>

      {/* ── Hero: today's priorities ────────────────────────────── */}
      <div className="animate-fade-in animate-fade-in-delay-1">
        <TodaysPriorities />
      </div>

      {/* ── Stats rail ──────────────────────────────────────────── */}
      <div className="animate-fade-in animate-fade-in-delay-1">
        <StatsGrid refreshKey={refreshKey} />
      </div>

      {/* ── Quick Actions (floating on mobile, inline on desktop) */}
      <div className="fixed bottom-16 left-0 right-0 z-40 p-3 md:relative md:bottom-auto md:p-0 pointer-events-none">
        <div className="pointer-events-auto">
          <QuickActions
            initialRapidResponse={rapidOpen}
            onRapidResponseClose={() => setRapidOpen(false)}
          />
        </div>
      </div>

      {/* ── Supporter pulse ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 animate-fade-in animate-fade-in-delay-2">
        <MMDBPulse />
        <SupporterFunnel />
      </div>

      {/* ── Traffic + social ────────────────────────────────────── */}
      <div className="animate-fade-in animate-fade-in-delay-2">
        <WebTrafficMonitor />
      </div>
      <div className="animate-fade-in animate-fade-in-delay-2">
        <SocialPerformance />
      </div>

      {/* ── Threats + workflow ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 animate-fade-in animate-fade-in-delay-2">
        <div className="lg:col-span-8">
          <ThreatMonitor />
        </div>
        <div className="lg:col-span-4">
          <WorkflowMonitor />
        </div>
      </div>

      {/* ── Brief + queue + intel rail ──────────────────────────── */}
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
