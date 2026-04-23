'use client';

import { useState, useEffect } from 'react';
import { Brain, Play, CheckCircle, XCircle, Clock, Zap, DollarSign, RefreshCw } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import PageHeader from '@/components/layout/PageHeader';

const AGENTS = [
  { name: 'competitor_monitor', label: 'Competitor Monitor', schedule: 'Every 4 hours', color: '#f87171' },
  { name: 'news_pulse', label: 'News Pulse', schedule: 'Every 2 hours', color: '#60a5fa' },
  { name: 'daily_brief', label: 'Daily Brief', schedule: '6:30 AM MT', color: '#f59e0b' },
  { name: 'content_generator', label: 'Content Generator', schedule: 'On demand', color: '#10b981' },
  { name: 'rapid_response', label: 'Rapid Response', schedule: 'Triggered', color: '#ef4444' },
  { name: 'sentiment_analyzer', label: 'Sentiment Analyzer', schedule: 'Every 6 hours', color: '#8b5cf6' },
];

export default function AgentsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  useEffect(() => {
    fetchRuns();
  }, []);

  async function fetchRuns() {
    setLoading(true);
    try {
      const res = await fetch('/api/content?view=agent_runs');
      if (res.ok) setRuns(await res.json());
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function triggerAgent(name: string) {
    setTriggering(name);
    try {
      await fetch(`/api/cron?agent=${name}`, {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'dev'}` },
      });
      setTimeout(fetchRuns, 2000);
    } catch (err) { console.error(err); }
    setTriggering(null);
  }

  function getLastRun(agentName: string) {
    return runs.find((r) => r.agent_name === agentName);
  }

  // Aggregate costs
  const totalCost = runs.reduce((sum, r) => sum + (r.api_cost || 0), 0);
  const totalTokens = runs.reduce((sum, r) => sum + (r.tokens_input || 0) + (r.tokens_output || 0), 0);
  const totalRuns = runs.length;

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6" style={{ background: 'var(--bg-0)' }}>
      <PageHeader
        eyebrow="System · Agent fleet"
        title={<>Agent Status <InfoTooltip text="Control center for all AI agents powering the campaign. Each agent runs on a schedule to monitor competitors, scan news, generate content, and analyze sentiment." /></>}
        subtitle="Monitor and manage campaign intelligence agents."
        actions={
          <button onClick={fetchRuns} className="wb-btn" style={{ background: 'var(--bg-2)' }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />

      {/* Cost Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-5 rounded-xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total API Cost</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--campaign-gold)' }}>${totalCost.toFixed(4)}</p>
        </div>
        <div className="p-5 rounded-xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total Tokens</p>
          <p className="text-2xl font-bold" style={{ color: '#60a5fa' }}>{totalTokens.toLocaleString()}</p>
        </div>
        <div className="p-5 rounded-xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total Runs</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--campaign-green)' }}>{totalRuns}</p>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {AGENTS.map((agent) => {
          const lastRun = getLastRun(agent.name);
          const StatusIcon = lastRun?.status === 'completed' ? CheckCircle :
            lastRun?.status === 'failed' ? XCircle :
            lastRun?.status === 'running' ? RefreshCw : Clock;

          return (
            <div key={agent.name} className="p-5 rounded-xl"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: agent.color }} />
                  <div>
                    <p className="font-semibold">{agent.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{agent.schedule}</p>
                  </div>
                </div>
                <button onClick={() => triggerAgent(agent.name)}
                  disabled={triggering === agent.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)' }}>
                  {triggering === agent.name ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  Run Now
                </button>
              </div>

              {lastRun ? (
                <div className="p-3 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <StatusIcon className="w-3.5 h-3.5" style={{
                        color: lastRun.status === 'completed' ? 'var(--campaign-green)' :
                          lastRun.status === 'failed' ? 'var(--campaign-red)' : 'var(--campaign-gold)',
                      }} />
                      <span className="text-xs font-medium">
                        {lastRun.status === 'completed' ? 'Last run successful' :
                          lastRun.status === 'failed' ? 'Last run failed' : 'Running...'}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(lastRun.started_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    <span>{lastRun.items_processed || 0} items</span>
                    <span>{((lastRun.tokens_input || 0) + (lastRun.tokens_output || 0)).toLocaleString()} tokens</span>
                    <span>${(lastRun.api_cost || 0).toFixed(4)}</span>
                  </div>
                  {lastRun.error_message && (
                    <p className="text-xs mt-2 p-2 rounded" style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#fca5a5' }}>
                      {lastRun.error_message}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs p-3 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  No runs recorded yet
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Run History */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
        <div className="p-5" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <h2 className="text-lg font-bold flex items-center gap-1.5">Run History <InfoTooltip text="Chronological log of every AI agent execution. Shows which agent ran, how long it took, token usage, and estimated API costs." /></h2>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto space-y-1.5">
          {runs.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No agent runs yet</p>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{
                    background: run.status === 'completed' ? 'var(--campaign-green)' :
                      run.status === 'failed' ? 'var(--campaign-red)' : 'var(--campaign-gold)',
                  }} />
                  <span className="text-sm font-medium w-40">{run.agent_name?.replace(/_/g, ' ')}</span>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-0)', color: 'var(--text-muted)' }}>
                    {run.run_type}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{run.items_processed || 0} processed</span>
                  <span>{run.items_created || 0} created</span>
                  <span>${(run.api_cost || 0).toFixed(4)}</span>
                  <span className="w-36 text-right">{new Date(run.started_at).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
