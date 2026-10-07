import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'

import { toast } from 'sonner'

import { GreenApiError, sendMessage as apiSendMessage } from '@/api/greenApi'
import { useNotificationPolling, type PollingStatus } from '@/hooks/useNotificationPolling'
import type { ParsedMessage } from '@/lib/notifications'
import { loadJson, saveJson } from '@/lib/storage'
import type { Credentials } from '@/types/greenApi'

import { chatsReducer, createInitialState, type Chat, type ChatsState } from './chats'

interface ChatStoreValue {
  chats: Chat[]
  activeChat: Chat | null
  pollingStatus: PollingStatus
  createChat: (chat: { chatId: string; phone?: string; username?: string }) => void
  selectChat: (chatId: string | null) => void
  sendMessage: (chatId: string, text: string) => Promise<void>
  retryMessage: (chatId: string, localId: string) => Promise<void>
}

const ChatStoreContext = createContext<ChatStoreValue | null>(null)

const storageKey = (idInstance: string) => `greenapi-chat:chats:${idInstance}`

function loadState(idInstance: string): ChatsState {
  const saved = loadJson<ChatsState>(storageKey(idInstance))
  if (!saved) return createInitialState()
  // Messages that were in flight when the page closed are unknown now.
  // Chats keyed by "phone@c.us" come from an older version: Telegram drops sends to them.
  const chats = saved.chats.filter((chat) => !chat.id.endsWith('@c.us')).map((chat) => ({
    ...chat,
    messages: chat.messages.map((m) => (m.status === 'sending' ? { ...m, status: 'failed' as const } : m)),
  }))
  return { ...saved, chats, activeChatId: null }
}

export function ChatStoreProvider({ credentials, children }: { credentials: Credentials; children: ReactNode }) {
  const [state, dispatch] = useReducer(chatsReducer, credentials.idInstance, loadState)

  useEffect(() => {
    saveJson(storageKey(credentials.idInstance), state)
  }, [credentials.idInstance, state])

  const onMessage = useCallback((message: ParsedMessage) => dispatch({ type: 'received', message }), [])
  const pollingStatus = useNotificationPolling(credentials, onMessage)

  const deliver = useCallback(
    async (chatId: string, localId: string, text: string) => {
      try {
        const { idMessage } = await apiSendMessage(credentials, chatId, text)
        dispatch({ type: 'sendSucceeded', chatId, localId, idMessage })
      } catch (error) {
        dispatch({ type: 'sendFailed', chatId, localId })
        toast.error(error instanceof GreenApiError ? error.message : 'Сообщение не отправлено')
      }
    },
    [credentials],
  )

  const sendMessage = useCallback(
    (chatId: string, text: string) => {
      const localId = `local-${crypto.randomUUID()}`
      dispatch({ type: 'sendStarted', chatId, localId, text })
      return deliver(chatId, localId, text)
    },
    [deliver],
  )

  const retryMessage = useCallback(
    (chatId: string, localId: string) => {
      const message = state.chats.find((c) => c.id === chatId)?.messages.find((m) => m.id === localId)
      if (!message) return Promise.resolve()
      dispatch({ type: 'retry', chatId, localId })
      return deliver(chatId, localId, message.text)
    },
    [deliver, state.chats],
  )

  const value = useMemo<ChatStoreValue>(() => {
    const chats = [...state.chats].sort((a, b) => b.updatedAt - a.updatedAt)
    return {
      chats,
      activeChat: chats.find((c) => c.id === state.activeChatId) ?? null,
      pollingStatus,
      createChat: (chat) => dispatch({ type: 'createChat', ...chat }),
      selectChat: (chatId) => dispatch({ type: 'selectChat', chatId }),
      sendMessage,
      retryMessage,
    }
  }, [state, pollingStatus, sendMessage, retryMessage])

  return <ChatStoreContext.Provider value={value}>{children}</ChatStoreContext.Provider>
}

export function useChatStore() {
  const context = useContext(ChatStoreContext)
  if (!context) throw new Error('useChatStore must be used inside ChatStoreProvider')
  return context
}
