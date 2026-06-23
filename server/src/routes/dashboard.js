const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const { Client, Project, Invoice, Payment, Approval, ActivityLog, Task } = require('../models')
const { authenticate } = require('../middleware/auth')

router.use(authenticate)

router.get('/', async (req, res) => {
  try {
    const isClient = req.user.role === 'client'
    const clientId = req.user.clientId

    // Query filters based on role - cast clientId to ObjectId for raw aggregate matching
    const clientQuery = isClient ? { clientId: mongoose.Types.ObjectId(clientId), deletedAt: null } : { deletedAt: null }
    const invoiceQuery = isClient ? { clientId: mongoose.Types.ObjectId(clientId) } : {}
    const approvalQuery = isClient ? { clientId: mongoose.Types.ObjectId(clientId) } : {}
    const activityQuery = isClient ? { userId: req.user._id } : {}

    // 1. Fetch counts
    const [
      totalClients,
      activeProjectsCount,
      pendingApprovals,
      paidInvoices,
      unpaidInvoices,
      recentActivityLogs,
      allActiveProjects,
      overdueInvoicesList
    ] = await Promise.all([
      Client.countDocuments({ status: 'active', deletedAt: null }),
      Project.countDocuments({ ...clientQuery, status: 'active' }),
      Approval.countDocuments({ ...approvalQuery, status: 'pending_review' }),
      Invoice.find({ ...invoiceQuery, status: 'paid' }).select('total paidAt'),
      Invoice.find({ ...invoiceQuery, status: { $in: ['sent', 'overdue'] } }).select('total'),
      ActivityLog.find(activityQuery).populate('userId', 'name').sort({ createdAt: -1 }).limit(10),
      Project.find({ ...clientQuery, status: { $in: ['active', 'review'] } }).sort({ createdAt: -1 }).limit(4),
      Invoice.find({ ...invoiceQuery, status: 'overdue' }).populate('clientId', 'companyName')
    ])

    // Compute monthly revenue
    const monthlyRevenue = paidInvoices
      .filter(i => new Date(i.paidAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .reduce((s, i) => s + i.total, 0)

    // 2. Compute dynamic months of revenue points
    const monthsParam = parseInt(req.query.months) || 6
    const monthsLimit = [3, 6, 12].includes(monthsParam) ? monthsParam : 6
    const revenueData = []
    for (let i = monthsLimit - 1; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const start = new Date(date.getFullYear(), date.getMonth(), 1)
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1) // First day of next month

      const [billed, collected] = await Promise.all([
        Invoice.aggregate([
          { $match: { ...invoiceQuery, createdAt: { $gte: start, $lt: end } } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]),
        Invoice.aggregate([
          { $match: { ...invoiceQuery, status: 'paid', paidAt: { $gte: start, $lt: end } } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]),
      ])

      revenueData.push({
        month: start.toLocaleString('en', { month: 'short' }),
        revenue: billed[0]?.total || 0,
        collected: collected[0]?.total || 0,
      })
    }

    // 3. Compute Project Status breakdown
    const [draftCount, activeCount, reviewCount, completedCount] = await Promise.all([
      Project.countDocuments({ ...clientQuery, status: 'draft' }),
      Project.countDocuments({ ...clientQuery, status: 'active' }),
      Project.countDocuments({ ...clientQuery, status: 'review' }),
      Project.countDocuments({ ...clientQuery, status: 'completed' }),
    ])

    const projectStatusBreakdown = [
      { name: 'Active', value: activeCount, color: '#06B6D4' },
      { name: 'Review', value: reviewCount, color: '#F59E0B' },
      { name: 'Completed', value: completedCount, color: '#10B981' },
    ]

    // 4. Enrich active projects
    const enrichedProjects = await Promise.all(allActiveProjects.map(async (proj) => {
      const [client, taskCount, completedTasks] = await Promise.all([
        Client.findById(proj.clientId).select('companyName'),
        Task.countDocuments({ projectId: proj._id, deletedAt: null }),
        Task.countDocuments({ projectId: proj._id, status: 'done', deletedAt: null }),
      ])
      const progress = taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0
      return {
        ...proj.toObject(),
        id: proj._id,
        clientName: client ? client.companyName : 'Unknown Client',
        progress,
        taskCount,
        completedTasks,
      }
    }))

    // 5. Enrich activity logs
    const enrichedActivity = recentActivityLogs.map(log => ({
      id: log._id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      entityName: log.entityName,
      userId: log.userId ? log.userId._id : 'system',
      userName: log.userId ? log.userId.name : 'System',
      createdAt: log.createdAt
    }))

    // 6. Enrich overdue invoices
    const enrichedOverdue = overdueInvoicesList.map(inv => ({
      id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.clientId ? inv.clientId.companyName : 'Unknown Client',
      total: inv.total,
      dueDate: inv.dueDate,
      status: inv.status
    }))

    res.json({
      totalClients,
      activeProjects: activeProjectsCount,
      pendingApprovals,
      monthlyRevenue,
      outstandingPayments: unpaidInvoices.reduce((s, i) => s + i.total, 0),
      recentActivity: enrichedActivity,
      revenueData,
      projectStatusBreakdown,
      activeProjectsList: enrichedProjects,
      overdueInvoices: enrichedOverdue,
      clientGrowth: 20,
      projectGrowth: 12,
      revenueGrowth: 18,
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router

