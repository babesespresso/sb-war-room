'use client';

import { useState, useEffect } from 'react';
import {
  FileText, AlertTriangle, TrendingUp, Send, Eye, Flame,
  Clock, ChevronRight, Shield, Zap, Users, BarChart3, RefreshCw
} from 'lucide-react';
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
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rapidResponseOpen, setRapidResponseOpen] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setLastRefresh(new Date());
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  return (
    <div className="min-h-screen p-3 md:p-6 pb-24 md:pb-6" style={{ background: 'var(--surface-0)' }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-8 animate-fade-in gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-mono text-shadow-glow">WAR ROOM</h1>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium font-mono"
              style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.5)' }}>
              <div className="w-1.5 h-1.5 rounded-none pulse-live" style={{ background: 'var(--campaign-green)' }} />
              LIVE
            </div>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Campaign intelligence dashboard for Scott Bottoms for Governor 2026
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }} suppressHydrationWarning>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <button onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:brightness-110"
            style={{ background: 'var(--navy-800)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setRapidResponseOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:brightness-110"
            style={{ background: 'var(--campaign-red)', color: 'white' }}>
            <Zap className="w-4 h-4" />
            Rapid Response
          </button>
        </div>
      </div>

      {/* Today's Priorities — COMMAND CENTER */}
      <div className="animate-fade-in animate-fade-in-delay-1">
        <TodaysPriorities />
      </div>

      {/* Stats Grid */}
      <div className="mt-4 md:mt-6 animate-fade-in animate-fade-in-delay-1">
        <StatsGrid refreshKey={lastRefresh.getTime()} />
      </div>

      {/* Quick Actions Bar (Sticky on Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3 pb-6 md:pb-0 md:relative md:p-0 mt-0 md:mt-6 animate-fade-in animate-fade-in-delay-2 pointer-events-none">
        <div className="pointer-events-auto hud-panel md:!bg-transparent md:!border-none md:!shadow-none md:!backdrop-filter-none rounded-2xl md:rounded-none">
          <QuickActions initialRapidResponse={rapidResponseOpen} onRapidResponseClose={() => setRapidResponseOpen(false)} />
        </div>
      </div>

      {/* MMDB & Supporter Funnel */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 mt-4 md:mt-6 animate-fade-in animate-fade-in-delay-2">
        <MMDBPulse />
        <SupporterFunnel />
      </div>

      {/* Digital Properties & Site Analytics */}
      <div className="mt-4 md:mt-6 animate-fade-in animate-fade-in-delay-2">
        <WebTrafficMonitor />
      </div>

      {/* Social Media Command — FB/IG/X Performance */}
      <div className="mt-4 md:mt-6 animate-fade-in animate-fade-in-delay-2">
        <SocialPerformance />
      </div>

      {/* Digital Perimeter Defense & Automation Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mt-4 md:mt-6 animate-fade-in animate-fade-in-delay-2">
        <div className="lg:col-span-8">
          <ThreatMonitor />
        </div>
        <div className="lg:col-span-4">
          <WorkflowMonitor />
        </div>
      </div>

      {/* Main Grid — Intel & Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mt-4 md:mt-6">
        {/* Left Column - Brief & Content */}
        <div className="col-span-1 lg:col-span-8 space-y-4 md:space-y-6">
          <div className="animate-fade-in animate-fade-in-delay-2">
            <DailyBriefPanel />
          </div>
          <div className="animate-fade-in animate-fade-in-delay-3">
            <ContentQueuePanel />
          </div>
        </div>

        {/* Right Column - Intel Feeds */}
        <div className="col-span-1 lg:col-span-4 space-y-6">
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
