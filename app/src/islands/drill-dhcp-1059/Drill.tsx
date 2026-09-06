import { useState } from 'react'
import { getLatestAttempt, recordAttempt } from '../../lib/progress'
import './Drill.css'

const CONTENT_ID = 'drill-dhcp-1059'

const OPTIONS = [
  { id: 'genuinely-unauthorized', label: 'A genuinely unauthorized DHCP server — should be removed' },
  { id: 'fail-closed', label: "Fail-closed: the authorization check couldn't complete yet, not a real deauthorization" },
  { id: 'service-crash', label: 'An unrelated service crash — restart and move on' },
] as const

const CORRECT_ID = 'fail-closed'

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
      <p className="drill-prompt">Classify this Event Viewer entry — no other context given:</p>
      <pre className="drill-string">
{`Event ID: 1059
Source: DhcpServer

The DHCP/BINL service on the local machine, belonging to the
Windows Administrative domain <domain>, has determined that it
is not authorized to start. It has stopped executing.`}
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
            {choice === CORRECT_ID ? 'Correct.' : 'Not quite.'} This is the classic{' '}
            <strong>DHCP authorization race condition</strong>: on a box that's both a domain
            controller and a DHCP server, the DHCP Server service can start before NTDS is ready
            to answer the AD authorization query — and the check <strong>fails closed</strong>,
            treating "couldn't verify yet" the same as "not authorized," even though the proof is
            sitting on the same disk. Fix: a <code>DependOnService = NTDS</code> registry value on
            the DHCPServer service (older OS versions used Delayed Start instead). It looks
            identical to a real deauthorization unless you know this pattern.
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
