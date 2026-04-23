'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

type TickerTag = 'INTEL' | 'HEAT' | 'WIN' | 'ALERT' | 'BRIEF' | 'QUEUE';
type TickerItem = { tag: TickerTag; text: string };

const FALLBACK_TICKER: TickerItem[] = [
  { tag: 'BRIEF', text: 'Daily brief auto-generates 7:00 AM MT' },
  { tag: 'INTEL', text: 'News pulse polling Colorado sources every 2h' },
  { tag: 'ALERT', text: 'Press R to open Rapid Response' },
];

const VALID_TAGS: TickerTag[] = ['INTEL', 'HEAT', 'WIN', 'ALERT', 'BRIEF', 'QUEUE'];

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname.startsWith('/login');
  const [refreshing, setRefreshing] = useState(false);
  const [ticker, setTicker] = useState<TickerItem[]>(FALLBACK_TICKER);

  // Global Rapid Response routing: from any page, R or the TopBar button
  // navigates to the home War Room with ?rr=1 which the home page opens.
  useEffect(() => {
    if (isAuthPage) return;
    const onRapid = () => {
      if (pathname !== '/') router.push('/?rr=1');
    };
    window.addEventListener('warroom:rapid-response', onRapid);
    return () => window.removeEventListener('warroom:rapid-response', onRapid);
  }, [isAuthPage, pathname, router]);

  useEffect(() => {
    if (isAuthPage) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/intel?type=ticker');
        if (!res.ok) return;
        const data: { tag: string; text: string }[] = await res.json();
        const cleaned: TickerItem[] = (Array.isArray(data) ? data : [])
          .filter((d) => d?.text && VALID_TAGS.includes(d.tag as TickerTag))
          .map((d) => ({ tag: d.tag as TickerTag, text: String(d.text).slice(0, 200) }));
        if (!cancelled && cleaned.length > 0) setTicker(cleaned);
      } catch {
        /* keep fallback */
      }
    };
    load();
    const refreshHandler = () => load();
    window.addEventListener('warroom:refresh', refreshHandler);
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('warroom:refresh', refreshHandler);
    };
  }, [isAuthPage]);

  if (isAuthPage) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  const handleRefresh = () => {
    setRefreshing(true);
    // Soft refresh: re-request current page data by forcing a reload of data-bound components.
    window.dispatchEvent(new CustomEvent('warroom:refresh'));
    setTimeout(() => setRefreshing(false), 1200);
  };

  const handleRapidResponse = () => {
    window.dispatchEvent(new CustomEvent('warroom:rapid-response'));
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-0)' }}>
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col md:ml-[232px] pb-20 md:pb-0">
        <TopBar
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onRapidResponse={handleRapidResponse}
          tickerItems={ticker}
        />
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
