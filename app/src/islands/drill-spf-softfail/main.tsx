import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Drill } from './Drill'

const rootEl = document.getElementById('drill-spf-softfail-root')

if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <Drill />
    </StrictMode>,
  )
}
