'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { ComparisonEmbedContent } from '@/components/comparison/embed-content'

/** Compare embed for extension iframe: auth via postMessage, then fetch and show comparison. */
export default function CompareEmbedPage() {
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : null
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
    if (!mounted || !id) return

    const isInIframe = window !== window.top
    if (!isInIframe) {
      // Ouverture directe dans un onglet : on utilisera les cookies pour l’API (pas de postMessage)
      setStatus('ready')
      setEmbedAccessToken(null) // signal pour utiliser l’auth par cookies
      return
    }

    const supabase = createClient()
    const timeout = setTimeout(() => {
      if (!resolvedRef.current) {
        setStatus('error')
        setErrorMessage('Session non reçue. Connectez-vous sur BriefAI puis réessayez.')
      }
    }, 15000)

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'briefai-auth') {
        const { access_token, refresh_token } = event.data
        if (!access_token) {
          resolvedRef.current = true
          setStatus('error')
          setErrorMessage('Connexion requise.')
          return
        }
        resolvedRef.current = true
        ;(async () => {
          try {
            if (!refresh_token || refresh_token.length < 10) {
              throw new Error('refresh_token manquant.')
            }
            await supabase.auth.setSession({ access_token, refresh_token })
            // Utiliser la session courante (token potentiellement rafraîchi) pour éviter 401
            const { data: { session } } = await supabase.auth.getSession()
            setEmbedAccessToken(session?.access_token ?? access_token)
            setStatus('ready')
          } catch {
            setStatus('error')
            setErrorMessage('Erreur lors de la connexion.')
          }
        })()
      } else if (event.data?.type === 'briefai-auth-error') {
        resolvedRef.current = true
        setStatus('error')
        setErrorMessage(event.data?.error || 'Session non disponible.')
      }
    }

    window.addEventListener('message', onMessage)
    const requestAuth = () => {
      if (!resolvedRef.current) window.parent.postMessage({ type: 'briefai-request-auth' }, '*')
    }
    requestAuth()
    const interval = setInterval(requestAuth, 800)

    return () => {
      window.removeEventListener('message', onMessage)
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [mounted, id])

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a1e] text-white p-6">
        <p className="text-sm text-[#888]">ID de comparaison manquant.</p>
      </div>
    )
  }

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#1a1a1e] text-white p-6">
        <div className="w-8 h-8 border-2 border-[#333] border-t-violet-500 rounded-full animate-spin" />
        <p className="text-sm text-[#888]">Chargement de la session...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#1a1a1e] text-white p-6">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-xl">!</div>
        <p className="text-sm text-center text-[#aaa]">{errorMessage}</p>
      </div>
    )
  }

  // En iframe sans token = on attend encore le postMessage (éviter boucle "Chargement de la session")
  const isInIframe = typeof window !== 'undefined' && window !== window.top
  if (isInIframe && !embedAccessToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#1a1a1e] text-white p-6">
        <div className="w-8 h-8 border-2 border-[#333] border-t-violet-500 rounded-full animate-spin" />
        <p className="text-sm text-[#888]">Chargement de la session...</p>
      </div>
    )
  }

  return (
    <div
      className="min-h-full bg-[#1a1a1e] text-white overflow-auto"
      style={{ pointerEvents: 'auto', minHeight: '100%' }}
    >
      <ComparisonEmbedContent comparisonId={id} accessToken={embedAccessToken} />
    </div>
  )
}
