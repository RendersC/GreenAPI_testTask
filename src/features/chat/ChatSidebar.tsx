import { LogOutIcon, MessageSquarePlusIcon, SquarePenIcon } from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import type { PollingStatus } from '@/hooks/useNotificationPolling'
import { chatTitle, formatListTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store/chatStore'
import { useSession } from '@/store/session'

import { ChatAvatar } from './ChatAvatar'
import { NewChatDialog } from './NewChatDialog'

const STATUS: Record<PollingStatus, { label: string; className: string }> = {
  connecting: { label: 'Подключение…', className: 'bg-amber-500' },
  online: { label: 'В сети', className: 'bg-primary' },
  offline: { label: 'Нет соединения, переподключаемся…', className: 'bg-destructive' },
  unauthorized: { label: 'Неверные данные инстанса', className: 'bg-destructive' },
}

export function ChatSidebar({ className }: { className?: string }) {
  const { credentials, logout } = useSession()
  const { chats, activeChat, selectChat, pollingStatus } = useChatStore()
  const status = STATUS[pollingStatus]

  return (
    <aside className={cn('flex min-h-0 flex-col border-r bg-background', className)}>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">Чаты</h1>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground" title={status.label}>
            <span className={cn('size-1.5 shrink-0 rounded-full', status.className)} />
            {pollingStatus === 'online' ? `Инстанс ${credentials?.idInstance}` : status.label}
          </p>
        </div>
        <NewChatDialog
          trigger={
            <Button variant="ghost" size="icon" aria-label="Новый чат" title="Новый чат">
              <SquarePenIcon />
            </Button>
          }
        />
        <ThemeToggle />
        <Button variant="ghost" size="icon" aria-label="Выйти" title="Выйти" onClick={logout}>
          <LogOutIcon />
        </Button>
      </header>

      {chats.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <MessageSquarePlusIcon className="size-10 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">Чатов пока нет. Начните переписку по номеру телефона.</p>
          <NewChatDialog trigger={<Button>Новый чат</Button>} />
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto p-1.5">
          {chats.map((chat) => {
            const title = chatTitle(chat)
            const last = chat.messages.at(-1)
            const isActive = chat.id === activeChat?.id
            return (
              <li key={chat.id}>
                <button
                  type="button"
                  onClick={() => selectChat(chat.id)}
                  aria-current={isActive || undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                    isActive ? 'bg-primary/12' : 'hover:bg-muted',
                  )}
                >
                  <ChatAvatar chat={chat} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{title}</span>
                      {last && (
                        <span className="shrink-0 text-xs text-muted-foreground">{formatListTime(last.timestamp)}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-muted-foreground">
                        {last ? `${last.direction === 'out' ? 'Вы: ' : ''}${last.text}` : 'Нет сообщений'}
                      </span>
                      {chat.unread > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
