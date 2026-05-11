'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'sumear-theme'
/** Ancienne clé localStorage (rebrand) — migrée une fois vers sumear-theme */
const LEGACY_THEME_KEY = 'briefai-theme'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
} | null>(null)

/**
 * Did the user pick a theme explicitly (stored in localStorage)? If not,
 * we follow the OS/Chrome `prefers-color-scheme` setting automatically.
 */
const hasStoredTheme = (): boolean => {
  if (typeof window === 'undefined') return false
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark'
}

const systemTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)
  const userPickedRef = useRef<boolean>(false)

  useEffect(() => {
    setMounted(true)
    let stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (!stored) {
      const legacy = localStorage.getItem(LEGACY_THEME_KEY) as Theme | null
      if (legacy === 'light' || legacy === 'dark') {
        stored = legacy
        localStorage.setItem(STORAGE_KEY, legacy)
        localStorage.removeItem(LEGACY_THEME_KEY)
      }
    }
    if (stored === 'light' || stored === 'dark') {
      userPickedRef.current = true
      setThemeState(stored)
    } else {
      userPickedRef.current = false
      setThemeState(systemTheme())
    }

    // 1. Follow Chrome/OS theme changes when the user hasn't picked one.
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = (e: MediaQueryListEvent) => {
      if (userPickedRef.current) return
      setThemeState(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener?.('change', onSystemChange)

    // 2. Sync across tabs / iframes (e.g. dashboard toggles → embed chat).
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      if (e.newValue === 'light' || e.newValue === 'dark') {
        userPickedRef.current = true
        setThemeState(e.newValue)
      } else {
        userPickedRef.current = false
        setThemeState(systemTheme())
      }
    }
    window.addEventListener('storage', onStorage)

    return () => {
      mq.removeEventListener?.('change', onSystemChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    // Only persist if the user explicitly chose (via setTheme).
    if (userPickedRef.current) localStorage.setItem(STORAGE_KEY, theme)
  }, [theme, mounted])

  const setTheme = (t: Theme) => {
    userPickedRef.current = true
    setThemeState(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) return { theme: 'dark' as Theme, setTheme: () => {} }
  return ctx
}
