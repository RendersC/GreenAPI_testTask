import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Chat } from '@/store/chats'

import { chatTitle, formatDayLabel, formatListTime, initials } from '../format'
import { parseNotification } from '../notifications'
import { formatPhone, isValidPhone, normalizePhone } from '../phone'

describe('phone', () => {
  it('normalizes 8-prefixed numbers and strips formatting', () => {
    expect(normalizePhone('8 (900) 123-45-67')).toBe('79001234567')
    expect(normalizePhone('+7 900 123 45 67')).toBe('79001234567')
    expect(normalizePhone('+44 20 7946 0958')).toBe('442079460958')
  })

  it('validates length', () => {
    expect(isValidPhone('79001234567')).toBe(true)
    expect(isValidPhone('123')).toBe(false)
    expect(isValidPhone('1234567890123456')).toBe(false)
  })

  it('formats Russian/Kazakh numbers and leaves others international', () => {
    expect(formatPhone('77055205316')).toBe('+7 705 520-53-16')
    expect(formatPhone('442079460958')).toBe('+442079460958')
  })
})

describe('format', () => {
  afterEach(() => vi.useRealTimers())

  const chat = (patch: Partial<Chat>): Chat => ({ id: '1', aliases: [], messages: [], unread: 0, updatedAt: 0, ...patch })

  it('picks the best available chat title', () => {
    expect(chatTitle(chat({ title: 'Вася', username: 'vasya', phone: '79001234567' }))).toBe('Вася')
    expect(chatTitle(chat({ username: 'vasya', phone: '79001234567' }))).toBe('@vasya')
    expect(chatTitle(chat({ phone: '79001234567' }))).toBe('+7 900 123-45-67')
    expect(chatTitle(chat({}))).toBe('1')
  })

  it('builds avatar initials', () => {
    expect(initials('Иван Петров')).toBe('ИП')
    expect(initials('@durov')).toBe('D')
    expect(initials('🙂')).toBe('#')
  })

  it('labels days relative to today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 7, 15, 0))
    expect(formatDayLabel(new Date(2026, 9, 7, 9, 0).getTime())).toBe('Сегодня')
    expect(formatDayLabel(new Date(2026, 9, 6, 23, 0).getTime())).toBe('Вчера')
    expect(formatDayLabel(new Date(2026, 8, 1).getTime())).toBe('1 сентября')
    expect(formatListTime(new Date(2026, 9, 7, 9, 5).getTime())).toBe('09:05')
    expect(formatListTime(new Date(2026, 9, 1).getTime())).toBe('01.10.26')
  })
})

describe('parseNotification', () => {
  const base = {
    timestamp: 1,
    idMessage: 'x',
    senderData: { chatId: '1', sender: '1', chatType: 'user', senderName: 'Вася', senderPhoneNumber: 79001234567 },
  }

  it('extracts incoming text messages', () => {
    const parsed = parseNotification({
      ...base,
      typeWebhook: 'incomingMessageReceived',
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'hi' } },
    })
    expect(parsed).toEqual({
      direction: 'in',
      chatId: '1',
      chatType: 'user',
      chatName: 'Вася',
      phone: '79001234567',
      idMessage: 'x',
      text: 'hi',
      timestamp: 1000,
    })
  })

  it('supports extended text and outgoing API messages', () => {
    const parsed = parseNotification({
      ...base,
      typeWebhook: 'outgoingAPIMessageReceived',
      messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'link' } },
    })
    // Outgoing notifications describe the recipient chat; the phone belongs to us.
    expect(parsed).toMatchObject({ direction: 'out', text: 'link', phone: undefined })
  })

  it('ignores non-text messages and service notifications', () => {
    expect(parseNotification({ typeWebhook: 'stateInstanceChanged', timestamp: 1 })).toBeNull()
    expect(
      parseNotification({ ...base, typeWebhook: 'incomingMessageReceived', messageData: { typeMessage: 'imageMessage' } }),
    ).toBeNull()
  })
})
