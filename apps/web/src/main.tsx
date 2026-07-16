import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
// Self-hosted. The Google Fonts CDN is a privacy dependency and breaks offline.
import '@fontsource-variable/inter'
import './index.css'
import { Providers } from './app/providers'
import { router } from './app/router'

const root = document.getElementById('root')
if (!root) throw new Error('#root not found in index.html')

createRoot(root).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
)
