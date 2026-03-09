import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkQuota, incrementUsage } from '@/lib/utils/quota'
import { callLLM, estimateCost, type PlanType } from '@/lib/llm/provider'
import { COMPARISON_SYSTEM_PROMPT, buildComparisonPrompt, parseComparisonResponse } from '@/lib/llm/prompts'

/**
 * POST /api/compare
 * Launches an AI comparison between 2-5 clips.
 *
 * Body: { clip_ids: string[], project_id?: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // ── Auth ──
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    // ── Parse body ──
    let body: { clip_ids: string[]; project_id?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }

    // ── Validate ──
    if (!body.clip_ids || !Array.isArray(body.clip_ids) || body.clip_ids.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 clip_ids are required', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    if (body.clip_ids.length > 5) {
      return NextResponse.json(
        { error: 'Maximum 5 clips per comparison', code: 'TOO_MANY_CLIPS' },
        { status: 400 }
      )
    }

    // ── Quota check ──
    const quota = await checkQuota(supabase, user.id, 'comparisons')
    if (!quota.is_allowed) {
      return NextResponse.json(
        {
          error: 'Comparison quota exceeded',
          code: 'QUOTA_EXCEEDED',
          comparisons_count: quota.comparisons_count,
          comparisons_limit: quota.comparisons_limit,
          plan: quota.plan,
        },
        { status: 429 }
      )
    }

    // ── Fetch clips ──
    const { data: clips, error: clipsError } = await supabase
      .from('clips')
      .select('id, product_name, brand, price, currency, rating, review_count, description, source_domain, extracted_specs')
      .in('id', body.clip_ids)
      .eq('user_id', user.id)

    if (clipsError || !clips || clips.length < 2) {
      return NextResponse.json(
        { error: 'Could not fetch clips. Make sure they exist and belong to you.', code: 'CLIPS_NOT_FOUND' },
        { status: 404 }
      )
    }

    // ── Create comparison record (status: pending) ──
    const { data: comparison, error: insertError } = await supabase
      .from('comparisons')
      .insert({
        user_id: user.id,
        project_id: body.project_id ?? null,
        status: 'pending',
        model_used: null,
        input_tokens: null,
        output_tokens: null,
        api_cost_usd: null,
        result_matrix: null,
        result_analysis: null,
      })
      .select('id')
      .single()

    if (insertError || !comparison) {
      console.error('Comparison insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to create comparison', code: 'INSERT_FAILED' },
        { status: 500 }
      )
    }

    // ── Link clips to comparison ──
    const clipLinks = clips.map(clip => ({
      comparison_id: comparison.id,
      clip_id: clip.id,
    }))

    await supabase.from('comparison_clips').insert(clipLinks)

    // ── Call LLM ──
    const plan = (quota.plan || 'free') as PlanType
    const userMessage = buildComparisonPrompt(clips)

    let llmResponse
    try {
      llmResponse = await callLLM(plan, COMPARISON_SYSTEM_PROMPT, userMessage)
    } catch (err: any) {
      // LLM call failed — update status to failed
      await supabase
        .from('comparisons')
        .update({ status: 'failed' })
        .eq('id', comparison.id)

      console.error('LLM call failed:', err.message)
      return NextResponse.json(
        { error: 'AI analysis failed. Please try again.', code: 'LLM_FAILED' },
        { status: 502 }
      )
    }

    // ── Parse response ──
    let result
    try {
      result = parseComparisonResponse(llmResponse.content)
    } catch (err: any) {
      // Parse failed — save raw response for debugging, mark as failed
      await supabase
        .from('comparisons')
        .update({
          status: 'failed',
          result_analysis: { raw: llmResponse.content, error: err.message },
        })
        .eq('id', comparison.id)

      console.error('LLM parse failed:', err.message)
      return NextResponse.json(
        { error: 'AI response was malformed. Please try again.', code: 'PARSE_FAILED' },
        { status: 502 }
      )
    }

    // ── Update comparison with results ──
    const cost = estimateCost(llmResponse.model, llmResponse.input_tokens, llmResponse.output_tokens)

    await supabase
      .from('comparisons')
      .update({
        status: 'completed',
        model_used: llmResponse.model,
        input_tokens: llmResponse.input_tokens,
        output_tokens: llmResponse.output_tokens,
        api_cost_usd: cost,
        result_matrix: result.key_differences || [],
        result_analysis: result,
      })
      .eq('id', comparison.id)

    // ── Increment usage ──
    await incrementUsage(supabase, user.id, 'comparisons')

    return NextResponse.json({
      comparison_id: comparison.id,
      status: 'completed',
      result,
      usage: {
        model: llmResponse.model,
        input_tokens: llmResponse.input_tokens,
        output_tokens: llmResponse.output_tokens,
        cost_usd: cost,
      },
    })
  } catch (err) {
    console.error('Unexpected error in POST /api/compare:', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}