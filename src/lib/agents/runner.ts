import Anthropic from '@anthropic-ai/sdk';
import { logAgentRun, completeAgentRun, getActiveVideoTalkingPoints } from '@/lib/supabase/queries';
import { createServiceClient, DEFAULT_TENANT } from '@/lib/supabase/client';
import type { AgentRun } from '@/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AgentConfig {
  name: string;
  tenantId?: string;
  systemPrompt: string;
  model?: string;
  maxTokens?: number;
}

export interface AgentResult {
  runId: string;
  output: string;
  parsed: any;
  tokensInput: number;
  tokensOutput: number;
}

/**
 * Run an agent with full logging and error handling.
 * 
 * @param config - Agent configuration
 * @param userMessage - The data/context to process
 * @param runType - How this run was triggered
 */
export async function runAgent(
  config: AgentConfig,
  userMessage: string,
  runType: 'scheduled' | 'triggered' | 'manual' = 'scheduled'
): Promise<AgentResult> {
  const tenantId = config.tenantId || DEFAULT_TENANT;

  // Log the start of the run
  const run = await logAgentRun({
    tenant_id: tenantId,
    agent_name: config.name,
    run_type: runType,
    status: 'running',
  });

  try {
    const response = await anthropic.messages.create({
      model: config.model || 'claude-sonnet-4-20250514',
      max_tokens: config.maxTokens || 4096,
      system: config.systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => {
        if (block.type === 'text') return block.text;
        return '';
      })
      .join('\n');

    // Try to parse JSON from the response
    let parsed: any = null;
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Not JSON, that's fine for some agents (like daily brief)
    }

    const tokensInput = response.usage.input_tokens;
    const tokensOutput = response.usage.output_tokens;
    const cost = (tokensInput * 0.003 + tokensOutput * 0.015) / 1000; // Sonnet pricing

    await completeAgentRun(run.id, {
      status: 'completed',
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      api_cost: cost,
      run_summary: textContent.substring(0, 500),
    });

    return {
      runId: run.id,
      output: textContent,
      parsed,
      tokensInput,
      tokensOutput,
    };
  } catch (error: any) {
    await completeAgentRun(run.id, {
      status: 'failed',
      error_message: error.message,
      error_details: { stack: error.stack },
    });
    throw error;
  }
}

/**
 * Load tenant configuration for agent prompt injection
 */
export async function loadTenantContext(tenantId = DEFAULT_TENANT) {
  const db = createServiceClient();

  const [tenant, positions, competitors, videoTalkingPoints] = await Promise.all([
    db.from('tenants').select('*').eq('id', tenantId).single(),
    db.from('candidate_positions').select('*').eq('tenant_id', tenantId).eq('is_active', true),
    db.from('competitors').select('*').eq('tenant_id', tenantId).eq('is_active', true),
    getActiveVideoTalkingPoints(tenantId).catch(() => ({ talking_points: [], voice_patterns: [], policy_positions: [], source_count: 0 })),
  ]);

  return {
    tenant: tenant.data,
    positions: positions.data || [],
    competitors: competitors.data || [],
    videoTalkingPoints,
  };
}

/**
 * Inject tenant context into a system prompt template
 */
export function hydratePrompt(template: string, context: Record<string, any>): string {
  let prompt = template;
  for (const [key, value] of Object.entries(context)) {
    const placeholder = `{{${key}}}`;
    const replacement = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    prompt = prompt.replaceAll(placeholder, replacement);
  }
  return prompt;
}
