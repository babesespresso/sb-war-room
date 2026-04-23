'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Swords, FileText, BarChart3, Target, Bot,
  Brain, Zap, Settings, ChevronRight, LogOut
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  badge?: string | null;
  badgeColor?: string;
};

const NAV: NavItem[] = [
  { href: '/',             label: 'War Room',       icon: LayoutDashboard },
  { href: '/competitors',  label: 'Competitors',    icon: Swords },
  { href: '/content',      label: 'Content Queue',  icon: FileText },
  { href: '/analytics',    label: 'Analytics',      icon: BarChart3 },
  { href: '/positions',    label: 'Positions',      icon: Target },
  { href: '/training',     label: 'Debate Sim',     icon: Bot },
];

const SYSTEM: NavItem[] = [
  { href: '/persona',  label: 'AI Persona',   icon: Brain },
  { href: '/agents',   label: 'Agent Status', icon: Zap, badge: '●', badgeColor: 'var(--green)' },
  { href: '/settings', label: 'Settings',     icon: Settings },
];

function daysUntilElection(): number {
  const election = new Date('2026-11-03T00:00:00Z').getTime();
  const today = Date.now();
  return Math.max(0, Math.ceil((election - today) / 86_400_000));
}

function SidebarNavItem({
  item, active, collapsed,
}: {
  item: NavItem; active: boolean; collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="group"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: collapsed ? '10px 0' : '8px 10px',
        borderRadius: 8,
        color: active ? 'var(--ink-0)' : 'var(--ink-2)',
        background: active ? 'var(--bg-3)' : 'transparent',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        textDecoration: 'none',
        position: 'relative',
        justifyContent: collapsed ? 'center' : 'flex-start',
        marginBottom: 2,
        transition: 'all .15s',
        boxShadow: active ? 'inset 2px 0 0 var(--accent)' : 'none',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-2)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={15} style={{ flexShrink: 0, color: active ? 'var(--accent)' : 'var(--ink-2)' }} />
      {!collapsed && (
        <>
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.badge && (
            <span
              className="wb-mono"
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 4,
                background: active ? 'var(--accent)' : 'var(--bg-3)',
                color: active ? '#fff' : (item.badgeColor || 'var(--ink-1)'),
              }}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [election, setElection] = useState('T-—');

  useEffect(() => {
    setElection(`T-${daysUntilElection()}d`);
  }, []);

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  const handleSignOut = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const width = collapsed ? 68 : 232;

  return (
    <>
      <aside
        className="sidebar hidden md:flex"
        style={{
          width,
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: 'var(--bg-1)',
          borderRight: '1px solid var(--line)',
          flexDirection: 'column',
          flexShrink: 0,
          transition: 'width .2s ease',
          zIndex: 50,
        }}
      >
        {/* brand */}
        <div style={{ padding: '18px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in oklab, var(--accent), #000 40%) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px -4px var(--accent), 0 0 0 1px rgba(255,255,255,0.08) inset',
          }}>
            <span className="wb-mono" style={{ fontWeight: 700, fontSize: 13, color: '#fff', letterSpacing: '-0.04em' }}>W</span>
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="wb-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--ink-0)' }}>
                WAR ROOM
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>
                by Multitude
              </div>
            </div>
          )}
        </div>

        {/* campaign card */}
        {!collapsed && (
          <div style={{ margin: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div className="wb-pulse" />
              <span className="wb-eyebrow">Active campaign</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-0)' }}>Scott Bottoms</div>
            <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 1 }}>CO Governor · 2026</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="wb-chip" style={{ fontSize: 9, padding: '2px 6px' }}>{election}</span>
              <span className="wb-chip" style={{ fontSize: 9, padding: '2px 6px' }}>GOP PRIMARY</span>
            </div>
          </div>
        )}

        {/* nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          {!collapsed && <div className="wb-eyebrow" style={{ padding: '10px 10px 6px' }}>Operations</div>}
          {NAV.map((item) => (
            <SidebarNavItem key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
          ))}
          <div style={{ height: 18 }} />
          {!collapsed && <div className="wb-eyebrow" style={{ padding: '10px 10px 6px' }}>System</div>}
          {SYSTEM.map((item) => (
            <SidebarNavItem key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
          ))}
        </nav>

        {/* footer */}
        <div style={{ padding: 10, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="wb-icon-btn"
            onClick={() => setCollapsed((c) => !c)}
            style={{ width: 32, height: 32 }}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronRight size={14} style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform .2s' }} />
          </button>
          {!collapsed && (
            <>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>SB</div>
                <div style={{ fontSize: 11, minWidth: 0 }}>
                  <div style={{ color: 'var(--ink-0)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Campaign</div>
                  <div style={{ color: 'var(--ink-3)', fontSize: 10 }}>Operator</div>
                </div>
              </div>
              <button className="wb-icon-btn" style={{ width: 28, height: 28 }} title="Sign out" onClick={handleSignOut}>
                <LogOut size={12} />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Mobile bottom nav — unchanged behavior */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-50"
        style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--line)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[...NAV, { href: '/settings', label: 'Settings', icon: Settings }].map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-all ${active ? 'text-white' : ''}`}
              style={{ background: active ? 'var(--bg-3)' : 'transparent', color: active ? 'var(--ink-0)' : 'var(--ink-2)' }}>
              <Icon size={18} style={{ color: active ? 'var(--accent)' : 'var(--ink-2)', marginBottom: 4 }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 }}>
                {item.label.split(' ')[0]}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
