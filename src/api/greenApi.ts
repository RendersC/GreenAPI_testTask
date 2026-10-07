import type {
  Credentials,
  Notification,
  SendMessageResponse,
  StateInstanceResponse,
} from '@/types/greenApi'

export const DEFAULT_API_URL = 'https://api.green-api.com'
export const MAX_MESSAGE_LENGTH = 4096

export class GreenApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GreenApiError'
    this.status = status
  }
}

function describeStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Некорректный запрос'
    case 401:
    case 403:
      return 'Неверный idInstance или apiTokenInstance'
    case 404:
      return 'Инстанс не найден, проверьте apiUrl и idInstance'
    case 429:
      return 'Слишком много запросов, попробуйте позже'
    case 466:
      return 'Исчерпан лимит тарифа GREEN-API'
    default:
      return status >= 500 ? 'Сервер GREEN-API недоступен' : `Ошибка запроса (${status})`
  }
}

function buildUrl({ apiUrl, idInstance, apiTokenInstance }: Credentials, method: string, suffix = '') {
  const base = (apiUrl || DEFAULT_API_URL).trim().replace(/\/+$/, '')
  return `${base}/waInstance${idInstance.trim()}/${method}/${apiTokenInstance.trim()}${suffix}`
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (error) {
    if (init?.signal?.aborted) throw error
    throw new GreenApiError(0, 'Нет соединения с GREEN-API')
  }
  if (!response.ok) throw new GreenApiError(response.status, describeStatus(response.status))

  const text = await response.text()
  return (text ? JSON.parse(text) : null) as T
}

export function getStateInstance(credentials: Credentials, signal?: AbortSignal) {
  return request<StateInstanceResponse>(buildUrl(credentials, 'getStateInstance'), { signal })
}

export function sendMessage(credentials: Credentials, chatId: string, message: string) {
  return request<SendMessageResponse>(buildUrl(credentials, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  })
}

/** Long-poll: returns null when the queue stays empty for `receiveTimeout` seconds. */
export function receiveNotification(credentials: Credentials, receiveTimeout = 20, signal?: AbortSignal) {
  return request<Notification | null>(
    buildUrl(credentials, 'receiveNotification', `?receiveTimeout=${receiveTimeout}`),
    { signal },
  )
}

export function deleteNotification(credentials: Credentials, receiptId: number, signal?: AbortSignal) {
  return request<{ result: boolean }>(buildUrl(credentials, 'deleteNotification', `/${receiptId}`), {
    method: 'DELETE',
    signal,
  })
}
