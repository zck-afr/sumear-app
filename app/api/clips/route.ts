import { NextResponse } from 'next/server'
import { createClient, createClientWithJWT } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import { checkQuota } from '@/lib/utils/quota'
import { checkRateLimit, rateLimitResponse } from '@/lib/utils/rate-limit'

/**
 * POST /api/clips
 * Receives product data from the Chrome extension and saves it as a clip.
 *
 * Headers:
 *   Authorization: Bearer <supabase_access_token>
 *
 * Body: ClipPayload (see ARCHITECTURE.md section 5)
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

    const rl = checkRateLimit(`clips:${user.id}`, 8)
    if (!rl.allowed) {
      const r = rateLimitResponse(rl.retryAfterMs)
      return NextResponse.json(r.body, { status: r.status, headers: r.headers })
    }

    // ── Parse body ──
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_BODY' },
        { status: 400 }
      )
    }

    // ── Validate required fields ──
    if (!body.source_url || !body.product_name) {
      return NextResponse.json(
        { error: 'source_url and product_name are required', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    // ── Input length limits ──
    const STR_MAX = 1000
    const TEXT_MAX = 10_000
    const SPECS_MAX_KEYS = 50
    const SPECS_VALUE_MAX = 2000

    if (typeof body.source_url !== 'string' || body.source_url.length > 2048 ||
        typeof body.product_name !== 'string' || body.product_name.length > STR_MAX) {
      return NextResponse.json(
        { error: 'Field too long or invalid type', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    if (body.brand && (typeof body.brand !== 'string' || body.brand.length > STR_MAX)) {
      return NextResponse.json({ error: 'brand too long', code: 'INVALID_INPUT' }, { status: 400 })
    }
    if (body.description && (typeof body.description !== 'string' || body.description.length > TEXT_MAX)) {
      return NextResponse.json({ error: 'description too long', code: 'INVALID_INPUT' }, { status: 400 })
    }
    if (body.raw_markdown && (typeof body.raw_markdown !== 'string' || body.raw_markdown.length > 50_000)) {
      return NextResponse.json({ error: 'raw_markdown too long', code: 'INVALID_INPUT' }, { status: 400 })
    }

    if (body.extracted_specs && typeof body.extracted_specs === 'object') {
      const entries = Object.entries(body.extracted_specs)
      const sanitized: Record<string, string> = {}
      let count = 0
      for (const [k, v] of entries) {
        if (count >= SPECS_MAX_KEYS) break
        const key = String(k).slice(0, 200)
        const val = String(v).slice(0, SPECS_VALUE_MAX)
        if (key) { sanitized[key] = val; count++ }
      }
      body.extracted_specs = sanitized
    }

    // ── Validate project_id ownership ──
    if (body.project_id) {
      const { data: proj } = await supabase
        .from('projects')
        .select('id')
        .eq('id', body.project_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!proj) {
        return NextResponse.json(
          { error: 'Project not found or not yours', code: 'INVALID_PROJECT' },
          { status: 400 }
        )
      }
    }

    // ── Quota check ──
    const quota = await checkQuota(supabase, user.id, 'clips')
    if (!quota.is_allowed) {
      return NextResponse.json(
        {
          error: 'Quota de clips atteint (plan Free : 8 clips max). Passe au Complete pour des clips illimités.',
          code: 'QUOTA_EXCEEDED',
          clips_count: quota.clips_count,
          clips_limit: quota.clips_limit,
          plan: quota.plan,
        },
        { status: 429 }
      )
    }

    // ── Insert clip ──
    const { data: clip, error: insertError } = await supabase
      .from('clips')
      .insert({
        user_id: user.id,
        project_id: body.project_id || null,
        source_url: body.source_url,
        source_domain: body.source_domain || extractDomain(body.source_url),
        product_name: body.product_name,
        brand: body.brand ?? null,
        image_url: body.image_url ?? null,
        price: body.price ?? null,
        currency: body.currency ?? 'EUR',
        rating: body.rating ?? null,
        review_count: body.review_count ?? null,
        raw_jsonld: body.raw_jsonld ?? null,
        raw_markdown: body.raw_markdown ?? null,
        extraction_method: body.extraction_method ?? 'markdown',
        extracted_specs: body.extracted_specs ?? {},
        extracted_reviews: body.extracted_reviews ?? [],
      })
      .select('id, product_name, source_domain, price, currency, created_at')
      .single()

    if (insertError) {
      console.error('Clip insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save clip', code: 'INSERT_FAILED' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { clip, quota: { clips_count: quota.clips_count + 1, clips_limit: quota.clips_limit } },
      { status: 201 }
    )
  } catch (err) {
    console.error('Unexpected error in POST /api/clips:', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/clips
 * Returns clips for the authenticated user.
 * Query: ?ids=id1,id2 — optional, filter by clip IDs (for embed).
 * Auth: cookies or Authorization: Bearer <token> (for iframe).
 */
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    const ids = idsParam ? idsParam.split(',').map(s => s.trim()).filter(Boolean) : null

    let query = supabase
      .from('clips')
      .select('id, product_name, brand, source_domain, image_url, price, currency, rating, review_count, created_at')
      .eq('user_id', user.id)

    if (ids?.length) {
      query = query.in('id', ids)
    } else {
      query = query.order('created_at', { ascending: false }).limit(100)
    }

    const { data: clips, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch clips', code: 'FETCH_FAILED' },
        { status: 500 }
      )
    }

    return NextResponse.json({ clips: clips ?? [] })
  } catch (err) {
    console.error('Unexpected error in GET /api/clips:', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}