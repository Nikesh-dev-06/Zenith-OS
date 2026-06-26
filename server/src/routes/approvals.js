const express = require('express')
const router = express.Router()
const { Approval, ActivityLog, User, Notification } = require('../models')
const { authenticate, readOnlyForViewer } = require('../middleware/auth')

router.use(authenticate)
router.use(readOnlyForViewer)

// Helper to notify other party
async function notifyStakeholders(approval, type, title, message, authorId) {
  try {
    const author = await User.findById(authorId)
    const isAuthorClient = ['client', 'client_viewer'].includes(author?.role)

    if (isAuthorClient) {
      // Notify original requester if they are an admin
      if (approval.requestedBy) {
        const requester = await User.findById(approval.requestedBy)
        if (['super_admin', 'team_member'].includes(requester?.role)) {
          await Notification.create({
            userId: approval.requestedBy,
            type,
            title,
            message,
            link: '/approvals'
          })
        }
      }
      // Notify assigned approver if they are an admin
      if (approval.assignedApproverId && approval.assignedApproverId.toString() !== approval.requestedBy?.toString()) {
        const approver = await User.findById(approval.assignedApproverId)
        if (['super_admin', 'team_member'].includes(approver?.role)) {
          await Notification.create({
            userId: approval.assignedApproverId,
            type,
            title,
            message,
            link: '/approvals'
          })
        }
      }
    } else {
      // Notify all users under this client
      const clientUsers = await User.find({ clientId: approval.clientId, isActive: true })
      for (const cu of clientUsers) {
        await Notification.create({
          userId: cu._id,
          type,
          title,
          message,
          link: '/portal/approvals'
        })
      }
    }
  } catch (err) {
    console.error('Notification dispatch failed:', err)
  }
}

const enrichApproval = (appr) => {
  const obj = appr.toObject()
  return {
    ...obj,
    id: appr._id,
    projectName: appr.projectId ? appr.projectId.name : 'Unknown Project',
    clientName: appr.clientId ? appr.clientId.companyName : 'Unknown Client',
    requestedByName: appr.requestedBy ? appr.requestedBy.name : 'Unknown User',
    assignedApproverName: appr.assignedApproverId ? appr.assignedApproverId.name : 'Unassigned',
    comment: appr.clientComment,
    requestedAt: appr.createdAt,
  }
}

// GET /api/approvals
router.get('/', async (req, res) => {
  try {
    const query = {}
    if (['client', 'client_viewer'].includes(req.user.role)) {
      query.clientId = req.user.clientId
    }
    
    if (req.query.status && req.query.status !== 'all') {
      if (req.query.status === 'pending_admin_approval') {
        query.status = 'pending_admin_approval'
      } else if (req.query.status === 'pending_client_approval') {
        query.status = 'pending_client_approval'
      } else {
        query.status = req.query.status
      }
    }

    const approvals = await Approval.find(query)
      .populate('projectId', 'name')
      .populate('clientId', 'companyName')
      .populate('fileIds', 'name type size description s3Key')
      .populate('requestedBy', 'name email role')
      .populate('assignedApproverId', 'name email role')
      .populate('history.user', 'name role')
      .sort({ createdAt: -1 })
      
    res.json(approvals.map(enrichApproval))
  } catch (err) { 
    res.status(500).json({ error: err.message }) 
  }
})

// POST /api/approvals (Accessible to both admins and clients)
router.post('/', async (req, res) => {
  try {
    const isClient = ['client', 'client_viewer'].includes(req.user.role)
    const { projectId, title, requestType, description, priority, dueDate, fileIds, assignedApproverId } = req.body

    if (!projectId || !title || !requestType) {
      return res.status(400).json({ error: 'Project ID, Title, and Request Type are required.' })
    }

    let targetClientId
    let initialStatus = 'pending_client_approval'

    if (isClient) {
      targetClientId = req.user.clientId
      initialStatus = 'pending_admin_approval' // Client requests approval/feedback from Admin
    } else {
      if (!req.body.clientId) {
        return res.status(400).json({ error: 'Client ID is required for admin requests.' })
      }
      targetClientId = req.body.clientId
      if (req.body.status === 'draft') {
        initialStatus = 'draft'
      } else if (req.body.status) {
        initialStatus = req.body.status
      }
    }

    const historyItem = {
      user: req.user._id,
      userName: req.user.name,
      action: 'created',
      comments: description || 'Approval request created',
      status: initialStatus,
      createdAt: new Date()
    }

    const approval = await Approval.create({
      title,
      description,
      projectId,
      clientId: targetClientId,
      requestedBy: req.user._id,
      assignedApproverId: isClient ? (assignedApproverId || null) : (assignedApproverId || null),
      fileIds: fileIds || [],
      status: initialStatus,
      requestType,
      priority: priority || 'medium',
      dueDate: dueDate || null,
      history: [historyItem]
    })

    await ActivityLog.create({
      action: 'created approval request',
      entityType: 'approval',
      entityId: approval._id,
      entityName: approval.title,
      userId: req.user._id
    })

    const populated = await Approval.findById(approval._id)
      .populate('projectId', 'name')
      .populate('clientId', 'companyName')
      .populate('fileIds', 'name type size description s3Key')
      .populate('requestedBy', 'name email role')
      .populate('assignedApproverId', 'name email role')
      .populate('history.user', 'name role')

    // Send notifications
    await notifyStakeholders(
      populated,
      'approval_requested',
      `New Approval Request: ${title}`,
      `A new approval request has been created for project: ${populated.projectId?.name || 'Project'}.`,
      req.user._id
    )

    res.status(201).json(enrichApproval(populated))
  } catch (err) { 
    res.status(400).json({ error: err.message }) 
  }
})

// PUT /api/approvals/:id/respond
router.put('/:id/respond', async (req, res) => {
  try {
    const { status, clientComment, signatureText, signatureDrawn } = req.body
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required.' })
    }

    const approval = await Approval.findById(req.params.id)
    if (!approval) {
      return res.status(404).json({ error: 'Approval request not found.' })
    }

    // Role and client ownership validation
    const isClient = ['client', 'client_viewer'].includes(req.user.role)
    if (isClient && approval.clientId.toString() !== req.user.clientId?.toString()) {
      return res.status(403).json({ error: 'Access denied: client mismatch.' })
    }

    // Enforce comment when rejecting or requesting revisions
    const commentText = clientComment || req.body.comment || req.body.comments
    if (['rejected', 'revision_requested'].includes(status) && (!commentText || !commentText.trim())) {
      return res.status(400).json({ error: 'Comments are mandatory when rejecting or requesting revisions.' })
    }

    const updateFields = { status, clientComment: commentText || approval.clientComment, respondedAt: new Date() }
    
    if (status === 'approved') {
      if (signatureText) updateFields.signatureText = signatureText
      if (signatureDrawn) updateFields.signatureDrawn = signatureDrawn
      updateFields.signedAt = new Date()
    }

    // Append to status history
    const historyItem = {
      user: req.user._id,
      userName: req.user.name,
      action: status,
      comments: commentText || 'No comments left.',
      status,
      createdAt: new Date()
    }

    const updated = await Approval.findByIdAndUpdate(
      req.params.id, 
      { 
        $set: updateFields,
        $push: { history: historyItem }
      }, 
      { new: true }
    )
      .populate('projectId', 'name')
      .populate('clientId', 'companyName')
      .populate('fileIds', 'name type size description s3Key')
      .populate('requestedBy', 'name email role')
      .populate('assignedApproverId', 'name email role')
      .populate('history.user', 'name role')

    await ActivityLog.create({
      action: `responded to approval: ${status}`,
      entityType: 'approval',
      entityId: updated._id,
      entityName: updated.title,
      userId: req.user._id
    })

    // Send notifications
    await notifyStakeholders(
      updated,
      'approval_status_updated',
      `Approval Request ${status.replace('_', ' ')}: ${updated.title}`,
      `The approval request "${updated.title}" status has been updated to "${status.replace('_', ' ')}".`,
      req.user._id
    )

    res.json(enrichApproval(updated))
  } catch (err) { 
    res.status(400).json({ error: err.message }) 
  }
})

// POST /api/approvals/:id/comment (Add comment to timeline history)
router.post('/:id/comment', async (req, res) => {
  try {
    const { comment } = req.body
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment content is required.' })
    }

    const approval = await Approval.findById(req.params.id)
    if (!approval) {
      return res.status(404).json({ error: 'Approval request not found.' })
    }

    // Client ownership check
    const isClient = ['client', 'client_viewer'].includes(req.user.role)
    if (isClient && approval.clientId.toString() !== req.user.clientId?.toString()) {
      return res.status(403).json({ error: 'Access denied: client mismatch.' })
    }

    const historyItem = {
      user: req.user._id,
      userName: req.user.name,
      action: 'comment_added',
      comments: comment,
      status: approval.status,
      createdAt: new Date()
    }

    const updated = await Approval.findByIdAndUpdate(
      req.params.id,
      { $push: { history: historyItem } },
      { new: true }
    )
      .populate('projectId', 'name')
      .populate('clientId', 'companyName')
      .populate('fileIds', 'name type size description s3Key')
      .populate('requestedBy', 'name email role')
      .populate('assignedApproverId', 'name email role')
      .populate('history.user', 'name role')

    await ActivityLog.create({
      action: 'commented on approval',
      entityType: 'approval',
      entityId: updated._id,
      entityName: updated.title,
      userId: req.user._id
    })

    // Send notifications
    await notifyStakeholders(
      updated,
      'approval_comment_added',
      `New Comment on Approval: ${updated.title}`,
      `${req.user.name} added a comment: "${comment.length > 50 ? comment.substring(0, 50) + '...' : comment}"`,
      req.user._id
    )

    res.json(enrichApproval(updated))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// PUT /api/approvals/:id/cancel (Cancel approval request)
router.put('/:id/cancel', async (req, res) => {
  try {
    const approval = await Approval.findById(req.params.id)
    if (!approval) {
      return res.status(404).json({ error: 'Approval request not found.' })
    }

    // Requester check or Admin role
    const isClient = ['client', 'client_viewer'].includes(req.user.role)
    if (isClient && approval.requestedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied: only the requester can cancel.' })
    }

    const historyItem = {
      user: req.user._id,
      userName: req.user.name,
      action: 'cancelled',
      comments: 'Request cancelled',
      status: 'cancelled',
      createdAt: new Date()
    }

    const updated = await Approval.findByIdAndUpdate(
      req.params.id,
      {
        $set: { status: 'cancelled' },
        $push: { history: historyItem }
      },
      { new: true }
    )
      .populate('projectId', 'name')
      .populate('clientId', 'companyName')
      .populate('fileIds', 'name type size description s3Key')
      .populate('requestedBy', 'name email role')
      .populate('assignedApproverId', 'name email role')
      .populate('history.user', 'name role')

    await ActivityLog.create({
      action: 'cancelled approval request',
      entityType: 'approval',
      entityId: updated._id,
      entityName: updated.title,
      userId: req.user._id
    })

    // Send notifications
    await notifyStakeholders(
      updated,
      'approval_status_updated',
      `Approval Request Cancelled: ${updated.title}`,
      `The approval request "${updated.title}" has been cancelled.`,
      req.user._id
    )

    res.json(enrichApproval(updated))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// POST Create DocuSign envelope session for Approvals
router.post('/:id/docusign/create-envelope', async (req, res) => {
  try {
    const approval = await Approval.findById(req.params.id)
    if (!approval) return res.status(404).json({ error: 'Approval request not found.' })

    const clientId = process.env.DOCUSIGN_INTEGRATION_KEY
    const hasKeys = !!clientId

    const redirectUrl = `http://localhost:5173/portal/approvals?verify_external=true&approval_id=${approval._id}&provider=docusign&signer=${encodeURIComponent(req.user.name)}`
    
    if (!hasKeys) {
      console.log(`[MOCK DOCUSIGN] Creating DocuSign envelope for Approval: ${approval.title}`)
      return res.json({
        url: `https://demo.docusign.net/Member/StartInSession.aspx?envelopeId=mock_ds_env_${Date.now()}&redirect=${encodeURIComponent(redirectUrl)}`,
        isMock: true
      })
    }

    res.json({
      url: `https://demo.docusign.net/Member/StartInSession.aspx?envelopeId=ds_env_real_${Date.now()}&redirect=${encodeURIComponent(redirectUrl)}`,
      isMock: false
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST Create Zoho Sign session for Approvals
router.post('/:id/zohosign/create-envelope', async (req, res) => {
  try {
    const approval = await Approval.findById(req.params.id)
    if (!approval) return res.status(404).json({ error: 'Approval request not found.' })

    const clientId = process.env.ZOHOSIGN_CLIENT_ID
    const hasKeys = !!clientId

    const redirectUrl = `http://localhost:5173/portal/approvals?verify_external=true&approval_id=${approval._id}&provider=zohosign&signer=${encodeURIComponent(req.user.name)}`

    if (!hasKeys) {
      console.log(`[MOCK ZOHOSIGN] Creating Zoho Sign envelope for Approval: ${approval.title}`)
      return res.json({
        url: `https://sign.zoho.com/api/v1/simulations/document?envelopeId=mock_zs_env_${Date.now()}&redirect=${encodeURIComponent(redirectUrl)}`,
        isMock: true
      })
    }

    res.json({
      url: `https://sign.zoho.com/api/v1/simulations/document?envelopeId=zs_env_real_${Date.now()}&redirect=${encodeURIComponent(redirectUrl)}`,
      isMock: false
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST Verification callback for approvals
router.post('/:id/external-callback', async (req, res) => {
  try {
    const { provider, signerName } = req.body
    const approval = await Approval.findById(req.params.id)
    if (!approval) return res.status(404).json({ error: 'Approval request not found.' })

    const updateFields = {
      status: 'approved',
      respondedAt: new Date(),
      signerName: signerName || req.user.name || 'Client',
      signatureText: provider === 'docusign' ? 'DS' : 'ZS',
      signatureDrawn: `${provider.toUpperCase()}:signed_${Date.now()}`,
      signedAt: new Date()
    }

    const historyItem = {
      user: req.user._id,
      userName: req.user.name,
      action: 'approved',
      comments: `Approved and signed digitally via ${provider === 'docusign' ? 'DocuSign' : 'Zoho Sign'}.`,
      status: 'approved',
      createdAt: new Date()
    }

    const updated = await Approval.findByIdAndUpdate(
      req.params.id,
      {
        $set: updateFields,
        $push: { history: historyItem }
      },
      { new: true }
    )
      .populate('projectId', 'name')
      .populate('clientId', 'companyName')
      .populate('fileIds', 'name type size description s3Key')
      .populate('requestedBy', 'name email role')
      .populate('assignedApproverId', 'name email role')
      .populate('history.user', 'name role')

    await ActivityLog.create({
      action: `signed approval via ${provider}`,
      entityType: 'approval',
      entityId: updated._id,
      entityName: updated.title,
      userId: req.user._id
    })

    await notifyStakeholders(
      updated,
      'approval_status_updated',
      `Approval Signed via ${provider === 'docusign' ? 'DocuSign' : 'Zoho Sign'}: ${updated.title}`,
      `The approval request "${updated.title}" has been signed and approved.`,
      req.user._id
    )

    res.json({ message: 'Approval signed successfully', approval: enrichApproval(updated) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
