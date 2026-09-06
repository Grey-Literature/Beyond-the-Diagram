import { useState } from 'react'
import { getLatestAttempt, recordAttempt } from '../../lib/progress'
import styles from './Drill.css?raw'

const CONTENT_ID = 'drill-ping-port-unreachable'

const OPTIONS = [
  { id: 'no-signal', label: 'No signal — ambiguous, tells you nothing' },
  { id: 'proves-life', label: 'An explicit rejection that actually proves the host is alive' },
  { id: 'host-down', label: 'The host is completely down' },
] as const

const CORRECT_ID = 'proves-life'

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
      <p className="drill-prompt">Classify this response to a UDP probe — no other context given:</p>
      <pre className="drill-string">Reply from 10.0.0.1: Destination port unreachable</pre>

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
            {choice === CORRECT_ID ? 'Correct.' : 'Not quite.'} This is a genuinely
            counter-intuitive one: only a <strong>live host</strong> can generate an ICMP
            "Destination port unreachable" reply — it's the host itself saying "I'm here, but
            nothing's listening on that port." That's the opposite of bad news about reachability;
            it actually confirms the host is up. Compare that to a plain "Request timed out,"
            which is real{' '}
            <a href="/concepts/cross-cutting-concepts.html#signal-vs-silence">
              ambiguous silence
            </a>{' '}
            — no answer from anywhere, host or router, tells you nothing about who's actually
            alive.
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
