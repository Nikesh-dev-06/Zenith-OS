import { useState, useEffect } from 'react'
import {
  Users, FolderOpen, IndianRupee, Clock, CheckCircle,
  ArrowLeft, ArrowRight, Eye, EyeOff, Save, RotateCcw, X, Edit3
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Layout } from '../components/layout/Layout'
import { StatCard, Avatar, ProjectStatusBadge, InvoiceStatusBadge, Skeleton } from '../components/ui/index'
import { Progress } from '../components/ui/index'
import { formatCurrency, formatRelativeTime } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import api from '../lib/api'

const pieData = [
  { name: 'Active', value: 4, color: '#06B6D4' },
  { name: 'Review', value: 1, color: '#F59E0B' },
  { name: 'Completed', value: 1, color: '#10B981' },
]

interface WidgetConfig {
  id: string
  name: string
  span: string
  visible: boolean
}

interface StatCardConfig {
  id: string
  label: string
  visible: boolean
}

interface DashboardConfig {
  widgets: WidgetConfig[]
  stats: StatCardConfig[]
}

const DEFAULT_CONFIG: DashboardConfig = {
  widgets: [
    { id: 'stats', name: 'Stat Cards Grid', span: 'lg:col-span-3', visible: true },
    { id: 'revenue', name: 'Revenue Overview', span: 'lg:col-span-2', visible: true },
    { id: 'project_status', name: 'Project Status', span: 'lg:col-span-1', visible: true },
    { id: 'active_projects', name: 'Active Projects', span: 'lg:col-span-2', visible: true },
    { id: 'recent_activity', name: 'Recent Activity', span: 'lg:col-span-1', visible: true },
    { id: 'overdue_invoices', name: 'Overdue Invoices Alert', span: 'lg:col-span-3', visible: true },
  ],
  stats: [
    { id: 'clients', label: 'Total Clients', visible: true },
    { id: 'projects', label: 'Active Projects', visible: true },
    { id: 'revenue', label: 'Monthly Revenue', visible: true },
    { id: 'outstanding', label: 'Outstanding', visible: true },
    { id: 'pending', label: 'Pending Approvals', visible: true },
  ]
}

const getStatsGridClass = (count: number) => {
  if (count === 5) return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4'
  if (count === 4) return 'grid grid-cols-2 md:grid-cols-4 gap-4'
  if (count === 3) return 'grid grid-cols-2 md:grid-cols-3 gap-4'
  if (count === 2) return 'grid grid-cols-2 gap-4'
  return 'grid grid-cols-1 gap-4'
}

// ── Widget Wrapper component with edit toolbar ─────────────────────
function WidgetEditorWrapper({
  name,
  span,
  visible,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
  onChangeSpan,
  children
}: {
  id: string
  name: string
  span: string
  visible: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onToggleVisible: () => void
  onChangeSpan: (span: string) => void
  children: React.ReactNode
}) {
  return (
    <div className={`relative group border-2 rounded-2xl transition-all duration-200 p-1.5 ${span} ${
      visible 
        ? 'border-orange-100 hover:border-orange-400 bg-white/70 shadow-sm' 
        : 'border-dashed border-slate-300 bg-slate-50/50 opacity-60'
    }`}>
      {/* Edit Controls Toolbar */}
      <div className="absolute -top-3.5 right-4 z-20 flex items-center gap-1 bg-slate-900 text-white px-2 py-1 rounded-lg shadow-md border border-slate-800 opacity-90 group-hover:opacity-100 transition-opacity duration-150 text-[11px] font-medium">
        <span className="text-slate-300 px-1 border-r border-slate-700">{name}</span>
        
        {/* Reordering */}
        <button
          type="button"
          onClick={onMoveUp}
          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
          title="Move Backwards"
        >
          <ArrowLeft size={12} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
          title="Move Forwards"
        >
          <ArrowRight size={12} />
        </button>
 
        <div className="w-px h-3 bg-slate-700 mx-0.5" />
 
        {/* Width Selectors */}
        <button
          type="button"
          onClick={() => onChangeSpan('lg:col-span-1')}
          className={`px-1 rounded text-[9px] uppercase ${span === 'lg:col-span-1' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          title="1/3 Width"
        >
          1/3
        </button>
        <button
          type="button"
          onClick={() => onChangeSpan('lg:col-span-2')}
          className={`px-1 rounded text-[9px] uppercase ${span === 'lg:col-span-2' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          title="2/3 Width"
        >
          2/3
        </button>
        <button
          type="button"
          onClick={() => onChangeSpan('lg:col-span-3')}
          className={`px-1 rounded text-[9px] uppercase ${span === 'lg:col-span-3' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          title="Full Width"
        >
          Full
        </button>
 
        <div className="w-px h-3 bg-slate-700 mx-0.5" />
 
        {/* Show / Hide */}
        <button
          type="button"
          onClick={onToggleVisible}
          className={`p-1 rounded ${visible ? 'text-slate-400 hover:text-white' : 'text-red-400 bg-red-950/20'}`}
          title={visible ? 'Hide Widget' : 'Show Widget'}
        >
          {visible ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
      </div>
 
      {!visible && (
        <div className="absolute inset-0 z-10 bg-slate-50/80 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center p-6 text-center select-none">
          <EyeOff className="text-slate-400 mb-1" size={20} />
          <p className="text-xs font-semibold text-slate-700">{name} Hidden</p>
          <button
            type="button"
            onClick={onToggleVisible}
            className="mt-2 text-xs text-orange-600 hover:text-orange-700 font-bold hover:underline"
          >
            Show widget
          </button>
        </div>
      )}
 
      <div className={!visible ? 'pointer-events-none' : ''}>
        {children}
      </div>
    </div>
  )
}
 
// ── Stat Card Wrapper component with edit toolbar ───────────────────
function StatCardEditorWrapper({
  label,
  visible,
  onMoveLeft,
  onMoveRight,
  onToggleVisible,
  children
}: {
  id: string
  label: string
  visible: boolean
  onMoveLeft: () => void
  onMoveRight: () => void
  onToggleVisible: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`relative group/stat border rounded-2xl transition-all duration-200 ${
      visible 
        ? 'border-orange-50 hover:border-orange-300' 
        : 'border-dashed border-slate-300 bg-slate-50/50 opacity-60'
    }`}>
      {/* Mini Controls Toolbar */}
      <div className="absolute -top-2 right-2 z-20 flex items-center gap-0.5 bg-slate-900 text-white px-1.5 py-0.5 rounded shadow opacity-90 group-hover/stat:opacity-100 transition-opacity duration-150 text-[10px]">
        <button
          type="button"
          onClick={onMoveLeft}
          className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
          title="Move Left"
        >
          <ArrowLeft size={10} />
        </button>
        <button
          type="button"
          onClick={onMoveRight}
          className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
          title="Move Right"
        >
          <ArrowRight size={10} />
        </button>
        <div className="w-px h-2.5 bg-slate-700 mx-0.5" />
        <button
          type="button"
          onClick={onToggleVisible}
          className={`p-0.5 rounded ${visible ? 'text-slate-400 hover:text-white' : 'text-red-400'}`}
          title={visible ? 'Hide' : 'Show'}
        >
          {visible ? <Eye size={10} /> : <EyeOff size={10} />}
        </button>
      </div>
 
      {!visible && (
        <div className="absolute inset-0 z-10 bg-slate-50/90 rounded-2xl flex flex-col items-center justify-center p-3 text-center pointer-events-auto">
          <p className="text-[10px] font-bold text-slate-600 line-clamp-1">{label}</p>
          <button
            type="button"
            onClick={onToggleVisible}
            className="mt-1 text-[10px] text-orange-600 hover:text-orange-700 font-bold underline"
          >
            Show card
          </button>
        </div>
      )}
 
      <div className={!visible ? 'pointer-events-none opacity-40' : ''}>
        {children}
      </div>
    </div>
  )
}
 
export default function DashboardPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState<number>(6)
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    return localStorage.getItem('zenith_onboarding_completed') !== 'true'
  })

  useEffect(() => {
    setLoading(true)
    api.get(`/dashboard?months=${months}`)
      .then(res => {
        setData(res.data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [months])
 
  const stats = data || {
    totalClients: 0,
    activeProjects: 0,
    monthlyRevenue: 0,
    outstandingPayments: 0,
    pendingApprovals: 0,
    clientGrowth: 0,
    projectGrowth: 0,
    revenueGrowth: 0,
  }
  const revenueData = data?.revenueData || []
  const currentPieData = data?.projectStatusBreakdown || pieData
  const activeProjectsList = data?.activeProjectsList || []
  const recentActivity = data?.recentActivity || []
  const overdueInvoices = data?.overdueInvoices || []
 
  const isAdmin = user?.role === 'super_admin'
 
  const [isEditing, setIsEditing] = useState(false)
  const [config, setConfig] = useState<DashboardConfig>(() => {
    const stored = localStorage.getItem('zenith_dashboard_layout')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('Failed to parse dashboard layout config', e)
      }
    }
    return DEFAULT_CONFIG
  })
  const [savedConfig, setSavedConfig] = useState<DashboardConfig>(config)
 
  const handleSave = () => {
    localStorage.setItem('zenith_dashboard_layout', JSON.stringify(config))
    setSavedConfig(config)
    setIsEditing(false)
  }
 
  const handleCancel = () => {
    setConfig(savedConfig)
    setIsEditing(false)
  }
 
  const handleReset = () => {
    setConfig(DEFAULT_CONFIG)
  }
 
  const moveWidget = (index: number, direction: number) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= config.widgets.length) return
    const newWidgets = [...config.widgets]
    const temp = newWidgets[index]
    newWidgets[index] = newWidgets[newIndex]
    newWidgets[newIndex] = temp
    setConfig(prev => ({ ...prev, widgets: newWidgets }))
  }
 
  const toggleWidgetVisible = (id: string) => {
    setConfig(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w)
    }))
  }
 
  const changeWidgetSpan = (id: string, span: string) => {
    setConfig(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => w.id === id ? { ...w, span } : w)
    }))
  }
 
  const moveStat = (index: number, direction: number) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= config.stats.length) return
    const newStats = [...config.stats]
    const temp = newStats[index]
    newStats[index] = newStats[newIndex]
    newStats[newIndex] = temp
    setConfig(prev => ({ ...prev, stats: newStats }))
  }
 
  const toggleStatVisible = (id: string) => {
    setConfig(prev => ({
      ...prev,
      stats: prev.stats.map(s => s.id === id ? { ...s, visible: !s.visible } : s)
    }))
  }
 
  if (loading && !isEditing) {
    return (
      <Layout title="Dashboard">
        <div className="page-header">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2"><Skeleton className="h-[290px] w-full" /></div>
          <div><Skeleton className="h-[290px] w-full" /></div>
          <div className="lg:col-span-2"><Skeleton className="h-[290px] w-full" /></div>
          <div><Skeleton className="h-[290px] w-full" /></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Dashboard">
      {/* Welcome & Action Controls */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Good morning, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Here's what's happening at Zenith Creative today.</p>
        </div>
        
        {/* Only show Edit Dashboard button to administrator */}
        {isAdmin && !isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="btn-secondary self-start sm:self-auto"
          >
            <span>✏️</span> Edit Dashboard
          </button>
        )}
      </div>

      {/* Onboarding Checklist Widget */}
      {showOnboarding && (
        <div className="card p-6 mb-6 bg-slate-900 text-white relative overflow-hidden border-0">
          <div className="absolute right-0 top-0 w-64 h-64 rounded-full bg-orange-600/10 blur-3xl pointer-events-none" />
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                🚀 Welcome to ZenithOS!
              </h2>
              <p className="text-xs text-slate-400 mt-1">Get started by completing these quick steps to explore the platform.</p>
            </div>
            <button
              onClick={() => {
                localStorage.setItem('zenith_onboarding_completed', 'true');
                setShowOnboarding(false);
              }}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Add a Client', desc: 'Create your first CRM client entry.', link: '/clients' },
              { title: 'Define a Project', desc: 'Assign work, team, and budget.', link: '/projects' },
              { title: 'Issue an Invoice', desc: 'Bill client and set due dates.', link: '/invoices' },
              { title: 'Check Client Portal', desc: 'Login as client@novatech.com.', link: '/portal' },
            ].map((step, idx) => (
              <a
                key={idx}
                href={step.link}
                className="block p-3.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors border border-slate-700/50 hover:border-slate-600"
              >
                <p className="text-xs font-bold text-orange-500 mb-0.5">Step {idx + 1}</p>
                <p className="text-xs font-semibold text-white">{step.title}</p>
                <p className="text-[10px] text-slate-400 mt-1">{step.desc}</p>
              </a>
            ))}
          </div>
        </div>
      )}
 
      {/* Edit Mode Customizer Panel */}
      {isEditing && (
        <div className="mb-6 p-4 bg-orange-50/80 border border-orange-100 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-slide-up">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔧</span>
            <div>
              <p className="text-sm font-semibold text-slate-800">Dashboard Edit Mode</p>
              <p className="text-xs text-slate-500">Rearrange sections, toggle visibility, and adjust widths. Save your customizations below.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={handleReset}
              className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
            >
              <RotateCcw size={12} />
              Reset Defaults
            </button>
            <button
              onClick={handleCancel}
              className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 text-slate-600 hover:text-slate-800"
            >
              <X size={12} />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5"
            >
              <Save size={12} />
              Save Layout
            </button>
          </div>
        </div>
      )}
 
      {/* Grid Container for Layout Customization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {config.widgets
          .filter(w => isEditing || w.visible)
          .map((widget, index) => {
            const widgetContent = (() => {
              switch (widget.id) {
                case 'stats':
                  return (
                    <div className={getStatsGridClass(isEditing ? 5 : config.stats.filter(s => s.visible).length)}>
                      {config.stats.map((stat, statIndex) => {
                        if (!stat.visible && !isEditing) return null;
 
                        const statCardJsx = (() => {
                          switch (stat.id) {
                            case 'clients':
                              return (
                                <StatCard
                                  label="Total Clients"
                                  value={stats.totalClients}
                                  change={stats.clientGrowth}
                                  icon={<Users size={18} style={{ color: '#F4511E' }} />}
                                  iconBg="bg-orange-50"
                                />
                              );
                            case 'projects':
                              return (
                                <StatCard
                                  label="Active Projects"
                                  value={stats.activeProjects}
                                  change={stats.projectGrowth}
                                  icon={<FolderOpen size={18} className="text-blue-500" />}
                                  iconBg="bg-blue-50"
                                />
                              );
                            case 'revenue':
                              return (
                                <StatCard
                                  label="Monthly Revenue"
                                  value={formatCurrency(stats.monthlyRevenue)}
                                  change={stats.revenueGrowth}
                                  icon={<IndianRupee size={18} className="text-emerald-500" />}
                                  iconBg="bg-emerald-50"
                                />
                              );
                            case 'outstanding':
                              return (
                                <StatCard
                                  label="Outstanding"
                                  value={formatCurrency(stats.outstandingPayments)}
                                  icon={<Clock size={18} className="text-amber-500" />}
                                  iconBg="bg-amber-50"
                                  action={isAdmin ? <a href="/invoices?create=true" className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1">➕ Create Invoice</a> : undefined}
                                />
                              );
                            case 'pending':
                              return (
                                <StatCard
                                  label="Pending Approvals"
                                  value={stats.pendingApprovals}
                                  icon={<CheckCircle size={18} className="text-purple-500" />}
                                  iconBg="bg-purple-50"
                                />
                              );
                            default:
                              return null;
                          }
                        })();
 
                        if (isEditing) {
                          return (
                            <StatCardEditorWrapper
                              key={stat.id}
                              id={stat.id}
                              label={stat.label}
                              visible={stat.visible}
                              onMoveLeft={() => moveStat(statIndex, -1)}
                              onMoveRight={() => moveStat(statIndex, 1)}
                              onToggleVisible={() => toggleStatVisible(stat.id)}
                            >
                              {statCardJsx}
                            </StatCardEditorWrapper>
                          );
                        }
 
                        return <div key={stat.id}>{statCardJsx}</div>;
                      })}
                    </div>
                  );
                case 'revenue':
                  return (
                    <div className="card p-6 h-full flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <div className="flex items-center gap-3">
                            <h2 className="section-title">Revenue Overview</h2>
                            <select
                              value={months}
                              onChange={(e) => setMonths(Number(e.target.value))}
                              className="text-xs bg-slate-50 border border-slate-200 rounded p-1 font-semibold text-slate-700 outline-none cursor-pointer focus:ring-1 focus:ring-orange-500/20"
                            >
                              <option value={3}>3 Months</option>
                              <option value={6}>6 Months</option>
                              <option value={12}>12 Months</option>
                            </select>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">Billed vs. Collected</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                          <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full inline-block" style={{ background: '#F4511E' }} /> Billed</span>
                          <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded-full inline-block bg-slate-200" /> Collected</span>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F4511E" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#F4511E" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                          <Tooltip
                            contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                            formatter={(v: number) => [formatCurrency(v), '']}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#F4511E" strokeWidth={2} fill="url(#revGrad)" name="Billed" />
                          <Area type="monotone" dataKey="collected" stroke="#94a3b8" strokeWidth={1.5} fill="none" strokeDasharray="4 3" name="Collected" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  );
                case 'project_status':
                  return (
                    <div className="card p-6 h-full flex flex-col justify-between">
                      <div>
                        <h2 className="section-title mb-1">Project Status</h2>
                        <p className="text-sm text-slate-500 mb-6">Current breakdown</p>
                      </div>
                      <div className="flex items-center justify-center">
                        <PieChart width={140} height={140}>
                          <Pie data={currentPieData} cx={65} cy={65} innerRadius={42} outerRadius={65} paddingAngle={3} dataKey="value">
                            {currentPieData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                        </PieChart>
                      </div>
                      <div className="space-y-2 mt-4">
                        {currentPieData.map((d: any) => (
                          <div key={d.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                              <span className="text-sm text-slate-600">{d.name}</span>
                            </div>
                            <span className="text-sm font-semibold text-navy-900">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                case 'active_projects':
                  return (
                    <div className="card p-6 h-full flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="section-title">Active Projects</h2>
                        <a href="/projects" className="text-xs font-semibold text-orange-600 hover:underline">View all →</a>
                      </div>
                      <div className="space-y-4">
                        {activeProjectsList.map((project: any) => (
                          <div key={project.id} className="flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <p className="text-sm font-semibold text-navy-900 truncate">{project.name}</p>
                                <ProjectStatusBadge status={project.status} />
                              </div>
                              <p className="text-xs text-slate-500 mb-2">{project.clientName}</p>
                              <Progress value={project.progress} showLabel />
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-slate-500">Due</p>
                              <p className="text-sm font-medium text-navy-900">{new Date(project.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                case 'recent_activity':
                  return (
                    <div className="card p-6 h-full flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="section-title">Recent Activity</h2>
                        <a href="/activity" className="text-xs font-semibold text-orange-600 hover:underline">All →</a>
                      </div>
                      <div className="space-y-4">
                        {recentActivity.slice(0, 6).map((log: any) => (
                          <div key={log.id} className="flex items-start gap-2.5">
                            <Avatar name={log.userName} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-700">
                                <span className="font-semibold">{log.userName.split(' ')[0]}</span>{' '}
                                <span className="text-slate-500">{log.action}</span>{' '}
                                <span className="font-medium truncate">{log.entityName}</span>
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">{formatRelativeTime(log.createdAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                case 'overdue_invoices':
                  const hasOverdue = overdueInvoices.length > 0;
                  if (!hasOverdue && !isEditing) return null;
                  return (
                    <div className={`card p-5 border-l-4 ${hasOverdue ? 'border-rose-500' : 'border-slate-300 bg-slate-50'} space-y-4`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-navy-900">{hasOverdue ? '🚨 Overdue Invoices' : 'Overdue Invoices Alert'}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {hasOverdue 
                              ? `${overdueInvoices.length} invoice(s) are past their due date.`
                              : 'No overdue invoices currently.'
                            }
                          </p>
                        </div>
                        {hasOverdue && (
                          <a href="/invoices" className="text-xs font-semibold text-orange-600 hover:underline">View all</a>
                        )}
                      </div>
                      {hasOverdue && (
                        <div className="space-y-2.5 max-h-40 overflow-y-auto">
                          {overdueInvoices.map((inv: any) => (
                            <div key={inv.id} className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                              <div>
                                <p className="text-xs font-semibold text-navy-900">{inv.invoiceNumber} &middot; {inv.clientName}</p>
                                <p className="text-[10px] text-slate-400">Due {new Date(inv.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-rose-600">{formatCurrency(inv.total)}</span>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    api.post(`/invoices/${inv.id}/send`)
                                      .then(() => toast.success('Reminder email sent!'))
                                      .catch(err => toast.error(err.response?.data?.error || err.message));
                                  }}
                                  className="btn-secondary text-[10px] py-1 px-2.5 cursor-pointer"
                                >
                                  Send Reminder
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                default:
                  return null;
              }
            })();
 
            if (isEditing) {
              return (
                <WidgetEditorWrapper
                  key={widget.id}
                  id={widget.id}
                  name={widget.name}
                  span={widget.span}
                  visible={widget.visible}
                  onMoveUp={() => moveWidget(index, -1)}
                  onMoveDown={() => moveWidget(index, 1)}
                  onToggleVisible={() => toggleWidgetVisible(widget.id)}
                  onChangeSpan={(span) => changeWidgetSpan(widget.id, span)}
                >
                  {widgetContent}
                </WidgetEditorWrapper>
              );
            }
 
            return (
              <div key={widget.id} className={widget.span}>
                {widgetContent}
              </div>
            );
          })
        }
      </div>
    </Layout>
  )
}

