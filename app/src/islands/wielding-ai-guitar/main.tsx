import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Guitar } from './Guitar'

const rootEl = document.getElementById('wielding-ai-guitar-root')

if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <Guitar />
    </StrictMode>,
  )
}
