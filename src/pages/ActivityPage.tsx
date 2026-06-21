import { useState, useEffect } from 'react'
import { ClipboardList, Upload, CreditCard, CheckCircle, FolderOpen, CheckSquare, LogIn, FileText } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Avatar } from '../components/ui/index'
import { formatRelativeTime, formatDate } from '../lib/utils'
import api from '../lib/api'

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'uploaded file': <Upload size={13} className="text-blue-500" />,
  'sent invoice': <FileText size={13} className="text-orange-500" />,
  'payment received': <CreditCard size={13} className="text-emerald-500" />,
  'requested approval': <CheckCircle size={13} className="text-amber-500" />,
  'created project': <FolderOpen size={13} className="text-purple-500" />,
  'marked task done': <CheckSquare size={13} className="text-emerald-500" />,
  'client approved': <CheckCircle size={13} className="text-emerald-500" />,
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/activity?limit=100')
      .then(res => {
        setLogs(res.data.logs || [])
        setTotal(res.data.total || 0)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <Layout title="Activity Log">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Activity Log">
      <div className="page-header">
        <h1 className="page-title">Activity Log</h1>
        <p className="page-subtitle">Complete audit trail of all actions</p>
      </div>

      <div className="max-w-3xl">
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">{total} actions recorded</span>
            </div>
          </div>

          <div className="divide-y divide-slate-50">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No activity logs recorded yet.</div>
            ) : (
              logs.map(log => {
                const userName = log.userId?.name || 'System'
                return (
                  <div key={log.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors">
                    <Avatar name={userName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-navy-900">{userName}</span>
                        <div className="flex items-center gap-1 text-slate-500">
                          {ACTION_ICONS[log.action] || <LogIn size={13} className="text-slate-400" />}
                          <span className="text-sm">{log.action}</span>
                        </div>
                        <span className="text-sm font-medium text-navy-900 truncate">{log.entityName}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{formatRelativeTime(log.createdAt)}</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-xs text-slate-400">{formatDate(log.createdAt)}</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-xs capitalize bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{log.entityType}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
