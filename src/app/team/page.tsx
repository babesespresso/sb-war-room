'use client';

/**
 * Team — admin surface for inviting and managing War Room users.
 *
 * Endpoints called (admin-only — server enforces role via user_metadata.role === 'admin'):
 *   GET    /api/admin/users                 → { users: [{ id, email, role, created_at }] }
 *   POST   /api/admin/users  { email, role } → invites user via Supabase admin.inviteUserByEmail
 *   DELETE /api/admin/users?id=<uuid>        → revokes user
 *
 * Preserves: invite form, role selector with helper copy, user table, revoke
 * confirmation. Non-admin callers get 403 from the API and see the empty state.
 */

import { useEffect, useState } from 'react';
import { Shield, UserPlus, Users, Trash2, Mail, CheckCircle, Loader2 } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import PageHeader from '@/components/layout/PageHeader';

interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'user' | string;
  created_at: string;
}

export default function TeamPage() {
  const [users, setUsers]       = useState<UserProfile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [inviting, setInviting] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole]   = useState<'user' | 'admin'>('user');
  const [message, setMessage]   = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setInviting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite');
      setMessage({ text: `Invited ${newEmail} as ${newRole}`, type: 'success' });
      setNewEmail('');
      fetchUsers();
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm("Revoke this user's access to the War Room?")) return;
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove user');
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Failed to remove user');
    }
  };

  return (
    <div style={{ padding: 'var(--pad-section)', display: 'flex', flexDirection: 'column', gap: 'var(--gap)', background: 'var(--bg-0)' }}>
      <PageHeader
        eyebrow="System · Access control"
        title={<>Team access <InfoTooltip text="Manage who has access to the War Room. Only administrators can view this page, invite new users, or assign roles." /></>}
        subtitle="Secure portal management and active personnel."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invite form ─────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="wb-panel" style={{ padding: 20 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={18} style={{ color: 'var(--ok)' }} />
              Invite personnel
            </h2>

            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {message && (
                <div style={{
                  padding: 10, borderRadius: 8, fontSize: 11, fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: message.type === 'success' ? 'var(--ok)' : 'var(--bad)',
                  border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                }}>
                  {message.type === 'success' ? <CheckCircle size={13} /> : <Shield size={13} />}
                  {message.text}
                </div>
              )}

              <Field label="Email address">
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    placeholder="name@campaign.com"
                    style={inputStyle}
                  />
                  <Mail size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-2)' }} />
                </div>
              </Field>

              <Field label="Access role">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                  style={inputStyle}
                >
                  <option value="user">Staff (standard access)</option>
                  <option value="admin">Administrator (full access)</option>
                </select>
                <p style={{ margin: '6px 0 0 4px', fontSize: 10, color: 'var(--ink-2)', lineHeight: 1.3 }}>
                  {newRole === 'admin'
                    ? 'Admins can invite others and delete data.'
                    : 'Staff can view dashboard and generate content.'}
                </p>
              </Field>

              <button
                type="submit"
                disabled={inviting || !newEmail}
                className="wb-btn wb-btn-rapid"
                style={{ width: '100%', justifyContent: 'center', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: 11 }}
              >
                {inviting ? <Loader2 size={14} className="animate-spin" /> : 'Send invite link'}
              </button>
            </form>
          </div>
        </div>

        {/* Active users ────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="wb-panel" style={{ overflow: 'hidden' }}>
            <div style={{ padding: 20, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Active personnel</h2>
              <span style={{ fontSize: 11, color: 'var(--ink-2)', marginLeft: 'auto' }}>{users.length} user{users.length === 1 ? '' : 's'}</span>
            </div>
            <div>
              {loading ? (
                <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ink-2)' }} />
                </div>
              ) : users.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--ink-2)' }}>
                  No personnel found, or you don't have admin access.
                </div>
              ) : (
                <table style={{ width: '100%', textAlign: 'left', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'var(--bg-2)' }}>
                    <tr style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-2)' }}>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Role</th>
                      <th style={thStyle}>Added</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} style={{ borderTop: '1px solid var(--line)' }}>
                        <td style={{ ...tdStyle, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--ink-1)', flexShrink: 0 }}>
                            {user.email.substring(0, 2).toUpperCase()}
                          </span>
                          <span style={{ fontWeight: 500, color: 'var(--ink-0)' }}>{user.email}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                            padding: '3px 8px', borderRadius: 999,
                            background: user.role === 'admin' ? 'rgba(59,130,246,0.2)' : 'rgba(148,163,184,0.15)',
                            color: user.role === 'admin' ? '#60a5fa' : 'var(--ink-1)',
                            border: `1px solid ${user.role === 'admin' ? 'rgba(59,130,246,0.3)' : 'var(--line)'}`,
                          }}>
                            {user.role}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: 'var(--ink-2)', fontSize: 11 }}>
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <button
                            onClick={() => handleRemove(user.id)}
                            className="wb-btn"
                            style={{ padding: 6 }}
                            title="Revoke access"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13, outline: 'none',
  background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--ink-0)',
};
const thStyle: React.CSSProperties = { padding: '10px 16px', fontWeight: 700 };
const tdStyle: React.CSSProperties = { padding: '12px 16px', verticalAlign: 'middle' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="wb-eyebrow" style={{ display: 'block', marginBottom: 6, paddingLeft: 4 }}>{label}</label>
      {children}
    </div>
  );
}
