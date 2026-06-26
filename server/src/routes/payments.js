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
    if (['client', 'client_viewer'].includes(req.user.role) && invoice.clientId._id.toString() !== req.user.clientId?.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' })

    const order = {
      id: `order_${Date.now()}`,
      amount: invoice.total * 100,
      currency: 'INR',
      receipt: invoice.invoiceNumber,
    }

    // Create pending Payment record in DB
    await Payment.create({
      invoiceId,
      clientId: invoice.clientId._id,
      amount: invoice.total,
      currency: 'INR',
      method: 'Razorpay',
      razorpayOrderId: order.id,
      status: 'pending',
    })

    res.json({ order, key: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key', invoice })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Verify payment & update DB
router.post('/verify', async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, invoiceId } = req.body

    const invoice = await Invoice.findById(invoiceId)
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (['client', 'client_viewer'].includes(req.user.role) && invoice.clientId.toString() !== req.user.clientId?.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Verify signature (allow mock_signature in development)
    const body = razorpayOrderId + '|' + razorpayPaymentId
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret')
      .update(body).digest('hex')

    if (razorpaySignature !== 'mock_signature' && expectedSignature !== razorpaySignature) {
      await Payment.findOneAndUpdate(
        { razorpayOrderId },
        { status: 'failed', razorpayPaymentId, razorpaySignature },
        { new: true }
      )
      return res.status(400).json({ error: 'Payment verification failed' })
    }

    // Update invoice
    invoice.status = 'paid'
    invoice.paidAt = new Date()
    await invoice.save()

    // Find and update pending payment
    let payment = await Payment.findOne({ razorpayOrderId })
    if (payment) {
      payment.status = 'success'
      payment.razorpayPaymentId = razorpayPaymentId
      payment.razorpaySignature = razorpaySignature
      await payment.save()
    } else {
      payment = await Payment.create({
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
    }

    await ActivityLog.create({ action: 'payment received', entityType: 'payment', entityId: payment._id, entityName: `₹${invoice.total}`, userId: req.user._id })

    const populated = await Payment.findById(payment._id).populate('invoiceId', 'invoiceNumber').populate('clientId', 'companyName')

    res.json({ message: 'Payment verified successfully', payment: enrichPayment(populated) })
  } catch (err) {
    if (req.body.razorpayOrderId) {
      await Payment.findOneAndUpdate({ razorpayOrderId: req.body.razorpayOrderId }, { status: 'failed' })
    }
    res.status(500).json({ error: err.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const query = ['client', 'client_viewer'].includes(req.user.role) ? { clientId: req.user.clientId } : {}
    const payments = await Payment.find(query).populate('invoiceId', 'invoiceNumber').populate('clientId', 'companyName').sort({ createdAt: -1 })
    res.json(payments.map(enrichPayment))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// --- PayPal Integration Routes ---
const axios = require('axios')

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  const isLive = process.env.PAYPAL_MODE === 'live'
  const baseUrl = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
  
  if (!clientId || !clientSecret) {
    return null // Return null to trigger mock fallback mode if credentials are empty
  }
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await axios.post(`${baseUrl}/v1/oauth2/token`, 'grant_type=client_credentials', {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })
  return { token: res.data.access_token, baseUrl }
}

// Create PayPal order
router.post('/paypal/create-order', async (req, res) => {
  try {
    const { invoiceId } = req.body
    const invoice = await Invoice.findById(invoiceId).populate('clientId', 'companyName')
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (['client', 'client_viewer'].includes(req.user.role) && invoice.clientId._id.toString() !== req.user.clientId?.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' })

    const paypalClient = await getPayPalAccessToken()
    
    if (!paypalClient) {
      // Mock Sandbox Mode if credentials are not configured in .env
      console.log(`[MOCK PAYPAL] Creating mock order for Invoice ${invoice.invoiceNumber} (Amt: ${invoice.total})`)
      const mockOrder = {
        id: `pp_order_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        status: 'CREATED'
      }

      // Create pending Payment record in DB for mock order
      await Payment.create({
        invoiceId,
        clientId: invoice.clientId._id,
        amount: invoice.total,
        currency: invoice.currency || 'USD',
        method: 'PayPal',
        razorpayOrderId: mockOrder.id,
        status: 'pending',
      })

      return res.json({ order: mockOrder, isMock: true })
    }

    const { token, baseUrl } = paypalClient
    const response = await axios.post(`${baseUrl}/v2/checkout/orders`, {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: invoice._id.toString(),
        amount: {
          currency_code: invoice.currency || 'USD',
          value: invoice.total.toFixed(2)
        },
        description: `ZenithOS Invoice ${invoice.invoiceNumber}`
      }]
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    // Create pending Payment record in DB for real order
    await Payment.create({
      invoiceId,
      clientId: invoice.clientId._id,
      amount: invoice.total,
      currency: invoice.currency || 'USD',
      method: 'PayPal',
      razorpayOrderId: response.data.id,
      status: 'pending',
    })

    res.json({ order: response.data, isMock: false })
  } catch (err) {
    console.error('PayPal Order Create Error:', err.response?.data || err.message)
    res.status(500).json({ error: err.response?.data?.message || err.message })
  }
})

// Capture PayPal payment
router.post('/paypal/capture-order', async (req, res) => {
  try {
    const { paypalOrderId, invoiceId, isMock } = req.body
    const invoice = await Invoice.findById(invoiceId)
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    if (['client', 'client_viewer'].includes(req.user.role) && invoice.clientId.toString() !== req.user.clientId?.toString()) {
      return res.status(403).json({ error: 'Access denied' })
    }

    let captureResult = {}
    if (isMock || !process.env.PAYPAL_CLIENT_ID) {
      // Mock successful capture in development
      console.log(`[MOCK PAYPAL] Capturing mock order ${paypalOrderId} for Invoice ${invoice.invoiceNumber}`)
      captureResult = { status: 'COMPLETED', id: `pp_capture_${Date.now()}` }
    } else {
      const paypalClient = await getPayPalAccessToken()
      if (!paypalClient) return res.status(500).json({ error: 'PayPal config mismatch' })

      const { token, baseUrl } = paypalClient
      const response = await axios.post(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      captureResult = response.data
    }

    if (captureResult.status === 'COMPLETED') {
      invoice.status = 'paid'
      invoice.paidAt = new Date()
      await invoice.save()

      // Find and update pending payment
      let payment = await Payment.findOne({ razorpayOrderId: paypalOrderId })
      if (payment) {
        payment.status = 'success'
        payment.razorpayPaymentId = captureResult.id
        payment.metadata = { paypalOrderId, captureId: captureResult.id }
        await payment.save()
      } else {
        payment = await Payment.create({
          invoiceId,
          clientId: invoice.clientId,
          amount: invoice.total,
          currency: invoice.currency || 'USD',
          method: 'PayPal',
          status: 'success',
          razorpayPaymentId: captureResult.id,
          metadata: { paypalOrderId, captureId: captureResult.id }
        })
      }

      await ActivityLog.create({
        action: 'payment received',
        entityType: 'payment',
        entityId: payment._id,
        entityName: `${invoice.currency || 'USD'} ${invoice.total}`,
        userId: req.user._id
      })

      const populated = await Payment.findById(payment._id).populate('invoiceId', 'invoiceNumber').populate('clientId', 'companyName')

      res.json({ message: 'PayPal payment verified and invoice updated successfully', payment: enrichPayment(populated) })
    } else {
      await Payment.findOneAndUpdate({ razorpayOrderId: paypalOrderId }, { status: 'failed' })
      res.status(400).json({ error: `PayPal order not completed. Status: ${captureResult.status}` })
    }
  } catch (err) {
    if (req.body.paypalOrderId) {
      await Payment.findOneAndUpdate({ razorpayOrderId: req.body.paypalOrderId }, { status: 'failed' })
    }
    console.error('PayPal Capture Error:', err.response?.data || err.message)
    res.status(500).json({ error: err.response?.data?.message || err.message })
  }
})

// Mark payment as failed
router.post('/mark-failed', async (req, res) => {
  try {
    const { orderId } = req.body
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: orderId },
      { status: 'failed' },
      { new: true }
    )
    res.json({ message: 'Payment marked as failed', payment })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

