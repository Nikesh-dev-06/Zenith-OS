const express = require('express')
const router = express.Router()
const { Invoice, Client, ActivityLog, Notification, User } = require('../models')
const { authenticate, agencyOnly, readOnlyForViewer } = require('../middleware/auth')

router.use(authenticate)
router.use(readOnlyForViewer)

const generateInvoiceNumber = async (customDate = new Date()) => {
  const date = new Date(customDate)
  const month = date.getMonth()
  const year = date.getFullYear()
  
  let fyStart, fyEnd, fyCode
  if (month >= 3) {
    fyStart = new Date(year, 3, 1)
    fyEnd = new Date(year + 1, 2, 31, 23, 59, 59, 999)
    fyCode = `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`
  } else {
    fyStart = new Date(year - 1, 3, 1)
    fyEnd = new Date(year, 2, 31, 23, 59, 59, 999)
    fyCode = `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`
  }

  const count = await Invoice.countDocuments({
    createdAt: { $gte: fyStart, $lte: fyEnd }
  })
  return `INV/FY${fyCode}/${String(count + 1).padStart(3, '0')}`
}

const enrichInvoice = (invoice) => {
  return {
    ...invoice.toObject(),
    id: invoice._id,
    clientName: invoice.clientId ? invoice.clientId.companyName : 'Unknown Client',
    projectName: invoice.projectId ? invoice.projectId.name : 'Unknown Project',
  }
}

router.get('/', async (req, res) => {
  try {
    const { clientId, status, page = 1, limit = 20 } = req.query
    const query = {}
    if (['client', 'client_viewer'].includes(req.user.role)) query.clientId = req.user.clientId
    else if (clientId) query.clientId = clientId
    if (status && status !== 'all') query.status = status

    const [invoices, total] = await Promise.all([
      Invoice.find(query).populate('clientId', 'companyName email').populate('projectId', 'name').skip((page - 1) * limit).limit(+limit).sort({ createdAt: -1 }),
      Invoice.countDocuments(query),
    ])
    res.json({ invoices: invoices.map(enrichInvoice), total })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', agencyOnly, async (req, res) => {
  try {
    const items = req.body.items || []
    const subtotal = items.reduce((s, i) => s + (i.amount || (i.quantity * i.rate)), 0)
    
    const discountType = req.body.discountType || 'percent'
    const discountValue = Number(req.body.discountValue) || 0
    let discount = 0
    if (discountType === 'percent') {
      discount = Math.round(subtotal * discountValue / 100)
    } else {
      discount = discountValue
    }

    const taxableAmount = Math.max(0, subtotal - discount)
    
    const isExport = req.body.isExport || false
    const placeOfSupply = req.body.placeOfSupply || 'Delhi'
    const isIntrastate = placeOfSupply === 'Delhi'
    const taxType = req.body.taxType || 'GST'
    
    let taxRate = Number(req.body.taxRate) ?? 18
    if (isExport || taxType === 'None') taxRate = 0

    let cgst = 0, sgst = 0, igst = 0
    let tax = 0
    
    if (taxRate > 0) {
      if (taxType === 'VAT') {
        tax = Math.round(taxableAmount * taxRate / 100)
        igst = tax
      } else { // default to 'GST'
        if (isIntrastate) {
          cgst = Math.round(taxableAmount * (taxRate / 2) / 100)
          sgst = Math.round(taxableAmount * (taxRate / 2) / 100)
        } else {
          igst = Math.round(taxableAmount * taxRate / 100)
        }
        tax = cgst + sgst + igst
      }
    }

    const rcm = req.body.rcm || false
    const tdsRate = Number(req.body.tdsRate) || 0
    const tdsAmount = Math.round(taxableAmount * tdsRate / 100)

    const rawTotal = rcm ? taxableAmount : (taxableAmount + tax)
    const total = Math.round(rawTotal)
    const roundingAdjustment = Number((total - rawTotal).toFixed(2))

    const invoiceDate = req.body.createdAt ? new Date(req.body.createdAt) : new Date()
    const number = req.body.invoiceNumber || (await generateInvoiceNumber(invoiceDate))
    
    const invoiceData = {
      ...req.body,
      invoiceNumber: number,
      subtotal,
      discountType,
      discountValue,
      discount,
      taxRate,
      tax,
      total,
      cgst,
      sgst,
      igst,
      placeOfSupply,
      isIntrastate,
      rcm,
      tdsRate,
      tdsAmount,
      isExport,
      roundingAdjustment
    }

    if (req.body.createdAt) {
      invoiceData.createdAt = invoiceDate
    }

    const invoice = await Invoice.create(invoiceData)

    await ActivityLog.create({ action: 'created invoice', entityType: 'invoice', entityId: invoice._id, entityName: number, userId: req.user._id })
    const populated = await Invoice.findById(invoice._id).populate('clientId', 'companyName email').populate('projectId', 'name')
    res.status(201).json(enrichInvoice(populated))
  } catch (err) { res.status(400).json({ error: err.message }) }
})

router.post('/:id/send', agencyOnly, async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, { status: 'sent' }, { new: true }).populate('clientId', 'companyName email').populate('projectId', 'name')
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    // In production: send email via Resend
    await ActivityLog.create({ action: 'sent invoice', entityType: 'invoice', entityId: invoice._id, entityName: invoice.invoiceNumber, userId: req.user._id })
    res.json(enrichInvoice(invoice))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/gstr1-export', agencyOnly, async (req, res) => {
  try {
    const { from, to } = req.query
    const query = {}
    if (from || to) {
      query.createdAt = {}
      if (from) query.createdAt.$gte = new Date(from)
      if (to) query.createdAt.$lte = new Date(to)
    }

    const invoices = await Invoice.find(query).populate('clientId')
    
    let csv = 'GSTIN/UIN of Recipient,Receiver Name,Invoice Number,Invoice Date,Invoice Value,Place Of Supply,Reverse Charge,Invoice Type,Rate,Taxable Value,Integrated Tax Amount,Central Tax Amount,State/UT Tax Amount\n'
    
    for (const inv of invoices) {
      const gstin = inv.clientId?.gstin || ''
      const name = (inv.clientId?.companyName || 'Walk-in Client').replace(/,/g, ' ')
      const num = inv.invoiceNumber
      const date = inv.createdAt.toISOString().split('T')[0]
      const val = inv.total
      const pos = inv.placeOfSupply || 'Delhi'
      const rcmStr = inv.rcm ? 'Y' : 'N'
      const type = inv.isExport ? 'Export' : (gstin ? 'Regular B2B' : 'B2C')
      
      const taxable = inv.subtotal - inv.discount
      const rate = inv.taxRate
      const igstAmt = inv.igst || 0
      const cgstAmt = inv.cgst || 0
      const sgstAmt = inv.sgst || 0
      
      csv += `${gstin},${name},${num},${date},${val},${pos},${rcmStr},${type},${rate},${taxable},${igstAmt},${cgstAmt},${sgstAmt}\n`
    }

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename=GSTR1_Export_${new Date().toISOString().split('T')[0]}.csv`)
    res.status(200).send(csv)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/fx-rates', async (req, res) => {
  try {
    res.json({
      base: 'INR',
      rates: {
        INR: 1,
        USD: 0.01202,
        EUR: 0.01108,
        GBP: 0.00945,
        AUD: 0.01815
      },
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('clientId').populate('projectId', 'name')
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (req.user.role === 'client' && invoice.clientId._id.toString() !== req.user.clientId?.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }
    res.json(enrichInvoice(invoice))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router

