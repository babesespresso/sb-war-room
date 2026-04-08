'use client';

import { useState, useEffect } from 'react';
import { Users, TrendingUp, ChevronUp, Activity, Target, ChevronDown } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';

interface MMDBData {
  growth?: {
    totalSupporters: number;
    weeklyVelocity: number;
    lastWeekVelocity: number;
    velocityChange: string;
  };
  pipelines?: {
    totalOpportunities: number;
  };
  status?: string;
  error?: string;
}

export default function MMDBPulse() {
  const [data, setData] = useState<MMDBData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showPanel, setShowPanel] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/analytics/mmdb');
        if (!res.ok) throw new Error('Failed to fetch MMDB data');
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden mt-6 glass-panel relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
      {/* Header */}
      <div className="p-6 flex items-center justify-between cursor-pointer relative z-10" onClick={() => setShowPanel(!showPanel)}
        style={{ borderBottom: showPanel ? '1px solid var(--border-color)' : 'none' }}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <Activity className="w-5 h-5 text-blue-400" style={{ filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.6))' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">
              MMDB Campaign Pulse
              <InfoTooltip text="Live data pulled from your GoHighLevel CRM. Shows real-time supporter counts, weekly growth velocity, and active pipeline opportunities for the campaign." />
              {!loading && data?.status === 'live' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', boxShadow: '0 0 10px rgba(16,185,129,0.2)' }}>LIVE</span>
              )}
            </h2>
            <p className="text-[11px] uppercase tracking-widest font-bold mt-1 text-slate-400">
              Real-time Supporter Growth & Pipeline Metrics from MMDB
            </p>
          </div>
        </div>
        {showPanel ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </div>

      {showPanel && (
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10 bg-black/20">
          
          {/* Supporter Growth & Velocity */}
          <div className="rounded-xl p-5 glass-subpanel shadow-inner relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex items-center justify-between mb-5 relative z-10">
              <h3 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-slate-400">Supporter Growth & Velocity <InfoTooltip text="Total contacts in the CRM database with week-over-week intake velocity. Shows how fast your supporter base is growing compared to last week." /></h3>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            
            {loading ? (
              <div className="space-y-3 relative z-10">
                <div className="h-10 w-40 animate-pulse rounded" style={{ background: 'var(--surface-3)' }} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-16 animate-pulse rounded" style={{ background: 'var(--surface-3)' }} />
                  <div className="h-16 animate-pulse rounded" style={{ background: 'var(--surface-3)' }} />
                </div>
              </div>
            ) : error ? (
              <p className="text-sm text-red-400 relative z-10">Failed to connect to MMDB. Check your API key in Settings.</p>
            ) : (
              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-bold text-white tracking-tight">{data?.growth?.totalSupporters?.toLocaleString() ?? 0}</span>
                  <span className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Total Contacts</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>New This Week</p>
                    <p className="text-lg font-semibold flex items-center gap-1" style={{ color: 'var(--campaign-green)' }}>
                      <TrendingUp className="w-3.5 h-3.5" /> +{(data?.growth?.weeklyVelocity ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>vs Last Week</p>
                    <p className="text-lg font-semibold flex items-center gap-1 text-white">
                      {data?.growth?.velocityChange}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      ({(data?.growth?.lastWeekVelocity ?? 0).toLocaleString()} last wk)
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pipeline & Opportunities */}
          <div className="rounded-xl p-5 glass-subpanel shadow-inner relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex items-center justify-between mb-5 relative z-10">
              <h3 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-slate-400">Pipeline & Opportunities <InfoTooltip text="Active opportunities across your Donations, SB-Intake-Webform, and Event Collaboration pipelines. Tracks supporter engagement through the campaign funnel." /></h3>
              <Target className="w-4 h-4 text-slate-400" />
            </div>
            
            {loading ? (
              <div className="space-y-3 relative z-10">
                <div className="h-10 w-32 animate-pulse rounded" style={{ background: 'var(--surface-3)' }} />
                <div className="h-16 animate-pulse rounded" style={{ background: 'var(--surface-3)' }} />
              </div>
            ) : error ? (
              <p className="text-sm text-red-400 relative z-10">Failed to load pipeline data.</p>
            ) : (
              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-bold text-white tracking-tight">{(data?.pipelines?.totalOpportunities ?? 0).toLocaleString()}</span>
                  <span className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Active Opportunities</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Weekly Intake</p>
                    <p className="text-lg font-semibold text-white">
                      +{(data?.growth?.weeklyVelocity ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>new contacts</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Growth Trend</p>
                    <p className="text-lg font-semibold flex items-center gap-1" style={{ 
                      color: (data?.growth?.velocityChange ?? '').startsWith('+') || (data?.growth?.velocityChange ?? '').includes('Surge') 
                        ? 'var(--campaign-green)' 
                        : 'var(--campaign-red)' 
                    }}>
                      <TrendingUp className="w-3.5 h-3.5" /> {data?.growth?.velocityChange}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>week over week</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
