'use client';

/**
 * Settings — environment-variable + connection status + security.
 *
 * Endpoints:
 *   GET /api/settings → { tenant, connections, checklist, envStatus, maskedValues, stats }
 *
 * Supabase auth is used client-side only for reading the current user and updating password.
 * Secrets live in env vars; this UI displays masked values and lets ops see what is / isn't set.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Shield, Zap, MessageSquare, Globe, CheckCircle, AlertCircle,
  Loader2, RefreshCw, ExternalLink, Wifi, WifiOff, ChevronRight, User, Lock, Users,
} from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import PageHeader from '@/components/layout/PageHeader';
import { createBrowserClient } from '@/lib/supabase/client';

interface Connection { connected: boolean; detail?: string }
interface ChecklistItem { label: string; done: boolean }
interface SettingsData {
  tenant: {
    id: string; name: string; candidate_name: string;
    campaign_type: string; state: string; timezone: string; brief_time: string;
  };
  connections: Record<string, Connection>;
  checklist: ChecklistItem[];
  envStatus: Record<string, boolean>;
  maskedValues: Record<string, string>;
  stats: { competitors: number; positions: number; briefs: number; agentRuns: number };
}

interface ConfigSection {
  id: string; title: string; icon: React.ElementType; connectionKey: string;
  fields: { key: string; label: string; required: boolean; placeholder?: string }[];
}

const CONFIG_SECTIONS: ConfigSection[] = [
  {
    id: 'supabase', title: 'Supabase', icon: Shield, connectionKey: 'supabase',
    fields: [
      { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase URL', required: true, placeholder: 'https://your-project.supabase.co' },
      { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Anon Key', required: true, placeholder: 'eyJhbG…' },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service Role Key', required: true, placeholder: 'eyJhbG…' },
    ],
  },
  {
    id: 'anthropic', title: 'Anthropic (Claude)', icon: Zap, connectionKey: 'anthropic',
    fields: [{ key: 'ANTHROPIC_API_KEY', label: 'API Key', required: true, placeholder: 'sk-ant-…' }],
  },
  {
    id: 'slack', title: 'Slack', icon: MessageSquare, connectionKey: 'slack',
    fields: [
      { key: 'SLACK_BOT_TOKEN', label: 'Bot Token', required: true, placeholder: 'xoxb-…' },
      { key: 'SLACK_SIGNING_SECRET', label: 'Signing Secret', required: true },
      { key: 'SLACK_CHANNEL_WAR_ROOM', label: '#sb-war-room Channel ID', required: true, placeholder: 'C0000000000' },
      { key: 'SLACK_CHANNEL_COMPETITOR_WATCH', label: '#competitor-watch Channel ID', required: true, placeholder: 'C0000000000' },
      { key: 'SLACK_CHANNEL_CONTENT_QUEUE', label: '#content-queue Channel ID', required: true, placeholder: 'C0000000000' },
      { key: 'SLACK_CHANNEL_NEWS_PULSE', label: '#news-pulse Channel ID', required: true, placeholder: 'C0000000000' },
      { key: 'SLACK_CHANNEL_ANALYTICS', label: '#analytics Channel ID', required: true, placeholder: 'C0000000000' },
      { key: 'SLACK_CHANNEL_REQUESTS', label: '#requests Channel ID', required: true, placeholder: 'C0000000000' },
    ],
  },
  {
    id: 'ghl', title: 'MMDB', icon: Globe, connectionKey: 'ghl',
    fields: [
      { key: 'GHL_API_KEY', label: 'API Key', required: false },
      { key: 'GHL_LOCATION_ID', label: 'Location ID', required: false },
    ],
  },
  {
    id: 'social', title: 'Social platforms', icon: Globe, connectionKey: 'twitter',
    fields: [
      { key: 'META_ACCESS_TOKEN', label: 'Meta Access Token', required: false },
      { key: 'META_PAGE_ID', label: 'Meta Page ID', required: false },
      { key: 'TWITTER_API_KEY', label: 'X API Key', required: false },
      { key: 'TWITTER_ACCESS_TOKEN', label: 'X Access Token', required: false },
    ],
  },
];

function ConnectionBadge({ connection }: { connection?: Connection }) {
  if (!connection) return null;
  const on = connection.connected;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: 0.8,
      background: on ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
      color: on ? '#4ade80' : '#f87171',
      border: `1px solid ${on ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
    }}>
      {on ? <Wifi size={11} /> : <WifiOff size={11} />}
      {on ? 'Connected' : 'Not connected'}
    </span>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState(0);
  const [data, setData]       = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [userRole, setUserRole]   = useState('user');
  const [userEmail, setUserEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwUpdating, setPwUpdating]   = useState(false);
  const [pwMsg, setPwMsg]             = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserEmail(data.user.email || '');
        setUserRole((data.user.user_metadata as any)?.role || 'user');
      }
    });
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error(`Failed to load settings: ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      return setPwMsg({ text: 'Password must be at least 6 characters', type: 'error' });
    }
    setPwUpdating(true); setPwMsg(null);
    const supabase = createBrowserClient();
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setPwMsg(err ? { text: err.message, type: 'error' } : { text: 'Password updated successfully!', type: 'success' });
    if (!err) setNewPassword('');
    setPwUpdating(false);
  };

  const completed     = data?.checklist?.filter(c => c.done).length || 0;
  const totalItems    = data?.checklist?.length || 8;
  const completionPct = Math.round((completed / totalItems) * 100);
  const section       = CONFIG_SECTIONS[activeSection];
  const sectionConn   = data?.connections?.[section.connectionKey];

  return (
    <div style={{ padding: 'var(--pad-section)', display: 'flex', flexDirection: 'column', gap: 'var(--gap)', background: 'var(--bg-0)' }}>
      <PageHeader
        eyebrow="System · Configuration"
        title={<>Settings <InfoTooltip text="Configure API connections, Slack channels, social-platform integrations, and campaign settings." /></>}
        subtitle="API connections, Slack channels, and system configuration."
        actions={
          <button onClick={fetchSettings} disabled={loading} className="wb-btn">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh status
          </button>
        }
      />

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-3" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {CONFIG_SECTIONS.map((s, i) => {
            const Icon = s.icon;
            const conn = data?.connections?.[s.connectionKey];
            const active = activeSection === i;
            return (
              <button key={s.id} onClick={() => setActiveSection(i)} className="wb-btn" style={{
                width: '100%', justifyContent: 'flex-start', padding: '10px 14px',
                background: active ? 'var(--bg-2)' : 'transparent',
                color: active ? 'var(--ink-1)' : 'var(--ink-2)',
                border: `1px solid ${active ? 'var(--line)' : 'transparent'}`,
              }}>
                <Icon size={14} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, textAlign: 'left' }}>{s.title}</span>
                {conn && <span style={{ width: 8, height: 8, borderRadius: '50%', background: conn.connected ? '#4ade80' : '#f87171', flexShrink: 0 }} />}
                <ChevronRight size={12} style={{ opacity: active ? 1 : 0, transform: `translateX(${active ? 0 : -4}px)`, transition: 'all 150ms' }} />
              </button>
            );
          })}

          {/* Setup progress */}
          <div className="wb-panel" style={{ marginTop: 20, overflow: 'hidden' }}>
            <div style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <h3 className="wb-eyebrow" style={{ margin: 0 }}>Setup progress</h3>
                <span style={{ fontSize: 12, fontWeight: 800, color: completionPct === 100 ? '#4ade80' : '#60a5fa' }}>{completionPct}%</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'var(--bg-2)', overflow: 'hidden' }}>
                <div style={{
                  width: `${completionPct}%`, height: '100%',
                  background: completionPct === 100 ? 'linear-gradient(90deg,#4ade80,#22c55e)' : 'linear-gradient(90deg,#60a5fa,#3b82f6)',
                  transition: 'width 700ms',
                }} />
              </div>
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loading ? (
                <Loader2 size={14} className="animate-spin" style={{ color: 'var(--ink-2)', margin: '12px auto' }} />
              ) : data?.checklist?.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.done
                    ? <CheckCircle size={13} style={{ color: '#4ade80', flexShrink: 0 }} />
                    : <AlertCircle size={13} style={{ color: 'var(--ink-2)', flexShrink: 0 }} />}
                  <span style={{ fontSize: 11, color: item.done ? 'var(--ink-1)' : 'var(--ink-2)', textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.7 : 1 }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          {data?.stats && (
            <div className="wb-panel" style={{ marginTop: 12, padding: 14 }}>
              <h3 className="wb-eyebrow" style={{ margin: '0 0 10px' }}>Database</h3>
              <div className="grid grid-cols-2 gap-3">
                {(['competitors', 'positions', 'briefs', 'agentRuns'] as const).map(k => (
                  <div key={k}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{data.stats[k]}</div>
                    <div className="wb-eyebrow">{k === 'agentRuns' ? 'Agent runs' : k}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="lg:col-span-9" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          <div className="wb-panel" style={{ overflow: 'hidden' }}>
            {/* Section header */}
            <div style={{ padding: 20, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{section.title} configuration</h2>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-2)' }}>{sectionConn?.detail || 'Environment variable status'}</p>
              </div>
              <ConnectionBadge connection={sectionConn} />
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 48 }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--ink-2)' }} />
                </div>
              ) : section.fields.map(field => {
                const isSet   = data?.envStatus?.[field.key] || false;
                const masked  = data?.maskedValues?.[field.key] || '';
                return (
                  <div key={field.key}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      {field.label}
                      {field.required && (
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', background: 'rgba(220,38,38,0.15)', color: '#fca5a5' }}>Required</span>
                      )}
                      {isSet && (
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>Set</span>
                      )}
                      {!isSet && field.required && (
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>Missing</span>
                      )}
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{
                        flex: 1, padding: '10px 14px', borderRadius: 8, fontSize: 12,
                        background: 'var(--bg-2)',
                        border: `1px solid ${isSet ? 'rgba(34,197,94,0.3)' : 'var(--line)'}`,
                        color: isSet ? 'var(--ink-1)' : 'var(--ink-2)',
                      }}>
                        {isSet
                          ? <span style={{ fontFamily: 'ui-monospace, SF Mono, monospace' }}>{masked}</span>
                          : <span style={{ fontStyle: 'italic' }}>{field.placeholder || 'Not configured'}</span>}
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', padding: '0 10px', borderRadius: 8,
                        fontSize: 11, fontFamily: 'ui-monospace, SF Mono, monospace',
                        background: 'var(--bg-2)', color: 'var(--ink-2)',
                        border: '1px solid var(--line)',
                      }}>{field.key}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: 16, borderTop: '1px solid var(--line)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-2)' }}>
                Managed via{' '}
                <code style={{ padding: '1px 4px', borderRadius: 3, background: 'var(--bg-0)' }}>.env.local</code>{' '}
                locally, or{' '}
                <code style={{ padding: '1px 4px', borderRadius: 3, background: 'var(--bg-0)' }}>Vercel Environment Variables</code>{' '}
                in production.
              </p>
              <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="wb-btn" style={{ color: '#60a5fa', background: 'rgba(59,130,246,0.08)' }}>
                <ExternalLink size={11} /> Vercel settings
              </a>
            </div>
          </div>

          {/* Tenant */}
          {data?.tenant && (
            <div className="wb-panel" style={{ overflow: 'hidden' }}>
              <div style={{ padding: 20, borderBottom: '1px solid var(--line)' }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Campaign configuration <InfoTooltip text="Core campaign settings including candidate name, type, timezone, and approval rules." />
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--ink-2)' }}>
                  Tenant: <code style={{ padding: '1px 4px', borderRadius: 3, background: 'var(--bg-2)' }}>{data.tenant.id}</code>
                </p>
              </div>
              <div style={{ padding: 20 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { label: 'Campaign', value: data.tenant.name },
                  { label: 'Candidate', value: data.tenant.candidate_name },
                  { label: 'Type', value: data.tenant.campaign_type },
                  { label: 'State', value: data.tenant.state },
                  { label: 'Timezone', value: data.tenant.timezone },
                  { label: 'Daily brief time', value: data.tenant.brief_time },
                ].map(item => (
                  <div key={item.label}>
                    <div className="wb-eyebrow">{item.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{item.value || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account & Security */}
          <div className="wb-panel" style={{ overflow: 'hidden' }}>
            <div style={{ padding: 20, borderBottom: '1px solid var(--line)' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={18} style={{ color: '#a78bfa' }} /> Account & security
              </h2>
            </div>
            <div style={{ padding: 20 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-1)' }}>
                  <Lock size={14} style={{ color: 'var(--ink-2)' }} /> Change credentials
                </h3>
                <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {pwMsg && (
                    <div style={{
                      padding: 10, borderRadius: 8, fontSize: 11, fontWeight: 500,
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: pwMsg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      color: pwMsg.type === 'success' ? '#4ade80' : '#f87171',
                      border: `1px solid ${pwMsg.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}>
                      {pwMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />} {pwMsg.text}
                    </div>
                  )}
                  <div>
                    <label className="wb-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Email (read-only)</label>
                    <input disabled value={userEmail} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 12, background: 'var(--bg-0)', color: 'var(--ink-2)', border: '1px solid var(--line)' }} />
                  </div>
                  <div>
                    <label className="wb-eyebrow" style={{ display: 'block', marginBottom: 4 }}>New password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--ink-1)' }}
                    />
                  </div>
                  <button type="submit" disabled={pwUpdating || !newPassword} className="wb-btn wb-btn-rapid" style={{ alignSelf: 'flex-start', opacity: (pwUpdating || !newPassword) ? 0.5 : 1 }}>
                    {pwUpdating ? 'Updating…' : 'Update password'}
                  </button>
                </form>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {userRole === 'admin' && (
                  <div>
                    <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={14} style={{ color: 'var(--ink-2)' }} /> Personnel management
                    </h3>
                    <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)' }}>
                        You are logged in as an Administrator. You can invite new staff, issue credentials, and assign internal roles.
                      </p>
                      <a href="/team" className="wb-btn" style={{ justifyContent: 'center', border: '1px solid var(--line)' }}>
                        <Shield size={14} style={{ color: '#60a5fa' }} /> Manage team access
                      </a>
                    </div>
                  </div>
                )}
                <div>
                  <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700 }}>Session operations</h3>
                  <button
                    onClick={async () => {
                      const supabase = createBrowserClient();
                      await supabase.auth.signOut();
                      window.location.href = '/login';
                    }}
                    className="wb-btn"
                    style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent' }}
                  >
                    Secure sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
