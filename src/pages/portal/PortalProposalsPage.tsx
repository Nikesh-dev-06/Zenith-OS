import { useState, useEffect } from 'react'
import { FileText, Send, Calendar, CheckSquare, Clock } from 'lucide-react'
import { Layout } from '../../components/layout/Layout'
import { EmptyState, Skeleton, Modal, InvoiceStatusBadge } from '../../components/ui/index'
import { formatCurrency, formatDate } from '../../lib/utils'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useLanguage } from '../../context/LanguageContext'

export default function PortalProposalsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const isViewer = user?.role === 'client_viewer'
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<'received' | 'requests'>('received')

  // Received Proposals (Admin -> Client)
  const [proposals, setProposals] = useState<any[]>([])
  const [loadingProposals, setLoadingProposals] = useState(true)
  const [selectedProposal, setSelectedProposal] = useState<any>(null)
  const [signModal, setSignModal] = useState(false)
  const [signature, setSignature] = useState('')
  const [consent, setConsent] = useState(false)

  // Submitted Requests (Client -> Admin)
  const [requests, setRequests] = useState<any[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [requestModal, setRequestModal] = useState(false)
  const [reqTitle, setReqTitle] = useState('')
  const [reqDesc, setReqDesc] = useState('')
  const [reqType, setReqType] = useState('new_project')
  const [reqBudget, setReqBudget] = useState('')

  const fetchProposals = () => {
    setLoadingProposals(true)
    api.get('/proposals')
      .then(res => {
        setProposals(res.data || [])
        setLoadingProposals(false)
      })
      .catch(err => {
        console.error('Failed to load proposals', err)
        setLoadingProposals(false)
      })
  }

  const fetchRequests = () => {
    setLoadingRequests(true)
    api.get('/client-proposals')
      .then(res => {
        setRequests(res.data || [])
        setLoadingRequests(false)
      })
      .catch(err => {
        console.error('Failed to load requests', err)
        setLoadingRequests(false)
      })
  }

  useEffect(() => {
    fetchProposals()
    fetchRequests()
  }, [])

  const handleAcceptProposal = async () => {
    if (!signature.trim() || !consent) {
      toast.error('Please enter signature and accept terms')
      return
    }
    try {
      await api.post(`/proposals/${selectedProposal.id}/accept`, { signatureText: signature })
      toast.success('Proposal accepted successfully! Invoice has been generated.')
      setSignModal(false)
      setSelectedProposal(null)
      setSignature('')
      setConsent(false)
      fetchProposals()
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const handleRejectProposal = async (id: string) => {
    try {
      await api.post(`/proposals/${id}/reject`)
      toast.success('Proposal declined.')
      fetchProposals()
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const handleSubmitRequest = async () => {
    if (!reqTitle.trim() || !reqDesc.trim()) {
      toast.error('Title and description are required')
      return
    }
    try {
      await api.post('/client-proposals', {
        title: reqTitle,
        description: reqDesc,
        type: reqType,
        estimatedBudget: Number(reqBudget) || 0
      })
      toast.success('Work request submitted successfully to agency review!')
      setRequestModal(false)
      setReqTitle('')
      setReqDesc('')
      setReqType('new_project')
      setReqBudget('')
      fetchRequests()
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  return (
    <Layout title={t('proposals')}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">{t('proposals')}</h1>
          <p className="text-slate-500 text-sm mt-1">Review agency proposals or submit new creative/project requests.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 rounded-xl p-1 text-xs">
            <button
              className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${activeTab === 'received' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('received')}
            >
              Agency Proposals ({proposals.length})
            </button>
            <button
              className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${activeTab === 'requests' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('requests')}
            >
              My Work Requests ({requests.length})
            </button>
          </div>

          {activeTab === 'requests' && (
            <button
              className="btn-primary text-xs py-2 px-4 cursor-pointer disabled:opacity-50"
              disabled={isViewer}
              onClick={() => setRequestModal(true)}
            >
              Submit Request
            </button>
          )}
        </div>
      </div>

      {activeTab === 'received' ? (
        loadingProposals ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
          </div>
        ) : proposals.length === 0 ? (
          <EmptyState
            title="No proposals found"
            description="Proposals sent by Zenith OS will display here for review."
            icon={<FileText size={48} />}
          />
        ) : (
          <div className="space-y-4">
            {proposals.map(prop => (
              <div key={prop.id} className="card p-5 border border-slate-100 hover:shadow-sm transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-wider">{prop.proposalNumber}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase
                        ${prop.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' :
                          prop.status === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                        {prop.status}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-navy-900 mt-2">{prop.title}</h3>
                    <p className="text-slate-500 text-xs mt-1">Valid Until: {formatDate(prop.validUntil)} · Estimated Budget: <span className="font-bold text-navy-900">{formatCurrency(prop.total, prop.currency)}</span></p>
                    {prop.notes && <p className="text-slate-600 text-xs mt-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100/50 italic">"{prop.notes}"</p>}
                  </div>

                  {prop.status === 'sent' && (
                    <div className="flex items-center gap-2">
                      <button
                        className="btn-primary text-xs py-2 px-3 cursor-pointer disabled:opacity-50"
                        disabled={isViewer}
                        onClick={() => { setSelectedProposal(prop); setSignModal(true); }}
                      >
                        Review & Sign SOW
                      </button>
                      <button
                        className="btn-secondary text-xs py-2 px-3 border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-100 cursor-pointer disabled:opacity-50"
                        disabled={isViewer}
                        onClick={() => handleRejectProposal(prop.id)}
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {prop.status === 'accepted' && prop.signedAt && (
                    <div className="text-xs text-slate-400 border-l border-slate-150 pl-4">
                      <p className="font-semibold text-emerald-600">✓ Accepted & Signed</p>
                      <p className="font-mono text-[10px] mt-0.5">By: {prop.signatureText}</p>
                      <p className="text-[9px] mt-0.5">{formatDate(prop.signedAt)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        loadingRequests ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            title="No work requests submitted"
            description="Need project scope enhancements or creative requests? Click Submit Request."
            icon={<Send size={48} />}
          />
        ) : (
          <div className="space-y-4">
            {requests.map(req => (
              <div key={req.id} className="card p-5 border border-slate-100">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full uppercase tracking-wider">{req.type.replace('_', ' ')}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase
                        ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                          req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                          req.status === 'reviewed' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                        {req.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-navy-900 mt-2">{req.title}</h3>
                    <p className="text-slate-650 text-xs mt-1.5 leading-relaxed">{req.description}</p>
                    {req.estimatedBudget > 0 && (
                      <p className="text-xs text-slate-500 mt-2">Requested Budget: <span className="font-bold text-navy-950">{formatCurrency(req.estimatedBudget)}</span></p>
                    )}
                    {req.adminComment && (
                      <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs text-slate-700">
                        <span className="font-semibold text-slate-600 block">Agency Response:</span>
                        "{req.adminComment}"
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 text-right">
                    <p>Submitted: {formatDate(req.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Review & E-Sign Proposal Modal */}
      <Modal open={signModal} onClose={() => { setSignModal(false); setSelectedProposal(null); }} title="Review & E-Sign Proposal" size="md">
        {selectedProposal && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">Items Breakdown</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="text-left pb-2">Description</th>
                    <th className="text-right pb-2">Qty</th>
                    <th className="text-right pb-2">Rate</th>
                    <th className="text-right pb-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProposal.items?.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100 text-slate-600">
                      <td className="py-2">{item.description}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">{formatCurrency(item.rate, selectedProposal.currency)}</td>
                      <td className="py-2 text-right font-medium text-navy-900">{formatCurrency(item.amount, selectedProposal.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-slate-200 mt-2 pt-2 text-right font-bold text-navy-900 text-sm">
                Total Value: {formatCurrency(selectedProposal.total, selectedProposal.currency)}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Type Full Name for E-Sign *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. John Doe"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                />
              </div>

              <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <input
                  type="checkbox"
                  id="propConsent"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <label htmlFor="propConsent" className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed cursor-pointer select-none">
                  I agree that checking this box and typing my name constitutes a binding digital signature approving this Scope of Work.
                </label>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button className="flex-1 btn-secondary text-xs cursor-pointer py-2" onClick={() => { setSignModal(false); setSelectedProposal(null); }}>Cancel</button>
              <button
                className="flex-2 btn-primary text-xs justify-center cursor-pointer disabled:opacity-50"
                disabled={!signature.trim() || !consent}
                onClick={handleAcceptProposal}
              >
                Sign & Accept Scope of Work
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Submit Work Request Proposal Modal */}
      <Modal open={requestModal} onClose={() => setRequestModal(false)} title="Submit Work Request / Change Proposal" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Request Title *</label>
            <input
              type="text"
              className="input text-xs"
              placeholder="e.g. Website Phase 2 Enhancement"
              value={reqTitle}
              onChange={(e) => setReqTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Request Type</label>
              <select
                className="input text-xs"
                value={reqType}
                onChange={(e) => setReqType(e.target.value)}
              >
                <option value="new_project">New Project Request</option>
                <option value="change_request">Change Request</option>
                <option value="enhancement">Enhancement Proposal</option>
                <option value="creative">Creative Design Request</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Estimated Budget (Optional)</label>
              <input
                type="number"
                className="input text-xs"
                placeholder="Budget allocation estimation"
                value={reqBudget}
                onChange={(e) => setReqBudget(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Description *</label>
            <textarea
              className="input text-xs h-28 resize-none"
              placeholder="Provide complete requirements, goals, references, and deadline constraints..."
              value={reqDesc}
              onChange={(e) => setReqDesc(e.target.value)}
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button className="flex-1 btn-secondary text-xs cursor-pointer py-2" onClick={() => setRequestModal(false)}>Cancel</button>
            <button
              className="flex-1 btn-primary text-xs justify-center cursor-pointer disabled:opacity-50"
              disabled={!reqTitle.trim() || !reqDesc.trim()}
              onClick={handleSubmitRequest}
            >
              Submit Project Request
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
