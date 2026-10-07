import { LoaderCircleIcon } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'

import { checkAccount, GreenApiError } from '@/api/greenApi'
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
import { useChatStore } from '@/store/useChatStore'
import { useSession } from '@/store/useSession'

const USERNAME_RE = /^@?([a-zA-Z][a-zA-Z0-9_]{3,31})$/

type Recipient = { phoneNumber: number } | { username: string }

function parseRecipient(input: string): Recipient | null {
  const value = input.trim()
  const username = value.match(USERNAME_RE)
  if (username && (value.startsWith('@') || /[a-z]/i.test(value))) return { username: `@${username[1]}` }

  const phone = normalizePhone(value)
  return isValidPhone(phone) ? { phoneNumber: Number(phone) } : null
}

export function NewChatDialog({ trigger }: { trigger: ReactNode }) {
  const { credentials } = useSession()
  const { createChat } = useChatStore()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setValue('')
      setError(null)
      setLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const recipient = parseRecipient(value)
    if (!recipient || !credentials) {
      setError('Введите номер в международном формате (+7 900 123-45-67) или @username')
      return
    }

    setLoading(true)
    setError(null)
    try {
      // Telegram accepts messages only by chatId, so resolve it first.
      const account = await checkAccount(credentials, recipient)
      if (!account.exist || !account.chatId) {
        setError(
          'phoneNumber' in recipient
            ? 'Аккаунт Telegram с этим номером не найден, или пользователь скрыл номер в настройках приватности. Попробуйте @username.'
            : 'Аккаунт Telegram с таким username не найден.',
        )
        return
      }
      createChat({
        chatId: account.chatId,
        phone: account.phoneNumber ? String(account.phoneNumber) : 'phoneNumber' in recipient ? String(recipient.phoneNumber) : undefined,
        // GREEN-API returns the username with a leading @, the app stores it bare.
        username: account.username?.replace(/^@/, '') || undefined,
      })
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof GreenApiError ? err.message : 'Не удалось проверить аккаунт')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Новый чат</DialogTitle>
            <DialogDescription>Номер телефона получателя в Telegram или его @username.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="recipient">Номер телефона или @username</Label>
            <Input
              id="recipient"
              autoComplete="off"
              placeholder="+7 900 123-45-67"
              value={value}
              aria-invalid={!!error}
              onChange={(e) => {
                setValue(e.target.value)
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
            <Button type="submit" disabled={loading}>
              {loading && <LoaderCircleIcon className="animate-spin" />}
              Создать чат
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
