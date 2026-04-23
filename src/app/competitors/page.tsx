'use client';

/**
 * Competitors — opposition tracking + AI counter-strike generator.
 *
 * Endpoints called:
 *   GET  /api/intel?type=competitors                       → Competitor[]
 *   GET  /api/intel?type=activities&competitor_id=<uuid>   → Activity[] (per competitor)
 *   POST /api/ai/counter-strike  { activity }              → { tweet, email, quote }
 *
 * Preserves: split list/feed layout, endorser section, Scott Bottoms mention
 * highlighting + filter, counter-strike modal with tweet/email/press-quote output.
 */

import { useEffect, useState } from 'react';
import { Swords, Shield, ExternalLink, AlertTriangle, Target, ChevronRight, ThumbsUp, Zap, Sparkles, X } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import PageHeader from '@/components/layout/PageHeader';

interface Competitor {
  id: string; name: string; party: string; role: string;
  threat_level: 'critical' | 'high' | 'medium' | 'low';
  messaging_profile?: { core_themes?: string[]; endorsement?: string };
}
interface Activity {
  id: string; activity_type?: string; threat_level?: 'critical' | 'high' | 'medium' | 'low';
  platform?: string; summary: string; raw_content?: string;
  topics?: string[]; sentiment?: string;
  requires_response?: boolean; suggested_response?: string;
  detected_at: string; source_url?: string;
}
interface StrikeResult { tweet?: string; email?: string; quote?: string; error?: string }

const THREAT_STYLES: Record<string, string> = {
  critical: 'threat-critical', high: 'threat-high', medium: 'threat-medium', low: 'threat-low',
};
const PLATFORM_LABELS: Record<string, string> = {
  twitter: '𝕏 twitter', facebook: 'f facebook', news: '📰 news', website: '🌐 website',
};

function mentionsCandidate(a: Activity) {
  const text = `${a.summary || ''} ${a.raw_content || ''}`.toLowerCase();
  return text.includes('scott bottoms');
}
function timeAgo(s: string) {
  const diff = Date.now() - new Date(s).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function HighlightMentions({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(/(Scott\s+Bottoms)/gi);
  return <>{parts.map((p, i) => /^Scott\s+Bottoms$/i.test(p)
    ? <span key={i} style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '0 2px', borderRadius: 2, borderBottom: '1px solid rgba(251,191,36,0.4)', fontWeight: 600 }}>{p}</span>
    : <span key={i}>{p}</span>)}</>;
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selected, setSelected]       = useState<string | null>(null);
  const [activities, setActivities]   = useState<Activity[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterMentions, setFilterMentions] = useState(false);
  const [striking, setStriking]       = useState<Activity | null>(null);
  const [strikeResult, setStrikeResult] = useState<StrikeResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/intel?type=competitors');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setCompetitors(Array.isArray(data) ? data : []);
        }
      } catch (e) { console.error(e); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/intel?type=activities&competitor_id=${selected}`);
        if (res.ok && !cancelled) setActivities(await res.json());
      } catch (e) { console.error(e); }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  const sorted = [...competitors].sort((a, b) => {
    if (a.role === 'endorser' && b.role !== 'endorser') return 1;
    if (a.role !== 'endorser' && b.role === 'endorser') return -1;
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.threat_level] ?? 4) - (order[b.threat_level] ?? 4);
  });

  const displayed = filterMentions ? activities.filter(mentionsCandidate) : activities;
  const mentionCount = activities.filter(mentionsCandidate).length;

  const handleCounterStrike = async (activity: Activity, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setStriking(activity);
    setStrikeResult(null);
    try {
      const res = await fetch('/api/ai/counter-strike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity }),
      });
      setStrikeResult(res.ok ? await res.json() : { error: 'Failed to generate response' });
    } catch {
      setStrikeResult({ error: 'Network error generating response' });
    }
  };

  const activeComps = sorted.filter(c => c.role !== 'endorser');
  const endorsers   = sorted.filter(c => c.role === 'endorser');

  return (
    <div style={{ padding: 'var(--pad-section)', display: 'flex', flexDirection: 'column', gap: 'var(--gap)', background: 'var(--bg-0)' }}>
      <PageHeader
        eyebrow="Intelligence · Opposition"
        title={<>Competitor tracking <InfoTooltip text="Full intelligence view of competing gubernatorial campaigns. Monitor their public activity, threat levels, and generate AI-powered counter-strike responses." /></>}
        subtitle="Monitor opponent messaging, activity, and threat levels."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Competitor list */}
        <div className="lg:col-span-4" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 96, borderRadius: 12, background: 'var(--bg-1)' }} className="animate-pulse" />
            ))
          ) : competitors.length === 0 ? (
            <div className="wb-panel" style={{ padding: 32, textAlign: 'center' }}>
              <Swords size={36} style={{ color: 'var(--ink-2)', margin: '0 auto 12px', display: 'block' }} />
              <p style={{ margin: '0 0 4px', fontSize: 13 }}>No competitors added yet</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-2)' }}>Add competitors to start monitoring.</p>
            </div>
          ) : (
            <>
              {activeComps.length > 0 && (
                <p className="wb-eyebrow" style={{ margin: '0 0 2px' }}>Active competitors</p>
              )}
              {activeComps.map(comp => (
                <CompetitorCard
                  key={comp.id}
                  competitor={comp}
                  selected={selected === comp.id}
                  onSelect={() => { setSelected(comp.id); setFilterMentions(false); }}
                />
              ))}

              {endorsers.length > 0 && (
                <div style={{ marginTop: 14, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ThumbsUp size={13} style={{ color: 'var(--ok)' }} />
                  <p className="wb-eyebrow" style={{ margin: 0, color: 'var(--ok)' }}>Endorsers & allies</p>
                </div>
              )}
              {endorsers.map(comp => (
                <EndorserCard
                  key={comp.id}
                  competitor={comp}
                  selected={selected === comp.id}
                  onSelect={() => { setSelected(comp.id); setFilterMentions(false); }}
                />
              ))}
            </>
          )}
        </div>

        {/* Activity feed */}
        <div className="lg:col-span-8">
          <div className="wb-panel" style={{ overflow: 'hidden' }}>
            <div style={{ padding: 20, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {selected ? `Activity feed: ${competitors.find(c => c.id === selected)?.name}` : 'Select a competitor'}
              </h2>
              {selected && mentionCount > 0 && (
                <button
                  onClick={() => setFilterMentions(!filterMentions)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                    background: filterMentions ? 'rgba(251,191,36,0.2)' : 'rgba(251,191,36,0.08)',
                    color: '#fbbf24',
                    border: `1px solid ${filterMentions ? 'rgba(251,191,36,0.5)' : 'rgba(251,191,36,0.2)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <Target size={11} />
                  {filterMentions ? 'Show all' : `${mentionCount} mention${mentionCount !== 1 ? 's' : ''} of Scott Bottoms`}
                </button>
              )}
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 620, overflowY: 'auto' }}>
              {!selected ? (
                <div style={{ textAlign: 'center', padding: 64 }}>
                  <Shield size={40} style={{ color: 'var(--ink-2)', margin: '0 auto 12px', display: 'block' }} />
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>Select a competitor to view their activity</p>
                </div>
              ) : displayed.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 64 }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>
                    {filterMentions ? 'No activities mentioning Scott Bottoms' : 'No activity recorded yet'}
                  </p>
                </div>
              ) : (
                displayed.map(act => (
                  <ActivityRow key={act.id} activity={act} onCounterStrike={handleCounterStrike} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {striking && (
        <CounterStrikeModal
          activity={striking}
          result={strikeResult}
          onClose={() => setStriking(null)}
        />
      )}
    </div>
  );
}

function CompetitorCard({ competitor, selected, onSelect }: { competitor: Competitor; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="wb-panel" style={{
      width: '100%', textAlign: 'left', padding: 14, cursor: 'pointer',
      background: selected ? 'var(--bg-2)' : undefined,
      borderColor: selected ? 'var(--accent)' : 'var(--line)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{competitor.name}</p>
            <ChevronRight size={13} style={{ opacity: selected ? 1 : 0 }} />
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-2)' }}>{competitor.party} · {competitor.role}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded font-medium ${THREAT_STYLES[competitor.threat_level]}`}>
          {competitor.threat_level}
        </span>
      </div>
      {competitor.messaging_profile?.core_themes && competitor.messaging_profile.core_themes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {competitor.messaging_profile.core_themes.slice(0, 3).map((theme, i) => (
            <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-2)', color: 'var(--ink-2)' }}>{theme}</span>
          ))}
        </div>
      )}
    </button>
  );
}

function EndorserCard({ competitor, selected, onSelect }: { competitor: Competitor; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="wb-panel" style={{
      width: '100%', textAlign: 'left', padding: 14, cursor: 'pointer', opacity: 0.92,
      background: selected ? 'rgba(34,197,94,0.1)' : undefined,
      borderColor: selected ? 'var(--ok)' : 'var(--line)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{competitor.name}</p>
            <ChevronRight size={13} style={{ opacity: selected ? 1 : 0 }} />
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-2)' }}>{competitor.party} · {competitor.role}</p>
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: 'var(--ok)' }}>✓ endorsed</span>
      </div>
      {competitor.messaging_profile?.endorsement && (
        <p style={{ margin: '8px 0 0', fontSize: 11, fontStyle: 'italic', color: 'var(--ok)' }}>
          {competitor.messaging_profile.endorsement}
        </p>
      )}
    </button>
  );
}

function ActivityRow({ activity, onCounterStrike }: { activity: Activity; onCounterStrike: (a: Activity, e: React.MouseEvent) => void }) {
  const isMention = mentionsCandidate(activity);
  const isEndorsement = activity.activity_type === 'endorsement' || activity.sentiment === 'positive';
  const isActionable = activity.threat_level === 'high' || activity.threat_level === 'critical';

  return (
    <div style={{
      padding: 14, borderRadius: 8,
      background: isMention ? 'linear-gradient(135deg, rgba(251,191,36,0.06), var(--bg-2))' : 'var(--bg-2)',
      borderLeft: isMention ? '3px solid #fbbf24' : '3px solid transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-0)', color: 'var(--ink-2)' }}>
            {activity.activity_type?.replaceAll('_', ' ') || 'activity'}
          </span>
          {activity.threat_level && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${THREAT_STYLES[activity.threat_level]}`}>
              {activity.threat_level}
            </span>
          )}
          {activity.platform && (
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-0)', color: 'var(--ink-2)' }}>
              {PLATFORM_LABELS[activity.platform] || activity.platform}
            </span>
          )}
          {isMention && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Target size={10} /> MENTIONS CANDIDATE
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{timeAgo(activity.detected_at)}</span>
      </div>

      <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--ink-1)', lineHeight: 1.5 }}>
        <HighlightMentions text={activity.summary} />
      </p>

      {activity.raw_content && (
        <div style={{ padding: 8, borderRadius: 6, background: 'var(--bg-0)', borderLeft: '2px solid var(--line)', marginBottom: 8 }}>
          <p style={{ margin: 0, fontSize: 11, fontStyle: 'italic', color: 'var(--ink-2)', lineHeight: 1.55 }}>
            &ldquo;<HighlightMentions text={activity.raw_content.substring(0, 200) + (activity.raw_content.length > 200 ? '…' : '')} />&rdquo;
          </p>
        </div>
      )}

      {activity.topics && activity.topics.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {activity.topics.map((t, i) => (
            <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-0)', color: '#60a5fa' }}>{t.replaceAll('_', ' ')}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {activity.requires_response && (
          <div style={{ padding: 8, borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', flex: 1, minWidth: 200 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: 'var(--warn)' }}>
              <AlertTriangle size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
              Response recommended
            </p>
            {activity.suggested_response && (
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-1)' }}>{activity.suggested_response}</p>
            )}
          </div>
        )}
        {isActionable && !isEndorsement && (
          <button onClick={(e) => onCounterStrike(activity, e)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: 'var(--accent)', color: 'white', border: 0, cursor: 'pointer', marginLeft: 'auto',
          }}>
            <Zap size={12} fill="currentColor" /> Draft counter-strike
          </button>
        )}
        {activity.source_url && (
          <a href={activity.source_url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#60a5fa', textDecoration: 'none', marginLeft: (!isActionable || isEndorsement) ? 'auto' : undefined }}>
            <ExternalLink size={11} /> View original
          </a>
        )}
      </div>
    </div>
  );
}

function CounterStrikeModal({ activity, result, onClose }: { activity: Activity; result: StrikeResult | null; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div className="wb-panel" style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: 'var(--bad)' }} />
            <h3 style={{ margin: 0, fontWeight: 700 }}>AI counter-strike generator</h3>
          </div>
          <button onClick={onClose} className="wb-btn" style={{ padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 14, background: 'rgba(220,38,38,0.08)', borderBottom: '1px solid rgba(220,38,38,0.2)', fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: '#f87171', marginRight: 8 }}>Target activity:</span>
          <span style={{ color: 'var(--ink-1)' }}>{activity.summary}</span>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {!result ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 48 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', border: '4px solid rgba(239,68,68,0.2)', borderTopColor: 'var(--bad)', marginBottom: 14 }} className="animate-spin" />
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f87171' }}>Weaponizing response…</p>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ink-2)' }}>Analyzing opponent weakness. Drafting X post and press release.</p>
            </div>
          ) : result.error ? (
            <div style={{ color: '#f87171' }}>{result.error}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <StrikeBlock label="X post draft"              tone="#60a5fa" content={result.tweet} />
              <StrikeBlock label="Fundraising email segment" tone="var(--ok)" content={result.email} />
              <StrikeBlock label="Press quote"               tone="var(--ink-2)" content={`"${result.quote}"`} italic />
            </div>
          )}
        </div>

        <div style={{ padding: 14, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--bg-2)' }}>
          <button onClick={onClose} className="wb-btn">Discard</button>
          <button disabled={!result || !!result.error} className="wb-btn wb-btn-rapid" style={{ opacity: (!result || result.error) ? 0.5 : 1 }}>
            <Target size={14} /> Send to content queue
          </button>
        </div>
      </div>
    </div>
  );
}

function StrikeBlock({ label, content, tone, italic }: { label: string; content?: string; tone: string; italic?: boolean }) {
  return (
    <div>
      <h4 className="wb-eyebrow" style={{ color: tone, marginBottom: 8 }}>{label}</h4>
      <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--line)', fontSize: 13, whiteSpace: 'pre-wrap', fontStyle: italic ? 'italic' : 'normal', borderLeft: italic ? '3px solid var(--ink-2)' : undefined }}>
        {content || '—'}
      </div>
    </div>
  );
}
