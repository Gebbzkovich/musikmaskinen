import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './index.css'
import { SessionProvider } from './auth/session'
import { AuthGate } from './auth/AuthGate'
import { AppShell } from './components/AppShell'
import { GenresPage } from './routes/GenresPage'
import { SubgenresPage } from './routes/SubgenresPage'
import { SongsPage } from './routes/SongsPage'
import { TrackDeepLink } from './routes/TrackDeepLink'
import { SurpriseScreen } from './routes/SurpriseScreen'
import { LoginScreen } from './auth/LoginScreen'
import { HandleSetup } from './auth/HandleSetup'
import { InboxScreen } from './routes/InboxScreen'
import { FriendsScreen } from './routes/FriendsScreen'
import { ProfileScreen } from './routes/ProfileScreen'
import { ChatView } from './routes/ChatView'

const gated = (el: ReactNode) => <AuthGate>{el}</AuthGate>
const router = createBrowserRouter([
  { path: '/login', element: <LoginScreen /> },
  { path: '/setup', element: <HandleSetup /> },
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <GenresPage /> },
      { path: '/g/:familySlug', element: <SubgenresPage /> },
      { path: '/s/:subgenreSlug', element: <SongsPage /> },
      { path: '/track/:itunesId', element: <TrackDeepLink /> },
      { path: '/surprise', element: <SurpriseScreen /> },
      { path: '/inbox', element: gated(<InboxScreen />) },
      { path: '/friends', element: gated(<FriendsScreen />) },
      { path: '/me', element: gated(<ProfileScreen />) },
      { path: '/c/:conversationId', element: gated(<ChatView />) },
    ],
  },
])
const el = document.getElementById('root')
if (!el) throw new Error('Root element #root not found')
createRoot(el).render(<StrictMode><SessionProvider><RouterProvider router={router} /></SessionProvider></StrictMode>)
