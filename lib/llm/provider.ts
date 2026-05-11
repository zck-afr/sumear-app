// ============================================================================
// Sumear — LLM Provider Abstraction
// ============================================================================
// Handles model routing by plan and API calls to Anthropic.
// Free = Haiku 4.5, Complete = Sonnet 4.5.
// Prompt caching enabled when system prompt exceeds model-specific thresholds.
// ============================================================================

import Anthropic from '@anthropic-ai/sdk'

export type PlanType = 'free' | 'complete'

/** Plan profil Supabase → PlanType normalisé (free = free, tout le reste = complete). */
export function planForLlm(rawPlan: string | null | undefined): PlanType {
  if (rawPlan === 'free') return 'free'
  return 'complete'
}

interface ModelConfig {
  provider: 'anthropic'
  model: string
  maxTokens: number
  temperature: number
  cacheMinTokens: number // Minimum tokens for prompt caching to be worthwhile
}

const MODEL_BY_PLAN: Record<PlanType, ModelConfig> = {
  free: {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 4096,
    temperature: 0.3,
    cacheMinTokens: 2048, // Haiku minimum for prompt caching
  },
  complete: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 4096,
    temperature: 0.3,
    cacheMinTokens: 1024, // Sonnet requires 1024 tokens minimum for caching
  },
}

export interface LLMResponse {
  content: string
  model: string
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

// ── Singleton Anthropic client ──
// Reuse across calls to avoid re-creating on every request.
// The SDK handles connection pooling internally.
let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set')
    }
    _client = new Anthropic({ apiKey })
  }
  return _client
}

// ── Prompt caching helpers ──

/**
 * Rough token estimate: ~4 characters per token for mixed content.
 * This is conservative — real tokenization varies, but for the
 * threshold check it's good enough (we'd rather skip caching on
 * a borderline case than pay cache_write for nothing).
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Build the system parameter for the Anthropic API.
 * If the system prompt is long enough, wraps it with cache_control.
 * Otherwise, passes it as a plain string (no cache overhead).
 */
function buildSystemParam(
  systemPrompt: string,
  cacheMinTokens: number
): string | Anthropic.Messages.TextBlockParam[] {
  const estimatedTokens = estimateTokenCount(systemPrompt)

  if (estimatedTokens >= cacheMinTokens) {
    return [
      {
        type: 'text' as const,
        text: systemPrompt,
        cache_control: { type: 'ephemeral' as const },
      },
    ]
  }

  // Below threshold — plain string, no cache overhead
  return systemPrompt
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Build the messages array for the Anthropic API with an optional
 * cache breakpoint on the last history message (the turn just before
 * the new user message). This lets Anthropic cache the full
 * conversational prefix across turns.
 */
function buildMessagesParam(
  messages: ChatMessage[],
  cacheMinTokens: number
): Anthropic.Messages.MessageParam[] {
  if (messages.length <= 1) {
    return messages.map((m) => ({ role: m.role, content: m.content }))
  }

  // Estimate total history size (all messages except the last)
  const historyText = messages
    .slice(0, -1)
    .map((m) => m.content)
    .join('')
  const historyTokens = estimateTokenCount(historyText)

  return messages.map((m, i) => {
    // Place cache breakpoint on the second-to-last message (end of history)
    const isLastHistoryMsg = i === messages.length - 2
    if (isLastHistoryMsg && historyTokens >= cacheMinTokens) {
      return {
        role: m.role,
        content: [
          {
            type: 'text' as const,
            text: m.content,
            cache_control: { type: 'ephemeral' as const },
          },
        ],
      }
    }
    return { role: m.role, content: m.content }
  })
}

// ── LLM calls ──

export interface StreamUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  model: string
}

/**
 * Stream the LLM response token-by-token.
 * Yields text deltas as they arrive from Anthropic.
 * Accepts either a single user message (string) or a multi-turn
 * messages array for proper conversational caching.
 *
 * Pass `options.usageRef` to capture token usage from the stream
 * events (populated after iteration completes).
 */
export async function* streamLLM(
  plan: PlanType,
  systemPrompt: string,
  messagesOrText: string | ChatMessage[],
  options?: { maxTokens?: number; usageRef?: { current: StreamUsage | null } }
): AsyncGenerator<string> {
  const config = MODEL_BY_PLAN[plan]
  const maxTokens = Math.min(options?.maxTokens ?? config.maxTokens, config.maxTokens)
  const client = getClient()

  const messages: Anthropic.Messages.MessageParam[] =
    typeof messagesOrText === 'string'
      ? [{ role: 'user' as const, content: messagesOrText }]
      : buildMessagesParam(messagesOrText, config.cacheMinTokens)

  const stream = client.messages.stream({
    model: config.model,
    max_tokens: maxTokens,
    temperature: config.temperature,
    system: buildSystemParam(systemPrompt, config.cacheMinTokens),
    messages,
  })

  let inputTokens = 0
  let outputTokens = 0
  let cacheCreate = 0
  let cacheRead = 0

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text
    } else if (event.type === 'message_start') {
      const u = (event as any).message?.usage
      if (u) {
        inputTokens = u.input_tokens ?? 0
        cacheCreate = u.cache_creation_input_tokens ?? 0
        cacheRead = u.cache_read_input_tokens ?? 0
      }
    } else if (event.type === 'message_delta') {
      const u = (event as any).usage
      if (u) outputTokens = u.output_tokens ?? 0
    }
  }

  if (options?.usageRef) {
    options.usageRef.current = {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: cacheCreate,
      cache_read_input_tokens: cacheRead,
      model: config.model,
    }
  }
}

/**
 * Call the LLM with a system prompt and user/conversation messages.
 * Accepts either a single user message (string) or a multi-turn
 * messages array for proper conversational caching.
 */
export async function callLLM(
  plan: PlanType,
  systemPrompt: string,
  messagesOrText: string | ChatMessage[],
  options?: { maxTokens?: number }
): Promise<LLMResponse> {
  const config = MODEL_BY_PLAN[plan]
  const maxTokens = Math.min(options?.maxTokens ?? config.maxTokens, config.maxTokens)
  const client = getClient()

  const messages: Anthropic.Messages.MessageParam[] =
    typeof messagesOrText === 'string'
      ? [{ role: 'user' as const, content: messagesOrText }]
      : buildMessagesParam(messagesOrText, config.cacheMinTokens)

  const response = await client.messages.create({
    model: config.model,
    max_tokens: maxTokens,
    temperature: config.temperature,
    system: buildSystemParam(systemPrompt, config.cacheMinTokens),
    messages,
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  const content = textBlock?.text || ''

  return {
    content,
    model: config.model,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_creation_input_tokens:
      (response.usage as any).cache_creation_input_tokens ?? 0,
    cache_read_input_tokens:
      (response.usage as any).cache_read_input_tokens ?? 0,
  }
}

/**
 * Estimate the cost of an LLM call in USD.
 * Includes prompt caching pricing (write = 1.25x, read = 0.1x base input).
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number = 0,
  cacheReadTokens: number = 0
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-haiku-4-5-20251001': {
      input: 1 / 1_000_000,
      output: 5 / 1_000_000,
    },
    'claude-sonnet-4-5-20250929': {
      input: 3 / 1_000_000,
      output: 15 / 1_000_000,
    },
  }

  const p = pricing[model] || pricing['claude-haiku-4-5-20251001']

  // Non-cached input tokens (total input - cache_read)
  const uncachedInputTokens = Math.max(0, inputTokens - cacheReadTokens)
  const uncachedInputCost = uncachedInputTokens * p.input

  // Cache write: 1.25x base input price
  const cacheWriteCost = cacheCreationTokens * p.input * 1.25

  // Cache read: 0.1x base input price
  const cacheReadCost = cacheReadTokens * p.input * 0.1

  // Output
  const outputCost = outputTokens * p.output

  return uncachedInputCost + cacheWriteCost + cacheReadCost + outputCost
}

/**
 * Get the model config for a given plan.
 */
export function getModelConfig(plan: PlanType): ModelConfig {
  return MODEL_BY_PLAN[plan]
}

/**
 * Direct access to the singleton Anthropic client.
 * Most callers should use `streamLLM`/`callLLM` instead — this is reserved
 * for routes that need features the high-level helpers don't expose
 * (e.g. tools / web_search on the conversational chat route).
 */
export function getAnthropicClient(): Anthropic {
  return getClient()
}

/** Sonnet 4.5 model id — Complete plan + advanced features (web_search, etc.). */
export const MODEL_SONNET = MODEL_BY_PLAN.complete.model
/** Haiku 4.5 model id — cheap auxiliary calls (auto-titles, etc.). */
export const MODEL_HAIKU = MODEL_BY_PLAN.free.model
