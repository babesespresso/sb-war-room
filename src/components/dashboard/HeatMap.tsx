'use client';

import { useState, useEffect } from 'react';
import { Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';

interface HeatEntry {
  topic: string;
  sentiment_score: number;
  volume: number;
  velocity: number;
  candidate_alignment: string;
  opportunity_score: number;
}

const ALIGNMENT_COLORS: Record<string, string> = {
  strong: '#10b981',
  moderate: '#60a5fa',
  weak: '#f59e0b',
  opposed: '#ef4444',
};

const TOPIC_LABELS: Record<string, string> = {
  economy: 'Economy',
  jobs: 'Jobs',
  taxes: 'Taxes',
  housing: 'Housing',
  water_policy: 'Water Policy',
  energy: 'Energy',
  education: 'Education',
  healthcare: 'Healthcare',
  immigration: 'Immigration',
  public_safety: 'Public Safety',
  infrastructure: 'Infrastructure',
  environment: 'Environment',
  gun_policy: 'Gun Policy',
  election_integrity: 'Election Integrity',
  government_spending: 'Gov. Spending',
  constitutional_rights: 'Constitutional Rights',
};

export default function HeatMap() {
  const [data, setData] = useState<HeatEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/intel?type=heatmap');
        if (res.ok) {
          const entries = await res.json();
          setData(Array.isArray(entries) ? entries : []);
        }
      } catch (err) {
        console.error('Failed to fetch heatmap:', err);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const VelocityIcon = ({ velocity }: { velocity: number }) => {
    if (velocity > 0.5) return <TrendingUp className="w-3 h-3" style={{ color: 'var(--campaign-green)' }} />;
    if (velocity < -0.5) return <TrendingDown className="w-3 h-3" style={{ color: 'var(--campaign-red)' }} />;
    return <Minus className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />;
  };

  return (
    <div className="rounded-2xl overflow-hidden glass-panel relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
      <div className="flex items-center gap-3 p-6 relative z-10" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: 'rgba(220, 38, 38, 0.15)', border: '1px solid rgba(220, 38, 38, 0.3)' }}>
          <Flame className="w-5 h-5" style={{ color: 'var(--campaign-red)', filter: 'drop-shadow(0 0 8px rgba(220,38,38,0.6))' }} />
        </div>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">Issue Heat Map <InfoTooltip text="Tracks which political issues Colorado voters are discussing most. Shows sentiment alignment with Scott Bottoms' positions and opportunity scores for campaign messaging." /></h2>
          <p className="text-[11px] uppercase tracking-widest font-bold mt-1 text-slate-400">What Colorado is talking about</p>
        </div>
      </div>

      <div className="p-6 max-h-80 overflow-y-auto relative z-10 bg-black/20 custom-scrollbar">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8">
            <Flame className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No sentiment data yet. Run the sentiment agent to populate.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {data.slice(0, 10).map((entry, i) => {
              const barWidth = Math.min(100, entry.opportunity_score || 0);
              return (
                <div key={i} className="p-4 rounded-xl glass-subpanel shadow-inner transition-all hover:bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold tracking-tight text-slate-200">
                      {TOPIC_LABELS[entry.topic] || entry.topic}
                    </span>
                    <div className="flex items-center gap-2">
                      <VelocityIcon velocity={entry.velocity} />
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background: `${ALIGNMENT_COLORS[entry.candidate_alignment] || '#64748b'}22`,
                          color: ALIGNMENT_COLORS[entry.candidate_alignment] || '#94a3b8',
                        }}>
                        {entry.candidate_alignment}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-0)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${barWidth}%`,
                          background: entry.opportunity_score > 70 ? 'var(--campaign-green)' :
                            entry.opportunity_score > 40 ? 'var(--campaign-gold)' : 'var(--text-muted)',
                        }} />
                    </div>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)', minWidth: '2rem', textAlign: 'right' }}>
                      {entry.opportunity_score}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Vol: {entry.volume?.toLocaleString()}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Sent: {(entry.sentiment_score > 0 ? '+' : '')}{entry.sentiment_score?.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
