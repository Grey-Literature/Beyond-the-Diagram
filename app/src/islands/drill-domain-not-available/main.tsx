import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Drill } from './Drill'

const rootEl = document.getElementById('drill-domain-not-available-root')

if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <Drill />
    </StrictMode>,
  )
}
