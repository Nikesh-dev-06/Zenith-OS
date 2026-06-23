const express = require('express')
const router = express.Router()
const { Invoice, Approval, Notification, ActivityLog } = require('../models')
const { authenticate, agencyOnly, readOnlyForViewer } = require('../middleware/auth')

router.use(authenticate)
router.use(readOnlyForViewer)

// Trigger automation scan
router.post('/run', agencyOnly, async (req, res) => {
  try {
    const now = new Date()
    const logs = []

    // 1. Scan for overdue invoices
    const overdueInvoices = await Invoice.find({
      status: { $in: ['sent', 'overdue'] },
      dueDate: { $lt: now }
    }).populate('clientId', 'companyName')

    for (const invoice of overdueInvoices) {
      if (invoice.status !== 'overdue') {
        invoice.status = 'overdue'
        await invoice.save()
      }

      // Create alert notification
      await Notification.create({
        userId: req.user._id, // notify super admin/agency
        type: 'deadline_approaching',
        title: 'Overdue Invoice Reminder Sent',
        message: `Invoice ${invoice.invoiceNumber} for ${invoice.clientId?.companyName || 'Client'} is overdue since ${invoice.dueDate.toISOString().split('T')[0]}. Auto-reminder sent.`,
        link: '/invoices'
      })

      // Log activity
      await ActivityLog.create({
        action: 'sent automation reminder',
        entityType: 'invoice',
        entityId: invoice._id,
        entityName: invoice.invoiceNumber,
        userId: req.user._id,
        metadata: { clientName: invoice.clientId?.companyName }
      })

      logs.push(`Sent reminder alert for Invoice ${invoice.invoiceNumber}`)
    }

    // 2. Scan for stale approvals (> 3 days pending)
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const staleApprovals = await Approval.find({
      status: 'pending_review',
      createdAt: { $lt: threeDaysAgo }
    }).populate('clientId', 'companyName')

    for (const approval of staleApprovals) {
      // Create reminder alert
      await Notification.create({
        userId: req.user._id,
        type: 'approval_requested',
        title: 'Stale Approval Followup Triggered',
        message: `Approval request "${approval.title}" for ${approval.clientId?.companyName} has been pending for over 3 days. Followup triggered.`,
        link: '/approvals'
      })

      await ActivityLog.create({
        action: 'sent automation reminder',
        entityType: 'approval',
        entityId: approval._id,
        entityName: approval.title,
        userId: req.user._id
      })

      logs.push(`Triggered stale followup request for Approval "${approval.title}"`)
    }

    res.json({
      success: true,
      message: 'Automation check ran successfully.',
      scannedAt: now,
      actionsTaken: logs
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Fetch automation logs
router.get('/logs', async (req, res) => {
  try {
    const logs = await ActivityLog.find({ action: 'sent automation reminder' })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(30)
    res.json(logs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
