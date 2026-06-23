const { ActivityLog } = require('../models')

exports.sendWhatsAppMessage = async ({ toPhone, message, userId }) => {
  console.log(`[MOCK WHATSAPP] Sending message to ${toPhone}: "${message}"`)
  
  if (userId) {
    await ActivityLog.create({
      action: 'sent whatsapp alert',
      entityType: 'notification',
      entityName: `WhatsApp alert to ${toPhone}`,
      userId,
      metadata: { toPhone, message }
    })
  }
  
  return { success: true, messageId: `wa_mock_${Math.random().toString(36).substring(2, 11)}` }
}
