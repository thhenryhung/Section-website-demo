/**
 * Light/dark theme: a manual toggle (src/components/ThemeToggle.tsx), not the
 * OS preference. Framework-free like the rest of src/lib/.
 *
 * Light is the default for every first-time visitor, even on a device set to
 * dark mode — a deliberate product choice, not an oversight: the site is
 * designed to read like a printed section facebook (see index.css), and that
 * only holds together in daylight colors. Once someone picks dark explicitly,
 * their choice is remembered and respected on every later visit.
 */

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'section-j.theme'

function getStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    // Private browsing / blocked storage: fall through to the default.
    return null
  }
}

const THEME_COLOR: Record<Theme, string> = {
  light: '#f0f7f3', // --color-green-50
  dark: '#0d0c08', // --color-ink-950
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.getElementById('theme-color-meta')?.setAttribute('content', THEME_COLOR[theme])
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Best-effort persistence — the theme still applies for this page view.
  }
  applyTheme(theme)
}

/** Call once, as early as possible, to avoid a flash of the wrong theme. */
export function initTheme(): Theme {
  const theme = getStoredTheme() ?? 'light'
  applyTheme(theme)
  return theme
}

export function getCurrentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}
