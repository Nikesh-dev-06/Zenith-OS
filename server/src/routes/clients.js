// ── clients.js ───────────────────────────────────────────
const express = require('express')
const { Client, ActivityLog, Project, Invoice } = require('../models')
const { authenticate, agencyOnly, adminOnly } = require('../middleware/auth')
const router = express.Router()

router.use(authenticate)

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

module.exports = router

