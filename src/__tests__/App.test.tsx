import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { createFakeGreenApi } from '@/test/fakeGreenApi'

const RECIPIENT = { chatId: '555000111', phoneNumber: 79001234567 }

function setup(options: Parameters<typeof createFakeGreenApi>[0] = {}) {
  const api = createFakeGreenApi({ accounts: [RECIPIENT], ...options })
  vi.stubGlobal('fetch', vi.fn(api.fetch))
  const user = userEvent.setup()
  render(<App />)
  return { api, user }
}

async function login(user: ReturnType<typeof userEvent.setup>, token = 'secret-token') {
  await user.type(screen.getByLabelText('idInstance'), '1101000001')
  await user.type(screen.getByLabelText('apiTokenInstance'), token)
  await user.click(screen.getByRole('button', { name: 'Войти' }))
}

async function openChat(user: ReturnType<typeof userEvent.setup>, recipient = '+7 900 123-45-67') {
  // The header icon and the empty-state button both open the dialog.
  const [newChatButton] = await screen.findAllByRole('button', { name: 'Новый чат' })
  await user.click(newChatButton)
  await user.type(screen.getByLabelText('Номер телефона или @username'), recipient)
  await user.click(screen.getByRole('button', { name: 'Создать чат' }))
}

describe('GREEN-API chat', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('logs in, creates a chat by phone, sends a message and shows the reply', async () => {
    const { api, user } = setup()

    await login(user)
    expect(await screen.findByText('Чаты')).toBeInTheDocument()

    await openChat(user)
    expect(await screen.findByRole('heading', { name: '+7 900 123-45-67' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Сообщение'), 'Привет!{Enter}')

    // Sent to the Telegram chatId from checkAccount, not to "phone@c.us".
    await waitFor(() => expect(api.sent).toEqual([{ chatId: RECIPIENT.chatId, message: 'Привет!' }]))
    const log = screen.getByRole('log', { name: 'Сообщения' })
    expect(within(log).getByText('Привет!')).toBeInTheDocument()
    expect(await within(log).findByLabelText('Отправлено')).toBeInTheDocument()

    api.reply(RECIPIENT.chatId, 'Привет, получил!')
    expect(await within(log).findByText('Привет, получил!')).toBeInTheDocument()
    // The notification is removed from the GREEN-API queue once handled.
    await waitFor(() => expect(api.queue).toHaveLength(0))
  })

  it('creates a chat by @username', async () => {
    const { api, user } = setup({ accounts: [{ chatId: '777', username: 'durov' }] })
    await login(user)
    await openChat(user, '@durov')

    expect(await screen.findByRole('heading', { name: '@durov' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Сообщение'), 'Hi{Enter}')
    await waitFor(() => expect(api.sent[0]?.chatId).toBe('777'))
  })

  it('explains when the phone is not found in Telegram', async () => {
    const { user } = setup({ accounts: [] })
    await login(user)
    await openChat(user)

    expect(await screen.findByText(/Аккаунт Telegram с этим номером не найден/)).toBeInTheDocument()
  })

  it('validates the phone number before calling the API', async () => {
    const { user } = setup()
    await login(user)
    await openChat(user, '123')

    expect(await screen.findByText(/международном формате/)).toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('checkAccount'))).toBe(false)
  })

  it('rejects wrong credentials', async () => {
    const { user } = setup()
    await login(user, 'wrong-token')

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный idInstance или apiTokenInstance')
    expect(screen.queryByText('Чаты')).not.toBeInTheDocument()
  })

  it('rejects an instance that is not authorized in Telegram', async () => {
    const { user } = setup({ state: 'notAuthorized' })
    await login(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Инстанс не авторизован')
  })

  it('marks a message as failed when the tariff limit is hit and allows retrying', async () => {
    const { api, user } = setup({ sendStatus: 466 })
    await login(user)
    await openChat(user)
    await user.type(screen.getByLabelText('Сообщение'), 'Тест{Enter}')

    expect(await screen.findByLabelText('Не отправлено')).toBeInTheDocument()
    expect(await screen.findByText(/Исчерпан лимит тарифа/)).toBeInTheDocument()

    api.config.sendStatus = undefined
    await user.click(screen.getByRole('button', { name: 'Отправить повторно' }))
    expect(await screen.findByLabelText('Отправлено')).toBeInTheDocument()
    expect(api.sent).toHaveLength(1)
  })

  it('shows replies from unknown private chats as new chats with an unread badge', async () => {
    const { api, user } = setup()
    await login(user)
    expect(await screen.findByText(/Чатов пока нет/)).toBeInTheDocument()

    api.reply('999', 'Здравствуйте', { chatName: 'Иван Петров' })
    expect(await screen.findByText('Иван Петров')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('ignores group messages but still drains them from the queue', async () => {
    const { api, user } = setup()
    await login(user)
    await screen.findByText(/Чатов пока нет/)

    api.reply('-100123', 'Сообщение в группе', { chatType: 'supergroup', chatName: 'Группа' })
    await waitFor(() => expect(api.queue).toHaveLength(0))
    expect(screen.queryByText('Группа')).not.toBeInTheDocument()
  })

  it('returns to the login screen when the token is revoked while polling', async () => {
    const { api, user } = setup()
    await login(user)
    await screen.findByText(/Чатов пока нет/)

    api.config.apiTokenInstance = 'rotated'
    api.reply('999', 'разбуди long-poll')

    expect(await screen.findByLabelText('idInstance')).toBeInTheDocument()
    expect(await screen.findByText(/Данные инстанса больше не действительны/)).toBeInTheDocument()
  })

  it('restores the session and chats after reload, and logs out', async () => {
    const { user } = setup()
    await login(user)
    await openChat(user)
    await user.type(screen.getByLabelText('Сообщение'), 'Сохрани меня{Enter}')
    await screen.findByLabelText('Отправлено')

    // Simulate a page reload: unmount everything, keep localStorage.
    cleanup()
    render(<App />)
    expect(await screen.findByText(/Сохрани меня/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(await screen.findByLabelText('idInstance')).toBeInTheDocument()
  })
})
