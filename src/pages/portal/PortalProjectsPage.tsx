import { useState, useEffect } from 'react'
import { Calendar, CheckSquare, Users } from 'lucide-react'
import { Layout } from '../../components/layout/Layout'
import { ProjectStatusBadge, EmptyState, Progress, Avatar, Skeleton } from '../../components/ui/index'
import { formatCurrency, formatDate, getDaysUntil } from '../../lib/utils'
import type { Project } from '../../types'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'

export default function PortalProjectsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchProjects = () => {
    api.get('/projects?limit=100')
      .then(res => {
        setProjects(res.data.projects || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load client projects', err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <Layout title={t('myProjects')}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">{t('myProjects')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('projectsDesc')}</p>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            className="input pl-9"
            placeholder={t('searchPlaceholderClients')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-6 space-y-4">
              <Skeleton className="h-6 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-4 w-12 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          title={t('noProjectsAssigned')}
          description={t('noProjectsAssigned')}
          icon={<CheckSquare size={48} />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => {
            const daysLeft = project.deadline ? getDaysUntil(project.deadline) : null
            return (
              <div key={project.id} className="card p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-bold text-navy-900 text-base leading-snug line-clamp-1">{project.name}</h3>
                    <ProjectStatusBadge status={project.status} />
                  </div>

                  <p className="text-slate-600 text-xs line-clamp-2 mb-4 h-8">{project.description || 'No description provided.'}</p>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar size={14} className="text-slate-400" />
                      <span>{t('startDate')}: {project.startDate ? formatDate(project.startDate) : 'N/A'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar size={14} className="text-slate-400" />
                      <span>{t('deadline')}: {project.deadline ? formatDate(project.deadline) : 'N/A'}</span>
                      {daysLeft !== null && project.status === 'active' && (
                        <span className={`font-semibold ml-1 ${daysLeft < 0 ? 'text-rose-600' : 'text-orange-600'}`}>
                          ({daysLeft < 0 ? `${Math.abs(daysLeft)} ${t('daysOverdue')}` : `${daysLeft} ${t('daysLeft')}`})
                        </span>
                      )}
                    </div>

                    {project.budget > 0 && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>💰</span>
                        <span>{t('budget')}: {formatCurrency(project.budget)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('projectStatus')}</span>
                    <span className="text-xs font-bold text-navy-900">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} />
                  
                  {project.teamMembers && project.teamMembers.length > 0 && (
                    <div className="mt-4 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-slate-400" />
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('assignee')}:</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {project.teamMembers.map((member: any) => (
                          <div
                            key={member.id || member._id}
                            className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center w-full shadow-sm"
                          >
                            <span className="text-xs font-semibold text-slate-850 dark:text-slate-200">
                              {member.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
