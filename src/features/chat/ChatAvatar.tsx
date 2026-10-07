import { UserIcon } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Chat } from '@/store/chats'

export function ChatAvatar({ chat, className }: { chat: Chat; className?: string }) {
  return (
    <Avatar className={cn('size-11', className)}>
      <AvatarFallback className="bg-primary/15 font-medium text-primary">
        {chat.title ? initials(chat.title) : <UserIcon className="size-1/2" />}
      </AvatarFallback>
    </Avatar>
  )
}
