import { useState } from 'react'
import { getLatestAttempt, recordAttempt } from '../../lib/progress'
import styles from './Drill.css?raw'

const CONTENT_ID = 'drill-spf-softfail'

const OPTIONS = [
  { id: 'reject', label: 'Reject the message outright' },
  { id: 'soft-fail', label: 'Flag it as a soft-fail but still allow delivery (fail-open)' },
  { id: 'invalid-record', label: "The record itself is malformed" },
] as const

const CORRECT_ID = 'soft-fail'

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
      <p className="drill-prompt">
        Classify what this record does to a message that fails the check — no other context
        given:
      </p>
      <pre className="drill-string">v=spf1 include:_spf.google.com ~all</pre>

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
            {choice === CORRECT_ID ? 'Correct.' : 'Not quite.'} <code>~all</code> is SPF's
            SoftFail qualifier — a{' '}
            <a href="/concepts/cross-cutting-concepts.html#fail-open-vs-fail-closed">
              fail-open
            </a>{' '}
            design choice. A message that fails the check typically still gets delivered, maybe
            flagged or spam-scored, rather than rejected outright. <code>-all</code> is the
            fail-closed counterpart (HardFail) — same record shape, opposite policy on
            uncertainty. Neither one means the record is broken; both are valid, deliberate
            choices about how much to trust a failed check.
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
