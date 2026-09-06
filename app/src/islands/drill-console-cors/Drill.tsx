import { useState } from 'react'
import { getLatestAttempt, recordAttempt } from '../../lib/progress'
import styles from './Drill.css?raw'

const CONTENT_ID = 'drill-console-cors'

const OPTIONS = [
  { id: 'dev-team', label: "An application problem — forward it to the dev team, none of this is yours" },
  {
    id: 'ambiguous',
    label: "Could be either: a backend header misconfiguration or your own inspecting proxy rewriting the response — this line alone can't distinguish them",
  },
  { id: 'network-down', label: 'A connectivity failure — the API is unreachable from that network' },
] as const

const CORRECT_ID = 'ambiguous'

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
        A user reports an internal portal is &quot;broken.&quot; This is the only error in the
        browser console. Classify whose problem it is:
      </p>
      <pre className="drill-string">
{`Access to fetch at 'https://api.internal.example.com/v1/status'
from origin 'https://portal.internal.example.com' has been blocked
by CORS policy: No 'Access-Control-Allow-Origin' header is present
on the requested resource.`}
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
            {choice === CORRECT_ID ? 'Correct.' : 'Not quite.'} A missing{' '}
            <code>Access-Control-Allow-Origin</code> header usually <em>is</em> a backend
            misconfiguration, and forwarding it to the dev team is right more often than
            not — which is precisely what makes the reflex expensive. An SSL-inspecting proxy that
            decrypts, rewrites and re-signs responses can strip or alter that header in transit,
            and then this is your infrastructure wearing a web-shaped disguise. Nothing in the
            error text distinguishes the two, so the honest classification at this point is
            &quot;not yet determined.&quot;
          </p>
          <p className="drill-next-check">
            Cheapest disambiguation: request that endpoint from inside the inspected path and from
            outside it, and compare the raw response headers. If the header is present on one and
            missing on the other, the app was never the problem.
          </p>
          {choice === 'network-down' && (
            <p>
              This reading is ruled out by the error itself: a CORS message means the response{' '}
              <em>arrived</em> and the browser objected to a header on it. Had nothing arrived,
              you&apos;d be looking at <code>net::ERR_CONNECTION_REFUSED</code> instead — real{' '}
              <a href="/concepts/cross-cutting-concepts.html#signal-vs-silence">signal versus
              silence</a>, in a place ITOps rarely thinks to apply it.
            </p>
          )}
          <p>
            This is the same{' '}
            <a href="/concepts/diagnostic-methodology.html">classify-before-you-diagnose</a> move
            as sorting an authn error from an authz one — see the{' '}
            <a href="/ai-fluency/lab-browser-console-literacy.html">console literacy Lab</a> for the
            other three errors worth recognizing on sight.
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
