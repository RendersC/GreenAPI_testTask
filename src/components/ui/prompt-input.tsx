// Based on "Prompt Input" by @tinkerers-labs from 21st.dev: https://21st.dev/@tinkerers-labs/components/prompt-input
import * as React from "react"
import { ArrowUp } from "lucide-react"

import { cn } from "@/lib/utils"

export type PromptInputProps = Omit<React.HTMLAttributes<HTMLFormElement>, "onSubmit" | "children"> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  onSubmit?: (value: string) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  maxRows?: number
  maxLength?: number
  autoFocus?: boolean
  submitLabel?: string
}

const LINE_HEIGHT_FALLBACK = 20

export function PromptInput({
  value,
  defaultValue = "",
  onValueChange,
  onSubmit,
  placeholder = "Сообщение",
  label = "Сообщение",
  disabled = false,
  maxRows = 8,
  maxLength,
  autoFocus,
  submitLabel = "Отправить",
  className,
  ...formProps
}: PromptInputProps) {
  const fieldId = React.useId()
  const fieldRef = React.useRef<HTMLTextAreaElement>(null)
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue)

  const text = value ?? uncontrolled
  const canSend = text.trim().length > 0 && !disabled

  const setText = (next: string) => {
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }

  // Grow with the content up to maxRows, then scroll inside the field.
  React.useEffect(() => {
    const field = fieldRef.current
    if (!field) return

    field.style.height = "auto"

    const styles = window.getComputedStyle(field)
    const lineHeight = Number.parseFloat(styles.lineHeight) || LINE_HEIGHT_FALLBACK
    const padding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
    const max = lineHeight * maxRows + padding

    field.style.height = `${Math.min(field.scrollHeight, max)}px`
    field.style.overflowY = field.scrollHeight > max ? "auto" : "hidden"
  }, [text, maxRows])

  const submit = () => {
    if (!canSend) return
    onSubmit?.(text.trim())
    setText("")
    fieldRef.current?.focus()
  }

  return (
    <form
      data-slot="prompt-input"
      className={cn(
        "flex items-end gap-2 rounded-[calc(var(--radius)+0.6rem)] border border-border bg-card p-1.5 pl-1 transition-[box-shadow,border-color] duration-150 focus-within:ring-2 focus-within:ring-ring/40 motion-reduce:transition-none",
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      {...formProps}
    >
      <label className="sr-only" htmlFor={fieldId}>
        {label}
      </label>
      <textarea
        ref={fieldRef}
        id={fieldId}
        data-slot="prompt-input-field"
        rows={1}
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className="block w-full resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-60"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          // Enter sends, Shift+Enter starts a new line. During composition of
          // an IME candidate Enter belongs to the IME, never to the form.
          if (event.key !== "Enter" || event.shiftKey) return
          if (event.nativeEvent.isComposing) return

          event.preventDefault()
          submit()
        }}
      />

      <button
        type="submit"
        data-slot="prompt-input-submit"
        aria-label={submitLabel}
        disabled={!canSend}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40 motion-reduce:transition-none"
      >
        <ArrowUp aria-hidden="true" size={16} />
      </button>
    </form>
  )
}
