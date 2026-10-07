import { useState, type FormEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isValidPhone, normalizePhone } from '@/lib/phone'
import { useChatStore } from '@/store/chatStore'

export function NewChatDialog({ trigger }: { trigger: ReactNode }) {
  const { createChat } = useChatStore()
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setPhone('')
      setError(null)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const normalized = normalizePhone(phone)
    if (!isValidPhone(normalized)) {
      setError('Введите номер в международном формате, например +7 900 123-45-67')
      return
    }
    createChat(normalized)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Новый чат</DialogTitle>
            <DialogDescription>Номер телефона, к которому привязан Telegram получателя.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="phone">Номер телефона</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+7 900 123-45-67"
              value={phone}
              aria-invalid={!!error}
              onChange={(e) => {
                setPhone(e.target.value)
                setError(null)
              }}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Отмена
              </Button>
            </DialogClose>
            <Button type="submit">Создать чат</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
