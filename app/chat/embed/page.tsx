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
          'Session non re\u00e7ue. V\u00e9rifiez : 1) Vous \u00eates connect\u00e9 sur https://sumear.app (ou localhost:3000 en dev) avec Google. ' +
          '2) Dans F12 \u2192 Application \u2192 Cookies, un cookie sb-...-auth-token doit exister pour ce domaine. ' +
          '3) Fermez le panneau, actualisez la page produit puis cliquez \u00e0 nouveau sur l\u2019extension \u2192 Analyser.'
        )
      }
    }, 15000)

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'sumear-auth') {
        const { access_token, refresh_token } = event.data
        if (!access_token) {
          resolvedRef.current = true
          setStatus('error')
          setErrorMessage('Connexion requise. Ouvrez Sumear (https://sumear.app) dans un onglet et connectez-vous avec Google.')
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
            const msg = err instanceof Error ? err.message : 'Erreur lors de la connexion.'
            setErrorMessage(msg.includes('refresh_token') ? msg : `Erreur lors de la connexion. ${msg}`)
          }
        })()
      } else if (event.data?.type === 'sumear-auth-error') {
        resolvedRef.current = true
        setStatus('error')
        setErrorMessage(event.data?.error || 'Session non disponible. Connectez-vous sur Sumear d\'abord.')
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

  const embedBg = '#F9F4F0'
  const spinner = (
    <div className="w-6 h-6 border-2 border-[#EDE8DF] border-t-[#B8715A] rounded-full animate-spin" />
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
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(184,113,90,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B8715A', fontSize: 20 }}>!</div>
        <p style={{ fontSize: 13, color: '#7A6258', textAlign: 'center', lineHeight: 1.5 }}>{errorMessage}</p>
        <p style={{ fontSize: 11, color: '#B09890', textAlign: 'center' }}>
          Ouvrez <a href="/login" target="_blank" rel="noopener noreferrer" style={{ color: '#B8715A', textDecoration: 'underline' }}>Sumear</a> dans un onglet, connectez-vous avec Google, puis r&eacute;essayez.
        </p>
      </div>
    )
  }

  const isInIframe = typeof window !== 'undefined' && window !== window.top
  if (!isInIframe) {
    return (
      <div style={{ minHeight: '100vh', background: embedBg, padding: 32 }}>
        <p style={{ fontSize: 13, color: '#7A6258' }}>Cette page est pr&eacute;vue pour l&apos;extension. Ouvrez une page produit puis cliquez sur l&apos;extension &rarr; Analyser.</p>
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
