import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'

// Pages
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ClientsPage from './pages/ClientsPage'
import ProjectsPage from './pages/ProjectsPage'
import TasksPage from './pages/TasksPage'
import FilesPage from './pages/FilesPage'
import FileMetadataPage from './pages/FileMetadataPage'
import ApprovalsPage from './pages/ApprovalsPage'
import InvoicesPage from './pages/InvoicesPage'
import InvoiceCreatePage from './pages/InvoiceCreatePage'
import PaymentsPage from './pages/PaymentsPage'
import ReportsPage from './pages/ReportsPage'
import NotificationsPage from './pages/NotificationsPage'
import ActivityPage from './pages/ActivityPage'
import SettingsPage from './pages/SettingsPage'
import ClientPortalPage from './pages/ClientPortalPage'
import ProposalsPage from './pages/ProposalsPage'
import ContractsPage from './pages/ContractsPage'
import { LanguageProvider } from './context/LanguageContext'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5 } },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

import { useEffect } from 'react'

function AppRoutes() {
  const { user } = useAuth()

  useEffect(() => {
    const savedTheme = localStorage.getItem('zenithos_brand_accent') || 'Orange'
    import('./lib/theme').then(({ applyAccentTheme }) => {
      applyAccentTheme(savedTheme as any)
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.getAttribute('contenteditable') === 'true'
      )
      if (isInput) return

      if (e.key === 'N' || e.key === 'n') {
        e.preventDefault()
        window.location.href = '/tasks?create=true'
      }

      if (e.key === '/') {
        e.preventDefault()
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Navigate to={['client', 'client_viewer'].includes(user?.role || '') ? '/portal' : '/dashboard'} replace />
        </ProtectedRoute>
      } />

      {/* Agency Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
      <Route path="/files" element={<ProtectedRoute><FilesPage /></ProtectedRoute>} />
      <Route path="/files/:id/metadata" element={<ProtectedRoute><FileMetadataPage /></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
      <Route path="/proposals" element={<ProtectedRoute><ProposalsPage /></ProtectedRoute>} />
      <Route path="/contracts" element={<ProtectedRoute><ContractsPage /></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
      <Route path="/invoices/create" element={<ProtectedRoute><InvoiceCreatePage /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="/activity" element={<ProtectedRoute><ActivityPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

      {/* Client Portal */}
      <Route path="/portal" element={<ProtectedRoute><ClientPortalPage /></ProtectedRoute>} />
      <Route path="/portal/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
      <Route path="/portal/files" element={<ProtectedRoute><FilesPage /></ProtectedRoute>} />
      <Route path="/portal/files/:id/metadata" element={<ProtectedRoute><FileMetadataPage /></ProtectedRoute>} />
      <Route path="/portal/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
      <Route path="/portal/proposals" element={<ProtectedRoute><ProposalsPage /></ProtectedRoute>} />
      <Route path="/portal/contracts" element={<ProtectedRoute><ContractsPage /></ProtectedRoute>} />
      <Route path="/portal/invoices" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <LanguageProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </LanguageProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
