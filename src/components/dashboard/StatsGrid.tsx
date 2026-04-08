'use client';

import { useState, useEffect } from 'react';
import { FileText, AlertTriangle, TrendingUp, Send, Eye, Users } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';

interface StatCard {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: any;
  color: string;
  tooltip: string;
}

export default function StatsGrid({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const res = await fetch('/api/intel?type=dashboard');
        if (res.ok) {
          const data = await res.json();
          setStats([
            {
              label: 'Pending Review',
              value: data.pendingContent || 0,
              icon: FileText,
              color: 'var(--campaign-gold)',
              tooltip: 'Number of AI-generated content drafts waiting for your approval before publishing.',
            },
            {
              label: 'Published Today',
              value: data.publishedToday || 0,
              icon: Send,
              color: 'var(--campaign-green)',
              tooltip: 'Total pieces of content approved and published to social platforms today.',
            },
            {
              label: 'Competitor Alerts',
              value: data.competitorAlerts || 0,
              icon: AlertTriangle,
              color: data.competitorAlerts > 0 ? 'var(--campaign-red)' : 'var(--text-muted)',
              tooltip: 'New activities detected from tracked competitor campaigns that may require a response.',
            },
            data.totalFollowers !== undefined ? {
              label: 'Total X Followers',
              value: data.totalFollowers.toLocaleString(),
              change: 'live API connection',
              changeType: 'positive',
              icon: Users,
              color: 'var(--campaign-blue)',
              tooltip: 'Real-time total follower count directly from the connected X (Twitter) API.',
            } : {
              label: 'Follower Growth',
              value: data.followerGrowth > 0 ? `+${data.followerGrowth}` : data.followerGrowth || '0',
              change: 'today',
              changeType: data.followerGrowth > 0 ? 'positive' : 'neutral',
              icon: Users,
              color: 'var(--navy-400)',
              tooltip: 'Net change in social media followers across all connected platforms today.',
            },
          ]);
        }
      } catch (err) {
        // Use placeholder stats on error
        setStats([
          { label: 'Pending Review', value: '--', icon: FileText, color: 'var(--campaign-gold)', tooltip: 'Number of AI-generated content drafts waiting for your approval.' },
          { label: 'Published Today', value: '--', icon: Send, color: 'var(--campaign-green)', tooltip: 'Total pieces of content published today.' },
          { label: 'Competitor Alerts', value: '--', icon: AlertTriangle, color: 'var(--text-muted)', tooltip: 'New activities from tracked competitor campaigns.' },
          { label: 'Follower Growth', value: '--', icon: Users, color: 'var(--navy-400)', tooltip: 'Net change in social media followers today.' },
        ]);
      }
      setLoading(false);
    }
    fetchStats();
  }, [refreshKey]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div key={i} className="stat-card rounded-xl p-5 md:p-6 glass-panel relative border-t-[3px]" style={{ borderTopColor: stat.color }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1 text-slate-400">
                  {stat.label}
                  <InfoTooltip text={stat.tooltip} />
                </p>
                <p className={`text-4xl md:text-5xl font-mono font-bold tracking-tighter mt-1 ${stat.color.includes('green') ? 'text-shadow-green' : stat.color.includes('red') ? 'text-shadow-red' : stat.color.includes('gold') ? 'text-shadow-gold' : stat.color.includes('blue') ? 'text-shadow-blue' : 'text-shadow-glow'}`} style={{ color: stat.color }}>
                  {loading ? (
                    <span className="inline-block w-12 h-8 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
                  ) : stat.value}
                </p>
                {stat.change && (
                  <p className="text-xs mt-1" style={{
                    color: stat.changeType === 'positive' ? 'var(--campaign-green)' :
                      stat.changeType === 'negative' ? 'var(--campaign-red)' : 'var(--text-muted)'
                  }}>
                    {stat.change}
                  </p>
                )}
              </div>
              <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}30` }}>
                <Icon className="w-5 h-5" style={{ color: stat.color, filter: `drop-shadow(0 0 8px ${stat.color}60)` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
