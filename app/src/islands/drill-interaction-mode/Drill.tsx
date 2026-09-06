import { useState } from 'react'
import { getLatestAttempt, recordAttempt } from '../../lib/progress'
import styles from './Drill.css?raw'

const CONTENT_ID = 'drill-interaction-mode'

const OPTIONS = [
  {
    id: 'automation',
    label: 'Automation — it ran a defined task you specified, the same as a script would',
  },
  {
    id: 'augmentation',
    label: 'Augmentation — it analyzed the data and reported back; you are still the one in the loop',
  },
  {
    id: 'agency',
    label: 'Agency — it acted on the system directly, and the change is already in',
  },
] as const

const CORRECT_ID = 'agency'

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
        Classify this interaction before you decide what you owe it in verification and disclosure:
      </p>
      <pre className="drill-string">
{`You've connected an assistant to your RMM
through a tool integration. You ask it:

  "Find every endpoint at the branch site
   that hasn't checked in for 48 hours and
   put them in the maintenance group."

It replies: "Done — 6 endpoints moved."`}
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
            {choice === CORRECT_ID ? 'Correct.' : 'Not quite.'} Six endpoints are in a different
            group in a production management platform, and the only record of it is one sentence in
            a chat window. You never saw the list before it acted.
          </p>
          <div className="drill-tell">
            The tell is not how conversational it felt, and not whether you approved a plan first.
            It is this: <strong>did the state of a system change without a human executing the
            change?</strong> If yes, that is Agency, however casual the interface was.
          </div>
          {choice === 'augmentation' && (
            <p>
              Augmentation would have been the same request answered with{' '}
              <em>&ldquo;here are the 6 endpoints that match&rdquo;</em> &mdash; the model touching
              your context, not the platform. The keyboard effort is identical and the blast radius
              is not: Augmentation&apos;s worst case is contained to your own workflow, and this
              one&apos;s worst case is in the system already.
            </p>
          )}
          {choice === 'automation' && (
            <p>
              A script you wrote encodes decisions you made in advance and does exactly the same
              thing every run. Here the assistant decided what &ldquo;hasn&apos;t checked in&rdquo;
              meant, chose which endpoints matched, and acted &mdash; with no artifact you can read
              afterward to see how it decided. That interpretive step is the whole difference.
            </p>
          )}
          <p>
            This matters because the obligations differ by mode, not by how the tool feels to use. A
            wrong firewall rule pushed by an agent does not get walked back with &ldquo;well, the AI
            suggested it&rdquo; &mdash; the rule is in and the outage is real. Disclosure follows
            blast radius, and AI touching a client&apos;s systems directly needs explicit consent
            before the session, not an explanation afterward. Full treatment in{' '}
            <a href="/ai-fluency/lab-diligence-agentic-boundary.html">the Diligence Lab</a>.
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
