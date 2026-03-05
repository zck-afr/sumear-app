import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkQuota, incrementUsage } from '@/lib/utils/quota'

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
    const supabase = await createClient()

    // ── Auth check ──
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
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

    // ── Quota check ──
    const quota = await checkQuota(supabase, user.id, 'clips')
    if (!quota.is_allowed) {
      return NextResponse.json(
        {
          error: 'Clip quota exceeded',
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

    // ── Increment usage ──
    await incrementUsage(supabase, user.id, 'clips')

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
 * Returns all clips for the authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const { data: clips, error } = await supabase
      .from('clips')
      .select('id, product_name, brand, source_domain, image_url, price, currency, rating, review_count, extraction_method, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch clips', code: 'FETCH_FAILED' },
        { status: 500 }
      )
    }

    return NextResponse.json({ clips })
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
