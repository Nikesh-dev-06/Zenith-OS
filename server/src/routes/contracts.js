const express = require('express')
const router = express.Router()
const { Contract, Client, ActivityLog } = require('../models')
const { authenticate, agencyOnly, readOnlyForViewer } = require('../middleware/auth')

router.use(authenticate)
router.use(readOnlyForViewer)

const enrichContract = (contract) => {
  return {
    ...contract.toObject(),
    id: contract._id,
    clientName: contract.clientId ? contract.clientId.companyName : 'Unknown Client',
    projectName: contract.projectId ? contract.projectId.name : 'Unknown Project',
  }
}

// GET contracts list
router.get('/', async (req, res) => {
  try {
    const query = {}
    if (['client', 'client_viewer'].includes(req.user.role)) {
      query.clientId = req.user.clientId
    }
    const contracts = await Contract.find(query)
      .populate('clientId', 'companyName email')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
    res.json(contracts.map(enrichContract))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST create contract SOW
router.post('/', agencyOnly, async (req, res) => {
  try {
    const count = await Contract.countDocuments()
    const contractNumber = `SOW-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`
    
    const contract = await Contract.create({
      ...req.body,
      contractNumber,
      status: 'draft',
    })
    
    await ActivityLog.create({
      action: 'created contract',
      entityType: 'contract',
      entityId: contract._id,
      entityName: contractNumber,
      userId: req.user._id,
    })
    
    const populated = await Contract.findById(contract._id).populate('clientId').populate('projectId')
    res.status(201).json(enrichContract(populated))
  } catch (err) { res.status(400).json({ error: err.message }) }
})

// GET contract details
router.get('/:id', async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('clientId')
      .populate('projectId')
    if (!contract) return res.status(404).json({ error: 'Contract not found' })
    
    if (req.user.role === 'client' && contract.clientId._id.toString() !== req.user.clientId?.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }
    
    res.json(enrichContract(contract))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT edit contract
router.put('/:id', agencyOnly, async (req, res) => {
  try {
    const contract = await Contract.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!contract) return res.status(404).json({ error: 'Contract not found' })
    
    await ActivityLog.create({
      action: 'updated contract',
      entityType: 'contract',
      entityId: contract._id,
      entityName: contract.contractNumber,
      userId: req.user._id,
    })
    
    const populated = await Contract.findById(contract._id).populate('clientId').populate('projectId')
    res.json(enrichContract(populated))
  } catch (err) { res.status(400).json({ error: err.message }) }
})

// POST client sign SOW Contract
router.post('/:id/sign', async (req, res) => {
  try {
    const { signatureText, signatureDrawn, signerName } = req.body
    if (!signatureText || !signerName) {
      return res.status(400).json({ error: 'Signature and signer name are required' })
    }
    
    const contract = await Contract.findById(req.params.id)
    if (!contract) return res.status(404).json({ error: 'Contract not found' })
    
    if (req.user.role === 'client' && contract.clientId.toString() !== req.user.clientId?.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }
    
    contract.status = 'signed'
    contract.signatureText = signatureText
    contract.signatureDrawn = signatureDrawn || `FONT:font-1`
    contract.signerName = signerName
    contract.signedAt = new Date()
    await contract.save()
    
    await ActivityLog.create({
      action: 'signed contract',
      entityType: 'contract',
      entityId: contract._id,
      entityName: contract.contractNumber,
      userId: req.user._id,
    })
    
    res.json({ message: 'Contract signed successfully', contract: enrichContract(contract) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE archive/delete contract
router.delete('/:id', agencyOnly, async (req, res) => {
  try {
    const contract = await Contract.findByIdAndDelete(req.params.id)
    if (!contract) return res.status(404).json({ error: 'Contract not found' })
    
    await ActivityLog.create({
      action: 'deleted contract',
      entityType: 'contract',
      entityId: contract._id,
      entityName: contract.contractNumber,
      userId: req.user._id,
    })
    res.json({ message: 'Contract deleted successfully' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
