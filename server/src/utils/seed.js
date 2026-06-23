require('dotenv').config()
const mongoose = require('mongoose')
const { User, Client, Project, Task, File, Approval, Invoice, Payment, Notification, ActivityLog } = require('../models')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zenithos'

const sample = {
  users: [
    { name: 'Divya Menon', email: 'admin@zenithcreative.in', password: 'password', role: 'super_admin' },
    { name: 'Rahul Iyer', email: 'team@zenithcreative.in', password: 'password', role: 'team_member' },
    { name: 'Arjun Sharma', email: 'client@novatech.com', password: 'password', role: 'client' },
    { name: 'Arjun Sharma (Viewer)', email: 'viewer@novatech.com', password: 'password', role: 'client_viewer' },
  ],
  clients: [
    { companyName: 'Nova Tech Solutions', contactPerson: 'Arjun Sharma', email: 'arjun@novatech.com', phone: '+91 98765 43210', address: 'Bangalore, Karnataka', industry: 'Technology', notes: 'Long-term partner, prefers weekly updates', gstin: '29ABCDE1234F1Z5', status: 'active' },
    { companyName: 'Meridian Hospitality', contactPerson: 'Priya Nair', email: 'priya@meridian.in', phone: '+91 87654 32109', address: 'Mumbai, Maharashtra', industry: 'Hospitality', notes: 'High-end brand, premium deliverables', gstin: '27GHIJK5678L2Z6', status: 'active' },
  ],
  projects: [
    { name: 'Brand Identity Redesign', description: 'Complete visual identity overhaul including logo, color system, typography, and brand guidelines document.', startDate: new Date('2024-04-01'), deadline: new Date('2024-07-15'), budget: 180000, status: 'active' },
    { name: 'Website UI/UX Design', description: 'Full product website redesign with new design system, responsive layouts, and interactive prototypes.', startDate: new Date('2024-05-01'), deadline: new Date('2024-08-30'), budget: 220000, status: 'active' },
  ],
  tasks: [
    { title: 'Logo concept exploration', description: 'Create 3 initial logo directions', dueDate: new Date('2024-04-20'), priority: 'high', status: 'done' },
    { title: 'Wireframes — Homepage', description: 'Low-fi wireframes for hero, features, pricing', dueDate: new Date('2024-05-20'), priority: 'critical', status: 'done' },
  ],
  invoices: [
    { invoiceNumber: 'INV-2024-001', items: [{ description: 'Brand Strategy & Research', quantity: 1, rate: 45000, amount: 45000, hsnCode: '998311' }, { description: 'Logo Design (3 concepts)', quantity: 1, rate: 60000, amount: 60000, hsnCode: '998312' }, { description: 'Brand Guidelines Document', quantity: 1, rate: 40000, amount: 40000, hsnCode: '998313' }], subtotal: 145000, taxRate: 18, tax: 26100, total: 171100, status: 'paid', dueDate: new Date('2024-05-15'), paidAt: new Date('2024-05-12') },
    { invoiceNumber: 'INV-2024-002', items: [{ description: 'Print Collateral Design', quantity: 1, rate: 80000, amount: 80000, hsnCode: '998314' }, { description: 'Digital Assets Package', quantity: 1, rate: 40000, amount: 40000, hsnCode: '998315' }], subtotal: 120000, taxRate: 18, tax: 21600, total: 141600, status: 'sent', dueDate: new Date('2024-06-25') },
  ],
  payments: [
    { amount: 171100, currency: 'INR', method: 'UPI', razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1', razorpaySignature: 'sig_1', status: 'success', receiptUrl: 'https://example.com/receipt/1' },
  ],
  notifications: [
    { type: 'approval_requested', title: 'Approval Pending', message: 'Nova Tech Solutions has a pending approval for Brand Guidelines v2.', read: false, link: '/approvals' },
    { type: 'payment_received', title: 'Payment Received', message: 'Stellar EdTech paid ₹1,53,400 for INV-2024-005.', read: false, link: '/payments' },
  ],
}

async function seed() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB for seeding')
  await Promise.all([
    User.deleteMany({}),
    Client.deleteMany({}),
    Project.deleteMany({}),
    Task.deleteMany({}),
    File.deleteMany({}),
    Approval.deleteMany({}),
    Invoice.deleteMany({}),
    Payment.deleteMany({}),
    Notification.deleteMany({}),
    ActivityLog.deleteMany({}),
  ])

  const createdClients = await Client.create(sample.clients)
  const clientUserData = sample.users.map(user => {
    if (user.role === 'client' || user.role === 'client_viewer') {
      return { ...user, clientId: createdClients[0]._id }
    }
    return user
  })
  const createdUsers = await User.create(clientUserData)
  const adminUser = createdUsers.find(u => u.role === 'super_admin')
  const teamUser = createdUsers.find(u => u.role === 'team_member')
  const clientUser = createdUsers.find(u => u.role === 'client')
  const [novaClient, meridianClient] = createdClients

  const createdProjects = await Project.create([
    { ...sample.projects[0], clientId: novaClient._id, teamMembers: [adminUser._id, teamUser._id] },
    { ...sample.projects[1], clientId: novaClient._id, teamMembers: [adminUser._id] },
  ])

  await Task.create([
    { ...sample.tasks[0], projectId: createdProjects[0]._id, assigneeId: adminUser._id },
    { ...sample.tasks[1], projectId: createdProjects[1]._id, assigneeId: teamUser._id },
  ])

  const createdInvoices = await Invoice.create([
    { ...sample.invoices[0], clientId: novaClient._id, projectId: createdProjects[0]._id },
    { ...sample.invoices[1], clientId: meridianClient._id, projectId: createdProjects[0]._id },
  ])

  const createdPayments = await Payment.create([
    { ...sample.payments[0], invoiceId: createdInvoices[0]._id, clientId: novaClient._id },
  ])

  const createdApprovals = await Approval.create([
    { title: 'Brand Guidelines v2 — Final Approval', description: 'Please review the completed brand guidelines document and approve to proceed to print.', projectId: createdProjects[0]._id, clientId: novaClient._id, requestedBy: teamUser._id, fileIds: [], status: 'pending_review' },
    { title: 'Hotel Brochure — Print Approval', description: 'Final print-ready brochure for sign-off. Print deadline is June 20.', projectId: createdProjects[0]._id, clientId: meridianClient._id, requestedBy: teamUser._id, fileIds: [], status: 'pending_review' },
  ])

  await Notification.create([
    { ...sample.notifications[0], userId: adminUser._id },
    { ...sample.notifications[1], userId: adminUser._id },
  ])

  await ActivityLog.create([
    { action: 'uploaded file', entityType: 'file', entityId: new mongoose.Types.ObjectId(), entityName: 'NovaBrand_Guidelines_v2.pdf', userId: teamUser._id },
    { action: 'sent invoice', entityType: 'invoice', entityId: createdInvoices[1]._id, entityName: createdInvoices[1].invoiceNumber, userId: adminUser._id },
    { action: 'payment received', entityType: 'payment', entityId: createdPayments[0]._id, entityName: `₹${createdPayments[0].amount}`, userId: clientUser._id },
  ])

  console.log('Seeding finished')
  await mongoose.connection.close()
  process.exit(0)
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})
