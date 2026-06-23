import { useState, useEffect } from 'react'
import { Bell, Search, Sun, Moon, Globe } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'
import { useLanguage } from '../../context/LanguageContext'

interface HeaderProps {
  title?: string
}

export function Header({ title }: HeaderProps) {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)
  const location = useLocation()
  const [theme, setTheme] = useState(() => localStorage.getItem('zenith_theme') || 'light')
  const { language, setLanguage, t } = useLanguage()

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
      localStorage.setItem('zenith_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('zenith_theme', 'light')
    }
  }, [theme])

  useEffect(() => {
    if (!user) return
    api.get('/notifications')
      .then(res => {
        const list = res.data || []
        setUnread(list.filter((n: any) => !n.read).length)
      })
      .catch(err => console.error(err))
  }, [user])

  const showSearch = location.pathname === '/dashboard'

  const getTranslatedTitle = (tTitle?: string) => {
    if (!tTitle) return ''
    const keyMap: Record<string, string> = {
      'Dashboard': 'dashboard',
      'Clients': 'clients',
      'Projects': 'projects',
      'Tasks': 'tasks',
      'Files': 'files',
      'Approvals': 'approvals',
      'Invoices': 'invoices',
      'Payments': 'payments',
      'Reports': 'reports',
      'Activity Log': 'recentActivity',
      'Proposals': 'proposals',
      'Contracts': 'contracts',
      'Settings': 'settings',
      'Notifications': 'notifications',
    }
    const key = keyMap[tTitle]
    return key ? t(key) : tTitle
  }

  return (
    <header className="h-16 bg-white border-b border-slate-100 dark:bg-slate-900 dark:border-slate-800 flex items-center px-6 gap-4 sticky top-0 z-30">
      {title && (
        <h1 className="text-lg font-semibold text-navy-900 dark:text-white hidden md:block">
          {getTranslatedTitle(title)}
        </h1>
      )}

      {/* Spacer to push search and actions to the right */}
      <div className="flex-1" />

      {showSearch && (
        <div className="w-full max-w-xs" role="search">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="global-search-input"
              type="search"
              aria-label="Search clients and projects"
              placeholder="Search clients, projects..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-transparent text-sm placeholder:text-slate-400 outline-none focus:bg-white focus:border-slate-200 transition-all dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
            />
          </div>
        </div>
      )}

      {/* Language Selector */}
      <div className="flex items-center gap-1.5">
        <Globe size={15} className="text-slate-400 dark:text-slate-500 hidden sm:block" />
        <select
          value={language}
          onChange={e => setLanguage(e.target.value as any)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-1.5 outline-none hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-750 transition-all cursor-pointer"
        >
          <option value="en">English (EN)</option>
          <option value="hi">हिंदी (HI)</option>
          <option value="es">Español (ES)</option>
          <option value="fr">Français (FR)</option>
        </select>
      </div>

      <Link to="/notifications" className="relative btn-ghost p-2 text-slate-500 dark:text-slate-400 dark:hover:text-white">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
        )}
      </Link>

      <button
        onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
        className="btn-ghost p-2 text-slate-500 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white rounded-xl transition-all duration-150 cursor-pointer"
        aria-label="Toggle dark mode"
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    </header>
  )
}
