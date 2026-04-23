'use client';

import { useState, useEffect } from 'react';
import { Shield, UserPlus, Users, Trash2, Mail, CheckCircle, Loader2 } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import PageHeader from '@/components/layout/PageHeader';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function TeamPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleInvite(e: React.FormEvent) {
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
    }
    setInviting(false);
  }

  async function handleRemove(id: string) {
    if (!window.confirm('Are you sure you want to revoke this user\'s access to the War Room?')) return;
    
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove user');
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Failed to remove user');
    }
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6" style={{ background: 'var(--bg-0)' }}>
      <PageHeader
        eyebrow="System · Access control"
        title={<><Shield className="w-7 h-7 text-blue-400 inline-block mr-2 align-middle" />Team Access <InfoTooltip text="Manage who has access to the War Room. Only administrators can view this page, invite new users, or assign roles." /></>}
        subtitle="Secure portal management and active personnel."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Invite */}
        <div className="lg:col-span-1">
          <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              Invite Personnel
            </h2>
            
            <form onSubmit={handleInvite} className="space-y-4">
              {message && (
                <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  {message.text}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 pl-1">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none focus:ring-1"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--campaign-blue)' } as React.CSSProperties}
                    placeholder="name@campaign.com"
                  />
                  <Mail className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 pl-1">Access Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg text-sm transition-all outline-none focus:ring-1"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--campaign-blue)' } as React.CSSProperties}
                >
                  <option value="user">Staff (Standard Access)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1 pl-1 leading-tight">
                  {newRole === 'admin' ? 
                    'Admins can invite others and delete data.' : 
                    'Staff can view dashboard and generate content.'}
                </p>
              </div>

              <button
                type="submit"
                disabled={inviting || !newEmail}
                className="w-full py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'var(--campaign-blue)', color: 'white' }}
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Invite Link'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Col: Active Users */}
        <div className="lg:col-span-2">
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
            <div className="p-5 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-color)' }}>
              <Users className="w-5 h-5 text-slate-300" />
              <h2 className="text-lg font-bold">Active Personnel</h2>
            </div>
            
            <div className="bg-black/20">
              {loading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
                </div>
              ) : users.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No personnel found.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/20 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <tr>
                      <th className="px-5 py-3 font-medium">Email</th>
                      <th className="px-5 py-3 font-medium">Role</th>
                      <th className="px-5 py-3 font-medium">Added</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-5 py-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 shrink-0">
                            <span className="text-xs font-bold text-slate-300">
                              {user.email.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-slate-200">{user.email}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full ${
                            user.role === 'admin' 
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                              : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-500 text-xs">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleRemove(user.id)}
                            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Revoke Access"
                          >
                            <Trash2 className="w-4 h-4" />
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
