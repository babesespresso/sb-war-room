'use client';

/**
 * Analytics — reach, engagement, prediction markets, and agent activity.
 *
 * Endpoints called:
 *   GET /api/analytics/social         → social stats + 14-day engagement series
 *   GET /api/content?view=agent_runs  → recent agent activity
 *   (MarketOddsChart internally fetches /api/analytics/markets — Kalshi-backed)
 *
 * Preserves: Recharts AreaChart for 14-day impressions/engagements, platform
 * filter chips, MarketOddsChart component (Kalshi prediction-market signal),
 * X-connection badge, recent agent-runs footer.
 */

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Eye, Heart, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import XIcon from '@/components/icons/XIcon';
import InfoTooltip from '@/components/ui/InfoTooltip';
import MarketOddsChart from '@/components/analytics/MarketOddsChart';
import PageHeader from '@/components/layout/PageHeader';

interface EngagementPoint { date: string; impressions: number; engagements: number; tweets: number; followerChange: number }
interface SocialStats {
  followers: number; following: number; totalTweets: number;
  estimatedReach: number; estimatedEngagements: number;
  avgEngagementRate: number; followerGrowth: number;
}
interface SocialData {
  connected: boolean;
  handle?: string; name?: string;
  stats?: SocialStats;
  engagementData?: EngagementPoint[];
  error?: string;
}
interface AgentRun {
  id: string; agent_name: string; status: string; run_type?: string;
  items_processed?: number; tokens_input?: number; api_cost?: number; started_at: string;
}

const PLATFORMS = ['all', 'twitter', 'facebook', 'instagram', 'email'];

export default function AnalyticsPage() {
  const [social, setSocial] = useState<SocialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/analytics/social');
        if (res.ok && !cancelled) setSocial(await res.json());
      } catch (e) { console.error(e); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = social?.stats;
  const cards = [
    { label: 'Total reach',        value: stats ? stats.estimatedReach.toLocaleString() : '—',                                  icon: Eye,         color: '#60a5fa' },
    { label: 'Engagements',        value: stats ? stats.estimatedEngagements.toLocaleString() : '—',                            icon: Heart,       color: 'var(--accent)' },
    { label: 'Follower growth',    value: stats ? (stats.followerGrowth >= 0 ? '+' : '') + stats.followerGrowth.toLocaleString() : '—', icon: Users,  color: 'var(--ok)' },
    { label: 'Avg engagement rate',value: stats ? stats.avgEngagementRate + '%' : '—',                                          icon: TrendingUp,  color: 'var(--warn)' },
  ];

  return (
    <div style={{ padding: 'var(--pad-section)', display: 'flex', flexDirection: 'column', gap: 'var(--gap)', background: 'var(--bg-0)' }}>
      <PageHeader
        eyebrow="Intelligence · Reach & velocity"
        title={<>Analytics <InfoTooltip text="Campaign performance dashboard showing social media reach, engagement rates, follower growth, and AI agent activity across all connected platforms." /></>}
        subtitle="Campaign performance and engagement metrics."
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {social?.connected && (
              <span className="wb-chip" style={{ color: 'var(--ok)', borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)' }}>
                <XIcon className="w-3 h-3" /> {social.handle} connected
              </span>
            )}
            <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
              {PLATFORMS.map(p => (
                <button key={p} onClick={() => setPlatform(p)} style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                  background: platform === p ? 'var(--accent)' : 'transparent',
                  color: platform === p ? 'white' : 'var(--ink-2)',
                  border: 0, cursor: 'pointer',
                }}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="wb-panel" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div className="wb-eyebrow" style={{ marginBottom: 8 }}>{c.label}</div>
                  {loading
                    ? <Loader2 size={18} className="animate-spin" style={{ color: 'var(--ink-2)' }} />
                    : <div style={{ fontSize: 26, fontWeight: 700, color: c.color, letterSpacing: '-0.02em' }}>{c.value}</div>}
                </div>
                <div style={{ padding: 8, borderRadius: 8, background: 'var(--bg-2)' }}>
                  <Icon size={18} style={{ color: c.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Prediction markets (Kalshi) */}
      <MarketOddsChart />

      {/* Engagement over time */}
      <div className="wb-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--line)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Engagement over time <InfoTooltip text="Daily impressions and engagement interactions pulled from the X API. Shows how campaign content is performing over the last 14 days." />
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-2)' }}>
            Daily impressions and engagements from X — @{social?.handle || 'ScottBottomsCO'}
          </p>
        </div>
        <div style={{ padding: 24, height: 320 }}>
          {loading ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={22} className="animate-spin" style={{ color: 'var(--ink-2)' }} />
            </div>
          ) : social?.engagementData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={social.engagementData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorEngagements" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--ink-2)" fontSize={11}
                  tickFormatter={(v) => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
                <YAxis stroke="var(--ink-2)" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-2)', borderColor: 'var(--line)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'var(--ink-2)', marginBottom: 6, fontSize: 11 }}
                  labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                />
                <Area type="monotone" dataKey="impressions" stroke="#3b82f6" strokeWidth={2} fill="url(#colorImpressions)" name="Impressions" />
                <Area type="monotone" dataKey="engagements" stroke="#ef4444" strokeWidth={2} fill="url(#colorEngagements)" name="Engagements" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <BarChart3 size={40} style={{ color: 'var(--ink-2)', marginBottom: 10 }} />
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>Connect social APIs in Settings to see engagement data.</p>
            </div>
          )}
        </div>
      </div>

      {/* Account summary */}
      {social?.connected && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Followers',     value: stats.followers.toLocaleString(),     color: '#3b82f6' },
            { label: 'Following',     value: stats.following.toLocaleString(),     color: 'var(--ink-2)' },
            { label: 'Total tweets',  value: stats.totalTweets.toLocaleString(),   color: 'var(--warn)' },
            { label: 'Platform',      value: 'X',                                  color: 'var(--ok)' },
          ].map((x, i) => (
            <div key={i} className="wb-panel" style={{ padding: 16 }}>
              <div className="wb-eyebrow">{x.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: x.color, marginTop: 4 }}>{x.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Agent runs */}
      <div className="wb-panel" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Recent agent activity <InfoTooltip text="Log of automated AI agent runs including daily briefs, news scanning, competitor monitoring, and sentiment analysis." />
        </h2>
        <AgentRunsList />
      </div>
    </div>
  );
}

function AgentRunsList() {
  const [runs, setRuns] = useState<AgentRun[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/content?view=agent_runs');
        if (r.ok && !cancelled) setRuns(await r.json());
      } catch (e) { console.error(e); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (runs.length === 0) {
    return <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>No agent runs recorded yet.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {runs.slice(0, 10).map(run => (
        <div key={run.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 8, background: 'var(--bg-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%',
              background: run.status === 'completed' ? 'var(--ok)' : run.status === 'running' ? 'var(--warn)' : 'var(--bad)' }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{run.agent_name?.replaceAll('_', ' ')}</span>
            {run.run_type && (
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-0)', color: 'var(--ink-2)' }}>
                {run.run_type}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--ink-2)' }}>
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
