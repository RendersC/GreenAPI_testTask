import { createContext, useContext } from 'react'

import type { Credentials } from '@/types/greenApi'

export interface SessionContextValue {
  credentials: Credentials | null
  login: (credentials: Credentials) => void
  logout: () => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used inside SessionProvider')
  return context
}
