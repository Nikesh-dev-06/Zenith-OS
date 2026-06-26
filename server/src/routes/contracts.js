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

// POST Create DocuSign envelope session for SOW Contract
router.post('/:id/docusign/create-envelope', async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
    if (!contract) return res.status(404).json({ error: 'Contract not found' })

    const clientId = process.env.DOCUSIGN_INTEGRATION_KEY
    const hasKeys = !!clientId

    const redirectUrl = `http://localhost:5173/portal/contracts?verify_external=true&contract_id=${contract._id}&provider=docusign&signer=${encodeURIComponent(req.user.name)}`
    
    if (!hasKeys) {
      console.log(`[MOCK DOCUSIGN] Creating DocuSign envelope for Contract: ${contract.contractNumber}`)
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

// POST Create Zoho Sign session for SOW Contract
router.post('/:id/zohosign/create-envelope', async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
    if (!contract) return res.status(404).json({ error: 'Contract not found' })

    const clientId = process.env.ZOHOSIGN_CLIENT_ID
    const hasKeys = !!clientId

    const redirectUrl = `http://localhost:5173/portal/contracts?verify_external=true&contract_id=${contract._id}&provider=zohosign&signer=${encodeURIComponent(req.user.name)}`

    if (!hasKeys) {
      console.log(`[MOCK ZOHOSIGN] Creating Zoho Sign envelope for Contract: ${contract.contractNumber}`)
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

// POST Verification callback for contracts SOW
router.post('/:id/external-callback', async (req, res) => {
  try {
    const { provider, signerName } = req.body
    const contract = await Contract.findById(req.params.id)
    if (!contract) return res.status(404).json({ error: 'Contract not found' })

    contract.status = 'signed'
    contract.signerName = signerName || req.user.name || 'Client'
    contract.signatureText = provider === 'docusign' ? 'DS' : 'ZS'
    contract.signatureDrawn = `${provider.toUpperCase()}:signed_${Date.now()}`
    contract.signedAt = new Date()
    await contract.save()

    await ActivityLog.create({
      action: `signed contract via ${provider}`,
      entityType: 'contract',
      entityId: contract._id,
      entityName: contract.contractNumber,
      userId: req.user._id,
    })

    res.json({ message: 'Contract signed via external integration successfully', contract })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
