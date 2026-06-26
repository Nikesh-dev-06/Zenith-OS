import { useState, useEffect } from 'react'
import { Layout } from '../../components/layout/Layout'
import { Modal, EmptyState } from '../../components/ui/index'
import { formatDate } from '../../lib/utils'
import { FileText, ShieldCheck, PenTool, X } from 'lucide-react'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useLanguage } from '../../context/LanguageContext'

const fonts = [
  { id: 'font-1', name: 'Elegant Script', family: "'Brush Script MT', cursive, sans-serif" },
  { id: 'font-2', name: 'Calligraphy', family: "'Lucida Handwriting', cursive, sans-serif" },
  { id: 'font-3', name: 'Modern Cursive', family: "cursive, sans-serif" }
]

export default function PortalContractsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const { t } = useLanguage()
  const isViewer = user?.role === 'client_viewer'

  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  // Sign state
  const [signOpen, setSignOpen] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signatureText, setSignatureText] = useState('')
  const [selectedFont, setSelectedFont] = useState('font-1')
  const [signProvider, setSignProvider] = useState<'local' | 'docusign' | 'zohosign'>('local')

  const fetchContracts = () => {
    setLoading(true)
    api.get('/contracts')
      .then(res => {
        setContracts(res.data || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchContracts()
  }, [])

  // External signature redirect callback verifier
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const verifyExternal = params.get('verify_external')
    const contractId = params.get('contract_id')
    const provider = params.get('provider')
    const signer = params.get('signer')

    if (verifyExternal === 'true' && contractId && provider) {
      toast.info(`Verifying external signature via ${provider === 'docusign' ? 'DocuSign' : 'Zoho Sign'}...`)
      
      api.post(`/contracts/${contractId}/external-callback`, {
        provider,
        signerName: signer || user?.name || 'Authorized Signer'
      })
        .then(() => {
          toast.success(`Contract signed successfully via ${provider === 'docusign' ? 'DocuSign' : 'Zoho Sign'}!`)
          // Clean parameters from url
          const cleanUrl = window.location.pathname
          window.history.replaceState({}, document.title, cleanUrl)
          fetchContracts()
        })
        .catch(err => {
          toast.error(err.response?.data?.error || err.message)
        })
    }
  }, [user])

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
    <Layout title={t('contracts')}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">{t('contracts')}</h1>
          <p className="text-slate-500 text-sm mt-1">Review legal statements of work, master agreements and sign-offs.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      ) : contracts.length === 0 ? (
        <EmptyState icon={<PenTool size={48} />} title="No Contracts Found" description="Any statement of work or agreement drafts will show here." />
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
                    <h3 className="font-semibold text-navy-900 text-base">{contract.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{contract.contractNumber} · {contract.validFrom ? `From ${formatDate(contract.validFrom)}` : ''} {contract.validTo ? `To ${formatDate(contract.validTo)}` : ''}</p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                    contract.status === 'signed' ? 'bg-emerald-100 text-emerald-800' :
                    contract.status === 'terminated' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {contract.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-4">{contract.projectName ? `Project: ${contract.projectName}` : 'Standalone Agreement'}</div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-1">
            {selectedContract ? (
              <div className="card p-6 border border-slate-200 sticky top-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                  <h2 className="font-bold text-navy-900 text-lg">Agreement Details</h2>
                  <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Number</span>
                    <p className="font-semibold text-navy-900">{selectedContract.contractNumber}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Title</span>
                    <p className="font-semibold text-navy-900">{selectedContract.title}</p>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Agreement Content</span>
                    <div className="mt-2 bg-slate-50 border border-slate-100 rounded-xl p-3.5 max-h-60 overflow-y-auto text-xs text-slate-700 leading-relaxed font-mono whitespace-pre-wrap">
                      {selectedContract.content}
                    </div>
                  </div>

                  {selectedContract.status === 'signed' ? (
                    <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100 flex items-start gap-3 mt-4">
                      <ShieldCheck className="text-emerald-600 flex-shrink-0 mt-0.5" size={18} />
                      <div>
                        <p className="font-bold text-xs">Agreement Legally Signed</p>
                        <p className="text-xs font-medium mt-1">Signer: <span className="font-semibold">{selectedContract.signerName}</span></p>
                        <p className="text-xs font-medium">Initials: <span className="font-semibold">{selectedContract.signatureText}</span></p>
                        <p className="text-[10px] text-emerald-650 mt-1">
                          Timestamp: {formatDate(selectedContract.signedAt)}
                          {selectedContract.signatureDrawn && selectedContract.signatureDrawn.startsWith('DOCUSIGN') && (
                            <span className="block text-[9px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">🔒 Verified via DocuSign</span>
                          )}
                          {selectedContract.signatureDrawn && selectedContract.signatureDrawn.startsWith('ZOHOSIGN') && (
                            <span className="block text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">🔒 Verified via Zoho Sign</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <button
                        onClick={() => setSignOpen(true)}
                        disabled={isViewer}
                        className="btn-primary w-full flex justify-center items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <PenTool size={15} /> Sign SOW Agreement
                      </button>
                    </div>
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

      {/* SIGN MODAL */}
      <Modal open={signOpen} onClose={() => setSignOpen(false)} title="Sign Statement of Work (SOW)" size="md">
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Choose your preferred signature provider to authorize this statement of work.</p>

          {/* Provider Selection */}
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
            <button
              onClick={() => setSignProvider('local')}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                signProvider === 'local' ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              Zenith Local
            </button>
            <button
              onClick={() => setSignProvider('docusign')}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                signProvider === 'docusign' ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              DocuSign
            </button>
            <button
              onClick={() => setSignProvider('zohosign')}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                signProvider === 'zohosign' ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              Zoho Sign
            </button>
          </div>

          {signProvider === 'local' ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Authorized Signer Name *</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={e => setSignerName(e.target.value)}
                    placeholder="e.g. Johnathan Doe"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Signature Initials / Code *</label>
                  <input
                    type="text"
                    value={signatureText}
                    onChange={e => setSignatureText(e.target.value)}
                    placeholder="e.g. JD"
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Signature Font Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {fonts.map(font => (
                    <button
                      key={font.id}
                      onClick={() => setSelectedFont(font.id)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        selectedFont === font.id ? 'border-orange-500 bg-orange-50/20' : 'border-slate-200 hover:border-slate-350'
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 block mb-1">{font.name}</span>
                      <span style={{ fontFamily: font.family }} className="text-sm whitespace-nowrap">
                        {signerName || 'Signature'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {signerName && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center mt-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Signature Agreement Stamp</span>
                  <p
                    style={{ fontFamily: fonts.find(f => f.id === selectedFont)?.family }}
                    className="text-xl text-orange-600 py-3"
                  >
                    {signerName}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">Initials ID: {signatureText || '—'}</span>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button onClick={() => setSignOpen(false)} className="btn-secondary text-xs cursor-pointer py-2">Cancel</button>
                <button
                  onClick={handleSignContract}
                  disabled={!signerName.trim() || !signatureText.trim()}
                  className="btn-primary text-xs justify-center cursor-pointer disabled:opacity-50"
                >
                  Sign & Execute SOW
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-navy-900 dark:text-white flex items-center gap-1.5 mb-1.5">
                  🛡️ {signProvider === 'docusign' ? 'DocuSign' : 'Zoho Sign'} Secure Signature Protocol
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Upon clicking launch, you will be redirected to the secure {signProvider === 'docusign' ? 'DocuSign sandbox' : 'Zoho Sign sandbox'} environment to verify, sign, and complete your contract legally. Once signed, you will be automatically returned to your portal dashboard.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Authorized Signer Name *</label>
                <input
                  type="text"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="e.g. Johnathan Doe"
                  className="input"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => setSignOpen(false)} className="btn-secondary text-xs cursor-pointer py-2">Cancel</button>
                <button
                  onClick={async () => {
                    if (!signerName.trim()) {
                      toast.error('Signer name is required.')
                      return
                    }
                    try {
                      const res = await api.post(`/contracts/${selected}/${signProvider}/create-envelope`)
                      toast.success(`Redirecting to secure ${signProvider === 'docusign' ? 'DocuSign' : 'Zoho Sign'} session...`)
                      // Append signer name to redirect URL
                      const targetUrl = `${res.data.url}&signer=${encodeURIComponent(signerName)}`
                      setTimeout(() => {
                        window.location.href = targetUrl
                      }, 1000)
                    } catch (err: any) {
                      toast.error(err.response?.data?.error || err.message)
                    }
                  }}
                  disabled={!signerName.trim()}
                  className="btn-primary text-xs justify-center cursor-pointer disabled:opacity-50 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Launch {signProvider === 'docusign' ? 'DocuSign' : 'Zoho Sign'} Session
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  )
}
