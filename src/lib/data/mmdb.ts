/**
 * Shared MMDB (GoHighLevel) data-fetching module.
 * Used by both /api/analytics/mmdb and /api/analytics/priorities
 * to avoid fragile self-referencing HTTP calls.
 */

const GHL_BASE_URL = 'https://rest.gohighlevel.com/v1';

function getHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

interface GHLContact {
  id: string;
  dateAdded: string;
  [key: string]: unknown;
}

interface GHLContactsResponse {
  contacts: GHLContact[];
  meta: {
    total: number;
    startAfter?: number;
    startAfterId?: string;
    nextPageUrl?: string;
  };
}

export interface MMDBData {
  growth: {
    totalSupporters: number;
    weeklyVelocity: number;
    lastWeekVelocity: number;
    velocityChange: string;
  };
  pipelines: {
    totalOpportunities: number;
  };
  pagesScanned: number;
  status: 'live' | 'error';
  error?: string;
}

async function fetchContactsPage(startAfter?: number, startAfterId?: string): Promise<GHLContactsResponse> {
  let path = `${GHL_BASE_URL}/contacts/?limit=100`;
  if (startAfter && startAfterId) {
    path += `&startAfter=${startAfter}&startAfterId=${startAfterId}`;
  }
  const res = await fetch(path, { headers: getHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(`Contacts API error: ${res.status}`);
  return res.json();
}

/**
 * Fetch MMDB data directly from GoHighLevel.
 * Returns a consistent shape whether successful or not.
 */
export async function fetchMMDBData(): Promise<MMDBData> {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    return {
      growth: { totalSupporters: 0, weeklyVelocity: 0, lastWeekVelocity: 0, velocityChange: '—' },
      pipelines: { totalOpportunities: 0 },
      pagesScanned: 0,
      status: 'error',
      error: 'GHL_API_KEY not configured',
    };
  }

  // ── 1. Get total contacts ──
  const firstPage = await fetchContactsPage();
  const totalContacts = firstPage.meta?.total || 0;

  // ── 2. Paginate recent contacts to calculate weekly velocity ──
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

  let thisWeek = 0;
  let lastWeek = 0;
  let page: GHLContactsResponse = firstPage;
  let pagesScanned = 0;
  const maxPages = 8;

  const startTime = Date.now();
  const VERCEL_TIMEOUT_THRESHOLD = 8000;

  while (page.contacts && page.contacts.length > 0 && pagesScanned < maxPages) {
    if (Date.now() - startTime > VERCEL_TIMEOUT_THRESHOLD) {
      console.warn('MMDB: Approaching 10s timeout, breaking early.');
      break;
    }

    pagesScanned++;
    for (const contact of page.contacts) {
      const ts = new Date(contact.dateAdded).getTime();
      if (ts >= weekAgo) {
        thisWeek++;
      } else if (ts >= twoWeeksAgo) {
        lastWeek++;
      }
    }

    const oldestOnPage = new Date(page.contacts[page.contacts.length - 1].dateAdded).getTime();
    if (oldestOnPage < twoWeeksAgo) break;

    if (page.meta?.startAfter && page.meta?.startAfterId) {
      page = await fetchContactsPage(page.meta.startAfter, page.meta.startAfterId);
    } else {
      break;
    }
  }

  // ── 3. Calculate velocity change ──
  let velocityChange: string;
  if (lastWeek === 0 && thisWeek > 0) {
    velocityChange = '↑ Surge';
  } else if (lastWeek === 0) {
    velocityChange = '—';
  } else {
    const pct = ((thisWeek - lastWeek) / lastWeek) * 100;
    velocityChange = pct >= 0 ? `+${pct.toFixed(0)}%` : `${pct.toFixed(0)}%`;
  }

  // ── 4. Pipeline / Opportunity counts ──
  let pipelineTotal = 0;
  try {
    const pipelinesRes = await fetch(`${GHL_BASE_URL}/pipelines/`, {
      headers: getHeaders(),
      cache: 'no-store',
    });
    if (pipelinesRes.ok) {
      const pipelinesData = await pipelinesRes.json();
      const pipelines = pipelinesData.pipelines || [];

      const opportunityPromises = pipelines.map(async (pipeline: any) => {
        try {
          const oppRes = await fetch(
            `${GHL_BASE_URL}/pipelines/${pipeline.id}/opportunities/?limit=1`,
            { headers: getHeaders(), cache: 'no-store' }
          );
          if (oppRes.ok) {
            const oppData = await oppRes.json();
            return oppData.meta?.total || 0;
          }
        } catch {
          // skip individual pipeline errors
        }
        return 0;
      });

      const totals = await Promise.all(opportunityPromises);
      pipelineTotal = totals.reduce((sum: number, current: number) => sum + current, 0);
    }
  } catch {
    // Pipeline data is supplementary
  }

  return {
    growth: {
      totalSupporters: totalContacts,
      weeklyVelocity: thisWeek,
      lastWeekVelocity: lastWeek,
      velocityChange,
    },
    pipelines: {
      totalOpportunities: pipelineTotal,
    },
    pagesScanned,
    status: 'live',
  };
}
