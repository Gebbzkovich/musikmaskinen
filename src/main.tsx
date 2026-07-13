import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './index.css'
import { AppShell } from './components/AppShell'
import { GenresPage } from './routes/GenresPage'
import { SubgenresPage } from './routes/SubgenresPage'
import { SongsPage } from './routes/SongsPage'
import { TrackDeepLink } from './routes/TrackDeepLink'

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <GenresPage /> },
      { path: '/g/:familySlug', element: <SubgenresPage /> },
      { path: '/s/:subgenreSlug', element: <SongsPage /> },
      { path: '/track/:itunesId', element: <TrackDeepLink /> },
    ],
  },
])

const el = document.getElementById('root')
if (!el) throw new Error('Root element #root not found')
createRoot(el).render(<StrictMode><RouterProvider router={router} /></StrictMode>)
