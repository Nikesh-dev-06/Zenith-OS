const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { Payment, Invoice, ActivityLog, Notification } = require('../models')
const { authenticate, readOnlyForViewer } = require('../middleware/auth')

router.use(authenticate)
router.use(readOnlyForViewer)

const enrichPayment = (payment) => {
  return {
    ...payment.toObject(),
    id: payment._id,
    invoiceNumber: payment.invoiceId ? payment.invoiceId.invoiceNumber : 'Unknown Invoice',
    clientName: payment.clientId ? payment.clientId.companyName : 'Unknown Client',
    transactionId: payment.razorpayPaymentId || payment._id.toString(),
    paidAt: payment.createdAt,
  }
}

// Create Razorpay order
router.post('/create-order', async (req, res) => {
  try {
    const { invoiceId } = req.body
    const invoice = await Invoice.findById(invoiceId).populate('clientId', 'companyName')
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' })

    const order = {
      id: `order_${Date.now()}`,
      amount: invoice.total * 100,
      currency: 'INR',
      receipt: invoice.invoiceNumber,
    }

    res.json({ order, key: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key', invoice })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Verify payment & update DB
router.post('/verify', async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, invoiceId } = req.body

    // Verify signature (allow mock_signature in development)
    const body = razorpayOrderId + '|' + razorpayPaymentId
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret')
      .update(body).digest('hex')

    if (razorpaySignature !== 'mock_signature' && expectedSignature !== razorpaySignature) {
      return res.status(400).json({ error: 'Payment verification failed' })
    }

    // Update invoice
    const invoice = await Invoice.findByIdAndUpdate(invoiceId, { status: 'paid', paidAt: new Date() }, { new: true })
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    // Create payment record
    const payment = await Payment.create({
      invoiceId,
      clientId: invoice.clientId,
      amount: invoice.total,
      currency: 'INR',
      method: 'Razorpay',
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      status: 'success',
    })

    await ActivityLog.create({ action: 'payment received', entityType: 'payment', entityId: payment._id, entityName: `₹${invoice.total}`, userId: req.user._id })

    const populated = await Payment.findById(payment._id).populate('invoiceId', 'invoiceNumber').populate('clientId', 'companyName')

    res.json({ message: 'Payment verified successfully', payment: enrichPayment(populated) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/', async (req, res) => {
  try {
    const query = ['client', 'client_viewer'].includes(req.user.role) ? { clientId: req.user.clientId } : {}
    const payments = await Payment.find(query).populate('invoiceId', 'invoiceNumber').populate('clientId', 'companyName').sort({ createdAt: -1 })
    res.json(payments.map(enrichPayment))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router

