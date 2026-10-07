import { useEffect, useRef, useState } from 'react'

import { deleteNotification, getStateInstance, GreenApiError, receiveNotification } from '@/api/greenApi'
import { parseNotification, type ParsedMessage } from '@/lib/notifications'
import type { Credentials } from '@/types/greenApi'

export type PollingStatus = 'connecting' | 'online' | 'offline' | 'unauthorized'

const RECEIVE_TIMEOUT_SEC = 20
const RETRY_DELAY_MS = 3000
const MIN_EMPTY_POLL_MS = 1000

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

/**
 * Drains the GREEN-API notification queue in a loop:
 * receiveNotification → handle text message → deleteNotification.
 */
export function useNotificationPolling(
  credentials: Credentials | null,
  onMessage: (message: ParsedMessage) => void,
): PollingStatus {
  const [status, setStatus] = useState<PollingStatus>('connecting')
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!credentials) return
    const controller = new AbortController()
    const { signal } = controller

    async function loop() {
      setStatus('connecting')
      // A quick state check shows "online" without waiting for the first long-poll.
      getStateInstance(credentials!, signal)
        .then(({ stateInstance }) => !signal.aborted && stateInstance === 'authorized' && setStatus('online'))
        .catch(() => {})

      while (!signal.aborted) {
        try {
          const startedAt = Date.now()
          const notification = await receiveNotification(credentials!, RECEIVE_TIMEOUT_SEC, signal)
          setStatus('online')
          if (!notification) {
            // Guard against a hot loop if the server returns "empty" right away.
            if (Date.now() - startedAt < MIN_EMPTY_POLL_MS) await wait(MIN_EMPTY_POLL_MS, signal)
            continue
          }

          const message = parseNotification(notification.body)
          if (message) onMessageRef.current(message)
          await deleteNotification(credentials!, notification.receiptId, signal)
        } catch (error) {
          if (signal.aborted) return
          if (error instanceof GreenApiError && (error.status === 401 || error.status === 403)) {
            setStatus('unauthorized')
            return
          }
          // 429 is GREEN-API rate limiting, not a lost connection: just back off.
          if (!(error instanceof GreenApiError && error.status === 429)) setStatus('offline')
          await wait(RETRY_DELAY_MS, signal)
        }
      }
    }

    loop()
    return () => controller.abort()
  }, [credentials])

  return status
}
