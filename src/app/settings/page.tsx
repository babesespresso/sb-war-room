'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Shield, Zap, MessageSquare, Globe, CheckCircle, AlertCircle,
  Loader2, RefreshCw, ExternalLink, WifiOff, Wifi, ChevronRight, User, Lock, Users
} from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { createBrowserClient } from '@/lib/supabase/client';

interface Connection {
  connected: boolean;
  detail?: string;
}

interface ChecklistItem {
  label: string;
  done: boolean;
}

interface SettingsData {
  tenant: {
    id: string;
    name: string;
    candidate_name: string;
    campaign_type: string;
    state: string;
    timezone: string;
    brief_time: string;
    content_approval_required: boolean;
    slack_channels: Record<string, string>;
    api_keys: Record<string, string>;
    brand_config: Record<string, string>;
  };
  connections: Record<string, Connection>;
  checklist: ChecklistItem[];
  envStatus: Record<string, boolean>;
  maskedValues: Record<string, string>;
  stats: { competitors: number; positions: number; briefs: number; agentRuns: number };
}

interface ConfigSection {
  id: string;
  title: string;
  icon: React.ElementType;
  connectionKey: string;
  fields: { key: string; label: string; type: string; placeholder: string; required: boolean }[];
}

const CONFIG_SECTIONS: ConfigSection[] = [
  {
    id: 'supabase',
    title: 'Supabase',
    icon: Shield,
    connectionKey: 'supabase',
    fields: [
      { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase URL', type: 'url', placeholder: 'https://your-project.supabase.co', required: true },
      { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Anon Key', type: 'password', placeholder: 'eyJhbG...', required: true },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service Role Key', type: 'password', placeholder: 'eyJhbG...', required: true },
    ],
  },
  {
    id: 'anthropic',
    title: 'Anthropic (Claude)',
    icon: Zap,
    connectionKey: 'anthropic',
    fields: [
      { key: 'ANTHROPIC_API_KEY', label: 'API Key', type: 'password', placeholder: 'sk-ant-...', required: true },
    ],
  },
  {
    id: 'slack',
    title: 'Slack',
    icon: MessageSquare,
    connectionKey: 'slack',
    fields: [
      { key: 'SLACK_BOT_TOKEN', label: 'Bot Token', type: 'password', placeholder: 'xoxb-...', required: true },
      { key: 'SLACK_SIGNING_SECRET', label: 'Signing Secret', type: 'password', placeholder: '', required: true },
      { key: 'SLACK_CHANNEL_WAR_ROOM', label: '#sb-war-room Channel ID', type: 'text', placeholder: 'C0000000000', required: true },
      { key: 'SLACK_CHANNEL_COMPETITOR_WATCH', label: '#competitor-watch Channel ID', type: 'text', placeholder: 'C0000000000', required: true },
      { key: 'SLACK_CHANNEL_CONTENT_QUEUE', label: '#content-queue Channel ID', type: 'text', placeholder: 'C0000000000', required: true },
      { key: 'SLACK_CHANNEL_NEWS_PULSE', label: '#news-pulse Channel ID', type: 'text', placeholder: 'C0000000000', required: true },
      { key: 'SLACK_CHANNEL_ANALYTICS', label: '#analytics Channel ID', type: 'text', placeholder: 'C0000000000', required: true },
      { key: 'SLACK_CHANNEL_REQUESTS', label: '#requests Channel ID', type: 'text', placeholder: 'C0000000000', required: true },
    ],
  },
  {
    id: 'ghl',
    title: 'MMDB',
    icon: Globe,
    connectionKey: 'ghl',
    fields: [
      { key: 'GHL_API_KEY', label: 'API Key', type: 'password', placeholder: '', required: false },
      { key: 'GHL_LOCATION_ID', label: 'Location ID', type: 'text', placeholder: '', required: false },
    ],
  },
  {
    id: 'social',
    title: 'Social Platforms',
    icon: Globe,
    connectionKey: 'twitter',
    fields: [
      { key: 'META_ACCESS_TOKEN', label: 'Meta Access Token', type: 'password', placeholder: '', required: false },
      { key: 'META_PAGE_ID', label: 'Meta Page ID', type: 'text', placeholder: '', required: false },
      { key: 'TWITTER_API_KEY', label: 'X API Key', type: 'password', placeholder: '', required: false },
      { key: 'TWITTER_ACCESS_TOKEN', label: 'X Access Token', type: 'password', placeholder: '', required: false },
    ],
  },
];

function ConnectionBadge({ connection }: { connection?: Connection }) {
  if (!connection) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide"
      style={{
        background: connection.connected
          ? 'rgba(34, 197, 94, 0.12)'
          : 'rgba(239, 68, 68, 0.12)',
        color: connection.connected ? '#4ade80' : '#f87171',
        border: `1px solid ${connection.connected ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
      }}
    >
      {connection.connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {connection.connected ? 'Connected' : 'Not Connected'}
    </span>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState(0);
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth / Security State
  const [userRole, setUserRole] = useState<string>('user');
  const [userEmail, setUserEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{text: string, type: 'success'|'error'} | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserEmail(data.user.email || '');
        setUserRole(data.user.user_metadata?.role || 'user');
      }
    });
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ text: 'Password must be at least 6 characters', type: 'error' });
      return;
    }
    setPasswordUpdating(true);
    setPasswordMsg(null);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg({ text: error.message, type: 'error' });
    } else {
      setPasswordMsg({ text: 'Password updated successfully!', type: 'success' });
      setNewPassword('');
    }
    setPasswordUpdating(false);
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error(`Failed to load settings: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const completedItems = data?.checklist?.filter((c) => c.done).length || 0;
  const totalItems = data?.checklist?.length || 8;
  const completionPct = Math.round((completedItems / totalItems) * 100);

  const section = CONFIG_SECTIONS[activeSection];
  const sectionConnection = data?.connections?.[section.connectionKey];

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--surface-0)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="w-7 h-7" style={{ color: 'var(--campaign-blue)' }} />
            Settings
            <InfoTooltip text="Configure all API connections, Slack channels, social platform integrations, and campaign settings needed to power the Warbird Engine." />
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            API connections, Slack channels, and system configuration
          </p>
        </div>
        <button
          onClick={fetchSettings}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171' }}>
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="col-span-1 lg:col-span-3 space-y-1">
          {CONFIG_SECTIONS.map((s, i) => {
            const Icon = s.icon;
            const conn = data?.connections?.[s.connectionKey];
            const isActive = activeSection === i;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(i)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left group"
                style={{
                  background: isActive ? 'var(--navy-800)' : 'transparent',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{s.title}</span>
                {conn && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: conn.connected ? '#4ade80' : '#f87171' }}
                  />
                )}
                <ChevronRight
                  className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
                  style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? 'translateX(0)' : 'translateX(-4px)',
                  }}
                />
              </button>
            );
          })}

          {/* Setup Checklist */}
          <div className="mt-6 rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
            <div className="p-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                  Setup Progress
                </h3>
                <span className="text-xs font-bold" style={{ color: completionPct === 100 ? '#4ade80' : 'var(--campaign-blue)' }}>
                  {completionPct}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${completionPct}%`,
                    background: completionPct === 100
                      ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                      : 'linear-gradient(90deg, var(--campaign-blue), #60a5fa)',
                  }}
                />
              </div>
            </div>
            <div className="p-4 space-y-2.5">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
                </div>
              ) : (
                data?.checklist?.map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    {item.done ? (
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#4ade80' }} />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    )}
                    <span
                      className="text-xs"
                      style={{
                        color: item.done ? 'var(--text-secondary)' : 'var(--text-muted)',
                        textDecoration: item.done ? 'line-through' : 'none',
                        opacity: item.done ? 0.7 : 1,
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stats */}
          {data?.stats && (
            <div className="mt-4 p-4 rounded-xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
              <h3 className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
                Database
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Competitors', value: data.stats.competitors },
                  { label: 'Positions', value: data.stats.positions },
                  { label: 'Briefs', value: data.stats.briefs },
                  { label: 'Agent Runs', value: data.stats.agentRuns },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</div>
                    <div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Config Details */}
        <div className="col-span-1 lg:col-span-9">
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
            {/* Section Header */}
            <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h2 className="text-lg font-bold flex items-center gap-3">
                  {section.title} Configuration
                </h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {sectionConnection?.detail || 'Environment variable status'}
                </p>
              </div>
              <ConnectionBadge connection={sectionConnection} />
            </div>

            {/* Fields */}
            <div className="p-6 space-y-5">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
                </div>
              ) : (
                section.fields.map((field) => {
                  const isSet = data?.envStatus?.[field.key] || false;
                  const maskedValue = data?.maskedValues?.[field.key] || '';
                  return (
                    <div key={field.key}>
                      <label className="flex items-center gap-2 text-sm font-medium mb-1.5">
                        {field.label}
                        {field.required && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                            style={{ background: 'rgba(220, 38, 38, 0.15)', color: '#fca5a5' }}
                          >
                            Required
                          </span>
                        )}
                        {isSet && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                            style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#4ade80' }}
                          >
                            Set
                          </span>
                        )}
                        {!isSet && field.required && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                            style={{ background: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' }}
                          >
                            Missing
                          </span>
                        )}
                      </label>
                      <div className="flex gap-2">
                        <div
                          className="flex-1 flex items-center px-4 py-2.5 rounded-lg text-sm"
                          style={{
                            background: 'var(--surface-2)',
                            border: `1px solid ${isSet ? 'rgba(34, 197, 94, 0.3)' : 'var(--border-color)'}`,
                            color: isSet ? 'var(--text-secondary)' : 'var(--text-muted)',
                          }}
                        >
                          {isSet ? (
                            <span className="font-mono text-xs">{maskedValue}</span>
                          ) : (
                            <span className="italic text-xs">{field.placeholder || 'Not configured'}</span>
                          )}
                        </div>
                        <div
                          className="flex items-center px-3 rounded-lg text-[11px] font-mono flex-shrink-0"
                          style={{
                            background: 'var(--surface-2)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          {field.key}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-6 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-color)', background: 'var(--surface-2)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Environment variables are managed via{' '}
                <code className="px-1 py-0.5 rounded" style={{ background: 'var(--surface-0)' }}>
                  .env.local
                </code>{' '}
                locally, or{' '}
                <code className="px-1 py-0.5 rounded" style={{ background: 'var(--surface-0)' }}>
                  Vercel Environment Variables
                </code>{' '}
                in production.
              </p>
              <a
                href="https://vercel.com/babesespressos-projects/sb-war-room/settings/environment-variables"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-all"
                style={{ color: 'var(--campaign-blue)', background: 'rgba(30, 144, 255, 0.08)' }}
              >
                <ExternalLink className="w-3 h-3" />
                Vercel Settings
              </a>
            </div>
          </div>

          {/* Tenant Info Card */}
          {data?.tenant && (
            <div className="mt-6 rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
              <div className="p-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <h2 className="text-lg font-bold flex items-center gap-1.5">Campaign Configuration <InfoTooltip text="Core campaign settings including candidate name, campaign type, timezone, and content approval requirements. Changes here affect all AI-generated content and scheduling." /></h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Tenant: <code className="px-1 py-0.5 rounded" style={{ background: 'var(--surface-2)' }}>{data.tenant.id}</code>
                </p>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { label: 'Campaign', value: data.tenant.name },
                  { label: 'Candidate', value: data.tenant.candidate_name },
                  { label: 'Type', value: data.tenant.campaign_type },
                  { label: 'State', value: data.tenant.state },
                  { label: 'Timezone', value: data.tenant.timezone },
                  { label: 'Daily Brief Time', value: data.tenant.brief_time },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="text-[10px] uppercase font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                      {item.label}
                    </div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {item.value || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account & Security Card */}
          <div className="mt-6 rounded-xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
            <div className="p-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <User className="w-5 h-5 text-purple-400" />
                Account & Security
              </h2>
            </div>
            
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Password Update */}
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--text-secondary)' }}>
                  <Lock className="w-4 h-4 text-slate-400" />
                  Change Credentials
                </h3>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  {passwordMsg && (
                    <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${passwordMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {passwordMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {passwordMsg.text}
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 pl-1">Email (Read Only)</label>
                    <input disabled value={userEmail} className="w-full px-4 py-2.5 rounded-lg text-sm bg-black/20 text-slate-500 border" style={{ borderColor: 'var(--border-color)' }} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 pl-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-4 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:ring-1"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)', color: 'white', '--tw-ring-color': 'var(--campaign-blue)' } as React.CSSProperties}
                    />
                  </div>
                  <button disabled={passwordUpdating || !newPassword} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors">
                    {passwordUpdating ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>

              {/* Team Access Shortcut (If Admin) & Global Actions */}
              <div className="flex flex-col gap-6">
                {userRole === 'admin' && (
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--text-secondary)' }}>
                      <Users className="w-4 h-4 text-slate-400" />
                      Personnel Management
                    </h3>
                    <div className="p-4 rounded-xl border flex flex-col gap-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-color)' }}>
                      <p className="text-sm text-slate-400">
                        You are logged in as an Administrator. You have the ability to explicitly invite new staff, issue credentials, and assign internal roles.
                      </p>
                      <a href="/team" className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-bold border border-white/10 hover:bg-white/5 transition-colors text-white">
                        <Shield className="w-4 h-4 text-blue-400" />
                        Manage Team Access
                      </a>
                    </div>
                  </div>
                )}
                
                {/* Global Sign Out for Mobile Users */}
                <div>
                   <h3 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--text-secondary)' }}>
                    Session Operations
                  </h3>
                  <button 
                    onClick={async () => {
                      const supabase = createBrowserClient();
                      await supabase.auth.signOut();
                      window.location.href = '/login';
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-bold border flex items-center justify-center gap-2 transition-all hover:bg-red-500/10 text-red-400 border-red-500/20"
                  >
                    Secure Sign Out
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
