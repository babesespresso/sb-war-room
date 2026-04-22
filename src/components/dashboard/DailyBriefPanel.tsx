'use client';

import { useState, useEffect } from 'react';
import { Sun, ChevronDown, ChevronUp, RefreshCw, ExternalLink } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';

// Parse a line of markdown-like text and render [label](url) as clickable links,
// **bold** as <strong>, and plain text otherwise. Bare URLs are also linkified.
function renderInline(text: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(\*\*([^*]+)\*\*)|(https?:\/\/[^\s)]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1] && match[2]) {
      nodes.push(
        <a key={key++} href={match[2]} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline decoration-dotted hover:decoration-solid transition-colors"
          style={{ color: 'var(--campaign-gold, #f59e0b)' }}>
          {match[1]}<ExternalLink className="w-3 h-3" />
        </a>
      );
    } else if (match[3]) {
      nodes.push(<strong key={key++} style={{ color: 'var(--text-primary)' }}>{match[4]}</strong>);
    } else if (match[5]) {
      nodes.push(
        <a key={key++} href={match[5]} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline decoration-dotted hover:decoration-solid"
          style={{ color: 'var(--campaign-gold, #f59e0b)' }}>
          {match[5]}<ExternalLink className="w-3 h-3" />
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return <>{nodes}</>;
}

export default function DailyBriefPanel() {
  const [brief, setBrief] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchBrief() {
      try {
        const res = await fetch('/api/intel?type=brief');
        if (res.ok) {
          const data = await res.json();
          setBrief(data);
        }
      } catch (err) {
        console.error('Failed to fetch brief:', err);
      }
      setLoading(false);
    }
    fetchBrief();
  }, []);

  const triggerBrief = async () => {
    setLoading(true);
    try {
      await fetch('/api/cron?agent=daily_brief', {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'dev'}` },
      });
      // Re-fetch after generation
      const res = await fetch('/api/intel?type=brief');
      if (res.ok) setBrief(await res.json());
    } catch (err) {
      console.error('Failed to trigger brief:', err);
    }
    setLoading(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden glass-panel relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
      {/* Header */}
      <div className="flex items-center justify-between p-6 cursor-pointer relative z-10" onClick={() => setExpanded(!expanded)}
        style={{ borderBottom: expanded ? '1px solid var(--border-color)' : 'none' }}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <Sun className="w-5 h-5" style={{ color: 'var(--campaign-gold)', filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.6))' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">Daily Brief <InfoTooltip text="AI-generated daily intelligence summary covering news, competitor activity, and recommended campaign actions. Auto-generated at 7:00 AM or on demand." /></h2>
            <p className="text-[11px] uppercase tracking-widest font-bold mt-1 text-slate-400">
              {brief?.brief_date ? new Date(brief.brief_date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
              }) : 'No brief generated yet'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); triggerBrief(); }}
            className="p-2 rounded-lg transition-all hover:bg-white/10"
            style={{ background: 'rgba(255,255,255,0.05)' }}
            title="Generate new brief">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-secondary)' }} />
          </button>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-6 relative z-10 bg-black/20">
          {loading ? (
            <div className="space-y-3">
              {[92, 78, 85, 71, 89, 76].map((w, i) => (
                <div key={i} className="h-4 rounded animate-pulse" style={{
                  background: 'var(--surface-2)',
                  width: `${w}%`
                }} />
              ))}
            </div>
          ) : brief?.brief_markdown ? (
            <div className="prose prose-invert max-w-none text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}>
              {brief.brief_markdown.split('\n').map((line: string, i: number) => {
                if (line.startsWith('## ')) {
                  return (
                    <h3 key={i} className="text-base font-bold mt-5 mb-2 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif' }}>
                      {renderInline(line.replace('## ', ''))}
                    </h3>
                  );
                }
                if (line.startsWith('- ')) {
                  return (
                    <div key={i} className="flex gap-2 ml-2 mb-1">
                      <span style={{ color: 'var(--campaign-red)' }}>+</span>
                      <span>{renderInline(line.replace('- ', ''))}</span>
                    </div>
                  );
                }
                if (line.trim() === '') return <div key={i} className="h-2" />;
                return <p key={i} className="mb-1">{renderInline(line)}</p>;
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Sun className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-medium mb-1">No brief generated yet</p>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Click the refresh button or wait for the 7:00 AM scheduled run.
              </p>
              <button onClick={triggerBrief}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--campaign-red)', color: 'white' }}>
                Generate Brief Now
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
