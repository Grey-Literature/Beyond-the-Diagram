import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Quiz } from './Quiz'

const rootEl = document.getElementById('placement-quiz-prosumer-networking-root')

if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <Quiz />
    </StrictMode>,
  )
}
