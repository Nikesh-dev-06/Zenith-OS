import { useState, useEffect } from 'react'
import { FolderOpen, FileText, CheckCircle, Receipt, Download, Clock, CheckCheck, XCircle, IndianRupee, Eye, LifeBuoy } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Progress, InvoiceStatusBadge, ApprovalStatusBadge, Modal } from '../components/ui/index'
import { formatCurrency, formatDate, formatFileSize, getFileIcon } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import api from '../lib/api'

const fonts = [
  { id: 'font-1', name: 'Elegant Script', family: "'Brush Script MT', cursive, sans-serif" },
  { id: 'font-2', name: 'Calligraphy', family: "'Lucida Handwriting', cursive, sans-serif" },
  { id: 'font-3', name: 'Modern Cursive', family: "cursive, sans-serif" }
]

export default function ClientPortalPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const isViewer = user?.role === 'client_viewer'
  const toast = useToast()

  const [projects, setProjects] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [approvals, setApprovals] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [clientDetails, setClientDetails] = useState<any>(null)
  const [supportCount, setSupportCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [approvalModal, setApprovalModal] = useState<string | null>(null)
  const [modalAction, setModalAction] = useState<'approve' | 'revision' | null>(null)
  const [comment, setComment] = useState('')
  const [approvalTab, setApprovalTab] = useState<'pending' | 'completed'>('pending')
  const [dashboardApprovalTab, setDashboardApprovalTab] = useState<'awaiting' | 'pending' | 'approved' | 'revision'>('awaiting')

  // E-Signature state variables
  const [sigType, setSigType] = useState<'typed' | 'drawn'>('typed')
  const [typedName, setTypedName] = useState('')
  const [selectedFont, setSelectedFont] = useState('font-1')
  const [initials, setInitials] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [sigProvider, setSigProvider] = useState<'local' | 'docusign' | 'zohosign'>('local')

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
      const [projRes, filesRes, appRes, invRes, clientRes, supportRes] = await Promise.all([
        api.get('/projects?limit=100'),
        api.get('/files?limit=100'),
        api.get('/approvals?limit=100'),
        api.get('/invoices?limit=100'),
        api.get(`/clients/${user.clientId}`),
        api.get('/support')
      ])
      setProjects(projRes.data.projects || [])
      setFiles(filesRes.data || [])
      setApprovals(appRes.data || [])
      setInvoices(invRes.data.invoices || [])
      setClientDetails(clientRes.data)
      setSupportCount(supportRes.data?.filter((t: any) => t.status !== 'closed' && t.status !== 'resolved').length || 0)
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

  // External signature redirect callback verifier for Approvals
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const verifyExternal = params.get('verify_external')
    const approvalId = params.get('approval_id')
    const provider = params.get('provider')
    const signer = params.get('signer')

    if (verifyExternal === 'true' && approvalId && provider) {
      toast.info(`Verifying external signature via ${provider === 'docusign' ? 'DocuSign' : 'Zoho Sign'}...`)
      
      api.post(`/approvals/${approvalId}/external-callback`, {
        provider,
        signerName: signer || user?.name || 'Authorized Signer'
      })
        .then(() => {
          toast.success(`Approval request signed successfully via ${provider === 'docusign' ? 'DocuSign' : 'Zoho Sign'}!`)
          // Clean parameters from url
          const cleanUrl = window.location.pathname
          window.history.replaceState({}, document.title, cleanUrl)
          fetchData()
        })
        .catch(err => {
          toast.error(err.response?.data?.error || err.message)
        })
    }
  }, [user])

  const handleApprovalResponse = async (status: 'approved' | 'revision_requested') => {
    if (!approvalModal) return
    if (status === 'approved') {
      if (!agreed) {
        toast.error(t('agreeToTermsError'))
        return
      }
      if (sigType === 'typed' && !typedName.trim()) {
        toast.error(t('typeSignatureError'))
        return
      }
      if (sigType === 'drawn' && !initials.trim()) {
        toast.error(t('stampInitialsError'))
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
      toast.success(status === 'approved' ? t('assetApprovedAndSigned') : t('revisionRequested'))
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
        { id: 'stripe', label: t('stripeCardCheckout'), icon: '💳', desc: t('stripeDesc') },
        { id: 'paypal', label: t('paypalCheckout'), icon: '🅿️', desc: t('paypalDesc') },
        { id: 'wise', label: t('wiseTransfer'), icon: '🏦', desc: t('wiseDesc') }
      ]
    : [
        { id: 'upi', label: 'UPI', icon: '📱', desc: t('upiDesc') },
        { id: 'card', label: t('creditDebitCard'), icon: '💳', desc: t('cardDesc') },
        { id: 'netbanking', label: t('netBanking'), icon: '🏦', desc: t('netbankingDesc') },
      ]

  if (loading) {
    return (
      <Layout title={t('myPortal')}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      </Layout>
    )
  }

  const pendingApprovalsCount = approvals.filter(a => a.status === 'pending_review').length
  const outstandingInvoicesCount = invoices.filter(i => i.status !== 'paid').length

  return (
    <Layout title={t('myPortal')}>
      {/* Welcome banner */}
      <div
        className="rounded-2xl p-6 mb-8 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1e293b 100%)' }}
      >
        <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #F4511E, transparent)' }} />
        <p className="text-sm text-slate-400 mb-1">{t('welcomeBack')},</p>
        <h1 className="text-2xl font-bold mb-1">{clientDetails?.companyName || user?.name}</h1>
        <p className="text-slate-400 text-sm">
          {t('youHave')} <span className="text-white font-semibold">{pendingApprovalsCount} {t('approvalsWaiting')}</span> {t('and')}{' '}
          <span className="text-white font-semibold">{outstandingInvoicesCount} {t('invoicesOutstanding')}</span>.
        </p>
        <p className="text-slate-350 text-xs mt-3 border-t border-slate-700/50 pt-2.5 max-w-xl">
          {welcomeMessage}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { labelKey: 'activeProjects', value: projects.filter(p => p.status === 'active').length, icon: <FolderOpen size={16} style={{ color: '#F4511E' }} />, bg: 'bg-orange-50' },
          { labelKey: 'sharedFiles', value: files.length, icon: <FileText size={16} className="text-blue-500" />, bg: 'bg-blue-50' },
          { labelKey: 'pendingApprovals', value: pendingApprovalsCount, icon: <CheckCircle size={16} className="text-amber-500" />, bg: 'bg-amber-50' },
          { labelKey: 'pendingInvoices', value: outstandingInvoicesCount, icon: <Receipt size={16} className="text-emerald-500" />, bg: 'bg-emerald-50' },
          { labelKey: 'Support Center', value: supportCount, icon: <LifeBuoy size={16} className="text-rose-500" />, bg: 'bg-rose-50' },
        ].map(s => (
          <div key={s.labelKey} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500">{t(s.labelKey) || s.labelKey}</span>
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>{s.icon}</div>
            </div>
            <p className="text-2xl font-bold text-navy-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left Column: Projects, Files & Support (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Projects */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">{t('myProjects')}</h2>
              <a href="/portal/projects" className="text-xs font-semibold text-orange-600 hover:text-orange-700">
                View All Projects
              </a>
            </div>
            {projects.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">{t('noProjectsAssigned')}</div>
            ) : (
              <div className="space-y-5">
                {projects.slice(0, 3).map(project => (
                  <div key={project.id}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-navy-900">{project.name}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                        ${project.status === 'active' ? 'bg-blue-50 text-blue-600' :
                          project.status === 'review' ? 'bg-amber-50 text-amber-600' :
                          project.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {t(project.status)}
                      </span>
                    </div>
                    <Progress value={project.progress} showLabel />
                    <p className="text-xs text-slate-400 mt-1.5">
                      {project.completedTasks} {t('of')} {project.taskCount} {t('completedTasksOf')} · {t('deadline')} {formatDate(project.deadline)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Files */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">{t('sharedFiles')}</h2>
              <a href="/portal/files" className="text-xs font-semibold text-orange-600 hover:text-orange-700">
                Go to File Vault
              </a>
            </div>
            {files.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">{t('noSharedFiles')}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {files.slice(0, 4).map(file => (
                  <div key={file.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors group cursor-pointer">
                    <div className="w-8.5 h-8.5 rounded-lg bg-white flex items-center justify-center text-base shadow-sm flex-shrink-0">
                      {getFileIcon(file.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-navy-900 truncate">{file.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatFileSize(file.size)} · v{file.version}</p>
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

          {/* Support Tickets overview */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title">Support Requests</h2>
              <a href="/portal/support" className="text-xs font-semibold text-orange-600 hover:text-orange-700">
                Open Support Center
              </a>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              You have <span className="font-semibold text-navy-900">{supportCount} unresolved support tickets</span>. Submit issues, ask questions, or write feedback directly to the Zenith team.
            </p>
            <div className="flex gap-2">
              <a href="/portal/support" className="btn-primary text-xs py-2 px-4 cursor-pointer">
                Create Support Ticket
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: Approvals, Payment Summary & Upcoming Deadlines (Span 1) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Approvals */}
          <div className="card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="section-title">{t('approvals')}</h2>
              <a href="/portal/approvals" className="text-xs font-semibold text-orange-600 hover:text-orange-700">
                Signature Center
              </a>
            </div>
            {/* Tab selector */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 text-[10px] w-fit mb-3">
              {(['awaiting', 'pending', 'approved', 'revision'] as const).map(tState => {
                const awaitingApproval = approvals.filter(a => a.status === 'pending_client_approval')
                const pendingRequests = approvals.filter(a => a.status === 'pending_admin_approval' || a.status === 'pending_review')
                const recentlyApproved = approvals.filter(a => a.status === 'approved')
                const revisionRequests = approvals.filter(a => a.status === 'revision_requested')
                
                const count = 
                  tState === 'awaiting' ? awaitingApproval.length :
                  tState === 'pending' ? pendingRequests.length :
                  tState === 'approved' ? recentlyApproved.length : revisionRequests.length

                return (
                  <button
                    key={tState}
                    type="button"
                    onClick={() => setDashboardApprovalTab(tState)}
                    className={`px-2 py-1 rounded font-semibold transition-all cursor-pointer ${dashboardApprovalTab === tState ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {tState === 'awaiting' ? `Awaiting (${count})` :
                     tState === 'pending' ? `Pending (${count})` :
                     tState === 'approved' ? `Approved (${count})` :
                     `Revision (${count})`}
                  </button>
                )
              })}
            </div>

            {(() => {
              const awaitingApproval = approvals.filter(a => a.status === 'pending_client_approval')
              const pendingRequests = approvals.filter(a => a.status === 'pending_admin_approval' || a.status === 'pending_review')
              const recentlyApproved = approvals.filter(a => a.status === 'approved')
              const revisionRequests = approvals.filter(a => a.status === 'revision_requested')

              const currentList = 
                dashboardApprovalTab === 'awaiting' ? awaitingApproval :
                dashboardApprovalTab === 'pending' ? pendingRequests :
                dashboardApprovalTab === 'approved' ? recentlyApproved : revisionRequests

              if (currentList.length === 0) {
                return (
                  <div className="text-center py-6">
                    <CheckCheck size={28} className="text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No approvals in this queue</p>
                  </div>
                )
              }

              return (
                <div className="space-y-3">
                  {currentList.slice(0, 3).map((approval: any) => (
                    <div key={approval.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{approval.projectName}</p>
                      <p className="text-xs font-bold text-navy-900 mt-0.5 truncate">{approval.title}</p>
                      
                      {approval.status === 'pending_client_approval' && (
                        <div className="flex gap-2 mt-3">
                          <button
                            className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[9px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer"
                            onClick={() => { setApprovalModal(approval.id); setModalAction('approve'); }}
                          >
                            Approve
                          </button>
                          <button
                            className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[9px] font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => { setApprovalModal(approval.id); setModalAction('revision'); }}
                          >
                            Revise
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* Payment Summary */}
          <div className="card p-5">
            <h2 className="section-title mb-3">Payment Summary</h2>
            <div className="space-y-2.5 mb-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Outstanding:</span>
                <span className="font-bold text-orange-600">{formatCurrency(invoices.filter(i => i.status !== 'paid').reduce((sum, inv) => sum + inv.total, 0))}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Total Settled:</span>
                <span className="font-semibold text-emerald-650">{formatCurrency(invoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + inv.total, 0))}</span>
              </div>
              <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center text-xs font-bold text-navy-900">
                <span>Total Billing:</span>
                <span>{formatCurrency(invoices.reduce((sum, inv) => sum + inv.total, 0))}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <a href="/portal/payments" className="btn-primary flex-1 justify-center text-xs py-2 cursor-pointer">
                Manage Payments
              </a>
              <a href="/portal/invoices" className="btn-secondary flex-1 justify-center text-xs py-2 cursor-pointer">
                Invoices
              </a>
            </div>
          </div>

          {/* Upcoming Deliverables / Milestones */}
          <div className="card p-5">
            <h2 className="section-title mb-3">Upcoming Milestones</h2>
            {projects.filter(p => p.status === 'active' && p.deadline).length === 0 ? (
              <p className="text-center py-4 text-xs text-slate-400">No upcoming project deadlines.</p>
            ) : (
              <div className="space-y-3">
                {projects
                  .filter(p => p.status === 'active' && p.deadline)
                  .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
                  .slice(0, 3)
                  .map(p => (
                    <div key={p.id} className="flex justify-between items-start gap-2 text-xs">
                      <div>
                        <p className="font-semibold text-navy-900 truncate max-w-[150px]">{p.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Project Deadline</p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        {formatDate(p.deadline)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Invoices list */}
      <div className="card overflow-hidden mb-6">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="section-title">{t('myInvoices')}</h2>
          <a href="/portal/invoices" className="text-xs font-semibold text-orange-600 hover:text-orange-700">
            View All Invoices
          </a>
        </div>
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t('noInvoices')}</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-header text-left pl-6">{t('invoice')}</th>
                <th className="table-header text-left">{t('project')}</th>
                <th className="table-header text-left">{t('amount')}</th>
                <th className="table-header text-left">{t('dueDate')}</th>
                <th className="table-header text-left">{t('status')}</th>
                <th className="table-header text-left">{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 5).map(inv => (
                <tr key={inv.id} className="table-row">
                  <td className="table-cell pl-6 font-semibold text-sm text-navy-900">{inv.invoiceNumber}</td>
                  <td className="table-cell text-sm text-slate-500 max-w-[140px] truncate">{inv.projectName || 'Standalone'}</td>
                  <td className="table-cell text-sm font-bold text-navy-900">{formatCurrency(inv.total, inv.currency)}</td>
                  <td className="table-cell text-sm text-slate-500">{formatDate(inv.dueDate)}</td>
                  <td className="table-cell"><InvoiceStatusBadge status={inv.status} /></td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1.5">
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
        )}
      </div>

      {/* Approval Response Modal */}
      <Modal open={!!approvalModal} onClose={() => { setApprovalModal(null); setModalAction(null); }} title={t('respondToApproval')} size="md">
        {selectedApproval && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('assetForReview')}</p>
              <p className="text-sm font-bold text-navy-900 mb-1">{selectedApproval.title}</p>
              <p className="text-xs text-slate-500">{selectedApproval.description}</p>
            </div>

            {modalAction === null ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 text-center">{t('selectResponseChoice')}</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer disabled:opacity-50"
                    disabled={isViewer}
                    onClick={() => setModalAction('approve')}
                  >
                    <CheckCheck size={16} /> {t('approveAndSign')}
                  </button>
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                    onClick={() => setModalAction('revision')}
                  >
                    <XCircle size={16} /> {t('requestChanges')}
                  </button>
                </div>
              </div>
            ) : modalAction === 'approve' ? (
              <div className="space-y-4 animate-fadeIn">
                <p className="text-xs text-slate-500">Choose your preferred signature provider to authorize this deliverable.</p>

                {/* Provider Selection */}
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
                  <button
                    onClick={() => setSigProvider('local')}
                    className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                      sigProvider === 'local' ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-750 dark:text-slate-400'
                    }`}
                  >
                    Zenith Local
                  </button>
                  <button
                    onClick={() => setSigProvider('docusign')}
                    className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                      sigProvider === 'docusign' ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-750 dark:text-slate-400'
                    }`}
                  >
                    DocuSign
                  </button>
                  <button
                    onClick={() => setSigProvider('zohosign')}
                    className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                      sigProvider === 'zohosign' ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-750 dark:text-slate-400'
                    }`}
                  >
                    Zoho Sign
                  </button>
                </div>

                {sigProvider === 'local' ? (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                      <h4 className="text-xs font-bold text-navy-900 dark:text-white uppercase tracking-wider mb-2">{t('eSignatureVerification')}</h4>
                      <div className="flex gap-2 bg-slate-100 dark:bg-slate-850 rounded-lg p-1 text-xs w-fit">
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${sigType === 'typed' ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-405'}`}
                          onClick={() => setSigType('typed')}
                        >
                          {t('typeSignature')}
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${sigType === 'drawn' ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-405'}`}
                          onClick={() => setSigType('drawn')}
                        >
                          {t('sealStamp')}
                        </button>
                      </div>
                    </div>

                    {sigType === 'typed' ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-350 mb-1">{t('typeName')} *</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="e.g. John Doe"
                            value={typedName}
                            onChange={e => setTypedName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-350 mb-1">{t('signatureStyle')}</label>
                          <div className="grid grid-cols-3 gap-2">
                            {fonts.map(f => (
                              <button
                                type="button"
                                key={f.id}
                                className={`px-2 py-1.5 rounded-lg border text-xs text-center transition-all cursor-pointer ${selectedFont === f.id ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-800'}`}
                                onClick={() => setSelectedFont(f.id)}
                                style={{ fontFamily: f.family }}
                              >
                                {t('signatureStylePreview')}
                              </button>
                            ))}
                          </div>
                        </div>
                        {typedName.trim() && (
                          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 text-center border border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 block mb-1">{t('liveSignaturePreview')}</span>
                            <p
                              className="text-2xl text-slate-800 dark:text-white italic"
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
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-350 mb-1">{t('initialsPlaceholder')} *</label>
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
                          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 block mb-2">{t('liveStampPreview')}</span>
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
                                <circle cx="50" cy="50" r="45" fill="none" stroke="#10B981" strokeWidth="2.5" strokeDasharray="3,3" />
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
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-350 mb-1">{t('commentNoteOptional')}</label>
                      <textarea
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        className="input h-16 resize-none text-xs"
                        placeholder={t('addCommentNotePlaceholder')}
                      />
                    </div>

                    <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                      <input
                        type="checkbox"
                        id="eSignConsent"
                        checked={agreed}
                        onChange={e => setAgreed(e.target.checked)}
                        className="mt-0.5"
                      />
                      <label htmlFor="eSignConsent" className="text-xs text-slate-500 leading-relaxed cursor-pointer select-none">
                        {t('consentText')}
                      </label>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="flex-1 btn-secondary text-xs cursor-pointer py-2"
                        onClick={() => setModalAction(null)}
                      >
                        {t('goBack')}
                      </button>
                      <button
                        type="button"
                        className="flex-2 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-emerald-500 text-white hover:bg-emerald-600 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={() => handleApprovalResponse('approved')}
                        disabled={!agreed || (sigType === 'typed' ? !typedName.trim() : !initials.trim())}
                      >
                        <CheckCheck size={16} /> {t('signApprove')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-4">
                      <p className="text-xs font-semibold text-navy-900 dark:text-white flex items-center gap-1.5 mb-1.5">
                        🛡️ {sigProvider === 'docusign' ? 'DocuSign' : 'Zoho Sign'} Secure Signature Protocol
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Upon clicking launch, you will be redirected to the secure {sigProvider === 'docusign' ? 'DocuSign sandbox' : 'Zoho Sign sandbox'} environment to verify, sign, and approve this deliverable legally. Once signed, you will be automatically returned to your project portal dashboard.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1">Authorized Signer Name *</label>
                      <input
                        type="text"
                        value={typedName}
                        onChange={e => setTypedName(e.target.value)}
                        placeholder="e.g. Johnathan Doe"
                        className="input"
                      />
                    </div>

                    <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 font-semibold">
                      <button
                        type="button"
                        className="btn-secondary text-xs cursor-pointer py-2"
                        onClick={() => setModalAction(null)}
                      >
                        {t('goBack')}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!typedName.trim()) {
                            toast.error('Signer name is required.')
                            return
                          }
                          try {
                            const res = await api.post(`/approvals/${approvalModal}/${sigProvider}/create-envelope`)
                            toast.success(`Redirecting to secure ${sigProvider === 'docusign' ? 'DocuSign' : 'Zoho Sign'} session...`)
                            const targetUrl = `${res.data.url}&signer=${encodeURIComponent(typedName)}`
                            setTimeout(() => {
                              window.location.href = targetUrl
                            }, 1000)
                          } catch (err: any) {
                            toast.error(err.response?.data?.error || err.message)
                          }
                        }}
                        disabled={!typedName.trim()}
                        className="btn-primary text-xs justify-center cursor-pointer disabled:opacity-50 bg-blue-600 hover:bg-blue-700 text-white border-none"
                      >
                        Launch {sigProvider === 'docusign' ? 'DocuSign' : 'Zoho Sign'} Session
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 animate-fadeIn">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5 font-bold">{t('whyRevisionsNeeded')} *</label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    className="input h-24 resize-none"
                    placeholder={t('specifyRevisionsRequired')}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="flex-1 btn-secondary text-xs cursor-pointer py-2"
                    onClick={() => setModalAction(null)}
                  >
                    {t('goBack')}
                  </button>
                  <button
                    type="button"
                    className="flex-2 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-rose-600 text-white hover:bg-rose-700 transition-all cursor-pointer disabled:opacity-40"
                    onClick={() => handleApprovalResponse('revision_requested')}
                    disabled={!comment.trim()}
                  >
                    <XCircle size={16} /> {t('submitRevisionRequest')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Razorpay Simulation Modal */}
      <Modal open={showRazorpay} onClose={() => { setShowRazorpay(false); setPayStep('method'); }} title={t('simulatePayment')} size="sm">
        {payStep === 'method' && selectedInvoice && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">{t('totalAmount')}</p>
              <p className="text-2xl font-bold text-navy-900">{formatCurrency(selectedInvoice.total, selectedInvoice.currency)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t('orderId')}: {paymentOrderId}</p>
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('choosePaymentMethod')}</p>

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
              {t('pay')} {formatCurrency(selectedInvoice.total, selectedInvoice.currency)}
            </button>
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
                <p className="text-sm text-slate-500 mt-0.5">{selectedInvoiceForModal.projectName}</p>
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">{t('hsnSac')}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{t('qty')}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{t('rate')}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{t('amount')}</th>
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
                  <span>{t('subtotal')}</span>
                  <span>{formatCurrency(selectedInvoiceForModal.subtotal)}</span>
                </div>
                {selectedInvoiceForModal.discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 font-medium">
                    <span>{t('discount')} ({selectedInvoiceForModal.discountType === 'percent' ? `${selectedInvoiceForModal.discountValue}%` : t('flat')})</span>
                    <span>-{formatCurrency(selectedInvoiceForModal.discount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm text-slate-600 font-medium">
                  <span>{t('taxableValue')}</span>
                  <span>{formatCurrency(selectedInvoiceForModal.subtotal - selectedInvoiceForModal.discount)}</span>
                </div>

                {selectedInvoiceForModal.isExport ? (
                  <div className="bg-emerald-50 text-emerald-800 p-2 rounded-lg text-[10px] leading-snug">
                    {t('zeroRatedGst')} ({t('lutNo')}: <span className="font-mono font-bold">{selectedInvoiceForModal.lutNumber || 'Pending'}</span>)
                  </div>
                ) : (
                  <>
                    {selectedInvoiceForModal.isIntrastate !== false ? (
                      <>
                        <div className="flex justify-between text-xs text-slate-500 pl-2">
                          <span>{t('cgst')} ({(selectedInvoiceForModal.taxRate || 18) / 2}%)</span>
                          <span>{formatCurrency(selectedInvoiceForModal.cgst ?? Math.round((selectedInvoiceForModal.subtotal - selectedInvoiceForModal.discount) * ((selectedInvoiceForModal.taxRate || 18) / 2) / 100))}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 pl-2">
                          <span>{t('sgst')} ({(selectedInvoiceForModal.taxRate || 18) / 2}%)</span>
                          <span>{formatCurrency(selectedInvoiceForModal.sgst ?? Math.round((selectedInvoiceForModal.subtotal - selectedInvoiceForModal.discount) * ((selectedInvoiceForModal.taxRate || 18) / 2) / 100))}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-xs text-slate-500 pl-2">
                        <span>{t('igst')} ({selectedInvoiceForModal.taxRate || 18}%)</span>
                        <span>{formatCurrency(selectedInvoiceForModal.igst ?? Math.round((selectedInvoiceForModal.subtotal - selectedInvoiceForModal.discount) * (selectedInvoiceForModal.taxRate || 18) / 100))}</span>
                      </div>
                    )}
                    {selectedInvoiceForModal.rcm && (
                      <div className="bg-amber-50 text-amber-800 p-2 rounded-lg text-[10px] leading-snug">
                        ⚠️ {t('rcmWarning')}
                      </div>
                    )}
                  </>
                )}

                {selectedInvoiceForModal.roundingAdjustment ? (
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>{t('roundingOff')}</span>
                    <span>{selectedInvoiceForModal.roundingAdjustment > 0 ? '+' : ''}{formatCurrency(selectedInvoiceForModal.roundingAdjustment)}</span>
                  </div>
                ) : null}

                <div className="flex justify-between text-base font-bold text-navy-900 pt-1.5 border-t border-slate-200">
                  <span>{selectedInvoiceForModal.rcm ? t('totalExclGst') : t('totalInvoiceValue')}</span>
                  <span>{formatCurrency(selectedInvoiceForModal.total)}</span>
                </div>

                {((selectedInvoiceForModal.tdsAmount || 0) > 0) && (
                  <>
                    <div className="flex justify-between text-sm text-rose-600 font-medium pt-1.5 border-t border-dashed border-slate-200">
                      <span>{t('tdsWithheld')} (@ {selectedInvoiceForModal.tdsRate}%)</span>
                      <span>-{formatCurrency(selectedInvoiceForModal.tdsAmount)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-emerald-600 pt-1.5 border-t border-slate-200">
                      <span>{t('netPayableDue')}</span>
                      <span>{formatCurrency(selectedInvoiceForModal.total - selectedInvoiceForModal.tdsAmount)}</span>
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
                        <img src={qrUrl} alt="UPI QR Code" className="w-[110px] h-[110px]" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">{t('scanUsingUpiApps')}</p>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex gap-3">
              {selectedInvoiceForModal.status !== 'paid' && (
                <button className="btn-primary flex-1 justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" disabled={isViewer} onClick={() => { setSelectedInvoiceForModal(null); handleStartPayment(selectedInvoiceForModal); }}><IndianRupee size={15} /> {t('payNow')}</button>
              )}
              <button className="btn-secondary flex-1 justify-center cursor-pointer" onClick={() => toast.info(t('pdfSimulated'))}><Download size={15} /> {t('downloadPdf')}</button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
