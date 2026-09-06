import { useState } from 'react'
import { getLatestAttempt, recordAttempt } from '../../lib/progress'
import styles from './Drill.css?raw'

const CONTENT_ID = 'drill-entra-pending'

const OPTIONS = [
  { id: 'failed', label: 'The policy failed to apply and needs troubleshooting' },
  { id: 'in-flight', label: "It's still working through the propagation pipeline — normal, not a failure" },
  { id: 'excluded', label: 'The policy was deliberately excluded for this device' },
] as const

const CORRECT_ID = 'in-flight'

export function Drill() {
  const [choice, setChoice] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  function choose(id: string) {
    if (revealed) return
    recordAttempt(CONTENT_ID, id, id === CORRECT_ID)
    setChoice(id)
    setRevealed(true)
  }

  function tryAgain() {
    setChoice(null)
    setRevealed(false)
  }

  const lastAttempt = !revealed ? getLatestAttempt(CONTENT_ID) : null

  return (
    <div className="drill">
      <style>{styles}</style>
      <p className="drill-prompt">Classify this status — no other context given:</p>
      <pre className="drill-string">Assignment status: Pending</pre>

      {!revealed && (
        <div className="drill-options">
          {OPTIONS.map((opt) => (
            <button key={opt.id} type="button" onClick={() => choose(opt.id)}>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {revealed && (
        <div className="drill-feedback" data-correct={choice === CORRECT_ID}>
          <p>
            {choice === CORRECT_ID ? 'Correct.' : 'Not quite.'} "Pending" means exactly what it
            says — the assignment is genuinely still moving through an{' '}
            <a href="/concepts/cross-cutting-concepts.html#eventual-consistency">
              eventually-consistent
            </a>{' '}
            pipeline with several independently-owned stages, several of which have no published
            SLA. It's not an error state, and it's not evidence of misconfiguration — jumping to
            troubleshoot a "Pending" status before giving the pipeline time to finish is a common
            way to waste an investigation on a problem that isn't one yet.
          </p>
          <button type="button" onClick={tryAgain}>
            Try again
          </button>
        </div>
      )}

      {lastAttempt && (
        <p className="drill-history">
          Last attempt: {lastAttempt.correct ? 'correct' : 'incorrect'} ({new Date(lastAttempt.timestamp).toLocaleString()})
        </p>
      )}
    </div>
  )
}
