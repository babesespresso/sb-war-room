'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Eye, Heart, Loader2 } from 'lucide-react';
import XIcon from '@/components/icons/XIcon';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import MarketOddsChart from '@/components/analytics/MarketOddsChart';

interface SocialData {
  connected: boolean;
  handle?: string;
  name?: string;
  profileImage?: string;
  stats?: {
    followers: number;
    following: number;
    totalTweets: number;
    estimatedReach: number;
    estimatedEngagements: number;
    avgEngagementRate: number;
    followerGrowth: number;
  };
  engagementData?: { date: string; impressions: number; engagements: number; tweets: number; followerChange: number }[];
  error?: string;
}

export default function AnalyticsPage() {
  const [social, setSocial] = useState<SocialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('all');

  useEffect(() => {
    async function fetchSocial() {
      try {
        const res = await fetch('/api/analytics/social');
        if (res.ok) setSocial(await res.json());
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    fetchSocial();
  }, []);

  const platforms = ['all', 'twitter', 'facebook', 'instagram', 'email'];
  const stats = social?.stats;

  const cards = [
    { label: 'Total Reach', value: stats ? stats.estimatedReach.toLocaleString() : '--', icon: Eye, color: '#60a5fa' },
    { label: 'Engagements', value: stats ? stats.estimatedEngagements.toLocaleString() : '--', icon: Heart, color: 'var(--campaign-red)' },
    { label: 'Follower Growth', value: stats ? (stats.followerGrowth >= 0 ? '+' : '') + stats.followerGrowth.toLocaleString() : '--', icon: Users, color: 'var(--campaign-green)' },
    { label: 'Avg Engagement Rate', value: stats ? stats.avgEngagementRate + '%' : '--', icon: TrendingUp, color: 'var(--campaign-gold)' },
  ];

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--surface-0)' }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">Analytics <InfoTooltip text="Campaign performance dashboard showing social media reach, engagement rates, follower growth, and AI agent activity across all connected platforms." /></h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Campaign performance and engagement metrics</p>
        </div>
        <div className="flex items-center gap-4">
          {social?.connected && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
              <XIcon className="w-3.5 h-3.5" />
              {social.handle} connected
            </div>
          )}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface-1)' }}>
            {platforms.map((p) => (
              <button key={p} onClick={() => setPlatform(p)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: platform === p ? 'var(--navy-800)' : 'transparent',
                  color: platform === p ? 'white' : 'var(--text-muted)',
                }}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="stat-card p-5 rounded-xl"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
                  ) : (
                    <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
                  )}
                </div>
                <div className="p-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Prediction Markets Chart */}
      <MarketOddsChart />

      {/* Engagement Over Time — LIVE */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
        <div className="p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-lg font-bold flex items-center gap-1.5">Engagement Over Time <InfoTooltip text="Daily impressions and engagement interactions pulled from the X API. Shows how campaign content is performing over the last 14 days." /></h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Daily impressions and engagements from X — @{social?.handle || 'ScottBottomsCO'}
          </p>
        </div>
        <div className="p-6 h-[300px]">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : social?.engagementData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={social.engagementData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorEngagements" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12}
                  tickFormatter={(val) => { const d = new Date(val); return `${d.getMonth()+1}/${d.getDate()}`; }}
                />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '13px', paddingTop: '4px' }}
                  labelStyle={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '12px' }}
                  labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                />
                <Area type="monotone" dataKey="impressions" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorImpressions)" name="Impressions" />
                <Area type="monotone" dataKey="engagements" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorEngagements)" name="Engagements" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center">
              <BarChart3 className="w-12 h-12 mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Connect social APIs in Settings to see engagement data.</p>
            </div>
          )}
        </div>
      </div>

      {/* Account Summary */}
      {social?.connected && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Followers', value: stats.followers.toLocaleString(), color: '#3b82f6' },
            { label: 'Following', value: stats.following.toLocaleString(), color: 'var(--text-muted)' },
            { label: 'Total Tweets', value: stats.totalTweets.toLocaleString(), color: '#f59e0b' },
            { label: 'Platform', value: 'X', color: '#10b981' },
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
              <p className="text-lg font-bold mt-1" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Agent Runs */}
      <div className="rounded-xl p-6" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-1.5">Recent Agent Activity <InfoTooltip text="Log of automated AI agent runs including daily briefs, news scanning, competitor monitoring, and sentiment analysis. Shows status and duration of each run." /></h2>
        <AgentRunsList />
      </div>
    </div>
  );
}

function AgentRunsList() {
  const [runs, setRuns] = useState<any[]>([]);

  useEffect(() => {
    async function fetchRuns() {
      try {
        const res = await fetch('/api/content?view=agent_runs');
        if (res.ok) setRuns(await res.json());
      } catch (err) { console.error(err); }
    }
    fetchRuns();
  }, []);

  if (runs.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No agent runs recorded yet.</p>;
  }

  return (
    <div className="space-y-2">
      {runs.slice(0, 10).map((run) => (
        <div key={run.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--surface-2)' }}>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${
              run.status === 'completed' ? '' : run.status === 'running' ? 'pulse-live' : ''
            }`} style={{
              background: run.status === 'completed' ? 'var(--campaign-green)' :
                run.status === 'running' ? 'var(--campaign-gold)' : 'var(--campaign-red)',
            }} />
            <span className="text-sm font-medium">{run.agent_name?.replaceAll('_', ' ')}</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-0)', color: 'var(--text-muted)' }}>
              {run.run_type}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{run.items_processed || 0} processed</span>
            <span>{run.tokens_input || 0} tokens in</span>
            <span>${(run.api_cost || 0).toFixed(4)}</span>
            <span>{new Date(run.started_at).toLocaleTimeString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
