import { useCallback, useEffect, useRef, useState } from 'react'

const FETCH_TIMEOUT_MS = 30_000

// Drainer caractère-par-caractère, calibré pour être fluide sans être lent.
// Le rythme s'auto-ajuste : plus la queue est grosse, plus on draine vite.
const DRAIN_BASE_CHARS_PER_SEC = 90   // vitesse "naturelle" si queue petite (~Claude.ai)
const DRAIN_MAX_CHARS_PER_SEC = 400   // vitesse max si l'API streame vite (catch-up)
const QUEUE_TARGET_DELAY_MS = 600     // on cherche à garder ~600ms de retard sur l'API

export type SendOptions = {
  url: string
  body: unknown
  headers?: Record<string, string>
  onStart?: () => void
  /** delta = nouveau fragment, total = texte complet reçu de l'API */
  onChunk?: (delta: string, total: string) => void
  onDone?: (fullContent: string, sessionId: string | null) => void
  /**
   * code = valeur du champ `code` dans la réponse JSON backend
   * (ex: 'QUOTA_EXCEEDED') — conservé pour la compatibilité avec chat-content.tsx
   */
  onError?: (message: string, code?: string) => void
}

export type UseStreamingMessageReturn = {
  isStreaming: boolean
  /** Texte affiché en temps réel dans le bubble assistant */
  streamingContent: string
  send: (opts: SendOptions) => Promise<void>
  abort: () => void
  /** Efface streamingContent et aborte si un stream est en cours */
  reset: () => void
}

/**
 * Hook partagé pour consommer un stream SSE depuis le backend.
 *
 * Format SSE attendu :
 *   data: {"chunk": "Hello"}
 *   data: {"done": true, "session_id": "..."}
 *   data: {"error": "Quota exceeded", "code": "QUOTA_EXCEEDED"}
 *
 * Garanties :
 * - Drain caractère-par-caractère adaptatif via rAF (fluide, pas typewriter)
 * - AbortController automatique au démontage
 * - decoder.decode() final pour les multi-bytes (emojis, accents)
 * - Timeout 30 s sur le fetch initial
 * - onDone appelé APRÈS que la queue soit vidée (pas de glitch visuel)
 */
export function useStreamingMessage(): UseStreamingMessageReturn {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')

  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  // Queue de caractères à drainer + état du drainer
  const charQueueRef = useRef<string[]>([])
  // Texte effectivement affiché (reflété dans streamingContent)
  const displayedRef = useRef<string>('')
  // Texte total reçu de l'API (source de vérité pour onDone)
  const totalReceivedRef = useRef<string>('')
  // Quand true, le drainer finit la queue à vitesse max puis s'arrête
  const streamFinishedRef = useRef<boolean>(false)
  // Timestamps pour l'heuristique adaptative
  const lastFrameRef = useRef<number>(0)
  const lastChunkArrivedAtRef = useRef<number>(0)
  // Carry pour drainer un nombre fractionnaire de chars par frame
  const drainCarryRef = useRef<number>(0)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [])

  // ── Vitesse de drain adaptative ──────────────────────────────────────────
  const computeCharsPerSec = useCallback(
    (queueSize: number, msSinceLastChunk: number): number => {
      if (queueSize === 0) return DRAIN_BASE_CHARS_PER_SEC
      if (streamFinishedRef.current) return DRAIN_MAX_CHARS_PER_SEC
      // Pause côté serveur probable → on reste au rythme de base
      if (msSinceLastChunk > 1500) return DRAIN_BASE_CHARS_PER_SEC
      // Si la queue est plus grande que le buffer cible, on accélère
      const targetSize = (DRAIN_BASE_CHARS_PER_SEC * QUEUE_TARGET_DELAY_MS) / 1000
      if (queueSize <= targetSize) return DRAIN_BASE_CHARS_PER_SEC
      const ratio = queueSize / targetSize
      return Math.min(DRAIN_BASE_CHARS_PER_SEC * Math.min(ratio, 4.5), DRAIN_MAX_CHARS_PER_SEC)
    },
    []
  )

  // ── Tick rAF ─────────────────────────────────────────────────────────────
  const tickDrain = useCallback(
    (now: number) => {
      rafIdRef.current = null
      if (!mountedRef.current) return

      const queue = charQueueRef.current

      if (streamFinishedRef.current && queue.length === 0) return

      const dt =
        lastFrameRef.current === 0 ? 16 : Math.min(now - lastFrameRef.current, 80)
      lastFrameRef.current = now

      const msSinceLastChunk =
        lastChunkArrivedAtRef.current === 0
          ? 0
          : now - lastChunkArrivedAtRef.current

      const charsPerSec = computeCharsPerSec(queue.length, msSinceLastChunk)
      drainCarryRef.current += (dt / 1000) * charsPerSec

      let drained = 0
      const drainCount = Math.floor(drainCarryRef.current)
      if (drainCount > 0 && queue.length > 0) {
        const take = Math.min(drainCount, queue.length)
        displayedRef.current += queue.splice(0, take).join('')
        drained = take
        drainCarryRef.current -= take
      }

      if (queue.length === 0) drainCarryRef.current = 0

      if (drained > 0) setStreamingContent(displayedRef.current)

      if (!streamFinishedRef.current || queue.length > 0) {
        rafIdRef.current = requestAnimationFrame(tickDrain)
      }
    },
    [computeCharsPerSec]
  )

  const ensureDrainerRunning = useCallback(() => {
    if (rafIdRef.current != null) return
    lastFrameRef.current = 0
    rafIdRef.current = requestAnimationFrame(tickDrain)
  }, [tickDrain])

  const stopDrainer = useCallback(() => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
  }, [])

  const resetInternalState = useCallback(() => {
    charQueueRef.current = []
    displayedRef.current = ''
    totalReceivedRef.current = ''
    streamFinishedRef.current = false
    lastFrameRef.current = 0
    lastChunkArrivedAtRef.current = 0
    drainCarryRef.current = 0
    stopDrainer()
  }, [stopDrainer])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    resetInternalState()
    if (mountedRef.current) {
      setStreamingContent('')
      setIsStreaming(false)
    }
  }, [resetInternalState])

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    resetInternalState()
    if (mountedRef.current) {
      setStreamingContent('')
      setIsStreaming(false)
    }
  }, [resetInternalState])

  // ── send ──────────────────────────────────────────────────────────────────
  const send = useCallback(
    async (opts: SendOptions): Promise<void> => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      resetInternalState()

      if (mountedRef.current) {
        setStreamingContent('')
        setIsStreaming(true)
      }
      opts.onStart?.()

      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

      let receivedSessionId: string | null = null
      let sawError = false

      const handleSseLine = (line: string) => {
        if (!line.startsWith('data: ')) return
        let data: unknown
        try {
          data = JSON.parse(line.slice(6))
        } catch {
          return
        }
        if (!data || typeof data !== 'object') return
        const obj = data as Record<string, unknown>

        if (typeof obj.chunk === 'string') {
          const delta = obj.chunk
          totalReceivedRef.current += delta
          // Array.from() découpe correctement les graphèmes multi-byte (emojis, accents)
          for (const ch of Array.from(delta)) {
            charQueueRef.current.push(ch)
          }
          lastChunkArrivedAtRef.current = performance.now()
          ensureDrainerRunning()
          opts.onChunk?.(delta, totalReceivedRef.current)
        } else if (obj.done === true) {
          receivedSessionId =
            typeof obj.session_id === 'string' ? obj.session_id : null
          // Stream fini → le drainer va terminer la queue à vitesse max
          streamFinishedRef.current = true
          ensureDrainerRunning()
        } else if (typeof obj.error === 'string') {
          sawError = true
          const code = typeof obj.code === 'string' ? obj.code : undefined
          opts.onError?.(obj.error, code)
        }
      }

      try {
        const res = await fetch(opts.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...opts.headers },
          credentials: 'same-origin',
          body: JSON.stringify(opts.body),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as Record<string, unknown>
          const msg = typeof err.error === 'string' ? err.error : 'Request failed'
          const code = typeof err.code === 'string' ? err.code : undefined
          sawError = true
          opts.onError?.(msg, code)
          return
        }

        if (!res.body) {
          sawError = true
          opts.onError?.('Empty response')
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            buffer += decoder.decode() // flush UTF-8 interne du decoder
            break
          }
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) handleSseLine(line)
        }

        if (buffer.startsWith('data: ')) handleSseLine(buffer)

        // Si done=true n'est jamais arrivé (truncation réseau), forcer la fin
        if (!streamFinishedRef.current) {
          streamFinishedRef.current = true
          ensureDrainerRunning()
        }

        // Attendre que la queue soit entièrement drainée avant d'appeler onDone.
        // Cela évite le glitch où le composant parent remplace le bubble streaming
        // par le message persisté avant que le dernier char soit affiché.
        await new Promise<void>((resolve) => {
          const waitDrained = () => {
            if (!mountedRef.current || charQueueRef.current.length === 0) {
              resolve()
              return
            }
            requestAnimationFrame(waitDrained)
          }
          waitDrained()
        })

        if (!sawError) {
          opts.onDone?.(totalReceivedRef.current, receivedSessionId)
        }
      } catch (err) {
        clearTimeout(timeoutId)
        const e = err as { name?: string; message?: string }
        if (e?.name === 'AbortError') return
        const msg = e?.message?.includes('timeout')
          ? 'Request timed out. Try again.'
          : 'Network error. Try again.'
        opts.onError?.(msg)
      } finally {
        clearTimeout(timeoutId)
        if (abortRef.current === controller) abortRef.current = null
        if (mountedRef.current) setIsStreaming(false)
        // NE PAS reset displayedRef ici : le composant parent s'en sert
        // dans onDone pour persister le message. Le reset arrive au prochain
        // send() ou au démontage via resetInternalState().
      }
    },
    [ensureDrainerRunning, resetInternalState]
  )

  return { isStreaming, streamingContent, send, abort, reset }
}
