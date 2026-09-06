import { useState } from 'react'
import { getLatestAttempt, recordAttempt } from '../../lib/progress'
import styles from './Drill.css?raw'

const CONTENT_ID = 'drill-ldap-invalid-credentials'

const OPTIONS = [
  { id: 'only-password', label: 'Definitely and only a wrong password' },
  { id: 'sub-codes-hidden', label: 'Could be a wrong password, or a disabled/expired/locked account — the appliance may not surface AD\'s own sub-code' },
  { id: 'appliance-broken', label: 'The appliance itself is misconfigured' },
] as const

const CORRECT_ID = 'sub-codes-hidden'

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
      <p className="drill-prompt">Classify what this could actually represent — no other context given:</p>
      <pre className="drill-string">LDAP Bind Failed: Invalid Credentials (49)</pre>

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
            {choice === CORRECT_ID ? 'Correct.' : 'Not quite.'} Active Directory embeds a specific
            sub-error code inside the generic LDAP "invalid credentials" response — disabled,
            expired, locked, or restricted logon hours all produce their own distinct sub-codes.
            Whether any of that detail actually reaches you is entirely up to the{' '}
            <em>appliance vendor's</em> choice of how much to surface — a real instance of{' '}
            <a href="/concepts/cross-cutting-concepts.html#trust-boundary-flattening">
              trust-boundary flattening
            </a>{' '}
            baked directly into a single vendor's product decision, not a protocol limitation.
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
