import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GHL_BASE_URL = 'https://rest.gohighlevel.com/v1';

function getHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
}

interface Opportunity {
  id: string;
  pipelineStageId: string;
  status: string;
}

async function fetchAllOpportunities(pipelineId: string): Promise<Opportunity[]> {
  const all: Opportunity[] = [];
  let startAfter: string | null = null;
  let startAfterId: string | null = null;
  const maxPages = 10;
  let page = 0;

  while (page < maxPages) {
    let path = `${GHL_BASE_URL}/pipelines/${pipelineId}/opportunities/?limit=100`;
    if (startAfter && startAfterId) {
      path += `&startAfter=${startAfter}&startAfterId=${startAfterId}`;
    }
    const res = await fetch(path, { headers: getHeaders(), cache: 'no-store' });
    if (!res.ok) break;
    const data = await res.json();
    if (!data.opportunities?.length) break;
    all.push(...data.opportunities);
    if (!data.meta?.startAfter) break;
    startAfter = data.meta.startAfter;
    startAfterId = data.meta.startAfterId;
    page++;
  }
  return all;
}

export async function GET() {
  try {
    const apiKey = process.env.GHL_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GHL_API_KEY not configured' }, { status: 500 });
    }

    // Fetch pipelines
    const pipelinesRes = await fetch(`${GHL_BASE_URL}/pipelines/`, {
      headers: getHeaders(), cache: 'no-store',
    });
    if (!pipelinesRes.ok) throw new Error('Failed to fetch pipelines');
    const pipelinesData = await pipelinesRes.json();
    const pipelines: Pipeline[] = pipelinesData.pipelines || [];

    let totalOpportunities = 0;
    const pipelineResults = [];

    for (const pipeline of pipelines) {
      const opportunities = await fetchAllOpportunities(pipeline.id);
      
      // Count opportunities per stage
      const stageCounts: Record<string, number> = {};
      for (const stage of pipeline.stages) {
        stageCounts[stage.id] = 0;
      }
      for (const opp of opportunities) {
        if (stageCounts[opp.pipelineStageId] !== undefined) {
          stageCounts[opp.pipelineStageId]++;
        }
      }

      const stages = pipeline.stages.map(s => ({
        id: s.id,
        name: s.name,
        count: stageCounts[s.id] || 0,
      }));

      const pipelineTotal = opportunities.length;
      totalOpportunities += pipelineTotal;

      pipelineResults.push({
        name: pipeline.name,
        stages,
        total: pipelineTotal,
      });
    }

    return NextResponse.json({
      pipelines: pipelineResults,
      totalOpportunities,
      status: 'live',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('MMDB Funnel API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
