import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createHashRouter } from 'react-router-dom'
import './index.css'
import { ReadingLevelProvider } from './lib/readingLevel'
import Shell from './Shell'
import Home from './pages/Home'
import EntryPage from './pages/EntryPage'
import About from './pages/About'

/**
 * Hash router: the site is a static build for now (free hosting, no server
 * rewrites needed). Swap to createBrowserRouter once it sits behind the API.
 */
const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'entry/:slug', element: <EntryPage /> },
      { path: 'about', element: <About /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReadingLevelProvider>
      <RouterProvider router={router} />
    </ReadingLevelProvider>
  </StrictMode>,
)
