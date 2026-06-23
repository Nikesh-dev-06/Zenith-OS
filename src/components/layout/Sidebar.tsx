import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, FolderOpen, CheckSquare, FileText,
  ShieldCheck, Receipt, CreditCard, Bell, BarChart3, ClipboardList,
  Settings, LogOut, Menu, X, ChevronRight, PenTool
} from 'lucide-react'
import { Logo } from '../ui/Logo'
import { Avatar } from '../ui/index'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'
import { useEffect } from 'react'
import { useLanguage } from '../../context/LanguageContext'

const agencyNav = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Clients', icon: Users, to: '/clients' },
  { label: 'Projects', icon: FolderOpen, to: '/projects' },
  { label: 'Tasks', icon: CheckSquare, to: '/tasks' },
  { label: 'Files', icon: FileText, to: '/files' },
  { label: 'Approvals', icon: ShieldCheck, to: '/approvals' },
  { label: 'Proposals', icon: FileText, to: '/proposals' },
  { label: 'Contracts', icon: PenTool, to: '/contracts' },
  { label: 'Invoices', icon: Receipt, to: '/invoices' },
  { label: 'Payments', icon: CreditCard, to: '/payments' },
  { label: 'Reports', icon: BarChart3, to: '/reports' },
  { label: 'Activity Log', icon: ClipboardList, to: '/activity' },
]

const clientNav = [
  { label: 'My Portal', icon: LayoutDashboard, to: '/portal' },
  { label: 'My Projects', icon: FolderOpen, to: '/portal/projects' },
  { label: 'My Files', icon: FileText, to: '/portal/files' },
  { label: 'Approvals', icon: ShieldCheck, to: '/portal/approvals' },
  { label: 'Proposals', icon: FileText, to: '/portal/proposals' },
  { label: 'Contracts', icon: PenTool, to: '/portal/contracts' },
  { label: 'Invoices', icon: Receipt, to: '/portal/invoices' },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const { t } = useLanguage()

  const [brandName, setBrandName] = useState('ZenithOS')
  const [brandLogo, setBrandLogo] = useState('/favicon.png')

  useEffect(() => {
    const savedName = localStorage.getItem('zenithos_brand_name')
    const savedLogo = localStorage.getItem('zenithos_brand_logo')
    if (savedName) setBrandName(savedName)
    if (savedLogo) setBrandLogo(savedLogo)
  }, [])

  useEffect(() => {
    if (!user) return
    api.get('/notifications')
      .then(res => {
        const list = res.data || []
        setUnread(list.filter((n: any) => !n.read).length)
      })
      .catch(err => console.error(err))
  }, [user])

  const isClientRole = ['client', 'client_viewer'].includes(user?.role || '')
  const nav = isClientRole ? clientNav : agencyNav

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getNavLabel = (label: string) => {
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
      'My Portal': 'dashboard',
      'My Projects': 'projects',
      'My Files': 'files',
    }
    const key = keyMap[label]
    return key ? t(key) : label
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 btn-secondary p-2"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-0 h-full bg-white border-r border-slate-100 z-40
        flex flex-col transition-all duration-300 shadow-sm
        ${collapsed ? 'w-16' : 'w-60'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header */}
        <div className={`flex items-center border-b border-slate-100 ${collapsed ? 'px-3 py-4 justify-center' : 'px-5 py-4 justify-between'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={brandLogo}
              alt="Logo"
              className="h-8 w-auto object-contain flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/favicon.png'
              }}
            />
            {!collapsed && (
              <span className="font-extrabold text-navy-900 text-sm truncate uppercase tracking-wider">
                {brandName}
              </span>
            )}
          </div>
          <button
            className="hidden lg:flex btn-ghost p-1.5 text-slate-400"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronRight size={14} className={`transition-transform ${collapsed ? 'rotate-0' : 'rotate-180'}`} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-4 overflow-y-auto space-y-0.5">
          {!collapsed && (
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
              {isClientRole ? 'My Space' : 'Operations'}
            </p>
          )}
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer
                ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'text-orange-600 font-semibold'
                  : 'text-slate-600 hover:bg-orange-50 hover:text-orange-600'
                }`
              }
              style={({ isActive }) => isActive ? { background: 'rgba(244,81,30,0.08)' } : undefined}
              onClick={() => setMobileOpen(false)}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={17} className={isActive ? 'text-orange-600' : 'text-slate-500'} />
                  {!collapsed && <span>{getNavLabel(item.label)}</span>}
                  {!collapsed && item.label === 'Approvals' && unread > 0 && (
                    <span className="ml-auto w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
                      style={{ background: 'linear-gradient(135deg,#F4511E,#FF8C42)' }}>
                      {unread}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}

          {!collapsed && !isClientRole && (
            <>
              <div className="border-t border-slate-100 my-3" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">System</p>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                  ${isActive ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-slate-600 hover:bg-orange-50 hover:text-orange-600'}`
                }
              >
                <Settings size={17} className="text-slate-500" />
                <span>{t('settings')}</span>
              </NavLink>
              <NavLink
                to="/notifications"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                  ${isActive ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-slate-600 hover:bg-orange-50 hover:text-orange-600'}`
                }
              >
                <Bell size={17} className="text-slate-500" />
                <span>{t('notifications')}</span>
                {unread > 0 && (
                  <span className="ml-auto w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
                    style={{ background: 'linear-gradient(135deg,#F4511E,#FF8C42)' }}>
                    {unread}
                  </span>
                )}
              </NavLink>
            </>
          )}
        </nav>

        {/* User footer */}
        <div className={`border-t border-slate-100 p-3 ${collapsed ? 'flex justify-center' : ''}`}>
          {collapsed ? (
            <button onClick={handleLogout} className="btn-ghost p-1.5 text-slate-500">
              <LogOut size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <Avatar name={user?.name || 'User'} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy-900 truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
              <button onClick={handleLogout} className="btn-ghost p-1.5 text-slate-400 hover:text-rose-500">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
