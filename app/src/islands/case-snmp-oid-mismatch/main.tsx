import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Case } from './Case'

const rootEl = document.getElementById('case-snmp-oid-mismatch-root')

if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <Case />
    </StrictMode>,
  )
}
