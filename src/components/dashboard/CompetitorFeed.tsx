'use client';

import { useState, useEffect } from 'react';
import { Swords, ExternalLink, Shield, Target, AlertTriangle, ThumbsUp, Zap, Sparkles, X } from 'lucide-react';
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

/** Highlight only exact mentions of "Scott Bottoms" to eliminate false positives */
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

export default function CompetitorFeed() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [striking, setStriking] = useState<any>(null); // holds the activity being retaliated against
  const [strikeResult, setStrikeResult] = useState<any>(null); // holds generated content

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/intel?type=activities');
        if (res.ok) {
          const data = await res.json();
          setActivities(Array.isArray(data) ? data.slice(0, 10) : []);
        }
      } catch (err) {
        console.error('Failed to fetch competitor activities:', err);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

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
    <div className="rounded-2xl overflow-hidden glass-panel relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
      <div className="flex items-center justify-between p-6 relative z-10" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <Swords className="w-5 h-5" style={{ color: '#f87171', filter: 'drop-shadow(0 0 8px rgba(248,113,113,0.6))' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">Competitor Watch <InfoTooltip text="Tracks public activity from competing gubernatorial campaigns. Click any item to view the source. Use AI Counter-Strike to generate rapid response messaging." /></h2>
            <p className="text-[11px] uppercase tracking-widest font-bold mt-1 text-slate-400">Recent activity</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-h-[450px] overflow-y-auto relative z-10 bg-black/20 custom-scrollbar">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No competitor activity detected yet.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {activities.map((activity) => {
              const isMention = mentionsCandidate(activity);
              const hasLink = !!activity.source_url;
              const isEndorsement = activity.activity_type === 'endorsement' || activity.sentiment === 'positive';
              const isActionable = activity.threat_level === 'high' || activity.threat_level === 'critical';

              return (
                <div
                  key={activity.id}
                  className="block p-4 rounded-xl transition-all glass-subpanel shadow-inner hover:bg-white/5 border border-white/5"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold" style={{ color: 'var(--campaign-red)' }}>
                        {activity.competitor?.name || 'Unknown'}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${THREAT_STYLES[activity.threat_level] || ''}`}>
                        {activity.threat_level}
                      </span>
                      {activity.platform && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'var(--surface-0)', color: 'var(--text-muted)' }}
                        >
                          {PLATFORM_ICONS[activity.platform] || ''} {activity.platform}
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
                      {isEndorsement && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-0.5"
                          style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}
                        >
                          <ThumbsUp className="w-2.5 h-2.5" />
                          ENDORSEMENT
                        </span>
                      )}
                    </div>
                    <span className="text-xs flex-shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>
                      {timeAgo(activity.detected_at)}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <HighlightMentions text={activity.summary?.substring(0, 180) + (activity.summary?.length > 180 ? '...' : '')} />
                  </p>

                  <div className="flex items-center gap-3 mt-2">
                    {activity.requires_response && (
                      <div className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--campaign-gold)' }}>
                        <AlertTriangle className="w-3 h-3" />
                        Response recommended
                      </div>
                    )}
                    {isActionable && !isEndorsement && (
                      <button 
                         onClick={(e) => handleCounterStrike(activity, e)}
                         className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded bg-red-600 hover:bg-red-500 text-white shadow-sm transition-colors"
                      >
                         <Zap className="w-3 h-3" fill="currentColor" />
                         Draft Counter-Strike
                      </button>
                    )}
                    {hasLink && (
                      <a href={activity.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs ml-auto hover:underline" style={{ color: 'var(--navy-400)' }}>
                        <ExternalLink className="w-3 h-3" />
                        View source
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Counter-Strike Modal */}
      {striking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="full-width max-w-2xl w-full rounded-2xl shadow-2xl flex flex-col glass-panel" style={{ maxHeight: '90vh' }}>
            <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
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
