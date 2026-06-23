import { useState, useEffect } from 'react'
import { FolderOpen, FileText, CheckCircle, Receipt, Download, Clock, CheckCheck, XCircle, IndianRupee, Eye } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Progress, InvoiceStatusBadge, ApprovalStatusBadge, Modal } from '../components/ui/index'
import { formatCurrency, formatDate, formatFileSize, getFileIcon } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import api from '../lib/api'

const fonts = [
  { id: 'font-1', name: 'Elegant Script', family: "'Brush Script MT', cursive, sans-serif" },
  { id: 'font-2', name: 'Calligraphy', family: "'Lucida Handwriting', cursive, sans-serif" },
  { id: 'font-3', name: 'Modern Cursive', family: "cursive, sans-serif" }
]

export default function ClientPortalPage() {
  const { user } = useAuth()
  const isViewer = user?.role === 'client_viewer'
  const toast = useToast()

  const [projects, setProjects] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [approvals, setApprovals] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [clientDetails, setClientDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [approvalModal, setApprovalModal] = useState<string | null>(null)
  const [modalAction, setModalAction] = useState<'approve' | 'revision' | null>(null)
  const [comment, setComment] = useState('')
  const [approvalTab, setApprovalTab] = useState<'pending' | 'completed'>('pending')

  // E-Signature state variables
  const [sigType, setSigType] = useState<'typed' | 'drawn'>('typed')
  const [typedName, setTypedName] = useState('')
  const [selectedFont, setSelectedFont] = useState('font-1')
  const [initials, setInitials] = useState('')
  const [agreed, setAgreed] = useState(false)

  // Razorpay payment states
  const [showRazorpay, setShowRazorpay] = useState(false)
  const [payStep, setPayStep] = useState<'method' | 'processing' | 'success'>('method')
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<any>(null)
  const [paymentOrderId, setPaymentOrderId] = useState<string>('')
  const [welcomeMessage, setWelcomeMessage] = useState('Welcome to your project portal. Here you can track progress, review files, and manage invoices.')

  const fetchData = async () => {
    if (!user?.clientId) return
    try {
      setLoading(true)
      const [projRes, filesRes, appRes, invRes, clientRes] = await Promise.all([
        api.get('/projects?limit=100'),
        api.get('/files?limit=100'),
        api.get('/approvals?limit=100'),
        api.get('/invoices?limit=100'),
        api.get(`/clients/${user.clientId}`)
      ])
      setProjects(projRes.data.projects || [])
      setFiles(filesRes.data || [])
      setApprovals(appRes.data || [])
      setInvoices(invRes.data.invoices || [])
      setClientDetails(clientRes.data)
    } catch (err) {
      console.error('Failed to load portal data', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const savedMsg = localStorage.getItem('zenithos_welcome_message')
    if (savedMsg) setWelcomeMessage(savedMsg)
  }, [user])

  const handleApprovalResponse = async (status: 'approved' | 'revision_requested') => {
    if (!approvalModal) return
    if (status === 'approved') {
      if (!agreed) {
        toast.error('You must agree to the legally binding terms.')
        return
      }
      if (sigType === 'typed' && !typedName.trim()) {
        toast.error('Please type your name for the signature.')
        return
      }
      if (sigType === 'drawn' && !initials.trim()) {
        toast.error('Please enter your initials for the stamp seal.')
        return
      }
    }

    try {
      await api.put(`/approvals/${approvalModal}/respond`, {
        status,
        clientComment: comment,
        signatureText: status === 'approved' && sigType === 'typed' ? typedName : undefined,
        signatureDrawn: status === 'approved' ? (sigType === 'drawn' ? `STAMP:${initials.toUpperCase()}` : `FONT:${selectedFont}`) : undefined
      })
      setApprovalModal(null)
      setComment('')
      setTypedName('')
      setInitials('')
      setAgreed(false)
      setModalAction(null)
      // Refresh data
      fetchData()
      toast.success(status === 'approved' ? 'Asset approved and signed successfully.' : 'Revision requested.')
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

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

  const selectedApproval = approvals.find(a => a.id === approvalModal)

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
      <Layout title="My Portal">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      </Layout>
    )
  }

  const pendingApprovalsCount = approvals.filter(a => a.status === 'pending_review').length
  const outstandingInvoicesCount = invoices.filter(i => i.status !== 'paid').length

  return (
    <Layout title="My Portal">
      {/* Welcome banner */}
      <div
        className="rounded-2xl p-6 mb-8 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1e293b 100%)' }}
      >
        <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #F4511E, transparent)' }} />
        <p className="text-sm text-slate-400 mb-1">Welcome back,</p>
        <h1 className="text-2xl font-bold mb-1">{clientDetails?.companyName || user?.name}</h1>
        <p className="text-slate-400 text-sm">
          You have <span className="text-white font-semibold">{pendingApprovalsCount} approvals</span> waiting and{' '}
          <span className="text-white font-semibold">{outstandingInvoicesCount} invoice{outstandingInvoicesCount !== 1 ? 's' : ''}</span> outstanding.
        </p>
        <p className="text-slate-350 text-xs mt-3 border-t border-slate-700/50 pt-2.5 max-w-xl">
          {welcomeMessage}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Projects', value: projects.filter(p => p.status === 'active').length, icon: <FolderOpen size={16} style={{ color: '#F4511E' }} />, bg: 'bg-orange-50' },
          { label: 'Shared Files', value: files.length, icon: <FileText size={16} className="text-blue-500" />, bg: 'bg-blue-50' },
          { label: 'Pending Approvals', value: pendingApprovalsCount, icon: <CheckCircle size={16} className="text-amber-500" />, bg: 'bg-amber-50' },
          { label: 'Invoices', value: invoices.length, icon: <Receipt size={16} className="text-emerald-500" />, bg: 'bg-emerald-50' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500">{s.label}</span>
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>{s.icon}</div>
            </div>
            <p className="text-2xl font-bold text-navy-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Projects */}
        <div className="card p-5">
          <h2 className="section-title mb-4">My Projects</h2>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">No projects assigned yet.</div>
          ) : (
            <div className="space-y-5">
              {projects.map(project => (
                <div key={project.id}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-navy-900">{project.name}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                      ${project.status === 'active' ? 'bg-blue-50 text-blue-600' :
                        project.status === 'review' ? 'bg-amber-50 text-amber-600' :
                        project.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                    </span>
                  </div>
                  <Progress value={project.progress} showLabel />
                  <p className="text-xs text-slate-400 mt-1.5">
                    {project.completedTasks} of {project.taskCount} tasks done · Deadline {formatDate(project.deadline)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approvals */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Approvals</h2>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${approvalTab === 'pending' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setApprovalTab('pending')}
              >
                Pending ({pendingApprovalsCount})
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${approvalTab === 'completed' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setApprovalTab('completed')}
              >
                History ({approvals.filter(a => a.status !== 'pending_review').length})
              </button>
            </div>
          </div>

          {approvalTab === 'pending' ? (
            pendingApprovalsCount === 0 ? (
              <div className="text-center py-8">
                <CheckCheck size={32} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">All caught up! No approvals pending.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {approvals.filter(a => a.status === 'pending_review').map(approval => (
                  <div key={approval.id} className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{approval.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{approval.projectName}</p>
                      </div>
                      <Clock size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    </div>
                    <p className="text-xs text-slate-600 mb-3">{approval.description}</p>
                    <div className="flex gap-2">
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => { setApprovalModal(approval.id); setModalAction('approve'); }}
                        disabled={isViewer}
                      >
                        <CheckCheck size={13} /> Approve
                      </button>
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => { setApprovalModal(approval.id); setModalAction('revision'); }}
                        disabled={isViewer}
                      >
                        <XCircle size={13} /> Request Changes
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            approvals.filter(a => a.status !== 'pending_review').length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No completed approvals yet.</div>
            ) : (
              <div className="space-y-3">
                {approvals.filter(a => a.status !== 'pending_review').map(approval => (
                  <div key={approval.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{approval.title}</p>
                        <p className="text-xs text-slate-500">{approval.projectName}</p>
                      </div>
                      <ApprovalStatusBadge status={approval.status} />
                    </div>
                    <p className="text-xs text-slate-600 mb-2">{approval.description}</p>
                    {approval.comment && (
                      <div className="bg-slate-100 border border-slate-200 rounded-lg p-2.5 mb-2 text-xs text-slate-600">
                        <span className="font-semibold block mb-0.5 text-slate-700">Client Feedback:</span>
                        "{approval.comment}"
                      </div>
                    )}
                    {approval.status === 'approved' && (approval.signatureText || approval.signatureDrawn) && (
                      <div className="mt-2 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex items-center gap-3">
                        {approval.signatureDrawn && approval.signatureDrawn.startsWith('STAMP:') ? (
                          <div className="flex-shrink-0 bg-white rounded-full p-1 border border-emerald-200">
                            <svg width="48" height="48" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="45" fill="none" stroke="#10B981" strokeWidth="3" strokeDasharray="3,3" />
                              <circle cx="50" cy="50" r="40" fill="none" stroke="#10B981" strokeWidth="1.5" />
                              <text x="50" y="47" textAnchor="middle" fill="#10B981" fontSize="22" fontWeight="bold" fontFamily="sans-serif">
                                {approval.signatureDrawn.split(':')[1] || 'JD'}
                              </text>
                              <text x="50" y="66" textAnchor="middle" fill="#10B981" fontSize="10" fontWeight="bold" fontFamily="sans-serif" letterSpacing="0.5">
                                SIGNED
                              </text>
                              <text x="50" y="78" textAnchor="middle" fill="#10B981" fontSize="7" fontFamily="sans-serif">
                                SECURE
                              </text>
                            </svg>
                          </div>
                        ) : null}
                        <div>
                          <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                            <CheckCheck size={12} className="text-emerald-600" /> Digitally Signed & Verified
                          </div>
                          {approval.signatureText && (
                            <p className="text-base text-slate-800 font-medium italic my-0.5" style={{ fontFamily: approval.signatureDrawn?.startsWith('FONT:') ? fonts.find(f => f.id === approval.signatureDrawn.split(':')[1])?.family || 'cursive' : 'cursive' }}>
                              {approval.signatureText}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400">Timestamp: {formatDate(approval.signedAt || approval.respondedAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Files */}
      <div className="card p-5 mb-6">
        <h2 className="section-title mb-4">Shared Files</h2>
        {files.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No files shared with you yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {files.map(file => (
              <div key={file.id} className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors group cursor-pointer">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-lg shadow-sm flex-shrink-0">
                  {getFileIcon(file.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-navy-900 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatFileSize(file.size)} · v{file.version}</p>
                </div>
                <a 
                  href={`http://localhost:5000/api/files/download-raw/${file.id}`} 
                  download 
                  onClick={e => e.stopPropagation()}
                  className="btn-ghost p-1.5 text-slate-400 hover:text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                >
                  <Download size={14} />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="section-title">My Invoices</h2>
        </div>
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No invoices.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-header text-left">Invoice</th>
                <th className="table-header text-left">Project</th>
                <th className="table-header text-left">Amount</th>
                <th className="table-header text-left">Due Date</th>
                <th className="table-header text-left">Status</th>
                <th className="table-header text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="table-row">
                  <td className="table-cell font-semibold text-sm text-navy-900">{inv.invoiceNumber}</td>
                  <td className="table-cell text-sm text-slate-500 max-w-[140px] truncate">{inv.projectName}</td>
                  <td className="table-cell text-sm font-bold text-navy-900">{formatCurrency(inv.total)}</td>
                  <td className="table-cell text-sm text-slate-500">{formatDate(inv.dueDate)}</td>
                  <td className="table-cell"><InvoiceStatusBadge status={inv.status} /></td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1.5">
                      <button 
                        className="btn-ghost p-1.5 text-slate-400 hover:text-navy-900 cursor-pointer" 
                        title="View Details" 
                        onClick={() => setSelectedInvoiceForModal(inv)}
                      >
                        <Eye size={14} />
                      </button>
                      {inv.status !== 'paid' ? (
                        <button 
                          className="btn-primary text-xs py-1.5 px-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isViewer}
                          onClick={() => handleStartPayment(inv)}
                        >
                          Pay Now
                        </button>
                      ) : (
                        <button 
                          className="btn-ghost text-xs py-1.5 px-2 text-slate-500 cursor-pointer"
                          onClick={() => toast.info('PDF generation is simulated for this environment.')}
                        >
                          <Download size={12} /> Receipt
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Approval Response Modal */}
      <Modal open={!!approvalModal} onClose={() => { setApprovalModal(null); setModalAction(null); }} title="Respond to Approval" size="md">
        {selectedApproval && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Asset for Review</p>
              <p className="text-sm font-bold text-navy-900 mb-1">{selectedApproval.title}</p>
              <p className="text-xs text-slate-500">{selectedApproval.description}</p>
            </div>

            {modalAction === null ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 text-center">Please select your response choice below:</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer disabled:opacity-50"
                    disabled={isViewer}
                    onClick={() => setModalAction('approve')}
                  >
                    <CheckCheck size={16} /> Approve & Sign
                  </button>
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                    onClick={() => setModalAction('revision')}
                  >
                    <XCircle size={16} /> Request Changes
                  </button>
                </div>
              </div>
            ) : modalAction === 'approve' ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">E-Signature Verification</h4>
                  <div className="flex gap-2 bg-slate-100 rounded-lg p-1 text-xs w-fit">
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${sigType === 'typed' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      onClick={() => setSigType('typed')}
                    >
                      Type Signature
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${sigType === 'drawn' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      onClick={() => setSigType('drawn')}
                    >
                      Seal Stamp
                    </button>
                  </div>
                </div>

                {sigType === 'typed' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Type Full Name *</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. John Doe"
                        value={typedName}
                        onChange={e => setTypedName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Signature Style</label>
                      <div className="grid grid-cols-3 gap-2">
                        {fonts.map(f => (
                          <button
                            type="button"
                            key={f.id}
                            className={`px-2 py-1.5 rounded-lg border text-xs text-center transition-all cursor-pointer ${selectedFont === f.id ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                            onClick={() => setSelectedFont(f.id)}
                            style={{ fontFamily: f.family }}
                          >
                            Preview style
                          </button>
                        ))}
                      </div>
                    </div>
                    {typedName.trim() && (
                      <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                        <span className="text-[10px] text-slate-400 block mb-1">Live Signature Preview</span>
                        <p
                          className="text-2xl text-slate-800 italic"
                          style={{ fontFamily: fonts.find(f => f.id === selectedFont)?.family }}
                        >
                          {typedName}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Initials (max 3 letters) *</label>
                      <input
                        type="text"
                        className="input font-mono uppercase"
                        placeholder="e.g. JD"
                        maxLength={3}
                        value={initials}
                        onChange={e => setInitials(e.target.value)}
                      />
                    </div>
                    {initials.trim() && (
                      <div className="bg-slate-50 rounded-xl p-4 flex flex-col items-center justify-center border border-slate-100">
                        <span className="text-[10px] text-slate-400 block mb-2">Live Stamp Preview</span>
                        <div className="bg-white rounded-full p-1 shadow-sm border border-slate-200">
                          <svg width="80" height="80" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#10B981" strokeWidth="2.5" strokeDasharray="3,3" />
                            <circle cx="50" cy="50" r="40" fill="none" stroke="#10B981" strokeWidth="1.5" />
                            <text x="50" y="47" textAnchor="middle" fill="#10B981" fontSize="22" fontWeight="bold" fontFamily="sans-serif">
                              {initials.toUpperCase()}
                            </text>
                            <text x="50" y="66" textAnchor="middle" fill="#10B981" fontSize="10" fontWeight="bold" fontFamily="sans-serif" letterSpacing="0.5">
                              SIGNED
                            </text>
                            <text x="50" y="78" textAnchor="middle" fill="#10B981" fontSize="7" fontFamily="sans-serif">
                              SECURE
                            </text>
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Comment/Note (optional)</label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    className="input h-16 resize-none text-xs"
                    placeholder="Add a comment or note..."
                  />
                </div>

                <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <input
                    type="checkbox"
                    id="eSignConsent"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                    className="mt-0.5"
                  />
                  <label htmlFor="eSignConsent" className="text-xs text-slate-500 leading-relaxed cursor-pointer select-none">
                    I agree that this signature is a valid, legally binding representation of my approval, electronic signature and consent.
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    className="flex-1 btn-secondary text-xs cursor-pointer py-2"
                    onClick={() => setModalAction(null)}
                  >
                    Go Back
                  </button>
                  <button
                    type="button"
                    className="flex-2 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-emerald-500 text-white hover:bg-emerald-600 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => handleApprovalResponse('approved')}
                    disabled={!agreed || (sigType === 'typed' ? !typedName.trim() : !initials.trim())}
                  >
                    <CheckCheck size={16} /> Sign & Approve
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 animate-fadeIn">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5 font-bold">Why are revisions needed? *</label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    className="input h-24 resize-none"
                    placeholder="Specify exactly what changes are required..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="flex-1 btn-secondary text-xs cursor-pointer py-2"
                    onClick={() => setModalAction(null)}
                  >
                    Go Back
                  </button>
                  <button
                    type="button"
                    className="flex-2 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-rose-600 text-white hover:bg-rose-700 transition-all cursor-pointer disabled:opacity-40"
                    onClick={() => handleApprovalResponse('revision_requested')}
                    disabled={!comment.trim()}
                  >
                    <XCircle size={16} /> Submit Revision Request
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Razorpay Simulation Modal */}
      <Modal open={showRazorpay} onClose={() => { setShowRazorpay(false); setPayStep('method'); }} title="Simulate Payment" size="sm">
        {payStep === 'method' && selectedInvoice && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-navy-900">{formatCurrency(selectedInvoice.total, selectedInvoice.currency)}</p>
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
              className="btn-primary w-full justify-center py-2.5 mt-2 cursor-pointer"
              disabled={!selectedMethod}
              onClick={handleVerifyPayment}
            >
              Pay {formatCurrency(selectedInvoice.total, selectedInvoice.currency)}
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

        {payStep === 'success' && selectedInvoice && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-emerald-100">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-navy-900 mb-0.5">Payment Successful!</p>
            <p className="text-xs text-slate-500 mb-4">{formatCurrency(selectedInvoice.total, selectedInvoice.currency)} received successfully.</p>
            <button
              className="btn-primary justify-center w-full cursor-pointer"
              onClick={() => { setShowRazorpay(false); setPayStep('method'); setSelectedInvoice(null); }}
            >
              Close
            </button>
          </div>
        )}
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal open={!!selectedInvoiceForModal} onClose={() => setSelectedInvoiceForModal(null)} title="Invoice Details" size="lg">
        {selectedInvoiceForModal && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-navy-900">{selectedInvoiceForModal.invoiceNumber}</p>
                <p className="text-sm text-slate-500 mt-0.5">{selectedInvoiceForModal.projectName}</p>
                {clientDetails && (
                  <div className="text-xs text-slate-400 mt-2 space-y-0.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100/50 w-fit">
                    {clientDetails.companyName && <p><span className="font-semibold text-slate-500">Client:</span> {clientDetails.companyName}</p>}
                    {clientDetails.address && <p><span className="font-semibold text-slate-500">Address:</span> {clientDetails.address}</p>}
                    {clientDetails.phone && <p><span className="font-semibold text-slate-500">Phone:</span> {clientDetails.phone}</p>}
                    {clientDetails.gstin && <p><span className="font-semibold text-slate-500">GSTIN:</span> {clientDetails.gstin}</p>}
                    {clientDetails.pan && <p><span className="font-semibold text-slate-500">PAN:</span> {clientDetails.pan}</p>}
                    {selectedInvoiceForModal.placeOfSupply && <p><span className="font-semibold text-slate-500">Place of Supply:</span> {selectedInvoiceForModal.placeOfSupply}</p>}
                  </div>
                )}
              </div>
              <InvoiceStatusBadge status={selectedInvoiceForModal.status} />
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
                  {selectedInvoiceForModal.items && selectedInvoiceForModal.items.map((item: any, i: number) => (
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
                  <span>{formatCurrency(selectedInvoiceForModal.subtotal)}</span>
                </div>
                {selectedInvoiceForModal.discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 font-medium">
                    <span>Discount ({selectedInvoiceForModal.discountType === 'percent' ? `${selectedInvoiceForModal.discountValue}%` : 'Flat'})</span>
                    <span>-{formatCurrency(selectedInvoiceForModal.discount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm text-slate-600 font-medium">
                  <span>Taxable Value</span>
                  <span>{formatCurrency(selectedInvoiceForModal.subtotal - selectedInvoiceForModal.discount)}</span>
                </div>

                {selectedInvoiceForModal.isExport ? (
                  <div className="bg-emerald-50 text-emerald-800 p-2 rounded-lg text-[10px] leading-snug">
                    Zero-rated GST (Export under LUT No: <span className="font-mono font-bold">{selectedInvoiceForModal.lutNumber || 'Pending'}</span>)
                  </div>
                ) : (
                  <>
                    {selectedInvoiceForModal.isIntrastate !== false ? (
                      <>
                        <div className="flex justify-between text-xs text-slate-500 pl-2">
                          <span>CGST ({(selectedInvoiceForModal.taxRate || 18) / 2}%)</span>
                          <span>{formatCurrency(selectedInvoiceForModal.cgst ?? Math.round((selectedInvoiceForModal.subtotal - selectedInvoiceForModal.discount) * ((selectedInvoiceForModal.taxRate || 18) / 2) / 100))}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 pl-2">
                          <span>SGST ({(selectedInvoiceForModal.taxRate || 18) / 2}%)</span>
                          <span>{formatCurrency(selectedInvoiceForModal.sgst ?? Math.round((selectedInvoiceForModal.subtotal - selectedInvoiceForModal.discount) * ((selectedInvoiceForModal.taxRate || 18) / 2) / 100))}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-xs text-slate-500 pl-2">
                        <span>IGST ({selectedInvoiceForModal.taxRate || 18}%)</span>
                        <span>{formatCurrency(selectedInvoiceForModal.igst ?? Math.round((selectedInvoiceForModal.subtotal - selectedInvoiceForModal.discount) * (selectedInvoiceForModal.taxRate || 18) / 100))}</span>
                      </div>
                    )}
                    {selectedInvoiceForModal.rcm && (
                      <div className="bg-amber-50 text-amber-800 p-2 rounded-lg text-[10px] leading-snug">
                        ⚠️ GST payable under Reverse Charge (RCM). Tax is NOT added to the invoice total.
                      </div>
                    )}
                  </>
                )}

                {selectedInvoiceForModal.roundingAdjustment ? (
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>Rounding Off</span>
                    <span>{selectedInvoiceForModal.roundingAdjustment > 0 ? '+' : ''}{formatCurrency(selectedInvoiceForModal.roundingAdjustment)}</span>
                  </div>
                ) : null}

                <div className="flex justify-between text-base font-bold text-navy-900 pt-1.5 border-t border-slate-200">
                  <span>{selectedInvoiceForModal.rcm ? 'Total (Excl. GST)' : 'Total Invoice Value'}</span>
                  <span>{formatCurrency(selectedInvoiceForModal.total)}</span>
                </div>

                {((selectedInvoiceForModal.tdsAmount || 0) > 0) && (
                  <>
                    <div className="flex justify-between text-sm text-rose-600 font-medium pt-1.5 border-t border-dashed border-slate-200">
                      <span>TDS Withheld (@ {selectedInvoiceForModal.tdsRate}%)</span>
                      <span>-{formatCurrency(selectedInvoiceForModal.tdsAmount)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-emerald-600 pt-1.5 border-t border-slate-200">
                      <span>Net Payable / Due</span>
                      <span>{formatCurrency(selectedInvoiceForModal.total - selectedInvoiceForModal.tdsAmount)}</span>
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
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">Account Holder</span> {selectedInvoiceForModal.bankDetails?.accountHolder || 'Zenith OS Agency'}</p>
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">Bank Name</span> {selectedInvoiceForModal.bankDetails?.bankName || 'HDFC Bank'}</p>
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">Account Number</span> <span className="font-mono font-bold text-navy-900">{selectedInvoiceForModal.bankDetails?.accountNumber || '50100234567890'}</span></p>
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">IFSC Code</span> <span className="font-mono font-bold text-navy-900">{selectedInvoiceForModal.bankDetails?.ifscCode || 'HDFC0000123'}</span></p>
                  <p><span className="font-semibold text-slate-400 uppercase text-[9px] tracking-wide block">UPI ID</span> <span className="font-mono font-medium text-slate-800">{selectedInvoiceForModal.bankDetails?.upiId || 'zenithos@upi'}</span></p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col items-center justify-center text-center">
                <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2.5">Scan to Pay via UPI</h4>
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
                        <img src={qrUrl} alt="UPI QR Code" className="w-[110px] h-[110px]" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">Scan using BHIM, GPay, PhonePe, or Paytm</p>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex gap-3">
              {selectedInvoiceForModal.status !== 'paid' && (
                <button className="btn-primary flex-1 justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" disabled={isViewer} onClick={() => { setSelectedInvoiceForModal(null); handleStartPayment(selectedInvoiceForModal); }}><IndianRupee size={15} /> Pay Now</button>
              )}
              <button className="btn-secondary flex-1 justify-center cursor-pointer" onClick={() => toast.info('PDF generation is simulated for this environment.')}><Download size={15} /> Download PDF</button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
