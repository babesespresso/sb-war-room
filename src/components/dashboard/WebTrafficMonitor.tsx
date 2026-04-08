'use client';

import { useState, useEffect } from 'react';
import { Globe, Users, MousePointerClick, Activity, MapPin, Clock, FileText, Zap, Eye, Timer, Loader2 } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';

interface HourlyData {
  hour: number;
  users: number;
  sessions: number;
  pageViews: number;
}

interface RegionData {
  region: string;
  country: string;
  users: number;
  sessions: number;
}

interface TrafficData {
  liveUsers: number;
  totalVisitors: number;
  bounceRate: string;
  totalSessions24h: number;
  avgSessionDuration: number;
  pagesPerSession: string;
  totalPageViews24h: number;
  hourly: HourlyData[];
  peakHour: { hour: number; users: number };
  sources: Array<{ name: string; sessions: number }>;
  regions: RegionData[];
  topPages: Array<{ path: string; views: number; users: number }>;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatHour(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
}

export default function WebTrafficMonitor() {
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/analytics/website');
        if (!res.ok) throw new Error('API down');
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json);
        setError(null);
      } catch (err) {
        setError('Google Analytics pipeline disconnected');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const maxHourlyUsers = data ? Math.max(...data.hourly.map(h => h.users), 1) : 1;
  const totalSessions = data ? data.sources.reduce((acc, loc) => acc + loc.sessions, 0) : 1;
  const maxRegionSessions = data?.regions?.[0]?.sessions || 1;

  const getSourceColor = (name: string) => {
    const lName = name.toLowerCase();
    if (lName.includes('direct')) return 'bg-slate-300';
    if (lName.includes('t.co') || lName.includes('twitter')) return 'bg-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.5)]';
    if (lName.includes('google') || lName.includes('organic')) return 'bg-emerald-400';
    if (lName.includes('email')) return 'bg-purple-400';
    if (lName.includes('facebook') || lName.includes('ig')) return 'bg-indigo-400';
    if (lName.includes('duckduck')) return 'bg-orange-400';
    return 'bg-amber-400';
  };

  const formatSourceName = (name: string) => {
    if (!name) return 'Unknown';
    if (name === '(direct) / (none)') return 'Direct Traffic';
    if (name === 't.co / referral') return 'X (Twitter)';
    if (name === 'google / organic') return 'Organic Search';
    return name.split(' / ')[0].replace(/\b\w/g, l => l.toUpperCase());
  }

  return (
    <div className="glass-panel p-6 rounded-2xl relative overflow-hidden h-full shadow-[0_0_30px_rgba(59,130,246,0.05)] border border-blue-500/10">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
        <Globe className="w-32 h-32" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            Website Traffic Analytics
            <InfoTooltip text="Live traffic analytics, geographic intelligence, and acquisition sources via GA4 API" />
          </h2>
          <p className="text-sm text-slate-400 mt-1">scottbottoms.com digital properties</p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2 text-emerald-400 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-[flicker_2s_infinite] shadow-[0_0_8px_#34d399]" />
            <span className="text-[10px] font-bold tracking-widest uppercase">Live On Site</span>
          </div>
          <span className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            {loading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-400 inline-block" /> : (data?.liveUsers || 0)}
          </span>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6 relative z-10">
        <MetricCard icon={<Users className="w-4 h-4" />} label="24h Visitors" value={loading ? '--' : (data?.totalVisitors || 0).toLocaleString()} color="blue" />
        <MetricCard icon={<Zap className="w-4 h-4" />} label="24h Sessions" value={loading ? '--' : (data?.totalSessions24h || 0).toLocaleString()} color="cyan" />
        <MetricCard icon={<Eye className="w-4 h-4" />} label="Page Views" value={loading ? '--' : (data?.totalPageViews24h || 0).toLocaleString()} color="violet" />
        <MetricCard icon={<Activity className="w-4 h-4" />} label="Bounce Rate" value={loading ? '--' : `${data?.bounceRate || '0'}%`} color="rose" />
        <MetricCard icon={<Timer className="w-4 h-4" />} label="Avg Duration" value={loading ? '--' : formatDuration(data?.avgSessionDuration || 0)} color="amber" />
        <MetricCard icon={<FileText className="w-4 h-4" />} label="Pages/Session" value={loading ? '--' : (data?.pagesPerSession || '0')} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        {/* Col 1: Enhanced Traffic Volume Chart */}
        <div className="glass-subpanel p-4 rounded-xl border border-white/5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <MousePointerClick className="w-4 h-4" /> Traffic Volume (24H)
            </h3>
            {data && (
              <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
                <Clock className="w-3 h-3" />
                <span>Peak: {formatHour(data.peakHour.hour)} ({data.peakHour.users} users)</span>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="h-32 flex items-end gap-[2px] relative">
            {!data ? (
              <div className="w-full h-full flex items-center justify-center opacity-30 text-xs">Awaiting data stream...</div>
            ) : (
              data.hourly.map((h, i) => {
                const isHovered = hoveredBar === i;
                const isPeak = i === data.peakHour.hour;
                const barHeight = Math.max(3, (h.users / maxHourlyUsers) * 100);
                return (
                  <div
                    key={i}
                    className="flex-1 relative group cursor-pointer"
                    style={{ height: '100%' }}
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 pointer-events-none">
                        <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-[10px] whitespace-nowrap shadow-xl">
                          <div className="font-bold text-white mb-1">{formatHour(h.hour)} — {formatHour(h.hour === 23 ? 0 : h.hour + 1)}</div>
                          <div className="text-blue-300">👤 {h.users} users</div>
                          <div className="text-cyan-300">⚡ {h.sessions} sessions</div>
                          <div className="text-violet-300">📄 {h.pageViews} page views</div>
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-600" />
                      </div>
                    )}
                    {/* Bar */}
                    <div
                      className={`absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-300 ${
                        isPeak
                          ? 'bg-amber-400/80 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                          : isHovered
                          ? 'bg-blue-400'
                          : 'bg-blue-500/40'
                      }`}
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Time axis */}
          {data && (
            <div className="flex justify-between mt-2 px-0">
              {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
                <span key={h} className="text-[9px] text-slate-500 font-mono">{formatHour(h)}</span>
              ))}
            </div>
          )}
        </div>

        {/* Col 2: Acquisition Sources */}
        <div className="glass-subpanel p-5 rounded-xl border border-white/5 flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 relative shrink-0">
            Acquisition Sources (7 Days)
            <div className="absolute -bottom-2 left-0 w-8 h-[1px] bg-blue-500/50" />
          </h3>
          
          <div className="space-y-3 flex-grow flex flex-col justify-center">
            {error && <div className="text-red-400 text-xs border border-red-500/20 p-3 rounded bg-red-500/5">{error}</div>}
            
            {loading ? (
              <div className="animate-pulse space-y-4">
                {[1,2,3].map(i => (
                  <div key={i}>
                    <div className="h-3 w-32 bg-white/10 rounded mb-2" />
                    <div className="h-1.5 w-full bg-black/40 rounded-full" />
                  </div>
                ))}
              </div>
            ) : data && data.sources.length > 0 ? (
              data.sources.slice(0, 5).map((source, i) => {
                const percent = Math.round((source.sessions / Math.max(totalSessions, 1)) * 100);
                return (
                  <SourceBar 
                    key={i}
                    name={formatSourceName(source.name)} 
                    value={percent} 
                    count={source.sessions.toString()} 
                    color={getSourceColor(source.name || '')} 
                  />
                );
              })
            ) : !error ? (
              <div className="text-sm text-slate-500 text-center">No acquisition data found</div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bottom Row: Geographic Intelligence */}
      {data && data.regions.length > 0 && (
        <div className="mt-6 relative z-10">
          <div className="glass-subpanel p-5 rounded-xl border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-400" /> Visitor Geography (7 Days)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {data.regions.slice(0, 10).map((region, i) => {
                const barWidth = Math.max(5, (region.sessions / maxRegionSessions) * 100);
                return (
                  <div key={i} className="group relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-300 truncate max-w-[70%]">
                        {i === 0 && <span className="text-amber-400 mr-1">🏆</span>}
                        {region.region}
                      </span>
                      <span className="text-[10px] text-slate-500">{region.sessions}s</span>
                    </div>
                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          i === 0 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                          i === 1 ? 'bg-gradient-to-r from-blue-400 to-cyan-400' :
                          i === 2 ? 'bg-gradient-to-r from-emerald-400 to-teal-400' :
                          'bg-slate-400/60'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5">{region.users} users · {region.country}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/10 to-transparent border-blue-500/10',
    cyan: 'from-cyan-500/10 to-transparent border-cyan-500/10',
    violet: 'from-violet-500/10 to-transparent border-violet-500/10',
    rose: 'from-rose-500/10 to-transparent border-rose-500/10',
    amber: 'from-amber-500/10 to-transparent border-amber-500/10',
    emerald: 'from-emerald-500/10 to-transparent border-emerald-500/10',
  };

  return (
    <div className={`glass-subpanel p-3 rounded-xl border bg-gradient-to-br ${colorMap[color] || colorMap.blue} relative overflow-hidden group`}>
      <div className="absolute inset-0 bg-white/[0.02] translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
      <div className="flex items-center gap-1.5 text-slate-400 mb-1 relative z-10">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-lg font-bold relative z-10">{value}</span>
    </div>
  );
}

function SourceBar({ name, value, count, color }: { name: string, value: number, count: string, color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="font-medium text-slate-300">{name}</span>
        <span className="text-slate-400">{count} sess ({value}%)</span>
      </div>
      <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full relative`}
          style={{ width: `${Math.max(1, value)}%` }} 
        >
          <div className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
        </div>
      </div>
    </div>
  );
}
