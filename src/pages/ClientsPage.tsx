import { useState, useEffect } from 'react'
import {
  Plus, Search, Filter, Building2, Mail, Phone, FolderOpen,
  IndianRupee, MoreHorizontal, ArrowLeft, Copy, Check, Clock, CheckCircle, Trash,
  ArrowRight, ChevronsLeft, ChevronsRight, MessageSquare, Send
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { ClientStatusBadge, Avatar, EmptyState, Modal, Progress, InvoiceStatusBadge, Skeleton, ConfirmationModal } from '../components/ui/index'
import { formatCurrency, formatRelativeTime } from '../lib/utils'
import type { Client, ClientStatus } from '../types'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'

export default function ClientsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'super_admin'
  const isReadOnly = user?.role === 'client_viewer'
  const toast = useToast()
  const { t } = useLanguage()

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [clientProjects, setClientProjects] = useState<any[]>([])
  const [clientInvoices, setClientInvoices] = useState<any[]>([])
  const [clientLogs, setClientLogs] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  
  // Custom Section C state extensions
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('grid')
  const [detailTab, setDetailTab] = useState<'overview' | 'timeline' | 'system'>('overview')
  const [interactions, setInteractions] = useState<any[]>([])
  const [syncedEmails, setSyncedEmails] = useState<any[]>([])
  
  // Interaction form states
  const [interactionType, setInteractionType] = useState<'note' | 'call' | 'email'>('note')
  const [interactionContent, setInteractionContent] = useState('')
  const [loggingInteraction, setLoggingInteraction] = useState(false)
  
  // WhatsApp form states
  const [waMessage, setWaMessage] = useState('')
  const [sendingWa, setSendingWa] = useState(false)

  // Bulk selection and confirmation states
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)

  // Search and Filter state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all')
  const [industryFilter, setIndustryFilter] = useState('all')
  const [revenueFilter, setRevenueFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name_asc')
  const [showFilters, setShowFilters] = useState(false)

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Add Client Modal states
  const [showAdd, setShowAdd] = useState(false)
  const [newCompany, setNewCompany] = useState('')
  const [newContact, setNewContact] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newIndustry, setNewIndustry] = useState('Technology')
  const [newStatus, setNewStatus] = useState<ClientStatus>('lead')
  const [newAddress, setNewAddress] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newGstin, setNewGstin] = useState('')
  const [newPan, setNewPan] = useState('')
  
  // Section C modal fields state extensions
  const [newTags, setNewTags] = useState('')
  const [customFields, setCustomFields] = useState<{ label: string; value: string }[]>([])

  const activeFilterCount = 
    (statusFilter !== 'all' ? 1 : 0) + 
    (industryFilter !== 'all' ? 1 : 0) + 
    (revenueFilter !== 'all' ? 1 : 0)

  // Confirmation triggers
  const triggerDeleteClient = (e: React.MouseEvent, clientId: string) => {
    e.stopPropagation()
    if (isReadOnly) return
    setPendingDeleteId(clientId)
    setPendingBulkDelete(false)
    setConfirmDeleteOpen(true)
  }

  const triggerBulkDelete = () => {
    if (isReadOnly) return
    setPendingBulkDelete(true)
    setPendingDeleteId(null)
    setConfirmDeleteOpen(true)
  }

  const handleConfirmDelete = () => {
    if (pendingBulkDelete) {
      setLoading(true)
      Promise.all(selectedIds.map(id => api.delete(`/clients/${id}`)))
        .then(() => {
          fetchClients()
          setSelectedIds([])
          toast.success('Selected clients deleted successfully.')
        })
        .catch(err => toast.error(err.response?.data?.error || err.message))
        .finally(() => setLoading(false))
    } else if (pendingDeleteId) {
      setLoading(true)
      api.delete(`/clients/${pendingDeleteId}`)
        .then(() => {
          fetchClients()
          toast.success('Client deleted successfully.')
          if (selectedClientId === pendingDeleteId) {
            setSelectedClientId(null)
          }
        })
        .catch(err => toast.error(err.response?.data?.error || err.message))
        .finally(() => setLoading(false))
    }
  }

  const handleCopyGstin = (e: React.MouseEvent, gstin: string, id: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(gstin)
    setCopiedId(id)
    toast.info('GSTIN copied to clipboard!')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const fetchClients = () => {
    api.get('/clients?limit=100')
      .then(res => {
        setClients(res.data.clients)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const handleSelectClient = (clientId: string | null) => {
    setSelectedClientId(clientId)
    setDetailTab('overview')
    if (clientId) {
      api.get(`/projects?clientId=${clientId}`).then(res => setClientProjects(res.data.projects || []))
      api.get(`/invoices?clientId=${clientId}`).then(res => setClientInvoices(res.data.invoices || []))
      api.get(`/clients/${clientId}/interactions`).then(res => setInteractions(res.data || []))
      api.get(`/clients/${clientId}/emails`).then(res => setSyncedEmails(res.data || []))
      api.get(`/activity`).then(res => {
        setClientLogs(res.data.logs || [])
      })
    } else {
      setClientProjects([])
      setClientInvoices([])
      setInteractions([])
      setSyncedEmails([])
      setClientLogs([])
    }
  }

  const handleCreateClient = () => {
    if (!newCompany || !newContact || !newEmail) {
      toast.error('Please fill in all required fields.')
      return
    }
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i
    if (newGstin && !gstinRegex.test(newGstin)) {
      toast.error('GSTIN format is invalid. Must be a 15-character alphanumeric Indian GSTIN.')
      return
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i
    if (newPan && !panRegex.test(newPan)) {
      toast.error('PAN format is invalid. Must be a 10-character alphanumeric Indian PAN.')
      return
    }

    const payload = {
      companyName: newCompany,
      contactPerson: newContact,
      email: newEmail,
      phone: newPhone,
      industry: newIndustry,
      status: newStatus,
      address: newAddress,
      notes: newNotes,
      gstin: newGstin,
      pan: newPan,
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
      customFields: customFields.filter(f => f.label.trim())
    }
    api.post('/clients', payload)
      .then(() => {
        fetchClients()
        setShowAdd(false)
        toast.success('Client created successfully.')
        
        // Clear states
        setNewCompany('')
        setNewContact('')
        setNewEmail('')
        setNewPhone('')
        setNewIndustry('Technology')
        setNewStatus('lead')
        setNewAddress('')
        setNewNotes('')
        setNewGstin('')
        setNewPan('')
        setNewTags('')
        setCustomFields([])
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.message)
      })
  }

  const handleMoveStage = async (clientId: string, newStatus: ClientStatus) => {
    if (isReadOnly) return
    try {
      await api.put(`/clients/${clientId}`, { status: newStatus })
      toast.success(`Client moved to status: ${newStatus}`)
      fetchClients()
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const handleLogInteractionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!interactionContent.trim() || !selectedClientId) return
    setLoggingInteraction(true)
    try {
      await api.post(`/clients/${selectedClientId}/interactions`, {
        type: interactionType,
        content: interactionContent
      })
      toast.success('Activity interaction logged successfully')
      setInteractionContent('')
      
      const res = await api.get(`/clients/${selectedClientId}/interactions`)
      setInteractions(res.data || [])
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    } finally {
      setLoggingInteraction(false)
    }
  }

  const handleSendWhatsAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!waMessage.trim() || !selectedClientId) return
    setSendingWa(true)
    try {
      await api.post(`/clients/${selectedClientId}/whatsapp`, {
        message: waMessage
      })
      toast.success('Simulated WhatsApp message sent')
      setWaMessage('')
      
      const res = await api.get(`/clients/${selectedClientId}/interactions`)
      setInteractions(res.data || [])
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    } finally {
      setSendingWa(false)
    }
  }

  const filtered = clients.filter(c => {
    const matchSearch = c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.gstin && c.gstin.toLowerCase().includes(search.toLowerCase())) ||
      (c.tags && c.tags.some((t: string) => t.toLowerCase().includes(search.toLowerCase())))
    
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    const matchIndustry = industryFilter === 'all' || c.industry === industryFilter
    
    let matchRevenue = true
    if (revenueFilter === 'high') {
      matchRevenue = c.totalRevenue >= 300000
    } else if (revenueFilter === 'medium') {
      matchRevenue = c.totalRevenue >= 100000 && c.totalRevenue < 300000
    } else if (revenueFilter === 'low') {
      matchRevenue = c.totalRevenue < 100000
    }

    return matchSearch && matchStatus && matchIndustry && matchRevenue
  }).sort((a, b) => {
    if (sortBy === 'name_asc') return a.companyName.localeCompare(b.companyName)
    if (sortBy === 'name_desc') return b.companyName.localeCompare(a.companyName)
    if (sortBy === 'revenue_desc') return b.totalRevenue - a.totalRevenue
    if (sortBy === 'projects_desc') return b.projectCount - a.projectCount
    return 0
  })

  // Selected client for detail view
  const selectedClient = clients.find(c => c.id === selectedClientId)

  // SPA full details content
  const renderDetailView = (client: Client) => {
    // Gather related activities
    const projectIds = clientProjects.map(p => p.id)
    const filteredLogs = clientLogs.filter(log => 
      projectIds.includes(log.entityId) || 
      log.userId === client.id || 
      log.userName?.includes(client.contactPerson)
    )

    // Calculate outstanding
    const outstandingInvoices = clientInvoices.filter(i => i.status !== 'paid')
    const totalOutstanding = outstandingInvoices.reduce((s, i) => s + i.total, 0)

    // Merge manual interactions and synced emails into a single list
    const combinedTimeline = [
      ...interactions.map(item => ({
        id: item._id || item.id,
        type: item.type, // call, email, note, system
        content: item.content,
        author: item.recordedByName || 'System Agent',
        date: new Date(item.createdAt),
        badgeColor: item.type === 'call' ? 'bg-blue-50 text-blue-700' : item.type === 'email' ? 'bg-indigo-50 text-indigo-700' : item.type === 'system' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
      })),
      ...syncedEmails.map(email => ({
        id: `email_${email.date}`,
        type: 'email_sync',
        content: `Subject: ${email.subject}\n\n${email.body}`,
        author: `From: ${email.sender} To: ${email.recipient}`,
        date: new Date(email.date),
        badgeColor: 'bg-violet-50 text-violet-700 border border-violet-100'
      }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime())

    return (
      <div className="space-y-6 animate-slide-up">
        {/* Back control */}
        <button
          onClick={() => handleSelectClient(null)}
          className="btn-ghost flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-orange-600 mb-2 px-0 cursor-pointer"
        >
          <ArrowLeft size={12} /> {t('backToClients')}
        </button>

        {/* Profile Header */}
        <div className="card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={client.companyName} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-navy-900">{client.companyName}</h1>
                <ClientStatusBadge status={client.status} />
              </div>
              <p className="text-sm text-slate-500 mt-1">{t('establishedClient')} {new Date(client.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' })}</p>
              {/* Render Tags */}
              {client.tags && client.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {client.tags.map((t: string) => (
                    <span key={t} className="text-[10px] font-semibold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-100">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 uppercase">{t('industry')}:</span>
              <span className="badge badge-info bg-blue-50 text-blue-700 capitalize font-bold">{t(client.industry.toLowerCase()) || client.industry}</span>
            </div>
            {isAdmin && !isReadOnly && (
              <button
                onClick={(e) => triggerDeleteClient(e, client.id)}
                className="btn-secondary text-xs py-1.5 px-3 border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer font-bold"
              >
                {t('delete')}
              </button>
            )}
          </div>
        </div>

        {/* Tabs selector */}
        <div className="flex gap-2 border-b border-slate-100 pb-2">
          {[
            { id: 'overview', label: t('overview') || 'Overview' },
            { id: 'timeline', label: t('timelineTitle') || 'Timeline' },
            { id: 'system', label: t('systemAuditLogs') || 'System Audit Logs' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setDetailTab(t.id as any)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                detailTab === t.id
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left: Contact Info & Financial details */}
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="section-title mb-4">{t('contactInformation')}</h2>
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('contactPerson')}</label>
                  <p className="text-sm font-medium text-navy-900 mt-0.5">{client.contactPerson}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('email')}</label>
                  <p className="text-sm font-medium text-navy-900 mt-0.5 break-all">{client.email}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('phone')}</label>
                  <p className="text-sm font-medium text-navy-900 mt-0.5">{client.phone || '—'}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('address')}</label>
                  <p className="text-sm font-medium text-navy-900 mt-0.5">{client.address}</p>
                </div>
                {client.notes && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('notes')}</label>
                    <p className="text-xs font-medium text-slate-600 mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">{client.notes}</p>
                  </div>
                )}
                
                {/* Render Custom Fields */}
                {client.customFields && client.customFields.length > 0 && (
                  <div className="border-t border-slate-100 pt-3 mt-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t('customMetadata')}</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {client.customFields.map((f: { label: string; value: string }) => (
                        <div key={f.label} className="min-w-0">
                          <span className="block text-[9px] font-bold text-slate-500 uppercase truncate" title={f.label}>{f.label}</span>
                          <span className="text-xs font-medium text-slate-800 break-all">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* GSTIN & Cost/Value info displayed alongside each other */}
            <div className="card p-6 border-l-4 border-emerald-500">
              <h2 className="section-title mb-4">{t('gstFinancialDetails')}</h2>
              <div className="space-y-4">
                
                {/* GST Display alongside cost/value info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50/50 rounded-xl p-3.5 border border-emerald-100/50">
                    <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider">{t('gstin')}</label>
                    {client.gstin ? (
                      <div className="flex items-center justify-between mt-1 gap-2">
                        <span className="text-xs font-bold text-emerald-950 font-mono tracking-wide">{client.gstin}</span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyGstin(e, client.gstin || '', 'detail')}
                          className="btn-ghost p-1 text-emerald-700 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer"
                          title="Copy GSTIN"
                        >
                          {copiedId === 'detail' ? <Check size={11} /> : <Copy size={11} />}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 mt-1 italic">{t('noGstRegistered')}</p>
                    )}
                  </div>
                  <div className="bg-blue-50/50 rounded-xl p-3.5 border border-blue-100/50">
                    <label className="block text-[10px] font-bold text-blue-800 uppercase tracking-wider">{t('pan')}</label>
                    {client.pan ? (
                      <div className="flex items-center justify-between mt-1 gap-2">
                        <span className="text-xs font-bold text-blue-950 font-mono tracking-wide">{client.pan}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(client.pan || '');
                            setCopiedId('pan-detail');
                            toast.info('PAN copied to clipboard!');
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="btn-ghost p-1 text-blue-700 hover:text-white hover:bg-blue-600 rounded-lg transition-colors cursor-pointer"
                          title="Copy PAN"
                        >
                          {copiedId === 'pan-detail' ? <Check size={11} /> : <Copy size={11} />}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 mt-1 italic">{t('noPanRegistered')}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('totalRevenue')}</span>
                    <span className="text-lg font-bold text-navy-900 block mt-1">{formatCurrency(client.totalRevenue)}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('outstanding')}</span>
                    <span className={`text-lg font-bold block mt-1 ${totalOutstanding > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {formatCurrency(totalOutstanding)}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('projects')}</span>
                    <span className="text-xs text-slate-500 mt-0.5">{client.projectCount} {client.projectCount === 1 ? t('project').toLowerCase() : t('projects').toLowerCase()}</span>
                  </div>
                  <span className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm">
                    {client.projectCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Lists & Tabs (Projects, Invoices, Logs) */}
          <div className="lg:col-span-2">
            
            {detailTab === 'overview' && (
              <div className="space-y-6">
                {/* Projects Section */}
                <div className="card p-6">
                  <h2 className="section-title mb-4 flex items-center gap-2">
                    <FolderOpen size={16} className="text-orange-600" />
                    <span>{t('projects')} ({clientProjects.length})</span>
                  </h2>
                  {clientProjects.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">{t('noProjectsAssigned')}</p>
                  ) : (
                    <div className="space-y-4">
                      {clientProjects.map(project => (
                        <div key={project.id} className="border border-slate-100 rounded-xl p-4 hover:border-slate-200 transition-colors">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div>
                              <h4 className="font-semibold text-sm text-navy-900">{project.name}</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">{t('budget')}: {formatCurrency(project.budget)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`badge ${
                                project.status === 'completed' ? 'badge-success' : 
                                project.status === 'review' ? 'badge-warning' : 'badge-info'
                              } capitalize text-[10px]`}>
                                {t(project.status.toLowerCase())}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3">
                            <Progress value={project.progress} showLabel />
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-400 mt-2">
                            <span>{t('tasks')}: {project.completedTasks}/{project.taskCount} {t('completed').toLowerCase()}</span>
                            <span>{t('due')}: {new Date(project.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Invoices Section */}
                <div className="card p-6">
                  <h2 className="section-title mb-4 flex items-center gap-2">
                    <Clock size={16} className="text-orange-600" />
                    <span>{t('invoices')} ({clientInvoices.length})</span>
                  </h2>
                  {clientInvoices.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">{t('noInvoicesRecorded')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase">
                            <th className="pb-2">{t('invoiceNumber')}</th>
                            <th className="pb-2">{t('amount')}</th>
                            <th className="pb-2">{t('status')}</th>
                            <th className="pb-2">{t('dueDate')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientInvoices.map(inv => (
                            <tr key={inv.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
                              <td className="py-2.5 font-semibold text-navy-900">{inv.invoiceNumber}</td>
                              <td className="py-2.5 font-medium">{formatCurrency(inv.total)}</td>
                              <td className="py-2.5"><InvoiceStatusBadge status={inv.status} /></td>
                              <td className="py-2.5 text-slate-500">{new Date(inv.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {detailTab === 'timeline' && (
              <div className="space-y-6">
                {/* Form controls for Logging interactions & WhatsApp Business alerts */}
                {!isReadOnly && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Log manual interaction form */}
                    <div className="card p-5">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <MessageSquare size={13} className="text-orange-600" />
                        {t('interactionType')}
                      </h3>
                      <form onSubmit={handleLogInteractionSubmit} className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { id: 'note', label: t('note') || 'Note' },
                            { id: 'call', label: t('phoneCall') || 'Phone Call' },
                            { id: 'email', label: t('emailOut') || 'Email Out' }
                          ] as const).map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setInteractionType(opt.id)}
                              className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                interactionType === opt.id
                                  ? 'bg-orange-50 border-orange-300 text-orange-600'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <textarea
                          placeholder={t('typeInteractionSummary')}
                          required
                          value={interactionContent}
                          onChange={e => setInteractionContent(e.target.value)}
                          className="input py-2 text-xs h-16 resize-none"
                        />
                        <button
                          type="submit"
                          disabled={loggingInteraction}
                          className="btn-primary w-full justify-center text-xs py-1.5"
                        >
                          {loggingInteraction ? t('saving') : t('saveInteraction')}
                        </button>
                      </form>
                    </div>

                    {/* Mock WhatsApp API Alert sender */}
                    <div className="card p-5">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Send size={13} className="text-emerald-600" />
                        {t('whatsappAlert')}
                      </h3>
                      <form onSubmit={handleSendWhatsAppSubmit} className="space-y-3">
                        {client.phone ? (
                          <>
                            <div className="text-[10px] text-slate-500">
                              {t('recipientNumber')} <span className="font-semibold">{client.phone}</span>
                            </div>
                            <textarea
                              placeholder={t('whatsappPlaceholder')}
                              required
                              value={waMessage}
                              onChange={e => setWaMessage(e.target.value)}
                              className="input py-2 text-xs h-16 resize-none"
                            />
                            <button
                              type="submit"
                              disabled={sendingWa}
                              className="btn-primary bg-emerald-600 hover:bg-emerald-700 w-full justify-center text-xs py-1.5 cursor-pointer"
                            >
                              {sendingWa ? t('sending') : t('sendWhatsapp')}
                            </button>
                          </>
                        ) : (
                          <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100 flex flex-col justify-center h-28">
                            <span className="text-xs text-slate-400 font-medium">{t('whatsappUnavailable')}</span>
                            <span className="text-[10px] text-slate-400 mt-1 italic">{t('noPhoneRegistered')}</span>
                          </div>
                        )}
                      </form>
                    </div>
                  </div>
                )}

                {/* Timeline visual display */}
                <div className="card p-6">
                  <h3 className="section-title mb-4">{t('timelineTitle')}</h3>
                  {combinedTimeline.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-xs text-slate-400 italic">{t('noHistory')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                      {combinedTimeline.map(item => (
                        <div key={item.id} className="flex gap-4 relative pl-8 text-xs">
                          <div className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-orange-500 z-10 flex items-center justify-center" />
                          <div className="flex-1 min-w-0 bg-slate-50/50 border border-slate-100 rounded-xl p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                              <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${item.badgeColor}`}>
                                {item.type.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">{item.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-slate-700 whitespace-pre-line leading-relaxed">{item.content}</p>
                            <div className="text-[10px] text-slate-400 mt-2 font-medium">
                              {t('loggedBy')}: {item.author}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {detailTab === 'system' && (
              /* Activity Log Section */
              <div className="card p-6">
                <h2 className="section-title mb-4 flex items-center gap-2">
                  <CheckCircle size={16} className="text-orange-600" />
                  <span>{t('recentActivity')} ({filteredLogs.length})</span>
                </h2>
                {filteredLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">{t('noActivity')}</p>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {filteredLogs.map(log => (
                      <div key={log.id} className="flex gap-2 text-xs">
                        <Avatar name={log.userName} size="sm" />
                        <div className="flex-1 min-w-0 bg-slate-50/50 p-2 rounded-xl border border-slate-100/50">
                          <p className="text-slate-700">
                            <span className="font-semibold">{log.userName}</span>{' '}
                            <span className="text-slate-500">{log.action}</span>{' '}
                            <span className="font-medium text-navy-900">{log.entityName}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{formatRelativeTime(log.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    )
  }

  // Render Kanban Columns view
  const renderKanbanView = () => {
    const columns = [
      { id: 'lead' as const, title: t('lead'), border: 'border-amber-500', bg: 'bg-amber-50/10' },
      { id: 'active' as const, title: t('active'), border: 'border-emerald-500', bg: 'bg-emerald-50/10' },
      { id: 'inactive' as const, title: t('inactive'), border: 'border-slate-500', bg: 'bg-slate-50/10' }
    ]

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {columns.map(col => {
          const colClients = filtered.filter(c => c.status === col.id)
          return (
            <div key={col.id} className="flex flex-col max-h-[70vh]">
              {/* Column Header */}
              <div className={`border-b-2 ${col.border} pb-2 mb-3 flex items-center justify-between`}>
                <span className="font-bold text-sm text-navy-950 capitalize">{col.title}</span>
                <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                  {colClients.length}
                </span>
              </div>

              {/* Column Cards Container */}
              <div className={`flex-1 overflow-y-auto space-y-3.5 p-2.5 rounded-2xl border border-slate-100 min-h-[40vh] bg-slate-50/40`}>
                {colClients.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">
                    {t('noClientsInStage') || 'No clients in this stage.'}
                  </div>
                ) : (
                  colClients.map(client => (
                    <div
                      key={client.id}
                      onClick={() => handleSelectClient(client.id)}
                      className="bg-white rounded-xl p-4 shadow-sm border border-slate-100/70 hover:border-orange-200/80 hover:shadow transition-all duration-150 cursor-pointer group space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm text-navy-950 truncate leading-snug">{client.companyName}</h4>
                          <span className="text-xs text-slate-500 block mt-0.5 truncate">{client.contactPerson}</span>
                        </div>
                        <Avatar name={client.companyName} size="sm" />
                      </div>

                      {/* Display Tags inside Kanban cards */}
                      {client.tags && client.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {client.tags.slice(0, 3).map((t: string) => (
                            <span key={t} className="text-[9px] font-semibold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full border border-orange-100/50">
                              {t}
                            </span>
                          ))}
                          {client.tags.length > 3 && (
                            <span className="text-[9px] font-semibold bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded-full">
                              +{client.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Summary details */}
                      <div className="text-[11px] text-slate-500 flex justify-between items-center bg-slate-50/50 p-2 rounded-lg border border-slate-100/30">
                        <span className="truncate">{t(client.industry.toLowerCase()) || client.industry}</span>
                        <span className="font-bold text-emerald-600 font-mono text-xs">{formatCurrency(client.totalRevenue)}</span>
                      </div>

                      {/* Stage transition buttons */}
                      {!isReadOnly && (
                        <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1.5">
                            {col.id !== 'lead' && (
                              <button
                                type="button"
                                title={t('moveToLead') || 'Move to Lead'}
                                onClick={() => handleMoveStage(client.id, 'lead')}
                                className="p-1 rounded-md text-slate-400 hover:text-orange-600 hover:bg-slate-100 transition-all cursor-pointer"
                              >
                                {col.id === 'inactive' ? <ChevronsLeft size={13} /> : <ArrowLeft size={13} />}
                              </button>
                            )}
                            {col.id === 'inactive' && (
                              <button
                                type="button"
                                title={t('moveToActive') || 'Move to Active'}
                                onClick={() => handleMoveStage(client.id, 'active')}
                                className="p-1 rounded-md text-slate-400 hover:text-orange-600 hover:bg-slate-100 transition-all cursor-pointer"
                              >
                                <ArrowLeft size={13} />
                              </button>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            {col.id === 'lead' && (
                              <button
                                type="button"
                                title={t('moveToActive') || 'Move to Active'}
                                onClick={() => handleMoveStage(client.id, 'active')}
                                className="p-1 rounded-md text-slate-400 hover:text-orange-600 hover:bg-slate-100 transition-all cursor-pointer"
                              >
                                <ArrowRight size={13} />
                              </button>
                            )}
                            {col.id !== 'inactive' && (
                              <button
                                type="button"
                                title={t('moveToClosed') || 'Move to Closed'}
                                onClick={() => handleMoveStage(client.id, 'inactive')}
                                className="p-1 rounded-md text-slate-400 hover:text-orange-600 hover:bg-slate-100 transition-all cursor-pointer"
                              >
                                {col.id === 'lead' ? <ChevronsRight size={13} /> : <ArrowRight size={13} />}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Layout title={t('clients')}>
      
      {/* Dynamic View rendering */}
      {selectedClient ? (
        renderDetailView(selectedClient)
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="page-header flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="page-title">{t('clients')}</h1>
              <p className="page-subtitle">{clients.length} {t('totalClientsDesc')} · {clients.filter(c => c.status === 'active').length} {t('activeClientsDesc')}</p>
            </div>
            {!isReadOnly && (
              <button className="btn-primary flex items-center gap-2 cursor-pointer" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> {t('addClient')}
              </button>
            )}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('searchPlaceholderClients')}
                className="input pl-9 py-2"
              />
            </div>

            {/* Redesigned Accessible Filters Button */}
            <button
              id="filter-toggle-btn"
              aria-expanded={showFilters}
              aria-controls="advanced-filters-panel"
              aria-label={t('toggleFilters') || 'Toggle advanced filters panel'}
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/25 ${
                showFilters ? 'bg-orange-50 border-orange-300 text-orange-600 font-semibold' : ''
              }`}
            >
              <Filter size={15} />
              <span>{t('filters')}</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* View Mode Toggle (Section C Pipeline Requirement) */}
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-navy-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t('listGrid')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-white text-navy-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t('kanbanPipeline')}
              </button>
            </div>
          </div>

          {/* Redesigned Advanced Filters Panel */}
          {showFilters && (
            <div
              id="advanced-filters-panel"
              className="card p-4 bg-slate-50/70 border border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up"
            >
              {/* Filter by Status */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('status')}</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as ClientStatus | 'all')}
                  className="input py-2 bg-white"
                >
                  <option value="all">{t('allStatuses')}</option>
                  <option value="active">{t('active')}</option>
                  <option value="inactive">{t('inactive')}</option>
                  <option value="lead">{t('lead')}</option>
                </select>
              </div>

              {/* Filter by Industry */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('industry')}</label>
                <select
                  value={industryFilter}
                  onChange={e => setIndustryFilter(e.target.value)}
                  className="input py-2 bg-white"
                >
                  <option value="all">{t('allIndustries')}</option>
                  <option value="Technology">{t('technology')}</option>
                  <option value="Hospitality">{t('hospitality')}</option>
                  <option value="FMCG">{t('fmcg')}</option>
                  <option value="Real Estate">{t('realEstate')}</option>
                  <option value="Education">{t('education')}</option>
                  <option value="Media">{t('media')}</option>
                  <option value="Other">{t('other')}</option>
                </select>
              </div>

              {/* Filter by Revenue Range */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('revenueRange')}</label>
                <select
                  value={revenueFilter}
                  onChange={e => setRevenueFilter(e.target.value)}
                  className="input py-2 bg-white"
                >
                  <option value="all">{t('allRanges')}</option>
                  <option value="high">{t('highRange')}</option>
                  <option value="medium">{t('mediumRange')}</option>
                  <option value="low">{t('lowRange')}</option>
                </select>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('sortBy')}</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="input py-2 bg-white"
                >
                  <option value="name_asc">{t('companyNameAsc')}</option>
                  <option value="name_desc">{t('companyNameDesc')}</option>
                  <option value="revenue_desc">{t('revenueDesc')}</option>
                  <option value="projects_desc">{t('projectsCountDesc')}</option>
                </select>
              </div>
            </div>
          )}

          {/* Grid Layout of Clients vs Kanban board */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="card p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-5/6" />
                    <Skeleton className="h-3 w-4/6" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="👥"
              title={t('noClientsFound')}
              description={t('noClientsFoundDesc')}
              action={
                !isReadOnly ? (
                  <button className="btn-primary flex items-center gap-2 cursor-pointer" onClick={() => setShowAdd(true)}>
                    <Plus size={15} /> {t('addClient')}
                  </button>
                ) : undefined
              }
            />
          ) : viewMode === 'kanban' ? (
            renderKanbanView()
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(client => (
                <div
                  key={client.id}
                  onClick={() => handleSelectClient(client.id)}
                  className={`card-hover p-5 cursor-pointer group flex flex-col justify-between ${
                    selectedIds.includes(client.id) ? 'ring-2 ring-orange-500 bg-orange-50/10' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {isAdmin && !isReadOnly && (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(client.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(prev => [...prev, client.id])
                              } else {
                                setSelectedIds(prev => prev.filter(id => id !== client.id))
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer flex-shrink-0"
                          />
                        )}
                        <Avatar name={client.companyName} size="md" />
                        <div className="min-w-0">
                          <h3 className="font-semibold text-navy-900 text-sm leading-tight truncate">{client.companyName}</h3>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{client.contactPerson}</p>
                          {/* Render Tags */}
                          {client.tags && client.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {client.tags.slice(0, 3).map((t: string) => (
                                <span key={t} className="text-[9px] font-semibold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full border border-orange-100/50">
                                  {t}
                                </span>
                              ))}
                              {client.tags.length > 3 && (
                                <span className="text-[9px] font-semibold bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded-full">
                                  +{client.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ClientStatusBadge status={client.status} />
                        {isAdmin && !isReadOnly && (
                          <button
                            onClick={(e) => triggerDeleteClient(e, client.id)}
                            className="btn-ghost p-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title={t('delete') || "Delete Client"}
                          >
                            <Trash size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Mail size={12} className="flex-shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Phone size={12} className="flex-shrink-0" />
                        <span>{client.phone || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Building2 size={12} className="flex-shrink-0" />
                        <span className="truncate">{t(client.industry.toLowerCase()) || client.industry} &middot; {client.address.split(',')[0]}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="divider !my-3" />

                    {/* Cost/Value information with GSTIN display alongside it */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <FolderOpen size={12} />
                        <span>{client.projectCount} {client.projectCount !== 1 ? t('projects').toLowerCase() : t('project').toLowerCase()}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                          <IndianRupee size={11} />
                          <span>{formatCurrency(client.totalRevenue).replace('₹', '')}</span>
                        </div>
                        {client.gstin ? (
                          <div className="flex items-center gap-1 mt-0.5 text-[9px] font-mono text-slate-400" onClick={(e) => handleCopyGstin(e, client.gstin || '', client.id)}>
                            <span>{t('gstin')}: {client.gstin}</span>
                            <button
                              type="button"
                              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded cursor-pointer"
                              title="Copy GSTIN"
                            >
                              {copiedId === client.id ? <Check size={8} /> : <Copy size={8} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 italic">{t('noGstRegistered') || 'No GSTIN'}</span>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}

          {/* Add Client Modal */}
          <Modal open={showAdd} onClose={() => setShowAdd(false)} title={t('addClient')}>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateClient(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="client-company-name" className="block text-xs font-semibold text-slate-700 mb-1">{t('companyName')} *</label>
                  <input
                    id="client-company-name"
                    name="companyName"
                    type="text"
                    required
                    className="input py-2 text-sm"
                    placeholder="Acme Corp"
                    value={newCompany}
                    onChange={e => setNewCompany(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="client-contact-person" className="block text-xs font-semibold text-slate-700 mb-1">{t('contactPerson')} *</label>
                  <input
                    id="client-contact-person"
                    name="contactPerson"
                    type="text"
                    required
                    className="input py-2 text-sm"
                    placeholder="John Doe"
                    value={newContact}
                    onChange={e => setNewContact(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="client-email" className="block text-xs font-semibold text-slate-700 mb-1">{t('email')} *</label>
                  <input
                    id="client-email"
                    name="email"
                    type="email"
                    required
                    className={`input py-2 text-sm ${newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                    placeholder="john@acme.com"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                  />
                  {newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) && (
                    <p className="text-[10px] text-rose-500 mt-1">Please enter a valid email address</p>
                  )}
                </div>
                <div>
                  <label htmlFor="client-phone" className="block text-xs font-semibold text-slate-700 mb-1">{t('phone')}</label>
                  <input
                    id="client-phone"
                    name="phone"
                    type="tel"
                    className="input py-2 text-sm"
                    placeholder="+91 99999 00000"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="client-industry" className="block text-xs font-semibold text-slate-700 mb-1">{t('industry')}</label>
                  <select
                    id="client-industry"
                    name="industry"
                    className="input py-2 text-sm"
                    value={newIndustry}
                    onChange={e => setNewIndustry(e.target.value)}
                  >
                    <option value="Technology">{t('technology')}</option>
                    <option value="Hospitality">{t('hospitality')}</option>
                    <option value="FMCG">{t('fmcg')}</option>
                    <option value="Real Estate">{t('realEstate')}</option>
                    <option value="Education">{t('education')}</option>
                    <option value="Media">{t('media')}</option>
                    <option value="Other">{t('other')}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="client-status" className="block text-xs font-semibold text-slate-700 mb-1">{t('status')}</label>
                  <select
                    id="client-status"
                    name="status"
                    className="input py-2 text-sm"
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value as ClientStatus)}
                  >
                    <option value="lead">{t('lead')}</option>
                    <option value="active">{t('active')}</option>
                    <option value="inactive">{t('inactive')}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="client-address" className="block text-xs font-semibold text-slate-700 mb-1">{t('address')}</label>
                  <input
                    id="client-address"
                    name="address"
                    type="text"
                    className="input py-2 text-sm"
                    placeholder="City, State"
                    value={newAddress}
                    onChange={e => setNewAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="client-gstin" className="block text-xs font-semibold text-slate-700 mb-1">{t('gstin')}</label>
                  <input
                    id="client-gstin"
                    name="gstin"
                    type="text"
                    className={`input py-2 text-sm ${newGstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(newGstin) ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                    placeholder="e.g. 29AAACN1234F1Z0"
                    value={newGstin}
                    onChange={e => setNewGstin(e.target.value.toUpperCase())}
                  />
                  {newGstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(newGstin) && (
                    <p className="text-[10px] text-rose-500 mt-1">Format should match 15-character Indian GSTIN</p>
                  )}
                </div>
                <div>
                  <label htmlFor="client-pan" className="block text-xs font-semibold text-slate-700 mb-1">{t('pan')}</label>
                  <input
                    id="client-pan"
                    name="pan"
                    type="text"
                    className={`input py-2 text-sm ${newPan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(newPan) ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                    placeholder="e.g. ABCDE1234F"
                    value={newPan}
                    onChange={e => setNewPan(e.target.value.toUpperCase())}
                  />
                  {newPan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(newPan) && (
                    <p className="text-[10px] text-rose-500 mt-1">Format should match 10-character Indian PAN</p>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="client-notes" className="block text-xs font-semibold text-slate-700 mb-1">{t('notes')}</label>
                <textarea
                  id="client-notes"
                  name="notes"
                  className="input py-2 h-20 resize-none text-sm"
                  placeholder="Any important notes about this client..."
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                />
              </div>

              {/* Tags Input (comma separated) */}
              <div>
                <label htmlFor="client-tags" className="block text-xs font-semibold text-slate-700 mb-1">{t('tags')} ({t('commaSeparated')})</label>
                <input
                  id="client-tags"
                  type="text"
                  className="input py-2 text-sm"
                  placeholder="e.g. VIP, Priority, Retainer"
                  value={newTags}
                  onChange={e => setNewTags(e.target.value)}
                />
              </div>

              {/* Custom fields builder UI */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <label className="block text-xs font-semibold text-slate-700">{t('customMetadata')}</label>
                {customFields.map((field, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Label (e.g. Website)"
                      className="input py-1.5 text-xs flex-1"
                      value={field.label}
                      onChange={e => {
                        const updated = [...customFields]
                        updated[idx].label = e.target.value
                        setCustomFields(updated)
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      className="input py-1.5 text-xs flex-1"
                      value={field.value}
                      onChange={e => {
                        const updated = [...customFields]
                        updated[idx].value = e.target.value
                        setCustomFields(updated)
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setCustomFields(prev => prev.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:text-rose-700 text-xs font-bold px-1"
                    >
                      {t('remove')}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomFields(prev => [...prev, { label: '', value: '' }])}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                >
                  {t('addCustomField')}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1 cursor-pointer" onClick={() => setShowAdd(false)}>{t('cancel')}</button>
                <button type="submit" className="btn-primary flex-1 justify-center cursor-pointer">
                  <Plus size={15} /> {t('createClient')}
                </button>
              </div>
            </form>
          </Modal>

          {/* Bulk Action floating controls */}
          {selectedIds.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up border border-slate-800">
              <span className="text-xs font-semibold">{selectedIds.length} {t('selected')}</span>
              <div className="w-px h-4 bg-slate-700" />
              <button
                onClick={() => {
                  const selectedClients = clients.filter(c => selectedIds.includes(c.id));
                  const headers = ['Company Name', 'Contact Person', 'Email', 'Phone', 'Industry', 'Status', 'GSTIN', 'Total Revenue'];
                  const csvRows = [
                    headers.join(','),
                    ...selectedClients.map(c => [
                      `"${c.companyName}"`,
                      `"${c.contactPerson}"`,
                      `"${c.email}"`,
                      `"${c.phone || ''}"`,
                      `"${c.industry}"`,
                      `"${c.status}"`,
                      `"${c.gstin || ''}"`,
                      c.totalRevenue
                    ].join(','))
                  ];
                  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.setAttribute('href', url);
                  a.setAttribute('download', `zenith_clients_export.csv`);
                  a.click();
                }}
                className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
              >
                {t('exportCsv')}
              </button>
              <button
                onClick={triggerBulkDelete}
                className="text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
              >
                {t('delete')}
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs font-bold text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
            </div>
          )}

          {/* Confirmation Modals */}
          <ConfirmationModal
            open={confirmDeleteOpen}
            onClose={() => setConfirmDeleteOpen(false)}
            onConfirm={handleConfirmDelete}
            title={pendingBulkDelete ? t('deleteMultipleClients') : t('deleteClientTitle')}
            message={
              pendingBulkDelete 
                ? t('deleteMultipleClientsDesc')
                : t('deleteClientDesc')
            }
            confirmText={t('delete')}
            cancelText={t('cancel')}
            variant="danger"
          />
        </div>
      )}
    </Layout>
  )
}
