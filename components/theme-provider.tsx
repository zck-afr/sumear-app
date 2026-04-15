'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'sumear-theme'
/** Ancienne clé localStorage (rebrand) — migrée une fois vers sumear-theme */
const LEGACY_THEME_KEY = 'briefai-theme'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
} | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

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
    if (stored === 'light' || stored === 'dark') setThemeState(stored)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme, mounted])

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) return { theme: 'dark' as Theme, setTheme: () => {} }
  return ctx
}
