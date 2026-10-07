import type { NotificationBody } from '@/types/greenApi'

export interface ParsedMessage {
  direction: 'in' | 'out'
  chatId: string
  chatType?: string
  chatName?: string
  phone?: string
  idMessage: string
  text: string
  timestamp: number
}

const INCOMING = 'incomingMessageReceived'
const OUTGOING = new Set(['outgoingMessageReceived', 'outgoingAPIMessageReceived'])

/** Extracts a text message from a GREEN-API notification; anything else yields null. */
export function parseNotification(body: NotificationBody): ParsedMessage | null {
  const { typeWebhook, senderData, messageData, idMessage } = body
  if (!senderData || !messageData || !idMessage) return null
  if (typeWebhook !== INCOMING && !OUTGOING.has(typeWebhook)) return null

  const text =
    messageData.typeMessage === 'textMessage'
      ? messageData.textMessageData?.textMessage
      : messageData.typeMessage === 'extendedTextMessage'
        ? messageData.extendedTextMessageData?.text
        : undefined
  if (text === undefined) return null

  const phone = senderData.senderPhoneNumber ? String(senderData.senderPhoneNumber) : undefined
  const incoming = typeWebhook === INCOMING

  return {
    direction: incoming ? 'in' : 'out',
    chatId: senderData.chatId,
    chatType: senderData.chatType,
    chatName: senderData.chatName || senderData.senderContactName || senderData.senderName,
    phone: incoming ? phone : undefined,
    idMessage,
    text,
    timestamp: body.timestamp * 1000,
  }
}
