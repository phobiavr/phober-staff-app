import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { generateTvToken } from '../api/tvClient'

const NAV = [
  { to: '/',          label: 'Устройства', icon: '🎮' },
  { to: '/sessions',  label: 'Сеансы',     icon: '📋' },
  { to: '/bar',       label: 'Бар',        icon: '🍿' },
  { to: '/customers', label: 'Клиенты',    icon: '👥' },
  { to: '/invoices',  label: 'Счета',      icon: '🧾' },
  { to: '/tariffs',   label: 'Тарифы',     icon: '💰' },
]

export default function Layout() {
  const { logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [tvCopied, setTvCopied] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return
      }
    } catch (e) {
      console.warn('clipboard api failed, falling back', e)
    }
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }

  const handleTvLink = async () => {
    try {
      const { params } = await generateTvToken()
      const tvLink = `${window.location.origin}/tv${params}`
      await copyToClipboard(tvLink)
      setTvCopied(true)
      setTimeout(() => setTvCopied(false), 2500)
    } catch (e) {
      console.error('tv link generation failed', e)
    }
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
    }`

  const bottomLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 flex-1 py-2 text-xs font-medium transition-colors ${
      isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
    }`

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-20">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎮</span>
            <span className="font-bold text-gray-900 dark:text-gray-100">Phober Staff</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-base"
              title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              onClick={handleTvLink}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
              title="Скопировать TV-ссылку"
            >
              <span>📺</span>
              {tvCopied && <span className="text-xs text-green-600 dark:text-green-400 font-medium">скопировано!</span>}
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Выход
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex flex-col w-48 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 p-3 gap-1">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex">
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={bottomLinkClass}>
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
