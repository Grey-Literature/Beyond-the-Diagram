import { useState } from 'react'
import { getLatestAttempt, recordAttempt } from '../../lib/progress'
import styles from './Drill.css?raw'

const CONTENT_ID = 'drill-switch-no-alerts'

const OPTIONS = [
  { id: 'confirms-healthy', label: 'Confirms there is no problem' },
  { id: 'proves-nothing', label: "Proves nothing — the dashboard's alerting logic may never have been designed to catch this" },
  { id: 'different-switch', label: 'Means the problem must be on a different switch' },
] as const

const CORRECT_ID = 'proves-nothing'

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
        You suspect a loop confined to a couple of VLANs. Classify what this tells you — no other
        context given:
      </p>
      <pre className="drill-string">Switch dashboard: All ports green. No alerts.</pre>

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
            {choice === CORRECT_ID ? 'Correct.' : 'Not quite.'} Consumer- and prosumer-oriented
            gear trades diagnostic depth for a simpler UI on purpose — a clean dashboard doesn't
            mean the device is healthy, it can just as easily mean the vendor never built alerting
            logic for this specific failure mode at all. A VLAN-scoped loop is a textbook example:
            general loop detection is built for network-wide broadcast storms, not a loop confined
            to a handful of VLANs. This is a real instance of{' '}
            <a href="/concepts/cross-cutting-concepts.html#signal-vs-silence">
              ambiguous silence
            </a>{' '}
            — the dashboard genuinely has nothing to tell you either way.
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
