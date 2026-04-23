'use client';

/**
 * Positions — policy knowledge base that feeds content generation.
 *
 * Endpoints called:
 *   GET /api/positions   → Position[]  { id, topic, subtopic, position_summary, talking_points[], strength }
 *
 * Preserves: expandable rows, strength color coding, empty-state quick-add
 * topics scaffold.
 */

import { useEffect, useState } from 'react';
import { Target, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import PageHeader from '@/components/layout/PageHeader';

interface Position {
  id: string;
  topic: string;
  subtopic?: string;
  position_summary: string;
  talking_points?: string[];
  strength: 'strong' | 'moderate' | 'developing' | 'vulnerable';
}

const STRENGTH_COLORS: Record<Position['strength'], string> = {
  strong:      '#10b981',
  moderate:    '#60a5fa',
  developing:  '#f59e0b',
  vulnerable:  '#ef4444',
};

const SEED_TOPICS = [
  'Economy & Jobs', 'Water Policy', 'Education', 'Public Safety',
  'Healthcare', 'Energy', 'Housing', 'Immigration',
];

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/positions');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setPositions(Array.isArray(data) ? data : []);
      } catch (e) { console.error(e); }
      finally    { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const titleCase = (s: string) =>
    s.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div style={{ padding: 'var(--pad-section)', display: 'flex', flexDirection: 'column', gap: 'var(--gap)', background: 'var(--bg-0)' }}>
      <PageHeader
        eyebrow="Operations · Knowledge base"
        title={<>Policy Positions <InfoTooltip text="Knowledge base of the candidate's policy positions on key issues. Each includes summaries, talking points, and strength assessments that power AI content generation." /></>}
        subtitle="Scott Bottoms' policy positions and talking points knowledge base."
        actions={
          <button className="wb-btn wb-btn-rapid">
            <Plus size={14} /> Add position
          </button>
        }
      />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: 64, borderRadius: 12, background: 'var(--bg-1)' }} className="animate-pulse" />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <div className="wb-panel" style={{ padding: 48, textAlign: 'center' }}>
          <Target size={56} style={{ color: 'var(--ink-2)', margin: '0 auto 16px', display: 'block' }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Knowledge base empty</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: 440, margin: '0 auto 24px' }}>
            Add Scott's policy positions to power the content agents. Each position includes a summary,
            talking points, supporting data, and competitor differentiation.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, maxWidth: 640, margin: '0 auto' }}>
            {SEED_TOPICS.map(topic => (
              <button key={topic} className="wb-btn" style={{ fontSize: 11, fontWeight: 500, justifyContent: 'center' }}>
                + {topic}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {positions.map(pos => {
            const open = expanded === pos.id;
            const color = STRENGTH_COLORS[pos.strength] || '#64748b';
            return (
              <div key={pos.id} className="wb-panel" style={{ overflow: 'hidden' }}>
                <button
                  onClick={() => setExpanded(open ? null : pos.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span style={{ width: 3, height: 32, borderRadius: 2, background: color }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{titleCase(pos.topic)}</p>
                      {pos.subtopic && <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-2)' }}>{pos.subtopic}</p>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: `${color}22`, color }}>
                      {pos.strength.toUpperCase()}
                    </span>
                  </div>
                  {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
                {open && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--line)' }}>
                    <div style={{ paddingTop: 16 }}>
                      <h3 className="wb-eyebrow" style={{ marginBottom: 8 }}>Position summary</h3>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-1)', lineHeight: 1.55 }}>{pos.position_summary}</p>

                      {pos.talking_points && pos.talking_points.length > 0 && (
                        <>
                          <h3 className="wb-eyebrow" style={{ marginTop: 16, marginBottom: 8 }}>Talking points</h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {pos.talking_points.map((tp, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--ink-1)' }}>
                                <span style={{ color: 'var(--accent)' }}>+</span>
                                <span>{tp}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
