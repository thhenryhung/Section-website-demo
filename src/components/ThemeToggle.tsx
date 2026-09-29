import { useState } from 'react'
import { getCurrentTheme, setTheme, type Theme } from '../lib/theme'

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function SunIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2.5 12H5M19 12h2.5M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </svg>
  )
}

/**
 * Reads the class React never rendered (main.tsx's initTheme() runs before
 * React even mounts, to avoid a flash) — this is the one place in the app
 * that's allowed to read DOM state directly into initial React state.
 *
 * Styled with dark: pairs throughout, same as everything else — every
 * surface it sits on (the header, the unlock screen's hero) is itself
 * theme-aware now, so there's no separate "fixed dark background" case left.
 */
export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => getCurrentTheme())

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex size-7 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-900/5 hover:text-ink-800 dark:text-ink-300 dark:hover:bg-white/10 dark:hover:text-ink-50"
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
