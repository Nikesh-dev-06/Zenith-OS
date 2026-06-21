// reports.js
const express = require('express')
const reportsRouter = express.Router()
const { Invoice, Client, Project } = require('../models')
const { authenticate, agencyOnly } = require('../middleware/auth')

reportsRouter.use(authenticate, agencyOnly)

reportsRouter.get('/revenue', async (req, res) => {
  try {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const start = new Date(date.getFullYear(), date.getMonth(), 1)
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1) // First day of next month

      const [billed, collected] = await Promise.all([
        Invoice.aggregate([
          { $match: { createdAt: { $gte: start, $lt: end } } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]),
        Invoice.aggregate([
          { $match: { status: 'paid', paidAt: { $gte: start, $lt: end } } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]),
      ])
      months.push({
        month: start.toLocaleString('en', { month: 'short' }),
        revenue: billed[0]?.total || 0,
        collected: collected[0]?.total || 0,
      })
    }
    res.json(months)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

reportsRouter.get('/client-performance', async (req, res) => {
  try {
    const clients = await Client.find({ deletedAt: null })
    const performance = await Promise.all(clients.map(async client => {
      const [projects, revenue] = await Promise.all([
        Project.countDocuments({ clientId: client._id, deletedAt: null }),
        Invoice.aggregate([
          { $match: { clientId: client._id, status: 'paid' } },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]),
      ])
      return {
        client: { id: client._id, name: client.companyName, status: client.status, industry: client.industry, gstin: client.gstin },
        projects,
        revenue: revenue[0]?.total || 0
      }
    }))
    res.json(performance.sort((a, b) => b.revenue - a.revenue))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = reportsRouter

