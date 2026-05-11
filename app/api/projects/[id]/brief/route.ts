import { NextResponse } from 'next/server'
import { createClient, createClientWithJWT } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import { callLLM, planForLlm } from '@/lib/llm/provider'
import { projectBriefCacheFingerprint } from '@/lib/utils/project-brief-fingerprint'
import { checkQuota, incrementUsage } from '@/lib/utils/quota'
import { checkRateLimit, rateLimitResponse } from '@/lib/utils/rate-limit'
import { logAiCall } from '@/lib/utils/ai-log'
import { sanitizeProductData } from '@/lib/utils/sanitize'
import {
  coerceEbayData,
  formatEbayContext,
  isEbaySource,
  EBAY_SYSTEM_PROMPT_ADDENDUM,
} from '@/lib/utils/format-ebay-context'
import type { Clip } from '@/components/chat/chat-content'

const DEBOUNCE_MS = 30_000

const BRIEF_SYSTEM_PROMPT = `You are a concise shopping assistant. The user has a purchase project.
Generate a short summary (3-4 sentences max) of their setup by analyzing the listed products.
Briefly mention: what they already have, what may be missing, and how the total spent compares to their stated target budget when they have set one (under / on track / over).
If no target budget was set, do not invent one — focus on the product mix and gaps.
Respond directly in plain text, with no title, no markdown, no lists — just smooth, useful prose.

Always respond in the same language as the user's message.`

/**
 * POST /api/projects/[id]/brief
 * Generates (or returns cached) AI brief for a project.
 *
 * Body: { fingerprint: string }
 * The client computes the fingerprint and sends it so we can short-circuit
 * without re-fetching clips if the cache is still valid.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  try {
    let supabase = await createClient()
    let user: User | null = (await supabase.auth.getUser()).data.user

    if (!user) {
      const authHeader = request.headers.get('Authorization')
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
      if (token) {
        const jwtClient = createClientWithJWT(token)
        const { data: { user: u } } = await jwtClient.auth.getUser(token)
        if (u) { user = u; supabase = jwtClient }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const rl = checkRateLimit(`brief:${user.id}`, 5)
    if (!rl.allowed) {
      const r = rateLimitResponse(rl.retryAfterMs)
      return NextResponse.json(r.body, { status: r.status, headers: r.headers })
    }

    let body: { fingerprint?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
    }

    const clientFingerprint = typeof body.fingerprint === 'string' ? body.fingerprint.slice(0, 128) : null

    // Fetch project with brief cache columns
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    // Fetch clips for this project (+ ebay_data for the prompt context)
    const { data: clips } = await supabase
      .from('clips')
      .select('id, product_name, brand, price, currency, image_url, source_domain, rating, review_count, ebay_data')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('clipped_at', { ascending: false })

    type ClipWithEbay = Clip & { source_domain: string; ebay_data?: unknown }
    const productsRaw: ClipWithEbay[] = (clips || []).map(c => ({
      id: c.id,
      product_name: c.product_name,
      brand: c.brand ?? null,
      price: c.price != null ? Number(c.price) : null,
      currency: c.currency || 'EUR',
      image_url: c.image_url ?? null,
      source_domain: c.source_domain || '',
      rating: c.rating ?? null,
      review_count: c.review_count ?? null,
      ebay_data: (c as { ebay_data?: unknown }).ebay_data ?? null,
    }))

    const products: Clip[] = productsRaw

    if (products.length === 0) {
      return NextResponse.json({ brief: '', fingerprint: '', cached: true })
    }

    const rawBudget = (project as { user_budget?: unknown }).user_budget
    const userBudget =
      rawBudget != null && Number.isFinite(Number(rawBudget))
        ? Number(rawBudget)
        : null
    const serverFingerprint = projectBriefCacheFingerprint(products, userBudget)

    // 1) Cache hit: fingerprint matches and brief exists
    if (
      project.ai_brief &&
      String(project.ai_brief).trim() !== '' &&
      project.ai_brief_fingerprint === serverFingerprint
    ) {
      return NextResponse.json({
        brief: project.ai_brief,
        fingerprint: serverFingerprint,
        cached: true,
      })
    }

    // 2) Debounce: if a brief was generated less than 30s ago, return stale brief
    if (project.brief_generated_at) {
      const elapsed = Date.now() - new Date(project.brief_generated_at).getTime()
      if (elapsed < DEBOUNCE_MS) {
        return NextResponse.json({
          brief: project.ai_brief || '',
          fingerprint: project.ai_brief_fingerprint || '',
          cached: true,
          debounced: true,
          retry_after_ms: DEBOUNCE_MS - elapsed,
        })
      }
    }

    // 3) Quota check
    const quota = await checkQuota(supabase, user.id, 'ai_messages')
    if (!quota.is_allowed) {
      return NextResponse.json({
        brief: project.ai_brief || '',
        fingerprint: project.ai_brief_fingerprint || '',
        cached: true,
        quota_exceeded: true,
        ai_messages_count: quota.ai_messages_count,
        ai_messages_limit: quota.ai_messages_limit,
        plan: quota.plan,
      })
    }

    // 4) Generate brief
    const currency = products.find(p => p.currency)?.currency || 'EUR'
    const totalSpent = products.reduce((sum, p) => sum + (p.price ?? 0), 0)
    const fmtPrice = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency })

    let hasEbayClip = false
    const productList = productsRaw
      .map(p => {
        const base = `• ${sanitizeProductData(p.product_name ?? '')}${p.price != null ? ` — ${fmtPrice(p.price)}` : ''}`
        if (!isEbaySource(p.source_domain)) return base
        const ebay = coerceEbayData(p.ebay_data)
        const ebayBlock = formatEbayContext(ebay, p.source_domain)
        if (!ebayBlock) return base
        hasEbayClip = true
        // Indent the eBay block so it stays visually attached to its product.
        const indented = ebayBlock.split('\n').map(l => `   ${l}`).join('\n')
        return `${base}\n${indented}`
      })
      .join('\n')

    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
    const llmPlan = planForLlm(profile?.plan)

    let content: string
    let inputTokens = 0
    let outputTokens = 0
    let costUsd = 0
    const budgetLine =
      userBudget != null && userBudget > 0
        ? `User's target budget: ${fmtPrice(userBudget)}`
        : 'User target budget: not set'

    const systemPromptForBrief = hasEbayClip
      ? `${BRIEF_SYSTEM_PROMPT}\n\n${EBAY_SYSTEM_PROMPT_ADDENDUM}`
      : BRIEF_SYSTEM_PROMPT

    try {
      const result = await callLLM(
        llmPlan,
        systemPromptForBrief,
        `Project: "${project.name}"\nProducts (${products.length}):\n${productList}\nTotal (sum of listed prices): ${fmtPrice(totalSpent)}\n${budgetLine}`,
        { maxTokens: 256 }
      )
      content = result.content
      inputTokens = result.input_tokens
      outputTokens = result.output_tokens

      costUsd = await logAiCall(supabase, {
        user_id: user.id,
        type: 'brief',
        model: result.model,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        cache_creation_input_tokens: result.cache_creation_input_tokens,
        cache_read_input_tokens: result.cache_read_input_tokens,
      })
    } catch (err: any) {
      console.error('[brief] LLM call failed:', err.message)
      return NextResponse.json(
        { error: 'AI brief generation failed', code: 'LLM_FAILED' },
        { status: 502 }
      )
    }

    // 5) Increment usage AFTER success (with token data)
    await incrementUsage(supabase, user.id, 'ai_messages', 1, {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
    })

    // 6) Persist brief + fingerprint + timestamp
    await supabase
      .from('projects')
      .update({
        ai_brief: content,
        ai_brief_fingerprint: serverFingerprint,
        brief_generated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .eq('user_id', user.id)

    return NextResponse.json({
      brief: content,
      fingerprint: serverFingerprint,
      cached: false,
    })
  } catch (err) {
    console.error('Unexpected error in POST /api/projects/[id]/brief:', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
