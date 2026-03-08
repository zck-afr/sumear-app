'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

/**
 * /auth/extension — Bridge page between dashboard and Chrome extension.
 * 
 * Flow:
 * 1. Extension opens this page in a tab
 * 2. Page gets the session from Supabase (client-side, has access to auth)
 * 3. Page sends the token back to the extension via chrome.runtime.sendMessage
 * 4. Page auto-closes
 */
export default function ExtensionAuthPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Connexion en cours...')

  useEffect(() => {
    async function sendTokenToExtension() {
      try {
        const supabase = createClient()
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error || !session) {
          setStatus('error')
          setMessage('Vous n\'êtes pas connecté. Connectez-vous d\'abord.')
          return
        }

        // Try to send token to extension via chrome.runtime.sendMessage
        // The extension ID can be detected from the URL query param
        const params = new URLSearchParams(window.location.search)
        const extensionId = params.get('ext')

        if (extensionId && typeof chrome !== 'undefined' && chrome.runtime) {
          try {
            await chrome.runtime.sendMessage(extensionId, {
              action: 'set_token',
              token: session.access_token,
              expires_at: session.expires_at,
              email: session.user.email,
            })
            setStatus('success')
            setMessage('Connecté ! Vous pouvez fermer cet onglet.')
            // Auto-close after 1.5s
            setTimeout(() => window.close(), 1500)
            return
          } catch {
            // Extension not reachable via sendMessage, use fallback
          }
        }

        // Fallback: store token in localStorage for the extension to read
        // via executeScript on this page
        window.__BRIEFAI_TOKEN__ = {
          access_token: session.access_token,
          expires_at: session.expires_at,
          email: session.user.email,
        }

        setStatus('success')
        setMessage('Connecté ! Vous pouvez fermer cet onglet.')
        setTimeout(() => window.close(), 2000)
      } catch (err) {
        setStatus('error')
        setMessage('Erreur de connexion.')
      }
    }

    sendTokenToExtension()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <div className="mx-auto w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        )}
        {status === 'success' && (
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xl font-bold">✓</div>
        )}
        {status === 'error' && (
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl font-bold">✗</div>
        )}
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  )
}

// Extend window type for the token
declare global {
  interface Window {
    __BRIEFAI_TOKEN__?: {
      access_token: string
      expires_at: number
      email: string
    }
  }
}
