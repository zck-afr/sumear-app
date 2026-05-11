'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatContent } from '@/components/chat/chat-content'
import { Suspense } from 'react'
/** Chat embed for extension iframe: auth via postMessage, then render chat. */
function EmbedChat() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [embedAccessToken, setEmbedAccessToken] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const resolvedRef = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || window === window.top) return
    const html = document.documentElement
    const body = document.body
    html.style.height = '100%'
    body.style.height = '100%'
    body.style.margin = '0'
    return () => {
      html.style.height = ''
      body.style.height = ''
      body.style.margin = ''
    }
  }, [])

  useEffect(() => {
    if (!mounted) return

    const isInIframe = window !== window.top
    if (!isInIframe) {
      setStatus('ready')
      return
    }

    const supabase = createClient()
    const timeout = setTimeout(() => {
      if (!resolvedRef.current) {
        setStatus('error')
        setErrorMessage(
          'Session not received. Check: 1) You are signed in to https://sumear.app (or localhost:3000 in dev) with Google. ' +
          '2) In F12 \u2192 Application \u2192 Cookies, an sb-...-auth-token cookie must exist for this domain. ' +
          '3) Close the panel, refresh the product page, then click the extension again \u2192 Analyze.'
        )
      }
    }, 15000)

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'sumear-auth') {
        const { access_token, refresh_token } = event.data
        if (!access_token) {
          resolvedRef.current = true
          setStatus('error')
          setErrorMessage('Sign-in required. Open Sumear (https://sumear.app) in a tab and sign in with Google.')
          return
        }
        resolvedRef.current = true
        ;(async () => {
          try {
            if (!refresh_token || refresh_token.length < 10) {
              setEmbedAccessToken(access_token)
              setStatus('ready')
              return
            }

            await supabase.auth.setSession({
              access_token,
              refresh_token,
            })

            let session = (await supabase.auth.getSession()).data.session
            if (!session?.access_token) {
              const refreshed = await supabase.auth.refreshSession()
              session = refreshed.data.session
            }
            setEmbedAccessToken(session?.access_token ?? access_token)
            setStatus('ready')
          } catch (err: unknown) {
            setStatus('error')
            const msg = err instanceof Error ? err.message : 'Sign-in error.'
            setErrorMessage(msg.includes('refresh_token') ? msg : `Sign-in error. ${msg}`)
          }
        })()
      } else if (event.data?.type === 'sumear-auth-error') {
        resolvedRef.current = true
        setStatus('error')
        setErrorMessage(event.data?.error || 'Session unavailable. Sign in to Sumear first.')
      }
    }

    window.addEventListener('message', onMessage)
    const requestAuth = () => {
      if (!resolvedRef.current) window.parent.postMessage({ type: 'sumear-request-auth' }, '*')
    }
    requestAuth()
    const interval = setInterval(requestAuth, 800)

    return () => {
      window.removeEventListener('message', onMessage)
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [mounted])

  const embedBg = 'var(--ds-bg-page)'
  const spinner = (
    <div
      className="animate-spin"
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        border: '2px solid var(--ds-bg-image)',
        borderTopColor: 'var(--ds-accent)',
      }}
    />
  )

  if (!mounted || status === 'loading') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: embedBg }}>
        {spinner}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ height: '100%', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: embedBg, padding: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--ds-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ds-accent)', fontSize: 20 }}>!</div>
        <p style={{ fontSize: 13, color: 'var(--ds-text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>{errorMessage}</p>
        <p style={{ fontSize: 11, color: 'var(--ds-text-muted)', textAlign: 'center' }}>
          Open <a href="/login" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ds-accent)', textDecoration: 'underline' }}>Sumear</a> in a tab, sign in with Google, then try again.
        </p>
      </div>
    )
  }

  const isInIframe = typeof window !== 'undefined' && window !== window.top
  if (!isInIframe) {
    return (
      <div style={{ minHeight: '100vh', background: embedBg, padding: 32 }}>
        <p style={{ fontSize: 13, color: 'var(--ds-text-secondary)' }}>This page is meant for the extension. Open a product page, then click the extension &rarr; Analyze.</p>
      </div>
    )
  }

  if (!embedAccessToken) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: embedBg }}>
        {spinner}
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: embedBg }}>
        {spinner}
      </div>
    }>
      <ChatContent embedAccessToken={embedAccessToken} isEmbed />
    </Suspense>
  )
}

export default function ChatEmbedPage() {
  return <EmbedChat />
}
