import { useState, useEffect } from 'react'
import { Receipt, Download, Eye, IndianRupee, CheckCircle, Clock } from 'lucide-react'
import { Layout } from '../../components/layout/Layout'
import { Modal, InvoiceStatusBadge, EmptyState } from '../../components/ui/index'
import { formatCurrency, formatDate } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useLanguage } from '../../context/LanguageContext'
import api from '../../lib/api'

declare global {
  interface Window {
    paypal?: any;
  }
}

export default function PortalInvoicesPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const isViewer = user?.role === 'client_viewer'
  const toast = useToast()

  const [invoices, setInvoices] = useState<any[]>([])
  const [clientDetails, setClientDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Razorpay payment states
  const [showRazorpay, setShowRazorpay] = useState(false)
  const [payStep, setPayStep] = useState<'method' | 'processing' | 'success'>('method')
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<any>(null)
  const [paymentOrderId, setPaymentOrderId] = useState<string>('')
  const [paypalLoaded, setPaypalLoaded] = useState(false)

  // Effect to load PayPal SDK script dynamically
  useEffect(() => {
    if (showRazorpay && selectedMethod === 'paypal' && selectedInvoice && import.meta.env.VITE_PAYPAL_CLIENT_ID) {
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
        // clean up script
      }
    } else {
      setPaypalLoaded(false)
    }
  }, [showRazorpay, selectedMethod, selectedInvoice])

  // Effect to render PayPal smart buttons
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
        onError: (err: any) => {
          console.error('PayPal smart buttons error:', err)
          toast.error('PayPal transaction encountered an error')
        }
      }).render('#paypal-button-container')
    }
  }, [paypalLoaded, selectedMethod, selectedInvoice])

  const fetchData = async () => {
    if (!user?.clientId) return
    try {
      setLoading(true)
      const [invRes, clientRes] = await Promise.all([
        api.get('/invoices?limit=100'),
        api.get(`/clients/${user.clientId}`)
      ])
      setInvoices(invRes.data.invoices || [])
      setClientDetails(clientRes.data)
    } catch (err) {
      console.error('Failed to load invoices', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [user])

  const handleStartPayment = async (inv: any) => {
    if (isViewer) return
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

  const paymentMethods = selectedInvoice?.currency && selectedInvoice.currency !== 'INR'
    ? [
        { id: 'stripe', label: t('stripeCardCheckout'), icon: '💳', desc: t('stripeDesc') },
        { id: 'paypal', label: t('paypalCheckout'), icon: '🅿️', desc: t('paypalDesc') },
        { id: 'wise', label: t('wiseTransfer'), icon: '🏦', desc: t('wiseDesc') }
      ]
    : [
        { id: 'upi', label: 'UPI', icon: '📱', desc: t('upiDesc') },
        { id: 'card', label: t('creditDebitCard'), icon: '💳', desc: t('cardDesc') },
        { id: 'netbanking', label: t('netBanking'), icon: '🏦', desc: t('netbankingDesc') },
      ]

  const totalOutstanding = invoices
    .filter(i => i.status !== 'paid')
    .reduce((sum, inv) => sum + inv.total, 0)

  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0)

  return (
    <Layout title={t('invoices')}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">{t('invoices')}</h1>
          <p className="text-slate-500 text-sm mt-1">Review billing invoices, make online payments, and view transaction history.</p>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card p-5 bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-100">
          <span className="text-[10px] uppercase font-bold text-orange-700 tracking-wider">Total Outstanding</span>
          <p className="text-2xl font-black text-orange-900 mt-2">{formatCurrency(totalOutstanding)}</p>
          <p className="text-[10px] text-orange-650 mt-1.5">{invoices.filter(i => i.status !== 'paid').length} unpaid bills pending</p>
        </div>
        <div className="card p-5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-100">
          <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Total Paid</span>
          <p className="text-2xl font-black text-emerald-950 mt-2">{formatCurrency(totalPaid)}</p>
          <p className="text-[10px] text-emerald-650 mt-1.5">{invoices.filter(i => i.status === 'paid').length} invoices settled successfully</p>
        </div>
        <div className="card p-5 bg-slate-50 border border-slate-100 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Payment Status</span>
          <div className="flex gap-2.5 mt-2.5">
            <span className="text-xs font-semibold text-slate-700">Total Billed: <span className="font-bold">{formatCurrency(totalOutstanding + totalPaid)}</span></span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No Invoices Mapped"
          description="Invoices issued by the agency to your account will show here."
          icon={<Receipt size={48} />}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-header text-left pl-6">{t('invoice')}</th>
                <th className="table-header text-left">{t('project')}</th>
                <th className="table-header text-left">{t('amount')}</th>
                <th className="table-header text-left">{t('dueDate')}</th>
                <th className="table-header text-left">{t('status')}</th>
                <th className="table-header text-right pr-6">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="table-row border-b border-slate-100 last:border-none">
                  <td className="table-cell pl-6 font-semibold text-sm text-navy-900">{inv.invoiceNumber}</td>
                  <td className="table-cell text-sm text-slate-500 max-w-[150px] truncate">{inv.projectName || 'Standalone Billing'}</td>
                  <td className="table-cell text-sm font-bold text-navy-900">{formatCurrency(inv.total, inv.currency)}</td>
                  <td className="table-cell text-sm text-slate-500">{formatDate(inv.dueDate)}</td>
                  <td className="table-cell"><InvoiceStatusBadge status={inv.status} /></td>
                  <td className="table-cell text-right pr-6">
                    <div className="flex justify-end items-center gap-1.5">
                      <button
                        className="btn-ghost p-1.5 text-slate-400 hover:text-navy-900 cursor-pointer"
                        title={t('view')}
                        onClick={() => setSelectedInvoiceForModal(inv)}
                      >
                        <Eye size={14} />
                      </button>
                      {inv.status !== 'paid' ? (
                        <button
                          className="btn-primary text-xs py-1.5 px-3 cursor-pointer disabled:opacity-50"
                          disabled={isViewer}
                          onClick={() => handleStartPayment(inv)}
                        >
                          {t('payNow')}
                        </button>
                      ) : (
                        <button
                          className="btn-ghost text-xs py-1.5 px-2 text-slate-500 cursor-pointer"
                          onClick={() => toast.info(t('pdfSimulated'))}
                        >
                          <Download size={12} /> {t('receipt')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Razorpay Simulation Modal */}
      <Modal open={showRazorpay} onClose={() => { setShowRazorpay(false); setPayStep('method'); setSelectedMethod(''); setPaypalLoaded(false); }} title={t('simulatePayment')} size="sm">
        {payStep === 'method' && selectedInvoice && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">{t('totalAmount')}</p>
              <p className="text-2xl font-bold text-navy-900">{formatCurrency(selectedInvoice.total, selectedInvoice.currency)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t('orderId')}: {paymentOrderId}</p>
            </div>

            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('choosePaymentMethod')}</p>

            <div className="space-y-2">
              {paymentMethods.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMethod(m.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer
                    ${selectedMethod === m.id ? 'border-orange-400 bg-orange-50/50' : 'border-slate-200 hover:border-slate-350'}`}
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

            {selectedMethod === 'paypal' && !import.meta.env.VITE_PAYPAL_CLIENT_ID ? (
              <button
                className="btn-primary w-full justify-center py-2.5 mt-2 cursor-pointer bg-blue-600 hover:bg-blue-700"
                onClick={async () => {
                  setPayStep('processing');
                  setTimeout(async () => {
                    try {
                      await api.post('/payments/paypal/capture-order', {
                        paypalOrderId: `pp_order_mock_${Date.now()}`,
                        invoiceId: selectedInvoice.id,
                        isMock: true
                      });
                      setPayStep('success');
                      fetchData();
                    } catch (err: any) {
                      toast.error(err.response?.data?.error || err.message);
                      setPayStep('method');
                    }
                  }, 1500);
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
                {t('pay')} {formatCurrency(selectedInvoice.total, selectedInvoice.currency)}
              </button>
            )}
          </div>
        )}

        {payStep === 'processing' && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center animate-pulse bg-orange-100">
              <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
            </div>
            <p className="font-semibold text-sm text-navy-900 mb-0.5">{t('processingPayment')}</p>
            <p className="text-xs text-slate-500">{t('paymentProcessingDesc')}</p>
          </div>
        )}

        {payStep === 'success' && selectedInvoice && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-emerald-100">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-navy-900 mb-0.5">{t('paymentSuccessful')}</p>
            <p className="text-xs text-slate-500 mb-4">{formatCurrency(selectedInvoice.total, selectedInvoice.currency)} {t('paymentReceivedSuccess')}</p>
            <button
              className="btn-primary justify-center w-full cursor-pointer"
              onClick={() => { setShowRazorpay(false); setPayStep('method'); setSelectedInvoice(null); }}
            >
              {t('close')}
            </button>
          </div>
        )}
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal open={!!selectedInvoiceForModal} onClose={() => setSelectedInvoiceForModal(null)} title={t('invoiceDetails')} size="lg">
        {selectedInvoiceForModal && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-navy-900">{selectedInvoiceForModal.invoiceNumber}</p>
                <p className="text-sm text-slate-500 mt-0.5">{selectedInvoiceForModal.projectName || 'Standalone Agreement'}</p>
                {clientDetails && (
                  <div className="text-xs text-slate-400 mt-2 space-y-0.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100/50 w-fit">
                    {clientDetails.companyName && <p><span className="font-semibold text-slate-500">{t('client')}:</span> {clientDetails.companyName}</p>}
                    {clientDetails.address && <p><span className="font-semibold text-slate-500">{t('address')}:</span> {clientDetails.address}</p>}
                    {clientDetails.phone && <p><span className="font-semibold text-slate-500">{t('phone')}:</span> {clientDetails.phone}</p>}
                    {clientDetails.gstin && <p><span className="font-semibold text-slate-500">{t('gstin')}:</span> {clientDetails.gstin}</p>}
                    {clientDetails.pan && <p><span className="font-semibold text-slate-500">{t('pan')}:</span> {clientDetails.pan}</p>}
                    {selectedInvoiceForModal.placeOfSupply && <p><span className="font-semibold text-slate-500">{t('placeOfSupply')}:</span> {selectedInvoiceForModal.placeOfSupply}</p>}
                  </div>
                )}
              </div>
              <InvoiceStatusBadge status={selectedInvoiceForModal.status} />
            </div>

            <div className="bg-slate-50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">{t('description')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">HSN/SAC</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{t('qty')}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{t('rate')}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{t('amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoiceForModal.items && selectedInvoiceForModal.items.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-700">{item.description}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{item.hsnCode || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.rate, selectedInvoiceForModal.currency)}</td>
                      <td className="px-4 py-3 text-right font-medium text-navy-900">{formatCurrency(item.amount, selectedInvoiceForModal.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="px-4 py-3 space-y-1.5 font-medium border-t border-slate-200 text-xs">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>{t('subtotal')}</span>
                  <span>{formatCurrency(selectedInvoiceForModal.subtotal, selectedInvoiceForModal.currency)}</span>
                </div>
                {selectedInvoiceForModal.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>{t('discount')} ({selectedInvoiceForModal.discountType === 'percent' ? `${selectedInvoiceForModal.discountValue}%` : t('flat')})</span>
                    <span>-{formatCurrency(selectedInvoiceForModal.discount, selectedInvoiceForModal.currency)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Taxable Value</span>
                  <span>{formatCurrency(selectedInvoiceForModal.subtotal - selectedInvoiceForModal.discount, selectedInvoiceForModal.currency)}</span>
                </div>

                {selectedInvoiceForModal.isExport ? (
                  <div className="bg-emerald-50 text-emerald-800 p-2 rounded-lg text-[10px] leading-snug">
                    Export Under Bond/LUT (LUT-0% Tax Rate)
                  </div>
                ) : (
                  <>
                    {selectedInvoiceForModal.isIntrastate !== false ? (
                      <>
                        <div className="flex justify-between text-slate-500 pl-2">
                          <span>{t('cgst')} ({(selectedInvoiceForModal.taxRate || 18) / 2}%)</span>
                          <span>{formatCurrency(selectedInvoiceForModal.cgst || Math.round((selectedInvoiceForModal.subtotal - selectedInvoiceForModal.discount) * ((selectedInvoiceForModal.taxRate || 18) / 2) / 100), selectedInvoiceForModal.currency)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 pl-2">
                          <span>{t('sgst')} ({(selectedInvoiceForModal.taxRate || 18) / 2}%)</span>
                          <span>{formatCurrency(selectedInvoiceForModal.sgst || Math.round((selectedInvoiceForModal.subtotal - selectedInvoiceForModal.discount) * ((selectedInvoiceForModal.taxRate || 18) / 2) / 100), selectedInvoiceForModal.currency)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-slate-500 pl-2">
                        <span>{t('igst')} ({selectedInvoiceForModal.taxRate || 18}%)</span>
                        <span>{formatCurrency(selectedInvoiceForModal.igst || Math.round((selectedInvoiceForModal.subtotal - selectedInvoiceForModal.discount) * (selectedInvoiceForModal.taxRate || 18) / 100), selectedInvoiceForModal.currency)}</span>
                      </div>
                    )}
                    {selectedInvoiceForModal.rcm && (
                      <div className="bg-amber-50 text-amber-800 p-2 rounded-lg text-[10px] leading-snug">
                        ⚠️ Reverse Charge Mechanism Applies
                      </div>
                    )}
                  </>
                )}

                {selectedInvoiceForModal.roundingAdjustment ? (
                  <div className="flex justify-between text-slate-400 font-mono text-[11px]">
                    <span>Rounding Off Adjustment</span>
                    <span>{selectedInvoiceForModal.roundingAdjustment > 0 ? '+' : ''}{formatCurrency(selectedInvoiceForModal.roundingAdjustment, selectedInvoiceForModal.currency)}</span>
                  </div>
                ) : null}

                <div className="flex justify-between text-base font-bold text-navy-900 pt-1.5 border-t border-slate-200">
                  <span>{selectedInvoiceForModal.rcm ? 'Total (Excl GST)' : 'Total Invoice Value'}</span>
                  <span>{formatCurrency(selectedInvoiceForModal.total, selectedInvoiceForModal.currency)}</span>
                </div>

                {((selectedInvoiceForModal.tdsAmount || 0) > 0) && (
                  <>
                    <div className="flex justify-between text-rose-600 font-medium pt-1.5 border-t border-dashed border-slate-200">
                      <span>TDS Withheld (@ {selectedInvoiceForModal.tdsRate}%)</span>
                      <span>-{formatCurrency(selectedInvoiceForModal.tdsAmount, selectedInvoiceForModal.currency)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-emerald-600 pt-1.5 border-t border-slate-200">
                      <span>Net Payable Due</span>
                      <span>{formatCurrency(selectedInvoiceForModal.total - selectedInvoiceForModal.tdsAmount, selectedInvoiceForModal.currency)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bank details & UPI QR Code scan block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2.5">{t('bankTransferDetails')}</h4>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">{t('accountHolder')}</span> {selectedInvoiceForModal.bankDetails?.accountHolder || 'Zenith OS Agency'}</p>
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">{t('bankName')}</span> {selectedInvoiceForModal.bankDetails?.bankName || 'HDFC Bank'}</p>
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">{t('accountNumber')}</span> <span className="font-mono font-bold text-navy-900">{selectedInvoiceForModal.bankDetails?.accountNumber || '50100234567890'}</span></p>
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">{t('ifscCode')}</span> <span className="font-mono font-bold text-navy-900">{selectedInvoiceForModal.bankDetails?.ifscCode || 'HDFC0000123'}</span></p>
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">{t('upiId')}</span> <span className="font-mono font-medium text-slate-800">{selectedInvoiceForModal.bankDetails?.upiId || 'zenithos@upi'}</span></p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col items-center justify-center text-center">
                <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2.5">{t('scanToPayUPI')}</h4>
                {(() => {
                  const upiId = selectedInvoiceForModal.bankDetails?.upiId || 'zenithos@upi';
                  const payeeName = selectedInvoiceForModal.bankDetails?.accountHolder || 'Zenith OS Agency';
                  const amount = selectedInvoiceForModal.tdsAmount > 0 ? (selectedInvoiceForModal.total - selectedInvoiceForModal.tdsAmount) : selectedInvoiceForModal.total;
                  const invoiceNum = selectedInvoiceForModal.invoiceNumber;
                  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Invoice ' + invoiceNum)}`;
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(upiUrl)}`;
                  return (
                    <div className="space-y-2">
                      <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 inline-block">
                        <img src={qrUrl} alt="UPI QR Code" className="w-[100px] h-[100px]" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">Scan QR code utilizing any BHIM UPI app to settle</p>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex gap-3">
              {selectedInvoiceForModal.status !== 'paid' && (
                <button
                  className="btn-primary flex-1 justify-center cursor-pointer disabled:opacity-50"
                  disabled={isViewer}
                  onClick={() => { setSelectedInvoiceForModal(null); handleStartPayment(selectedInvoiceForModal); }}
                >
                  <IndianRupee size={15} /> {t('payNow')}
                </button>
              )}
              <button
                className="btn-secondary flex-1 justify-center cursor-pointer"
                onClick={() => toast.info(t('pdfSimulated'))}
              >
                <Download size={15} /> {t('downloadPdf')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
