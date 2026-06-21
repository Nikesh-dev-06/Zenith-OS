import { useState, useEffect } from 'react'
import { Download, TrendingUp, Users, FileText, CheckCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Layout } from '../components/layout/Layout'
import { formatCurrency } from '../lib/utils'
import api from '../lib/api'

export default function ReportsPage() {
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [clientPerformance, setClientPerformance] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [projectsCount, setProjectsCount] = useState({ total: 0, completed: 0 })
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [revRes, perfRes, clientsRes, invoicesRes, projectsRes] = await Promise.all([
        api.get('/reports/revenue'),
        api.get('/reports/client-performance'),
        api.get('/clients?limit=100'),
        api.get('/invoices?limit=100'),
        api.get('/projects?limit=100')
      ])

      setRevenueData(revRes.data || [])
      setClientPerformance(perfRes.data || [])
      setClients(clientsRes.data.clients || [])
      setInvoices(invoicesRes.data.invoices || [])

      const projList = projectsRes.data.projects || []
      setProjectsCount({
        total: projList.length,
        completed: projList.filter((p: any) => p.status === 'completed').length
      })
    } catch (err) {
      console.error('Failed to fetch report data', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Calculate KPIs
  const totalCollected = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const outstandingInvoicesCount = invoices.filter(i => i.status !== 'paid').length
  const outstandingInvoicesAmount = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.total, 0)

  // Dynamically compute client growth chart based on real client registration dates
  const getClientGrowthData = () => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const counts: Record<string, number> = {}
    clients.forEach(c => {
      if (c.createdAt) {
        const d = new Date(c.createdAt)
        const m = monthNames[d.getMonth()]
        counts[m] = (counts[m] || 0) + 1
      }
    })
    let cumulative = 0
    const currentMonthIndex = new Date().getMonth()
    return monthNames.map((m, idx) => {
      cumulative += (counts[m] || 0)
      return { month: m, clients: cumulative, monthIndex: idx }
    }).filter(item => item.monthIndex <= currentMonthIndex)
  }

  const clientGrowth = getClientGrowthData()

  const handleExportCSV = () => {
    if (clientPerformance.length === 0) return
    const headers = ['Client Name', 'Industry', 'Projects Count', 'Revenue Collected (INR)', 'Status']
    const rows = clientPerformance.map(item => [
      `"${item.client.name}"`,
      `"${item.client.industry || ''}"`,
      item.projects,
      item.revenue,
      item.client.status
    ])
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `client_performance_report_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <Layout title="Reports">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Reports">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Business performance overview</p>
        </div>
        <button className="btn-primary cursor-pointer" onClick={handleExportCSV}>
          <Download size={15} /> Export Report
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Total Revenue',
            value: formatCurrency(totalCollected),
            icon: <TrendingUp size={18} className="text-emerald-500" />,
            bg: 'bg-emerald-50',
            sub: 'All time collected'
          },
          {
            label: 'Total Clients',
            value: clients.length,
            icon: <Users size={18} style={{ color: '#F4511E' }} />,
            bg: 'bg-orange-50',
            sub: `${clients.filter(c => c.status === 'active').length} active`
          },
          {
            label: 'Projects Delivered',
            value: projectsCount.completed,
            icon: <CheckCircle size={18} className="text-blue-500" />,
            bg: 'bg-blue-50',
            sub: `${projectsCount.total} total projects`
          },
          {
            label: 'Outstanding Invoices',
            value: outstandingInvoicesCount,
            icon: <FileText size={18} className="text-amber-500" />,
            bg: 'bg-amber-50',
            sub: formatCurrency(outstandingInvoicesAmount)
          },
        ].map(k => (
          <div key={k.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500">{k.label}</span>
              <div className={`w-9 h-9 rounded-xl ${k.bg} flex items-center justify-center`}>{k.icon}</div>
            </div>
            <p className="text-2xl font-bold text-navy-900">{k.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Bar Chart */}
        <div className="card p-6">
          <h2 className="section-title mb-1">Monthly Revenue</h2>
          <p className="text-xs text-slate-500 mb-5">Billed vs Collected per month</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), 'Amount']} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="revenue" fill="url(#barGrad)" radius={[6, 6, 0, 0]} name="Billed" />
              <Bar dataKey="collected" fill="#10B981" radius={[6, 6, 0, 0]} name="Collected" />
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F4511E" />
                  <stop offset="100%" stopColor="#FF8C42" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Client Growth */}
        <div className="card p-6">
          <h2 className="section-title mb-1">Client Growth</h2>
          <p className="text-xs text-slate-500 mb-5">Cumulative clients over time</p>
          {clientGrowth.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-xs text-slate-400">No client registration data available.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={clientGrowth} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="clients" stroke="#4F46E5" strokeWidth={2.5} dot={{ fill: '#4F46E5', r: 4 }} name="Clients" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Client Performance Table */}
      <div className="card overflow-hidden mb-6">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="section-title">Client Performance</h2>
          <button className="btn-ghost text-xs cursor-pointer" onClick={handleExportCSV}><Download size={13} /> Export CSV</button>
        </div>
        {clientPerformance.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No client data to show.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-header text-left">Client</th>
                <th className="table-header text-left">Industry</th>
                <th className="table-header text-left">Projects</th>
                <th className="table-header text-left">Revenue</th>
                <th className="table-header text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {clientPerformance.map(item => (
                <tr key={item.client.id} className="table-row">
                  <td className="table-cell text-sm">
                    <div className="font-semibold text-navy-900">{item.client.name}</div>
                    {item.client.gstin && <div className="text-[10px] text-slate-400 font-normal">GSTIN: {item.client.gstin}</div>}
                  </td>
                  <td className="table-cell text-sm text-slate-500">{item.client.industry || 'N/A'}</td>
                  <td className="table-cell text-sm text-slate-700">{item.projects}</td>
                  <td className="table-cell text-sm font-bold text-emerald-600">{formatCurrency(item.revenue)}</td>
                  <td className="table-cell">
                    <span className={`badge ${item.client.status === 'active' ? 'badge-success' : 'badge-default'}`}>
                      {item.client.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invoice Status Summary */}
      <div className="card p-6">
        <h2 className="section-title mb-4">Invoice Status Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(['draft', 'sent', 'paid', 'overdue'] as const).map(status => {
            const count = invoices.filter(i => i.status === status).length
            const amount = invoices.filter(i => i.status === status).reduce((s, i) => s + i.total, 0)
            const colors: Record<string, string> = { draft: 'text-slate-600', sent: 'text-blue-600', paid: 'text-emerald-600', overdue: 'text-rose-600' }
            return (
              <div key={status} className="bg-slate-50 rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold capitalize ${colors[status]}`}>{count}</p>
                <p className="text-xs text-slate-500 capitalize mt-0.5">{status}</p>
                <p className="text-xs font-semibold text-slate-600 mt-1">{formatCurrency(amount)}</p>
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}
