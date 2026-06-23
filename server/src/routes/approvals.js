const express = require('express')
const router = express.Router()
const { Approval, ActivityLog } = require('../models')
const { authenticate, agencyOnly, readOnlyForViewer } = require('../middleware/auth')

router.use(authenticate)
router.use(readOnlyForViewer)

const enrichApproval = (appr) => {
  return {
    ...appr.toObject(),
    id: appr._id,
    projectName: appr.projectId ? appr.projectId.name : 'Unknown Project',
    clientName: appr.clientId ? appr.clientId.companyName : 'Unknown Client',
    comment: appr.clientComment,
    requestedAt: appr.createdAt,
  }
}

router.get('/', async (req, res) => {
  try {
    const query = {}
    if (['client', 'client_viewer'].includes(req.user.role)) query.clientId = req.user.clientId
    if (req.query.status && req.query.status !== 'all') query.status = req.query.status
    const approvals = await Approval.find(query)
      .populate('projectId', 'name')
      .populate('clientId', 'companyName')
      .populate('fileIds', 'name type size description')
      .sort({ createdAt: -1 })
    res.json(approvals.map(enrichApproval))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', agencyOnly, async (req, res) => {
  try {
    const approval = await Approval.create({ ...req.body, requestedBy: req.user._id })
    await ActivityLog.create({ action: 'requested approval', entityType: 'approval', entityId: approval._id, entityName: approval.title, userId: req.user._id })
    const populated = await Approval.findById(approval._id)
      .populate('projectId', 'name')
      .populate('clientId', 'companyName')
      .populate('fileIds', 'name type size description')
    res.status(201).json(enrichApproval(populated))
  } catch (err) { res.status(400).json({ error: err.message }) }
})

router.put('/:id/respond', async (req, res) => {
  try {
    const { status, clientComment, signatureText, signatureDrawn } = req.body
    const updateFields = { status, clientComment, respondedAt: new Date() }
    if (status === 'approved') {
      if (signatureText) updateFields.signatureText = signatureText
      if (signatureDrawn) updateFields.signatureDrawn = signatureDrawn
      updateFields.signedAt = new Date()
    }
    const approval = await Approval.findByIdAndUpdate(req.params.id, updateFields, { new: true })
      .populate('projectId', 'name')
      .populate('clientId', 'companyName')
      .populate('fileIds', 'name type size description')
    if (!approval) return res.status(404).json({ error: 'Approval not found' })
    await ActivityLog.create({ action: `responded to approval: ${status}`, entityType: 'approval', entityId: approval._id, entityName: approval.title, userId: req.user._id })
    res.json(enrichApproval(approval))
  } catch (err) { res.status(400).json({ error: err.message }) }
})

module.exports = router

