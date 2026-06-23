import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, FileText, Calendar, User, Layers, HardDrive, Eye } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Skeleton } from '../components/ui/index'
import { formatFileSize, formatDate, getFileIcon } from '../lib/utils'
import api from '../lib/api'
import { useToast } from '../context/ToastContext'

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-rose-50 text-rose-600',
  png: 'bg-purple-50 text-purple-600',
  jpg: 'bg-purple-50 text-purple-600',
  jpeg: 'bg-purple-50 text-purple-600',
  psd: 'bg-blue-50 text-blue-600',
  ai: 'bg-orange-50 text-orange-600',
  zip: 'bg-slate-100 text-slate-600',
  docx: 'bg-indigo-50 text-indigo-600',
  pptx: 'bg-amber-50 text-amber-600',
}

export default function FileMetadataPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  
  const [file, setFile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<any>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.get(`/files/${id}`)
      .then(res => {
        setFile(res.data)
        // Fetch project details for reference
        if (res.data.projectId) {
          api.get(`/projects?limit=100`)
            .then(pRes => {
              const proj = (pRes.data.projects || []).find((p: any) => p.id === res.data.projectId)
              if (proj) setProject(proj)
            })
            .catch(console.error)
        }
        setLoading(false)
      })
      .catch(err => {
        toast.error(err.response?.data?.error || err.message)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <Layout title="File Metadata">
        <div className="page-header">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="card p-6 max-w-2xl space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Layout>
    )
  }

  if (!file) {
    return (
      <Layout title="File Metadata">
        <div className="page-header">
          <button onClick={() => navigate('/files')} className="btn-secondary text-xs flex items-center gap-1.5 mb-2">
            <ArrowLeft size={14} /> Back to Files
          </button>
          <h1 className="page-title text-rose-600">File Not Found</h1>
          <p className="page-subtitle">The requested file could not be found or has been deleted.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title={`${file.name} - Metadata`}>
      <div className="page-header flex flex-col items-start gap-2">
        <button onClick={() => navigate('/files')} className="btn-secondary text-xs flex items-center gap-1.5 transition-all hover:-translate-x-0.5 cursor-pointer">
          <ArrowLeft size={14} /> Back to Files
        </button>
        <div>
          <h1 className="page-title truncate max-w-xl">{file.name}</h1>
          <p className="page-subtitle">Detailed Read-Only File Metadata &amp; Parameters</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info Card */}
        <div className="lg:col-span-2 card p-6 space-y-6">
          <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 ${FILE_TYPE_COLORS[file.type] || 'bg-slate-100 text-slate-600'}`}>
              {getFileIcon(file.type)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-navy-900 truncate">{file.name}</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {file.id}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description</h3>
              {file.description ? (
                <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-4 border border-slate-100 whitespace-pre-wrap leading-relaxed">
                  {file.description}
                </p>
              ) : (
                <p className="text-sm text-slate-400 italic bg-slate-50 rounded-xl p-4 border border-slate-100 border-dashed">
                  No description provided for this file.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="flex items-start gap-3 p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                <FileText size={18} className="text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-500">MIME Content-Type</p>
                  <p className="text-sm font-bold text-navy-900 mt-0.5">{file.mimeType || 'binary/octet-stream'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                <HardDrive size={18} className="text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-500">Storage Key</p>
                  <p className="text-sm font-mono text-slate-600 mt-0.5 break-all leading-tight">{file.s3Key}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info Card */}
        <div className="card p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Properties</h3>
            
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-xs text-slate-500 flex items-center gap-1.5"><Layers size={14} /> Version</span>
              <span className="badge badge-default font-bold">v{file.version}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-xs text-slate-500 flex items-center gap-1.5"><HardDrive size={14} /> Size</span>
              <span className="text-xs font-bold text-navy-900">{formatFileSize(file.size)}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-xs text-slate-500 flex items-center gap-1.5"><User size={14} /> Uploaded By</span>
              <span className="text-xs font-bold text-navy-900">{file.uploadedByName}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-xs text-slate-500 flex items-center gap-1.5"><Calendar size={14} /> Upload Date</span>
              <span className="text-xs font-bold text-navy-900">{formatDate(file.createdAt)}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-xs text-slate-500 flex items-center gap-1.5"><Eye size={14} /> Downloads</span>
              <span className="text-xs font-bold text-orange-600">{file.downloadCount}</span>
            </div>

            {project && (
              <div className="pt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Project Reference</p>
                <div className="p-3 bg-orange-50/30 border border-orange-100 rounded-xl">
                  <p className="text-xs font-bold text-orange-950 truncate">{project.name}</p>
                  <p className="text-[10px] text-orange-700/80 mt-0.5">{project.clientName}</p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => window.open(file.url, '_blank')}
            className="btn-primary w-full justify-center mt-6 cursor-pointer"
          >
            <Download size={15} /> Download file raw
          </button>
        </div>
      </div>
    </Layout>
  )
}
