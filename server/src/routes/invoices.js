const express = require('express')
const router = express.Router()
const { Invoice, Client, ActivityLog, Notification, User } = require('../models')
const { authenticate, agencyOnly } = require('../middleware/auth')

router.use(authenticate)

const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear()
  const count = await Invoice.countDocuments()
  return `INV-${year}-${String(count + 1).padStart(3, '0')}`
}

const enrichInvoice = (invoice) => {
  return {
    ...invoice.toObject(),
    id: invoice._id,
    clientName: invoice.clientId ? invoice.clientId.companyName : 'Unknown Client',
    projectName: invoice.projectId ? invoice.projectId.name : 'Unknown Project',
  }
}

router.get('/', async (req, res) => {
  try {
    const { clientId, status, page = 1, limit = 20 } = req.query
    const query = {}
    if (req.user.role === 'client') query.clientId = req.user.clientId
    else if (clientId) query.clientId = clientId
    if (status && status !== 'all') query.status = status

    const [invoices, total] = await Promise.all([
      Invoice.find(query).populate('clientId', 'companyName email').populate('projectId', 'name').skip((page - 1) * limit).limit(+limit).sort({ createdAt: -1 }),
      Invoice.countDocuments(query),
    ])
    res.json({ invoices: invoices.map(enrichInvoice), total })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', agencyOnly, async (req, res) => {
  try {
    const invoiceNumber = await generateInvoiceNumber()
    const items = req.body.items || []
    const subtotal = items.reduce((s, i) => s + i.amount, 0)
    const tax = Math.round(subtotal * (req.body.taxRate || 18) / 100)
    const invoice = await Invoice.create({ ...req.body, invoiceNumber, subtotal, tax, total: subtotal + tax })

    await ActivityLog.create({ action: 'created invoice', entityType: 'invoice', entityId: invoice._id, entityName: invoiceNumber, userId: req.user._id })
    const populated = await Invoice.findById(invoice._id).populate('clientId', 'companyName email').populate('projectId', 'name')
    res.status(201).json(enrichInvoice(populated))
  } catch (err) { res.status(400).json({ error: err.message }) }
})

router.post('/:id/send', agencyOnly, async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, { status: 'sent' }, { new: true }).populate('clientId', 'companyName email').populate('projectId', 'name')
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    // In production: send email via Resend
    await ActivityLog.create({ action: 'sent invoice', entityType: 'invoice', entityId: invoice._id, entityName: invoice.invoiceNumber, userId: req.user._id })
    res.json(enrichInvoice(invoice))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('clientId').populate('projectId', 'name')
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (req.user.role === 'client' && invoice.clientId._id.toString() !== req.user.clientId?.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }
    res.json(enrichInvoice(invoice))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router

