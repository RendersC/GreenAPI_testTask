// Based on "Chat Bubble" by @jakobhoeg from 21st.dev: https://21st.dev/@jakobhoeg/components/chat-bubble
import * as React from "react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

type Variant = "sent" | "received"

interface ChatBubbleProps {
  variant?: Variant
  className?: string
  children: React.ReactNode
}

export function ChatBubble({ variant = "received", className, children }: ChatBubbleProps) {
  return (
    <div
      data-variant={variant}
      className={cn(
        "flex items-end gap-2",
        variant === "sent" ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface ChatBubbleMessageProps {
  variant?: Variant
  className?: string
  children?: React.ReactNode
}

export function ChatBubbleMessage({ variant = "received", className, children }: ChatBubbleMessageProps) {
  return (
    <div
      className={cn(
        "max-w-[min(80%,36rem)] rounded-2xl px-3 py-1.5 text-sm shadow-xs",
        variant === "sent"
          ? "rounded-br-md bg-bubble-out text-bubble-out-foreground"
          : "rounded-bl-md bg-bubble-in text-foreground",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface ChatBubbleAvatarProps {
  fallback?: string
  className?: string
}

export function ChatBubbleAvatar({ fallback = "?", className }: ChatBubbleAvatarProps) {
  return (
    <Avatar className={cn("size-8", className)}>
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  )
}
