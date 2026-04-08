'use client';

import { useState, useEffect } from 'react';
import { Users, TrendingUp, ChevronUp, ChevronDown, Target, ArrowRight } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';

interface StageData {
  id: string;
  name: string;
  count: number;
}

interface PipelineData {
  name: string;
  stages: StageData[];
  total: number;
}

interface FunnelResponse {
  pipelines: PipelineData[];
  totalOpportunities: number;
  status: string;
}

const STAGE_COLORS: Record<string, string> = {
  'Webform response': '#6366f1',
  'Community': '#8b5cf6',
  "What's your path?": '#a78bfa',
  'Event Volunteer': '#10b981',
  'Ongoing Support': '#059669',
  'Leadership Role': '#047857',
  'One-time Donation': '#f59e0b',
  'Monthly Giving': '#d97706',
  "You're Invited 1": '#60a5fa',
  "You're Invited 2": '#3b82f6',
  "You're Invited 3": '#2563eb',
  'Donations': '#22c55e',
  'Lead Capture': '#ef4444',
  'Qualification': '#f97316',
  'Event Type Selection': '#eab308',
  'Planning & Scheduling': '#84cc16',
  'Event Execution': '#14b8a6',
  'Follow-Up': '#06b6d4',
};

export default function SupporterFunnel() {
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [activePipeline, setActivePipeline] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/analytics/mmdb/funnel');
        if (res.ok) setData(await res.json());
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    fetchData();
  }, []);

  const pipeline = data?.pipelines?.[activePipeline];
  const maxCount = pipeline ? Math.max(...pipeline.stages.map(s => s.count), 1) : 1;

  return (
    <div className="rounded-2xl overflow-hidden glass-panel relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
      {/* Header */}
      <div className="p-6 flex items-center justify-between cursor-pointer relative z-10" onClick={() => setExpanded(!expanded)}
        style={{ borderBottom: expanded ? '1px solid var(--border-color)' : 'none' }}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
            <Target className="w-5 h-5 text-purple-400" style={{ filter: 'drop-shadow(0 0 8px rgba(139,92,246,0.6))' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">
              Supporter Pipeline
              <InfoTooltip text="Shows how supporters move through your engagement funnel — from initial webform submission through volunteer, donor, and monthly giving stages. Powered by live MMDB data." />
              {data?.status === 'live' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', boxShadow: '0 0 10px rgba(16,185,129,0.2)' }}>LIVE</span>
              )}
            </h2>
            <p className="text-[11px] uppercase tracking-widest font-bold mt-1 text-slate-400">
              {data?.totalOpportunities?.toLocaleString() || '—'} total opportunities across {data?.pipelines?.length || 0} pipelines
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </div>

      {expanded && (
        <div className="p-6 relative z-10 bg-black/20">
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-8 rounded animate-pulse" style={{ background: 'var(--surface-2)', width: `${100 - i * 12}%` }} />
              ))}
            </div>
          ) : !data?.pipelines?.length ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No pipeline data available. Check MMDB connection in Settings.</p>
          ) : (
            <>
              {/* Pipeline Tabs */}
              {data.pipelines.length > 1 && (
                <div className="flex gap-1 p-1.5 rounded-xl mb-6 glass-subpanel shadow-inner">
                  {data.pipelines.map((p, i) => (
                    <button key={i} onClick={(e) => { e.stopPropagation(); setActivePipeline(i); }}
                      className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex-1"
                      style={{
                        background: activePipeline === i ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: activePipeline === i ? 'white' : 'var(--text-muted)',
                        boxShadow: activePipeline === i ? '0 2px 4px rgba(0,0,0,0.5)' : 'none',
                        border: activePipeline === i ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                      }}>
                      {p.name} ({p.total})
                    </button>
                  ))}
                </div>
              )}

              {/* Funnel Stages */}
              <div className="space-y-2">
                {pipeline?.stages.map((stage, i) => {
                  const width = Math.max(8, (stage.count / maxCount) * 100);
                  const color = STAGE_COLORS[stage.name] || '#6366f1';
                  const isLast = i === (pipeline?.stages.length || 0) - 1;
                  return (
                    <div key={stage.id}>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold tracking-tight text-slate-200">{stage.name}</span>
                            <span className="text-xs font-bold" style={{ color }}>{stage.count.toLocaleString()}</span>
                          </div>
                          <div className="h-8 rounded-lg overflow-hidden glass-subpanel shadow-inner" style={{ background: 'rgba(0,0,0,0.3)' }}>
                            <div
                              className="h-full rounded-lg transition-all duration-1000 ease-out flex items-center justify-end pr-3 group/bar relative overflow-hidden"
                              style={{ width: `${width}%`, background: `${color}33`, borderRight: `3px solid ${color}` }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/10 opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                              {stage.count > 0 && (
                                <span className="text-[10px] font-bold" style={{ color }}>{Math.round((stage.count / (pipeline?.total || 1)) * 100)}%</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {!isLast && (
                        <div className="flex justify-center py-1">
                          <ArrowRight className="w-4 h-4 rotate-90 text-slate-600" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
