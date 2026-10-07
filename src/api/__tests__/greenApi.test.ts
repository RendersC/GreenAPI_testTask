import { describe, expect, it, vi } from 'vitest'

import { checkAccount, deleteNotification, getStateInstance, GreenApiError, receiveNotification, sendMessage } from '../greenApi'

const credentials = { apiUrl: 'https://4100.api.green-api.com/ ', idInstance: ' 4100000001', apiTokenInstance: 'token ' }
const BASE = 'https://4100.api.green-api.com/waInstance4100000001'

function mockFetch(status: number, body?: unknown) {
  const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(body === undefined ? '' : JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('greenApi client', () => {
  it('builds method URLs from trimmed credentials', async () => {
    const fetch = mockFetch(200, { stateInstance: 'authorized' })
    await expect(getStateInstance(credentials)).resolves.toEqual({ stateInstance: 'authorized' })
    expect(fetch).toHaveBeenCalledWith(`${BASE}/getStateInstance/token`, expect.anything())
  })

  it('falls back to the default host when apiUrl is empty', async () => {
    const fetch = mockFetch(200, { stateInstance: 'authorized' })
    await getStateInstance({ ...credentials, apiUrl: '' })
    expect(fetch.mock.calls[0][0]).toBe('https://api.green-api.com/waInstance4100000001/getStateInstance/token')
  })

  it('posts sendMessage and checkAccount as JSON', async () => {
    const fetch = mockFetch(200, { idMessage: 'abc' })
    await expect(sendMessage(credentials, '123', 'Привет')).resolves.toEqual({ idMessage: 'abc' })
    expect(fetch).toHaveBeenCalledWith(`${BASE}/sendMessage/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '123', message: 'Привет' }),
    })

    await checkAccount(credentials, { phoneNumber: 79001234567 })
    expect(fetch.mock.calls[1][1]).toMatchObject({ body: JSON.stringify({ phoneNumber: 79001234567 }) })
  })

  it('long-polls receiveNotification with a timeout and deletes by receipt id', async () => {
    const fetch = mockFetch(200, { result: true })
    await receiveNotification(credentials, 20)
    await deleteNotification(credentials, 42)
    expect(fetch.mock.calls[0][0]).toBe(`${BASE}/receiveNotification/token?receiveTimeout=20`)
    expect(fetch.mock.calls[1]).toEqual([`${BASE}/deleteNotification/token/42`, { method: 'DELETE', signal: undefined }])
  })

  it('treats an empty body and 408 as an empty notification queue', async () => {
    mockFetch(200)
    await expect(receiveNotification(credentials)).resolves.toBeNull()
    mockFetch(408)
    await expect(receiveNotification(credentials)).resolves.toBeNull()
  })

  it.each([
    [401, 'Неверный idInstance или apiTokenInstance'],
    [403, 'Неверный idInstance или apiTokenInstance'],
    [429, 'Слишком много запросов, попробуйте позже'],
    [466, 'Исчерпан лимит тарифа GREEN-API'],
    [502, 'Сервер GREEN-API недоступен'],
  ])('maps HTTP %i to a readable error', async (status, message) => {
    mockFetch(status)
    const error = await sendMessage(credentials, '1', 'x').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(GreenApiError)
    expect(error).toMatchObject({ status })
    expect((error as Error).message).toContain(message)
  })

  it('reports network failures as status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(getStateInstance(credentials)).rejects.toMatchObject({ status: 0, message: 'Нет соединения с GREEN-API' })
  })

  it('passes aborts through untouched', async () => {
    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
    await expect(receiveNotification(credentials, 5, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
