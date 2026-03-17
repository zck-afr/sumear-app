'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatContent } from '@/components/chat/chat-content'
import { Suspense } from 'react'
import { useTheme } from '@/components/theme-provider'

/** Chat embed for extension iframe: auth via postMessage, then render chat. */
function EmbedChat() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [embedAccessToken, setEmbedAccessToken] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const resolvedRef = useRef(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  // En iframe, forcer html/body à 100% pour que le centrage vertical fonctionne
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
          'Session non reçue. Vérifiez : 1) Vous êtes connecté sur http://localhost:3000 avec Google. ' +
          '2) Dans F12 → Application → Cookies → localhost:3000, un cookie sb-...-auth-token doit exister. ' +
          '3) Fermez le panneau, actualisez la page produit puis cliquez à nouveau sur l’extension → Analyser.'
        )
      }
    }, 15000)

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'briefai-auth') {
        const { access_token, refresh_token } = event.data
        if (!access_token) {
          resolvedRef.current = true
          setStatus('error')
          setErrorMessage('Connexion requise. Ouvrez BriefAI dans un onglet et connectez-vous avec Google.')
          return
        }
        resolvedRef.current = true
        ;(async () => {
          try {
            if (!refresh_token || refresh_token.length < 10) {
              throw new Error('refresh_token manquant. Ouvrez BriefAI dans un onglet, actualisez la page puis réessayez.')
            }
            await supabase.auth.setSession({
              access_token,
              refresh_token,
            })
            const { data: { session } } = await supabase.auth.getSession()
            setEmbedAccessToken(session?.access_token ?? access_token)
            setStatus('ready')
          } catch (err: unknown) {
            setStatus('error')
            const msg = err instanceof Error ? err.message : 'Erreur lors de la connexion.'
            setErrorMessage(msg.includes('refresh_token') ? msg : `Erreur lors de la connexion. ${msg}`)
          }
        })()
      } else if (event.data?.type === 'briefai-auth-error') {
        resolvedRef.current = true
        setStatus('error')
        setErrorMessage(event.data?.error || 'Session non disponible. Connectez-vous sur BriefAI d\'abord.')
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
  }, [mounted])

  const bg = 'bg-[#F5F0E8] dark:bg-[#1a1a1e]'
  const text = 'text-gray-900 dark:text-white'
  const muted = 'text-gray-500 dark:text-[#888]'

  if (!mounted) {
    return (
      <div className={`h-full min-h-[200px] flex flex-col items-center justify-center gap-4 ${bg} ${text}`}>
        <div className="w-8 h-8 border-2 border-gray-300 dark:border-[#333] border-t-violet-500 rounded-full animate-spin" />
        <p className={`text-sm ${muted}`}>Chargement...</p>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className={`h-full min-h-[200px] flex flex-col items-center justify-center gap-4 ${bg} ${text}`}>
        <div className="w-8 h-8 border-2 border-gray-300 dark:border-[#333] border-t-violet-500 rounded-full animate-spin" />
        <p className={`text-sm ${muted}`}>Chargement de la session...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={`h-full min-h-[200px] flex flex-col items-center justify-center gap-4 ${bg} ${text} p-6`}>
        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 dark:text-amber-400 text-xl">!</div>
        <p className={`text-sm text-center ${muted}`}>{errorMessage}</p>
        <p className={`text-xs ${muted} text-center`}>
          Ouvrez <a href="/login" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline">BriefAI</a> dans un onglet, connectez-vous avec Google, puis réessayez.
        </p>
      </div>
    )
  }

  const isInIframe = typeof window !== 'undefined' && window !== window.top
  if (!isInIframe) {
    return (
      <div className={`min-h-screen ${bg} ${text} p-8`}>
        <p className={muted}>Cette page est prévue pour l’extension. Ouvrez une page produit puis cliquez sur l’extension → Analyser.</p>
      </div>
    )
  }

  if (!embedAccessToken) {
    return (
      <div className={`h-full min-h-[200px] flex flex-col items-center justify-center gap-4 ${bg} ${text}`}>
        <div className="w-8 h-8 border-2 border-gray-300 dark:border-[#333] border-t-violet-500 rounded-full animate-spin" />
        <p className={`text-sm ${muted}`}>Chargement de la session...</p>
      </div>
    )
  }

  return (
    <div className={`h-full min-h-full flex flex-col ${bg} ${text}`}>
      <div className="shrink-0 flex justify-end p-2 border-b border-gray-200 dark:border-[#393E46]">
        <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 dark:border-[#393E46] bg-white dark:bg-[#393E46] p-0.5">
          <button type="button" onClick={() => setTheme('light')} title="Mode clair" className={`rounded-md p-1.5 transition-colors ${theme === 'light' ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'text-gray-500 dark:text-[#888] hover:bg-gray-100 dark:hover:bg-[#434850]'}`} aria-label="Mode clair">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
          </button>
          <button type="button" onClick={() => setTheme('dark')} title="Mode sombre" className={`rounded-md p-1.5 transition-colors ${theme === 'dark' ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'text-gray-500 dark:text-[#888] hover:bg-gray-100 dark:hover:bg-[#434850]'}`} aria-label="Mode sombre">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <Suspense fallback={<div className="flex items-center justify-center flex-1"><div className="w-6 h-6 border-2 border-gray-300 dark:border-[#333] border-t-violet-500 rounded-full animate-spin" /></div>}>
          <ChatContent embedAccessToken={embedAccessToken} isEmbed />
        </Suspense>
      </div>
    </div>
  )
}

export default function ChatEmbedPage() {
  return <EmbedChat />
}
