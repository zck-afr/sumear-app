import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callLLM, type PlanType } from '@/lib/llm/provider'

const CHAT_SYSTEM_PROMPT = `You are BriefAI, an impartial e-commerce shopping advisor. You work exclusively for the buyer — you have zero commercial relationship with any seller or brand.

The user is asking about specific products. Their data is provided below. Answer their questions based on this data and your general product knowledge.

RULES:
- Be concise and direct. No fluff.
- If you don't have enough data to answer, say so.
- Be honest about limitations, red flags, and unknowns.
- Respond in the same language as the user's question.
- If the user asks about durability, quality, or issues, use your knowledge of the brand/product category to give useful context.`

/**
 * POST /api/chat
 * Standalone chat about selected products.
 *
 * Body: { clip_ids: string[], message: string, history: Array<{role, content}> }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    let body: {
      clip_ids: string[]
      message: string
      history?: Array<{ role: string; content: string }>
      session_id?: string
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }

    if (!body.clip_ids?.length || !body.message) {
      return NextResponse.json(
        { error: 'clip_ids and message are required', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    // Fetch clips
    const { data: clips, error: clipsError } = await supabase
      .from('clips')
      .select('id, product_name, brand, price, currency, rating, review_count, description, source_domain, extracted_specs')
      .in('id', body.clip_ids)
      .eq('user_id', user.id)

    if (clipsError || !clips?.length) {
      return NextResponse.json(
        { error: 'Clips not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Build product context
    const productContext = clips.map((clip, i) => {
      const lines: string[] = []
      lines.push(`--- PRODUCT ${i + 1} ---`)
      lines.push(`Name: ${clip.product_name}`)
      if (clip.brand) lines.push(`Brand: ${clip.brand}`)
      if (clip.price != null) lines.push(`Price: ${clip.price} ${clip.currency}`)
      if (clip.rating != null) lines.push(`Rating: ${clip.rating}/5 (${clip.review_count ?? 0} reviews)`)
      lines.push(`Source: ${clip.source_domain}`)
      if (clip.description) lines.push(`Description: ${clip.description}`)
      const specs = Object.entries(clip.extracted_specs || {})
      if (specs.length > 0) {
        lines.push('Specs:')
        for (const [key, value] of specs) {
          lines.push(`  - ${key}: ${value}`)
        }
      }
      return lines.join('\n')
    }).join('\n\n')

    const systemPrompt = `${CHAT_SYSTEM_PROMPT}\n\nPRODUCT DATA:\n${productContext}`

    // Build conversation
    const messages: Array<{ role: string; content: string }> = []
    if (body.history) {
      for (const msg of body.history.slice(-10)) {
        messages.push(msg)
      }
    }
    messages.push({ role: 'user', content: body.message })

    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    // Get plan
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    const plan = (profile?.plan || 'free') as PlanType

    // Call LLM
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

    let sessionId = body.session_id

    if (sessionId) {
      const { error: sessionErr } = await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', user.id)
      if (sessionErr) sessionId = undefined
    }

    if (!sessionId) {
      const title = body.message.slice(0, 50).trim() + (body.message.length > 50 ? '…' : '')
      const { data: newSession, error: sessionErr } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user.id, title })
        .select('id')
        .single()
      if (sessionErr || !newSession) {
        console.error('Failed to create chat session:', sessionErr)
      } else {
        sessionId = newSession.id
        await supabase.from('chat_session_clips').insert(
          body.clip_ids.map((clip_id: string) => ({ session_id: sessionId, clip_id }))
        )
      }
    }

    if (sessionId) {
      await supabase.from('chat_messages').insert([
        { session_id: sessionId, role: 'user', content: body.message },
        { session_id: sessionId, role: 'assistant', content: llmResponse.content },
      ])
    }

    return NextResponse.json({
      reply: llmResponse.content,
      session_id: sessionId ?? undefined,
      usage: {
        input_tokens: llmResponse.input_tokens,
        output_tokens: llmResponse.output_tokens,
      },
    })
  } catch (err) {
    console.error('Unexpected error in POST /api/chat:', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
