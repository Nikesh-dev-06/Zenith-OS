import { useState, useEffect } from 'react'
import { CreditCard, Smartphone, Building2, CheckCircle, IndianRupee, XCircle, AlertCircle } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Avatar, Modal } from '../components/ui/index'
import { formatCurrency, formatDate } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import api from '../lib/api'

export default function PaymentsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const isAdmin = user?.role === 'super_admin'

  const [payments, setPayments] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [showRazorpay, setShowRazorpay] = useState(false)
  const [payStep, setPayStep] = useState<'method' | 'processing' | 'success'>('method')
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  
  // Payment target states
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [paymentOrderId, setPaymentOrderId] = useState<string>('')

  const fetchData = async () => {
    try {
      setLoading(true)
      const [paymentsRes, invoicesRes] = await Promise.all([
        api.get('/payments'),
        api.get('/invoices?limit=100')
      ])
      setPayments(paymentsRes.data || [])
      setInvoices(invoicesRes.data.invoices || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const totalCollected = payments.reduce((s, p) => s + p.amount, 0)
  const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue')
  const overdueInvoices = invoices.filter(i => i.status === 'overdue')

  const handleStartPayment = async (inv: any) => {
    try {
      setSelectedInvoice(inv)
      const res = await api.post('/payments/create-order', { invoiceId: inv.id })
      setPaymentOrderId(res.data.order.id)
      setPayStep('method')
      setShowRazorpay(true)
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const handlePay = async () => {
    if (!selectedMethod || !selectedInvoice) return
    setPayStep('processing')
    try {
      await api.post('/payments/verify', {
        razorpayOrderId: paymentOrderId,
        razorpayPaymentId: `pay_${Math.random().toString(36).substring(2, 11)}`,
        razorpaySignature: 'mock_signature',
        invoiceId: selectedInvoice.id
      })
      setTimeout(() => {
        setPayStep('success')
        fetchData()
      }, 1500)
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
      setPayStep('method')
    }
  }

  const methods = [
    { id: 'upi', label: 'UPI', icon: <Smartphone size={18} />, desc: 'Google Pay, PhonePe, Paytm' },
    { id: 'card', label: 'Credit / Debit Card', icon: <CreditCard size={18} />, desc: 'Visa, Mastercard, RuPay' },
    { id: 'netbanking', label: 'Net Banking', icon: <Building2 size={18} />, desc: 'All major banks' },
  ]

  if (loading) {
    return (
      <Layout title="Payments">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Payments">
      <div className="page-header">
        <h1 className="page-title">Payments</h1>
        <p className="page-subtitle">{payments.length} transactions recorded</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-5 text-center">
          <p className="text-xs text-slate-500 mb-1">Total Collected</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalCollected)}</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-xs text-slate-500 mb-1">Pending Invoices</p>
          <p className="text-2xl font-bold text-amber-600">
            {formatCurrency(pendingInvoices.reduce((s, i) => s + i.total, 0))}
          </p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-xs text-slate-500 mb-1">Overdue</p>
          <p className="text-2xl font-bold text-rose-600">
            {formatCurrency(overdueInvoices.reduce((s, i) => s + i.total, 0))}
          </p>
        </div>
      </div>

      {/* Pending Invoices - Pay Now section */}
      {pendingInvoices.length > 0 && (
        <div className="mb-8">
          <h2 className="section-title mb-4">Awaiting Payment</h2>
          <div className="space-y-3">
            {pendingInvoices.map(inv => (
              <div key={inv.id} className="card p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm text-navy-900">{inv.invoiceNumber}</p>
                    {inv.status === 'overdue' && (
                      <span className="text-xs text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded-full">Overdue</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{inv.clientName} · Due {formatDate(inv.dueDate)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-lg font-bold text-navy-900">{formatCurrency(inv.total)}</p>
                  {!isAdmin && (
                    <button
                      className="btn-primary py-2"
                      onClick={() => handleStartPayment(inv)}
                    >
                      <IndianRupee size={14} /> Pay Now
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div>
        <h2 className="section-title mb-4">Transaction History</h2>
        {payments.length === 0 ? (
          <div className="card p-8 text-center text-slate-400 text-sm">No transactions yet.</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="table-header text-left">Transaction</th>
                  <th className="table-header text-left">Client</th>
                  <th className="table-header text-left">Invoice</th>
                  <th className="table-header text-left">Method</th>
                  <th className="table-header text-left">Amount</th>
                  <th className="table-header text-left">Date</th>
                  <th className="table-header text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(payment => (
                  <tr key={payment.id} className="table-row">
                    <td className="table-cell">
                      <p className="text-xs font-mono text-slate-500">{payment.transactionId}</p>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar name={payment.clientName} size="sm" />
                        <span className="text-sm text-slate-700">{payment.clientName}</span>
                      </div>
                    </td>
                    <td className="table-cell text-sm text-slate-600">{payment.invoiceNumber}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        {payment.method === 'UPI' && <Smartphone size={13} className="text-slate-400" />}
                        {payment.method === 'Bank Transfer' && <Building2 size={13} className="text-slate-400" />}
                        {payment.method === 'Card' && <CreditCard size={13} className="text-slate-400" />}
                        {payment.method === 'Razorpay' && <CreditCard size={13} className="text-slate-400" />}
                        {payment.method}
                      </div>
                    </td>
                    <td className="table-cell">
                      <p className="text-sm font-bold text-emerald-600">{formatCurrency(payment.amount)}</p>
                    </td>
                    <td className="table-cell text-sm text-slate-500">{formatDate(payment.paidAt)}</td>
                    <td className="table-cell">
                      {payment.status === 'success' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle size={11} /> Paid
                        </span>
                      )}
                      {payment.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertCircle size={11} /> Pending
                        </span>
                      )}
                      {payment.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle size={11} /> Failed
                        </span>
                      )}
                      {payment.status === 'partial' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                          <AlertCircle size={11} /> Partial
                        </span>
                      )}
                      {!['success', 'pending', 'failed', 'partial'].includes(payment.status) && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200">
                          {payment.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Razorpay Payment Modal */}
      <Modal open={showRazorpay} onClose={() => { setShowRazorpay(false); setPayStep('method') }} title="Complete Payment" size="sm">
        {payStep === 'method' && selectedInvoice && (
          <div className="space-y-4">
            {/* Razorpay branding */}
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Paying</p>
              <p className="text-2xl font-bold text-navy-900">{formatCurrency(selectedInvoice.total)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{selectedInvoice.invoiceNumber} · {selectedInvoice.clientName}</p>
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Choose payment method</p>

            <div className="space-y-2">
              {methods.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMethod(m.id)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer
                    ${selectedMethod === m.id
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-slate-200 hover:border-slate-300'
                    }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                    ${selectedMethod === m.id ? 'text-orange-600' : 'text-slate-500'}`}
                    style={selectedMethod === m.id ? { background: 'rgba(244,81,30,0.1)' } : { background: '#f1f5f9' }}
                  >
                    {m.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{m.label}</p>
                    <p className="text-xs text-slate-400">{m.desc}</p>
                  </div>
                  {selectedMethod === m.id && (
                    <CheckCircle size={16} className="ml-auto text-orange-500" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="#94a3b8" strokeWidth="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#94a3b8" strokeWidth="2"/>
              </svg>
              Secured by Razorpay (Mock Mode)
            </div>

            <button
              className="btn-primary w-full justify-center py-3 cursor-pointer"
              disabled={!selectedMethod}
              onClick={handlePay}
            >
              Pay {formatCurrency(selectedInvoice.total)}
            </button>
          </div>
        )}

        {payStep === 'processing' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse"
              style={{ background: 'linear-gradient(135deg, rgba(244,81,30,0.15), rgba(255,140,66,0.15))' }}>
              <div className="w-8 h-8 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
            </div>
            <p className="font-semibold text-navy-900 mb-1">Processing payment...</p>
            <p className="text-sm text-slate-500">Please wait, do not close this window.</p>
          </div>
        )}

        {payStep === 'success' && selectedInvoice && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
              <CheckCircle size={32} className="text-white" />
            </div>
            <p className="text-xl font-bold text-navy-900 mb-1">Payment Successful!</p>
            <p className="text-sm text-slate-500 mb-1">{formatCurrency(selectedInvoice.total)} received</p>
            <p className="text-xs text-slate-400 mb-6">A mock receipt has been generated.</p>
            <button
              className="btn-primary justify-center w-full cursor-pointer"
              onClick={() => { setShowRazorpay(false); setPayStep('method'); setSelectedInvoice(null); }}
            >
              Done
            </button>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
