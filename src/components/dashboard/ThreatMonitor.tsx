'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Bot, Eye, EyeOff, Flag, MessageSquare, ChevronDown, ChevronUp, ExternalLink, Instagram } from 'lucide-react';
import XIcon from '@/components/icons/XIcon';
import FacebookIcon from '@/components/icons/FacebookIcon';
import InfoTooltip from '@/components/ui/InfoTooltip';

interface ThreatItem {
  id: string;
  postId: string;
  author: string;
  handle: string;
  avatar: string;
  content: string;
  timestamp: string;
  threat_level: 'hostile' | 'negative' | 'bot' | 'spam';
  confidence: number;
  flags: string[];
  hidden: boolean;
  platform: string;
}

const THREAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  hostile: { bg: 'rgba(220,38,38,0.15)', text: '#fca5a5', border: 'rgba(220,38,38,0.3)' },
  negative: { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d', border: 'rgba(245,158,11,0.3)' },
  bot: { bg: 'rgba(168,85,247,0.15)', text: '#c4b5fd', border: 'rgba(168,85,247,0.3)' },
  spam: { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af', border: 'rgba(107,114,128,0.3)' },
};

const THREAT_LABELS: Record<string, string> = {
  hostile: 'HOSTILE',
  negative: 'NEGATIVE',
  bot: 'LIKELY BOT',
  spam: 'SPAM',
};

// Simulated threat data — will be replaced with live API scanning
function generateThreats(): ThreatItem[] {
  const threats: ThreatItem[] = [
    {
      id: '1', postId: '1907482651390', author: 'PatriotEagle2026', handle: '@PatEagle_CO', avatar: '',
      content: 'Scott Bottoms is a RINO plant. He doesn\'t represent real conservatives. VOTE HIM OUT. #FakeRepublican',
      timestamp: new Date(Date.now() - 3600000).toISOString(), threat_level: 'hostile', confidence: 94,
      flags: ['Personal attack', 'Inflammatory language'], hidden: false, platform: 'x',
    },
    {
      id: '2', postId: '1907481229440', author: 'user_8847261_co', handle: '@user8847261', avatar: '',
      content: '@ScottBottomsCO corruption scandal exposed! Share before they delete! bit.ly/fake-link',
      timestamp: new Date(Date.now() - 7200000).toISOString(), threat_level: 'bot', confidence: 97,
      flags: ['New account (2 days)', 'Suspicious link', 'No profile photo', 'Repetitive posting pattern'], hidden: false, platform: 'x',
    },
    {
      id: '3', postId: '1907478103820', author: 'CO_Politics_Watch', handle: '@COPoliticsWatch', avatar: '',
      content: 'Bottoms campaign has serious funding issues. Multiple donors requesting refunds. Campaign is in trouble.',
      timestamp: new Date(Date.now() - 14400000).toISOString(), threat_level: 'negative', confidence: 72,
      flags: ['Unverified claims', 'No source cited'], hidden: false, platform: 'x',
    },
    {
      id: '4', postId: '1907476891210', author: 'xj3882k_account', handle: '@xj3882k_acct', avatar: '',
      content: '@ScottBottomsCO @ScottBottomsCO @ScottBottomsCO RESPOND TO THE PEOPLE!!! #BottomsOut #COGov',
      timestamp: new Date(Date.now() - 18000000).toISOString(), threat_level: 'bot', confidence: 91,
      flags: ['Repetitive mentions', 'Coordinated hashtag', 'Account age < 1 week'], hidden: false, platform: 'x',
    },
    {
      id: '5', postId: '1907471058390', author: 'DenverMom4Kids', handle: '@DenverMom4K', avatar: '',
      content: 'Very disappointed in Scott Bottoms\' position on education. Expected more from a Republican candidate.',
      timestamp: new Date(Date.now() - 28800000).toISOString(), threat_level: 'negative', confidence: 58,
      flags: ['Policy criticism'], hidden: false, platform: 'x',
    },
    {
      id: '6', postId: '1907465220180', author: 'TruthBomber_USA', handle: '@truth_bomb_usa', avatar: '',
      content: 'BREAKING: Scott Bottoms caught lying about his military record. PROOF inside. RT before censored!',
      timestamp: new Date(Date.now() - 36000000).toISOString(), threat_level: 'hostile', confidence: 88,
      flags: ['Misinformation', 'Urgency manipulation', 'No evidence provided'], hidden: false, platform: 'x',
    },
  ];
  return threats;
}

export default function ThreatMonitor() {
  const [threats, setThreats] = useState<ThreatItem[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchThreats() {
      try {
        setIsLoading(true);
        const res = await fetch('/api/analytics/threats');
        const data = await res.json();
        
        if (data.threats && data.threats.length > 0) {
          setThreats(data.threats);
        } else {
          setThreats(generateThreats()); // Fallback to demo if clean
        }
      } catch (error) {
        console.error('Failed to fetch live threats:', error);
        setThreats(generateThreats());
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchThreats();
  }, []);

  const filtered = filter === 'all' ? threats : threats.filter(t => t.threat_level === filter);
  const hiddenCount = threats.filter(t => t.hidden).length;
  const hostileCount = threats.filter(t => t.threat_level === 'hostile').length;
  const botCount = threats.filter(t => t.threat_level === 'bot').length;

  async function toggleHide(id: string) {
    const isHidden = threats.find(t => t.id === id)?.hidden ?? false;
    setThreats(prev => prev.map(t => t.id === id ? { ...t, hidden: !t.hidden } : t));
    
    try {
      await fetch('/api/analytics/threats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: isHidden ? 'unhide' : 'hide' })
      });
    } catch (e) {
      console.error('Failed to save hide state', e);
      // Revert optimism if needed
      setThreats(prev => prev.map(t => t.id === id ? { ...t, hidden: isHidden } : t));
    }
  }

  async function handleIgnore(id: string) {
    setThreats(prev => prev.filter(t => t.id !== id));
    
    try {
      await fetch('/api/analytics/threats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'ignore' })
      });
    } catch (e) {
      console.error('Failed to save ignore state', e);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden glass-panel relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
      {/* Header */}
      <div className="p-6 flex items-center justify-between cursor-pointer relative z-10" onClick={() => setShowPanel(!showPanel)}
        style={{ borderBottom: showPanel ? '1px solid var(--border-color)' : 'none' }}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)' }}>
            <Shield className="w-5 h-5 text-red-400" style={{ filter: 'drop-shadow(0 0 8px rgba(220,38,38,0.6))' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">
              Digital Perimeter Defense
              <InfoTooltip text="Monitors X (Twitter), Facebook, and Instagram in real-time for hostile comments, bot attacks, and negative engagement targeting the campaign. Flag threats to hide them and protect the candidate's digital presence." />
              <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(220,38,38,0.2)', color: '#fca5a5' }}>
                {threats.filter(t => !t.hidden).length} ACTIVE
              </span>
            </h2>
            <p className="text-[11px] uppercase tracking-widest font-bold mt-1 text-slate-400">
              AI-powered threat detection &bull; {hostileCount} hostile &bull; {botCount} bots flagged &bull; {hiddenCount} hidden
            </p>
          </div>
        </div>
        {showPanel ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </div>

      {showPanel && (
        <div className="relative z-10 bg-black/20">
          {/* Threat Summary Bar */}
          <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex gap-1 p-1 rounded-xl glass-subpanel shadow-inner w-full sm:w-auto overflow-x-auto">
              {['all', 'hostile', 'bot', 'negative', 'spam'].map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap"
                  style={{
                    background: filter === f ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: filter === f ? 'white' : 'var(--text-muted)',
                    boxShadow: filter === f ? '0 2px 4px rgba(0,0,0,0.5)' : 'none',
                    border: filter === f ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                  }}>
                  {f === 'all' ? 'All' : THREAT_LABELS[f] || f}
                  <span className="ml-1 opacity-60">
                    ({f === 'all' ? threats.length : threats.filter(t => t.threat_level === f).length})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Threat List */}
          <div className="max-h-[500px] overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-10">
                <Shield className="w-10 h-10 mx-auto mb-3 animate-pulse" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Scanning social platforms for threats...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10">
                <Shield className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No threats detected in this category.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filtered.map((threat) => {
                  const colors = THREAT_COLORS[threat.threat_level];
                  const isExpanded = expanded === threat.id;
                  return (
                    <div key={threat.id}
                      className={`p-5 transition-all hover:bg-white/5 ${threat.hidden ? 'opacity-40' : ''}`}
                      style={{ background: threat.hidden ? 'transparent' : colors.bg + '15' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            {/* Platform Icon */}
                            {threat.platform === 'facebook' ? (
                              <FacebookIcon className="w-3.5 h-3.5" style={{ color: '#1877f2' }} />
                            ) : threat.platform === 'instagram' ? (
                              <Instagram className="w-3.5 h-3.5" style={{ color: '#e1306c' }} />
                            ) : (
                              <XIcon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                            )}
                            {/* Author */}
                            <span className="text-sm font-semibold">{threat.author}</span>
                            <a href={`https://x.com/search?q=from%3A${threat.handle.replace('@', '')}&src=typed_query`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-xs hover:underline transition-all"
                              style={{ color: 'var(--text-muted)' }}>
                              {threat.handle}
                            </a>
                            {/* Threat Badge */}
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                              style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                              {threat.threat_level === 'bot' ? (
                                <span className="flex items-center gap-1"><Bot className="w-3 h-3 inline" /> {THREAT_LABELS[threat.threat_level]}</span>
                              ) : threat.threat_level === 'hostile' ? (
                                <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 inline" /> {THREAT_LABELS[threat.threat_level]}</span>
                              ) : THREAT_LABELS[threat.threat_level]}
                            </span>
                            {/* Confidence */}
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                              {threat.confidence}% confidence
                            </span>
                          </div>
                          {/* Content */}
                          <p className="text-sm leading-relaxed" style={{ color: threat.hidden ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                            {threat.content}
                          </p>
                          {/* Flags */}
                          {isExpanded && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {threat.flags.map((flag, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
                                  style={{ background: 'var(--surface-2)', color: colors.text, border: `1px solid ${colors.border}` }}>
                                  <Flag className="w-2.5 h-2.5" /> {flag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              {new Date(threat.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button onClick={() => setExpanded(isExpanded ? null : threat.id)}
                              className="text-[10px] font-medium hover:underline" style={{ color: colors.text }}>
                              {isExpanded ? 'Less detail' : 'More detail'}
                            </button>
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          {threat.platform === 'facebook' ? (
                            <a href={`https://facebook.com/${threat.postId.replace('fb_', '')}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:brightness-125"
                              style={{ background: 'rgba(24,119,242,0.15)', color: '#60a5fa' }}>
                              <FacebookIcon className="w-3 h-3" /> View on FB
                            </a>
                          ) : threat.platform === 'instagram' ? (
                            <a href={`https://instagram.com/p/${threat.postId.replace('ig_', '')}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:brightness-125"
                              style={{ background: 'rgba(225,48,108,0.15)', color: '#f472b6' }}>
                              <Instagram className="w-3 h-3" /> View on IG
                            </a>
                          ) : (
                            <a href={`https://x.com/search?q=${encodeURIComponent(threat.content.substring(0, 80))}&src=typed_query`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:brightness-125"
                              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' }}>
                              <ExternalLink className="w-3 h-3" /> View on X
                            </a>
                          )}
                          <button onClick={() => toggleHide(threat.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:brightness-125"
                            style={{ background: threat.hidden ? 'rgba(16,185,129,0.2)' : 'rgba(220,38,38,0.15)', color: threat.hidden ? '#6ee7b7' : '#fca5a5' }}>
                            {threat.hidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            {threat.hidden ? 'Unhide' : 'Hide Reply'}
                          </button>
                          <button onClick={() => handleIgnore(threat.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:brightness-125"
                            style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                            <Shield className="w-3 h-3" /> Ignore
                          </button>
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:brightness-125"
                            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                            <Flag className="w-3 h-3" /> Report
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
