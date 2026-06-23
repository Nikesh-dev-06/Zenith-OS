const express = require('express')
const router = express.Router()
const { WebhookSubscription, WebhookLog, ActivityLog } = require('../models')
const { authenticate, agencyOnly, readOnlyForViewer } = require('../middleware/auth')
const { triggerWebhook } = require('../utils/webhooks')

router.use(authenticate)
router.use(readOnlyForViewer)

// Get all subscriptions & logs
router.get('/', async (req, res) => {
  try {
    const [subscriptions, logs] = await Promise.all([
      WebhookSubscription.find().sort({ createdAt: -1 }),
      WebhookLog.find().sort({ createdAt: -1 }).limit(30)
    ])
    res.json({ subscriptions, logs })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create new subscription
router.post('/', agencyOnly, async (req, res) => {
  try {
    const { url, event } = req.body
    if (!url || !event) {
      return res.status(400).json({ error: 'URL and Event type are required' })
    }
    const sub = await WebhookSubscription.create({ url, event })
    await ActivityLog.create({
      action: 'created webhook subscription',
      entityType: 'webhook',
      entityId: sub._id,
      entityName: `${event} -> ${url}`,
      userId: req.user._id
    })
    res.status(201).json(sub)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Delete subscription
router.delete('/:id', agencyOnly, async (req, res) => {
  try {
    const sub = await WebhookSubscription.findByIdAndDelete(req.params.id)
    if (!sub) return res.status(404).json({ error: 'Subscription not found' })
    await ActivityLog.create({
      action: 'deleted webhook subscription',
      entityType: 'webhook',
      entityId: sub._id,
      entityName: `${sub.event} -> ${sub.url}`,
      userId: req.user._id
    })
    res.json({ message: 'Webhook subscription deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Send test webhook payload
router.post('/test', agencyOnly, async (req, res) => {
  try {
    const { event } = req.body
    const mockPayload = {
      test: true,
      timestamp: new Date().toISOString(),
      triggeredBy: req.user.name,
      sampleData: {
        id: 'mock_id_123',
        status: 'completed',
        amount: 25000
      }
    }
    await triggerWebhook(event || 'project.completed', mockPayload)
    res.json({ message: `Test webhook triggered for event: ${event || 'project.completed'}` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
