import { createContext, useContext } from 'react'

import type { PollingStatus } from '@/hooks/useNotificationPolling'

import type { Chat } from './chats'

export interface ChatStoreValue {
  chats: Chat[]
  activeChat: Chat | null
  pollingStatus: PollingStatus
  createChat: (chat: { chatId: string; phone?: string; username?: string }) => void
  selectChat: (chatId: string | null) => void
  sendMessage: (chatId: string, text: string) => Promise<void>
  retryMessage: (chatId: string, localId: string) => Promise<void>
}

export const ChatStoreContext = createContext<ChatStoreValue | null>(null)

export function useChatStore() {
  const context = useContext(ChatStoreContext)
  if (!context) throw new Error('useChatStore must be used inside ChatStoreProvider')
  return context
}
