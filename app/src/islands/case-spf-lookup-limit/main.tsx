import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Case } from './Case'

const rootEl = document.getElementById('case-spf-lookup-limit-root')

if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <Case />
    </StrictMode>,
  )
}
