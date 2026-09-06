import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Case } from './Case'

const rootEl = document.getElementById('case-vlan-loop-root')

if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <Case />
    </StrictMode>,
  )
}
