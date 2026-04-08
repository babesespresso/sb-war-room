'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Swords, Newspaper, BarChart3,
  FileText, Target, Zap, Settings, Radio, Brain, Bot, Shield, LogOut
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'War Room', icon: LayoutDashboard },
  { href: '/competitors', label: 'Competitors', icon: Swords },
  { href: '/content', label: 'Content Queue', icon: FileText },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/positions', label: 'Positions', icon: Target },
  { href: '/training', label: 'Debate Simulator', icon: Bot },
];

const SYSTEM_ITEMS = [
  { href: '/persona', label: 'AI Persona', icon: Brain },
  { href: '/agents', label: 'Agent Status', icon: Zap },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.user_metadata?.role === 'admin') {
        setIsAdmin(true);
      }
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <>
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 flex-col z-50 glass-panel"
        style={{ borderRight: '1px solid var(--border-color)', borderTop: 'none', borderLeft: 'none', borderBottom: 'none' }}>

      {/* Logo */}
      <div className="p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden" 
               style={{ border: '1px solid var(--border-light)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            <img src="https://assets.cdn.filesafe.space/DAtfpo4N8FjMGcV3dUSg/media/69d1d475fa2dde97423d6f56.jpeg" alt="Campaign Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight uppercase" style={{ fontFamily: "'Montserrat', sans-serif", letterSpacing: '0.1em' }}>
              WAR ROOM
            </h1>
          </div>
        </div>
      </div>

      {/* Campaign indicator */}
      <div className="px-4 py-3 mx-3 mt-5 rounded-lg glass-subpanel shadow-inner relative overflow-hidden group border border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full pulse-live" style={{ background: 'var(--campaign-green)', boxShadow: '0 0 8px var(--campaign-green)' }} />
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>Live Campaign</span>
          </div>
          <p className="text-sm font-bold tracking-tight text-white">Scott Bottoms</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Colorado Governor 2026</p>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 mt-6">
        <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-3 text-slate-500">
          Operations
        </p>
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 text-sm font-medium relative group overflow-hidden ${
                  isActive ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
                style={{
                  background: isActive ? 'linear-gradient(90deg, rgba(225, 29, 72, 0.15) 0%, transparent 100%)' : '',
                  borderLeft: isActive ? '3px solid var(--campaign-red)' : '3px solid transparent',
                }}>
                <div className={`absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isActive ? 'hidden' : ''}`} />
                <Icon className={`w-4 h-4 relative z-10 transition-colors ${isActive ? 'text-rose-500' : 'group-hover:text-slate-300'}`} />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-3 mt-8 text-slate-500">
          System
        </p>
        <div className="space-y-1">
          {SYSTEM_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 text-sm font-medium relative group overflow-hidden ${
                  isActive ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
                style={{
                  background: isActive ? 'linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, transparent 100%)' : '',
                  borderLeft: isActive ? '3px solid var(--campaign-blue)' : '3px solid transparent',
                }}>
                <div className={`absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isActive ? 'hidden' : ''}`} />
                <Icon className={`w-4 h-4 relative z-10 transition-colors ${isActive ? 'text-blue-400' : 'group-hover:text-slate-300'}`} />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex flex-col gap-1 px-2">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5" style={{ color: 'var(--campaign-green)', filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.5))' }} />
            <span className="text-[10px] tracking-wider uppercase font-bold text-slate-500">
              Multitude Media
            </span>
          </div>
        </div>
        <button onClick={handleSignOut} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Secure Logout">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-50 glass-panel"
        style={{ borderTop: '1px solid var(--border-color)', borderBottom: 'none', borderLeft: 'none', borderRight: 'none', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[...NAV_ITEMS, { href: '/settings', label: 'Settings', icon: Settings }].map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-all ${
                isActive ? 'text-white bg-slate-800 shadow-inner' : 'text-slate-500'
              }`}>
              <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-rose-500' : ''}`} />
              <span className="text-[9px] font-bold tracking-wider uppercase leading-none">{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
