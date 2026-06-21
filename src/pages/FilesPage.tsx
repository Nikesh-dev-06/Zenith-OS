import { useState, useEffect } from 'react'
import { Upload, Search, Download, Eye, Edit, FileText, Image, Archive } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { Avatar, EmptyState, Modal } from '../components/ui/index'
import { formatFileSize, formatDate, getFileIcon } from '../lib/utils'
import api from '../lib/api'

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

export default function FilesPage() {
  const [search, setSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [editFile, setEditFile] = useState<any>(null)
  const [showView, setShowView] = useState(false)
  const [viewFile, setViewFile] = useState<any>(null)
  const [files, setFiles] = useState<any[]>([])
  const [projectsList, setProjectsList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFiles = () => {
    api.get('/files')
      .then(res => {
        setFiles(res.data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchFiles()
    api.get('/projects?limit=100').then(res => {
      setProjectsList(res.data.projects || [])
    })
  }, [])

  const handleUpload = () => {
    if (!uploadFile || !selectedProjectId) {
      alert('Please select a file and a project to upload.')
      return
    }
    const formData = new FormData()
    formData.append('files', uploadFile)
    formData.append('projectId', selectedProjectId)
    formData.append('isClientVisible', 'true')

    api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
      .then(() => {
        fetchFiles()
        setShowUpload(false)
        setUploadFile(null)
        setSelectedProjectId('')
      })
      .catch(err => {
        alert(err.response?.data?.error || err.message)
      })
  }

  const handleDeleteFile = (id: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return
    api.delete(`/files/${id}`)
      .then(() => {
        fetchFiles()
      })
      .catch(err => {
        alert(err.response?.data?.error || err.message)
      })
  }

  const filtered = files.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.uploadedByName?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout title="Files">
      <div className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Files</h1>
          <p className="page-subtitle">{files.length} files across all projects</p>
        </div>
        <button className="btn-primary" onClick={() => setShowUpload(true)}>
          <Upload size={15} /> Upload Files
        </button>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-2xl p-8 text-center mb-6 transition-all duration-200 cursor-pointer
          ${dragOver ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={() => setDragOver(false)}
        onClick={() => setShowUpload(true)}
      >
        <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(244,81,30,0.1), rgba(255,140,66,0.1))' }}>
          <Upload size={20} style={{ color: '#F4511E' }} />
        </div>
        <p className="text-sm font-semibold text-navy-900 mb-1">Drag &amp; drop files here</p>
        <p className="text-xs text-slate-500">or <span className="text-orange-600 font-medium cursor-pointer hover:underline">browse to upload</span></p>
        <p className="text-xs text-slate-400 mt-2">PDF, PNG, JPG, PSD, AI, ZIP, DOCX, PPTX supported</p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files..." className="input pl-9 py-2" />
      </div>

      {/* View Modal */}
      {showView && viewFile && (
        <Modal open={true} onClose={() => setShowView(false)} title="File Details" size="sm">
          <div className="space-y-3">
            <p><strong>Name:</strong> {viewFile.name}</p>
            <p><strong>Type:</strong> {viewFile.type}</p>
            <p><strong>Size:</strong> {formatFileSize(viewFile.size)}</p>
            <p><strong>Uploaded By:</strong> {viewFile.uploadedByName}</p>
            <p><strong>Version:</strong> v{viewFile.version}</p>
            <p><strong>Date:</strong> {formatDate(viewFile.createdAt)}</p>
            <button
              className="btn-primary w-full justify-center mt-2"
              onClick={() => window.open(viewFile.url, '_blank')}
            >
              <Download size={14} /> Download File
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEdit && editFile && (
        <Modal open={true} onClose={() => setShowEdit(false)} title="Edit File" size="sm">
          <div className="space-y-4">
            <label className="block text-xs font-medium text-slate-700 mb-1">File Name</label>
            <input className="input" defaultValue={editFile.name} onChange={e => setEditFile({ ...editFile, name: e.target.value })} />
            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={() => {
                api.put(`/files/${editFile.id}`, { name: editFile.name })
                  .then(() => {
                    fetchFiles()
                    setShowEdit(false)
                  })
                  .catch(err => alert(err.response?.data?.error || err.message))
              }}>Save</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <Modal open={true} onClose={() => setShowUpload(false)} title="Upload File" size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Project *</label>
              <select className="input text-sm py-2" value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
                <option value="">Select project...</option>
                {projectsList.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">File *</label>
              <input type="file" className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowUpload(false)}>Cancel</button>
              <button className="btn-primary flex-1 justify-center" onClick={handleUpload}>Upload</button>
            </div>
          </div>
        </Modal>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon="📁" title="No files found" description="Upload your first file or adjust your search." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="table-header text-left">File</th>
                <th className="table-header text-left">Project</th>
                <th className="table-header text-left">Uploaded By</th>
                <th className="table-header text-left">Size</th>
                <th className="table-header text-left">Version</th>
                <th className="table-header text-left">Downloads</th>
                <th className="table-header text-left">Date</th>
                <th className="table-header text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(file => (
                <tr key={file.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${FILE_TYPE_COLORS[file.type] || 'bg-slate-100 text-slate-600'}`}>
                        {getFileIcon(file.type)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-navy-900 max-w-[180px] truncate">{file.name}</p>
                        <p className="text-xs text-slate-400 uppercase">.{file.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-sm text-slate-600">
                    {(() => {
                      const proj = projectsList.find(p => p.id === file.projectId);
                      return proj ? proj.name : 'Unknown';
                    })()}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <Avatar name={file.uploadedByName || 'User'} size="sm" />
                      <span className="text-sm text-slate-600">{(file.uploadedByName || 'User').split(' ')[0]}</span>
                    </div>
                  </td>
                  <td className="table-cell text-sm text-slate-600">{formatFileSize(file.size)}</td>
                  <td className="table-cell"><span className="badge badge-default">v{file.version}</span></td>
                  <td className="table-cell text-sm text-slate-600">{file.downloadCount}</td>
                  <td className="table-cell text-sm text-slate-500">{formatDate(file.createdAt)}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost p-1.5 text-slate-400 hover:text-navy-900" title="View" onClick={() => { setViewFile(file); setShowView(true); }}>
                        <Eye size={14} />
                      </button>
                      <button className="btn-ghost p-1.5 text-slate-400 hover:text-emerald-600" title="Edit" onClick={() => { setEditFile(file); setShowEdit(true); }}>
                        <Edit size={14} />
                      </button>
                      <button className="btn-ghost p-1.5 text-slate-400 hover:text-orange-600" title="Download" onClick={() => window.open(file.url, '_blank')}>
                        <Download size={14} />
                      </button>
                      <button className="btn-ghost p-1.5 text-slate-400 hover:text-rose-600" title="Delete" onClick={() => handleDeleteFile(file.id)}>
                        <Archive size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}

