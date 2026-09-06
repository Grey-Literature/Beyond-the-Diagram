import { useState } from 'react'
import { getLatestAttempt, recordAttempt } from '../../lib/progress'
import styles from './Drill.css?raw'

const CONTENT_ID = 'drill-domain-not-available'

const OPTIONS = [
  { id: 'secure-channel', label: 'The machine reached a domain controller, but the secure channel is desynced' },
  { id: 'never-reached', label: 'The machine never reached any domain controller at all' },
  { id: 'account-state', label: "The user's account is locked or expired" },
] as const

const CORRECT_ID = 'never-reached'

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
      <p className="drill-prompt">Classify this message — no other context given:</p>
      <pre className="drill-string">The domain EXAMPLE is not available.</pre>

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
            {choice === CORRECT_ID ? 'Correct.' : 'Not quite.'} This means the machine{' '}
            <strong>never reached any domain controller at all</strong> — not that it reached one
            and got rejected. That's the opposite starting point from "no trust relationship
            between this workstation and the primary domain," which means the machine successfully
            found a DC and it's the secure channel that's desynced. The two messages sound like
            the same complaint; they send you down completely different paths. Rejoining the
            domain here is close to useless advice — there's no live DC to rejoin against yet, so
            check basic reachability (DNS, routing, is a DC even up) before touching domain
            membership at all.
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
