'use client';

import { useState, useEffect } from 'react';
import { FileText, ThumbsUp, ThumbsDown, Pencil, Clock, Send, Instagram } from 'lucide-react';
import XIcon from '@/components/icons/XIcon';
import FacebookIcon from '@/components/icons/FacebookIcon';
import InfoTooltip from '@/components/ui/InfoTooltip';

const PLATFORM_ICONS: Record<string, any> = {
  twitter: XIcon,
  facebook: FacebookIcon,
  instagram: Instagram,
};

const STATUS_STYLES: Record<string, string> = {
  pending_review: 'status-pending',
  approved: 'status-approved',
  rejected: 'status-rejected',
  published: 'status-published',
  draft: 'status-draft',
};

export default function ContentQueuePanel() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending_review');

  useEffect(() => {
    fetchDrafts();
  }, [filter]);

  async function fetchDrafts() {
    setLoading(true);
    try {
      const res = await fetch(`/api/content?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setDrafts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
    }
    setLoading(false);
  }

  async function handleAction(draftId: string, action: string) {
    try {
      await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, draft_id: draftId }),
      });
      fetchDrafts();
    } catch (err) {
      console.error('Action failed:', err);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden glass-panel relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 gap-4 relative z-10" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <FileText className="w-5 h-5" style={{ color: '#60a5fa', filter: 'drop-shadow(0 0 8px rgba(96,165,250,0.6))' }} />
          </div>
          <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">Content Queue <InfoTooltip text="AI-generated social media posts awaiting your review. Approve, edit, or reject drafts before publishing to X, Facebook, and Instagram." /></h2>
        </div>
        <div className="flex gap-1 p-1 rounded-xl glass-subpanel shadow-inner overflow-x-auto w-full sm:w-auto" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {['pending_review', 'approved', 'published', 'rejected'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap"
              style={{
                background: filter === f ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: filter === f ? 'white' : 'var(--text-muted)',
                boxShadow: filter === f ? '0 2px 4px rgba(0,0,0,0.5)' : 'none',
                border: filter === f ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
              }}>
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-h-[500px] overflow-y-auto relative z-10 bg-black/20 custom-scrollbar">
        {loading ? (
          <div className="space-y-3 p-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-10">
            <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No {filter.replaceAll('_', ' ')} content</p>
          </div>
        ) : (
          <div className="space-y-2">
            {drafts.map((draft) => {
              const PlatformIcon = PLATFORM_ICONS[draft.platform] || Send;
              return (
                <div key={draft.id} className="p-4 rounded-lg transition-all hover:brightness-110"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)' }}>

                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PlatformIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>
                        {draft.content_type?.replace('social_', '').replaceAll('_', ' ')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[draft.status] || ''}`}>
                        {draft.status?.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Clock className="w-3 h-3" />
                      {new Date(draft.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                    {draft.body?.substring(0, 280)}
                    {draft.body?.length > 280 ? '...' : ''}
                  </p>

                  {draft.strategic_rationale && (
                    <p className="text-xs italic mb-3" style={{ color: 'var(--text-muted)' }}>
                      Strategy: {draft.strategic_rationale}
                    </p>
                  )}

                  {filter === 'pending_review' && (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleAction(draft.id, 'approve')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110"
                        style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' }}>
                        <ThumbsUp className="w-3 h-3" /> Approve
                      </button>
                      <button onClick={() => handleAction(draft.id, 'revise')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110"
                        style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d' }}>
                        <Pencil className="w-3 h-3" /> Revise
                      </button>
                      <button onClick={() => handleAction(draft.id, 'reject')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110"
                        style={{ background: 'rgba(220, 38, 38, 0.2)', color: '#fca5a5' }}>
                        <ThumbsDown className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
