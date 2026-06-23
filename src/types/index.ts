export type UserRole = 'super_admin' | 'team_member' | 'client' | 'client_viewer'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  clientId?: string
  createdAt: string
}

export type ClientStatus = 'active' | 'inactive' | 'lead'

export interface Client {
  id: string
  companyName: string
  contactPerson: string
  email: string
  phone: string
  address: string
  industry: string
  notes: string
  status: ClientStatus
  projectCount: number
  totalRevenue: number
  createdAt: string
  updatedAt: string
  gstin?: string
  pan?: string
  tags?: string[]
  customFields?: { label: string; value: string }[]
}

export type ProjectStatus = 'draft' | 'active' | 'review' | 'completed' | 'archived'

export interface Project {
  id: string
  name: string
  description: string
  clientId: string
  clientName: string
  startDate: string
  deadline: string
  budget: number
  status: ProjectStatus
  progress: number
  teamMembers: string[]
  taskCount: number
  completedTasks: number
  createdAt: string
  updatedAt: string
  tags?: string[]
  customFields?: { label: string; value: string }[]
}

export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Task {
  id: string
  title: string
  description: string
  projectId: string
  dueDate: string
  priority: TaskPriority
  assignee: string
  assigneeName: string
  status: TaskStatus
  createdAt: string
}

export interface ProjectFile {
  id: string
  name: string
  type: string
  size: number
  url: string
  projectId: string
  uploadedBy: string
  uploadedByName: string
  version: number
  downloadCount: number
  createdAt: string
}

export type ApprovalStatus = 'pending_review' | 'approved' | 'revision_requested'

export interface Approval {
  id: string
  title: string
  description: string
  projectId: string
  projectName: string
  clientId: string
  clientName: string
  fileIds: string[]
  status: ApprovalStatus
  comment?: string
  requestedAt: string
  respondedAt?: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

export interface InvoiceItem {
  description: string
  quantity: number
  rate: number
  amount: number
  hsnCode?: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  clientId: string | any
  clientName: string
  projectId: string
  projectName: string
  items: InvoiceItem[]
  subtotal: number
  taxRate?: number
  tax: number
  total: number
  status: InvoiceStatus
  dueDate: string
  paidAt?: string
  createdAt: string
  placeOfSupply?: string
  isIntrastate?: boolean
  cgst?: number
  sgst?: number
  igst?: number
  rcm?: boolean
  tdsRate?: number
  tdsAmount?: number
  isExport?: boolean
  lutNumber?: string
  roundingAdjustment?: number
  discountType?: 'percent' | 'flat'
  discountValue?: number
  discount?: number
  bankDetails?: {
    bankName: string
    accountNumber: string
    ifscCode: string
    accountHolder: string
    upiId: string
  }
}

export interface Payment {
  id: string
  invoiceId: string
  invoiceNumber: string
  clientId: string
  clientName: string
  amount: number
  method: string
  transactionId: string
  paidAt: string
}

export interface Notification {
  id: string
  type: 'client_added' | 'project_assigned' | 'approval_requested' | 'invoice_generated' | 'payment_received' | 'deadline_approaching'
  title: string
  message: string
  read: boolean
  createdAt: string
  link?: string
}

export interface ActivityLog {
  id: string
  action: string
  entityType: string
  entityId: string
  entityName: string
  userId: string
  userName: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface DashboardStats {
  totalClients: number
  activeProjects: number
  monthlyRevenue: number
  outstandingPayments: number
  pendingApprovals: number
  clientGrowth: number
  projectGrowth: number
  revenueGrowth: number
}

export interface RevenueDataPoint {
  month: string
  revenue: number
  collected: number
}

export interface ProjectStatusData {
  status: string
  count: number
  color: string
}
