import { useState, useEffect } from 'react'
import { Plus, Send, Download, Eye, IndianRupee, Trash2, CheckCircle } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { InvoiceStatusBadge, EmptyState, Modal } from '../components/ui/index'
import { formatCurrency, formatDate } from '../lib/utils'
import type { InvoiceStatus } from '../types'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'

export default function InvoicesPage() {
  const { user } = useAuth()
  const isClient = user?.role === 'client'
  const navigate = useNavigate()

  const [invoices, setInvoices] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all')
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' })

  // Razorpay simulated payment states
  const [showRazorpay, setShowRazorpay] = useState(false)
  const [payStep, setPayStep] = useState<'method' | 'processing' | 'success'>('method')
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [paymentOrderId, setPaymentOrderId] = useState<string>('')

  // Invoice creation form states
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [taxRate, setTaxRate] = useState(18)
  const [items, setItems] = useState([{ description: '', quantity: 1, rate: 0 }])
  const [notes, setNotes] = useState('')

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
    }
  }, [isClient])

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, rate: 0 }])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      [field]: field === 'description' ? value : Number(value) || 0
    }
    setItems(newItems)
  }

  const handleCreateInvoice = async (sendImmediately: boolean) => {
    if (!selectedClientId) {
      alert('Please select a client.')
      return
    }
    if (items.some(item => !item.description || item.rate <= 0)) {
      alert('Please ensure all line items have a description and rate.')
      return
    }

    const payload = {
      clientId: selectedClientId,
      projectId: selectedProjectId || undefined,
      dueDate: dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      taxRate: Number(taxRate) || 18,
      notes,
      items: items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.quantity * item.rate
      }))
    }

    try {
      const res = await api.post('/invoices', payload)
      const newInvoice = res.data
      if (sendImmediately) {
        await api.post(`/invoices/${newInvoice.id}/send`)
      }
      setShowCreate(false)
      // reset form
      setSelectedClientId('')
      setSelectedProjectId('')
      setDueDate('')
      setTaxRate(18)
      setNotes('')
      setItems([{ description: '', quantity: 1, rate: 0 }])
      fetchInvoices()
    } catch (err: any) {
      alert(err.response?.data?.error || err.message)
    }
  }

  const handleSendInvoice = (id: string) => {
    api.post(`/invoices/${id}/send`)
      .then(() => {
        fetchInvoices()
        if (selected === id) {
          setSelected(null)
        }
      })
      .catch(err => alert(err.response?.data?.error || err.message))
  }

  const handleStartPayment = async (invoice: any) => {
    try {
      setPaymentAmount(invoice.total)
      const res = await api.post('/payments/create-order', { invoiceId: invoice.id })
      setPaymentOrderId(res.data.order.id)
      setPayStep('method')
      setShowRazorpay(true)
    } catch (err: any) {
      alert(err.response?.data?.error || err.message)
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
      alert(err.response?.data?.error || err.message)
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

  const selectedInvoice = invoices.find(i => i.id === selected)

  const totals = {
    total: invoices.reduce((s, i) => s + i.total, 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0),
    outstanding: invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.total, 0),
  }

  const availableProjects = projects.filter(p => p.clientId === selectedClientId)

  const paymentMethods = [
    { id: 'upi', label: 'UPI', icon: '📱', desc: 'Google Pay, PhonePe, Paytm' },
    { id: 'card', label: 'Credit / Debit Card', icon: '💳', desc: 'Visa, Mastercard, RuPay' },
    { id: 'netbanking', label: 'Net Banking', icon: '🏦', desc: 'All major banks' },
  ]

  if (loading) {
    return (
      <Layout title="Invoices">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Invoices">
      <div className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">{invoices.length} invoices · {invoices.filter(i => i.status === 'paid').length} paid</p>
        </div>
        {!isClient && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create Invoice
          </button>
        )}
      </div>

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
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${filter === s ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
              <button className="btn-primary" onClick={() => setShowCreate(true)}>
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
                <th className="table-header text-left">Invoice</th>
                <th className="table-header text-left">Client</th>
                <th className="table-header text-left">Project</th>
                <th className="table-header text-left">Amount</th>
                <th className="table-header text-left">Status</th>
                <th className="table-header text-left">Due Date</th>
                <th className="table-header text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id} className="table-row cursor-pointer" onClick={() => setSelected(inv.id)}>
                  <td className="table-cell">
                    <p className="font-semibold text-navy-900 text-sm">{inv.invoiceNumber}</p>
                    <p className="text-xs text-slate-400">{formatDate(inv.createdAt)}</p>
                  </td>
                  <td className="table-cell text-sm text-slate-700">{inv.clientName}</td>
                  <td className="table-cell text-sm text-slate-500 max-w-[150px] truncate">{inv.projectName}</td>
                  <td className="table-cell">
                    <p className="text-sm font-bold text-navy-900">{formatCurrency(inv.total)}</p>
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

      {/* Invoice detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Invoice Details" size="lg">
        {selectedInvoice && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-navy-900">{selectedInvoice.invoiceNumber}</p>
                <p className="text-sm text-slate-500 mt-0.5">{selectedInvoice.clientName} · {selectedInvoice.projectName}</p>
              </div>
              <InvoiceStatusBadge status={selectedInvoice.status} />
            </div>

            <div className="bg-slate-50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Description</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Qty</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Rate</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items && selectedInvoice.items.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-700">{item.description}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.rate)}</td>
                      <td className="px-4 py-3 text-right font-medium text-navy-900">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>GST ({selectedInvoice.taxRate || 18}%)</span>
                  <span>{formatCurrency(selectedInvoice.tax)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-navy-900 pt-1 border-t border-slate-200">
                  <span>Total</span>
                  <span>{formatCurrency(selectedInvoice.total)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {isClient && selectedInvoice.status !== 'paid' && (
                <button className="btn-primary flex-1 justify-center" onClick={() => handleStartPayment(selectedInvoice)}><IndianRupee size={15} /> Pay Now</button>
              )}
              {!isClient && selectedInvoice.status === 'draft' && (
                <button className="btn-primary flex-1 justify-center" onClick={() => handleSendInvoice(selectedInvoice.id)}><Send size={15} /> Send Invoice</button>
              )}
              <button className="btn-secondary flex-1 justify-center" onClick={() => alert('PDF generation is simulated for this environment.')}><Download size={15} /> Download PDF</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Invoice Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Invoice" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Client *</label>
              <select className="input text-sm py-2" value={selectedClientId} onChange={e => { setSelectedClientId(e.target.value); setSelectedProjectId(''); }}>
                <option value="">Select Client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Project</label>
              <select className="input text-sm py-2" value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} disabled={!selectedClientId}>
                <option value="">Select Project (Optional)...</option>
                {availableProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Line Items</label>
            <div className="bg-slate-50 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
                <span className="col-span-6">Description</span>
                <span className="col-span-2">Qty</span>
                <span className="col-span-2">Rate (₹)</span>
                <span className="col-span-2 text-right">Amount</span>
              </div>
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="input col-span-5 py-1 text-sm"
                    placeholder="Service description"
                    value={item.description}
                    onChange={e => handleItemChange(index, 'description', e.target.value)}
                  />
                  <input
                    type="number"
                    min="1"
                    className="input col-span-2 py-1 text-sm"
                    value={item.quantity}
                    onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    className="input col-span-3 py-1 text-sm"
                    placeholder="Rate"
                    value={item.rate || ''}
                    onChange={e => handleItemChange(index, 'rate', e.target.value)}
                  />
                  <span className="col-span-1 text-sm font-semibold text-navy-900 text-right pr-1">
                    ₹{item.quantity * item.rate}
                  </span>
                  <button
                    className="col-span-1 text-slate-400 hover:text-rose-600 justify-self-end p-1"
                    onClick={() => handleRemoveItem(index)}
                    disabled={items.length === 1}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button className="text-xs text-orange-600 font-semibold mt-2 hover:underline cursor-pointer" onClick={handleAddItem}>+ Add line item</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Due Date *</label>
              <input type="date" className="input text-sm py-2" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tax Rate (%)</label>
              <input type="number" className="input text-sm py-2" placeholder="18" value={taxRate} onChange={e => setTaxRate(Number(e.target.value) || 0)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <input className="input text-sm py-2" placeholder="Payment terms, bank details, etc." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={() => handleCreateInvoice(false)}>Save as Draft</button>
            <button className="btn-primary flex-1 justify-center" onClick={() => handleCreateInvoice(true)}>
              <Send size={15} /> Create &amp; Send
            </button>
          </div>
        </div>
      </Modal>

      {/* Razorpay Simulation Modal */}
      <Modal open={showRazorpay} onClose={() => { setShowRazorpay(false); setPayStep('method'); }} title="Simulate Payment" size="sm">
        {payStep === 'method' && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-navy-900">{formatCurrency(paymentAmount)}</p>
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
              Pay {formatCurrency(paymentAmount)}
            </button>
          </div>
        )}

        {payStep === 'processing' && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center animate-pulse bg-orange-100">
              <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
            </div>
            <p className="font-semibold text-sm text-navy-900 mb-0.5">Processing payment...</p>
            <p className="text-xs text-slate-500">Communicating with Razorpay servers.</p>
          </div>
        )}

        {payStep === 'success' && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-emerald-100">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-navy-900 mb-0.5">Payment Successful!</p>
            <p className="text-xs text-slate-500 mb-4">{formatCurrency(paymentAmount)} received successfully.</p>
            <button
              className="btn-primary justify-center w-full"
              onClick={() => { setShowRazorpay(false); setPayStep('method'); setSelected(null); }}
            >
              Close
            </button>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
