'use client';

import { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, AlertCircle, ArrowUpRight, Target } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';

function mentionsCandidate(item: any): boolean {
  const text = `${item.headline || ''} ${item.summary || ''}`.toLowerCase();
  return text.includes('scott bottoms');
}

/** Highlight "Scott Bottoms" in the text (full name only for news context) */
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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NewsFeed() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/intel?type=news');
        if (res.ok) {
          const data = await res.json();
          setNews(Array.isArray(data) ? data.slice(0, 8) : []);
        }
      } catch (err) {
        console.error('Failed to fetch news:', err);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const urgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'var(--campaign-red)';
      case 'high': return 'var(--campaign-gold)';
      case 'medium': return '#60a5fa';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden glass-panel relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
      <div className="flex items-center gap-3 p-6 relative z-10" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: 'rgba(96, 165, 250, 0.15)', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
          <Newspaper className="w-5 h-5" style={{ color: '#60a5fa', filter: 'drop-shadow(0 0 8px rgba(96,165,250,0.6))' }} />
        </div>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">News Pulse <InfoTooltip text="Live feed of Colorado political news relevant to the campaign. Articles mentioning Scott Bottoms are highlighted in gold. Click any headline to read the full source." /></h2>
          <p className="text-[11px] uppercase tracking-widest font-bold mt-1 text-slate-400">Colorado news feed</p>
        </div>
      </div>

      <div className="p-6 max-h-[450px] overflow-y-auto relative z-10 bg-black/20 custom-scrollbar">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-8">
            <Newspaper className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No news items yet. Run the news pulse agent.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {news.map((item) => {
              const hasLink = !!item.source_url;
              const isMention = mentionsCandidate(item);
              const CardTag = hasLink ? 'a' : 'div';
              const linkProps = hasLink
                ? { href: item.source_url, target: '_blank', rel: 'noopener noreferrer' }
                : {};

              return (
                <CardTag
                  key={item.id}
                  {...linkProps}
                  className={`block p-4 rounded-xl transition-all group glass-subpanel shadow-inner border border-white/5 ${hasLink ? 'cursor-pointer hover:bg-white/5' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {item.response_opportunity && (
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: urgencyColor(item.response_urgency) }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">
                        <HighlightMentions text={item.headline} />
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.source_name}</span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: item.relevance_score > 70 ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-0)',
                            color: item.relevance_score > 70 ? '#6ee7b7' : 'var(--text-muted)',
                          }}>
                          {item.relevance_score}
                        </span>
                        {item.published_at && (
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {timeAgo(item.published_at)}
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
                    </div>
                    {hasLink && (
                      <ArrowUpRight
                        className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--navy-400)' }}
                      />
                    )}
                  </div>
                </CardTag>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
