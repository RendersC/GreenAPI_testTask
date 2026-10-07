import { ThemeProvider } from 'next-themes'

import { Toaster } from '@/components/ui/sonner'
import { LoginScreen } from '@/features/auth/LoginScreen'
import { Messenger } from '@/features/chat/Messenger'
import { ChatStoreProvider } from '@/store/chatStore'
import { SessionProvider, useSession } from '@/store/session'

function Screens() {
  const { credentials } = useSession()
  if (!credentials) return <LoginScreen />

  return (
    <ChatStoreProvider key={credentials.idInstance} credentials={credentials}>
      <Messenger />
    </ChatStoreProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider>
        <Screens />
      </SessionProvider>
      <Toaster position="top-center" />
    </ThemeProvider>
  )
}
