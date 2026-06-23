const express = require('express')
const { Client, ActivityLog, Project, Invoice, Interaction } = require('../models')
const { authenticate, agencyOnly, adminOnly, readOnlyForViewer } = require('../middleware/auth')
const router = express.Router()

router.use(authenticate)
router.use(readOnlyForViewer)

const enrichClient = async (client) => {
  const [projectCount, invoices] = await Promise.all([
    Project.countDocuments({ clientId: client._id, deletedAt: null }),
    Invoice.find({ clientId: client._id, status: 'paid' }).select('total'),
  ])
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0)
  return {
    ...client.toObject(),
    id: client._id,
    projectCount,
    totalRevenue,
  }
}

router.get('/', agencyOnly, async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query
    const query = { deletedAt: null }
    if (status && status !== 'all') query.status = status
    if (search) query.$text = { $search: search }

    const [clients, total] = await Promise.all([
      Client.find(query).skip((page - 1) * limit).limit(+limit).sort({ createdAt: -1 }),
      Client.countDocuments(query),
    ])
    const enrichedClients = await Promise.all(clients.map(enrichClient))
    res.json({ clients: enrichedClients, total, page: +page, pages: Math.ceil(total / limit) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', agencyOnly, async (req, res) => {
  try {
    const client = await Client.create(req.body)
    await ActivityLog.create({ action: 'created client', entityType: 'client', entityId: client._id, entityName: client.companyName, userId: req.user._id })
    const enriched = await enrichClient(client)
    res.status(201).json(enriched)
  } catch (err) { res.status(400).json({ error: err.message }) }
})

router.get('/:id', async (req, res) => {
  try {
    if (req.user.role === 'client' && req.user.clientId?.toString() !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' })
    }
    const client = await Client.findById(req.params.id)
    if (!client) return res.status(404).json({ error: 'Client not found' })
    const enriched = await enrichClient(client)
    res.json(enriched)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', agencyOnly, async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!client) return res.status(404).json({ error: 'Client not found' })
    const enriched = await enrichClient(client)
    res.json(enriched)
  } catch (err) { res.status(400).json({ error: err.message }) }
})

router.delete('/:id', adminOnly, async (req, res) => {
  try {
    await Client.findByIdAndUpdate(req.params.id, { deletedAt: new Date() })
    res.json({ message: 'Client archived' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /:id/interactions
router.get('/:id/interactions', async (req, res) => {
  try {
    if (req.user.role === 'client' && req.user.clientId?.toString() !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' })
    }
    const logs = await Interaction.find({ clientId: req.params.id })
      .populate('recordedBy', 'name')
      .sort({ createdAt: -1 })
    res.json(logs)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /:id/interactions
router.post('/:id/interactions', agencyOnly, async (req, res) => {
  try {
    const { type, content } = req.body
    if (!content) return res.status(400).json({ error: 'Content is required' })

    const log = await Interaction.create({
      clientId: req.params.id,
      type,
      content,
      recordedBy: req.user._id,
      recordedByName: req.user.name
    })
    res.status(201).json(log)
  } catch (err) { res.status(400).json({ error: err.message }) }
})

// GET /:id/emails (Sync mock email history)
router.get('/:id/emails', async (req, res) => {
  try {
    if (req.user.role === 'client' && req.user.clientId?.toString() !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' })
    }
    const mockEmails = [
      { sender: 'arjun@novatech.com', recipient: 'hello@zenithcreative.in', subject: 'Query on website redesign specs', body: 'Hi team, checking on the updated prototype wireframe timeline. Thanks.', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { sender: 'rahul@zenithcreative.in', recipient: 'arjun@novatech.com', subject: 'Re: Query on website redesign specs', body: 'Hi Arjun, wireframes are completed and uploaded for approval. Please check details.', date: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000) }
    ]
    res.json(mockEmails)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

const { sendWhatsAppMessage } = require('../utils/whatsapp')

// POST /:id/whatsapp
router.post('/:id/whatsapp', agencyOnly, async (req, res) => {
  try {
    const { message } = req.body
    if (!message) return res.status(400).json({ error: 'Message content is required' })
    const client = await Client.findById(req.params.id)
    if (!client) return res.status(404).json({ error: 'Client not found' })
    if (!client.phone) return res.status(400).json({ error: 'Client has no phone number' })

    const result = await sendWhatsAppMessage({
      toPhone: client.phone,
      message,
      userId: req.user._id
    })

    await Interaction.create({
      clientId: client._id,
      type: 'system',
      content: `[WhatsApp Sent] To ${client.phone}: "${message}"`,
      recordedBy: req.user._id,
      recordedByName: req.user.name
    })

    res.json({ message: 'WhatsApp message sent (simulated)', result })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router

