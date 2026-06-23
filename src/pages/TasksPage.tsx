import { useState, useEffect } from 'react'
import { Plus, ArrowUpDown, ArrowUp, ArrowDown, Play, Square, Clock, ClipboardList, Calendar } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { TaskStatusBadge, PriorityBadge, Avatar, Modal, EmptyState, Skeleton, ConfirmationModal } from '../components/ui/index'
import { formatDate } from '../lib/utils'
import type { TaskStatus } from '../types'
import api from '../lib/api'
import { useToast } from '../context/ToastContext'

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'pending', label: 'Pending', color: 'bg-slate-100' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-50' },
  { id: 'review', label: 'In Review', color: 'bg-amber-50' },
  { id: 'done', label: 'Done', color: 'bg-emerald-50' },
]

export default function TasksPage() {
  const toast = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const [tasks, setTasks] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Section C task timer & details state extensions
  const [detailTask, setDetailTask] = useState<any | null>(null)
  const [manualMinutes, setManualMinutes] = useState('')
  const [manualDesc, setManualDesc] = useState('')
  const [addingTimeLog, setAddingTimeLog] = useState(false)
  const [stopTimerDesc, setStopTimerDesc] = useState('')
  const [showStopTimerModal, setShowStopTimerModal] = useState<any | null>(null)
  
  // Real-time ticking trigger
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Form states
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [formSubmitted, setFormSubmitted] = useState(false)

  // Sorting and selection states
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sortField, setSortField] = useState<'title' | 'priority' | 'dueDate' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const fetchTasks = () => {
    api.get('/tasks')
      .then(res => {
        setTasks(res.data)
        setLoading(false)
        // Refresh detail task if open
        if (detailTask) {
          const updated = res.data.find((t: any) => t.id === detailTask.id)
          if (updated) setDetailTask(updated)
        }
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchTasks()
    api.get('/projects?limit=100').then(res => setProjects(res.data.projects || []))
    api.get('/auth/users').then(res => setUsersList(res.data || []))

    const params = new URLSearchParams(window.location.search)
    if (params.get('create') === 'true') {
      setShowAdd(true)
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const handleCreateTask = () => {
    setFormSubmitted(true)
    if (!title || !projectId || !assigneeId) {
      toast.error('Title, Project, and Assignee are required.')
      return
    }
    const payload = {
      title,
      projectId,
      description,
      priority: priority.toLowerCase(),
      assigneeId,
      dueDate: dueDate || new Date().toISOString().split('T')[0],
      status: 'pending',
    }
    api.post('/tasks', payload)
      .then(() => {
        fetchTasks()
        setShowAdd(false)
        setFormSubmitted(false)
        toast.success('Task created successfully.')
        setTitle('')
        setProjectId('')
        setDescription('')
        setPriority('medium')
        setAssigneeId('')
        setDueDate('')
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.message)
      })
  }

  const handleUpdateTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    api.put(`/tasks/${taskId}`, { status: newStatus })
      .then(() => {
        fetchTasks()
        toast.success('Task status updated.')
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.message)
      })
  }

  const handleConfirmDelete = () => {
    setLoading(true)
    Promise.all(selectedIds.map(id => api.delete(`/tasks/${id}`)))
      .then(() => {
        fetchTasks()
        setSelectedIds([])
        toast.success('Selected tasks deleted successfully.')
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const handleSort = (field: 'title' | 'priority' | 'dueDate') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Timer controls
  const handleStartTimer = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    try {
      await api.post(`/tasks/${taskId}/timer/start`)
      toast.success('Task tracking started.')
      fetchTasks()
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const handleStopTimerPrompt = (e: React.MouseEvent, task: any) => {
    e.stopPropagation()
    setStopTimerDesc('')
    setShowStopTimerModal(task)
  }

  const handleStopTimerConfirm = async () => {
    if (!showStopTimerModal) return
    try {
      await api.post(`/tasks/${showStopTimerModal.id}/timer/stop`, {
        description: stopTimerDesc.trim() || undefined
      })
      toast.success('Task tracking stopped and log recorded.')
      setShowStopTimerModal(null)
      fetchTasks()
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const handleAddManualTimeLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualMinutes || Number(manualMinutes) <= 0 || !detailTask) {
      toast.error('Please enter a valid duration.')
      return
    }
    setAddingTimeLog(true)
    try {
      await api.post(`/tasks/${detailTask.id}/time-log`, {
        durationMinutes: Number(manualMinutes),
        description: manualDesc.trim() || undefined
      })
      toast.success('Manual time log added.')
      setManualMinutes('')
      setManualDesc('')
      fetchTasks()
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
    } finally {
      setAddingTimeLog(false)
    }
  }

  const getTickingTime = (startedAtStr: string) => {
    const startedAt = new Date(startedAtStr)
    const diffMs = new Date().getTime() - startedAt.getTime()
    const diffSec = Math.max(0, Math.floor(diffMs / 1000))
    const hrs = Math.floor(diffSec / 3600)
    const mins = Math.floor((diffSec % 3600) / 60)
    const secs = diffSec % 60
    return `${hrs > 0 ? hrs + 'h ' : ''}${mins}m ${secs}s`
  }

  const filteredTasks = tasks.filter(t => statusFilter === 'all' || t.status === statusFilter)

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (!sortField) return 0
    let aVal = a[sortField] || ''
    let bVal = b[sortField] || ''

    if (sortField === 'priority') {
      const priorityWeights: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }
      aVal = priorityWeights[a.priority] || 0
      bVal = priorityWeights[b.priority] || 0
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  return (
    <Layout title="Tasks">
      <div className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">{tasks.filter(t => t.status !== 'done').length} open · {tasks.filter(t => t.status === 'done').length} done</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'kanban' ? 'bg-white shadow-sm text-navy-900' : 'text-slate-500'}`}>Kanban</button>
            <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'list' ? 'bg-white shadow-sm text-navy-900' : 'text-slate-500'}`}>List</button>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === 'all' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'}`}>All</button>
            <button onClick={() => setStatusFilter('pending')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === 'pending' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'}`}>Pending</button>
            <button onClick={() => setStatusFilter('in_progress')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === 'in_progress' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'}`}>In Progress</button>
            <button onClick={() => setStatusFilter('done')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === 'done' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'}`}>Done</button>
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Add Task
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(col => (
            <div key={col} className="bg-slate-50 rounded-2xl p-3 space-y-3">
              <Skeleton className="h-6 w-1/3 mb-2" />
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl p-3.5 space-y-3 border border-slate-100 shadow-sm">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-5/6" />
                  <div className="flex justify-between items-center mt-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 overflow-x-auto">
          {COLUMNS.filter(col => statusFilter === 'all' || col.id === statusFilter).map(col => {
            const colTasks = tasks.filter(t => t.status === col.id)
            return (
              <div key={col.id} className={`${col.color} rounded-2xl p-3 min-h-[400px]`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-navy-900">{col.label}</span>
                    <span className="w-5 h-5 rounded-full bg-white text-xs font-bold text-slate-600 flex items-center justify-center shadow-sm">
                      {colTasks.length}
                    </span>
                  </div>
                  <button className="btn-ghost p-1 text-slate-400" onClick={() => setShowAdd(true)}>
                    <Plus size={14} />
                  </button>
                </div>
                <div className="space-y-2.5">
                  {colTasks.length === 0 && (
                    <EmptyState
                      icon="📝"
                      title={`No ${col.label} Tasks`}
                      description={`There are no tasks currently in ${col.label} status.`}
                      action={
                        <button
                          onClick={() => {
                            setTitle('');
                            setShowAdd(true);
                          }}
                          className="btn-secondary text-xs py-1.5 px-3 cursor-pointer"
                        >
                          Create Task
                        </button>
                      }
                    />
                  )}
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => setDetailTask(task)}
                      className="bg-white rounded-xl p-3.5 shadow-card hover:shadow-card-hover transition-all duration-150 border border-slate-50 cursor-pointer space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-navy-900 leading-snug flex-1">{task.title}</p>
                        <PriorityBadge priority={task.priority} />
                      </div>
                      
                      <p className="text-xs text-slate-500 line-clamp-2">{task.description}</p>
                      
                      {/* Timer details in Kanban card */}
                      {task.isTimerRunning && task.timerStartedAt && (
                        <div className="bg-rose-50 border border-rose-100 rounded-lg p-2 flex justify-between items-center text-xs animate-pulse" onClick={e => e.stopPropagation()}>
                          <span className="text-rose-700 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                            Ticking: {getTickingTime(task.timerStartedAt)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleStopTimerPrompt(e, task)}
                            className="bg-rose-600 hover:bg-rose-700 text-white rounded p-1"
                            title="Stop Tracking"
                          >
                            <Square size={10} fill="white" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-55">
                        <div className="flex items-center gap-1.5">
                          <Avatar name={task.assigneeName} size="sm" />
                          <span className="text-xs text-slate-500">{task.assigneeName?.split(' ')[0]}</span>
                        </div>
                        
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          {!task.isTimerRunning && (
                            <button
                              type="button"
                              onClick={(e) => handleStartTimer(e, task.id)}
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-orange-600 transition-colors"
                              title="Start Tracking"
                            >
                              <Play size={12} fill="currentColor" />
                            </button>
                          )}
                          <select
                            value={task.status}
                            onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as any)}
                            className="text-xs bg-slate-55 border border-slate-200 rounded p-1 font-semibold text-slate-700"
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="review">Review</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-50 flex justify-between items-center text-[10px] text-slate-400">
                        <span>Due {formatDate(task.dueDate)}</span>
                        {task.totalLoggedTime > 0 && (
                          <span className="bg-slate-50 px-1.5 py-0.5 rounded font-mono text-slate-505 font-semibold flex items-center gap-0.5">
                            <Clock size={9} /> {task.totalLoggedTime}m
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="table-header w-10">
                  <input
                    type="checkbox"
                    checked={sortedTasks.length > 0 && selectedIds.length === sortedTasks.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(sortedTasks.map(t => t.id))
                      } else {
                        setSelectedIds([])
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                  />
                </th>
                <th className="table-header text-left cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('title')}>
                  <div className="flex items-center gap-1">
                    <span>Task</span>
                    {sortField === 'title' ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
                  </div>
                </th>
                <th className="table-header text-left">Assignee</th>
                <th className="table-header text-left cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('priority')}>
                  <div className="flex items-center gap-1">
                    <span>Priority</span>
                    {sortField === 'priority' ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
                  </div>
                </th>
                <th className="table-header text-left">Status</th>
                <th className="table-header text-left">Change Status</th>
                <th className="table-header text-left cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort('dueDate')}>
                  <div className="flex items-center gap-1">
                    <span>Due Date</span>
                    {sortField === 'dueDate' ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map(task => (
                <tr
                  key={task.id}
                  onClick={() => setDetailTask(task)}
                  className="table-row cursor-pointer hover:bg-slate-50/50"
                >
                  <td className="table-cell" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(task.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(prev => [...prev, task.id])
                        } else {
                          setSelectedIds(prev => prev.filter(id => id !== task.id))
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                    />
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2 justify-between">
                      <div>
                        <p className="font-semibold text-navy-900 text-sm">{task.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{task.description}</p>
                      </div>
                      
                      {/* Active running timer widget in row */}
                      {task.isTimerRunning && task.timerStartedAt && (
                        <span className="text-[10px] bg-rose-50 border border-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold flex items-center gap-1.5 animate-pulse" onClick={e => e.stopPropagation()}>
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                          {getTickingTime(task.timerStartedAt)}
                          <button
                            type="button"
                            onClick={(e) => handleStopTimerPrompt(e, task)}
                            className="bg-rose-600 hover:bg-rose-700 text-white rounded p-0.5"
                          >
                            <Square size={8} fill="white" />
                          </button>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <Avatar name={task.assigneeName} size="sm" />
                      <span className="text-sm text-slate-600">{task.assigneeName?.split(' ')[0]}</span>
                    </div>
                  </td>
                  <td className="table-cell"><PriorityBadge priority={task.priority} /></td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <TaskStatusBadge status={task.status} />
                      {task.totalLoggedTime > 0 && (
                        <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-100 rounded px-1.5 font-semibold flex items-center gap-0.5">
                          <Clock size={8} /> {task.totalLoggedTime}m
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="table-cell" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      {!task.isTimerRunning && (
                        <button
                          type="button"
                          onClick={(e) => handleStartTimer(e, task.id)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-orange-600 transition-colors"
                          title="Start Tracking"
                        >
                          <Play size={10} fill="currentColor" />
                        </button>
                      )}
                      <select
                        value={task.status}
                        onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as any)}
                        className="text-xs bg-white border border-slate-200 rounded p-1 font-semibold text-slate-700"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="review">Review</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  </td>
                  <td className="table-cell text-sm text-slate-600">{formatDate(task.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); setFormSubmitted(false); }} title="Add New Task">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Task Title *</label>
            <input
              className={`input ${formSubmitted && !title ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
              placeholder="Logo concept exploration"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            {formSubmitted && !title && <p className="text-[10px] text-rose-500 mt-1">Title is required</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Project *</label>
            <select
              className={`input ${formSubmitted && !projectId ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
            >
              <option value="">Select project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{`${p.name} — ${p.clientName}`}</option>
              ))}
            </select>
            {formSubmitted && !projectId && <p className="text-[10px] text-rose-500 mt-1">Project selection is required</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea className="input h-20 resize-none text-sm py-2" placeholder="Task details..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
              <select className="input text-sm py-2" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Assignee *</label>
              <select
                className={`input ${formSubmitted && !assigneeId ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
              >
                <option value="">Select assignee...</option>
                {usersList.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              {formSubmitted && !assigneeId && <p className="text-[10px] text-rose-500 mt-1">Assignee selection is required</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Due Date</label>
              <input type="date" className="input text-sm py-2" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn-primary flex-1 justify-center animate-pulse-subtle" onClick={handleCreateTask}>
              <Plus size={15} /> Add Task
            </button>
          </div>
        </div>
      </Modal>

      {/* Task Details and Time Tracking Modal */}
      <Modal open={!!detailTask} onClose={() => setDetailTask(null)} title="Task details & Time sheet">
        {detailTask && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Title</span>
                <PriorityBadge priority={detailTask.priority} />
              </div>
              <h3 className="text-base font-bold text-navy-955 mt-1">{detailTask.title}</h3>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</span>
              <p className="text-xs text-slate-600 mt-1 bg-slate-50 border border-slate-100 rounded-xl p-3.5 whitespace-pre-line leading-relaxed">
                {detailTask.description || 'No description provided.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assignee</span>
                <div className="flex items-center gap-2 mt-1 bg-slate-55 border border-slate-100 rounded-xl p-2.5">
                  <Avatar name={detailTask.assigneeName} size="sm" />
                  <span className="text-xs font-semibold text-slate-700">{detailTask.assigneeName}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date</span>
                <div className="flex items-center gap-2 mt-1 bg-slate-55 border border-slate-100 rounded-xl p-2.5">
                  <Calendar size={14} className="text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700">{formatDate(detailTask.dueDate)}</span>
                </div>
              </div>
            </div>

            {/* Time Tracking Widget Section */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={13} className="text-orange-600" /> Time tracking controls
              </h4>
              
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logged time summary</span>
                  <span className="text-lg font-bold text-navy-950 block mt-0.5">
                    {detailTask.totalLoggedTime || 0} minutes spent
                  </span>
                </div>
                
                <div className="flex gap-2">
                  {detailTask.isTimerRunning ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        handleStopTimerPrompt(e, detailTask);
                      }}
                      className="btn-primary bg-rose-600 hover:bg-rose-700 text-white text-xs py-2 px-4 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Square size={12} fill="white" /> Stop timer: {detailTask.timerStartedAt && getTickingTime(detailTask.timerStartedAt)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleStartTimer(e, detailTask.id)}
                      className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 px-4 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play size={12} fill="white" /> Start tracking timer
                    </button>
                  )}
                </div>
              </div>

              {/* Log manual time sheet form */}
              <form onSubmit={handleAddManualTimeLog} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 space-y-3">
                <span className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">Log manual time sheet</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <input
                      type="number"
                      placeholder="Minutes"
                      className="input py-1.5 text-xs text-center"
                      required
                      value={manualMinutes}
                      onChange={e => setManualMinutes(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="What did you work on?"
                      className="input py-1.5 text-xs"
                      required
                      value={manualDesc}
                      onChange={e => setManualDesc(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={addingTimeLog}
                  className="btn-primary text-xs w-full py-1.5 justify-center cursor-pointer"
                >
                  {addingTimeLog ? 'Submitting...' : 'Log Time Sheet Record'}
                </button>
              </form>

              {/* Time Logs History */}
              <div className="space-y-3">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time sheet history logs</span>
                {!detailTask.timeLogs || detailTask.timeLogs.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-1">No time tracking logs saved for this task yet.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {detailTask.timeLogs.map((log: any, idx: number) => (
                      <div key={idx} className="border border-slate-150 bg-white rounded-xl p-3 text-[11px] flex justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800">{log.description || 'Task tracking session'}</p>
                          <p className="text-[10px] text-slate-400">Logged by: {log.userName || 'Staff Member'}</p>
                        </div>
                        <div className="text-right space-y-0.5 flex-shrink-0">
                          <span className="badge badge-info bg-blue-50 text-blue-700 font-bold block">{log.durationMinutes}m</span>
                          <span className="text-[9px] text-slate-400 block mt-1">{new Date(log.createdAt || log.date).toLocaleDateString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Stop Timer Modal Description Prompt */}
      <Modal open={!!showStopTimerModal} onClose={() => setShowStopTimerModal(null)} title="Stop Timer & Log Description">
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Provide a brief summary of the accomplishments completed during this tracking session.</p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Session Summary</label>
            <input
              type="text"
              placeholder="e.g. Completed initial logo directions"
              className="input py-2 text-sm"
              value={stopTimerDesc}
              onChange={e => setStopTimerDesc(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setShowStopTimerModal(null)}>Cancel</button>
            <button className="btn-primary flex-1 justify-center bg-rose-600 hover:bg-rose-700 cursor-pointer" onClick={handleStopTimerConfirm}>
              Stop & Log
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
              const selectedTasks = tasks.filter(t => selectedIds.includes(t.id));
              const headers = ['Task Title', 'Assignee', 'Priority', 'Status', 'Due Date'];
              const csvRows = [
                headers.join(','),
                ...selectedTasks.map(t => [
                  `"${t.title}"`,
                  `"${t.assigneeName}"`,
                  `"${t.priority}"`,
                  `"${t.status}"`,
                  `"${t.dueDate}"`
                ].join(','))
              ];
              const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.setAttribute('href', url);
              a.setAttribute('download', `zenith_tasks_export.csv`);
              a.click();
            }}
            className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
          >
            Export CSV
          </button>
          <button
            onClick={() => {
              setLoading(true)
              Promise.all(selectedIds.map(id => api.put(`/tasks/${id}`, { status: 'done' })))
                .then(() => {
                  fetchTasks()
                  setSelectedIds([])
                  toast.success('Tasks marked as completed.')
                })
                .catch(err => toast.error(err.response?.data?.error || err.message))
                .finally(() => setLoading(false))
            }}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
          >
            Mark Done
          </button>
          <button
            onClick={() => setConfirmDeleteOpen(true)}
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
      <ConfirmationModal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Selected Tasks?"
        message={`Are you sure you want to permanently delete these ${selectedIds.length} selected tasks? This action is destructive and cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </Layout>
  )
}

