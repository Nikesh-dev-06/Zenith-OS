const { WebhookSubscription, WebhookLog } = require('../models')

exports.triggerWebhook = async (event, payload) => {
  try {
    const subscriptions = await WebhookSubscription.find({ event, isActive: true })
    if (subscriptions.length === 0) return

    console.log(`[MOCK WEBHOOK] Triggering "${event}" for ${subscriptions.length} subscriptions`)

    for (const sub of subscriptions) {
      // Create a mock delivery log with a simulated successful response (or mock status)
      await WebhookLog.create({
        subscriptionId: sub._id,
        url: sub.url,
        event,
        payload,
        responseStatus: 200,
        responseBody: JSON.stringify({ success: true, message: 'Mock payload received successfully by Zapier/Make' })
      })
      console.log(`[MOCK WEBHOOK] Sent payload to ${sub.url}`)
    }
  } catch (err) {
    console.error('Failed to trigger webhooks:', err.message)
  }
}
