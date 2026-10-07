import { describe, expect, it } from 'vitest'

import { parseNotification, type ParsedMessage } from '@/lib/notifications'
import { normalizePhone, isValidPhone } from '@/lib/phone'

import { chatsReducer, type ChatsState } from '../chats'

const empty = (): ChatsState => ({ chats: [], activeChatId: null, since: 0 })

const incoming = (patch: Partial<ParsedMessage> = {}): ParsedMessage => ({
  direction: 'in',
  chatId: '10000000',
  chatType: 'user',
  chatName: 'Вася',
  phone: '79001234567',
  idMessage: 'in-1',
  text: 'Привет',
  timestamp: 1000,
  ...patch,
})

describe('phone', () => {
  it('normalizes 8-prefixed numbers and strips formatting', () => {
    expect(normalizePhone('8 (900) 123-45-67')).toBe('79001234567')
    expect(normalizePhone('+7 900 123 45 67')).toBe('79001234567')
    expect(isValidPhone('79001234567')).toBe(true)
    expect(isValidPhone('123')).toBe(false)
  })
})

describe('parseNotification', () => {
  it('extracts incoming text messages', () => {
    const parsed = parseNotification({
      typeWebhook: 'incomingMessageReceived',
      timestamp: 1,
      idMessage: 'x',
      senderData: { chatId: '1', sender: '1', chatType: 'user', senderPhoneNumber: 79001234567 },
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'hi' } },
    })
    expect(parsed).toMatchObject({ direction: 'in', chatId: '1', phone: '79001234567', text: 'hi', timestamp: 1000 })
  })

  it('ignores non-text messages and service notifications', () => {
    expect(parseNotification({ typeWebhook: 'stateInstanceChanged', timestamp: 1 })).toBeNull()
    expect(
      parseNotification({
        typeWebhook: 'incomingMessageReceived',
        timestamp: 1,
        idMessage: 'x',
        senderData: { chatId: '1', sender: '1' },
        messageData: { typeMessage: 'imageMessage' },
      }),
    ).toBeNull()
  })
})

describe('chatsReducer', () => {
  it('creates a chat for a resolved Telegram id and makes it active', () => {
    const state = chatsReducer(empty(), { type: 'createChat', chatId: '10000000', phone: '79001234567' })
    expect(state.chats).toHaveLength(1)
    expect(state.activeChatId).toBe('10000000')
  })

  it('puts a reply into the chat with the same Telegram id', () => {
    let state = chatsReducer(empty(), { type: 'createChat', chatId: '10000000', phone: '79001234567' })
    state = chatsReducer(state, { type: 'received', message: incoming({ phone: undefined }) })
    expect(state.chats).toHaveLength(1)
    expect(state.chats[0].messages.at(-1)?.text).toBe('Привет')
  })

  it('opens the existing chat instead of creating a duplicate', () => {
    let state = chatsReducer(empty(), { type: 'received', message: incoming() })
    state = chatsReducer(state, { type: 'createChat', chatId: '10000000', phone: '79001234567' })
    expect(state.chats).toHaveLength(1)
    expect(state.activeChatId).toBe('10000000')
  })

  it('falls back to the phone number when the reply comes from another chatId', () => {
    let state = chatsReducer(empty(), { type: 'createChat', chatId: '555', phone: '79001234567' })
    state = chatsReducer(state, { type: 'received', message: incoming() })
    expect(state.chats).toHaveLength(1)
    expect(state.chats[0].aliases).toContain('10000000')

    // Next reply without a phone number is matched through the alias.
    state = chatsReducer(state, { type: 'received', message: incoming({ idMessage: 'in-2', phone: undefined }) })
    expect(state.chats[0].messages).toHaveLength(2)
  })

  it('links a chat through the outgoing API webhook of a sent message', () => {
    let state = chatsReducer(empty(), { type: 'createChat', chatId: '555', phone: '79001234567' })
    state = chatsReducer(state, { type: 'sendStarted', chatId: '555', localId: 'l1', text: 'hi' })
    state = chatsReducer(state, { type: 'sendSucceeded', chatId: '555', localId: 'l1', idMessage: 'out-1' })
    state = chatsReducer(state, {
      type: 'received',
      message: incoming({ direction: 'out', idMessage: 'out-1', phone: undefined, text: 'hi' }),
    })
    expect(state.chats[0].aliases).toContain('10000000')
    expect(state.chats[0].messages).toHaveLength(1)
  })

  it('drops the optimistic copy when the webhook arrived before the send response', () => {
    let state = chatsReducer(empty(), { type: 'createChat', chatId: '10000000', phone: '79001234567' })
    state = chatsReducer(state, { type: 'sendStarted', chatId: '10000000', localId: 'l1', text: 'hi' })
    state = chatsReducer(state, {
      type: 'received',
      message: incoming({ direction: 'out', chatId: '10000000', idMessage: 'out-1', text: 'hi' }),
    })
    state = chatsReducer(state, { type: 'sendSucceeded', chatId: '10000000', localId: 'l1', idMessage: 'out-1' })
    expect(state.chats[0].messages).toHaveLength(1)
  })

  it('ignores group messages and backlog from before login', () => {
    let state = chatsReducer(empty(), { type: 'received', message: incoming({ chatType: 'supergroup', chatId: '-100' }) })
    expect(state.chats).toHaveLength(0)
    state = chatsReducer({ ...empty(), since: 5000 }, { type: 'received', message: incoming({ timestamp: 1000 }) })
    expect(state.chats).toHaveLength(0)
  })

  it('creates a chat for a new private incoming message and counts unread', () => {
    let state = chatsReducer(empty(), { type: 'received', message: incoming() })
    state = chatsReducer(state, { type: 'received', message: incoming() })
    expect(state.chats).toHaveLength(1)
    expect(state.chats[0].messages).toHaveLength(1)
    expect(state.chats[0].unread).toBe(1)
    state = chatsReducer(state, { type: 'selectChat', chatId: '10000000' })
    expect(state.chats[0].unread).toBe(0)
  })
})
