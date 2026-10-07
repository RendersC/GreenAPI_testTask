import { AlertCircleIcon, ArrowLeftIcon, CheckIcon, ClockIcon, MessagesSquareIcon, RotateCwIcon } from 'lucide-react'
import { Fragment, useLayoutEffect, useRef } from 'react'

import { MAX_MESSAGE_LENGTH } from '@/api/greenApi'
import { Button } from '@/components/ui/button'
import { ChatBubble, ChatBubbleMessage } from '@/components/ui/chat-bubble'
import { PromptInput } from '@/components/ui/prompt-input'
import { chatTitle, formatDayLabel, formatTime, isSameDay } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store/useChatStore'
import type { Chat, Message } from '@/store/chats'

import { ChatAvatar } from './ChatAvatar'

function MessageStatusIcon({ message }: { message: Message }) {
  if (message.direction === 'in') return null
  if (message.status === 'sending') return <ClockIcon aria-label="Отправляется" className="size-3" />
  if (message.status === 'failed') return <AlertCircleIcon aria-label="Не отправлено" className="size-3 text-destructive" />
  return <CheckIcon aria-label="Отправлено" className="size-3" />
}

function MessageList({ chat }: { chat: Chat }) {
  const { retryMessage } = useChatStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  // Opening a chat starts at the latest message.
  useLayoutEffect(() => {
    stickToBottom.current = true
  }, [chat.id])

  // Follow new messages unless the user scrolled up to read history.
  useLayoutEffect(() => {
    const el = containerRef.current
    const last = chat.messages.at(-1)
    if (el && (stickToBottom.current || last?.status === 'sending')) el.scrollTop = el.scrollHeight
  }, [chat.id, chat.messages])

  if (chat.messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="rounded-full bg-background/70 px-3 py-1 text-sm text-muted-foreground backdrop-blur">
          Сообщений пока нет. Напишите первым!
        </p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-label="Сообщения"
      className="flex-1 overflow-y-auto px-3 py-4 sm:px-6"
      onScroll={(e) => {
        const el = e.currentTarget
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      }}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-1">
        {chat.messages.map((message, index) => {
          const prev = chat.messages[index - 1]
          const showDay = !prev || !isSameDay(prev.timestamp, message.timestamp)
          const variant = message.direction === 'out' ? 'sent' : 'received'
          const grouped = prev && !showDay && prev.direction === message.direction

          return (
            <Fragment key={message.id}>
              {showDay && (
                <div className="sticky top-0 z-10 my-2 flex justify-center">
                  <span className="rounded-full bg-background/80 px-2.5 py-0.5 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur">
                    {formatDayLabel(message.timestamp)}
                  </span>
                </div>
              )}
              <ChatBubble variant={variant} className={cn(!grouped && 'mt-1.5')}>
                <ChatBubbleMessage variant={variant} className={cn(message.status === 'failed' && 'opacity-80')}>
                  <p className="break-words whitespace-pre-wrap">{message.text}</p>
                  <span className="float-right mt-1 ml-3 flex items-center gap-1 text-[11px] leading-none opacity-60 select-none">
                    {formatTime(message.timestamp)}
                    <MessageStatusIcon message={message} />
                  </span>
                </ChatBubbleMessage>
                {message.status === 'failed' && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label="Отправить повторно"
                    title="Отправить повторно"
                    onClick={() => retryMessage(chat.id, message.id)}
                  >
                    <RotateCwIcon />
                  </Button>
                )}
              </ChatBubble>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

export function ChatWindow({ className }: { className?: string }) {
  const { activeChat: chat, selectChat, sendMessage } = useChatStore()

  if (!chat) {
    return (
      <section className={cn('flex flex-col items-center justify-center gap-3 bg-chat p-6 text-center', className)}>
        <MessagesSquareIcon className="size-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Выберите чат или создайте новый</p>
      </section>
    )
  }

  const title = chatTitle(chat)
  // Show the phone under a name or @username; when the phone is the title itself, there is nothing to add.
  const phone = chat.phone ? formatPhone(chat.phone) : null
  const subtitle = phone && phone !== title ? phone : 'Telegram'

  return (
    <section className={cn('flex min-h-0 flex-col bg-chat', className)}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-2 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Назад к чатам"
          onClick={() => selectChat(null)}
        >
          <ArrowLeftIcon />
        </Button>
        <ChatAvatar chat={chat} className="size-9 text-sm" />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </header>

      <MessageList chat={chat} />

      <div className="shrink-0 px-3 pb-3 sm:px-6 sm:pb-4">
        <PromptInput
          key={chat.id}
          className="mx-auto max-w-3xl shadow-sm"
          placeholder="Сообщение"
          maxLength={MAX_MESSAGE_LENGTH}
          autoFocus
          onSubmit={(text) => sendMessage(chat.id, text)}
        />
      </div>
    </section>
  )
}
