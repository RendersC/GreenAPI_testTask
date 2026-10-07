import type { ParsedMessage } from '@/lib/notifications'

export type MessageStatus = 'sending' | 'sent' | 'failed'

export interface Message {
  /** Local id for optimistic messages, GREEN-API idMessage otherwise. */
  id: string
  idMessage?: string
  direction: 'in' | 'out'
  text: string
  timestamp: number
  status?: MessageStatus
}

export interface Chat {
  /** Telegram chatId used for sending (resolved via checkAccount). */
  id: string
  /** Other chatIds GREEN-API uses for the same person (e.g. Telegram user id). */
  aliases: string[]
  phone?: string
  username?: string
  title?: string
  messages: Message[]
  unread: number
  updatedAt: number
}

export interface ChatsState {
  chats: Chat[]
  activeChatId: string | null
  /** Unknown private chats are created only from messages newer than this. */
  since: number
}

export type ChatsAction =
  | { type: 'createChat'; chatId: string; phone?: string; username?: string }
  | { type: 'selectChat'; chatId: string | null }
  | { type: 'sendStarted'; chatId: string; localId: string; text: string }
  | { type: 'sendSucceeded'; chatId: string; localId: string; idMessage: string }
  | { type: 'sendFailed'; chatId: string; localId: string }
  | { type: 'retry'; chatId: string; localId: string }
  | { type: 'received'; message: ParsedMessage }

const BACKLOG_GRACE_MS = 60_000

export function createInitialState(): ChatsState {
  return { chats: [], activeChatId: null, since: Date.now() }
}

/** Prepares a state saved in a previous session for use. */
export function restoreState(saved: ChatsState): ChatsState {
  const chats = saved.chats
    // Chats keyed by "phone@c.us" come from an older version: Telegram silently drops sends to them.
    .filter((chat) => !chat.id.endsWith('@c.us'))
    .map((chat) => ({
      ...chat,
      // Whether in-flight messages reached GREEN-API before the page closed is unknown.
      messages: chat.messages.map((m) => (m.status === 'sending' ? { ...m, status: 'failed' as const } : m)),
    }))
  return { ...saved, chats, activeChatId: null }
}

function updateChat(state: ChatsState, chatId: string, fn: (chat: Chat) => Chat): ChatsState {
  return { ...state, chats: state.chats.map((chat) => (chat.id === chatId ? fn(chat) : chat)) }
}

function updateMessage(chat: Chat, localId: string, patch: Partial<Message>): Chat {
  return { ...chat, messages: chat.messages.map((m) => (m.id === localId ? { ...m, ...patch } : m)) }
}

function findChat(chats: Chat[], { chatId, phone, idMessage }: ParsedMessage): Chat | undefined {
  return (
    chats.find((c) => c.id === chatId || c.aliases.includes(chatId)) ??
    (phone ? chats.find((c) => c.phone === phone) : undefined) ??
    chats.find((c) => c.messages.some((m) => m.idMessage === idMessage))
  )
}

function applyReceived(state: ChatsState, message: ParsedMessage): ChatsState {
  const existing = findChat(state.chats, message)

  if (!existing) {
    const isPrivate = !message.chatType || message.chatType === 'user'
    // Webhook timestamps have second precision and come from another clock, hence the grace period.
    const isBacklog = message.timestamp < state.since - BACKLOG_GRACE_MS
    if (message.direction === 'out' || !isPrivate || isBacklog) return state
  }

  const chat: Chat = existing ?? {
    id: message.chatId,
    aliases: [],
    phone: message.phone,
    title: message.chatName,
    messages: [],
    unread: 0,
    updatedAt: message.timestamp,
  }

  const aliases =
    chat.id === message.chatId || chat.aliases.includes(message.chatId)
      ? chat.aliases
      : [...chat.aliases, message.chatId]

  const duplicate = chat.messages.some((m) => m.idMessage === message.idMessage)
  const isActive = state.activeChatId === chat.id

  const next: Chat = {
    ...chat,
    aliases,
    phone: chat.phone ?? message.phone,
    title: chat.title ?? (message.direction === 'in' ? message.chatName : undefined),
    messages: duplicate
      ? chat.messages
      : [
          ...chat.messages,
          {
            id: message.idMessage,
            idMessage: message.idMessage,
            direction: message.direction,
            text: message.text,
            timestamp: message.timestamp,
            status: message.direction === 'out' ? 'sent' : undefined,
          },
        ],
    unread: duplicate || isActive || message.direction === 'out' ? chat.unread : chat.unread + 1,
    updatedAt: duplicate ? chat.updatedAt : Math.max(chat.updatedAt, message.timestamp),
  }

  return {
    ...state,
    chats: existing ? state.chats.map((c) => (c.id === chat.id ? next : c)) : [next, ...state.chats],
  }
}

export function chatsReducer(state: ChatsState, action: ChatsAction): ChatsState {
  switch (action.type) {
    case 'createChat': {
      const { chatId, phone, username } = action
      const existing = state.chats.find((c) => c.id === chatId || c.aliases.includes(chatId))
      if (existing) {
        return {
          ...updateChat(state, existing.id, (c) => ({ ...c, phone: c.phone ?? phone, username: c.username ?? username })),
          activeChatId: existing.id,
        }
      }
      const chat: Chat = { id: chatId, aliases: [], phone, username, messages: [], unread: 0, updatedAt: Date.now() }
      return { ...state, chats: [chat, ...state.chats], activeChatId: chatId }
    }

    case 'selectChat':
      return action.chatId
        ? { ...updateChat(state, action.chatId, (c) => ({ ...c, unread: 0 })), activeChatId: action.chatId }
        : { ...state, activeChatId: null }

    case 'sendStarted':
      return updateChat(state, action.chatId, (chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          { id: action.localId, direction: 'out', text: action.text, timestamp: Date.now(), status: 'sending' },
        ],
        updatedAt: Date.now(),
      }))

    case 'sendSucceeded':
      return updateChat(state, action.chatId, (chat) => {
        // The outgoing webhook may already have delivered this message.
        const echoed = chat.messages.some((m) => m.idMessage === action.idMessage && m.id !== action.localId)
        return echoed
          ? { ...chat, messages: chat.messages.filter((m) => m.id !== action.localId) }
          : updateMessage(chat, action.localId, { idMessage: action.idMessage, status: 'sent' })
      })

    case 'sendFailed':
      return updateChat(state, action.chatId, (chat) => updateMessage(chat, action.localId, { status: 'failed' }))

    case 'retry':
      return updateChat(state, action.chatId, (chat) =>
        updateMessage(chat, action.localId, { status: 'sending', timestamp: Date.now() }),
      )

    case 'received':
      return applyReceived(state, action.message)
  }
}
