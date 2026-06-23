import { useState, useEffect } from 'react'
import { Plus, Search, Calendar, IndianRupee, CheckSquare, MoreHorizontal, Users, Trash } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { ProjectStatusBadge, EmptyState, Modal, Progress, Avatar, Skeleton, ConfirmationModal } from '../components/ui/index'
import { formatCurrency, getDaysUntil } from '../lib/utils'
import type { ProjectStatus, Project } from '../types'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const STATUS_FILTERS: { label: string; value: ProjectStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Review', value: 'review' },
  { label: 'Draft', value: 'draft' },
  { label: 'Completed', value: 'completed' },
  { label: 'Archived', value: 'archived' },
]

const getUserName = (id: string) => {
  if (id === 'u1') return 'Divya Menon'
  if (id === 'u2') return 'Rahul Iyer'
  if (id === 'u3') return 'Sneha Bhat'
  return 'Unassigned'
}

export default function ProjectsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'super_admin'
  const toast = useToast()

  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)

  // Bulk selection and confirmation states
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)

  // Form states
  const [projectName, setProjectName] = useState('')
  const [selectedClientIdForNewProject, setSelectedClientIdForNewProject] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [deadline, setDeadline] = useState('')
  const [budget, setBudget] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('draft')
  const [assignedUser, setAssignedUser] = useState('')
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [defaultTaxRate, setDefaultTaxRate] = useState(18)
  const [defaultDiscountRate, setDefaultDiscountRate] = useState(0)

  // Confirmation triggers
  const triggerDeleteProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    setPendingDeleteId(projectId)
    setPendingBulkDelete(false)
    setConfirmDeleteOpen(true)
  }

  const triggerBulkDelete = () => {
    setPendingBulkDelete(true)
    setPendingDeleteId(null)
    setConfirmDeleteOpen(true)
  }

  const handleConfirmDelete = () => {
    if (pendingBulkDelete) {
      setLoading(true)
      Promise.all(selectedIds.map(id => api.delete(`/projects/${id}`)))
        .then(() => {
          fetchProjects()
          setSelectedIds([])
          toast.success('Selected projects deleted successfully.')
        })
        .catch(err => toast.error(err.response?.data?.error || err.message))
        .finally(() => setLoading(false))
    } else if (pendingDeleteId) {
      setLoading(true)
      api.delete(`/projects/${pendingDeleteId}`)
        .then(() => {
          fetchProjects()
          toast.success('Project deleted successfully.')
        })
        .catch(err => toast.error(err.response?.data?.error || err.message))
        .finally(() => setLoading(false))
    }
  }

  // Load draft project from localStorage
  useEffect(() => {
    if (showAdd) {
      const draft = localStorage.getItem('zenith_draft_project')
      if (draft) {
        try {
          const parsed = JSON.parse(draft)
          setProjectName(parsed.projectName || '')
          setSelectedClientIdForNewProject(parsed.selectedClientId || '')
          setDescription(parsed.description || '')
          setStartDate(parsed.startDate || '')
          setDeadline(parsed.deadline || '')
          setBudget(parsed.budget || '')
          setStatus(parsed.status || 'draft')
          setAssignedUser(parsed.assignedUser || '')
          setDefaultTaxRate(parsed.defaultTaxRate ?? 18)
          setDefaultDiscountRate(parsed.defaultDiscountRate ?? 0)
        } catch (e) {
          console.error(e)
        }
      }
    }
  }, [showAdd])

  // Save draft project to localStorage on field change
  useEffect(() => {
    if (showAdd) {
      const draft = {
        projectName,
        selectedClientId: selectedClientIdForNewProject,
        description,
        startDate,
        deadline,
        budget,
        status,
        assignedUser,
        defaultTaxRate,
        defaultDiscountRate
      }
      localStorage.setItem('zenith_draft_project', JSON.stringify(draft))
    }
  }, [projectName, selectedClientIdForNewProject, description, startDate, deadline, budget, status, assignedUser, defaultTaxRate, defaultDiscountRate, showAdd])

  const clearDraft = () => {
    localStorage.removeItem('zenith_draft_project')
  }

  const fetchProjects = () => {
    api.get('/projects?limit=100')
      .then(res => {
        setProjects(res.data.projects)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchProjects()
    api.get('/clients?limit=100').then(res => setClients(res.data.clients || []))
    api.get('/auth/users').then(res => setUsersList(res.data || []))
  }, [])

  const getMemberName = (member: any) => {
    if (typeof member === 'object' && member !== null) {
      return member.name
    }
    const found = usersList.find(u => u.id === member || u._id === member)
    return found ? found.name : 'Team Member'
  }

  const handleCreateProject = () => {
    setFormSubmitted(true)
    if (!projectName || !selectedClientIdForNewProject || !assignedUser) {
      toast.error('Please fill in all required fields (Project Name, Client, and Assigned User).')
      return
    }
    const payload = {
      name: projectName,
      description,
      clientId: selectedClientIdForNewProject,
      startDate: startDate || new Date().toISOString().split('T')[0],
      deadline: deadline || new Date().toISOString().split('T')[0],
      budget: Number(budget) || 0,
      status: status,
      teamMembers: [assignedUser],
      defaultTaxRate,
      defaultDiscountRate,
    }
    api.post('/projects', payload)
      .then(() => {
        fetchProjects()
        setShowAdd(false)
        clearDraft()
        setFormSubmitted(false)
        toast.success('Project created successfully.')
        // Clear inputs
        setProjectName('')
        setSelectedClientIdForNewProject('')
        setDescription('')
        setStartDate('')
        setDeadline('')
        setBudget('')
        setStatus('draft')
        setAssignedUser('')
        setDefaultTaxRate(18)
        setDefaultDiscountRate(0)
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.message)
      })
  }

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.clientName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <Layout title="Projects">
      <div className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{projects.filter(p => p.status === 'active').length} active &middot; {projects.length} total</p>
        </div>
        <button className="btn-primary flex items-center gap-2 cursor-pointer" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="input pl-9 py-2" />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${statusFilter === f.value ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-3 w-5/6" />
              <div className="flex gap-4">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📁" title="No projects found" description="Create your first project to get started." action={<button className="btn-primary cursor-pointer" onClick={() => setShowAdd(true)}><Plus size={15} /> New Project</button>} />
      ) : (
        <div className="space-y-3">
          {filtered.map(project => {
            const daysLeft = getDaysUntil(project.deadline)
            const overdue = daysLeft < 0
            return (
              <div
                key={project.id}
                className={`card-hover p-5 cursor-pointer group flex flex-col justify-between ${
                  selectedIds.includes(project.id) ? 'ring-2 ring-orange-500 bg-orange-50/10' : ''
                }`}
              >
                <div className="flex flex-wrap items-start gap-4">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(project.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(prev => [...prev, project.id])
                        } else {
                          setSelectedIds(prev => prev.filter(id => id !== project.id))
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer flex-shrink-0 mt-1"
                    />
                  )}
                  {/* Left */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <h3 className="font-semibold text-navy-900 text-sm">{project.name}</h3>
                      <ProjectStatusBadge status={project.status} />
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{project.clientName}</p>
                    <p className="text-xs text-slate-600 line-clamp-1 mb-3">{project.description}</p>
                    <Progress value={project.progress} showLabel />
                  </div>

                  {/* Stats & Assignment */}
                  <div className="flex flex-col items-end gap-3 flex-shrink-0">

                    {/* Top Row - Budget, Tasks, Deadline */}
                    <div className="flex items-center gap-6">

                      <div className="text-center min-w-[80px]">
                        <div className="flex items-center justify-center gap-1 text-xs text-slate-500 mb-0.5">
                          <IndianRupee size={11} />
                          <span>Budget</span>
                        </div>
                        <p className="text-sm font-semibold text-navy-900">
                          {formatCurrency(project.budget)}
                        </p>
                      </div>

                      <div className="text-center min-w-[60px]">
                        <div className="flex items-center justify-center gap-1 text-xs text-slate-500 mb-0.5">
                          <CheckSquare size={11} />
                          <span>Tasks</span>
                        </div>
                        <p className="text-sm font-semibold text-navy-900">
                          {project.completedTasks}/{project.taskCount}
                        </p>
                      </div>

                      <div className="text-center min-w-[90px]">
                        <div className="flex items-center justify-center gap-1 text-xs text-slate-500 mb-0.5">
                          <Calendar size={11} />
                          <span>Deadline</span>
                        </div>
                        <p
                          className={`text-sm font-semibold ${
                            overdue
                              ? 'text-rose-600'
                              : daysLeft <= 14
                              ? 'text-amber-600'
                              : 'text-navy-900'
                          }`}
                        >
                          {overdue
                            ? `${Math.abs(daysLeft)}d overdue`
                            : `${daysLeft}d left`}
                        </p>
                      </div>

                      {isAdmin ? (
                        <button
                          onClick={(e) => triggerDeleteProject(e, project.id)}
                          className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                          title="Delete Project"
                        >
                          <Trash size={16} />
                        </button>
                      ) : (
                        <button className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <MoreHorizontal size={16} />
                        </button>
                      )}

                    </div>

                    {/* Assigned User Below Stats */}
                    <div className="w-auto flex flex-col gap-1">
                      {project.teamMembers.slice(0, 2).map((member: any) => (
                        <div
                          key={typeof member === 'object' ? member.id : member}
                          className="border border-slate-200 rounded-md px-3 py-1.5 bg-slate-50 hover:bg-slate-100 cursor-pointer text-center min-w-[180px]"
                        >
                          <span className="text-xs font-medium text-slate-900">
                            {getMemberName(member)}
                          </span>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Project Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setFormSubmitted(false); }} title="Create New Project" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Project Name *</label>
            <input
              className={`input text-sm py-2 ${formSubmitted && !projectName ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
              placeholder="Brand Identity Redesign"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
            />
            {formSubmitted && !projectName && <p className="text-[10px] text-rose-500 mt-1">Project name is required</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Client *</label>
              <select
                className={`input text-sm py-2 ${formSubmitted && !selectedClientIdForNewProject ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                value={selectedClientIdForNewProject}
                onChange={e => setSelectedClientIdForNewProject(e.target.value)}
              >
                <option value="">Select client...</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.companyName}</option>
                ))}
              </select>
              {formSubmitted && !selectedClientIdForNewProject && <p className="text-[10px] text-rose-500 mt-1">Client is required</p>}
            </div>

            {/* New Assigned User dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned User *</label>
              <select
                className={`input text-sm py-2 ${formSubmitted && !assignedUser ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                value={assignedUser}
                onChange={e => setAssignedUser(e.target.value)}
              >
                <option value="">Select responsible user...</option>
                {usersList.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>
                ))}
              </select>
              {formSubmitted && !assignedUser && <p className="text-[10px] text-rose-500 mt-1">Responsible user assignment is required</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea className="input h-20 resize-none text-sm py-2" placeholder="Brief description of the project scope..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
              <input type="date" className="input text-sm py-2" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Deadline</label>
              <input type="date" className="input text-sm py-2" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Budget (₹)</label>
              <input type="number" className="input text-sm py-2" placeholder="100000" value={budget} onChange={e => setBudget(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default Tax Rate (%)</label>
              <input type="number" className="input text-sm py-2" placeholder="18" value={defaultTaxRate} onChange={e => setDefaultTaxRate(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default Discount Rate (%)</label>
              <input type="number" className="input text-sm py-2" placeholder="0" value={defaultDiscountRate} onChange={e => setDefaultDiscountRate(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select className="input text-sm py-2" value={status} onChange={e => setStatus(e.target.value as ProjectStatus)}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1 cursor-pointer" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn-primary flex-1 justify-center cursor-pointer" onClick={handleCreateProject}>
              <Plus size={15} /> Create Project
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Action floating controls */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up border border-slate-800">
          <span className="text-xs font-semibold">{selectedIds.length} selected</span>
          <div className="w-px h-4 bg-slate-700" />
          <button
            onClick={() => {
              const selectedProjects = projects.filter(p => selectedIds.includes(p.id));
              const headers = ['Project Name', 'Client Name', 'Description', 'Budget', 'Progress', 'Status', 'Deadline'];
              const csvRows = [
                headers.join(','),
                ...selectedProjects.map(p => [
                  `"${p.name}"`,
                  `"${p.clientName}"`,
                  `"${p.description || ''}"`,
                  p.budget,
                  `${p.progress}%`,
                  `"${p.status}"`,
                  `"${p.deadline}"`
                ].join(','))
              ];
              const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.setAttribute('href', url);
              a.setAttribute('download', `zenith_projects_export.csv`);
              a.click();
            }}
            className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
          >
            Export CSV
          </button>
          <button
            onClick={triggerBulkDelete}
            className="text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
          >
            Delete
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="text-xs font-bold text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmationModal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title={pendingBulkDelete ? "Delete Multiple Projects?" : "Delete Project?"}
        message={
          pendingBulkDelete 
            ? `Are you sure you want to permanently delete these ${selectedIds.length} selected projects? This action is destructive and cannot be undone.`
            : "Are you sure you want to permanently delete this project? This action is destructive and cannot be undone."
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </Layout>
  )
}
