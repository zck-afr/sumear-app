import { SupabaseClient } from '@supabase/supabase-js'
import { estimateCost } from '@/lib/llm/provider'

export interface AiLogEntry {
  user_id: string
  session_id?: string | null
  type: 'chat' | 'brief'
  model: string
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

/**
 * Insert a row into `ai_logs` and return the estimated cost.
 * Fire-and-forget: errors are logged but never block the response.
 */
export async function logAiCall(
  supabase: SupabaseClient,
  entry: AiLogEntry
): Promise<number> {
  const cost = estimateCost(
    entry.model,
    entry.input_tokens,
    entry.output_tokens,
    entry.cache_creation_input_tokens,
    entry.cache_read_input_tokens
  )

  const { error } = await supabase.from('ai_logs').insert({
    user_id: entry.user_id,
    session_id: entry.session_id ?? null,
    type: entry.type,
    model: entry.model,
    input_tokens: entry.input_tokens,
    output_tokens: entry.output_tokens,
    cache_creation_input_tokens: entry.cache_creation_input_tokens,
    cache_read_input_tokens: entry.cache_read_input_tokens,
    cost_usd: cost,
  })

  if (error) {
    console.error('[ai-log] insert failed:', error.message)
  }

  return cost
}
