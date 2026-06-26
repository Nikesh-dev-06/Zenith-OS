import { useState, useEffect } from 'react'
import { 
  CheckCircle, Clock, CheckCheck, XCircle, Plus, FileText, 
  Paperclip, Calendar, AlertTriangle, User, Download, Send, RefreshCw 
} from 'lucide-react'
import { Layout } from '../../components/layout/Layout'
import { Progress, ApprovalStatusBadge, Modal, EmptyState } from '../../components/ui/index'
import { formatDate, formatRelativeTime } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useLanguage } from '../../context/LanguageContext'
import api from '../../lib/api'

const fonts = [
  { id: 'font-1', name: 'Elegant Script', family: "'Brush Script MT', cursive, sans-serif" },
  { id: 'font-2', name: 'Calligraphy', family: "'Lucida Handwriting', cursive, sans-serif" },
  { id: 'font-3', name: 'Modern Cursive', family: "cursive, sans-serif" }
]

export default function PortalApprovalsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const isViewer = user?.role === 'client_viewer'
  const toast = useToast()

  const [approvals, setApprovals] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Tab control
  const [approvalTab, setApprovalTab] = useState<'awaiting_my_action' | 'my_sent_requests' | 'completed'>('awaiting_my_action')
  
  // Detail and response modals
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null)
  const [responseModalAction, setResponseModalAction] = useState<'approve' | 'revision' | 'reject' | null>(null)
  
  // Comment states
  const [responseComment, setResponseComment] = useState('')
  const [generalComment, setGeneralComment] = useState('')

  // E-Signature state variables
  const [sigType, setSigType] = useState<'typed' | 'drawn'>('typed')
  const [typedName, setTypedName] = useState('')
  const [selectedFont, setSelectedFont] = useState('font-1')
  const [initials, setInitials] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [sigProvider, setSigProvider] = useState<'local' | 'docusign' | 'zohosign'>('local')

  // Request creation modal form states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createProjectId, setCreateProjectId] = useState('')
  const [createRequestType, setCreateRequestType] = useState('change_request')
  const [createPriority, setCreatePriority] = useState('medium')
  const [createDueDate, setCreateDueDate] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchApprovals = () => {
    setLoading(true)
    api.get('/approvals?limit=100')
      .then(res => {
        setApprovals(res.data || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load approvals', err)
        setLoading(false)
      })
  }

  const fetchProjects = () => {
    api.get('/projects?limit=100')
      .then(res => {
        setProjects(res.data.projects || [])
      })
      .catch(err => {
        console.error('Failed to load projects', err)
      })
  }

  useEffect(() => {
    fetchApprovals()
    fetchProjects()
  }, [])

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
          const cleanUrl = window.location.pathname
          window.history.replaceState({}, document.title, cleanUrl)
          fetchApprovals()
        })
        .catch(err => {
          toast.error(err.response?.data?.error || err.message)
        })
    }
  }, [user])

  const resetForm = () => {
    setCreateTitle('')
    setCreateDescription('')
    setCreateProjectId('')
    setCreateRequestType('change_request')
    setCreatePriority('medium')
    setCreateDueDate('')
    setSelectedFiles(null)
  }

  const handleCreateApproval = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createTitle || !createProjectId || !createRequestType) {
      toast.error('Please fill in all required fields.')
      return
    }
    setIsSubmitting(true)
    try {
      let uploadedFileIds: string[] = []
      if (selectedFiles && selectedFiles.length > 0) {
        const formData = new FormData()
        for (let i = 0; i < selectedFiles.length; i++) {
          formData.append('files', selectedFiles[i])
        }
        formData.append('projectId', createProjectId)
        formData.append('isClientVisible', 'true')
        
        const uploadRes = await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        const uploadedFiles = Array.isArray(uploadRes.data) ? uploadRes.data : [uploadRes.data]
        uploadedFileIds = uploadedFiles.map((f: any) => f.id || f._id)
      }

      const payload = {
        title: createTitle,
        description: createDescription,
        projectId: createProjectId,
        requestType: createRequestType,
        priority: createPriority,
        dueDate: createDueDate || undefined,
        fileIds: uploadedFileIds
      }

      await api.post('/approvals', payload)
      toast.success('Approval request sent to Admin.')
      setShowCreateModal(false)
      resetForm()
      fetchApprovals()
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApprovalResponse = async (status: 'approved' | 'rejected' | 'revision_requested') => {
    if (!selectedApprovalId) return

    if (['rejected', 'revision_requested'].includes(status) && !responseComment.trim()) {
      toast.error('Comments are mandatory when rejecting or requesting revisions.')
      return
    }

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
      await api.put(`/approvals/${selectedApprovalId}/respond`, {
        status,
        clientComment: responseComment,
        signatureText: status === 'approved' && sigType === 'typed' ? typedName : undefined,
        signatureDrawn: status === 'approved' ? (sigType === 'drawn' ? `STAMP:${initials.toUpperCase()}` : `FONT:${selectedFont}`) : undefined
      })
      
      setSelectedApprovalId(null)
      setResponseComment('')
      setTypedName('')
      setInitials('')
      setAgreed(false)
      setResponseModalAction(null)
      fetchApprovals()
      toast.success(status === 'approved' ? t('assetApprovedAndSigned') : t('revisionRequested'))
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const handleAddComment = (id: string) => {
    if (!generalComment.trim()) return

    api.post(`/approvals/${id}/comment`, { comment: generalComment })
      .then(res => {
        setGeneralComment('')
        setApprovals(prev => prev.map(a => a.id === id ? res.data : a))
        toast.success('Comment added to timeline.')
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.message)
      })
  }

  const handleCancelRequest = (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this request?')) return

    api.put(`/approvals/${id}/cancel`)
      .then(() => {
        fetchApprovals()
        setSelectedApprovalId(null)
        toast.success('Request cancelled successfully.')
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.message)
      })
  }

  const selectedApproval = approvals.find(a => a.id === selectedApprovalId)

  // Segmenting approvals
  const awaitingMyAction = approvals.filter(a => a.status === 'pending_client_approval')
  const mySentRequests = approvals.filter(a => ['pending_admin_approval', 'pending_review', 'draft'].includes(a.status))
  const completedHistory = approvals.filter(a => ['approved', 'rejected', 'revision_requested', 'cancelled'].includes(a.status))

  const activeList = 
    approvalTab === 'awaiting_my_action' ? awaitingMyAction :
    approvalTab === 'my_sent_requests' ? mySentRequests : completedHistory

  const getActionText = (action: string) => {
    switch (action) {
      case 'created': return 'created the request'
      case 'approved': return 'approved & signed'
      case 'rejected': return 'rejected the request'
      case 'revision_requested': return 'requested revision / more details'
      case 'comment_added': return 'added a comment'
      case 'cancelled': return 'cancelled the request'
      default: return action
    }
  }

  return (
    <Layout title={t('approvals')}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">{t('approvals')}</h1>
          <p className="text-slate-500 text-sm mt-1">Review, sign, and request changes, or create work approval requests.</p>
        </div>
        <div className="flex gap-2 items-center">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="btn-primary flex items-center gap-1.5 cursor-pointer text-xs py-2 px-3 disabled:opacity-50"
            disabled={isViewer}
          >
            <Plus size={14} /> New Request
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 text-xs w-fit mb-6">
        <button
          type="button"
          className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${approvalTab === 'awaiting_my_action' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setApprovalTab('awaiting_my_action')}
        >
          Awaiting My Action ({awaitingMyAction.length})
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${approvalTab === 'my_sent_requests' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setApprovalTab('my_sent_requests')}
        >
          My Sent Requests ({mySentRequests.length})
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${approvalTab === 'completed' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setApprovalTab('completed')}
        >
          History & Archives ({completedHistory.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      ) : activeList.length === 0 ? (
        <EmptyState
          title="No approval records"
          description="There are no approval items matching this category at the moment."
          icon={<CheckCircle size={48} className="text-slate-350" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeList.map(approval => (
            <div 
              key={approval.id} 
              className="card p-5 border border-slate-100 hover:border-slate-200 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full uppercase tracking-wider">{approval.projectName}</span>
                    <h3 className="text-base font-bold text-navy-900 mt-1.5">{approval.title}</h3>
                  </div>
                  <ApprovalStatusBadge status={approval.status} />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3 line-clamp-3">{approval.description}</p>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-semibold mb-4 border-t border-slate-50 pt-2">
                  <span>Type: <span className="text-navy-900">{approval.requestType?.toUpperCase()}</span></span>
                  <span>&middot;</span>
                  <span>Submitted: <span className="text-navy-900">{formatDate(approval.createdAt)}</span></span>
                  <span>&middot;</span>
                  <span>Priority: <span className="text-navy-900">{approval.priority}</span></span>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer"
                  onClick={() => { setSelectedApprovalId(approval.id); setResponseModalAction(null); }}
                >
                  View Details
                </button>
                {approval.status === 'pending_client_approval' && (
                  <button
                    className="flex-1 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-all cursor-pointer disabled:opacity-50"
                    onClick={() => { setSelectedApprovalId(approval.id); setResponseModalAction('approve'); }}
                    disabled={isViewer}
                  >
                    Approve & Sign
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); resetForm(); }} title="Submit Approval Request" size="lg">
        <form onSubmit={handleCreateApproval} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Related Project *</label>
              <select 
                value={createProjectId} 
                onChange={e => setCreateProjectId(e.target.value)} 
                className="input"
                required
              >
                <option value="">Select Project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Request Type *</label>
              <select 
                value={createRequestType} 
                onChange={e => setCreateRequestType(e.target.value)} 
                className="input"
                required
              >
                <option value="project_request">New Project Request</option>
                <option value="change_request">Change Request</option>
                <option value="design_revision">Design Revision Request</option>
                <option value="content_approval">Content Approval Submission</option>
                <option value="scope_change">Scope Change Request</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Request Title *</label>
            <input 
              type="text" 
              value={createTitle} 
              onChange={e => setCreateTitle(e.target.value)} 
              className="input" 
              placeholder="e.g. Website Pricing section copy signoff"
              required 
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Description *</label>
            <textarea 
              value={createDescription} 
              onChange={e => setCreateDescription(e.target.value)} 
              className="input h-24 resize-none" 
              placeholder="Describe exactly what needs administrative review and approval..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
              <select 
                value={createPriority} 
                onChange={e => setCreatePriority(e.target.value)} 
                className="input"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Required Due Date</label>
              <input 
                type="date" 
                value={createDueDate} 
                onChange={e => setCreateDueDate(e.target.value)} 
                className="input" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Attach Supporting Files</label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors">
              <input 
                type="file" 
                multiple 
                onChange={e => setSelectedFiles(e.target.files)} 
                className="hidden" 
                id="clientCreationAttachments" 
              />
              <label htmlFor="clientCreationAttachments" className="cursor-pointer text-center">
                <Paperclip className="mx-auto text-slate-400 mb-2" size={24} />
                <span className="text-xs font-bold text-orange-600 hover:underline block">Attach design drafts, PDF copy, etc.</span>
              </label>
              {selectedFiles && selectedFiles.length > 0 && (
                <div className="mt-3 w-full bg-white rounded-lg border border-slate-100 p-2.5 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attached Files ({selectedFiles.length})</p>
                  {Array.from(selectedFiles).map((f, i) => (
                    <div key={i} className="text-xs text-navy-900 truncate flex items-center gap-1.5">
                      <FileText size={12} className="text-slate-400" /> {f.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button 
              type="button" 
              className="flex-1 btn-secondary justify-center py-2.5 cursor-pointer" 
              onClick={() => { setShowCreateModal(false); resetForm(); }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 btn-primary justify-center py-2.5 cursor-pointer disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Uploading & Sending...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Details & History Modal */}
      <Modal open={!!selectedApprovalId} onClose={() => { setSelectedApprovalId(null); setResponseModalAction(null); }} title="Approval Review Hub" size="lg">
        {selectedApproval && (
          <div className="space-y-5">
            {/* Header info */}
            <div className="border-b border-slate-100 pb-3 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-navy-900">{selectedApproval.title}</h3>
                <p className="text-xs text-slate-500 mt-1">Project: <span className="font-semibold text-navy-900">{selectedApproval.projectName}</span> &middot; Type: <span className="font-semibold text-navy-900">{selectedApproval.requestType?.replace('_', ' ')}</span></p>
              </div>
              <ApprovalStatusBadge status={selectedApproval.status} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left Column (Span 3): Details & Responses */}
              <div className="lg:col-span-3 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Details / Guidelines</h4>
                  <p className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-3.5 leading-relaxed">{selectedApproval.description || 'No description provided.'}</p>
                </div>

                {/* Metadata details */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50/50 rounded-xl p-3.5 border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Submitted By</span>
                    <span className="font-bold text-navy-900 flex items-center gap-1.5 mt-0.5">
                      <User size={12} className="text-slate-400" /> {selectedApproval.requestedByName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Assigned User</span>
                    <span className="font-bold text-navy-900 flex items-center gap-1.5 mt-0.5">
                      <User size={12} className="text-slate-400" /> {selectedApproval.assignedApproverName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Due Date</span>
                    <span className="font-bold text-navy-900 flex items-center gap-1.5 mt-0.5">
                      <Calendar size={12} className="text-slate-400" /> {selectedApproval.dueDate ? formatDate(selectedApproval.dueDate) : 'No deadline'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Priority</span>
                    <span className="font-bold text-navy-900 flex items-center gap-1.5 mt-0.5">
                      <AlertTriangle size={12} className="text-slate-400" /> {selectedApproval.priority}
                    </span>
                  </div>
                </div>

                {/* Attached Files */}
                {selectedApproval.fileIds && selectedApproval.fileIds.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Deliverable Files</h4>
                    <div className="space-y-1">
                      {selectedApproval.fileIds.map((file: any) => (
                        <div key={file.id || file._id} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl text-xs">
                          <span className="font-bold text-navy-900 truncate max-w-[220px]">{file.name}</span>
                          <button 
                            onClick={() => window.open(`http://localhost:5000/api/files/download-raw/${file.id || file._id}`, '_blank')}
                            className="text-orange-600 hover:text-orange-700 font-bold"
                          >
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Secure Sign-off Verification Badge/Block */}
                {selectedApproval.status === 'approved' && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900 flex items-start gap-3 mt-2 animate-fadeIn">
                    <CheckCircle className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" size={18} />
                    <div className="space-y-0.5">
                      <p className="font-bold text-xs">Approval Request Signed & Sealed</p>
                      <p className="text-xs font-medium">Signer: <span className="font-semibold text-navy-900 dark:text-white">{selectedApproval.signerName || 'Authorized Client Signer'}</span></p>
                      {selectedApproval.signatureText && (
                        <p className="text-xs font-medium">Initials: <span className="font-semibold text-navy-900 dark:text-white font-mono">{selectedApproval.signatureText}</span></p>
                      )}
                      {selectedApproval.signedAt && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Timestamp: {formatDate(selectedApproval.signedAt)}</p>
                      )}
                      {selectedApproval.signatureDrawn && selectedApproval.signatureDrawn.includes('DOCUSIGN') && (
                        <span className="block text-[9px] text-blue-600 dark:text-blue-400 font-semibold mt-1">🔒 Verified via DocuSign</span>
                      )}
                      {selectedApproval.signatureDrawn && selectedApproval.signatureDrawn.includes('ZOHOSIGN') && (
                        <span className="block text-[9px] text-emerald-650 dark:text-emerald-405 font-semibold mt-1">🔒 Verified via Zoho Sign</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Review Signature Action Panel (if pending client action) */}
                {selectedApproval.status === 'pending_client_approval' && responseModalAction === null && (
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">Execute Decision Response</h4>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer"
                        onClick={() => setResponseModalAction('approve')}
                        disabled={isViewer}
                      >
                        <CheckCheck size={14} /> Approve & Sign
                      </button>
                      <button
                        type="button"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => setResponseModalAction('revision')}
                      >
                        <XCircle size={14} /> Request Changes
                      </button>
                    </div>
                  </div>
                )}

                {/* Approve & Sign form */}
                {responseModalAction === 'approve' && (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 space-y-4 animate-fadeIn">
                    <h4 className="text-xs font-bold text-navy-900 dark:text-white uppercase tracking-wider">Digital Sign-off Consent</h4>
                    
                    {/* Provider Selection */}
                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
                      <button
                        type="button"
                        onClick={() => setSigProvider('local')}
                        className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                          sigProvider === 'local' ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-705 dark:text-slate-400'
                        }`}
                      >
                        Zenith Local
                      </button>
                      <button
                        type="button"
                        onClick={() => setSigProvider('docusign')}
                        className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                          sigProvider === 'docusign' ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-705 dark:text-slate-400'
                        }`}
                      >
                        DocuSign
                      </button>
                      <button
                        type="button"
                        onClick={() => setSigProvider('zohosign')}
                        className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                          sigProvider === 'zohosign' ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-705 dark:text-slate-400'
                        }`}
                      >
                        Zoho Sign
                      </button>
                    </div>

                    {sigProvider === 'local' ? (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 text-xs w-fit">
                          <button
                            type="button"
                            className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${sigType === 'typed' ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setSigType('typed')}
                          >
                            Type Signature
                          </button>
                          <button
                            type="button"
                            className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${sigType === 'drawn' ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setSigType('drawn')}
                          >
                            Seal Stamp
                          </button>
                        </div>

                        {sigType === 'typed' ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Type Full Name *</label>
                              <input
                                type="text"
                                className="input text-xs"
                                placeholder="e.g. John Doe"
                                value={typedName}
                                onChange={e => setTypedName(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Signature Style</label>
                              <div className="grid grid-cols-3 gap-1.5">
                                {fonts.map(f => (
                                  <button
                                    type="button"
                                    key={f.id}
                                    className={`px-2 py-1.5 rounded-lg border text-xs text-center transition-all cursor-pointer ${selectedFont === f.id ? 'border-orange-500 bg-orange-50 dark:bg-slate-800 text-orange-700 dark:text-orange-400 font-semibold' : 'border-slate-200 text-slate-600 dark:text-slate-305 hover:border-slate-300'}`}
                                    onClick={() => setSelectedFont(f.id)}
                                    style={{ fontFamily: f.family }}
                                  >
                                    Sign Style
                                  </button>
                                ))}
                              </div>
                            </div>
                            {typedName.trim() && (
                              <div className="bg-white dark:bg-slate-900 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] text-slate-400 block mb-1">Live Signature Preview</span>
                                <p className="text-2xl text-slate-800 dark:text-slate-100 italic" style={{ fontFamily: fonts.find(f => f.id === selectedFont)?.family }}>
                                  {typedName}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Type Stamp Initials (Max 3 letters) *</label>
                              <input
                                type="text"
                                className="input font-mono uppercase text-xs"
                                placeholder="e.g. JD"
                                maxLength={3}
                                value={initials}
                                onChange={e => setInitials(e.target.value)}
                              />
                            </div>
                            {initials.trim() && (
                              <div className="bg-white dark:bg-slate-900 rounded-xl p-3 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] text-slate-400 block mb-2">Live Stamp Preview</span>
                                <div className="bg-white dark:bg-slate-900 rounded-full p-1 shadow-sm border border-slate-200 dark:border-slate-700">
                                  <svg width="60" height="60" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="#10B981" strokeWidth="2.5" strokeDasharray="3,3" />
                                    <circle cx="50" cy="50" r="40" fill="none" stroke="#10B981" strokeWidth="1.5" />
                                    <text x="50" y="47" textAnchor="middle" fill="#10B981" fontSize="22" fontWeight="bold" fontFamily="sans-serif">
                                      {initials.toUpperCase()}
                                    </text>
                                    <text x="50" y="66" textAnchor="middle" fill="#10B981" fontSize="10" fontWeight="bold" fontFamily="sans-serif" letterSpacing="0.5">
                                      SIGNED
                                    </text>
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Approval Notes / Comments (Optional)</label>
                          <textarea
                            value={responseComment}
                            onChange={e => setResponseComment(e.target.value)}
                            className="input h-16 resize-none text-xs"
                            placeholder="Leave a message for the agency team..."
                          />
                        </div>

                        <div className="flex items-start gap-2 bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                          <input
                            type="checkbox"
                            id="consentCheck"
                            checked={agreed}
                            onChange={e => setAgreed(e.target.checked)}
                            className="mt-0.5"
                          />
                          <label htmlFor="consentCheck" className="text-[10px] text-slate-500 leading-relaxed cursor-pointer select-none">
                            By checking this box, I declare that I consent to verify and execute this digital signature as a legally binding sign-off.
                          </label>
                        </div>

                        <div className="flex gap-2">
                          <button type="button" className="flex-1 btn-secondary text-xs py-2 cursor-pointer" onClick={() => setResponseModalAction(null)}>Go Back</button>
                          <button
                            type="button"
                            className="flex-2 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={() => handleApprovalResponse('approved')}
                            disabled={!agreed || (sigType === 'typed' ? !typedName.trim() : !initials.trim())}
                          >
                            Confirm & Digitally Approve
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="bg-slate-100 dark:bg-slate-905 border border-slate-150 dark:border-slate-800 rounded-xl p-4">
                          <p className="text-xs font-semibold text-navy-900 dark:text-white flex items-center gap-1.5 mb-1.5">
                            🛡️ {sigProvider === 'docusign' ? 'DocuSign' : 'Zoho Sign'} Secure Signature Protocol
                          </p>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Upon clicking launch, you will be redirected to the secure {sigProvider === 'docusign' ? 'DocuSign sandbox' : 'Zoho Sign sandbox'} environment to verify, sign, and approve this deliverable legally. Once signed, you will be automatically returned to your approvals dashboard.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1">Authorized Signer Name *</label>
                          <input
                            type="text"
                            value={typedName}
                            onChange={e => setTypedName(e.target.value)}
                            placeholder="e.g. Johnathan Doe"
                            className="input text-xs"
                          />
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button type="button" className="flex-1 btn-secondary text-xs py-2 cursor-pointer" onClick={() => setResponseModalAction(null)}>Go Back</button>
                          <button
                            type="button"
                            className="flex-2 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={async () => {
                              if (!typedName.trim()) {
                                toast.error('Signer name is required.')
                                return
                              }
                              try {
                                const res = await api.post(`/approvals/${selectedApprovalId}/${sigProvider}/create-envelope`)
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
                          >
                            Launch {sigProvider === 'docusign' ? 'DocuSign' : 'Zoho Sign'} Session
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Revision request / reject form */}
                {responseModalAction === 'revision' && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3 animate-fadeIn">
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">Specify Revision Request Details</h4>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1.5">Specify modifications required *</label>
                      <textarea
                        value={responseComment}
                        onChange={e => setResponseComment(e.target.value)}
                        className="input h-20 resize-none text-xs"
                        placeholder="Provide details of changes required before this can be approved..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="flex-1 btn-secondary text-xs py-2 cursor-pointer" onClick={() => setResponseModalAction(null)}>Go Back</button>
                      <button
                        type="button"
                        className="flex-2 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-all cursor-pointer disabled:opacity-40"
                        onClick={() => handleApprovalResponse('revision_requested')}
                        disabled={!responseComment.trim()}
                      >
                        Submit Revision Request
                      </button>
                    </div>
                  </div>
                )}

                {/* Add simple Comment Panel */}
                {selectedApproval.status !== 'cancelled' && selectedApproval.status !== 'approved' && (
                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">Add Comment</h4>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={generalComment}
                        onChange={e => setGeneralComment(e.target.value)}
                        className="input flex-1 text-xs" 
                        placeholder="Add a remark to this request's timeline..." 
                        onKeyDown={e => e.key === 'Enter' && handleAddComment(selectedApproval.id)}
                      />
                      <button 
                        type="button" 
                        onClick={() => handleAddComment(selectedApproval.id)}
                        className="btn-primary py-2 px-3 flex items-center justify-center cursor-pointer"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Cancel client request */}
                {['pending_admin_approval', 'draft'].includes(selectedApproval.status) && selectedApproval.requestedBy?._id === user?.id && (
                  <div className="border-t border-slate-100 pt-4">
                    <button 
                      type="button" 
                      onClick={() => handleCancelRequest(selectedApproval.id)}
                      className="btn-secondary py-2 px-3 text-xs text-rose-600 border-rose-100 hover:bg-rose-50 flex items-center gap-1.5 justify-center w-full cursor-pointer"
                    >
                      <XCircle size={14} /> Cancel Request
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column (Span 2): Chronological History timeline */}
              <div className="lg:col-span-2 border-l border-slate-100 pl-6 space-y-4 max-h-[450px] overflow-y-auto">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Activity Timeline</h4>
                {selectedApproval.history && selectedApproval.history.length > 0 ? (
                  <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-5 py-1">
                    {selectedApproval.history.map((hist: any, idx: number) => (
                      <div key={idx} className="relative">
                        {/* Dot indicator */}
                        <span className={`absolute -left-[21px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white flex-shrink-0
                          ${hist.action === 'approved' ? 'bg-emerald-500' :
                            hist.action === 'rejected' ? 'bg-rose-500' :
                            hist.action === 'revision_requested' ? 'bg-amber-500' :
                            hist.action === 'comment_added' ? 'bg-blue-500' : 'bg-slate-400'}`} 
                        />
                        <div className="space-y-0.5">
                          <p className="text-xs text-slate-700 font-semibold">
                            <span className="font-bold text-navy-900">{hist.userName}</span>{' '}
                            <span className="text-slate-500">{getActionText(hist.action)}</span>
                          </p>
                          <p className="text-[10px] text-slate-400">{formatRelativeTime(hist.createdAt)}</p>
                          {hist.comments && (
                            <div className="bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1.5 mt-1 text-xs text-slate-650 italic">
                              "{hist.comments}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No activity logs recorded.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
