import { EyeIcon, EyeOffIcon, LoaderCircleIcon, MessageCircleIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { DEFAULT_API_URL, GreenApiError, getStateInstance } from '@/api/greenApi'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useSession } from '@/store/session'
import type { InstanceState } from '@/types/greenApi'

const STATE_ERRORS: Partial<Record<InstanceState, string>> = {
  notAuthorized: 'Инстанс не авторизован: привяжите Telegram в личном кабинете GREEN-API',
  blocked: 'Инстанс заблокирован',
  sleepMode: 'Инстанс в спящем режиме',
  starting: 'Инстанс запускается, попробуйте через минуту',
  yellowCard: 'Отправка сообщений временно ограничена',
}

/** GREEN-API hosts are sharded by the first 4 digits of idInstance. */
function guessApiUrl(idInstance: string) {
  return /^\d{4}/.test(idInstance) ? `https://${idInstance.slice(0, 4)}.api.green-api.com` : DEFAULT_API_URL
}

export function LoginScreen() {
  const { login } = useSession()
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const apiUrlPlaceholder = guessApiUrl(idInstance.trim())

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const credentials = {
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
      apiUrl: apiUrl.trim() || apiUrlPlaceholder,
    }
    if (!credentials.idInstance || !credentials.apiTokenInstance) {
      setError('Заполните idInstance и apiTokenInstance')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { stateInstance } = await getStateInstance(credentials)
      if (stateInstance === 'authorized') login(credentials)
      else setError(STATE_ERRORS[stateInstance] ?? `Статус инстанса: ${stateInstance}`)
    } catch (err) {
      setError(err instanceof GreenApiError ? err.message : 'Не удалось проверить данные')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-full items-center justify-center bg-chat p-4">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <MessageCircleIcon className="size-6" />
          </div>
          <CardTitle className="text-lg">GREEN-API Chat</CardTitle>
          <CardDescription>
            Введите данные инстанса из{' '}
            <a
              className="text-primary underline-offset-4 hover:underline"
              href="https://console.green-api.com"
              target="_blank"
              rel="noreferrer"
            >
              личного кабинета
            </a>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="idInstance">idInstance</Label>
              <Input
                id="idInstance"
                inputMode="numeric"
                autoComplete="off"
                name="green-api-instance"
                placeholder="1101000001"
                value={idInstance}
                onChange={(e) => setIdInstance(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="apiTokenInstance">apiTokenInstance</Label>
              <div className="relative">
                <Input
                  id="apiTokenInstance"
                  // A masked text field instead of type="password" keeps browser
                  // password managers from autofilling unrelated saved logins.
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  name="green-api-token"
                  data-1p-ignore
                  data-lpignore="true"
                  placeholder="Токен из личного кабинета"
                  className={cn('pr-9', !showToken && '[-webkit-text-security:disc]')}
                  value={apiTokenInstance}
                  onChange={(e) => setApiTokenInstance(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground"
                  aria-label={showToken ? 'Скрыть токен' : 'Показать токен'}
                  onClick={() => setShowToken((v) => !v)}
                >
                  {showToken ? <EyeOffIcon /> : <EyeIcon />}
                </Button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="apiUrl">
                apiUrl <span className="font-normal text-muted-foreground">(необязательно)</span>
              </Label>
              <Input
                id="apiUrl"
                type="url"
                placeholder={apiUrlPlaceholder}
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={loading}>
              {loading && <LoaderCircleIcon className="animate-spin" />}
              Войти
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
