'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Crosshair, TrendingUp, AlertTriangle, CheckCircle, FileText, Users,
  Shield, Zap, ArrowUpRight, ChevronRight, Gauge, Newspaper, Clock,
  Send, Radar, ExternalLink, AlertCircle, WifiOff
} from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';

interface ActionItem {
  id: string;
  icon: string;
  title: string;
  detail: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  link: string;
  linkLabel: string;
  metric?: string;
}

interface HealthBreakdown {
  label: string;
  score: number;
  maxScore: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
}

interface WinItem {
  text: string;
  metric: string;
  link?: string;
}

interface DataSourceStatus {
  name: string;
  available: boolean;
  error?: string;
}

interface PriorityData {
  healthScore: number;
  healthTrend: string;
  healthBreakdown: HealthBreakdown[];
  actions: ActionItem[];
  wins: WinItem[];
  lastUpdated: string;
  dataSources?: DataSourceStatus[];
}

const URGENCY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.25)', label: 'CRITICAL' },
  high: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.25)', label: 'HIGH' },
  medium: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)', label: 'ACTION' },
  low: { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.08)', border: 'rgba(107, 114, 128, 0.15)', label: 'INFO' },
};

const STATUS_COLORS: Record<string, string> = {
  excellent: '#10b981', good: '#3b82f6', warning: '#f59e0b', critical: '#ef4444',
};

const ACTION_ICONS: Record<string, any> = {
  content: FileText, competitor: Shield, growth: Users, threat: AlertTriangle,
  opportunity: Zap, news: Newspaper, schedule: Send, radar: Radar,
};

export default function TodaysPriorities() {
  const router = useRouter();
  const [data, setData] = useState<PriorityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchPriorities() {
      try {
        const res = await fetch('/api/analytics/priorities');
        if (res.ok) setData(await res.json());
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    fetchPriorities();
  }, []);

  const handleNav = (link: string) => {
    if (link.startsWith('http')) {
      window.open(link, '_blank');
    } else {
      router.push(link);
    }
  };

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  const getHealthColor = (score: number) => {
    if (score >= 75) return '#10b981';
    if (score >= 55) return '#3b82f6';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const activeActions = data?.actions.filter(a => !dismissed.has(a.id)) || [];

  return (
    <div className="rounded-xl overflow-hidden hud-panel relative group border-t-2" style={{ borderTopColor: 'var(--campaign-red)' }}>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800/20 via-transparent to-slate-900/40 opacity-50 pointer-events-none" />
      <div className="p-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
              <Crosshair className="w-5 h-5" style={{ color: 'var(--campaign-red)' }} />
            </div>
            <div>
              <h2 className="text-2xl font-mono font-bold flex items-center gap-2 tracking-tighter uppercase text-white text-shadow-glow">
                Today&apos;s Priorities
                <InfoTooltip text="AI-computed campaign health and action items based on live MMDB contacts, social analytics, competitor intelligence, and content pipeline. Scores update in real-time." />
              </h2>
              <p className="text-[11px] uppercase tracking-widest font-bold mt-1" style={{ color: 'var(--text-muted)' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                {data?.lastUpdated && ` · Last computed ${new Date(data.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
          </div>
          {data && (
            <div className="flex items-center gap-2">
              {/* Data source status indicators */}
              {data.dataSources && data.dataSources.some(ds => !ds.available) && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <WifiOff className="w-3 h-3" />
                  {data.dataSources.filter(ds => !ds.available).map(ds => ds.name.split(' ')[0]).join(', ')} offline
                </div>
              )}
              <span className="text-xs px-2 py-1 rounded-full font-bold" style={{
                background: `${getHealthColor(data.healthScore)}15`,
                color: getHealthColor(data.healthScore),
              }}>
                {data.healthTrend}
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {[3, 5, 4].map((span, i) => (
              <div key={i} className={`lg:col-span-${span} h-40 rounded-lg animate-pulse`} style={{ background: 'var(--surface-2)' }} />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

            {/* ── LEFT: Campaign Health Score ── */}
            <div className="lg:col-span-3 p-5 rounded-xl flex flex-col items-center justify-center glass-subpanel shadow-inner relative overflow-hidden group/score">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover/score:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              {/* Score Ring */}
              <button onClick={() => setShowBreakdown(!showBreakdown)} className="relative w-[100px] h-[100px] cursor-pointer hover:scale-105 transition-transform duration-500 ease-out z-10">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="var(--surface-0)" strokeWidth="7" />
                  <circle cx="48" cy="48" r="40" fill="none" stroke={getHealthColor(data.healthScore)} strokeWidth="7"
                    strokeDasharray={`${(data.healthScore / 100) * 251.3} 251.3`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-5xl font-mono font-black ${getHealthColor(data.healthScore) === '#10b981' ? 'text-shadow-green' : getHealthColor(data.healthScore) === '#f59e0b' ? 'text-shadow-gold' : getHealthColor(data.healthScore) === '#ef4444' ? 'text-shadow-red' : 'text-shadow-blue'}`} style={{ color: getHealthColor(data.healthScore) }}>{data.healthScore}</span>
                  <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-muted)' }}>Score</span>
                </div>
              </button>

              <p className="text-[10px] font-bold uppercase tracking-wider mt-2 mb-3" style={{ color: 'var(--text-muted)' }}>Campaign Health</p>

              {/* Breakdown (expandable) */}
              {showBreakdown && data.healthBreakdown && (
                <div className="w-full space-y-2 mt-1 animate-fade-in">
                  {data.healthBreakdown.map((item, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                        <span className="text-[10px] font-bold" style={{ color: STATUS_COLORS[item.status] }}>{item.score}/{item.maxScore}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-0)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(item.score / item.maxScore) * 100}%`, background: STATUS_COLORS[item.status] }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!showBreakdown && (
                <button onClick={() => setShowBreakdown(true)} className="text-[10px] text-center transition-colors hover:text-white" style={{ color: 'var(--text-muted)' }}>
                  Click score to see breakdown ↓
                </button>
              )}
            </div>

            {/* ── CENTER: Action Items ── */}
            <div className="lg:col-span-5 rounded-xl p-5 glass-subpanel shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
              <p className="text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10" style={{ color: 'var(--text-muted)' }}>
                <AlertTriangle className="w-3.5 h-3.5" /> Action Items ({activeActions.length})
              </p>
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                {activeActions.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--campaign-green)' }} />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>All clear — no urgent items</p>
                  </div>
                ) : activeActions.map((action) => {
                  const Icon = ACTION_ICONS[action.icon] || Zap;
                  const config = URGENCY_CONFIG[action.urgency];
                  return (
                    <div key={action.id} className="rounded-lg overflow-hidden transition-all hover:brightness-110"
                      style={{ background: config.bg, border: `1px solid ${config.border}` }}>
                      <div className="p-3">
                        <div className="flex items-start gap-2.5">
                          <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: config.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{action.title}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase" style={{ background: `${config.color}20`, color: config.color }}>
                                {config.label}
                              </span>
                            </div>
                            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                              {action.detail}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <button
                                onClick={() => handleNav(action.link)}
                                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors hover:brightness-125"
                                style={{ color: config.color }}>
                                {action.link.startsWith('http') ? <ExternalLink className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                {action.linkLabel}
                              </button>
                              {action.metric && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-0)', color: 'var(--text-muted)' }}>
                                  {action.metric}
                                </span>
                              )}
                              <button onClick={() => handleDismiss(action.id)}
                                className="text-[10px] ml-auto transition-colors hover:text-white" style={{ color: 'var(--text-muted)' }}>
                                dismiss
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── RIGHT: Campaign Wins ── */}
            <div className="lg:col-span-4 rounded-xl p-5 glass-subpanel shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
              <p className="text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10" style={{ color: 'var(--text-muted)' }}>
                <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--campaign-green)' }} /> Campaign Scorecard
              </p>
              <div className="space-y-2 relative z-10">
                {data.wins.map((win, i) => (
                  <button
                    key={i}
                    onClick={() => win.link && handleNav(win.link)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg transition-all hover:brightness-110 group text-left"
                    style={{ background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--campaign-green)' }} />
                      <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{win.text}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <span className="text-sm font-bold" style={{ color: 'var(--campaign-green)' }}>{win.metric}</span>
                      {win.link && <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <div className="text-center py-8">
            <Gauge className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Unable to load priorities. Check API connections in Settings.</p>
            <button onClick={() => handleNav('/settings')} className="mt-2 text-xs font-medium" style={{ color: 'var(--campaign-red)' }}>
              Go to Settings →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
