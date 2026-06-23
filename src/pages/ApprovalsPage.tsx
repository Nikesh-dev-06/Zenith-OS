import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, MessageSquare, FileText, CheckCheck } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { ApprovalStatusBadge, EmptyState, Modal } from '../components/ui/index'
import { formatRelativeTime } from '../lib/utils'
import type { ApprovalStatus } from '../types'
import api from '../lib/api'
import { useToast } from '../context/ToastContext'

const fonts = [
  { id: 'font-1', name: 'Elegant Script', family: "'Brush Script MT', cursive, sans-serif" },
  { id: 'font-2', name: 'Calligraphy', family: "'Lucida Handwriting', cursive, sans-serif" },
  { id: 'font-3', name: 'Modern Cursive', family: "cursive, sans-serif" }
]

export default function ApprovalsPage() {
  const toast = useToast()
  const [filter, setFilter] = useState<ApprovalStatus | 'all'>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchApprovals = () => {
    api.get('/approvals')
      .then(res => {
        setApprovals(res.data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchApprovals()
  }, [])

  const handleRespond = (id: string, status: 'approved' | 'revision_requested') => {
    api.put(`/approvals/${id}/respond`, { status, clientComment: comment })
      .then(() => {
        fetchApprovals()
        setSelected(null)
        setComment('')
        toast.success(`Approval request updated.`)
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.message)
      })
  }

  const filtered = approvals.filter(a => filter === 'all' || a.status === filter)
  const selectedApproval = approvals.find(a => a.id === selected)

  const statusMap: Record<ApprovalStatus, string> = {
    pending_review: 'Pending Review',
    approved: 'Approved',
    revision_requested: 'Revision Requested',
  }

  return (
    <Layout title="Approvals">
      <div className="page-header">
        <h1 className="page-title">Approvals</h1>
        <p className="page-subtitle">{approvals.filter(a => a.status === 'pending_review').length} pending client approvals</p>
      </div>

      {/* Filters */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6">
        {(['all', 'pending_review', 'approved', 'revision_requested'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${filter === s ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {s === 'all' ? 'All' : statusMap[s]}
            {s !== 'all' && <span className="ml-1.5 text-xs">({approvals.filter(a => a.status === s).length})</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="✅" title="No approvals" description="Approval requests will appear here when deliverables are ready for client review." />
      ) : (
        <div className="space-y-3">
          {filtered.map(approval => (
            <div key={approval.id} className="card-hover p-5 cursor-pointer" onClick={() => setSelected(approval.id)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    {approval.status === 'pending_review' && <Clock size={15} className="text-amber-500 flex-shrink-0" />}
                    {approval.status === 'approved' && <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />}
                    {approval.status === 'revision_requested' && <XCircle size={15} className="text-rose-500 flex-shrink-0" />}
                    <h3 className="font-semibold text-navy-900 text-sm">{approval.title}</h3>
                    <ApprovalStatusBadge status={approval.status} />
                  </div>
                  <p className="text-xs text-slate-500 mb-2">{approval.clientName} · {approval.projectName}</p>
                  <p className="text-xs text-slate-600 line-clamp-2">{approval.description}</p>

                  {approval.comment && (
                    <div className="mt-3 bg-slate-50 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                      <MessageSquare size={12} className="text-slate-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-600 italic">"{approval.comment}"</p>
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-400">{formatRelativeTime(approval.requestedAt)}</p>
                  {approval.status === 'pending_review' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        className="btn-secondary text-xs py-1.5 px-3 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        onClick={e => { e.stopPropagation(); handleRespond(approval.id, 'approved') }}
                      >
                        <CheckCircle size={13} /> Approve
                      </button>
                      <button
                        className="btn-secondary text-xs py-1.5 px-3 text-rose-600 border-rose-200 hover:bg-rose-50"
                        onClick={e => { e.stopPropagation(); handleRespond(approval.id, 'revision_requested') }}
                      >
                        <XCircle size={13} /> Request Changes
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approval Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Approval Request" size="lg">
        {selectedApproval && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-navy-900 mb-1">{selectedApproval.title}</h3>
              <div className="flex items-center gap-2 mb-3">
                <ApprovalStatusBadge status={selectedApproval.status} />
                <span className="text-xs text-slate-500">{selectedApproval.clientName} · {selectedApproval.projectName}</span>
              </div>
              <p className="text-sm text-slate-600">{selectedApproval.description}</p>
            </div>

            {/* Files (if any) */}
            {selectedApproval.fileIds && selectedApproval.fileIds.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Attached Files</p>
                {selectedApproval.fileIds.map((file: any) => (
                  <div key={file._id || file.id} className="flex items-start gap-2.5 p-2 bg-white rounded-lg border border-slate-100 mb-1.5">
                    <FileText size={16} className="text-rose-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-navy-900 font-medium block">{file.name}</span>
                      {file.description && <span className="text-xs text-slate-500 mt-0.5 block">{file.description}</span>}
                    </div>
                    <button className="text-xs text-orange-600 font-semibold hover:underline mt-0.5" onClick={() => window.open(`http://localhost:5000/api/files/download-raw/${file._id || file.id}`, '_blank')}>Download</button>
                  </div>
                ))}
              </div>
            )}

            {selectedApproval.comment && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">Client Comment</p>
                <p className="text-sm text-amber-800">"{selectedApproval.comment}"</p>
              </div>
            )}

            {selectedApproval.status === 'approved' && (selectedApproval.signatureText || selectedApproval.signatureDrawn) && (
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 flex items-center gap-3">
                {selectedApproval.signatureDrawn && selectedApproval.signatureDrawn.startsWith('STAMP:') ? (
                  <div className="flex-shrink-0 bg-white rounded-full p-1 border border-emerald-200">
                    <svg width="48" height="48" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#10B981" strokeWidth="3" strokeDasharray="3,3" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#10B981" strokeWidth="1.5" />
                      <text x="50" y="47" textAnchor="middle" fill="#10B981" fontSize="22" fontWeight="bold" fontFamily="sans-serif">
                        {selectedApproval.signatureDrawn.split(':')[1] || 'JD'}
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
                  <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                    <CheckCheck size={14} /> Digitally Signed & Verified
                  </div>
                  {selectedApproval.signatureText && (
                    <p className="text-base text-slate-800 font-medium italic my-0.5" style={{ fontFamily: selectedApproval.signatureDrawn?.startsWith('FONT:') ? fonts.find(f => f.id === selectedApproval.signatureDrawn.split(':')[1])?.family || 'cursive' : 'cursive' }}>
                      {selectedApproval.signatureText}
                    </p>
                  )}
                  {selectedApproval.signedAt && (
                    <p className="text-[10px] text-slate-400">Timestamp: {new Date(selectedApproval.signedAt).toLocaleString()}</p>
                  )}
                </div>
              </div>
            )}

            {selectedApproval.status === 'pending_review' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Add Comment (optional)</label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  className="input h-20 resize-none"
                  placeholder="Leave a note with your decision..."
                />
                <div className="flex gap-3 mt-3">
                  <button className="flex-1 btn-secondary text-emerald-600 border-emerald-200 hover:bg-emerald-50 justify-center" onClick={() => handleRespond(selectedApproval.id, 'approved')}>
                    <CheckCircle size={15} /> Approve
                  </button>
                  <button className="flex-1 btn-secondary text-rose-600 border-rose-200 hover:bg-rose-50 justify-center" onClick={() => handleRespond(selectedApproval.id, 'revision_requested')}>
                    <XCircle size={15} /> Request Revision
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  )
}

