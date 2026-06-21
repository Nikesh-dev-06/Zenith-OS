import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { TaskStatusBadge, PriorityBadge, Avatar, Modal, EmptyState } from '../components/ui/index'
import { formatDate } from '../lib/utils'
import type { TaskStatus } from '../types'
import api from '../lib/api'

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'pending', label: 'Pending', color: 'bg-slate-100' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-50' },
  { id: 'review', label: 'In Review', color: 'bg-amber-50' },
  { id: 'done', label: 'Done', color: 'bg-emerald-50' },
]

export default function TasksPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const [tasks, setTasks] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')

  const fetchTasks = () => {
    api.get('/tasks')
      .then(res => {
        setTasks(res.data)
        setLoading(false)
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
  }, [])

  const handleCreateTask = () => {
    if (!title || !projectId || !assigneeId) {
      alert('Title, Project, and Assignee are required.')
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
        setTitle('')
        setProjectId('')
        setDescription('')
        setPriority('medium')
        setAssigneeId('')
        setDueDate('')
      })
      .catch(err => {
        alert(err.response?.data?.error || err.message)
      })
  }

  const handleUpdateTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    api.put(`/tasks/${taskId}`, { status: newStatus })
      .then(() => {
        fetchTasks()
      })
      .catch(err => {
        alert(err.response?.data?.error || err.message)
      })
  }

  const filteredTasks = tasks.filter(t => statusFilter === 'all' || t.status === statusFilter)

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

      {view === 'kanban' ? (
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
                    <div className="text-center py-8 text-slate-400 text-xs">No tasks</div>
                  )}
                  {colTasks.map(task => (
                    <div key={task.id} className="bg-white rounded-xl p-3.5 shadow-card hover:shadow-card-hover transition-all duration-150 border border-slate-50">
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <p className="text-sm font-semibold text-navy-900 leading-snug flex-1">{task.title}</p>
                        <PriorityBadge priority={task.priority} />
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3">{task.description}</p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Avatar name={task.assigneeName} size="sm" />
                          <span className="text-xs text-slate-500">{task.assigneeName?.split(' ')[0]}</span>
                        </div>
                        <select
                          value={task.status}
                          onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as any)}
                          className="text-xs bg-slate-50 border border-slate-200 rounded p-1 font-semibold text-slate-700"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="review">Review</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-50 flex justify-between items-center text-[10px] text-slate-400">
                        <span>Due {formatDate(task.dueDate)}</span>
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
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="table-header text-left">Task</th>
                <th className="table-header text-left">Assignee</th>
                <th className="table-header text-left">Priority</th>
                <th className="table-header text-left">Status</th>
                <th className="table-header text-left">Change Status</th>
                <th className="table-header text-left">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => (
                <tr key={task.id} className="table-row">
                  <td className="table-cell">
                    <p className="font-semibold text-navy-900 text-sm">{task.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{task.description}</p>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <Avatar name={task.assigneeName} size="sm" />
                      <span className="text-sm text-slate-600">{task.assigneeName?.split(' ')[0]}</span>
                    </div>
                  </td>
                  <td className="table-cell"><PriorityBadge priority={task.priority} /></td>
                  <td className="table-cell"><TaskStatusBadge status={task.status} /></td>
                  <td className="table-cell">
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
                  </td>
                  <td className="table-cell text-sm text-slate-600">{formatDate(task.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Task">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Task Title *</label>
            <input className="input" placeholder="Logo concept exploration" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Project *</label>
            <select className="input" value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">Select project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{`${p.name} — ${p.clientName}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea className="input h-20 resize-none" placeholder="Task details..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
              <select className="input" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Assignee</label>
              <select className="input" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">Select assignee...</option>
                {usersList.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Due Date</label>
              <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
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
    </Layout>
  )
}

