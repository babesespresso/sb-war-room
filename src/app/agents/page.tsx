'use client';

/**
 * Agents — control surface for the AI fleet that runs the campaign.
 *
 * Endpoints called:
 *   GET  /api/content?view=agent_runs   → agent_runs[]
 *   GET  /api/cron?agent=<name>         → manual trigger (requires Bearer, dev-safe default)
 *   (status view also available via GET /api/agents/status — see route.ts for schema)
 *
 * Preserves: manual "Run Now" trigger, live cost + token totals, per-agent
 * last-run panel, full run history log.
 */

import { useEffect, useState } from 'react';
import { Play, CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import PageHeader from '@/components/layout/PageHeader';

interface AgentRun {
  id: string;
  agent_name: string;
  status: 'completed' | 'failed' | 'running';
  run_type?: string;
  started_at: string;
  completed_at?: string | null;
  items_processed?: number;
  items_created?: number;
  tokens_input?: number;
  tokens_output?: number;
  api_cost?: number;
  error_message?: string;
}

const AGENTS = [
  { name: 'competitor_monitor',  label: 'Competitor Monitor',  schedule: 'Every 4 hours', color: '#f87171' },
  { name: 'news_pulse',          label: 'News Pulse',          schedule: 'Every 2 hours', color: '#60a5fa' },
  { name: 'daily_brief',         label: 'Daily Brief',         schedule: '6:30 AM MT',    color: '#f59e0b' },
  { name: 'content_generator',   label: 'Content Generator',   schedule: 'On demand',     color: '#10b981' },
  { name: 'rapid_response',      label: 'Rapid Response',      schedule: 'Triggered',     color: '#ef4444' },
  { name: 'sentiment_analyzer',  label: 'Sentiment Analyzer',  schedule: 'Every 6 hours', color: '#8b5cf6' },
];

export default function AgentsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fetchRuns = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/content?view=agent_runs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AgentRun[] = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e.message || 'Failed to load agent runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRuns(); }, []);

  // Wire to global refresh
  useEffect(() => {
    const h = () => fetchRuns();
    window.addEventListener('warroom:refresh', h);
    return () => window.removeEventListener('warroom:refresh', h);
  }, []);

  const triggerAgent = async (name: string) => {
    setTriggering(name);
    try {
      const secret = process.env.NEXT_PUBLIC_CRON_SECRET || 'dev';
      await fetch(`/api/cron?agent=${name}`, { headers: { Authorization: `Bearer ${secret}` } });
      setTimeout(fetchRuns, 2000);
    } catch (e) { console.error(e); }
    finally { setTriggering(null); }
  };

  const getLastRun = (n: string) => runs.find(r => r.agent_name === n);

  const totalCost   = runs.reduce((s, r) => s + (r.api_cost || 0), 0);
  const totalTokens = runs.reduce((s, r) => s + (r.tokens_input || 0) + (r.tokens_output || 0), 0);
  const totalRuns   = runs.length;

  return (
    <div style={{ padding: 'var(--pad-section)', display: 'flex', flexDirection: 'column', gap: 'var(--gap)', background: 'var(--bg-0)' }}>
      <PageHeader
        eyebrow="System · Agent fleet"
        title={<>Agent Status <InfoTooltip text="Control center for all AI agents powering the campaign. Each runs on a schedule to monitor competitors, scan news, generate content, and analyze sentiment." /></>}
        subtitle="Monitor and manage campaign intelligence agents."
        actions={
          <button onClick={fetchRuns} className="wb-btn" style={{ background: 'var(--bg-2)' }} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {err && (
        <div className="wb-panel" style={{ padding: 12, borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5', display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={14} /> {err}
        </div>
      )}

      {/* Cost summary ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CostTile label="Total API cost" value={`$${totalCost.toFixed(4)}`} tone="gold" />
        <CostTile label="Total tokens"   value={totalTokens.toLocaleString()} tone="blue" />
        <CostTile label="Total runs"     value={String(totalRuns)} tone="green" />
      </div>

      {/* Agent cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {AGENTS.map(agent => {
          const lastRun = getLastRun(agent.name);
          const Icon = lastRun?.status === 'completed' ? CheckCircle
                     : lastRun?.status === 'failed'    ? XCircle
                     : lastRun?.status === 'running'   ? RefreshCw
                     : Clock;
          const isRunning = triggering === agent.name;
          return (
            <div key={agent.name} className="wb-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: agent.color, boxShadow: `0 0 0 3px ${agent.color}22` }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{agent.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>{agent.schedule}</div>
                  </div>
                </div>
                <button onClick={() => triggerAgent(agent.name)} disabled={isRunning} className="wb-btn" style={{ fontSize: 11 }}>
                  {isRunning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />} Run now
                </button>
              </div>

              {lastRun ? (
                <div style={{ background: 'var(--bg-2)', padding: 12, borderRadius: 8, border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500 }}>
                      <Icon size={13} style={{
                        color: lastRun.status === 'completed' ? 'var(--ok)'
                             : lastRun.status === 'failed'    ? 'var(--bad)'
                             : 'var(--warn)'
                      }} />
                      {lastRun.status === 'completed' ? 'Last run successful'
                        : lastRun.status === 'failed' ? 'Last run failed'
                        : 'Running…'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{new Date(lastRun.started_at).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--ink-2)' }}>
                    <span>{lastRun.items_processed || 0} items</span>
                    <span>{((lastRun.tokens_input || 0) + (lastRun.tokens_output || 0)).toLocaleString()} tokens</span>
                    <span>${(lastRun.api_cost || 0).toFixed(4)}</span>
                  </div>
                  {lastRun.error_message && (
                    <p style={{ fontSize: 11, marginTop: 8, padding: 8, background: 'rgba(220,38,38,0.1)', color: '#fca5a5', borderRadius: 6 }}>
                      {lastRun.error_message}
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 11, padding: 12, background: 'var(--bg-2)', color: 'var(--ink-2)', borderRadius: 8 }}>
                  No runs recorded yet
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Run history ─────────────────────────────────────────── */}
      <div className="wb-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--line)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Run history <InfoTooltip text="Chronological log of every AI agent execution. Shows which agent ran, how long it took, token usage, and estimated API costs." />
          </h2>
        </div>
        <div style={{ padding: 16, maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {runs.length === 0 ? (
            <p style={{ textAlign: 'center', padding: 32, fontSize: 13, color: 'var(--ink-2)' }}>
              {loading ? 'Loading…' : 'No agent runs yet'}
            </p>
          ) : (
            runs.map(run => (
              <div key={run.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 8, background: 'var(--bg-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background:
                    run.status === 'completed' ? 'var(--ok)' : run.status === 'failed' ? 'var(--bad)' : 'var(--warn)' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, width: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {run.agent_name?.replace(/_/g, ' ')}
                  </span>
                  {run.run_type && (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-0)', color: 'var(--ink-2)' }}>
                      {run.run_type}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: 11, color: 'var(--ink-2)', alignItems: 'center' }}>
                  <span>{run.items_processed || 0} processed</span>
                  <span>{run.items_created || 0} created</span>
                  <span>${(run.api_cost || 0).toFixed(4)}</span>
                  <span style={{ width: 140, textAlign: 'right' }}>{new Date(run.started_at).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CostTile({ label, value, tone }: { label: string; value: string; tone: 'gold' | 'blue' | 'green' }) {
  const color = tone === 'gold' ? 'var(--warn)' : tone === 'blue' ? '#60a5fa' : 'var(--ok)';
  return (
    <div className="wb-panel" style={{ padding: 18 }}>
      <div className="wb-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}
