import { describe, expect, it } from 'vitest'

import type { ParsedMessage } from '@/lib/notifications'

import { chatsReducer, restoreState, type ChatsState } from '../chats'

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
    state = chatsReducer({ ...empty(), since: 120_000 }, { type: 'received', message: incoming({ timestamp: 1000 }) })
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

  it('marks a failed send and recovers it on retry', () => {
    let state = chatsReducer(empty(), { type: 'createChat', chatId: '1' })
    state = chatsReducer(state, { type: 'sendStarted', chatId: '1', localId: 'l1', text: 'hi' })
    expect(state.chats[0].messages[0].status).toBe('sending')
    state = chatsReducer(state, { type: 'sendFailed', chatId: '1', localId: 'l1' })
    expect(state.chats[0].messages[0].status).toBe('failed')
    state = chatsReducer(state, { type: 'retry', chatId: '1', localId: 'l1' })
    expect(state.chats[0].messages[0].status).toBe('sending')
    state = chatsReducer(state, { type: 'sendSucceeded', chatId: '1', localId: 'l1', idMessage: 'out-1' })
    expect(state.chats[0].messages[0]).toMatchObject({ status: 'sent', idMessage: 'out-1' })
  })

  it('does not count unread messages in the open chat', () => {
    let state = chatsReducer(empty(), { type: 'createChat', chatId: '10000000' })
    state = chatsReducer(state, { type: 'received', message: incoming() })
    expect(state.chats[0].unread).toBe(0)

    state = chatsReducer(state, { type: 'selectChat', chatId: null })
    state = chatsReducer(state, { type: 'received', message: incoming({ idMessage: 'in-2' }) })
    expect(state.chats[0].unread).toBe(1)
  })

  it('keeps the title from incoming messages and the username from checkAccount', () => {
    let state = chatsReducer(empty(), { type: 'received', message: incoming() })
    state = chatsReducer(state, { type: 'createChat', chatId: '10000000', username: 'vasya' })
    expect(state.chats[0]).toMatchObject({ title: 'Вася', username: 'vasya', phone: '79001234567' })
  })

  it('ignores outgoing notifications for unknown chats', () => {
    const state = chatsReducer(empty(), { type: 'received', message: incoming({ direction: 'out' }) })
    expect(state.chats).toHaveLength(0)
  })
})

describe('restoreState', () => {
  it('fails in-flight messages, drops legacy phone chats and closes the active chat', () => {
    const restored = restoreState({
      since: 1,
      activeChatId: '1',
      chats: [
        {
          id: '1',
          aliases: [],
          unread: 0,
          updatedAt: 0,
          messages: [{ id: 'l1', direction: 'out', text: 'hi', timestamp: 0, status: 'sending' }],
        },
        { id: '79001234567@c.us', aliases: [], unread: 0, updatedAt: 0, messages: [] },
      ],
    })
    expect(restored.activeChatId).toBeNull()
    expect(restored.chats).toHaveLength(1)
    expect(restored.chats[0].messages[0].status).toBe('failed')
  })
})
