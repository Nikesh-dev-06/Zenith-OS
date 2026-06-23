import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Modal, EmptyState } from '../components/ui/index'
import { formatDate } from '../lib/utils'
import { FileText, Check, X, Plus, ShieldCheck, PenTool } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const fonts = [
  { id: 'font-1', name: 'Elegant Script', family: "'Brush Script MT', cursive, sans-serif" },
  { id: 'font-2', name: 'Calligraphy', family: "'Lucida Handwriting', cursive, sans-serif" },
  { id: 'font-3', name: 'Modern Cursive', family: "cursive, sans-serif" }
]

export default function ContractsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const isAgency = !['client', 'client_viewer'].includes(user?.role || '')

  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  
  // Create state
  const [createOpen, setCreateOpen] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  
  // Contract Form Fields
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [content, setContent] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [notes, setNotes] = useState('')

  // Sign state
  const [signOpen, setSignOpen] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signatureText, setSignatureText] = useState('')
  const [selectedFont, setSelectedFont] = useState('font-1')

  const fetchContracts = () => {
    setLoading(true)
    api.get('/contracts')
      .then(res => {
        setContracts(res.data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchContracts()
    if (isAgency) {
      api.get('/clients').then(res => setClients(res.data.clients || res.data)).catch(console.error)
      api.get('/projects').then(res => setProjects(res.data.projects || res.data)).catch(console.error)
    }
  }, [isAgency])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !clientId || !content) {
      toast.error('Please fill in all required fields.')
      return
    }

    const payload = {
      title,
      clientId,
      projectId: projectId || undefined,
      content,
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validTo: validTo ? new Date(validTo) : undefined,
      notes,
    }

    api.post('/contracts', payload)
      .then(() => {
        fetchContracts()
        setCreateOpen(false)
        resetForm()
        toast.success('Contract draft created successfully.')
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.message)
      })
  }

  const resetForm = () => {
    setTitle('')
    setClientId('')
    setProjectId('')
    setContent('')
    setValidFrom('')
    setValidTo('')
    setNotes('')
  }

  const handleSignContract = () => {
    if (!signerName.trim() || !signatureText.trim()) {
      toast.error('Signer name and initials are required.')
      return
    }
    api.post(`/contracts/${selected}/sign`, {
      signerName,
      signatureText,
      signatureDrawn: `FONT:${selectedFont}`
    })
      .then(() => {
        fetchContracts()
        setSignOpen(false)
        setSelected(null)
        setSignerName('')
        setSignatureText('')
        toast.success('Contract signed successfully!')
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.message)
      })
  }

  const selectedContract = contracts.find(c => c.id === selected)

  return (
    <Layout title="Contracts SOW">
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title text-2xl font-bold text-slate-800">SOW Contracts</h1>
          <p className="page-subtitle text-sm text-slate-500">Manage legal statements of work, master agreements and e-signatures.</p>
        </div>
        {isAgency && (
          <button onClick={() => setCreateOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Contract / SOW
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">Loading contracts...</div>
      ) : contracts.length === 0 ? (
        <EmptyState icon={<PenTool size={48} />} title="No SOW Contracts found" description="Configure agreements and project scopes for legal client sign-off." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {contracts.map(contract => (
              <div 
                key={contract.id} 
                className={`card p-5 cursor-pointer border hover:shadow-md transition-all ${selected === contract.id ? 'border-orange-500 bg-orange-50/10' : 'border-slate-200'}`}
                onClick={() => setSelected(contract.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-base">{contract.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{contract.contractNumber} · {contract.validFrom ? `From ${formatDate(contract.validFrom)}` : ''} {contract.validTo ? `To ${formatDate(contract.validTo)}` : ''}</p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                    contract.status === 'signed' ? 'bg-emerald-100 text-emerald-800' :
                    contract.status === 'terminated' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {contract.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-4">
                  <div className="text-slate-500">Client: <span className="font-medium text-slate-800">{contract.clientName}</span></div>
                  <div className="text-xs text-slate-400">{contract.projectName ? `Project: ${contract.projectName}` : 'Standalone Agreement'}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-1">
            {selectedContract ? (
              <div className="card p-6 border border-slate-200 sticky top-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                  <h2 className="font-bold text-slate-800 text-lg">SOW Details</h2>
                  <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Number</span>
                    <p className="font-medium text-slate-800">{selectedContract.contractNumber}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Title</span>
                    <p className="font-medium text-slate-800">{selectedContract.title}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Client</span>
                    <p className="font-medium text-slate-800">{selectedContract.clientName}</p>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Agreement Content</span>
                    <div className="mt-2 bg-slate-50 border border-slate-100 rounded-xl p-3.5 max-h-60 overflow-y-auto text-xs text-slate-700 leading-relaxed font-mono whitespace-pre-wrap">
                      {selectedContract.content}
                    </div>
                  </div>

                  {selectedContract.notes && (
                    <div className="bg-amber-50/40 p-3 rounded-lg text-xs text-slate-500">
                      <p className="font-semibold mb-1 text-slate-600">Special Provisions</p>
                      {selectedContract.notes}
                    </div>
                  )}

                  {selectedContract.status === 'signed' ? (
                    <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100 flex items-start gap-3 mt-4">
                      <ShieldCheck className="text-emerald-600 flex-shrink-0 mt-0.5" size={18} />
                      <div>
                        <p className="font-bold text-xs">Agreement Legally Signed</p>
                        <p className="text-xs font-medium mt-1">Signer: <span className="font-semibold">{selectedContract.signerName}</span></p>
                        <p className="text-xs font-medium">Initials: <span className="font-semibold">{selectedContract.signatureText}</span></p>
                        <p className="text-[10px] text-emerald-600 mt-1">Timestamp: {formatDate(selectedContract.signedAt)}</p>
                      </div>
                    </div>
                  ) : (
                    !isAgency && (
                      <div className="mt-6 pt-4 border-t border-slate-100">
                        <button onClick={() => setSignOpen(true)} className="btn-primary w-full flex justify-center items-center gap-1.5 cursor-pointer">
                          <PenTool size={15} /> Sign SOW Agreement
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="card p-6 border border-slate-200 text-center text-slate-400">
                Select a contract agreement to view specifications
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create SOW Agreement / Contract" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Contract / SOW Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Master Service Agreement 2026" className="w-full text-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Client *</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} required className="w-full text-slate-800">
                <option value="">Select Client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Project Link (Optional)</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full text-slate-800">
                <option value="">No Project Link (Standalone)</option>
                {projects.filter(p => !clientId || p.clientId === clientId).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Valid From</label>
              <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="w-full text-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Valid To</label>
              <input type="date" value={validTo} onChange={e => setValidTo(e.target.value)} className="w-full text-slate-800" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Contract Terms / Statement of Work Content *</label>
            <textarea rows={8} value={content} onChange={e => setContent(e.target.value)} required placeholder="Enter statement of work milestones, deliverables details, SLA guidelines and cancelation clauses..." className="w-full text-slate-800 rounded-xl font-mono text-xs" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Provisions Notes (Internal/Optional)</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Requires manager approval before signature update..." className="w-full text-slate-800 rounded-xl" />
          </div>

          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create Draft SOW</button>
          </div>
        </form>
      </Modal>

      {/* SIGN MODAL */}
      <Modal open={signOpen} onClose={() => setSignOpen(false)} title="Sign Statement of Work (SOW)" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">I declare that this e-signature serves as a binding verification of the deliverables scope and general terms listed in this document.</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Authorized Signer Name *</label>
              <input 
                type="text" 
                value={signerName} 
                onChange={e => setSignerName(e.target.value)} 
                placeholder="e.g. Johnathan Doe" 
                className="w-full text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Signature Initials / Code *</label>
              <input 
                type="text" 
                value={signatureText} 
                onChange={e => setSignatureText(e.target.value)} 
                placeholder="e.g. JD" 
                className="w-full text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Signature Font Style</label>
            <div className="grid grid-cols-3 gap-2">
              {fonts.map(font => (
                <button
                  key={font.id}
                  onClick={() => setSelectedFont(font.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    selectedFont === font.id ? 'border-orange-500 bg-orange-50/20' : 'border-slate-200'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 block mb-1">{font.name}</span>
                  <span style={{ fontFamily: font.family }} className="text-lg whitespace-nowrap">
                    {signerName || 'Signature'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {signerName && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center mt-2 animate-pulse">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Signature Agreement Stamp</span>
              <p 
                style={{ fontFamily: fonts.find(f => f.id === selectedFont)?.family }} 
                className="text-2xl text-orange-600 py-3"
              >
                {signerName}
              </p>
              <span className="text-[10px] text-slate-400 font-medium">Initials ID: {signatureText || '—'}</span>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
            <button onClick={() => setSignOpen(false)} className="btn-secondary">Cancel</button>
            <button 
              onClick={handleSignContract} 
              disabled={!signerName.trim() || !signatureText.trim()}
              className="btn-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign & Execute SOW
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
