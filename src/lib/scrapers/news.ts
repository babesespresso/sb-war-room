import Parser from 'rss-parser';
import { createServiceClient, DEFAULT_TENANT } from '@/lib/supabase/client';

const parser = new Parser();

// Colorado news sources with RSS feeds (fallback)
export const COLORADO_NEWS_SOURCES = [
  { name: 'Denver Post', feed: 'https://www.denverpost.com/feed/', type: 'newspaper' },
  { name: 'Colorado Sun', feed: 'https://coloradosun.com/feed/', type: 'newspaper' },
  { name: 'Colorado Springs Gazette', feed: 'https://gazette.com/search/?f=rss', type: 'newspaper' },
  { name: 'Colorado Politics', feed: 'https://www.coloradopolitics.com/search/?f=rss', type: 'online' },
  { name: '9News Colorado', feed: 'https://www.9news.com/feeds/syndication/rss/news', type: 'tv' },
  { name: 'CPR News', feed: 'https://www.cpr.org/feed/', type: 'radio' },
  { name: 'Westword', feed: 'https://www.westword.com/xml/rss/all', type: 'online' },
];

export interface ScrapedArticle {
  title: string;
  link: string;
  published: string;
  content: string;
  sourceName: string;
  sourceType: string;
}

// ============================================================
// NEWSDATA.IO - Targeted Political News API
// ============================================================

const NEWSDATA_BASE = 'https://newsdata.io/api/1/latest';

/**
 * Political search queries for the Colorado Governor race.
 * Each query targets a specific candidate or topic to ensure
 * every competitor has real intelligence data.
 */
const POLITICAL_QUERIES = [
  // Primary candidate
  '"Scott Bottoms" AND Colorado',
  // Top threats
  '"Michael Bennet" AND Colorado AND governor',
  '"Phil Weiser" AND Colorado AND governor',
  '"Victor Marx" AND Colorado AND governor',
  '"Barbara Kirkmeyer" AND Colorado',
  // Other candidates
  '"Greg Lopez" AND Colorado AND governor',
  // Broad race coverage
  'Colorado governor race 2026',
  'Colorado Republican primary governor',
  'Colorado Democratic primary governor',
];

interface NewsDataArticle {
  article_id: string;
  title: string;
  link: string;
  description: string | null;
  content: string | null;
  pubDate: string | null;
  pubDateTZ: string | null;
  source_id: string;
  source_name: string;
  source_url: string;
  source_icon: string | null;
  language: string;
  country: string[];
  category: string[];
  sentiment: string | null;
  ai_tag: string | null;
  duplicate: boolean;
}

interface NewsDataResponse {
  status: string;
  totalResults: number;
  results: NewsDataArticle[];
  nextPage?: string;
}

/**
 * Fetch targeted political news from NewsData.io API.
 * Searches for each candidate and race-related keywords.
 * Returns deduplicated articles sorted by relevance.
 */
export async function scrapeNewsDataIO(): Promise<ScrapedArticle[]> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    console.warn('[NewsData.io] No API key configured, falling back to RSS');
    return [];
  }

  const articles: ScrapedArticle[] = [];
  const seenUrls = new Set<string>();

  for (const query of POLITICAL_QUERIES) {
    try {
      const params = new URLSearchParams({
        apikey: apiKey,
        q: query,
        country: 'us',
        language: 'en',
        size: '10',
      });

      const res = await fetch(`${NEWSDATA_BASE}?${params.toString()}`);

      if (!res.ok) {
        const errText = await res.text();
        // Rate limit or quota exceeded — stop querying
        if (res.status === 429 || res.status === 403) {
          console.warn(`[NewsData.io] Rate limited or quota exceeded. Stopping further queries.`);
          break;
        }
        console.error(`[NewsData.io] Query "${query}" failed (${res.status}): ${errText}`);
        continue;
      }

      const data: NewsDataResponse = await res.json();

      if (data.status !== 'success' || !data.results) {
        continue;
      }

      for (const item of data.results) {
        // Skip duplicates
        if (!item.link || seenUrls.has(item.link)) continue;
        if (item.duplicate) continue;

        seenUrls.add(item.link);

        articles.push({
          title: item.title || '',
          link: item.link,
          published: item.pubDate || item.pubDateTZ || new Date().toISOString(),
          content: item.content || item.description || '',
          sourceName: item.source_name || item.source_id || 'Unknown',
          sourceType: categorizeSource(item.source_name || ''),
        });
      }

      // Respect rate limits: 30 credits per 15 min on free tier
      // ~500ms between queries to be safe
      await new Promise(resolve => setTimeout(resolve, 600));

    } catch (err) {
      console.error(`[NewsData.io] Error for query "${query}":`, err);
    }
  }

  console.log(`[NewsData.io] Fetched ${articles.length} unique political articles across ${POLITICAL_QUERIES.length} queries`);
  return articles;
}

/**
 * Categorize a news source by name into a type
 */
function categorizeSource(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('post') || lower.includes('sun') || lower.includes('gazette') || lower.includes('times') || lower.includes('journal')) return 'newspaper';
  if (lower.includes('news') || lower.includes('cpr') || lower.includes('fox') || lower.includes('cbs') || lower.includes('nbc') || lower.includes('abc')) return 'tv';
  if (lower.includes('wire') || lower.includes('ap') || lower.includes('reuters') || lower.includes('upi')) return 'wire';
  return 'online';
}

// ============================================================
// RSS FEEDS (Fallback)
// ============================================================

/**
 * Fetch RSS feeds from all Colorado news sources
 */
export async function scrapeNewsFeeds(): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];

  for (const source of COLORADO_NEWS_SOURCES) {
    try {
      const feed = await parser.parseURL(source.feed);
      for (const item of (feed.items || []).slice(0, 10)) {
        articles.push({
          title: item.title || '',
          link: item.link || '',
          published: item.pubDate || item.isoDate || new Date().toISOString(),
          content: item.contentSnippet || item.content || '',
          sourceName: source.name,
          sourceType: source.type,
        });
      }
    } catch (err) {
      console.error(`[NewsScraper] Failed to fetch ${source.name}:`, err);
    }
  }

  return articles;
}

// ============================================================
// COMBINED SCRAPER
// ============================================================

/**
 * Primary method: fetch targeted political news from NewsData.io,
 * then supplement with RSS feeds for local Colorado coverage.
 * Deduplicates against existing database entries.
 */
export async function scrapeAllNews(tenantId = DEFAULT_TENANT): Promise<ScrapedArticle[]> {
  const db = createServiceClient();

  // Get existing URLs to avoid duplicates
  const { data: existing } = await db
    .from('news_items')
    .select('source_url')
    .eq('tenant_id', tenantId)
    .not('source_url', 'is', null);

  const existingUrls = new Set((existing || []).map((e: any) => e.source_url));

  // 1. NewsData.io targeted political news (primary)
  let articles = await scrapeNewsDataIO();

  // 2. RSS feeds for broad Colorado coverage (supplement)
  if (articles.length < 20) {
    const rssArticles = await scrapeNewsFeeds();
    articles = [...articles, ...rssArticles];
  }

  // 3. Deduplicate against DB
  const fresh = articles.filter(a => a.link && !existingUrls.has(a.link));

  console.log(`[AllNews] ${articles.length} total → ${fresh.length} new (after dedup vs ${existingUrls.size} existing)`);
  return fresh;
}

/**
 * Scrape a competitor's Twitter/X profile for recent posts
 * Note: Requires valid X API v2 credentials
 */
export async function scrapeCompetitorSocial(handle: string, platform: string): Promise<any[]> {
  console.log(`[Scraper] Would scrape ${platform}/@${handle}`);
  return [];
}

/**
 * Scrape Reddit for Colorado-specific discussions
 * Uses Reddit's JSON API (no auth required for public subreddits)
 */
export async function scrapeReddit(subreddits: string[] = ['Colorado', 'Denver', 'ColoradoSprings', 'ColoradoPolitics']): Promise<any[]> {
  const posts: any[] = [];

  for (const sub of subreddits) {
    try {
      const response = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=25`, {
        headers: { 'User-Agent': 'WarBird/1.0' },
      });

      if (!response.ok) continue;

      const data = await response.json();
      for (const child of data.data?.children || []) {
        const post = child.data;
        posts.push({
          platform: 'reddit',
          source: `r/${sub}`,
          title: post.title,
          text: post.selftext?.substring(0, 1000) || '',
          url: `https://reddit.com${post.permalink}`,
          score: post.score,
          comments: post.num_comments,
          created: new Date(post.created_utc * 1000).toISOString(),
        });
      }
    } catch (err) {
      console.error(`[Reddit] Failed to scrape r/${sub}:`, err);
    }
  }

  return posts;
}

/**
 * Seed news sources into the database
 */
export async function seedNewsSources(tenantId = DEFAULT_TENANT) {
  const db = createServiceClient();

  for (const source of COLORADO_NEWS_SOURCES) {
    await db.from('news_sources').upsert({
      tenant_id: tenantId,
      name: source.name,
      source_type: source.type,
      feed_url: source.feed,
      reliability_score: 7,
      is_active: true,
    }, { onConflict: 'tenant_id,name' as any });
  }
}
