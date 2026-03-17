import { NextResponse } from 'next/server'
import { createClient, createClientWithJWT } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import { callLLM, type PlanType } from '@/lib/llm/provider'
import { buildComparisonPrompt } from '@/lib/llm/prompts'

const CHAT_SYSTEM_PROMPT = `You are BriefAI, an impartial e-commerce shopping advisor. You work exclusively for the buyer — you have zero commercial relationship with any seller or brand.

You are in a conversation about specific products the user is comparing. The product data is provided below. Answer the user's questions based ONLY on this data and your general product knowledge.

RULES:
- Be concise and direct. No fluff.
- If you don't have enough data to answer, say so.
- Be honest about limitations and unknowns.
- Respond in French by default (BriefAI is in French). If the user clearly asks in another language, respond in that language.
- Don't repeat the full comparison — the user already has the verdict. Focus on their specific question.`

/**
 * POST /api/compare/chat
 * Handles follow-up questions about a comparison.
 *
 * Body: { comparison_id: string, message: string, history: Array<{role, content}> }
 */
export async function POST(request: Request) {
  try {
    let supabase = await createClient()
    let user: User | null = (await supabase.auth.getUser()).data.user

    if (!user) {
      const authHeader = request.headers.get('Authorization')
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
      if (token) {
        const jwtClient = createClientWithJWT(token)
        const { data: { user: u } } = await jwtClient.auth.getUser(token)
        if (u) {
          user = u
          supabase = jwtClient
        }
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    // ── Parse body ──
    let body: { comparison_id: string; message: string; history?: Array<{ role: string; content: string }> }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }

    if (!body.comparison_id || !body.message) {
      return NextResponse.json(
        { error: 'comparison_id and message are required', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    // ── Fetch comparison + clips ──
    const { data: comparison } = await supabase
      .from('comparisons')
      .select('id, result_analysis')
      .eq('id', body.comparison_id)
      .eq('user_id', user.id)
      .single()

    if (!comparison) {
      return NextResponse.json(
        { error: 'Comparison not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Fetch linked clips
    const { data: clipLinks } = await supabase
      .from('comparison_clips')
      .select('clip_id')
      .eq('comparison_id', body.comparison_id)

    const clipIds = clipLinks?.map(l => l.clip_id) || []

    const { data: clips } = await supabase
      .from('clips')
      .select('id, product_name, brand, price, currency, rating, review_count, description, source_domain, extracted_specs')
      .in('id', clipIds)

    if (!clips || clips.length === 0) {
      return NextResponse.json(
        { error: 'No clips found for this comparison', code: 'NO_CLIPS' },
        { status: 404 }
      )
    }

    // ── Build context ──
    const productContext = buildComparisonPrompt(clips)
    const verdictSummary = comparison.result_analysis?.verdict?.summary || ''

    const systemPrompt = `${CHAT_SYSTEM_PROMPT}

PRODUCT DATA:
${productContext}

PREVIOUS VERDICT:
${verdictSummary}`

    // Build conversation with history
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    if (body.history) {
      for (const msg of body.history.slice(-10)) { // Keep last 10 messages for context
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content })
        }
      }
    }
    messages.push({ role: 'user', content: body.message })

    // Build the full user message with conversation history
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    // ── Get user plan ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    const plan = (profile?.plan || 'free') as PlanType

    // ── Call LLM ──
    let llmResponse
    try {
      llmResponse = await callLLM(plan, systemPrompt, conversationText)
    } catch (err: any) {
      console.error('Chat LLM failed:', err.message)
      return NextResponse.json(
        { error: 'AI response failed. Please try again.', code: 'LLM_FAILED' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      reply: llmResponse.content,
      usage: {
        input_tokens: llmResponse.input_tokens,
        output_tokens: llmResponse.output_tokens,
      },
    })
  } catch (err) {
    console.error('Unexpected error in POST /api/compare/chat:', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
