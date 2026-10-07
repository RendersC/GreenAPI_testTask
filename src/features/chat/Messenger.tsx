import { useEffect } from 'react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { useChatStore } from '@/store/useChatStore'
import { useSession } from '@/store/useSession'

import { ChatSidebar } from './ChatSidebar'
import { ChatWindow } from './ChatWindow'

export function Messenger() {
  const { activeChat, pollingStatus } = useChatStore()
  const { logout } = useSession()

  useEffect(() => {
    if (pollingStatus !== 'unauthorized') return
    toast.error('Данные инстанса больше не действительны, войдите заново')
    logout()
  }, [pollingStatus, logout])

  // On narrow screens only one pane is visible: the list or the open chat.
  return (
    <div className="grid h-full md:grid-cols-[minmax(280px,360px)_1fr]">
      <ChatSidebar className={cn(activeChat && 'hidden md:flex')} />
      <ChatWindow className={cn(!activeChat && 'hidden md:flex')} />
    </div>
  )
}
