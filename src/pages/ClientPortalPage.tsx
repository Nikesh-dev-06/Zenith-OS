import { useState, useEffect } from 'react'
import { FolderOpen, FileText, CheckCircle, Receipt, Download, Clock, CheckCheck, XCircle, IndianRupee } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Progress, InvoiceStatusBadge, ApprovalStatusBadge, Modal } from '../components/ui/index'
import { formatCurrency, formatDate, formatFileSize, getFileIcon } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'

export default function ClientPortalPage() {
  const { user } = useAuth()

  const [projects, setProjects] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [approvals, setApprovals] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [clientDetails, setClientDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [approvalModal, setApprovalModal] = useState<string | null>(null)
  const [comment, setComment] = useState('')

  // Razorpay payment states
  const [showRazorpay, setShowRazorpay] = useState(false)
  const [payStep, setPayStep] = useState<'method' | 'processing' | 'success'>('method')
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [paymentOrderId, setPaymentOrderId] = useState<string>('')

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
  }, [user])

  const handleApprovalResponse = async (status: 'approved' | 'revision_requested') => {
    if (!approvalModal) return
    try {
      await api.put(`/approvals/${approvalModal}/respond`, {
        status,
        clientComment: comment
      })
      setApprovalModal(null)
      setComment('')
      // Refresh data
      fetchData()
    } catch (err: any) {
      alert(err.response?.data?.error || err.message)
    }
  }

  const handleStartPayment = async (inv: any) => {
    try {
      setSelectedInvoice(inv)
      const res = await api.post('/payments/create-order', { invoiceId: inv.id })
      setPaymentOrderId(res.data.order.id)
      setPayStep('method')
      setShowRazorpay(true)
    } catch (err: any) {
      alert(err.response?.data?.error || err.message)
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
      alert(err.response?.data?.error || err.message)
      setPayStep('method')
    }
  }

  const selectedApproval = approvals.find(a => a.id === approvalModal)

  const paymentMethods = [
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

        {/* Pending Approvals */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Approvals Needed</h2>
          {pendingApprovalsCount === 0 ? (
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
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer"
                      onClick={() => setApprovalModal(approval.id)}
                    >
                      <CheckCheck size={13} /> Approve
                    </button>
                    <button
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setApprovalModal(approval.id)}
                    >
                      <XCircle size={13} /> Request Changes
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
                    {inv.status !== 'paid' ? (
                      <button 
                        className="btn-primary text-xs py-1.5 px-3 cursor-pointer"
                        onClick={() => handleStartPayment(inv)}
                      >
                        Pay Now
                      </button>
                    ) : (
                      <button 
                        className="btn-ghost text-xs py-1.5 px-2 text-slate-500 cursor-pointer"
                        onClick={() => alert('PDF generation is simulated for this environment.')}
                      >
                        <Download size={12} /> Receipt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Approval Response Modal */}
      <Modal open={!!approvalModal} onClose={() => setApprovalModal(null)} title="Respond to Approval" size="md">
        {selectedApproval && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-navy-900 mb-1">{selectedApproval.title}</p>
              <p className="text-xs text-slate-500">{selectedApproval.description}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Your Comment</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="input h-24 resize-none"
                placeholder="Add a comment or note for the team..."
              />
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer"
                onClick={() => handleApprovalResponse('approved')}
              >
                <CheckCheck size={15} /> Approve
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                onClick={() => handleApprovalResponse('revision_requested')}
              >
                <XCircle size={15} /> Request Changes
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Razorpay Simulation Modal */}
      <Modal open={showRazorpay} onClose={() => { setShowRazorpay(false); setPayStep('method'); }} title="Simulate Payment" size="sm">
        {payStep === 'method' && selectedInvoice && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-navy-900">{formatCurrency(selectedInvoice.total)}</p>
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
              Pay {formatCurrency(selectedInvoice.total)}
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

        {payStep === 'success' && selectedInvoice && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-emerald-100">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-navy-900 mb-0.5">Payment Successful!</p>
            <p className="text-xs text-slate-500 mb-4">{formatCurrency(selectedInvoice.total)} received successfully.</p>
            <button
              className="btn-primary justify-center w-full cursor-pointer"
              onClick={() => { setShowRazorpay(false); setPayStep('method'); setSelectedInvoice(null); }}
            >
              Close
            </button>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
