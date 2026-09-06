import { useState } from 'react'
import { getLatestAttempt, recordAttempt } from '../../lib/progress'
import styles from './Drill.css?raw'

const CONTENT_ID = 'drill-dns-nxdomain'

const OPTIONS = [
  { id: 'no-answer', label: 'No answer at all — ambiguous, could be many things' },
  { id: 'explicit-rejection', label: 'An explicit, authoritative answer: this name genuinely does not exist in this view' },
  { id: 'bad-value', label: 'A successful answer that happens to be wrong' },
] as const

const CORRECT_ID = 'explicit-rejection'

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
      <p className="drill-prompt">Classify this response — no other context given:</p>
      <pre className="drill-string">
{`$ nslookup app.internal.example.com 8.8.8.8
Server:  8.8.8.8
** server can't find app.internal.example.com: NXDOMAIN`}
      </pre>

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
            {choice === CORRECT_ID ? 'Correct.' : 'Not quite.'} <code>NXDOMAIN</code> feels like
            "nothing happened," but it's actually definitive signal — the resolver got a real,
            authoritative answer: this name does not exist in whatever zone it asked. That's
            bucket 2 of{' '}
            <a href="/concepts/cross-cutting-concepts.html#signal-vs-silence">Signal vs. Silence</a>,
            not bucket 1. A timeout with no response at all would be the true "no answer" case —
            this is the opposite of that, even though both can look like "it didn't work" at a
            glance.
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
