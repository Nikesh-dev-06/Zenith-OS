import { useState, useEffect } from 'react'
import {
  CreditCard, Smartphone, Building2, CheckCircle,
  IndianRupee, XCircle, AlertCircle, Receipt, ArrowRight, Wallet
} from 'lucide-react'
import { Layout } from '../../components/layout/Layout'
import { Modal, EmptyState, Skeleton } from '../../components/ui/index'
import { formatCurrency, formatDate } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useLanguage } from '../../context/LanguageContext'
import api from '../../lib/api'

declare global {
  interface Window {
    paypal?: any
  }
}

export default function PortalPaymentsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { t } = useLanguage()
  const isViewer = user?.role === 'client_viewer'

  const [payments, setPayments] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Payment checkout states
  const [showPayModal, setShowPayModal] = useState(false)
  const [payStep, setPayStep] = useState<'method' | 'processing' | 'success'>('method')
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [paymentOrderId, setPaymentOrderId] = useState<string>('')
  const [paypalLoaded, setPaypalLoaded] = useState(false)

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
      console.error('Failed to load portal payments data', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // PayPal SDK Loading Hook
  useEffect(() => {
    if (showPayModal && selectedMethod === 'paypal' && selectedInvoice && import.meta.env.VITE_PAYPAL_CLIENT_ID) {
      if (window.paypal) {
        setPaypalLoaded(true)
        return
      }

      const script = document.createElement('script')
      const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID
      const currency = selectedInvoice.currency || 'USD'
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}`
      script.async = true
      script.onload = () => {
        setPaypalLoaded(true)
      }
      script.onerror = () => {
        toast.error('Failed to load PayPal SDK script')
      }
      document.body.appendChild(script)

      return () => {
        // cleanup script if needed
      }
    } else {
      setPaypalLoaded(false)
    }
  }, [showPayModal, selectedMethod, selectedInvoice])

  // PayPal Smart Buttons Renderer
  useEffect(() => {
    if (paypalLoaded && selectedMethod === 'paypal' && window.paypal && selectedInvoice) {
      const container = document.getElementById('paypal-button-container')
      if (container) {
        container.innerHTML = ''
      }

      window.paypal.Buttons({
        createOrder: async () => {
          try {
            const res = await api.post('/payments/paypal/create-order', {
              invoiceId: selectedInvoice.id
            })
            // Capture order ID to mark failed if cancelled
            setPaymentOrderId(res.data.order.id)
            return res.data.order.id
          } catch (err: any) {
            console.error('PayPal create order failed:', err)
            toast.error('PayPal Order initialization failed')
            throw err
          }
        },
        onApprove: async (data: any) => {
          setPayStep('processing')
          try {
            await api.post('/payments/paypal/capture-order', {
              paypalOrderId: data.orderID,
              invoiceId: selectedInvoice.id,
              isMock: false
            })
            setPayStep('success')
            fetchData()
          } catch (err: any) {
            console.error('PayPal capture payment failed:', err)
            toast.error(err.response?.data?.error || err.message)
            setPayStep('method')
          }
        },
        onCancel: async (data: any) => {
          toast.warning('Payment was cancelled')
          try {
            await api.post('/payments/mark-failed', { orderId: data.orderID || paymentOrderId })
            fetchData()
          } catch (err) {
            console.error(err)
          }
        },
        onError: async (err: any) => {
          console.error('PayPal smart buttons error:', err)
          toast.error('PayPal transaction encountered an error')
          try {
            if (paymentOrderId) {
              await api.post('/payments/mark-failed', { orderId: paymentOrderId })
              fetchData()
            }
          } catch (e) {
            console.error(e)
          }
        }
      }).render('#paypal-button-container')
    }
  }, [paypalLoaded, selectedMethod, selectedInvoice])

  const handleStartPayment = async (inv: any) => {
    if (isViewer) return
    try {
      setSelectedInvoice(inv)
      const res = await api.post('/payments/create-order', { invoiceId: inv.id })
      setPaymentOrderId(res.data.order.id)
      setPayStep('method')
      setShowPayModal(true)
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const handleVerifyPayment = async () => {
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

  // Segment payments
  const successfulPayments = payments.filter(p => p.status === 'success')
  const pendingPayments = payments.filter(p => p.status === 'pending')
  const failedPayments = payments.filter(p => p.status === 'failed')

  const totalPaid = successfulPayments.reduce((s, p) => s + p.amount, 0)
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid')
  const totalOutstanding = unpaidInvoices.reduce((s, i) => s + i.total, 0)

  const paymentMethods = selectedInvoice?.currency && selectedInvoice.currency !== 'INR'
    ? [
        { id: 'paypal', label: t('paypalCheckout') || 'PayPal Checkout', icon: '🅿️', desc: t('paypalDesc') || 'Pay securely using PayPal or Card' },
      ]
    : [
        { id: 'upi', label: 'UPI', icon: '📱', desc: t('upiDesc') || 'Instant transfer via BHIM/GPay/PhonePe' },
        { id: 'card', label: t('creditDebitCard') || 'Credit / Debit Card', icon: '💳', desc: t('cardDesc') || 'Visa, Mastercard, RuPay' },
        { id: 'netbanking', label: t('netBanking') || 'Net Banking', icon: '🏦', desc: t('netbankingDesc') || 'Transfer from popular Indian banks' },
      ]

  return (
    <Layout title={t('payments') || 'Payments'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 dark:text-white tracking-tight">{t('payments') || 'Payments'}</h1>
          <p className="text-slate-500 text-sm mt-1">Manage payment history, pending bills, and verify transaction statuses.</p>
        </div>
      </div>

      {/* Stats Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card p-5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
          <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-450 tracking-wider">Total Settled</span>
          <p className="text-2xl font-black text-emerald-950 dark:text-emerald-200 mt-2">{formatCurrency(totalPaid)}</p>
          <p className="text-[10px] text-emerald-650 dark:text-emerald-500 mt-1.5">{successfulPayments.length} successful transactions</p>
        </div>
        <div className="card p-5 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10 border border-orange-100 dark:border-orange-900/30">
          <span className="text-[10px] uppercase font-bold text-orange-700 dark:text-orange-450 tracking-wider">Awaiting Payment</span>
          <p className="text-2xl font-black text-orange-900 dark:text-orange-200 mt-2">{formatCurrency(totalOutstanding)}</p>
          <p className="text-[10px] text-orange-650 dark:text-orange-500 mt-1.5">{unpaidInvoices.length} unpaid invoices</p>
        </div>
        <div className="card p-5 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border border-amber-100 dark:border-amber-900/30">
          <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-450 tracking-wider">Pending Processes</span>
          <p className="text-2xl font-black text-amber-950 dark:text-amber-200 mt-2">{pendingPayments.length}</p>
          <p className="text-[10px] text-amber-650 dark:text-amber-500 mt-1.5">Transactions initiated</p>
        </div>
        <div className="card p-5 bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/20 dark:to-rose-900/10 border border-rose-100 dark:border-rose-900/30">
          <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-450 tracking-wider">Failed Checkout Attempt</span>
          <p className="text-2xl font-black text-rose-950 dark:text-rose-200 mt-2">{failedPayments.length}</p>
          <p className="text-[10px] text-rose-650 dark:text-rose-500 mt-1.5">Transactions rejected/cancelled</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-60 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Outstanding Bills list */}
          <div>
            <h2 className="text-sm font-bold text-navy-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Receipt size={16} className="text-orange-500" /> Outstanding Bills
            </h2>
            {unpaidInvoices.length === 0 ? (
              <div className="card p-8 text-center text-slate-400 text-sm dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800">
                All invoices have been paid! No outstanding balance due.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {unpaidInvoices.map(inv => (
                  <div key={inv.id} className="card p-5 flex items-center justify-between border border-slate-100 dark:border-slate-800/80 hover:shadow-sm transition-shadow">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-navy-900 dark:text-white">{inv.invoiceNumber}</span>
                        {inv.status === 'overdue' && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 dark:bg-rose-950/30 dark:text-rose-450 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900/30">Overdue</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-405 mt-1 font-medium">{inv.projectName || 'Standalone Agreement'}</p>
                      <p className="text-[11px] text-slate-405 dark:text-slate-500 mt-2">Due on {formatDate(inv.dueDate)}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2.5">
                      <p className="text-lg font-black text-navy-900 dark:text-white">{formatCurrency(inv.total, inv.currency)}</p>
                      <button
                        className="btn-primary text-xs py-1.5 px-3.5 cursor-pointer flex items-center gap-1 shadow-sm disabled:opacity-50"
                        disabled={isViewer}
                        onClick={() => handleStartPayment(inv)}
                      >
                        Pay Now <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payments transaction list */}
          <div>
            <h2 className="text-sm font-bold text-navy-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Wallet size={16} className="text-orange-500" /> Transaction History
            </h2>
            {payments.length === 0 ? (
              <EmptyState
                title="No Payments Recorded"
                description="Your past successful, pending, or failed transaction attempts will appear here."
                icon={<CreditCard size={48} />}
              />
            ) : (
              <div className="card overflow-hidden border border-slate-100 dark:border-slate-800/80">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-150 dark:border-slate-800/80">
                      <tr>
                        <th className="table-header text-left pl-6">Transaction ID</th>
                        <th className="table-header text-left">Invoice</th>
                        <th className="table-header text-left">Method</th>
                        <th className="table-header text-left">Amount</th>
                        <th className="table-header text-left">Date</th>
                        <th className="table-header text-left pr-6">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(payment => (
                        <tr key={payment.id} className="table-row border-b border-slate-100 dark:border-slate-800/30 last:border-none">
                          <td className="table-cell pl-6">
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 font-bold">{payment.transactionId || payment.id.substring(0, 12)}</span>
                          </td>
                          <td className="table-cell">
                            <span className="text-sm font-semibold text-navy-900 dark:text-white">{payment.invoiceNumber}</span>
                          </td>
                          <td className="table-cell">
                            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{payment.method}</span>
                          </td>
                          <td className="table-cell">
                            <span className="text-sm font-bold text-navy-900 dark:text-white">{formatCurrency(payment.amount, payment.currency)}</span>
                          </td>
                          <td className="table-cell">
                            <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(payment.paidAt || payment.createdAt)}</span>
                          </td>
                          <td className="table-cell pr-6">
                            {payment.status === 'success' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-450 border border-emerald-200 dark:border-emerald-900/30">
                                <CheckCircle size={10} /> Paid
                              </span>
                            )}
                            {payment.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/20 text-amber-800 dark:text-amber-450 border border-amber-200 dark:border-amber-900/30 animate-pulse">
                                <AlertCircle size={10} /> Pending
                              </span>
                            )}
                            {payment.status === 'failed' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/20 text-rose-800 dark:text-rose-455 border border-rose-200 dark:border-rose-900/30">
                                <XCircle size={10} /> Failed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      <Modal open={showPayModal} onClose={() => { setShowPayModal(false); setPayStep('method'); setSelectedMethod(''); setPaypalLoaded(false); }} title={t('simulatePayment') || 'Complete Invoice Payment'} size="sm">
        {payStep === 'method' && selectedInvoice && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 text-center border border-slate-100 dark:border-slate-800/80">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('totalAmount') || 'Total Amount'}</p>
              <p className="text-2xl font-bold text-navy-900 dark:text-white">{formatCurrency(selectedInvoice.total, selectedInvoice.currency)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{selectedInvoice.invoiceNumber} · {paymentOrderId}</p>
            </div>

            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('choosePaymentMethod') || 'Choose Payment Method'}</p>

            <div className="space-y-2">
              {paymentMethods.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMethod(m.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer
                    ${selectedMethod === m.id ? 'border-orange-400 bg-orange-50/50 dark:bg-orange-950/10' : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700'}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm flex-shrink-0">
                    {m.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-navy-900 dark:text-white">{m.label}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{m.desc}</p>
                  </div>
                  {selectedMethod === m.id && (
                    <CheckCircle size={14} className="ml-auto text-orange-500" />
                  )}
                </button>
              ))}
            </div>

            {selectedMethod === 'paypal' && !import.meta.env.VITE_PAYPAL_CLIENT_ID ? (
              <button
                className="btn-primary w-full justify-center py-2.5 mt-2 cursor-pointer bg-blue-600 hover:bg-blue-700 border-none text-white"
                onClick={async () => {
                  setPayStep('processing')
                  setTimeout(async () => {
                    try {
                      await api.post('/payments/paypal/capture-order', {
                        paypalOrderId: paymentOrderId,
                        invoiceId: selectedInvoice.id,
                        isMock: true
                      })
                      setPayStep('success')
                      fetchData()
                    } catch (err: any) {
                      toast.error(err.response?.data?.error || err.message)
                      setPayStep('method')
                    }
                  }, 1500)
                }}
              >
                Simulate PayPal Sandbox Payment
              </button>
            ) : selectedMethod === 'paypal' ? (
              <div className="mt-4 min-h-[50px]">
                {!paypalLoaded && (
                  <div className="text-center text-xs text-slate-500 py-3 animate-pulse">Loading PayPal Checkout...</div>
                )}
                <div id="paypal-button-container" className="w-full animate-fadeIn" />
              </div>
            ) : (
              <button
                className="btn-primary w-full justify-center py-2.5 mt-2 cursor-pointer"
                disabled={!selectedMethod}
                onClick={handleVerifyPayment}
              >
                {t('pay') || 'Pay'} {formatCurrency(selectedInvoice.total, selectedInvoice.currency)}
              </button>
            )}
          </div>
        )}

        {payStep === 'processing' && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center animate-pulse bg-orange-100 dark:bg-orange-950/20">
              <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
            </div>
            <p className="font-semibold text-sm text-navy-900 dark:text-white mb-0.5">{t('processingPayment') || 'Processing Payment...'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-450">{t('paymentProcessingDesc') || 'Please do not reload the page or navigate away.'}</p>
          </div>
        )}

        {payStep === 'success' && selectedInvoice && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-emerald-100 dark:bg-emerald-950/20">
              <CheckCircle size={24} className="text-emerald-600 dark:text-emerald-450" />
            </div>
            <p className="text-lg font-bold text-navy-900 dark:text-white mb-0.5">{t('paymentSuccessful') || 'Payment Successful'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{formatCurrency(selectedInvoice.total, selectedInvoice.currency)} {t('paymentReceivedSuccess') || 'has been settled successfully.'}</p>
            <button
              className="btn-primary justify-center w-full cursor-pointer"
              onClick={() => { setShowPayModal(false); setPayStep('method'); setSelectedInvoice(null); }}
            >
              {t('close') || 'Close'}
            </button>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
