const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const mongoose = require('mongoose')

const app = express()

// ── Security Middleware ──────────────────────────────
app.use(helmet())
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin)
    const isClientUrl = origin === process.env.CLIENT_URL
    if (isLocalhost || isClientUrl) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

// Rate limiting
const isDev = process.env.NODE_ENV !== 'production'
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 10000 : 100, // 10,000 requests in dev, 100 in production
  message: { error: 'Too many requests, please try again later.' },
})
app.use('/api', limiter)

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 1000 : 10, // 1,000 requests in dev, 10 in production
  message: { error: 'Too many login attempts. Please try again later.' },
})

// ── Routes ──────────────────────────────────────────
app.use('/api/auth', authLimiter, require('./routes/auth'))
app.use('/api/clients', require('./routes/clients'))
app.use('/api/projects', require('./routes/projects'))
app.use('/api/tasks', require('./routes/tasks'))
app.use('/api/files', require('./routes/files'))
app.use('/api/approvals', require('./routes/approvals'))
app.use('/api/invoices', require('./routes/invoices'))
app.use('/api/payments', require('./routes/payments'))
app.use('/api/notifications', require('./routes/notifications'))
app.use('/api/dashboard', require('./routes/dashboard'))
app.use('/api/reports', require('./routes/reports'))
app.use('/api/activity', require('./routes/activity'))
app.use('/api/webhooks', require('./routes/webhooks'))
app.use('/api/recurring', require('./routes/recurring'))
app.use('/api/automation', require('./routes/automation'))
app.use('/api/proposals', require('./routes/proposals'))
app.use('/api/contracts', require('./routes/contracts'))

// ── Health Check ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ZenithOS API', timestamp: new Date().toISOString() })
})

// ── 404 Handler ──────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` })
})

// ── Global Error Handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

// ── Database + Server Start ──────────────────────────────────────────
const PORT = process.env.PORT || 5000

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zenithos')
  .then(() => {
    console.log('✅ MongoDB connected')
    app.listen(PORT, () => {
      console.log(`🚀 ZenithOS API running on port ${PORT}`)
    })
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message)
    process.exit(1)
  })

module.exports = app
