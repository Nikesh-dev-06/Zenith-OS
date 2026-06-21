import { useState, useEffect } from 'react'
import {
  Plus, Search, Filter, Building2, Mail, Phone, FolderOpen,
  IndianRupee, MoreHorizontal, ArrowLeft, Copy, Check, Clock, CheckCircle
} from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { ClientStatusBadge, Avatar, EmptyState, Modal, Progress, InvoiceStatusBadge } from '../components/ui/index'
import { formatCurrency, formatRelativeTime } from '../lib/utils'
import type { Client, ClientStatus } from '../types'
import api from '../lib/api'

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [clientProjects, setClientProjects] = useState<any[]>([])
  const [clientInvoices, setClientInvoices] = useState<any[]>([])
  const [clientLogs, setClientLogs] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  
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

  const activeFilterCount = 
    (statusFilter !== 'all' ? 1 : 0) + 
    (industryFilter !== 'all' ? 1 : 0) + 
    (revenueFilter !== 'all' ? 1 : 0)

  const handleCopyGstin = (e: React.MouseEvent, gstin: string, id: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(gstin)
    setCopiedId(id)
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
    if (clientId) {
      api.get(`/projects?clientId=${clientId}`).then(res => setClientProjects(res.data.projects || []))
      api.get(`/invoices?clientId=${clientId}`).then(res => setClientInvoices(res.data.invoices || []))
      api.get(`/activity`).then(res => {
        setClientLogs(res.data.logs || [])
      })
    } else {
      setClientProjects([])
      setClientInvoices([])
      setClientLogs([])
    }
  }

  const handleCreateClient = () => {
    if (!newCompany || !newContact || !newEmail) {
      alert('Please fill in all required fields.')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      alert('Please enter a valid email address.')
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
    }
    api.post('/clients', payload)
      .then(() => {
        fetchClients()
        setShowAdd(false)
        
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
      })
      .catch(err => {
        alert(err.response?.data?.error || err.message)
      })
  }

  const filtered = clients.filter(c => {
    const matchSearch = c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.gstin && c.gstin.toLowerCase().includes(search.toLowerCase()))
    
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

    return (
      <div className="space-y-6 animate-slide-up">
        {/* Back control */}
        <button
          onClick={() => handleSelectClient(null)}
          className="btn-ghost flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-orange-600 mb-2 px-0 cursor-pointer"
        >
          <ArrowLeft size={12} /> Back to Clients
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
              <p className="text-sm text-slate-500 mt-1">Established client since {new Date(client.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase">Industry:</span>
            <span className="badge badge-info bg-blue-50 text-blue-700 capitalize font-bold">{client.industry}</span>
          </div>
        </div>

        {/* Profile Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left: Contact Info & Financial details */}
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="section-title mb-4">Contact Information</h2>
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Person</label>
                  <p className="text-sm font-medium text-navy-900 mt-0.5">{client.contactPerson}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                  <p className="text-sm font-medium text-navy-900 mt-0.5 break-all">{client.email}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</label>
                  <p className="text-sm font-medium text-navy-900 mt-0.5">{client.phone || '—'}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address</label>
                  <p className="text-sm font-medium text-navy-900 mt-0.5">{client.address}</p>
                </div>
                {client.notes && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client Notes</label>
                    <p className="text-xs font-medium text-slate-600 mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">{client.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* GSTIN & Cost/Value info displayed alongside each other */}
            <div className="card p-6 border-l-4 border-emerald-500">
              <h2 className="section-title mb-4">GST & Financial Details</h2>
              <div className="space-y-4">
                
                {/* GST Display alongside cost/value info */}
                <div className="bg-emerald-50/50 rounded-xl p-3.5 border border-emerald-100/50">
                  <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Client GSTIN</label>
                  {client.gstin ? (
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <span className="text-sm font-bold text-emerald-950 font-mono tracking-wide">{client.gstin}</span>
                      <button
                        type="button"
                        onClick={(e) => handleCopyGstin(e, client.gstin || '', 'detail')}
                        className="btn-ghost p-1 text-emerald-700 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer"
                        title="Copy GSTIN"
                      >
                        {copiedId === 'detail' ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1 italic">No GST registered</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue</span>
                    <span className="text-lg font-bold text-navy-900 block mt-1">{formatCurrency(client.totalRevenue)}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding</span>
                    <span className={`text-lg font-bold block mt-1 ${totalOutstanding > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {formatCurrency(totalOutstanding)}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Projects Summary</span>
                    <span className="text-xs text-slate-500 mt-0.5">{client.projectCount} active projects</span>
                  </div>
                  <span className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm">
                    {client.projectCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Lists & Tabs (Projects, Invoices, Logs) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Projects Section */}
            <div className="card p-6">
              <h2 className="section-title mb-4 flex items-center gap-2">
                <FolderOpen size={16} className="text-orange-600" />
                <span>Related Projects ({clientProjects.length})</span>
              </h2>
              {clientProjects.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No projects currently assigned to this client.</p>
              ) : (
                <div className="space-y-4">
                  {clientProjects.map(project => (
                    <div key={project.id} className="border border-slate-100 rounded-xl p-4 hover:border-slate-200 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div>
                          <h4 className="font-semibold text-sm text-navy-900">{project.name}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">Budget: {formatCurrency(project.budget)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`badge ${
                            project.status === 'completed' ? 'badge-success' : 
                            project.status === 'review' ? 'badge-warning' : 'badge-info'
                          } capitalize text-[10px]`}>
                            {project.status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Progress value={project.progress} showLabel />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 mt-2">
                        <span>Tasks: {project.completedTasks}/{project.taskCount} done</span>
                        <span>Due: {new Date(project.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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
                <span>Client Invoices ({clientInvoices.length})</span>
              </h2>
              {clientInvoices.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No invoices recorded for this client.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase">
                        <th className="pb-2">Invoice #</th>
                        <th className="pb-2">Amount</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Due Date</th>
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

            {/* Activity Log Section */}
            <div className="card p-6">
              <h2 className="section-title mb-4 flex items-center gap-2">
                <CheckCircle size={16} className="text-orange-600" />
                <span>Recent History & Activities ({filteredLogs.length})</span>
              </h2>
              {filteredLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No activity recorded for this client.</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
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

          </div>
        </div>
      </div>
    )
  }

  return (
    <Layout title="Clients">
      
      {/* Dynamic View rendering */}
      {selectedClient ? (
        renderDetailView(selectedClient)
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="page-header flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="page-title">Clients</h1>
              <p className="page-subtitle">{clients.length} total · {clients.filter(c => c.status === 'active').length} active</p>
            </div>
            <button className="btn-primary flex items-center gap-2 cursor-pointer" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Add Client
            </button>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, contact, GST..."
                className="input pl-9 py-2"
              />
            </div>

            {/* Redesigned Accessible Filters Button */}
            <button
              id="filter-toggle-btn"
              aria-expanded={showFilters}
              aria-controls="advanced-filters-panel"
              aria-label="Toggle advanced filters panel"
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/25 ${
                showFilters ? 'bg-orange-50 border-orange-300 text-orange-600 font-semibold' : ''
              }`}
            >
              <Filter size={15} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Redesigned Advanced Filters Panel */}
          {showFilters && (
            <div
              id="advanced-filters-panel"
              className="card p-4 bg-slate-50/70 border border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up"
            >
              {/* Filter by Status */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as ClientStatus | 'all')}
                  className="input py-2 bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="lead">Lead</option>
                </select>
              </div>

              {/* Filter by Industry */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Industry</label>
                <select
                  value={industryFilter}
                  onChange={e => setIndustryFilter(e.target.value)}
                  className="input py-2 bg-white"
                >
                  <option value="all">All Industries</option>
                  <option value="Technology">Technology</option>
                  <option value="Hospitality">Hospitality</option>
                  <option value="FMCG">FMCG</option>
                  <option value="Real Estate">Real Estate</option>
                  <option value="Education">Education</option>
                  <option value="Media">Media</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Filter by Revenue Range */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Revenue Range</label>
                <select
                  value={revenueFilter}
                  onChange={e => setRevenueFilter(e.target.value)}
                  className="input py-2 bg-white"
                >
                  <option value="all">All Ranges</option>
                  <option value="high">High (&ge; ₹3L)</option>
                  <option value="medium">Medium (₹1L - ₹3L)</option>
                  <option value="low">Low (&lt; ₹1L)</option>
                </select>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="input py-2 bg-white"
                >
                  <option value="name_asc">Company Name (A-Z)</option>
                  <option value="name_desc">Company Name (Z-A)</option>
                  <option value="revenue_desc">Revenue (High to Low)</option>
                  <option value="projects_desc">Projects Count (High to Low)</option>
                </select>
              </div>
            </div>
          )}

          {/* Grid Layout of Clients */}
          {filtered.length === 0 ? (
            <EmptyState
              icon="👥"
              title="No clients found"
              description="Try adjusting your filters or add a new client record."
              action={
                <button className="btn-primary flex items-center gap-2 cursor-pointer" onClick={() => setShowAdd(true)}>
                  <Plus size={15} /> Add Client
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(client => (
                <div
                  key={client.id}
                  onClick={() => handleSelectClient(client.id)}
                  className="card-hover p-5 cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={client.companyName} size="md" />
                        <div>
                          <h3 className="font-semibold text-navy-900 text-sm leading-tight">{client.companyName}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">{client.contactPerson}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClientStatusBadge status={client.status} />
                        <button className="btn-ghost p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal size={14} />
                        </button>
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
                        <span className="truncate">{client.industry} &middot; {client.address.split(',')[0]}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="divider !my-3" />

                    {/* Cost/Value information with GSTIN display alongside it */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <FolderOpen size={12} />
                        <span>{client.projectCount} project{client.projectCount !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                          <IndianRupee size={11} />
                          <span>{formatCurrency(client.totalRevenue).replace('₹', '')}</span>
                        </div>
                        {client.gstin ? (
                          <div className="flex items-center gap-1 mt-0.5 text-[9px] font-mono text-slate-400" onClick={(e) => handleCopyGstin(e, client.gstin || '', client.id)}>
                            <span>GSTIN: {client.gstin}</span>
                            <button
                              type="button"
                              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded cursor-pointer"
                              title="Copy GSTIN"
                            >
                              {copiedId === client.id ? <Check size={8} /> : <Copy size={8} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 italic">No GSTIN</span>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}

          {/* Add Client Modal */}
          <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Client">
            <form onSubmit={(e) => { e.preventDefault(); handleCreateClient(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="client-company-name" className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
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
                  <label htmlFor="client-contact-person" className="block text-xs font-semibold text-slate-700 mb-1">Contact Person *</label>
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
                  <label htmlFor="client-email" className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                  <input
                    id="client-email"
                    name="email"
                    type="email"
                    required
                    className="input py-2 text-sm"
                    placeholder="john@acme.com"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="client-phone" className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
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
                  <label htmlFor="client-industry" className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
                  <select
                    id="client-industry"
                    name="industry"
                    className="input py-2 text-sm"
                    value={newIndustry}
                    onChange={e => setNewIndustry(e.target.value)}
                  >
                    <option value="Technology">Technology</option>
                    <option value="Hospitality">Hospitality</option>
                    <option value="FMCG">FMCG</option>
                    <option value="Real Estate">Real Estate</option>
                    <option value="Education">Education</option>
                    <option value="Media">Media</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="client-status" className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    id="client-status"
                    name="status"
                    className="input py-2 text-sm"
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value as ClientStatus)}
                  >
                    <option value="lead">Lead</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="client-address" className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
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
                  <label htmlFor="client-gstin" className="block text-xs font-semibold text-slate-700 mb-1">GSTIN</label>
                  <input
                    id="client-gstin"
                    name="gstin"
                    type="text"
                    className="input py-2 text-sm"
                    placeholder="e.g. 29AAACN1234F1Z0"
                    value={newGstin}
                    onChange={e => setNewGstin(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="client-notes" className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  id="client-notes"
                  name="notes"
                  className="input py-2 h-20 resize-none text-sm"
                  placeholder="Any important notes about this client..."
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1 cursor-pointer" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center cursor-pointer">
                  <Plus size={15} /> Create Client
                </button>
              </div>
            </form>
          </Modal>
        </div>
      )}
    </Layout>
  )
}
