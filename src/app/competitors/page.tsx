'use client';

import { useState, useEffect } from 'react';
import { Swords, Shield, ExternalLink, AlertTriangle, Target, ChevronRight, Heart, ThumbsUp, Zap, Sparkles, X } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';

const THREAT_STYLES: Record<string, string> = {
  critical: 'threat-critical',
  high: 'threat-high',
  medium: 'threat-medium',
  low: 'threat-low',
};

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '𝕏',
  facebook: 'f',
  news: '📰',
  website: '🌐',
};

/** Highlight only exact "Scott Bottoms" to eliminate false positives */
function HighlightMentions({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(/(Scott\s+Bottoms)/gi);
  return (
    <>
      {parts.map((part, i) =>
        /^Scott\s+Bottoms$/i.test(part) ? (
          <span
            key={i}
            className="font-semibold px-0.5 rounded"
            style={{
              background: 'rgba(251, 191, 36, 0.15)',
              color: '#fbbf24',
              borderBottom: '1px solid rgba(251, 191, 36, 0.4)',
            }}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function mentionsCandidate(activity: any): boolean {
  const text = `${activity.summary || ''} ${activity.raw_content || ''}`.toLowerCase();
  return text.includes('scott bottoms');
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMentions, setFilterMentions] = useState(false);
  const [striking, setStriking] = useState<any>(null);
  const [strikeResult, setStrikeResult] = useState<any>(null);

  useEffect(() => {
    async function fetch_data() {
      try {
        const res = await fetch('/api/intel?type=competitors');
        if (res.ok) {
          const data = await res.json();
          setCompetitors(Array.isArray(data) ? data : []);
        }
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    fetch_data();
  }, []);

  useEffect(() => {
    if (!selected) return;
    async function fetchActivities() {
      try {
        const res = await fetch(`/api/intel?type=activities&competitor_id=${selected}`);
        if (res.ok) setActivities(await res.json());
      } catch (err) { console.error(err); }
    }
    fetchActivities();
  }, [selected]);

  // Sort competitors: active candidates first, endorsers at bottom
  const sortedCompetitors = [...competitors].sort((a, b) => {
    if (a.role === 'endorser' && b.role !== 'endorser') return 1;
    if (a.role !== 'endorser' && b.role === 'endorser') return -1;
    const threatOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (threatOrder[a.threat_level] ?? 4) - (threatOrder[b.threat_level] ?? 4);
  });

  const displayedActivities = filterMentions
    ? activities.filter(mentionsCandidate)
    : activities;

  const mentionCount = activities.filter(mentionsCandidate).length;

  const handleCounterStrike = async (activity: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStriking(activity);
    setStrikeResult(null);

    try {
      const res = await fetch('/api/ai/counter-strike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity })
      });
      if (res.ok) {
        setStrikeResult(await res.json());
      } else {
        setStrikeResult({ error: 'Failed to generate response' });
      }
    } catch (e) {
      setStrikeResult({ error: 'Network error generating response' });
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--surface-0)' }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">Competitor Tracking <InfoTooltip text="Full intelligence view of competing gubernatorial campaigns. Monitor their public activity, threat levels, and generate AI-powered counter-strike responses." /></h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Monitor opponent messaging, activity, and threat levels
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Competitor List */}
        <div className="col-span-1 lg:col-span-4 space-y-3">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />
            ))
          ) : competitors.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
              <Swords className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm mb-1">No competitors added yet</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Add competitors to start monitoring.</p>
            </div>
          ) : (
            <>
              {/* Active candidates */}
              {sortedCompetitors.filter(c => c.role !== 'endorser').length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Active Competitors</p>
              )}
              {sortedCompetitors.filter(c => c.role !== 'endorser').map((comp) => (
                <button key={comp.id} onClick={() => { setSelected(comp.id); setFilterMentions(false); }}
                  className="w-full text-left p-4 rounded-xl transition-all hover:brightness-110"
                  style={{
                    background: selected === comp.id ? 'var(--navy-800)' : 'var(--surface-1)',
                    border: `1px solid ${selected === comp.id ? 'var(--campaign-red)' : 'var(--border-color)'}`,
                  }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{comp.name}</p>
                        <ChevronRight className="w-3.5 h-3.5" style={{ opacity: selected === comp.id ? 1 : 0 }} />
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{comp.party} | {comp.role}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${THREAT_STYLES[comp.threat_level]}`}>
                      {comp.threat_level}
                    </span>
                  </div>
                  {comp.messaging_profile?.core_themes?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {comp.messaging_profile.core_themes.slice(0, 3).map((theme: string, i: number) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                          {theme}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}

              {/* Endorsers section */}
              {sortedCompetitors.filter(c => c.role === 'endorser').length > 0 && (
                <>
                  <div className="mt-4 mb-1 flex items-center gap-2">
                    <ThumbsUp className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#22c55e' }}>Endorsers & Allies</p>
                  </div>
                  {sortedCompetitors.filter(c => c.role === 'endorser').map((comp) => (
                    <button key={comp.id} onClick={() => { setSelected(comp.id); setFilterMentions(false); }}
                      className="w-full text-left p-4 rounded-xl transition-all hover:brightness-110"
                      style={{
                        background: selected === comp.id ? 'rgba(34, 197, 94, 0.1)' : 'var(--surface-1)',
                        border: `1px solid ${selected === comp.id ? '#22c55e' : 'var(--border-color)'}`,
                        opacity: 0.9,
                      }}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{comp.name}</p>
                            <ChevronRight className="w-3.5 h-3.5" style={{ opacity: selected === comp.id ? 1 : 0 }} />
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{comp.party} | {comp.role}</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded font-semibold" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                          ✓ endorsed
                        </span>
                      </div>
                      {comp.messaging_profile?.endorsement && (
                        <p className="text-xs mt-2 italic" style={{ color: '#22c55e' }}>
                          {comp.messaging_profile.endorsement}
                        </p>
                      )}
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Activity Feed */}
        <div className="col-span-1 lg:col-span-8">
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
            <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <h2 className="text-lg font-bold">
                {selected ? `Activity Feed: ${competitors.find(c => c.id === selected)?.name}` : 'Select a competitor'}
              </h2>
              {selected && mentionCount > 0 && (
                <button
                  onClick={() => setFilterMentions(!filterMentions)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: filterMentions ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.08)',
                    color: '#fbbf24',
                    border: `1px solid ${filterMentions ? 'rgba(251, 191, 36, 0.5)' : 'rgba(251, 191, 36, 0.2)'}`,
                  }}
                >
                  <Target className="w-3 h-3" />
                  {filterMentions ? 'Show All' : `${mentionCount} mention${mentionCount !== 1 ? 's' : ''} of Scott Bottoms`}
                </button>
              )}
            </div>
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {!selected ? (
                <div className="text-center py-16">
                  <Shield className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a competitor to view their activity</p>
                </div>
              ) : displayedActivities.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {filterMentions ? 'No activities mentioning Scott Bottoms' : 'No activity recorded yet'}
                  </p>
                </div>
              ) : (
                displayedActivities.map((act) => {
                  const isMention = mentionsCandidate(act);
                  const hasLink = !!act.source_url;
                  const isEndorsement = act.activity_type === 'endorsement' || act.sentiment === 'positive';
                  const isActionable = act.threat_level === 'high' || act.threat_level === 'critical';

                  return (
                    <div
                      key={act.id}
                      className="block p-4 rounded-lg transition-all group"
                      style={{
                        background: isMention
                          ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.06), var(--surface-2))'
                          : 'var(--surface-2)',
                        borderLeft: isMention ? '3px solid #fbbf24' : '3px solid transparent',
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium uppercase px-2 py-0.5 rounded"
                            style={{ background: 'var(--surface-0)', color: 'var(--text-muted)' }}>
                            {act.activity_type?.replaceAll('_', ' ')}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${THREAT_STYLES[act.threat_level]}`}>
                            {act.threat_level}
                          </span>
                          {act.platform && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                              style={{ background: 'var(--surface-0)', color: 'var(--text-muted)' }}
                            >
                              {PLATFORM_ICONS[act.platform] || ''} {act.platform}
                            </span>
                          )}
                          {isMention && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-0.5"
                              style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}
                            >
                              <Target className="w-2.5 h-2.5" />
                              MENTIONS CANDIDATE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {timeAgo(act.detected_at)}
                          </span>
                          {hasLink && (
                            <ExternalLink
                              className="w-3.5 h-3.5 transition-opacity opacity-0 group-hover:opacity-100"
                              style={{ color: 'var(--navy-400)' }}
                            />
                          )}
                        </div>
                      </div>

                      <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                        <HighlightMentions text={act.summary} />
                      </p>

                      {act.raw_content && (
                        <div className="px-3 py-2 rounded-md mb-2" style={{ background: 'var(--surface-0)', borderLeft: '2px solid var(--border-color)' }}>
                          <p className="text-xs italic leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            &ldquo;<HighlightMentions text={act.raw_content.substring(0, 200) + (act.raw_content.length > 200 ? '...' : '')} />&rdquo;
                          </p>
                        </div>
                      )}

                      {act.topics?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {act.topics.map((t: string, i: number) => (
                            <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-0)', color: 'var(--navy-400)' }}>
                              {t.replaceAll('_', ' ')}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        {act.requires_response && (
                          <div className="p-2 rounded-lg flex-1" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                            <p className="text-xs font-medium" style={{ color: 'var(--campaign-gold)' }}>
                              <AlertTriangle className="w-3 h-3 inline mr-1" />Response Recommended
                            </p>
                            {act.suggested_response && (
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{act.suggested_response}</p>
                            )}
                          </div>
                        )}
                        {isActionable && !isEndorsement && (
                          <button 
                             onClick={(e) => handleCounterStrike(act, e)}
                             className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-red-600 hover:bg-red-500 text-white shadow-sm transition-colors ml-auto mr-3"
                          >
                             <Zap className="w-3.5 h-3.5" fill="currentColor" />
                             Draft Counter-Strike
                          </button>
                        )}
                        {hasLink && (
                          <a href={act.source_url} target="_blank" rel="noopener noreferrer" className={`text-xs flex items-center gap-1 hover:underline ${!isActionable || isEndorsement ? 'ml-auto' : ''}`} style={{ color: 'var(--navy-400)' }}>
                            <ExternalLink className="w-3 h-3" />
                            View original
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Counter-Strike Modal */}
      {striking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="full-width max-w-2xl w-full rounded-xl shadow-2xl flex flex-col" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)', maxHeight: '90vh' }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-red-500" />
                <h3 className="font-bold">AI Counter-Strike Generator</h3>
              </div>
              <button onClick={() => setStriking(null)} className="p-1 hover:bg-white/10 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 bg-red-900/10 border-b border-red-900/20 text-sm">
              <span className="font-bold text-red-400 mr-2">Target Activity:</span>
              <span className="text-gray-300">{striking.summary}</span>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {!strikeResult ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-full border-4 border-red-500/20 border-t-red-500 animate-spin mb-4" />
                  <p className="text-lg font-bold text-red-400">Weaponizing Response...</p>
                  <p className="text-sm mt-2 text-gray-400">Analyzing opponent weakness. Drafting X post and Press Release.</p>
                </div>
              ) : strikeResult.error ? (
                <div className="text-red-400">{strikeResult.error}</div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">X Post Draft</h4>
                    <div className="p-4 rounded-lg bg-surface-2 border border-border-color text-sm whitespace-pre-wrap">
                      {strikeResult.tweet}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-green-400 mb-2">Fundraising Email Segment</h4>
                    <div className="p-4 rounded-lg bg-surface-2 border border-border-color text-sm whitespace-pre-wrap">
                      {strikeResult.email}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Press Quote</h4>
                    <div className="p-4 rounded-lg bg-surface-2 border border-border-color text-sm whitespace-pre-wrap italic border-l-4 border-l-gray-500">
                      "{strikeResult.quote}"
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border-color)', background: 'var(--surface-2)' }}>
              <button 
                onClick={() => setStriking(null)}
                className="px-4 py-2 rounded-md text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Discard
              </button>
              <button 
                disabled={!strikeResult}
                className="px-4 py-2 rounded-md text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Target className="w-4 h-4" /> Send to Content Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
