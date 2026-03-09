// ============================================================================
// BriefAI — LLM Provider Abstraction
// ============================================================================
// Handles model routing by plan and API calls to Anthropic.
// For MVP: only Anthropic managed keys (Free=Haiku, Complete=Sonnet).
// BYOK support will be added in Phase 4.
// ============================================================================

import Anthropic from '@anthropic-ai/sdk'

export type PlanType = 'free' | 'pro' | 'complete'

interface ModelConfig {
  provider: 'anthropic'
  model: string
  maxTokens: number
  temperature: number
}

const MODEL_BY_PLAN: Record<PlanType, ModelConfig> = {
  free: {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 4096,
    temperature: 0.3,
  },
  pro: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929', // Default for BYOK, user can override later
    maxTokens: 4096,
    temperature: 0.3,
  },
  complete: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 4096,
    temperature: 0.3,
  },
}

export interface LLMResponse {
  content: string
  model: string
  input_tokens: number
  output_tokens: number
}

/**
 * Call the LLM with a system prompt and user message.
 * Returns the raw text response + token usage.
 */
export async function callLLM(
  plan: PlanType,
  systemPrompt: string,
  userMessage: string,
  apiKey?: string // For BYOK (Phase 4)
): Promise<LLMResponse> {
  const config = MODEL_BY_PLAN[plan]

  const client = new Anthropic({
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY!,
  })

  const response = await client.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage },
    ],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  const content = textBlock?.text || ''

  return {
    content,
    model: config.model,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  }
}

/**
 * Estimate the cost of an LLM call in USD.
 * Pricing as of 2026 (approximate).
 */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-haiku-4-5-20251001': { input: 1 / 1_000_000, output: 5 / 1_000_000 },
    'claude-sonnet-4-5-20250929': { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  }

  const p = pricing[model] || pricing['claude-haiku-4-5-20251001']
  return inputTokens * p.input + outputTokens * p.output
}

/**
 * Get the model config for a given plan.
 */
export function getModelConfig(plan: PlanType): ModelConfig {
  return MODEL_BY_PLAN[plan]
}
