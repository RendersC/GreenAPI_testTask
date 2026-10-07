import type { NotificationBody } from '@/types/greenApi'

interface Account {
  chatId: string
  phoneNumber?: number
  username?: string
}

interface Options {
  idInstance?: string
  apiTokenInstance?: string
  state?: string
  accounts?: Account[]
  /** Status code to answer sendMessage with, e.g. 466 for an exhausted tariff. */
  sendStatus?: number
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/**
 * In-memory stand-in for the GREEN-API HTTP endpoints the app uses.
 * receiveNotification long-polls: it stays pending until a notification is pushed.
 */
export function createFakeGreenApi(options: Options = {}) {
  const config = { idInstance: '1101000001', apiTokenInstance: 'secret-token', state: 'authorized', accounts: [], ...options }
  const queue: { receiptId: number; body: NotificationBody }[] = []
  const sent: { chatId: string; message: string }[] = []
  const waiters = new Set<() => void>()
  let receiptSeq = 1
  let messageSeq = 1

  const wake = () => waiters.forEach((resolve) => resolve())

  async function waitForNotification(signal?: AbortSignal | null) {
    while (queue.length === 0) {
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          waiters.delete(done)
          resolve()
        }
        waiters.add(done)
        signal?.addEventListener('abort', () => {
          waiters.delete(done)
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    }
    return queue[0]
  }

  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input))
    const [, instance, method, token, receiptId] = url.pathname.split('/')
    if (instance !== `waInstance${config.idInstance}` || token !== config.apiTokenInstance) return json({}, 401)
    const body = init?.body ? JSON.parse(String(init.body)) : undefined

    switch (method) {
      case 'getStateInstance':
        return json({ stateInstance: config.state })
      case 'checkAccount': {
        const account = config.accounts.find(
          (a) => (body.phoneNumber && a.phoneNumber === body.phoneNumber) || (body.username && `@${a.username}` === body.username),
        )
        return json(
          account
            ? { exist: true, chatId: account.chatId, username: account.username ?? '', phoneNumber: account.phoneNumber }
            : { exist: false, chatId: '', username: '', phoneNumber: body.phoneNumber },
        )
      }
      case 'sendMessage': {
        if (config.sendStatus) return json({}, config.sendStatus)
        sent.push(body)
        return json({ idMessage: `out-${messageSeq++}` })
      }
      case 'receiveNotification':
        return json(await waitForNotification(init?.signal))
      case 'deleteNotification': {
        const index = queue.findIndex((n) => n.receiptId === Number(receiptId))
        if (index >= 0) queue.splice(index, 1)
        return json({ result: index >= 0 })
      }
      default:
        return json({}, 404)
    }
  }

  return {
    fetch,
    sent,
    queue,
    config,
    /** Simulates the recipient replying in Telegram. */
    reply(chatId: string, text: string, extra: Partial<NotificationBody['senderData']> = {}) {
      queue.push({
        receiptId: receiptSeq++,
        body: {
          typeWebhook: 'incomingMessageReceived',
          timestamp: Math.floor(Date.now() / 1000),
          idMessage: `in-${messageSeq++}`,
          senderData: { chatId, sender: chatId, chatType: 'user', senderName: 'Получатель', ...extra },
          messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
        },
      })
      wake()
    },
    push(body: NotificationBody) {
      queue.push({ receiptId: receiptSeq++, body })
      wake()
    },
  }
}
