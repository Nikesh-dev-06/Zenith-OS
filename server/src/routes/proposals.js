const express = require('express')
const router = express.Router()
const { Proposal, Invoice, Client, ActivityLog } = require('../models')
const { authenticate, agencyOnly, readOnlyForViewer } = require('../middleware/auth')

router.use(authenticate)
router.use(readOnlyForViewer)

const enrichProposal = (proposal) => {
  return {
    ...proposal.toObject(),
    id: proposal._id,
    clientName: proposal.clientId ? proposal.clientId.companyName : 'Unknown Client',
    projectName: proposal.projectId ? proposal.projectId.name : 'Unknown Project',
  }
}

// GET proposals list
router.get('/', async (req, res) => {
  try {
    const query = {}
    if (['client', 'client_viewer'].includes(req.user.role)) {
      query.clientId = req.user.clientId
    }
    const proposals = await Proposal.find(query)
      .populate('clientId', 'companyName email')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
    res.json(proposals.map(enrichProposal))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST create proposal
router.post('/', agencyOnly, async (req, res) => {
  try {
    const count = await Proposal.countDocuments()
    const proposalNumber = `PROP-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`
    
    const proposal = await Proposal.create({
      ...req.body,
      proposalNumber,
      status: 'draft',
    })
    
    await ActivityLog.create({
      action: 'created proposal',
      entityType: 'proposal',
      entityId: proposal._id,
      entityName: proposalNumber,
      userId: req.user._id,
    })
    
    const populated = await Proposal.findById(proposal._id).populate('clientId').populate('projectId')
    res.status(201).json(enrichProposal(populated))
  } catch (err) { res.status(400).json({ error: err.message }) }
})

// GET proposal detail
router.get('/:id', async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate('clientId')
      .populate('projectId')
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' })
    
    if (req.user.role === 'client' && proposal.clientId._id.toString() !== req.user.clientId?.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }
    
    res.json(enrichProposal(proposal))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT update proposal
router.put('/:id', agencyOnly, async (req, res) => {
  try {
    const proposal = await Proposal.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' })
    
    await ActivityLog.create({
      action: 'updated proposal',
      entityType: 'proposal',
      entityId: proposal._id,
      entityName: proposal.proposalNumber,
      userId: req.user._id,
    })
    
    const populated = await Proposal.findById(proposal._id).populate('clientId').populate('projectId')
    res.json(enrichProposal(populated))
  } catch (err) { res.status(400).json({ error: err.message }) }
})

// POST accept proposal (E-signature acceptance auto-generates invoice!)
router.post('/:id/accept', async (req, res) => {
  try {
    const { signatureText } = req.body
    if (!signatureText) return res.status(400).json({ error: 'Signature is required to accept proposal' })
    
    const proposal = await Proposal.findById(req.params.id)
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' })
    
    if (req.user.role === 'client' && proposal.clientId.toString() !== req.user.clientId?.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }
    
    proposal.status = 'accepted'
    proposal.signatureText = signatureText
    proposal.signedAt = new Date()
    await proposal.save()
    
    // Auto-generate invoice from accepted proposal!
    const invoiceCount = await Invoice.countDocuments()
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(3, '0')}`
    
    // Calculate due date (14 days from today)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)
    
    const invoice = await Invoice.create({
      invoiceNumber,
      clientId: proposal.clientId,
      projectId: proposal.projectId,
      items: proposal.items,
      subtotal: proposal.subtotal,
      discountType: proposal.discountType,
      discountValue: proposal.discountValue,
      discount: proposal.discount,
      taxRate: proposal.taxRate,
      tax: proposal.tax,
      total: proposal.total,
      dueDate,
      status: 'draft',
      notes: `Generated automatically from signed proposal: ${proposal.proposalNumber}.\n\nTerms: ${proposal.notes || ''}`
    })
    
    await ActivityLog.create({
      action: 'accepted proposal',
      entityType: 'proposal',
      entityId: proposal._id,
      entityName: proposal.proposalNumber,
      userId: req.user._id,
    })
    
    await ActivityLog.create({
      action: 'auto-generated invoice from proposal',
      entityType: 'invoice',
      entityId: invoice._id,
      entityName: invoice.invoiceNumber,
      userId: req.user._id,
    })
    
    res.json({ message: 'Proposal accepted & Invoice generated', proposal: enrichProposal(proposal), invoice })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST reject proposal
router.post('/:id/reject', async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' })
    
    if (req.user.role === 'client' && proposal.clientId.toString() !== req.user.clientId?.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }
    
    proposal.status = 'rejected'
    await proposal.save()
    
    await ActivityLog.create({
      action: 'rejected proposal',
      entityType: 'proposal',
      entityId: proposal._id,
      entityName: proposal.proposalNumber,
      userId: req.user._id,
    })
    
    res.json({ message: 'Proposal rejected', proposal: enrichProposal(proposal) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE archive proposal
router.delete('/:id', agencyOnly, async (req, res) => {
  try {
    const proposal = await Proposal.findByIdAndDelete(req.params.id)
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' })
    
    await ActivityLog.create({
      action: 'deleted proposal',
      entityType: 'proposal',
      entityId: proposal._id,
      entityName: proposal.proposalNumber,
      userId: req.user._id,
    })
    res.json({ message: 'Proposal deleted successfully' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
