const express = require('express')
const router = express.Router()
const { RecurringInvoiceTemplate, Invoice, ActivityLog } = require('../models')
const { authenticate, agencyOnly, readOnlyForViewer } = require('../middleware/auth')

router.use(authenticate)
router.use(readOnlyForViewer)

// Fetch all templates
router.get('/', async (req, res) => {
  try {
    const templates = await RecurringInvoiceTemplate.find()
      .populate('clientId', 'companyName')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
    res.json(templates)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create recurring template
router.post('/', agencyOnly, async (req, res) => {
  try {
    const { clientId, projectId, items, taxRate = 18, discountType = 'percent', discountValue = 0, frequency = 'monthly', nextGenerateDate, notes } = req.body

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0)
    let discount = 0
    if (discountType === 'percent') {
      discount = Math.round(subtotal * discountValue / 100)
    } else {
      discount = discountValue
    }
    const taxableAmount = Math.max(0, subtotal - discount)
    const tax = Math.round(taxableAmount * taxRate / 100)
    const total = taxableAmount + tax

    const template = await RecurringInvoiceTemplate.create({
      clientId,
      projectId,
      items,
      subtotal,
      discountType,
      discountValue,
      discount,
      taxRate,
      tax,
      total,
      frequency,
      nextGenerateDate: nextGenerateDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes
    })

    await ActivityLog.create({
      action: 'created recurring invoice template',
      entityType: 'invoice',
      entityId: template._id,
      entityName: `Template for Client ${clientId}`,
      userId: req.user._id
    })

    res.status(201).json(template)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Delete template
router.delete('/:id', agencyOnly, async (req, res) => {
  try {
    const template = await RecurringInvoiceTemplate.findByIdAndDelete(req.params.id)
    if (!template) return res.status(404).json({ error: 'Template not found' })
    await ActivityLog.create({
      action: 'deleted recurring invoice template',
      entityType: 'invoice',
      entityId: template._id,
      entityName: `Deleted template ${template._id}`,
      userId: req.user._id
    })
    res.json({ message: 'Template deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Trigger a template run (Generate Invoice now)
router.post('/:id/trigger', agencyOnly, async (req, res) => {
  try {
    const template = await RecurringInvoiceTemplate.findById(req.params.id)
    if (!template) return res.status(404).json({ error: 'Template not found' })

    const count = await Invoice.countDocuments()
    const invoiceNumber = `INV-REC-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)

    const invoice = await Invoice.create({
      invoiceNumber,
      clientId: template.clientId,
      projectId: template.projectId,
      items: template.items,
      subtotal: template.subtotal,
      discountType: template.discountType,
      discountValue: template.discountValue,
      discount: template.discount,
      taxRate: template.taxRate,
      tax: template.tax,
      total: template.total,
      dueDate,
      notes: template.notes || 'Generated from subscription template.',
      status: 'draft'
    })

    // Advance next generate date based on frequency
    const nextDate = new Date(template.nextGenerateDate)
    if (template.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
    else if (template.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)
    else if (template.frequency === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3)

    template.nextGenerateDate = nextDate
    await template.save()

    await ActivityLog.create({
      action: 'generated invoice from template',
      entityType: 'invoice',
      entityId: invoice._id,
      entityName: invoiceNumber,
      userId: req.user._id
    })

    res.status(201).json(invoice)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
