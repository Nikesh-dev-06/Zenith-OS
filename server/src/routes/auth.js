const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { User } = require('../models')
const { authenticate, agencyOnly } = require('../middleware/auth')

const JWT_SECRET = process.env.JWT_SECRET || 'dev_zenith_secret_key'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_zenith_refresh_key'

const signToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' })
const signRefresh = (id) => jwt.sign({ id }, JWT_REFRESH_SECRET, { expiresIn: '30d' })

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

    const user = await User.findOne({ email }).select('+password')
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    if (!user.isActive) return res.status(401).json({ error: 'Account is deactivated' })

    const token = signToken(user._id)
    const refreshToken = signRefresh(user._id)
    user.refreshToken = refreshToken
    await user.save()

    res.json({
      token,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, clientId: user.clientId },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' })

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET)
    const user = await User.findById(decoded.id).select('+refreshToken')
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' })
    }

    const newToken = signToken(user._id)
    res.json({ token: newToken })
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' })
  }
})

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { refreshToken: null })
  res.json({ message: 'Logged out successfully' })
})

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user })
})

// GET /api/auth/users
router.get('/users', authenticate, agencyOnly, async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select('name email role')
    res.json(users)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.json({ message: 'If this email exists, a reset link has been sent.' })

    const token = crypto.randomBytes(32).toString('hex')
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex')
    user.resetPasswordExpires = Date.now() + 3600000 // 1 hour
    await user.save()

    // In production: send email via Resend
    res.json({ message: 'Password reset link sent to your email.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/reset-password/:token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex')
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    })
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' })

    user.password = req.body.password
    user.resetPasswordToken = undefined
    user.resetPasswordExpires = undefined
    await user.save()

    res.json({ message: 'Password reset successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
