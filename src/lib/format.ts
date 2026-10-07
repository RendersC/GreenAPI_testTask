import type { Chat } from '@/store/chats'

import { formatPhone } from './phone'

const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const shortDateFormat = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })

function startOfDay(timestamp: number) {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function formatTime(timestamp: number) {
  return timeFormat.format(timestamp)
}

export function formatDayLabel(timestamp: number) {
  const diffDays = Math.round((startOfDay(Date.now()) - startOfDay(timestamp)) / 86_400_000)
  if (diffDays === 0) return 'Сегодня'
  if (diffDays === 1) return 'Вчера'
  return dayFormat.format(timestamp)
}

/** Time for today, otherwise a short date, like chat lists in messengers. */
export function formatListTime(timestamp: number) {
  return startOfDay(timestamp) === startOfDay(Date.now()) ? formatTime(timestamp) : shortDateFormat.format(timestamp)
}

export function isSameDay(a: number, b: number) {
  return startOfDay(a) === startOfDay(b)
}

export function chatTitle(chat: Chat) {
  return chat.title || (chat.phone ? formatPhone(chat.phone) : chat.id)
}

export function initials(name: string) {
  const letters = name
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
  return letters.toUpperCase() || '#'
}
