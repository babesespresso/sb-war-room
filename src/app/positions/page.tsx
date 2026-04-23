'use client';

import { useState, useEffect } from 'react';
import { Target, Plus, ChevronDown, ChevronRight, Shield, Edit } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import PageHeader from '@/components/layout/PageHeader';

const STRENGTH_COLORS: Record<string, string> = {
  strong: '#10b981',
  moderate: '#60a5fa',
  developing: '#f59e0b',
  vulnerable: '#ef4444',
};

export default function PositionsPage() {
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPositions() {
      try {
        const res = await fetch('/api/positions');
        if (res.ok) {
          const data = await res.json();
          setPositions(data || []);
        }
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    fetchPositions();
  }, []);

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6" style={{ background: 'var(--bg-0)' }}>
      <PageHeader
        eyebrow="Operations · Knowledge base"
        title={<>Policy Positions <InfoTooltip text="Knowledge base of the candidate's policy positions on key issues. Each position includes summaries, talking points, and strength assessments that power AI content generation." /></>}
        subtitle="Scott Bottoms' policy positions and talking points knowledge base."
        actions={
          <button className="wb-btn wb-btn-rapid">
            <Plus className="w-4 h-4" /> Add Position
          </button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
          <Target className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h2 className="text-xl font-bold mb-2">Knowledge Base Empty</h2>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
            Add Scott's policy positions to power the content agents. Each position includes a summary,
            talking points, supporting data, and competitor differentiation.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {['Economy & Jobs', 'Water Policy', 'Education', 'Public Safety', 'Healthcare', 'Energy', 'Housing', 'Immigration'].map((topic) => (
              <button key={topic} className="p-3 rounded-lg text-xs font-medium transition-all hover:brightness-110"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                + {topic}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {positions.map((pos) => (
            <div key={pos.id} className="rounded-xl overflow-hidden"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
              <button onClick={() => setExpanded(expanded === pos.id ? null : pos.id)}
                className="w-full text-left p-5 flex items-center justify-between hover:brightness-105 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded-full" style={{ background: STRENGTH_COLORS[pos.strength] || '#64748b' }} />
                  <div>
                    <p className="font-semibold">{pos.topic?.replaceAll('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</p>
                    {pos.subtopic && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{pos.subtopic}</p>}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ background: `${STRENGTH_COLORS[pos.strength]}22`, color: STRENGTH_COLORS[pos.strength] }}>
                    {pos.strength}
                  </span>
                </div>
                {expanded === pos.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
              {expanded === pos.id && (
                <div className="px-5 pb-5 pt-0" style={{ borderTop: '1px solid var(--border-color)' }}>
                  <div className="pt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Position Summary</h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{pos.position_summary}</p>

                    {pos.talking_points?.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Talking Points</h3>
                        <div className="space-y-1">
                          {pos.talking_points.map((tp: string, i: number) => (
                            <div key={i} className="flex gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                              <span style={{ color: 'var(--campaign-red)' }}>+</span>
                              {tp}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
