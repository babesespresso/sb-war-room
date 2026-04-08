'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, Heart, MessageCircle, Share2,
  ExternalLink, RefreshCw, Instagram, Image, ChevronDown, ChevronUp
} from 'lucide-react';
import XIcon from '@/components/icons/XIcon';
import FacebookIcon from '@/components/icons/FacebookIcon';
import InfoTooltip from '@/components/ui/InfoTooltip';
import NextImage from 'next/image';

interface FBPost {
  id: string;
  message: string;
  created_time: string;
  reactions: number;
  comments: number;
  shares: number;
  image: string | null;
  url: string;
}

interface IGPost {
  id: string;
  caption: string;
  media_type: string;
  image: string | null;
  timestamp: string;
  likes: number;
  comments: number;
  url: string;
}

interface MetaData {
  connected: boolean;
  facebook: {
    name: string;
    followers: number;
    picture: string | null;
    posts: FBPost[];
    insights: Record<string, number>;
    total_engagement: number;
    avg_engagement: number;
  } | null;
  instagram: {
    username: string;
    name: string;
    followers: number;
    following: number;
    media_count: number;
    picture: string | null;
    posts: IGPost[];
    avg_engagement?: number;
  } | null;
}

interface TwitterData {
  connected: boolean;
  handle?: string;
  name?: string;
  profileImage?: string;
  stats?: {
    followers: number;
    following: number;
    totalTweets: number;
    estimatedReach: number;
    estimatedEngagements: number;
    avgEngagementRate: number;
  };
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function SocialPerformance() {
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [twitter, setTwitter] = useState<TwitterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'facebook' | 'instagram' | 'x'>('overview');

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [metaRes, twitterRes] = await Promise.allSettled([
        fetch('/api/analytics/meta'),
        fetch('/api/analytics/social'),
      ]);

      if (metaRes.status === 'fulfilled' && metaRes.value.ok) {
        setMeta(await metaRes.value.json());
      }
      if (twitterRes.status === 'fulfilled' && twitterRes.value.ok) {
        setTwitter(await twitterRes.value.json());
      }
    } catch (err) {
      console.error('Social fetch error:', err);
    }
    setLoading(false);
  }

  const fbConnected = meta?.connected && meta?.facebook;
  const igConnected = meta?.instagram;
  const xConnected = twitter?.connected;

  return (
    <div className="rounded-2xl overflow-hidden glass-panel relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />

      {/* Header */}
      <div
        className="p-6 flex items-center justify-between cursor-pointer relative z-10"
        onClick={() => setShowPanel(!showPanel)}
        style={{ borderBottom: showPanel ? '1px solid var(--border-color)' : 'none' }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl glass-subpanel shadow-inner"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <BarChart3 className="w-5 h-5 text-blue-400" style={{ filter: 'drop-shadow(0 0 8px rgba(96,165,250,0.6))' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">
              Social Media Command
              <InfoTooltip text="Live data pulled from connected Facebook, Instagram, and X (Twitter) APIs. Shows followers, engagement, and recent post performance across all platforms." />
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                {fbConnected && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(24,119,242,0.15)' }}>
                    <FacebookIcon className="w-3 h-3" style={{ color: '#1877f2' }} /> Facebook
                  </span>
                )}
                {igConnected && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(225,48,108,0.15)' }}>
                    <Instagram className="w-3 h-3" style={{ color: '#e1306c' }} /> Instagram
                  </span>
                )}
                {xConnected && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <XIcon className="w-3 h-3" style={{ color: '#fff' }} /> X
                  </span>
                )}
                {!fbConnected && !igConnected && !xConnected && !loading && (
                  <span className="text-red-400">No platforms connected</span>
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); fetchAll(); }}
            className="p-2 rounded-lg hover:bg-white/10 transition-all"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {showPanel ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </div>

      {showPanel && (
        <div className="relative z-10 bg-black/20">
          {/* Tab Bar */}
          <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex gap-1 p-1 rounded-xl glass-subpanel shadow-inner w-full sm:w-auto overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'facebook', label: 'Facebook', icon: FacebookIcon, connected: fbConnected },
                { id: 'instagram', label: 'Instagram', icon: Instagram, connected: igConnected },
                { id: 'x', label: 'X (Twitter)', icon: XIcon, connected: xConnected },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                    className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5"
                    style={{
                      background: activeTab === tab.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
                      boxShadow: activeTab === tab.id ? '0 2px 4px rgba(0,0,0,0.5)' : 'none',
                      border: activeTab === tab.id ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                      opacity: tab.connected === false ? 0.4 : 1,
                    }}>
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
                ))}
              </div>
            ) : activeTab === 'overview' ? (
              <OverviewTab meta={meta} twitter={twitter} />
            ) : activeTab === 'facebook' ? (
              <FacebookTab data={meta?.facebook || null} />
            ) : activeTab === 'instagram' ? (
              <InstagramTab data={meta?.instagram || null} />
            ) : (
              <XTab data={twitter} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== OVERVIEW TAB ===================== */
function OverviewTab({ meta, twitter }: { meta: MetaData | null; twitter: TwitterData | null }) {
  const platforms = [
    {
      name: 'Facebook',
      icon: FacebookIcon,
      color: '#1877f2',
      connected: meta?.connected && meta.facebook,
      followers: meta?.facebook?.followers || 0,
      engagement: meta?.facebook?.avg_engagement || 0,
      posts: meta?.facebook?.posts?.length || 0,
    },
    {
      name: 'Instagram',
      icon: Instagram,
      color: '#e1306c',
      connected: !!meta?.instagram,
      followers: meta?.instagram?.followers || 0,
      engagement: meta?.instagram?.avg_engagement || 0,
      posts: meta?.instagram?.media_count || 0,
    },
    {
      name: 'X (Twitter)',
      icon: XIcon,
      color: '#ffffff',
      connected: twitter?.connected,
      followers: twitter?.stats?.followers || 0,
      engagement: twitter?.stats?.estimatedEngagements || 0,
      posts: twitter?.stats?.totalTweets || 0,
    },
  ];

  const totalFollowers = platforms.reduce((sum, p) => sum + (p.connected ? p.followers : 0), 0);

  return (
    <div className="space-y-4">
      {/* Total Followers */}
      <div className="p-5 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Social Reach</p>
            <p className="text-4xl font-mono font-bold tracking-tighter text-shadow-glow" style={{ color: 'var(--campaign-blue)' }}>
              {formatNumber(totalFollowers)}
            </p>
            <p className="text-xs mt-1 text-slate-400">Combined followers across all platforms</p>
          </div>
          <div className="flex gap-2">
            {platforms.map(p => {
              const Icon = p.icon;
              return (
                <div key={p.name} className="text-center p-3 rounded-lg" style={{ background: 'var(--surface-1)' }}>
                  <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: p.connected ? p.color : 'var(--text-muted)' }} />
                  <p className="text-sm font-mono font-bold" style={{ color: p.connected ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {p.connected ? formatNumber(p.followers) : '—'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {platforms.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.name} className="p-4 rounded-xl transition-all hover:brightness-110"
              style={{
                background: p.connected ? `${p.color}10` : 'var(--surface-2)',
                border: `1px solid ${p.connected ? `${p.color}30` : 'var(--border-color)'}`,
              }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg" style={{ background: `${p.color}20` }}>
                  <Icon className="w-4 h-4" style={{ color: p.color }} />
                </div>
                <span className="text-sm font-semibold">{p.name}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${p.connected ? 'text-green-400' : 'text-red-400'}`}
                  style={{ background: p.connected ? 'rgba(16,185,129,0.15)' : 'rgba(220,38,38,0.15)' }}>
                  {p.connected ? 'LIVE' : 'NOT LINKED'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Followers</p>
                  <p className="text-lg font-mono font-bold">{p.connected ? formatNumber(p.followers) : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Avg Engagement</p>
                  <p className="text-lg font-mono font-bold">{p.connected && p.engagement > 0 ? formatNumber(p.engagement) : '—'}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== FACEBOOK TAB ===================== */
function FacebookTab({ data }: { data: MetaData['facebook'] }) {
  if (!data) {
    return (
      <div className="text-center py-10">
        <FacebookIcon className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm text-slate-400">Facebook not connected. Add META_ACCESS_TOKEN to .env to enable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Followers', value: formatNumber(data.followers), icon: Users, color: '#1877f2' },
          { label: 'Total Engagement', value: formatNumber(data.total_engagement), icon: Heart, color: '#e74c3c' },
          { label: 'Avg per Post', value: formatNumber(data.avg_engagement), icon: TrendingUp, color: '#2ecc71' },
          { label: 'Page Impressions', value: formatNumber(data.insights?.page_impressions || 0), icon: BarChart3, color: '#9b59b6' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3 h-3" style={{ color: stat.color }} />
                <span className="text-[10px] uppercase text-slate-500">{stat.label}</span>
              </div>
              <p className="text-xl font-mono font-bold">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Posts */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Recent Posts</h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
          {data.posts.map((post) => (
            <div key={post.id} className="p-4 rounded-lg transition-all hover:brightness-110"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-start gap-3">
                {post.image && (
                  <NextImage src={post.image} alt="" width={64} height={64} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                    {post.message}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Heart className="w-3 h-3 text-red-400" /> {post.reactions}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <MessageCircle className="w-3 h-3 text-blue-400" /> {post.comments}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Share2 className="w-3 h-3 text-green-400" /> {post.shares}
                    </span>
                    <span className="text-[10px] text-slate-500">{timeAgo(post.created_time)}</span>
                    <a href={post.url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-blue-400 hover:underline flex items-center gap-0.5 ml-auto">
                      <ExternalLink className="w-2.5 h-2.5" /> View
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {data.posts.length === 0 && (
            <p className="text-sm text-center text-slate-500 py-6">No recent posts found</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== INSTAGRAM TAB ===================== */
function InstagramTab({ data }: { data: MetaData['instagram'] }) {
  if (!data) {
    return (
      <div className="text-center py-10">
        <Instagram className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm text-slate-400 mb-2">Instagram Business Account not linked.</p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          To enable Instagram data pulls, link an Instagram Business account to the Scott Bottoms Facebook Page
          in your <a href="https://www.facebook.com/settings/?tab=linked_instagram" target="_blank" className="text-blue-400 hover:underline">Page Settings → Linked Accounts</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)' }}>
        {data.picture && (
          <NextImage src={data.picture} alt={data.username} width={56} height={56} className="w-14 h-14 rounded-full border-2" style={{ borderColor: '#e1306c' }} />
        )}
        <div>
          <p className="text-sm font-semibold">@{data.username}</p>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xs text-slate-400"><strong className="text-white">{formatNumber(data.followers)}</strong> followers</span>
            <span className="text-xs text-slate-400"><strong className="text-white">{formatNumber(data.following)}</strong> following</span>
            <span className="text-xs text-slate-400"><strong className="text-white">{data.media_count}</strong> posts</span>
          </div>
        </div>
      </div>

      {/* Posts Grid */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Recent Posts</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {data.posts.map((post) => (
            <a key={post.id} href={post.url} target="_blank" rel="noopener noreferrer"
              className="rounded-lg overflow-hidden group/post relative aspect-square" style={{ background: 'var(--surface-2)' }}>
              {post.image ? (
                <NextImage src={post.image} alt="" fill sizes="(max-width: 768px) 50vw, 20vw" className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="w-8 h-8 text-slate-500" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/post:opacity-100 transition-all flex items-center justify-center gap-3">
                <span className="flex items-center gap-1 text-xs text-white font-medium">
                  <Heart className="w-3 h-3" /> {post.likes}
                </span>
                <span className="flex items-center gap-1 text-xs text-white font-medium">
                  <MessageCircle className="w-3 h-3" /> {post.comments}
                </span>
              </div>
            </a>
          ))}
          {data.posts.length === 0 && (
            <p className="col-span-full text-sm text-center text-slate-500 py-6">No recent posts found</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== X TAB ===================== */
function XTab({ data }: { data: TwitterData | null }) {
  if (!data?.connected) {
    return (
      <div className="text-center py-10">
        <XIcon className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm text-slate-400">X (Twitter) data is pulled via the main social analytics endpoint.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Followers', value: formatNumber(data.stats?.followers || 0), icon: Users, color: '#fff' },
          { label: 'Following', value: formatNumber(data.stats?.following || 0), icon: Users, color: '#60a5fa' },
          { label: 'Total Tweets', value: formatNumber(data.stats?.totalTweets || 0), icon: TrendingUp, color: '#34d399' },
          { label: 'Impressions', value: formatNumber(data.stats?.estimatedReach || 0), icon: BarChart3, color: '#c084fc' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3 h-3" style={{ color: stat.color }} />
                <span className="text-[10px] uppercase text-slate-500">{stat.label}</span>
              </div>
              <p className="text-xl font-mono font-bold">{stat.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
