const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

// Enable virtuals globally so _id is mapped to id
mongoose.plugin((schema) => {
  schema.set('toJSON', { virtuals: true })
  schema.set('toObject', { virtuals: true })
})

// ── User ──────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['super_admin', 'team_member', 'client'], default: 'team_member' },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' }, // Only for client role
  avatar: String,
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  refreshToken: { type: String, select: false },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
}, { timestamps: true })

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password)
}

// ── Client ──────────────────────────────────────────
const clientSchema = new mongoose.Schema({
  companyName: { type: String, required: true, trim: true },
  contactPerson: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  phone: String,
  address: String,
  industry: String,
  notes: String,
  status: { type: String, enum: ['active', 'inactive', 'lead'], default: 'lead' },
  portalUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  gstin: String,
  deletedAt: Date,
}, { timestamps: true })

clientSchema.index({ companyName: 'text', email: 'text', contactPerson: 'text' })
clientSchema.index({ status: 1 })

// ── Project ──────────────────────────────────────────
const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: String,
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  startDate: Date,
  deadline: Date,
  budget: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'active', 'review', 'completed', 'archived'], default: 'draft' },
  teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deletedAt: Date,
}, { timestamps: true })

projectSchema.index({ clientId: 1 })
projectSchema.index({ status: 1 })

// ── Task ──────────────────────────────────────────
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: String,
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dueDate: Date,
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status: { type: String, enum: ['pending', 'in_progress', 'review', 'done'], default: 'pending' },
  order: { type: Number, default: 0 },
  deletedAt: Date,
}, { timestamps: true })

taskSchema.index({ projectId: 1, status: 1 })

// ── File ──────────────────────────────────────────
const fileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  originalName: String,
  type: String,
  mimeType: String,
  size: Number,
  s3Key: { type: String, required: true },
  s3Bucket: String,
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, default: 1 },
  downloadCount: { type: Number, default: 0 },
  isClientVisible: { type: Boolean, default: true },
  deletedAt: Date,
}, { timestamps: true })

fileSchema.index({ projectId: 1 })

// ── Approval ──────────────────────────────────────────
const approvalSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
  status: { type: String, enum: ['pending_review', 'approved', 'revision_requested'], default: 'pending_review' },
  clientComment: String,
  respondedAt: Date,
}, { timestamps: true })

approvalSchema.index({ projectId: 1, status: 1 })
approvalSchema.index({ clientId: 1 })

// ── Invoice ──────────────────────────────────────────
const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true },
}, { _id: false })

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  items: [invoiceItemSchema],
  subtotal: { type: Number, required: true },
  taxRate: { type: Number, default: 18 },
  tax: { type: Number, required: true },
  total: { type: Number, required: true },
  status: { type: String, enum: ['draft', 'sent', 'paid', 'overdue'], default: 'draft' },
  dueDate: { type: Date, required: true },
  paidAt: Date,
  pdfUrl: String,
  notes: String,
}, { timestamps: true })

invoiceSchema.index({ clientId: 1, status: 1 })
invoiceSchema.index({ status: 1, dueDate: 1 })

// ── Payment ──────────────────────────────────────────
const paymentSchema = new mongoose.Schema({
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  method: String,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  receiptUrl: String,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true })

paymentSchema.index({ invoiceId: 1 })
paymentSchema.index({ clientId: 1 })

// ── Notification ──────────────────────────────────────────
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['client_added', 'project_assigned', 'approval_requested', 'invoice_generated', 'payment_received', 'deadline_approaching'], required: true },
  title: { type: String, required: true },
  message: String,
  read: { type: Boolean, default: false },
  link: String,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true })

notificationSchema.index({ userId: 1, read: 1 })

// ── Activity Log ──────────────────────────────────────────
const activityLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: mongoose.Schema.Types.ObjectId,
  entityName: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ipAddress: String,
  userAgent: String,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true })

activityLogSchema.index({ userId: 1, createdAt: -1 })
activityLogSchema.index({ entityType: 1, entityId: 1 })

module.exports = {
  User: mongoose.model('User', userSchema),
  Client: mongoose.model('Client', clientSchema),
  Project: mongoose.model('Project', projectSchema),
  Task: mongoose.model('Task', taskSchema),
  File: mongoose.model('File', fileSchema),
  Approval: mongoose.model('Approval', approvalSchema),
  Invoice: mongoose.model('Invoice', invoiceSchema),
  Payment: mongoose.model('Payment', paymentSchema),
  Notification: mongoose.model('Notification', notificationSchema),
  ActivityLog: mongoose.model('ActivityLog', activityLogSchema),
}
