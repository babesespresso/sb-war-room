'use client';

import { useState, useEffect } from 'react';
import { FileText, ThumbsUp, ThumbsDown, Pencil, Clock, Send, Filter, Plus, Save, X } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';

function DraftCard({ draft, onAction }: { draft: any, onAction: (id: string, action: string, updates?: any) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(draft.body);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onAction(draft.id, 'edit', { body: editedBody });
    setIsEditing(false);
    setSaving(false);
    // Note: onAction will typically refetch drafts, but we update locally by calling onAction
  };

  return (
    <div className="p-5 rounded-xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase px-2 py-0.5 rounded"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            {draft.content_type?.replace('social_', '').replaceAll('_', ' ')}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium status-${draft.status?.split('_')[0]}`}>
            {draft.status?.replaceAll('_', ' ')}
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {new Date(draft.created_at).toLocaleString()}
        </span>
      </div>

      {isEditing ? (
        <div className="mb-3 space-y-2">
          <textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            className="w-full h-32 p-3 rounded-lg text-sm bg-black/20 focus:outline-none focus:ring-1"
            style={{ border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          />
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md text-white border" style={{ background: 'var(--campaign-red)', borderColor: 'transparent' }}>
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setIsEditing(false); setEditedBody(draft.body); }} disabled={saving} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
          {draft.body}
        </p>
      )}

      {draft.hashtags && draft.hashtags.length > 0 && !isEditing && (
        <p className="text-xs font-bold text-blue-400 mb-3">{draft.hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ')}</p>
      )}

      {draft.strategic_rationale && (
        <p className="text-xs italic mb-3 p-2 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
          {draft.strategic_rationale}
        </p>
      )}

      {draft.status === 'pending_review' && !isEditing && (
        <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
          <button onClick={() => onAction(draft.id, 'approve')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium hover:brightness-110"
            style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' }}>
            <ThumbsUp className="w-3.5 h-3.5" /> Approve
          </button>
          <button onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium hover:brightness-110"
            style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd' }}>
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={() => onAction(draft.id, 'revise')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium hover:brightness-110"
            style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d' }}>
            <Pencil className="w-3.5 h-3.5" /> Revise
          </button>
          <button onClick={() => onAction(draft.id, 'reject')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium hover:brightness-110"
            style={{ background: 'rgba(220, 38, 38, 0.2)', color: '#fca5a5' }}>
            <ThumbsDown className="w-3.5 h-3.5" /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default function ContentPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetchDrafts();
  }, [filter, typeFilter]);

  async function fetchDrafts() {
    setLoading(true);
    try {
      let url = '/api/content?';
      if (filter !== 'all') url += `status=${filter}&`;
      if (typeFilter !== 'all') url += `type=${typeFilter}`;
      const res = await fetch(url);
      if (res.ok) setDrafts(await res.json());
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function handleAction(id: string, action: string, extraBodyParams: any = {}) {
    await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, draft_id: id, ...extraBodyParams }),
    });
    fetchDrafts();
  }

  const statuses = ['all', 'pending_review', 'approved', 'scheduled', 'published', 'rejected'];
  const types = ['all', 'social_twitter', 'social_facebook', 'social_instagram', 'email', 'rapid_response'];

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--surface-0)' }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">Content Queue <InfoTooltip text="Full content management system for all AI-generated campaign posts. Filter by status and platform type, then approve, revise, or reject before publishing." /></h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Review, approve, and track all campaign content</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface-1)' }}>
          {statuses.map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: filter === s ? 'var(--navy-800)' : 'transparent',
                color: filter === s ? 'white' : 'var(--text-muted)',
              }}>
              {s === 'all' ? 'All' : s.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface-1)' }}>
          {types.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: typeFilter === t ? 'var(--navy-800)' : 'transparent',
                color: typeFilter === t ? 'white' : 'var(--text-muted)',
              }}>
              {t === 'all' ? 'All Types' : t.replace('social_', '').replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />
          ))
        ) : drafts.length === 0 ? (
          <div className="col-span-2 text-center py-16 rounded-xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
            <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm">No content matching these filters</p>
          </div>
        ) : (
          drafts.map((draft) => (
            <DraftCard key={draft.id} draft={draft} onAction={handleAction} />
          ))
        )}
      </div>
    </div>
  );
}
