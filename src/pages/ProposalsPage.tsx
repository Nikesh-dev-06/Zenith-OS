import { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Modal, EmptyState } from '../components/ui/index'
import { formatCurrency, formatDate } from '../lib/utils'
import { FileText, Check, X, Clock, Plus, Trash2, ShieldCheck, DollarSign } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const fonts = [
  { id: 'font-1', name: 'Elegant Script', family: "'Brush Script MT', cursive, sans-serif" },
  { id: 'font-2', name: 'Calligraphy', family: "'Lucida Handwriting', cursive, sans-serif" },
  { id: 'font-3', name: 'Modern Cursive', family: "cursive, sans-serif" }
]

export default function ProposalsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const isAgency = !['client', 'client_viewer'].includes(user?.role || '')

  const [proposals, setProposals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  
  // Create state
  const [createOpen, setCreateOpen] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  
  // Proposal Form Fields
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [notes, setNotes] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [items, setItems] = useState<any[]>([{ description: '', quantity: 1, rate: 0, amount: 0 }])
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>('percent')
  const [discountValue, setDiscountValue] = useState(0)
  const [taxRate, setTaxRate] = useState(18)

  // Acceptance signature state
  const [signOpen, setSignOpen] = useState(false)
  const [signatureText, setSignatureText] = useState('')
  const [selectedFont, setSelectedFont] = useState('font-1')

  const fetchProposals = () => {
    setLoading(true)
    api.get('/proposals')
      .then(res => {
        setProposals(res.data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchProposals()
    if (isAgency) {
      api.get('/clients').then(res => setClients(res.data.clients || res.data)).catch(console.error)
      api.get('/projects').then(res => setProjects(res.data.projects || res.data)).catch(console.error)
    }
  }, [isAgency])

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items]
    updated[index][field] = value
    if (field === 'quantity' || field === 'rate') {
      updated[index].amount = updated[index].quantity * updated[index].rate
    }
    setItems(updated)
  }

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, rate: 0, amount: 0 }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0)
  const discount = discountType === 'percent' 
    ? Math.round(subtotal * discountValue / 100)
    : discountValue
  const taxableAmount = Math.max(0, subtotal - discount)
  const tax = Math.round(taxableAmount * taxRate / 100)
  const total = taxableAmount + tax

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !clientId || !validUntil) {
      toast.error('Please fill in all required fields.')
      return
    }

    const payload = {
      title,
      clientId,
      projectId: projectId || undefined,
      currency,
      notes,
      validUntil: new Date(validUntil),
      items,
      subtotal,
      discountType,
      discountValue,
      discount,
      taxRate,
      tax,
      total,
    }

    api.post('/proposals', payload)
      .then(() => {
        fetchProposals()
        setCreateOpen(false)
        resetForm()
        toast.success('Proposal created successfully.')
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.message)
      })
  }

  const resetForm = () => {
    setTitle('')
    setClientId('')
    setProjectId('')
    setCurrency('USD')
    setNotes('')
    setValidUntil('')
    setItems([{ description: '', quantity: 1, rate: 0, amount: 0 }])
    setDiscountType('percent')
    setDiscountValue(0)
    setTaxRate(18)
  }

  const handleAcceptProposal = () => {
    if (!signatureText.trim()) {
      toast.error('Signature text is required.')
      return
    }
    api.post(`/proposals/${selected}/accept`, { signatureText })
      .then(() => {
        fetchProposals()
        setSignOpen(false)
        setSelected(null)
        setSignatureText('')
        toast.success('Proposal accepted and invoice generated!')
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.message)
      })
  }

  const handleRejectProposal = (id: string) => {
    if (confirm('Are you sure you want to decline this proposal?')) {
      api.post(`/proposals/${id}/reject`)
        .then(() => {
          fetchProposals()
          setSelected(null)
          toast.success('Proposal declined.')
        })
        .catch(err => {
          toast.error(err.response?.data?.error || err.message)
        })
    }
  }

  const selectedProposal = proposals.find(p => p.id === selected)

  return (
    <Layout title="Proposals">
      <div className="page-header flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title text-2xl font-bold text-slate-800">Proposals</h1>
          <p className="page-subtitle text-sm text-slate-500">Draft proposals, send estimates and receive e-signed acceptances.</p>
        </div>
        {isAgency && (
          <button onClick={() => setCreateOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Proposal
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">Loading proposals...</div>
      ) : proposals.length === 0 ? (
        <EmptyState icon={<FileText size={48} />} title="No proposals found" description="Create and send proposals to client approval before billing." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {proposals.map(proposal => (
              <div 
                key={proposal.id} 
                className={`card p-5 cursor-pointer border hover:shadow-md transition-all ${selected === proposal.id ? 'border-orange-500 bg-orange-50/10' : 'border-slate-200'}`}
                onClick={() => setSelected(proposal.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-base">{proposal.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{proposal.proposalNumber} · Valid until {formatDate(proposal.validUntil)}</p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                    proposal.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                    proposal.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                    proposal.status === 'sent' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {proposal.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-4">
                  <div className="text-slate-500">Client: <span className="font-medium text-slate-800">{proposal.clientName}</span></div>
                  <div className="font-bold text-slate-800 text-base">{formatCurrency(proposal.total, proposal.currency)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-1">
            {selectedProposal ? (
              <div className="card p-6 border border-slate-200 sticky top-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                  <h2 className="font-bold text-slate-800 text-lg">Proposal Details</h2>
                  <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Number</span>
                    <p className="font-medium text-slate-800">{selectedProposal.proposalNumber}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Title</span>
                    <p className="font-medium text-slate-800">{selectedProposal.title}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Client</span>
                    <p className="font-medium text-slate-800">{selectedProposal.clientName}</p>
                  </div>
                  {selectedProposal.projectName && (
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold">Project</span>
                      <p className="font-medium text-slate-800">{selectedProposal.projectName}</p>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Line Items</span>
                    <div className="mt-2 space-y-2">
                      {selectedProposal.items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-50">
                          <div>
                            <p className="font-medium text-slate-800">{item.description}</p>
                            <p className="text-slate-400">{item.quantity} x {formatCurrency(item.rate, selectedProposal.currency)}</p>
                          </div>
                          <span className="font-semibold text-slate-700">{formatCurrency(item.amount, selectedProposal.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatCurrency(selectedProposal.subtotal, selectedProposal.currency)}</span>
                    </div>
                    {selectedProposal.discount > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Discount ({selectedProposal.discountType === 'percent' ? `${selectedProposal.discountValue}%` : 'Flat'})</span>
                        <span>-{formatCurrency(selectedProposal.discount, selectedProposal.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Tax ({selectedProposal.taxRate}%)</span>
                      <span>{formatCurrency(selectedProposal.tax, selectedProposal.currency)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm text-slate-800 border-t border-slate-100 pt-2">
                      <span>Total</span>
                      <span>{formatCurrency(selectedProposal.total, selectedProposal.currency)}</span>
                    </div>
                  </div>

                  {selectedProposal.notes && (
                    <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-500">
                      <p className="font-semibold mb-1 text-slate-600">Notes & Terms</p>
                      {selectedProposal.notes}
                    </div>
                  )}

                  {selectedProposal.status === 'accepted' && (
                    <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100 flex items-start gap-3 mt-4">
                      <ShieldCheck className="text-emerald-600 flex-shrink-0 mt-0.5" size={18} />
                      <div>
                        <p className="font-bold text-xs">E-Signed and Accepted</p>
                        <p className="text-xs font-medium mt-1">Signed by: <span className="font-semibold">{selectedProposal.signatureText}</span></p>
                        <p className="text-[10px] text-emerald-600 mt-0.5">Timestamp: {formatDate(selectedProposal.signedAt)}</p>
                      </div>
                    </div>
                  )}

                  {!isAgency && selectedProposal.status === 'sent' && (
                    <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
                      <button onClick={() => handleRejectProposal(selectedProposal.id)} className="btn-secondary flex-1 flex justify-center items-center gap-1.5 text-rose-600 hover:bg-rose-50 border-rose-200">
                        <X size={15} /> Decline
                      </button>
                      <button onClick={() => setSignOpen(true)} className="btn-primary flex-1 flex justify-center items-center gap-1.5">
                        <Check size={15} /> Sign & Accept
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card p-6 border border-slate-200 text-center text-slate-400">
                Select a proposal from the list to view details
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create New Proposal" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Website Design SOW Proposal" className="w-full text-slate-800" />
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
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Project (Optional)</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full text-slate-800">
                <option value="">No Project Link</option>
                {projects.filter(p => !clientId || p.clientId === clientId).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full text-slate-800">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Valid Until *</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} required className="w-full text-slate-800" />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="block text-xs font-semibold text-slate-500 uppercase">Items / Scope of Work</span>
              <button type="button" onClick={addItem} className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1 font-semibold">
                <Plus size={14} /> Add Item
              </button>
            </div>
            <div className="space-y-2.5 max-h-48 overflow-y-auto border border-slate-100 p-2 rounded-xl">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input type="text" placeholder="Item description..." value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} required className="flex-grow text-sm text-slate-800" />
                  <input type="number" placeholder="Qty" min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)} required className="w-16 text-sm text-slate-800" />
                  <input type="number" placeholder="Rate" min="0" value={item.rate} onChange={e => handleItemChange(index, 'rate', parseFloat(e.target.value) || 0)} required className="w-24 text-sm text-slate-800" />
                  <span className="w-24 text-right font-bold text-xs text-slate-600">{formatCurrency(item.amount, currency)}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(index)} className="text-rose-500 p-1 hover:bg-rose-50 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Discount Type</label>
              <select value={discountType} onChange={e => setDiscountType(e.target.value as any)} className="w-full text-slate-800">
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat Amount</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Discount Value</label>
              <input type="number" value={discountValue} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} min="0" className="w-full text-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Tax Rate (%)</label>
              <input type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} min="0" className="w-full text-slate-800" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Notes & Terms</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Terms of work, payment timelines..." className="w-full text-slate-800 rounded-xl" />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
            <div className="text-slate-600 text-sm">
              Total: <span className="font-extrabold text-slate-800 text-base">{formatCurrency(total, currency)}</span>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Create & Send</button>
            </div>
          </div>
        </form>
      </Modal>

      {/* SIGN MODAL */}
      <Modal open={signOpen} onClose={() => setSignOpen(false)} title="Sign Proposal SOW" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">By signing below, you represent your business and authorize ZenithOS to generate the initial payment invoices for these deliverables.</p>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Enter your full name as signature *</label>
            <input 
              type="text" 
              value={signatureText} 
              onChange={e => setSignatureText(e.target.value)} 
              placeholder="e.g. John Doe" 
              className="w-full text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Select Signature Style</label>
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
                    {signatureText || 'Signature'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {signatureText && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center mt-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Legal Signature Preview</span>
              <p 
                style={{ fontFamily: fonts.find(f => f.id === selectedFont)?.family }} 
                className="text-2xl text-orange-600 py-3"
              >
                {signatureText}
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
            <button onClick={() => setSignOpen(false)} className="btn-secondary">Cancel</button>
            <button 
              onClick={handleAcceptProposal} 
              disabled={!signatureText.trim()}
              className="btn-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Authorize & Sign
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
