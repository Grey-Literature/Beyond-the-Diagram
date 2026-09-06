import { useState } from 'react'
import { getLatestAttempt, recordAttempt } from '../../lib/progress'
import styles from './Drill.css?raw'

const CONTENT_ID = 'drill-unpaired-question'

const OPTIONS = [
  { id: 'answer-it', label: 'A good narrowing question — answer it and keep going' },
  {
    id: 'unpaired',
    label: "A good narrowing question that arrived without a verification method — ask how to check it before answering",
  },
  { id: 'stalling', label: "A stalling non-answer — push it to skip the questions and give you the fix" },
] as const

const CORRECT_ID = 'unpaired'

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
        You asked an AI to interview you about a symptom instead of answering it. This is its first
        reply, verbatim. Classify it before you respond:
      </p>
      <pre className="drill-string">
        Before we go further: is this happening for just this one user, or for everyone at that
        site?
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
            {choice === CORRECT_ID ? 'Correct.' : 'Not quite.'} The question itself is good — it&apos;s
            a clean{' '}
            <a href="/concepts/diagnostic-methodology.html">half-split</a>, and either answer
            eliminates a large chunk of the possibility space. That&apos;s exactly what makes it
            easy to wave through. What&apos;s missing is any statement of <em>how</em> you&apos;d
            establish the answer, and that omission is where the interview quietly goes wrong: under
            pressure you&apos;ll guess, or answer from impression, or ask a couple of users and take
            their word for it. Every question after this one then inherits that error, and the loop
            narrows confidently toward the wrong place.
          </p>
          <p className="drill-fix">
            The fix is one sentence back:{' '}
            <em>
              &quot;How would I check that? I have RMM on all endpoints, firewall read access, and
              nobody on site today.&quot;
            </em>{' '}
            Naming your tooling in the same breath is what turns a generic question into an
            executable one.
          </p>
          {choice === 'stalling' && (
            <p>
              And the third reading is worth naming as its own trap: pushing past the interview to
              &quot;just give me the fix&quot; converts a differential-diagnosis partner back into
              an oracle — which is the failure mode the pull-prompt existed to escape.
            </p>
          )}
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
