'use client';

import { useState, useEffect } from 'react';
import { Workflow, CheckCircle, Circle, ChevronUp, ChevronDown, Zap, Mail, MessageSquare, MessageCircle, Hash, Send, Layers } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';

interface WorkflowItem {
  id: string;
  name: string;
  status: string;
  updatedAt?: string;
  channel?: string;
}

const channelConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  sms: { label: 'SMS', icon: MessageSquare, color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' },
  email: { label: 'Email', icon: Mail, color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' },
  dm: { label: 'DM', icon: MessageCircle, color: '#f472b6', bg: 'rgba(244, 114, 182, 0.15)' },
  slack: { label: 'Slack', icon: Hash, color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)' },
  ig: { label: 'IG', icon: Send, color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)' },
  fb: { label: 'FB', icon: MessageCircle, color: '#818cf8', bg: 'rgba(129, 140, 248, 0.15)' },
  multi: { label: 'Multi', icon: Layers, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
  workflow: { label: 'Auto', icon: Workflow, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
};

export default function WorkflowMonitor() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/analytics/mmdb/workflows');
        if (res.ok) {
          const data = await res.json();
          setWorkflows(data.workflows || []);
        }
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    fetchData();
  }, []);

  const isWorkflowScheduled = (w: WorkflowItem) => {
    if (w.status === 'scheduled' || w.name.toLowerCase().includes('scheduled')) return true;
    
    const dateMatch = w.name.match(/\b(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{2,4})\b/);
    if (dateMatch) {
      let [_, month, day, year] = dateMatch;
      if (year.length === 2) year = `20${year}`;
      
      const wfDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (wfDate >= today) {
        return true;
      }
    }
    return false;
  };

  const scheduled = workflows.filter(w => isWorkflowScheduled(w));
  const published = workflows.filter(w => w.status === 'published' && !isWorkflowScheduled(w));
  const draft = workflows.filter(w => w.status === 'draft' && !isWorkflowScheduled(w));

  // Channel counts for the summary
  const channelCounts = workflows.reduce((acc, w) => {
    if (w.status !== 'published' && !isWorkflowScheduled(w)) return acc;
    const ch = w.channel || 'workflow';
    acc[ch] = (acc[ch] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="rounded-2xl overflow-hidden glass-panel relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
      
      {/* Header — responsive: stacks on mobile */}
      <div 
        className="p-4 sm:p-6 cursor-pointer relative z-10" 
        onClick={() => setExpanded(!expanded)}
        style={{ borderBottom: expanded ? '1px solid var(--border-color)' : 'none' }}
      >
        {/* Top row: icon, title, chevron */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl glass-subpanel shadow-inner flex-shrink-0" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <Workflow className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" style={{ filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.6))' }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-bold flex items-center gap-2 tracking-tight">
                Automation Status
                <InfoTooltip text="Live status of all GoHighLevel automation workflows. Channel badges show SMS, Email, DM, Slack, or Multi-channel." />
              </h2>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-widest font-bold mt-0.5 text-slate-400">
                {loading ? 'SYNCING DATA...' : `${published.length} live · ${scheduled.length} sched · ${draft.length} draft`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!loading && (
              <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-bold tracking-widest uppercase"
                style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', boxShadow: '0 0 10px rgba(16,185,129,0.1)' }}>
                <Zap className="w-3 h-3" /> {published.length + scheduled.length}
                <span className="hidden sm:inline">ACTIVE</span>
              </div>
            )}
            {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
        </div>

        {/* Channel summary pills — wraps on small screens */}
        {!loading && Object.keys(channelCounts).length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3 ml-11 sm:ml-14">
            {Object.entries(channelCounts).map(([ch, count]) => {
              const cfg = channelConfig[ch] || channelConfig.workflow;
              const Icon = cfg.icon;
              return (
                <div key={ch} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: cfg.bg, color: cfg.color }}>
                  <Icon className="w-2.5 h-2.5" />
                  {count} {cfg.label}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Workflow List */}
      {expanded && (
        <div className="p-3 sm:p-6 max-h-80 overflow-y-auto relative z-10 bg-black/20 custom-scrollbar">
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[...scheduled, ...published, ...draft].map((wf) => {
                const isScheduled = isWorkflowScheduled(wf);
                const isLive = wf.status === 'published' && !isScheduled;
                const ch = wf.channel || 'workflow';
                const cfg = channelConfig[ch] || channelConfig.workflow;
                const ChannelIcon = cfg.icon;
                
                let iconColor = 'var(--text-muted)';
                let bgColor = 'rgba(107, 114, 128, 0.15)';
                let textColor = '#9ca3af';
                let displayStatus = wf.status;

                if (isLive) {
                  iconColor = 'var(--campaign-green)';
                  bgColor = 'rgba(16, 185, 129, 0.15)';
                  textColor = '#6ee7b7';
                } else if (isScheduled) {
                  iconColor = '#60a5fa';
                  bgColor = 'rgba(96, 165, 250, 0.15)';
                  textColor = '#93c5fd';
                  displayStatus = 'scheduled';
                }

                return (
                  <div key={wf.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-xl glass-subpanel shadow-inner transition-all hover:bg-white/5 gap-2 sm:gap-3">
                    {/* Left: icon + name */}
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                      {isLive || isScheduled ? (
                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0" style={{ color: iconColor, filter: `drop-shadow(0 0 4px ${iconColor})` }} />
                      ) : (
                        <Circle className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0" style={{ color: iconColor }} />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-bold tracking-tight block truncate" style={{ color: isLive || isScheduled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {wf.name.replace(/^Copy - /, '').replace(/New Workflow : \d+/, 'Untitled Workflow')}
                        </span>
                        {wf.updatedAt && (
                          <span className="text-[10px] text-slate-500 font-medium tracking-wide mt-0.5 block">
                            Updated: {formatDate(wf.updatedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Right: badges — wrap-friendly */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-6 sm:ml-0">
                      {/* Channel badge */}
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                        style={{ background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}
                        title={`Channel: ${cfg.label}`}>
                        <ChannelIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      {/* Status badge */}
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                        style={{
                          background: bgColor,
                          color: textColor,
                          whiteSpace: 'nowrap',
                        }}>
                        {displayStatus}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
