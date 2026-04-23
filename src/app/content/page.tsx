'use client';

/**
 * Content — draft queue for all AI-generated campaign posts.
 *
 * Endpoints called:
 *   GET  /api/content?status=<status>&type=<type>   → Draft[]
 *   POST /api/content  { action, draft_id, ...updates }
 *     action: 'approve' | 'reject' | 'revise' | 'edit'
 *
 * Preserves: status/type filter chips, inline edit + save, approve/revise/
 * reject actions, empty state.
 */

import { useEffect, useState } from 'react';
import { FileText, ThumbsUp, ThumbsDown, Pencil, Save, X } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import PageHeader from '@/components/layout/PageHeader';

interface Draft {
  id: string;
  content_type: string;
  status: string;
  body: string;
  hashtags?: string[];
  strategic_rationale?: string;
  created_at: string;
}

type DraftAction = 'approve' | 'reject' | 'revise' | 'edit';

const STATUSES = ['all', 'pending_review', 'approved', 'scheduled', 'published', 'rejected'];
const TYPES = ['all', 'social_twitter', 'social_facebook', 'social_instagram', 'email', 'rapid_response'];

export default function ContentPage() {
  const [drafts, setDrafts]       = useState<Draft[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const res = await fetch(`/api/content?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDrafts(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDrafts(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter, typeFilter]);

  // global refresh hook
  useEffect(() => {
    const h = () => fetchDrafts();
    window.addEventListener('warroom:refresh', h);
    return () => window.removeEventListener('warroom:refresh', h);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [filter, typeFilter]);

  const handleAction = async (id: string, action: DraftAction, extra: Record<string, any> = {}) => {
    await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, draft_id: id, ...extra }),
    });
    fetchDrafts();
  };

  const titleCase = (s: string) => s.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div style={{ padding: 'var(--pad-section)', display: 'flex', flexDirection: 'column', gap: 'var(--gap)', background: 'var(--bg-0)' }}>
      <PageHeader
        eyebrow="Operations · Drafts"
        title={<>Content queue <InfoTooltip text="Full content management system for all AI-generated campaign posts. Filter by status and platform type, then approve, revise, or reject before publishing." /></>}
        subtitle="Review, approve, and track all campaign content."
      />

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <ChipGroup items={STATUSES} value={filter} onChange={setFilter} fmt={(v) => v === 'all' ? 'All status' : titleCase(v)} />
        <ChipGroup items={TYPES} value={typeFilter} onChange={setTypeFilter} fmt={(v) => v === 'all' ? 'All types' : titleCase(v.replace('social_', ''))} />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 160, borderRadius: 12, background: 'var(--bg-1)' }} className="animate-pulse" />
          ))
        ) : drafts.length === 0 ? (
          <div className="wb-panel" style={{ gridColumn: '1 / -1', padding: 48, textAlign: 'center' }}>
            <FileText size={40} style={{ color: 'var(--ink-2)', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>No content matching these filters</p>
          </div>
        ) : (
          drafts.map(draft => <DraftCard key={draft.id} draft={draft} onAction={handleAction} />)
        )}
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({ items, value, onChange, fmt }: { items: readonly T[]; value: T; onChange: (v: T) => void; fmt: (v: T) => string }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'var(--bg-1)', border: '1px solid var(--line)' }}>
      {items.map(item => (
        <button
          key={item}
          onClick={() => onChange(item)}
          style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
            background: value === item ? 'var(--bg-2)' : 'transparent',
            color: value === item ? 'var(--ink-0)' : 'var(--ink-2)',
            border: 0, cursor: 'pointer',
          }}
        >
          {fmt(item)}
        </button>
      ))}
    </div>
  );
}

function DraftCard({ draft, onAction }: { draft: Draft; onAction: (id: string, action: DraftAction, extra?: Record<string, any>) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody]       = useState(draft.body);
  const [saving, setSaving]   = useState(false);

  const statusTone =
    draft.status === 'approved'       ? { bg: 'rgba(16,185,129,0.15)', fg: 'var(--ok)' }
    : draft.status === 'rejected'     ? { bg: 'rgba(239,68,68,0.15)',  fg: 'var(--bad)' }
    : draft.status === 'scheduled'    ? { bg: 'rgba(59,130,246,0.15)', fg: '#93c5fd' }
    : draft.status === 'published'    ? { bg: 'rgba(148,163,184,0.15)',fg: 'var(--ink-1)' }
    :                                   { bg: 'rgba(245,158,11,0.15)', fg: 'var(--warn)' };

  const handleSave = async () => {
    setSaving(true);
    await onAction(draft.id, 'edit', { body });
    setEditing(false);
    setSaving(false);
  };

  return (
    <div className="wb-panel" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '3px 7px', borderRadius: 4, background: 'var(--bg-2)', color: 'var(--ink-2)' }}>
            {draft.content_type?.replace('social_', '').replaceAll('_', ' ') || 'post'}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 999, background: statusTone.bg, color: statusTone.fg }}>
            {draft.status?.replaceAll('_', ' ')}
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{new Date(draft.created_at).toLocaleString()}</span>
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ width: '100%', minHeight: 128, padding: 12, fontSize: 13, fontFamily: 'inherit', borderRadius: 8, background: 'var(--bg-0)', color: 'var(--ink-0)', border: '1px solid var(--line)', outline: 'none', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleSave} disabled={saving} className="wb-btn wb-btn-rapid" style={{ fontSize: 11 }}>
              <Save size={12} /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setEditing(false); setBody(draft.body); }} disabled={saving} className="wb-btn" style={{ fontSize: 11 }}>
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--ink-1)', marginBottom: 10 }}>{draft.body}</p>
      )}

      {draft.hashtags && draft.hashtags.length > 0 && !editing && (
        <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: '#60a5fa' }}>
          {draft.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}
        </p>
      )}

      {draft.strategic_rationale && (
        <p style={{ margin: '0 0 10px', fontSize: 11, fontStyle: 'italic', padding: 8, borderRadius: 6, background: 'var(--bg-2)', color: 'var(--ink-2)' }}>
          {draft.strategic_rationale}
        </p>
      )}

      {draft.status === 'pending_review' && !editing && (
        <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
          <ActionBtn tone="ok"    onClick={() => onAction(draft.id, 'approve')} icon={<ThumbsUp size={12} />}   label="Approve" />
          <ActionBtn tone="info"  onClick={() => setEditing(true)}               icon={<Pencil size={12} />}     label="Edit" />
          <ActionBtn tone="warn"  onClick={() => onAction(draft.id, 'revise')}   icon={<Pencil size={12} />}     label="Revise" />
          <ActionBtn tone="bad"   onClick={() => onAction(draft.id, 'reject')}   icon={<ThumbsDown size={12} />} label="Reject" />
        </div>
      )}
    </div>
  );
}

function ActionBtn({ tone, icon, label, onClick }: { tone: 'ok' | 'bad' | 'warn' | 'info'; icon: React.ReactNode; label: string; onClick: () => void }) {
  const palette = {
    ok:   { bg: 'rgba(16,185,129,0.18)',  fg: '#6ee7b7' },
    bad:  { bg: 'rgba(220,38,38,0.18)',   fg: '#fca5a5' },
    warn: { bg: 'rgba(245,158,11,0.18)',  fg: '#fcd34d' },
    info: { bg: 'rgba(59,130,246,0.18)',  fg: '#93c5fd' },
  }[tone];
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500,
      background: palette.bg, color: palette.fg, border: 0, cursor: 'pointer',
    }}>
      {icon} {label}
    </button>
  );
}
