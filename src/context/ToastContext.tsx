import { createContext, useContext, useState, type ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  const success = (message: string) => showToast(message, 'success')
  const error = (message: string) => showToast(message, 'error')
  const info = (message: string) => showToast(message, 'info')
  const warning = (message: string) => showToast(message, 'warning')

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const typeStyles = {
    success: 'bg-slate-900 border-emerald-500/20 text-white shadow-emerald-500/5',
    error: 'bg-slate-900 border-rose-500/20 text-white shadow-rose-500/5',
    info: 'bg-slate-900 border-blue-500/20 text-white shadow-blue-500/5',
    warning: 'bg-slate-900 border-amber-500/20 text-white shadow-amber-500/5',
  }

  const typeIcons = {
    success: <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />,
    error: <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />,
    info: <Info size={16} className="text-blue-500 flex-shrink-0" />,
    warning: <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />,
  }

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[150] flex flex-col gap-2.5 max-w-sm w-full">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg animate-slide-up ${typeStyles[t.type]}`}
          >
            {typeIcons[t.type]}
            <p className="text-xs font-semibold flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              className="text-white/70 hover:text-white hover:bg-white/10 p-1 rounded-lg transition-all cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
