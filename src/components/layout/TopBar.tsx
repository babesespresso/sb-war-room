'use client';

import { useEffect, useState } from 'react';
import { Search, Bell, RefreshCw, Zap } from 'lucide-react';

type TickerItem = { tag: 'INTEL' | 'HEAT' | 'WIN' | 'ALERT' | 'BRIEF' | 'QUEUE'; text: string };

function daysUntilElection(): number {
  const election = new Date('2026-11-03T00:00:00Z').getTime();
  return Math.max(0, Math.ceil((election - Date.now()) / 86_400_000));
}

function TagBadge({ tag }: { tag: TickerItem['tag'] }) {
  const palette: Record<TickerItem['tag'], { bg: string; color: string }> = {
    INTEL: { bg: 'rgba(74,141,240,0.15)', color: '#9ab8f2' },
    ALERT: { bg: 'rgba(229,72,77,0.15)', color: '#ff9da0' },
    WIN:   { bg: 'rgba(47,179,128,0.15)', color: '#7ee2b8' },
    HEAT:  { bg: 'rgba(245,165,36,0.15)', color: '#f5c46a' },
    BRIEF: { bg: 'var(--bg-2)', color: 'var(--ink-2)' },
    QUEUE: { bg: 'var(--bg-2)', color: 'var(--ink-2)' },
  };
  const p = palette[tag];
  return (
    <span className="wb-mono" style={{
      fontSize: 9, padding: '2px 6px', borderRadius: 3,
      background: p.bg, color: p.color, fontWeight: 700, letterSpacing: '0.12em',
    }}>{tag}</span>
  );
}

export function Ticker({ items }: { items: TickerItem[] }) {
  if (!items?.length) return null;
  const doubled = [...items, ...items];
  return (
    <div className="wb-ticker" style={{
      overflow: 'hidden',
      borderBottom: '1px solid var(--line)',
      background: 'var(--bg-0)',
      height: 32,
      display: 'flex',
      alignItems: 'center',
    }}>
      <div className="wb-ticker-track">
        {doubled.map((item, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
            <TagBadge tag={item.tag} />
            <span style={{ color: 'var(--ink-1)' }}>{item.text}</span>
            <span style={{ color: 'var(--ink-4)' }}>•</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TopBar({
  onRapidResponse,
  onRefresh,
  refreshing = false,
  tickerItems,
}: {
  onRapidResponse?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  tickerItems?: TickerItem[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [election, setElection] = useState('T-—');

  useEffect(() => {
    setNow(new Date());
    setElection(`T-${daysUntilElection()}d`);
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  // Rapid-response keyboard shortcut
  useEffect(() => {
    if (!onRapidResponse) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        onRapidResponse();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRapidResponse]);

  const timeStr = now?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) ?? '--:--:--';
  const dateStr = (now?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) ?? '').toUpperCase();

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 24px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg-1)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="wb-pulse red" />
            <div>
              <div className="wb-h-display" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-0)' }}>
                War Room
              </div>
              <div className="wb-mono" suppressHydrationWarning style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.08em' }}>
                LIVE · {dateStr} · {timeStr} MT
              </div>
            </div>
          </div>
          <div style={{ height: 28, width: 1, background: 'var(--line)' }} className="hidden lg:block" />
          <div className="wb-mono hidden lg:block" suppressHydrationWarning style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
            <div>DEFCON <span style={{ color: 'var(--gold)', fontWeight: 600 }}>3</span></div>
            <div style={{ marginTop: 2 }}>{election}</div>
          </div>
        </div>

        {/* search */}
        <div className="hidden md:flex" style={{ flex: 1, maxWidth: 420, margin: '0 20px', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8 }}>
          <Search size={14} style={{ color: 'var(--ink-3)' }} />
          <input
            type="text"
            placeholder="Search briefings, intel, threats, drafts…"
            style={{ flex: 1, background: 'transparent', border: 0, color: 'var(--ink-0)', fontSize: 13, outline: 'none', fontFamily: 'var(--font-body)' }}
          />
          <span className="wb-kbd">⌘K</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {onRefresh && (
            <button className="wb-icon-btn" onClick={onRefresh} title="Refresh all feeds">
              <RefreshCw size={14} className={refreshing ? 'wb-spin' : ''} />
            </button>
          )}
          <button className="wb-icon-btn hidden sm:inline-flex" title="Notifications" style={{ position: 'relative' }}>
            <Bell size={14} />
            <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', border: '1.5px solid var(--bg-2)' }} />
          </button>
          {onRapidResponse && (
            <button className="wb-btn wb-btn-rapid" onClick={onRapidResponse}>
              <Zap size={14} />
              <span className="hidden sm:inline">Rapid Response</span>
              <span className="wb-kbd hidden md:inline" style={{ marginLeft: 4, background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}>R</span>
            </button>
          )}
        </div>
      </div>
      {tickerItems && tickerItems.length > 0 && <Ticker items={tickerItems} />}
    </>
  );
}
