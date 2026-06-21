import { useState, useEffect } from 'react'
import { Bell, Search } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'

interface HeaderProps {
  title?: string
}

export function Header({ title }: HeaderProps) {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)
  const location = useLocation()

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

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center px-6 gap-4 sticky top-0 z-30">
      {title && (
        <h1 className="text-lg font-semibold text-navy-900 hidden md:block">{title}</h1>
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
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-transparent text-sm placeholder:text-slate-400 outline-none focus:bg-white focus:border-slate-200 transition-all"
            />
          </div>
        </div>
      )}

      <Link to="/notifications" className="relative btn-ghost p-2 text-slate-500">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
        )}
      </Link>
    </header>
  )
}
