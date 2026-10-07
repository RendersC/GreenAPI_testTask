import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { loadJson, removeKey, saveJson } from '@/lib/storage'
import type { Credentials } from '@/types/greenApi'

import { SessionContext } from './useSession'

const SESSION_KEY = 'greenapi-chat:session'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<Credentials | null>(() => loadJson<Credentials>(SESSION_KEY))

  const login = useCallback((next: Credentials) => {
    saveJson(SESSION_KEY, next)
    setCredentials(next)
  }, [])

  const logout = useCallback(() => {
    removeKey(SESSION_KEY)
    setCredentials(null)
  }, [])

  const value = useMemo(() => ({ credentials, login, logout }), [credentials, login, logout])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
