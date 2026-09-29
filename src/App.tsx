import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSectionData } from './gate/SectionData'
import { UnlockScreen } from './gate/UnlockScreen'
import { WelcomePage } from './pages/WelcomePage'
import { CalendarPage } from './pages/CalendarPage'
import { SocialPage } from './pages/SocialPage'
import { AdminPage } from './pages/AdminPage'
import { InstallPage } from './pages/InstallPage'
import { ThemeToggle } from './components/ThemeToggle'
import { siteConfig } from './lib/siteConfig'

const TABS = siteConfig.tabs

export function App() {
  const { status, lock, isSampleBuild } = useSectionData()
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  if (status !== 'unlocked') return <UnlockScreen />

  return (
    <div className="min-h-dvh">
      {isSampleBuild && (
        <p className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">
          Sample build — every person shown here is invented. No real section data is loaded.
        </p>
      )}

      <header className="sticky top-0 z-20 border-b border-ink-200 bg-green-50/85 backdrop-blur dark:border-ink-800 dark:bg-ink-950/85">
        <div className="h-[3px] bg-gradient-to-r from-green-600 via-green-400 to-green-600" />
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <NavLink to="/" className="font-serif text-xl text-green-700 dark:text-green-400">
            {siteConfig.orgName}
          </NavLink>

          <nav className="flex flex-1 gap-1 overflow-x-auto" aria-label="Sections">
            {!isHome &&
              TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
                      isActive
                        ? 'bg-green-600 text-white'
                        : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
          </nav>

          <NavLink
            to="/admin"
            className="whitespace-nowrap text-xs text-ink-400 underline underline-offset-2 hover:text-green-700 dark:hover:text-green-400"
          >
            Admin
          </NavLink>

          <button
            onClick={lock}
            className="whitespace-nowrap text-xs text-ink-400 underline underline-offset-2 hover:text-green-700 dark:hover:text-green-400"
          >
            Logout
          </button>

          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/social" element={<SocialPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/install" element={<InstallPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
