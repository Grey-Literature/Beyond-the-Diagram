import { useState } from 'react'
import { getLatestAttempt, recordAttempt } from '../../lib/progress'
import './Drill.css'

const CONTENT_ID = 'drill-http-401-403'

const OPTIONS = [
  { id: 'authn', label: 'Authentication failure' },
  { id: 'authz', label: 'Authorization failure' },
  { id: 'account-state', label: 'Account-state issue (locked, disabled, expired)' },
] as const

const CORRECT_ID = 'authn'

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
      <p className="drill-prompt">Classify this response — no other context given:</p>
      <pre className="drill-string">HTTP/1.1 401 Unauthorized</pre>

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
            {choice === CORRECT_ID ? 'Correct.' : 'Not quite.'} This is an{' '}
            <strong>authentication</strong> failure — despite the word
            "Unauthorized," HTTP 401 actually means the request was never
            authenticated in the first place. 403 Forbidden is the one that
            actually means authorization failure. The label doesn't map to
            the definition the way it reads — that's the trap.
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
