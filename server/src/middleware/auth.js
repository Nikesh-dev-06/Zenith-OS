const jwt = require('jsonwebtoken')
const { User } = require('../models')

const JWT_SECRET = process.env.JWT_SECRET || 'dev_zenith_secret_key'

exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await User.findById(decoded.id).select('-password')
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' })
    }
    req.user = user
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' })
    }
    return res.status(401).json({ error: 'Invalid token' })
  }
}

exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' })
  }
  next()
}

exports.readOnlyForViewer = (req, res, next) => {
  if (req.user.role === 'client_viewer' && req.method !== 'GET') {
    return res.status(403).json({ error: 'Client Viewer accounts have read-only access' })
  }
  next()
}

exports.agencyOnly = exports.authorize('super_admin', 'team_member')
exports.adminOnly = exports.authorize('super_admin')
