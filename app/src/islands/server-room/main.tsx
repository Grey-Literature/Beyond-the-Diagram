import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ServerRoom } from './ServerRoom'

const rootEl = document.getElementById('server-room-root')

if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ServerRoom />
    </StrictMode>,
  )
}
