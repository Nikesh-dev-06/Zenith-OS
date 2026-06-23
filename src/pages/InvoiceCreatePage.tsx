import { useState, useEffect } from 'react'
import { ArrowLeft, Trash2, Send, Save, Plus } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { useToast } from '../context/ToastContext'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { formatCurrency } from '../lib/utils'

interface LineItem {
  description: string
  quantity: number
  rate: number
  hsnCode: string
}

export default function InvoiceCreatePage() {
  const toast = useToast()
  const navigate = useNavigate()

  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().split('T')[0]
  })
  const [taxRate, setTaxRate] = useState(18)
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>('percent')
  const [discountValue, setDiscountValue] = useState(0)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, rate: 0, hsnCode: '' }])
  const [placeOfSupply, setPlaceOfSupply] = useState('Delhi')
  const [rcm, setRcm] = useState(false)
  const [tdsRate, setTdsRate] = useState(0)
  const [isExport, setIsExport] = useState(false)
  const [lutNumber, setLutNumber] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [taxType, setTaxType] = useState('GST')
  const [billingType, setBillingType] = useState<'fixed' | 'hourly'>('fixed')
  const [hourlyRate, setHourlyRate] = useState(2000)
  const [fxRates, setFxRates] = useState<any>(null)
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch clients and projects
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [cRes, pRes] = await Promise.all([
          api.get('/clients?limit=100'),
          api.get('/projects?limit=100')
        ])
        setClients(cRes.data.clients || [])
        setProjects(pRes.data.projects || [])
      } catch (err: any) {
        toast.error('Failed to load clients and projects: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Load draft from localStorage on mount
  useEffect(() => {
    const draft = localStorage.getItem('zenith_draft_invoice_create')
    if (draft) {
      try {
        const parsed = JSON.parse(draft)
        setSelectedClientId(parsed.selectedClientId || '')
        setSelectedProjectId(parsed.selectedProjectId || '')
        setInvoiceNumber(parsed.invoiceNumber || '')
        setIssueDate(parsed.issueDate || new Date().toISOString().split('T')[0])
        setDueDate(parsed.dueDate || '')
        setTaxRate(parsed.taxRate ?? 18)
        setDiscountType(parsed.discountType || 'percent')
        setDiscountValue(parsed.discountValue ?? 0)
        setNotes(parsed.notes || '')
        setItems(parsed.items || [{ description: '', quantity: 1, rate: 0, hsnCode: '' }])
        setPlaceOfSupply(parsed.placeOfSupply || 'Delhi')
        setRcm(parsed.rcm ?? false)
        setTdsRate(parsed.tdsRate ?? 0)
        setIsExport(parsed.isExport ?? false)
        setLutNumber(parsed.lutNumber || '')
        setCurrency(parsed.currency || 'INR')
        setTaxType(parsed.taxType || 'GST')
        setBillingType(parsed.billingType || 'fixed')
        setHourlyRate(parsed.hourlyRate ?? 2000)
      } catch (e) {
        console.error('Error loading draft invoice', e)
      }
    }
  }, [])

  // Save draft to localStorage on form changes
  useEffect(() => {
    const draft = {
      selectedClientId,
      selectedProjectId,
      invoiceNumber,
      issueDate,
      dueDate,
      taxRate,
      discountType,
      discountValue,
      notes,
      items,
      placeOfSupply,
      rcm,
      tdsRate,
      isExport,
      lutNumber,
      currency,
      taxType,
      billingType,
      hourlyRate
    }
    localStorage.setItem('zenith_draft_invoice_create', JSON.stringify(draft))
  }, [selectedClientId, selectedProjectId, invoiceNumber, issueDate, dueDate, taxRate, discountType, discountValue, notes, items, placeOfSupply, rcm, tdsRate, isExport, lutNumber, currency, taxType, billingType, hourlyRate])

  const clearDraft = () => {
    localStorage.removeItem('zenith_draft_invoice_create')
  }

  // Handle project change: Auto-fetch tax and discount defaults
  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId)
    if (!projectId) return

    const proj = projects.find(p => p.id === projectId)
    if (proj) {
      const pTax = proj.defaultTaxRate ?? 18
      const pDiscount = proj.defaultDiscountRate ?? 0
      setTaxRate(pTax)
      setDiscountValue(pDiscount)
      setDiscountType('percent') // default rate is percentage
      toast.info(`Applied project defaults: Tax ${pTax}%, Discount ${pDiscount}%`)
    }
  }

  // Filter projects by client
  const availableProjects = projects.filter(p => p.clientId === selectedClientId)

  // Math calculations
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0)
  
  let discount = 0
  if (discountType === 'percent') {
    discount = Math.round(subtotal * discountValue / 100)
  } else {
    discount = discountValue
  }

  const taxableAmount = Math.max(0, subtotal - discount)
  
  // Real-time tax split calculation
  const finalTaxRate = isExport ? 0 : taxRate
  const isIntrastate = placeOfSupply === 'Delhi'
  let cgst = 0
  let sgst = 0
  let igst = 0
  let vat = 0
  
  if (!isExport) {
    if (taxType === 'GST') {
      if (isIntrastate) {
        cgst = Math.round(taxableAmount * (finalTaxRate / 2) / 100)
        sgst = Math.round(taxableAmount * (finalTaxRate / 2) / 100)
      } else {
        igst = Math.round(taxableAmount * finalTaxRate / 100)
      }
    } else if (taxType === 'VAT') {
      vat = Math.round(taxableAmount * finalTaxRate / 100)
    }
  }
  const tax = cgst + sgst + igst + vat
  const tdsAmount = Math.round(taxableAmount * tdsRate / 100)
  
  const rawTotal = rcm ? taxableAmount : (taxableAmount + tax)
  const total = Math.round(rawTotal)
  const roundingAdjustment = Number((total - rawTotal).toFixed(2))
  const netPayable = total - tdsAmount

  const fetchFxRates = async () => {
    try {
      const res = await api.get('/invoices/fx-rates')
      setFxRates(res.data.rates)
      toast.success('Latest live foreign exchange rates retrieved.')
    } catch (e: any) {
      toast.error('Failed to retrieve FX rates: ' + e.message)
    }
  }

  const handleConvertRates = (targetCurrency: string) => {
    if (!fxRates) {
      toast.warning('Please fetch FX rates first.')
      return
    }
    const currentRate = fxRates[currency] || 1
    const targetRate = fxRates[targetCurrency] || 1
    const factor = targetRate / currentRate
    
    const updatedItems = items.map(item => ({
      ...item,
      rate: Math.round(item.rate * factor * 100) / 100
    }))
    setItems(updatedItems)
    toast.success(`Converted line item rates from ${currency} to ${targetCurrency} (Factor: ${factor.toFixed(4)})`)
  }

  const handleImportTaskHours = async () => {
    if (!selectedProjectId) {
      toast.error('Please select a project first to import task hours.')
      return
    }
    try {
      const res = await api.get(`/tasks?projectId=${selectedProjectId}`)
      const tasks = res.data || []
      const hourlyTasks = tasks.filter((t: any) => t.totalLoggedTime > 0)
      
      if (hourlyTasks.length === 0) {
        toast.info('No logged time sessions found for this project\'s tasks.')
        return
      }
      
      const rateVal = currency === 'INR' ? 2000 : 25
      const importedLineItems = hourlyTasks.map((t: any) => ({
        description: `Hours logged on task: ${t.title}`,
        quantity: Math.round((t.totalLoggedTime / 60) * 100) / 100,
        rate: rateVal,
        hsnCode: '998311'
      }))
      
      setItems(prev => {
        if (prev.length === 1 && prev[0].description === '' && prev[0].rate === 0) {
          return importedLineItems
        }
        return [...prev, ...importedLineItems]
      })
      toast.success(`Successfully imported ${importedLineItems.length} task log items!`)
    } catch (e: any) {
      toast.error('Failed to import task hours: ' + e.message)
    }
  }

  // Add, Remove, and Edit items
  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, rate: 0, hsnCode: '' }])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const handleItemChange = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...items]
    if (field === 'description' || field === 'hsnCode') {
      newItems[index] = { ...newItems[index], [field]: value }
    } else {
      newItems[index] = { ...newItems[index], [field]: Number(value) || 0 }
    }
    setItems(newItems)
  }

  const handleSubmit = async (sendImmediately: boolean) => {
    setFormSubmitted(true)
    if (!selectedClientId) {
      toast.error('Client selection is required.')
      return
    }
    if (items.some(item => !item.description || item.rate <= 0)) {
      toast.error('Please verify that all line items have a description and positive rate.')
      return
    }
    if (isExport && !lutNumber.trim()) {
      toast.error('LUT Reference Number is required for export invoices.')
      return
    }
    const hsnRegex = /^[0-9]{4,8}$/
    for (const item of items) {
      if (item.hsnCode && !hsnRegex.test(item.hsnCode.trim())) {
        toast.error(`Invalid HSN/SAC code "${item.hsnCode}". If provided, it must be between 4 and 8 digits.`)
        return
      }
    }

    setIsSubmitting(true)
    const payload = {
      clientId: selectedClientId,
      projectId: selectedProjectId || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      dueDate,
      createdAt: issueDate, // Customizable issue date maps to backend's custom createdAt date
      taxRate: Number(isExport ? 0 : taxRate) || 0,
      discountType,
      discountValue: Number(discountValue) || 0,
      notes,
      items: items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        hsnCode: item.hsnCode || undefined,
        amount: item.quantity * item.rate
      })),
      placeOfSupply,
      rcm,
      tdsRate,
      isExport,
      lutNumber: isExport ? lutNumber.trim() : undefined,
      currency,
      taxType,
      billingType
    }

    try {
      const res = await api.post('/invoices', payload)
      const newInvoice = res.data

      if (sendImmediately) {
        await api.post(`/invoices/${newInvoice.id}/send`)
        toast.success('Invoice created and sent successfully.')
      } else {
        toast.success('Invoice created successfully as draft.')
      }

      clearDraft()
      navigate('/invoices')
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Layout title="Create Invoice">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Create Invoice">
      <div className="page-header flex flex-col items-start gap-2 mb-6">
        <button 
          onClick={() => navigate('/invoices')} 
          className="btn-secondary text-xs flex items-center gap-1.5 transition-all hover:-translate-x-0.5 cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to Invoices
        </button>
        <div>
          <h1 className="page-title">New Invoice</h1>
          <p className="page-subtitle">Configure invoice metadata, custom calculations, and line items</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider border-b border-slate-100 pb-3 mb-2">Invoice Attributes</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Client *</label>
                <select
                  className={`input text-sm py-2 ${formSubmitted && !selectedClientId ? 'border-rose-500 focus:border-rose-500' : ''}`}
                  value={selectedClientId}
                  onChange={e => { setSelectedClientId(e.target.value); setSelectedProjectId(''); }}
                >
                  <option value="">Select client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
                {formSubmitted && !selectedClientId && <p className="text-[10px] text-rose-500 mt-1">Client is required</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project</label>
                <select 
                  className="input text-sm py-2" 
                  value={selectedProjectId} 
                  onChange={e => handleProjectChange(e.target.value)} 
                  disabled={!selectedClientId}
                >
                  <option value="">Select project (Optional)...</option>
                  {availableProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Number (Optional)</label>
                <input 
                  type="text" 
                  className="input text-sm py-2" 
                  placeholder="e.g. INV-2026-001" 
                  value={invoiceNumber} 
                  onChange={e => setInvoiceNumber(e.target.value)}
                />
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Leave blank for automatic generation</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Date *</label>
                <input 
                  type="date" 
                  className="input text-sm py-2" 
                  value={issueDate} 
                  onChange={e => setIssueDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date *</label>
                <input 
                  type="date" 
                  className={`input text-sm py-2 ${formSubmitted && !dueDate ? 'border-rose-500 focus:border-rose-500' : ''}`} 
                  value={dueDate} 
                  onChange={e => setDueDate(e.target.value)}
                />
                {formSubmitted && !dueDate && <p className="text-[10px] text-rose-500 mt-1">Due date is required</p>}
              </div>
            </div>

            <div className="divider !my-3" />
            <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">Global settings &amp; Billing Type</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
                <div className="flex gap-1.5">
                  <select
                    className="input text-sm py-2 flex-1"
                    value={currency}
                    onChange={e => {
                      const newCurr = e.target.value
                      setCurrency(newCurr)
                      if (newCurr !== 'INR') {
                        setTaxType('None')
                      } else {
                        setTaxType('GST')
                      }
                    }}
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="AUD">AUD (A$)</option>
                  </select>
                  {fxRates && (
                    <button
                      type="button"
                      onClick={() => handleConvertRates(currency)}
                      className="btn-secondary text-[10px] py-1 px-2 border-slate-200"
                      title="Convert rates"
                    >
                      Convert
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Template</label>
                <select
                  className="input text-sm py-2"
                  value={taxType}
                  onChange={e => {
                    const newType = e.target.value
                    setTaxType(newType)
                    if (newType === 'None') {
                      setTaxRate(0)
                    } else if (newType === 'VAT') {
                      setTaxRate(21)
                    } else {
                      setTaxRate(18)
                    }
                  }}
                >
                  <option value="GST">GST (India)</option>
                  <option value="VAT">VAT (Europe/UK)</option>
                  <option value="None">No Tax</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Model</label>
                <select
                  className="input text-sm py-2"
                  value={billingType}
                  onChange={e => setBillingType(e.target.value as any)}
                >
                  <option value="fixed">Fixed Price</option>
                  <option value="hourly">Hourly Billing</option>
                </select>
              </div>

              <div className="flex items-end pb-0.5">
                <button
                  type="button"
                  onClick={fetchFxRates}
                  className="btn-secondary text-xs py-2 w-full justify-center border-orange-200 text-orange-600 hover:bg-orange-50 font-bold"
                >
                  Fetch FX Rates
                </button>
              </div>
            </div>

            <div className="divider !my-3" />
            <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">GST &amp; Business Compliance</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Place of Supply</label>
                <select
                  className="input text-sm py-2"
                  value={placeOfSupply}
                  onChange={e => setPlaceOfSupply(e.target.value)}
                  disabled={isExport || taxType !== 'GST'}
                >
                  <option value="Delhi">Delhi (Intra-state)</option>
                  <option value="Andhra Pradesh">Andhra Pradesh</option>
                  <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                  <option value="Assam">Assam</option>
                  <option value="Bihar">Bihar</option>
                  <option value="Chhattisgarh">Chhattisgarh</option>
                  <option value="Goa">Goa</option>
                  <option value="Gujarat">Gujarat</option>
                  <option value="Haryana">Haryana</option>
                  <option value="Himachal Pradesh">Himachal Pradesh</option>
                  <option value="Jharkhand">Jharkhand</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="Kerala">Kerala</option>
                  <option value="Madhya Pradesh">Madhya Pradesh</option>
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Manipur">Manipur</option>
                  <option value="Meghalaya">Meghalaya</option>
                  <option value="Mizoram">Mizoram</option>
                  <option value="Nagaland">Nagaland</option>
                  <option value="Odisha">Odisha</option>
                  <option value="Punjab">Punjab</option>
                  <option value="Rajasthan">Rajasthan</option>
                  <option value="Sikkim">Sikkim</option>
                  <option value="Tamil Nadu">Tamil Nadu</option>
                  <option value="Telangana">Telangana</option>
                  <option value="Tripura">Tripura</option>
                  <option value="Uttar Pradesh">Uttar Pradesh</option>
                  <option value="Uttarakhand">Uttarakhand</option>
                  <option value="West Bengal">West Bengal</option>
                  <option value="Andaman and Nicobar Islands">Andaman and Nicobar Islands</option>
                  <option value="Chandigarh">Chandigarh</option>
                  <option value="Dadra and Nagar Haveli and Daman and Diu">Dadra and Nagar Haveli and Daman and Diu</option>
                  <option value="Lakshadweep">Lakshadweep</option>
                  <option value="Puducherry">Puducherry</option>
                  <option value="Ladakh">Ladakh</option>
                  <option value="Jammu and Kashmir">Jammu and Kashmir</option>
                  <option value="Outside India">Outside India (Export)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">TDS Rate (Withholding)</label>
                <select
                  className="input text-sm py-2"
                  value={tdsRate}
                  onChange={e => setTdsRate(Number(e.target.value))}
                  disabled={taxType !== 'GST'}
                >
                  <option value={0}>No TDS (0%)</option>
                  <option value={1}>TDS @ 1% (B2B Indiv/HUF)</option>
                  <option value={2}>TDS @ 2% (B2B Services/Co)</option>
                  <option value={10}>TDS @ 10% (Rent/Prof Fees)</option>
                </select>
              </div>

              <div className="flex flex-col justify-end pb-1.5 space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rcm}
                    onChange={e => setRcm(e.target.checked)}
                    disabled={taxType !== 'GST'}
                    className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                  />
                  <span>Reverse Charge (RCM)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isExport}
                    disabled={taxType !== 'GST'}
                    onChange={e => {
                      setIsExport(e.target.checked)
                      if (e.target.checked) {
                        setPlaceOfSupply('Outside India')
                      } else {
                        setPlaceOfSupply('Delhi')
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                  />
                  <span>Export of Service (LUT)</span>
                </label>
              </div>
            </div>

            {isExport && taxType === 'GST' && (
              <div className="grid grid-cols-1 gap-4 pt-1 animate-slide-up">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">LUT Reference Number *</label>
                  <input
                    type="text"
                    required={isExport}
                    className={`input text-sm py-2 ${formSubmitted && isExport && !lutNumber.trim() ? 'border-rose-500' : ''}`}
                    placeholder="e.g. AD0703240001234F"
                    value={lutNumber}
                    onChange={e => setLutNumber(e.target.value.toUpperCase())}
                  />
                  {formSubmitted && isExport && !lutNumber.trim() && (
                    <p className="text-[10px] text-rose-500 mt-1">LUT number is required for export zero-rated invoice</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Line Items Card */}
          <div className="card p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-2">
              <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">Line Items</h2>
              <div className="flex items-center gap-2">
                {billingType === 'hourly' && (
                  <button
                    type="button"
                    onClick={handleImportTaskHours}
                    disabled={!selectedProjectId}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 cursor-pointer border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                    Import Task Hours
                  </button>
                )}
                <button 
                  type="button" 
                  onClick={handleAddItem}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} /> Add Line Item
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 px-1 select-none">
                <span className="col-span-5">Description *</span>
                <span className="col-span-2">HSN/SAC</span>
                <span className="col-span-1 text-center">{billingType === 'hourly' ? 'Hours' : 'Qty'} *</span>
                <span className="col-span-2 text-right">Rate ({currency === 'INR' ? '₹' : currency}) *</span>
                <span className="col-span-2 text-right">Amount</span>
              </div>

              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center group">
                  <input
                    className={`input col-span-5 py-1.5 text-sm ${formSubmitted && !item.description ? 'border-rose-500 focus:border-rose-500' : ''}`}
                    placeholder="Item or service description"
                    value={item.description}
                    onChange={e => handleItemChange(index, 'description', e.target.value)}
                  />
                  <input
                    className="input col-span-2 py-1.5 text-sm font-mono"
                    placeholder="998311"
                    value={item.hsnCode}
                    onChange={e => handleItemChange(index, 'hsnCode', e.target.value)}
                  />
                  <input
                    type="number"
                    min="1"
                    className="input col-span-1 py-1.5 text-sm text-center"
                    value={item.quantity}
                    onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    className={`input col-span-2 py-1.5 text-sm text-right ${formSubmitted && item.rate <= 0 ? 'border-rose-500 focus:border-rose-500' : ''}`}
                    placeholder="Rate"
                    value={item.rate || ''}
                    onChange={e => handleItemChange(index, 'rate', e.target.value)}
                  />
                  <div className="col-span-2 flex items-center justify-end gap-1.5 pl-1">
                    <span className="text-sm font-bold text-navy-900 pr-1">
                      ₹{item.quantity * item.rate}
                    </span>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                      onClick={() => handleRemoveItem(index)}
                      disabled={items.length === 1}
                      title="Remove Item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {formSubmitted && items.some(item => !item.description || item.rate <= 0) && (
              <p className="text-xs text-rose-500 mt-2 font-medium">⚠️ Each line item requires a description and positive rate.</p>
            )}
          </div>

          {/* Notes Card */}
          <div className="card p-6">
            <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">Terms &amp; Notes</label>
            <textarea
              className="input text-sm py-2 h-20 resize-none"
              placeholder="Provide payment instructions, terms of service, bank transfer details, etc..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Calculations / Summary Card (1/3 width) */}
        <div className="space-y-6">
          <div className="card p-6 space-y-5">
            <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider border-b border-slate-100 pb-3">Financial Calculations</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Discount Configuration</label>
                <div className="flex gap-2">
                  <div className="flex bg-slate-100 rounded-xl p-1 w-full">
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${discountType === 'percent' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'}`}
                    >
                      Percentage (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('flat')}
                      className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${discountType === 'flat' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'}`}
                    >
                      Flat Amount (₹)
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Value</label>
                <input
                  type="number"
                  min="0"
                  className="input text-sm py-2 font-mono"
                  placeholder="0"
                  value={discountValue || ''}
                  onChange={e => setDiscountValue(Number(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  className="input text-sm py-2 font-mono"
                  placeholder="18"
                  value={taxRate}
                  onChange={e => setTaxRate(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100 font-medium text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-navy-900">{formatCurrency(subtotal, currency)}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount ({discountType === 'percent' ? `${discountValue}%` : 'Flat'})</span>
                  <span className="font-semibold">-{formatCurrency(discount, currency)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Taxable Value</span>
                <span className="font-semibold text-navy-900">{formatCurrency(taxableAmount, currency)}</span>
              </div>

              {isExport && taxType === 'GST' ? (
                <div className="bg-emerald-50 text-emerald-800 p-2 rounded-lg text-[10px] leading-snug">
                  Export of Service under bond/LUT (GST @ 0%). LUT No: <span className="font-mono font-bold">{lutNumber || 'Pending'}</span>
                </div>
              ) : taxType === 'None' ? (
                <div className="bg-slate-100 text-slate-700 p-2 rounded-lg text-[10px] leading-snug">
                  Tax Exempt / No Tax applied.
                </div>
              ) : (
                <>
                  {taxType === 'GST' && (
                    <>
                      {isIntrastate ? (
                        <>
                          <div className="flex justify-between pl-2">
                            <span>CGST ({taxRate / 2}%)</span>
                            <span>{formatCurrency(cgst, currency)}</span>
                          </div>
                          <div className="flex justify-between pl-2">
                            <span>SGST ({taxRate / 2}%)</span>
                            <span>{formatCurrency(sgst, currency)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between pl-2">
                          <span>IGST ({taxRate}%)</span>
                          <span>{formatCurrency(igst, currency)}</span>
                        </div>
                      )}
                      {rcm && (
                        <div className="bg-amber-50 text-amber-800 p-2 rounded-lg text-[10px] leading-snug">
                          ⚠️ GST payable under Reverse Charge Mechanism (RCM). Tax is NOT added to the invoice total. Buyer is liable to deposit {formatCurrency(tax, currency)} directly to the tax department.
                        </div>
                      )}
                    </>
                  )}
                  {taxType === 'VAT' && (
                    <div className="flex justify-between pl-2">
                      <span>VAT ({taxRate}%)</span>
                      <span>{formatCurrency(vat, currency)}</span>
                    </div>
                  )}
                </>
              )}

              {roundingAdjustment !== 0 && (
                <div className="flex justify-between text-slate-500 font-mono text-[10px]">
                  <span>Rounding Off</span>
                  <span>{roundingAdjustment > 0 ? '+' : ''}{formatCurrency(roundingAdjustment, currency)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold text-navy-900 pt-2 border-t border-slate-200">
                <span>{rcm ? 'Total (Excl. Tax)' : 'Total Invoice Value'}</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>

              {tdsAmount > 0 && taxType === 'GST' && (
                <>
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>TDS Withheld (@ {tdsRate}%)</span>
                    <span>-{formatCurrency(tdsAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-emerald-600 pt-2 border-t border-dashed border-slate-200">
                    <span>Net Due / Payable</span>
                    <span>{formatCurrency(netPayable, currency)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <button 
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmit(false)}
                className="btn-secondary w-full justify-center py-2.5 font-bold cursor-pointer"
              >
                <Save size={15} /> Save as Draft
              </button>
              <button 
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmit(true)}
                className="btn-primary w-full justify-center py-2.5 font-bold cursor-pointer"
              >
                <Send size={15} /> Create &amp; Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
