import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/proxy-image?url=<encoded_url>
 * Proxies product images to avoid CORS/referrer blocking in iframes.
 * Only allows http/https URLs.
 */
export async function GET(request: NextRequest) {
  try {
    const urlParam = request.nextUrl.searchParams.get('url')
    if (!urlParam) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 })
    }
    let url: URL
    try {
      url = new URL(decodeURIComponent(urlParam))
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 })
    }

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'BriefAI/1.0 (Image proxy)' },
      redirect: 'follow',
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Image fetch failed' }, { status: res.status === 404 ? 404 : 502 })
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    console.error('proxy-image:', err)
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}
