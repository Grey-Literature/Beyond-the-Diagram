import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Quiz } from './Quiz'

const rootEl = document.getElementById('placement-quiz-ad-gpo-root')

if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <Quiz />
    </StrictMode>,
  )
}
