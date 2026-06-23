import { useState, useEffect } from 'react'
import { Plus, Send, Download, Eye, IndianRupee, Trash2, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { InvoiceStatusBadge, EmptyState, Modal, Skeleton } from '../components/ui/index'
import { formatCurrency, formatDate } from '../lib/utils'
import type { InvoiceStatus } from '../types'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import api from '../lib/api'

export default function InvoicesPage() {
  const { user } = useAuth()
  const isClient = ['client', 'client_viewer'].includes(user?.role || '')
  const toast = useToast()
  const navigate = useNavigate()

  const [invoices, setInvoices] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all')
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' })

  // Razorpay simulated payment states
  const [showRazorpay, setShowRazorpay] = useState(false)
  const [payStep, setPayStep] = useState<'method' | 'processing' | 'success'>('method')
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [paymentOrderId, setPaymentOrderId] = useState<string>('')

  // Sorting states
  const [sortField, setSortField] = useState<'invoiceNumber' | 'total' | 'dueDate' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Recurring Subscriptions states
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'recurring'>('invoices')
  const [recurringTemplates, setRecurringTemplates] = useState<any[]>([])
  const [showAddTemplate, setShowAddTemplate] = useState(false)

  // Add template fields
  const [tmplClient, setTmplClient] = useState('')
  const [tmplProject, setTmplProject] = useState('')
  const [tmplFrequency, setTmplFrequency] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly')
  const [tmplNextDate, setTmplNextDate] = useState('')
  const [tmplNotes, setTmplNotes] = useState('')
  const [tmplDiscountType, setTmplDiscountType] = useState<'percent' | 'flat'>('percent')
  const [tmplDiscountValue, setTmplDiscountValue] = useState(0)
  const [tmplTaxRate, setTmplTaxRate] = useState(18)
  const [tmplItems, setTmplItems] = useState<any[]>([
    { description: '', quantity: 1, rate: 0, hsnCode: '' }
  ])

  const fetchRecurringTemplates = () => {
    api.get('/recurring')
      .then(res => {
        setRecurringTemplates(res.data || [])
      })
      .catch(err => {
        console.error(err)
      })
  }

  // Auto open from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('create') === 'true') {
      navigate('/invoices/create')
    }
  }, [navigate])

  const handleSort = (field: 'invoiceNumber' | 'total' | 'dueDate') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const fetchInvoices = () => {
    setLoading(true)
    api.get('/invoices')
      .then(res => {
        setInvoices(res.data.invoices || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchInvoices()
    if (!isClient) {
      api.get('/clients?limit=100').then(res => setClients(res.data.clients || []))
      api.get('/projects?limit=100').then(res => setProjects(res.data.projects || []))
      fetchRecurringTemplates()
    }
  }, [isClient])

  const handleTriggerTemplate = async (id: string) => {
    try {
      await api.post(`/recurring/${id}/trigger`)
      toast.success('Invoice generated successfully from this template!')
      fetchInvoices()
      fetchRecurringTemplates()
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this recurring template?')) return
    try {
      await api.delete(`/recurring/${id}`)
      toast.success('Recurring template deleted.')
      fetchRecurringTemplates()
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const handleDownloadGstr1 = () => {
    let url = `/invoices/gstr1-export`
    const params: string[] = []
    if (dateFilter === 'custom' && customRange.from && customRange.to) {
      params.push(`from=${customRange.from}`)
      params.push(`to=${customRange.to}`)
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`
    }

    api.get(url, { responseType: 'blob' })
      .then(res => {
        const blob = new Blob([res.data], { type: 'text/csv' })
        const downloadUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = `GSTR1_Export_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        toast.success('GSTR-1 report downloaded successfully.')
      })
      .catch(err => {
        toast.error('Failed to download report: ' + err.message)
      })
  }

  const calcTmplTotals = () => {
    const subtotal = tmplItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.rate || 0)), 0)
    let discount = 0
    if (tmplDiscountType === 'percent') {
      discount = Math.round(subtotal * (Number(tmplDiscountValue || 0)) / 100)
    } else {
      discount = Number(tmplDiscountValue || 0)
    }
    const taxableAmount = Math.max(0, subtotal - discount)
    const tax = Math.round(taxableAmount * (Number(tmplTaxRate || 18)) / 100)
    const total = taxableAmount + tax
    return { subtotal, discount, tax, total }
  }

  const handleCreateTemplateSubmit = () => {
    if (!tmplClient) {
      toast.error('Please select a client.')
      return
    }
    if (tmplItems.some(item => !item.description.trim() || Number(item.quantity || 0) <= 0 || Number(item.rate || 0) < 0)) {
      toast.error('Please fill all item descriptions, positive quantities, and rates.')
      return
    }

    const payload = {
      clientId: tmplClient,
      projectId: tmplProject || undefined,
      frequency: tmplFrequency,
      nextGenerateDate: tmplNextDate ? new Date(tmplNextDate) : undefined,
      discountType: tmplDiscountType,
      discountValue: tmplDiscountValue,
      taxRate: tmplTaxRate,
      notes: tmplNotes,
      items: tmplItems.map(item => ({
        description: item.description,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        hsnCode: item.hsnCode || undefined
      }))
    }

    api.post('/recurring', payload)
      .then(() => {
        toast.success('Recurring subscription template created successfully.')
        setShowAddTemplate(false)
        fetchRecurringTemplates()
        // Reset states
        setTmplClient('')
        setTmplProject('')
        setTmplFrequency('monthly')
        setTmplNextDate('')
        setTmplNotes('')
        setTmplDiscountType('percent')
        setTmplDiscountValue(0)
        setTmplTaxRate(18)
        setTmplItems([{ description: '', quantity: 1, rate: 0, hsnCode: '' }])
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.message)
      })
  }

  const handleSendInvoice = (id: string) => {
    api.post(`/invoices/${id}/send`)
      .then(() => {
        fetchInvoices()
        toast.success('Invoice sent successfully.')
        if (selected === id) {
          setSelected(null)
        }
      })
      .catch(err => toast.error(err.response?.data?.error || err.message))
  }

  const handleStartPayment = async (invoice: any) => {
    try {
      setPaymentAmount(invoice.total)
      const res = await api.post('/payments/create-order', { invoiceId: invoice.id })
      setPaymentOrderId(res.data.order.id)
      setPayStep('method')
      setShowRazorpay(true)
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const handleVerifyPayment = async () => {
    if (!selectedMethod) return
    setPayStep('processing')
    try {
      await api.post('/payments/verify', {
        razorpayOrderId: paymentOrderId,
        razorpayPaymentId: `pay_${Math.random().toString(36).substring(2, 11)}`,
        razorpaySignature: 'mock_signature',
        invoiceId: selected
      })
      setTimeout(() => {
        setPayStep('success')
        fetchInvoices()
      }, 1500)
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
      setPayStep('method')
    }
  }

  const filtered = invoices.filter(i => {
    const statusMatch = filter === 'all' || i.status === filter
    let dateMatch = true
    const invDate = new Date(i.createdAt)
    const today = new Date()
    switch (dateFilter) {
      case 'today':
        dateMatch = invDate.toDateString() === today.toDateString()
        break
      case 'week': {
        const weekStart = new Date()
        weekStart.setDate(today.getDate() - today.getDay())
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        dateMatch = invDate >= weekStart && invDate <= weekEnd
        break
      }
      case 'month':
        dateMatch = invDate.getMonth() === today.getMonth() && invDate.getFullYear() === today.getFullYear()
        break
      case 'year':
        dateMatch = invDate.getFullYear() === today.getFullYear()
        break
      case 'custom':
        if (customRange.from && customRange.to) {
          const from = new Date(customRange.from)
          const to = new Date(customRange.to)
          dateMatch = invDate >= from && invDate <= to
        }
        break
      default:
        dateMatch = true
    }
    return statusMatch && dateMatch
  })

  const sortedInvoices = [...filtered].sort((a, b) => {
    if (!sortField) return 0
    let aVal = a[sortField] || ''
    let bVal = b[sortField] || ''
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const selectedInvoice = invoices.find(i => i.id === selected)

  const totals = {
    total: invoices.reduce((s, i) => s + i.total, 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0),
    outstanding: invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.total, 0),
  }

  const paymentMethods = selectedInvoice?.currency && selectedInvoice.currency !== 'INR'
    ? [
        { id: 'stripe', label: 'Stripe Card Checkout', icon: '💳', desc: 'Visa, Mastercard, AMEX, Apple Pay' },
        { id: 'paypal', label: 'PayPal Checkout', icon: '🅿️', desc: 'Pay via PayPal balance or account' },
        { id: 'wise', label: 'Wise Direct Transfer', icon: '🏦', desc: 'Simulate direct international bank wire' }
      ]
    : [
        { id: 'upi', label: 'UPI', icon: '📱', desc: 'Google Pay, PhonePe, Paytm' },
        { id: 'card', label: 'Credit / Debit Card', icon: '💳', desc: 'Visa, Mastercard, RuPay' },
        { id: 'netbanking', label: 'Net Banking', icon: '🏦', desc: 'All major banks' },
      ]

  if (loading) {
    return (
      <Layout title="Invoices">
        <div className="page-header flex flex-wrap items-start justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-4">
              <Skeleton className="h-4 w-20 mx-auto mb-2" />
              <Skeleton className="h-6 w-32 mx-auto" />
            </div>
          ))}
        </div>
        <div className="card p-6 space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Invoices">
      <div className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{activeSubTab === 'invoices' ? 'Invoices' : 'Recurring Invoices'}</h1>
          <p className="page-subtitle">
            {activeSubTab === 'invoices' 
              ? `${invoices.length} invoices · ${invoices.filter(i => i.status === 'paid').length} paid`
              : `${recurringTemplates.length} recurring subscriptions active`
            }
          </p>
        </div>
        {!isClient && (
          <div className="flex items-center gap-3">
            {activeSubTab === 'invoices' && (
              <button
                type="button"
                className="btn-secondary cursor-pointer border-emerald-200 text-emerald-600 hover:bg-emerald-50 text-xs py-2 px-3 flex items-center gap-1.5"
                onClick={handleDownloadGstr1}
              >
                <Download size={14} /> Export GSTR-1
              </button>
            )}
            {activeSubTab === 'invoices' ? (
              <button className="btn-primary cursor-pointer text-xs py-2" onClick={() => navigate('/invoices/create')}>
                <Plus size={16} /> Create Invoice
              </button>
            ) : (
              <button className="btn-primary cursor-pointer text-xs py-2" onClick={() => setShowAddTemplate(true)}>
                <Plus size={16} /> Create Template
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sub tabs choice */}
      {!isClient && (
        <div className="flex gap-2 border-b border-slate-200 mb-6">
          <button
            type="button"
            className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 cursor-pointer ${activeSubTab === 'invoices' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveSubTab('invoices')}
          >
            All Invoices
          </button>
          <button
            type="button"
            className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 cursor-pointer ${activeSubTab === 'recurring' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveSubTab('recurring')}
          >
            Recurring Subscriptions
          </button>
        </div>
      )}

      {activeSubTab === 'invoices' ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Billed', value: totals.total, color: 'text-navy-900' },
              { label: 'Collected', value: totals.paid, color: 'text-emerald-600' },
              { label: 'Outstanding', value: totals.outstanding, color: 'text-amber-600' },
            ].map(s => (
              <div key={s.label} className="card p-4 text-center">
                <p className="text-xs text-slate-500 mb-1.5">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{formatCurrency(s.value)}</p>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-4">
            {(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all cursor-pointer ${filter === s ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {s} {s !== 'all' && `(${invoices.filter(i => i.status === s).length})`}
              </button>
            ))}
          </div>

          {/* Date filter */}
          <div className="flex items-center gap-2 mb-4">
            <label className="text-sm font-medium">Date:</label>
            <select className="input" value={dateFilter} onChange={e => setDateFilter(e.target.value as any)}>
              <option value="all">All</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
            {dateFilter === 'custom' && (
              <>
                <input type="date" className="input" value={customRange.from} onChange={e => setCustomRange(prev => ({ ...prev, from: e.target.value }))} />
                <span>–</span>
                <input type="date" className="input" value={customRange.to} onChange={e => setCustomRange(prev => ({ ...prev, to: e.target.value }))} />
              </>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="🧾"
              title="No invoices"
              description={isClient ? "No invoices found for your account." : "Create your first invoice to send to clients."}
              action={
                !isClient ? (
                  <button className="btn-primary" onClick={() => navigate('/invoices/create')}>
                    <Plus size={15} /> Create Invoice
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="table-header text-left cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('invoiceNumber')}>
                      <div className="flex items-center gap-1">
                        <span>Invoice</span>
                        {sortField === 'invoiceNumber' ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
                      </div>
                    </th>
                    <th className="table-header text-left">Client</th>
                    <th className="table-header text-left">Project</th>
                    <th className="table-header text-left cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('total')}>
                      <div className="flex items-center gap-1">
                        <span>Amount</span>
                        {sortField === 'total' ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
                      </div>
                    </th>
                    <th className="table-header text-left">Status</th>
                    <th className="table-header text-left cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('dueDate')}>
                      <div className="flex items-center gap-1">
                        <span>Due Date</span>
                        {sortField === 'dueDate' ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
                      </div>
                    </th>
                    <th className="table-header text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedInvoices.map(inv => (
                    <tr key={inv.id} className="table-row cursor-pointer" onClick={() => setSelected(inv.id)}>
                      <td className="table-cell">
                        <p className="font-semibold text-navy-900 text-sm">{inv.invoiceNumber}</p>
                        <p className="text-xs text-slate-400">{formatDate(inv.createdAt)}</p>
                      </td>
                      <td className="table-cell text-sm text-slate-700">{inv.clientName}</td>
                      <td className="table-cell text-sm text-slate-500 max-w-[150px] truncate">{inv.projectName}</td>
                      <td className="table-cell">
                        <p className="text-sm font-bold text-navy-900">{formatCurrency(inv.total, inv.currency)}</p>
                        <p className="text-xs text-slate-400">incl. tax ({inv.taxRate || 18}%)</p>
                      </td>
                      <td className="table-cell"><InvoiceStatusBadge status={inv.status} /></td>
                      <td className={`table-cell text-sm font-medium ${inv.status === 'overdue' ? 'text-rose-600' : 'text-slate-600'}`}>{formatDate(inv.dueDate)}</td>
                      <td className="table-cell" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button className="btn-ghost p-1.5 text-slate-400 hover:text-navy-900" title="View" onClick={() => setSelected(inv.id)}><Eye size={14} /></button>
                          {!isClient && inv.status === 'draft' && (
                            <button className="btn-ghost p-1.5 text-slate-400 hover:text-blue-600" title="Send" onClick={() => handleSendInvoice(inv.id)}><Send size={14} /></button>
                          )}
                          {isClient && inv.status !== 'paid' && (
                            <button className="btn-ghost p-1.5 text-slate-400 hover:text-emerald-600 animate-pulse" title="Pay Now" onClick={() => { setSelected(inv.id); handleStartPayment(inv); }}><IndianRupee size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {recurringTemplates.length === 0 ? (
            <EmptyState
              icon="🔄"
              title="No recurring templates"
              description="Configure automated invoice generation templates for subscriptions."
              action={
                <button className="btn-primary cursor-pointer flex items-center gap-1" onClick={() => setShowAddTemplate(true)}>
                  <Plus size={15} /> Create Template
                </button>
              }
            />
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="table-header text-left">Client / Project</th>
                    <th className="table-header text-left">Frequency</th>
                    <th className="table-header text-left">Amount</th>
                    <th className="table-header text-left">Next Billing Date</th>
                    <th className="table-header text-left">Status</th>
                    <th className="table-header text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recurringTemplates.map(tmpl => (
                    <tr key={tmpl._id || tmpl.id} className="table-row">
                      <td className="table-cell font-semibold text-sm text-navy-900">
                        {tmpl.clientId?.companyName || 'Unknown Client'}
                        {tmpl.projectId && <p className="text-xs text-slate-400 font-normal">{tmpl.projectId?.name}</p>}
                      </td>
                      <td className="table-cell">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 capitalize">
                          {tmpl.frequency}
                        </span>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm font-bold text-navy-900">{formatCurrency(tmpl.total)}</p>
                        <p className="text-[10px] text-slate-400">Tax rate: {tmpl.taxRate || 18}%</p>
                      </td>
                      <td className="table-cell text-sm text-slate-600">
                        {formatDate(tmpl.nextGenerateDate)}
                      </td>
                      <td className="table-cell">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tmpl.isActive !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                          {tmpl.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn-secondary text-xs py-1.5 px-3 border-orange-200 text-orange-600 hover:bg-orange-50 cursor-pointer"
                            onClick={() => handleTriggerTemplate(tmpl._id || tmpl.id)}
                            title="Run Template (Generate Invoice)"
                          >
                            Trigger Run
                          </button>
                          <button
                            type="button"
                            className="btn-ghost p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                            onClick={() => handleDeleteTemplate(tmpl._id || tmpl.id)}
                            title="Delete Template"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invoice detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Invoice Details" size="lg">
        {selectedInvoice && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-navy-900">{selectedInvoice.invoiceNumber}</p>
                <p className="text-sm text-slate-500 mt-0.5">{selectedInvoice.clientName} · {selectedInvoice.projectName}</p>
                {selectedInvoice.clientId && (
                  <div className="text-xs text-slate-400 mt-2 space-y-0.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100/50 w-fit">
                    {selectedInvoice.clientId.address && <p><span className="font-semibold text-slate-500">Address:</span> {selectedInvoice.clientId.address}</p>}
                    {selectedInvoice.clientId.phone && <p><span className="font-semibold text-slate-500">Phone:</span> {selectedInvoice.clientId.phone}</p>}
                    {selectedInvoice.clientId.gstin && <p><span className="font-semibold text-slate-500">GSTIN:</span> {selectedInvoice.clientId.gstin}</p>}
                    {selectedInvoice.clientId.pan && <p><span className="font-semibold text-slate-500">PAN:</span> {selectedInvoice.clientId.pan}</p>}
                    {selectedInvoice.placeOfSupply && <p><span className="font-semibold text-slate-500">Place of Supply:</span> {selectedInvoice.placeOfSupply}</p>}
                  </div>
                )}
              </div>
              <InvoiceStatusBadge status={selectedInvoice.status} />
            </div>

            <div className="bg-slate-50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Description</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">HSN/SAC</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Qty</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Rate</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items && selectedInvoice.items.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-700">
                        <div>{item.description}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{item.hsnCode || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.rate)}</td>
                      <td className="px-4 py-3 text-right font-medium text-navy-900">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 space-y-1.5 font-medium border-t border-slate-200">
                <div className="flex justify-between text-sm text-slate-600 font-medium">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 font-medium">
                    <span>Discount ({selectedInvoice.discountType === 'percent' ? `${selectedInvoice.discountValue}%` : 'Flat'})</span>
                    <span>-{formatCurrency(selectedInvoice.discount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm text-slate-600 font-medium">
                  <span>Taxable Value</span>
                  <span>{formatCurrency(selectedInvoice.subtotal - selectedInvoice.discount)}</span>
                </div>

                {selectedInvoice.isExport ? (
                  <div className="bg-emerald-50 text-emerald-800 p-2 rounded-lg text-[10px] leading-snug">
                    Zero-rated GST (Export under LUT No: <span className="font-mono font-bold">{selectedInvoice.lutNumber || 'Pending'}</span>)
                  </div>
                ) : (
                  <>
                    {selectedInvoice.isIntrastate !== false ? (
                      <>
                        <div className="flex justify-between text-xs text-slate-500 pl-2">
                          <span>CGST ({(selectedInvoice.taxRate || 18) / 2}%)</span>
                          <span>{formatCurrency(selectedInvoice.cgst ?? Math.round((selectedInvoice.subtotal - selectedInvoice.discount) * ((selectedInvoice.taxRate || 18) / 2) / 100))}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 pl-2">
                          <span>SGST ({(selectedInvoice.taxRate || 18) / 2}%)</span>
                          <span>{formatCurrency(selectedInvoice.sgst ?? Math.round((selectedInvoice.subtotal - selectedInvoice.discount) * ((selectedInvoice.taxRate || 18) / 2) / 100))}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-xs text-slate-500 pl-2">
                        <span>IGST ({selectedInvoice.taxRate || 18}%)</span>
                        <span>{formatCurrency(selectedInvoice.igst ?? Math.round((selectedInvoice.subtotal - selectedInvoice.discount) * (selectedInvoice.taxRate || 18) / 100))}</span>
                      </div>
                    )}
                    {selectedInvoice.rcm && (
                      <div className="bg-amber-50 text-amber-800 p-2 rounded-lg text-[10px] leading-snug">
                        ⚠️ GST payable under Reverse Charge (RCM). Tax is NOT added to the invoice total.
                      </div>
                    )}
                  </>
                )}

                {selectedInvoice.roundingAdjustment ? (
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>Rounding Off</span>
                    <span>{selectedInvoice.roundingAdjustment > 0 ? '+' : ''}{formatCurrency(selectedInvoice.roundingAdjustment)}</span>
                  </div>
                ) : null}

                <div className="flex justify-between text-base font-bold text-navy-900 pt-1.5 border-t border-slate-200">
                  <span>{selectedInvoice.rcm ? 'Total (Excl. GST)' : 'Total Invoice Value'}</span>
                  <span>{formatCurrency(selectedInvoice.total)}</span>
                </div>

                {((selectedInvoice.tdsAmount || 0) > 0) && (
                  <>
                    <div className="flex justify-between text-sm text-rose-600 font-medium pt-1.5 border-t border-dashed border-slate-200">
                      <span>TDS Withheld (@ {selectedInvoice.tdsRate}%)</span>
                      <span>-{formatCurrency(selectedInvoice.tdsAmount)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-emerald-600 pt-1.5 border-t border-slate-200">
                      <span>Net Payable / Due</span>
                      <span>{formatCurrency(selectedInvoice.total - selectedInvoice.tdsAmount)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bank details & UPI QR Code scan block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2.5">Bank Transfer Details</h4>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">Account Holder</span> {selectedInvoice.bankDetails?.accountHolder || 'Zenith OS Agency'}</p>
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">Bank Name</span> {selectedInvoice.bankDetails?.bankName || 'HDFC Bank'}</p>
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">Account Number</span> <span className="font-mono font-bold text-navy-900">{selectedInvoice.bankDetails?.accountNumber || '50100234567890'}</span></p>
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">IFSC Code</span> <span className="font-mono font-bold text-navy-900">{selectedInvoice.bankDetails?.ifscCode || 'HDFC0000123'}</span></p>
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">UPI ID</span> <span className="font-mono font-medium text-slate-800">{selectedInvoice.bankDetails?.upiId || 'zenithos@upi'}</span></p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col items-center justify-center text-center">
                <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2.5">Scan to Pay via UPI</h4>
                {(() => {
                  const upiId = selectedInvoice.bankDetails?.upiId || 'zenithos@upi';
                  const payeeName = selectedInvoice.bankDetails?.accountHolder || 'Zenith OS Agency';
                  const amount = selectedInvoice.tdsAmount > 0 ? (selectedInvoice.total - selectedInvoice.tdsAmount) : selectedInvoice.total;
                  const invoiceNum = selectedInvoice.invoiceNumber;
                  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Invoice ' + invoiceNum)}`;
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(upiUrl)}`;
                  return (
                    <div className="space-y-2">
                      <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 inline-block">
                        <img src={qrUrl} alt="UPI QR Code" className="w-[110px] h-[110px]" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">Scan using BHIM, GPay, PhonePe, or Paytm</p>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex gap-3">
              {isClient && selectedInvoice.status !== 'paid' && (
                <button className="btn-primary flex-1 justify-center cursor-pointer" onClick={() => handleStartPayment(selectedInvoice)}><IndianRupee size={15} /> Pay Now</button>
              )}
              {!isClient && selectedInvoice.status === 'draft' && (
                <button className="btn-primary flex-1 justify-center cursor-pointer" onClick={() => handleSendInvoice(selectedInvoice.id)}><Send size={15} /> Send Invoice</button>
              )}
              <button className="btn-secondary flex-1 justify-center cursor-pointer" onClick={() => toast.info('PDF generation is simulated for this environment.')}><Download size={15} /> Download PDF</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Razorpay Simulation Modal */}
      <Modal open={showRazorpay} onClose={() => { setShowRazorpay(false); setPayStep('method'); }} title="Simulate Payment" size="sm">
        {payStep === 'method' && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-navy-900">{formatCurrency(paymentAmount, selectedInvoice?.currency)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Order ID: {paymentOrderId}</p>
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Choose payment method</p>

            <div className="space-y-2">
              {paymentMethods.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMethod(m.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer
                    ${selectedMethod === m.id ? 'border-orange-400 bg-orange-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm flex-shrink-0">
                    {m.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-navy-900">{m.label}</p>
                    <p className="text-[10px] text-slate-400">{m.desc}</p>
                  </div>
                  {selectedMethod === m.id && (
                    <CheckCircle size={14} className="ml-auto text-orange-500" />
                  )}
                </button>
              ))}
            </div>

            <button
              className="btn-primary w-full justify-center py-2.5 mt-2"
              disabled={!selectedMethod}
              onClick={handleVerifyPayment}
            >
              Pay {formatCurrency(paymentAmount, selectedInvoice?.currency)}
            </button>
          </div>
        )}

        {payStep === 'processing' && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center animate-pulse bg-orange-100">
              <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
            </div>
            <p className="font-semibold text-sm text-navy-900 mb-0.5">Processing payment...</p>
            <p className="text-xs text-slate-500">Communicating with payment servers.</p>
          </div>
        )}

        {payStep === 'success' && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-emerald-100">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-navy-900 mb-0.5">Payment Successful!</p>
            <p className="text-xs text-slate-500 mb-4">{formatCurrency(paymentAmount, selectedInvoice?.currency)} received successfully.</p>
            <button
              className="btn-primary justify-center w-full"
              onClick={() => { setShowRazorpay(false); setPayStep('method'); setSelected(null); }}
            >
              Close
            </button>
          </div>
        )}
      </Modal>

      {/* Create Recurring Template Modal */}
      <Modal open={showAddTemplate} onClose={() => setShowAddTemplate(false)} title="Create Subscription Template" size="lg">
        <div className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Client *</label>
              <select
                className="input"
                value={tmplClient}
                onChange={e => {
                  setTmplClient(e.target.value)
                  setTmplProject('')
                }}
              >
                <option value="">Select Client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Project</label>
              <select
                className="input"
                value={tmplProject}
                onChange={e => setTmplProject(e.target.value)}
                disabled={!tmplClient}
              >
                <option value="">Select Project</option>
                {projects.filter(p => p.clientId === tmplClient || p.clientId?.id === tmplClient).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Billing Frequency *</label>
              <select
                className="input"
                value={tmplFrequency}
                onChange={e => setTmplFrequency(e.target.value as any)}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">First Billing Date *</label>
              <input
                type="date"
                className="input"
                value={tmplNextDate}
                onChange={e => setTmplNextDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">GST Tax Rate (%)</label>
              <input
                type="number"
                className="input"
                value={tmplTaxRate}
                onChange={e => setTmplTaxRate(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Discount Type</label>
              <select
                className="input"
                value={tmplDiscountType}
                onChange={e => setTmplDiscountType(e.target.value as any)}
              >
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat Amount</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Discount Value</label>
              <input
                type="number"
                className="input"
                value={tmplDiscountValue}
                onChange={e => setTmplDiscountValue(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Items segment */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">Line Items</h4>
              <button
                type="button"
                className="text-xs text-orange-600 font-semibold hover:underline cursor-pointer"
                onClick={() => setTmplItems(prev => [...prev, { description: '', quantity: 1, rate: 0, hsnCode: '' }])}
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-2">
              {tmplItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                  <div className="flex-2">
                    <input
                      type="text"
                      placeholder="Description *"
                      className="input py-1 text-xs"
                      value={item.description}
                      onChange={e => {
                        const updated = [...tmplItems]
                        updated[idx].description = e.target.value
                        setTmplItems(updated)
                      }}
                    />
                  </div>
                  <div className="w-16">
                    <input
                      type="number"
                      placeholder="Qty"
                      className="input py-1 text-xs"
                      min={1}
                      value={item.quantity}
                      onChange={e => {
                        const updated = [...tmplItems]
                        updated[idx].quantity = Number(e.target.value)
                        setTmplItems(updated)
                      }}
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      placeholder="Rate"
                      className="input py-1 text-xs"
                      value={item.rate}
                      onChange={e => {
                        const updated = [...tmplItems]
                        updated[idx].rate = Number(e.target.value)
                        setTmplItems(updated)
                      }}
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="text"
                      placeholder="HSN Code"
                      className="input py-1 text-xs font-mono"
                      value={item.hsnCode}
                      onChange={e => {
                        const updated = [...tmplItems]
                        updated[idx].hsnCode = e.target.value
                        setTmplItems(updated)
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                    disabled={tmplItems.length <= 1}
                    onClick={() => {
                      const updated = [...tmplItems]
                      updated.splice(idx, 1)
                      setTmplItems(updated)
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes (printed on generated invoice)</label>
            <textarea
              className="input h-16 resize-none text-xs"
              placeholder="e.g. Subscriptions terms, billing info..."
              value={tmplNotes}
              onChange={e => setTmplNotes(e.target.value)}
            />
          </div>

          {/* Pricing calculations preview */}
          {calcTmplTotals().subtotal > 0 && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span>{formatCurrency(calcTmplTotals().subtotal)}</span>
              </div>
              {calcTmplTotals().discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(calcTmplTotals().discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>GST ({tmplTaxRate}%):</span>
                <span>{formatCurrency(calcTmplTotals().tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-navy-900 text-sm border-t border-slate-200/50 pt-1 mt-1 font-bold">
                <span>Total Amount:</span>
                <span>{formatCurrency(calcTmplTotals().total)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              className="flex-1 btn-secondary cursor-pointer"
              onClick={() => setShowAddTemplate(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="flex-1 btn-primary cursor-pointer justify-center"
              onClick={handleCreateTemplateSubmit}
            >
              Save Template
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
