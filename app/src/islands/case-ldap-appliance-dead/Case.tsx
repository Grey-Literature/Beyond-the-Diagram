import { useState } from 'react'
import { recordAttempt, getLatestAttempt } from '../../lib/progress'
import styles from './Case.css?raw'

const CONTENT_ID = 'case-ldap-appliance-dead'

type Step = 'investigate' | 'diagnose' | 'revealed'

const MOVES = [
  {
    id: 'known-good-account',
    label: 'Test with a known-good account through the identical login path',
    process: 'good' as const,
    evidence: 'The known-good account fails too, with the exact same generic "invalid credentials" message. This was never about anyone\'s individual password.',
  },
  {
    id: 'connection-log',
    label: "Check the appliance's connection/session log",
    process: 'ok' as const,
    evidence: 'Shows connections completing and sessions terminating immediately after — no detail on why. The connection log was never going to have the auth-specific detail.',
  },
  {
    id: 'reset-passwords',
    label: 'Start resetting the affected users\' passwords',
    process: 'risky' as const,
    evidence: "Doesn't help, and now there are several unnecessary password resets to clean up on top of an outage that's still ongoing.",
  },
] as const

const DIAGNOSES = [
  { id: 'auth-path-dead', label: "The appliance's entire auth path is dead — an expired LDAPS cert, an unreachable DC, or the appliance's own service account issue" },
  { id: 'mass-expiry', label: "Every affected user's password happened to expire on the same day" },
  { id: 'firewall-block', label: 'A firewall rule is blocking new VPN connections' },
] as const

const CORRECT_DIAGNOSIS = 'auth-path-dead'

export function Case() {
  const [step, setStep] = useState<Step>('investigate')
  const [moveId, setMoveId] = useState<string | null>(null)
  const [diagnosisId, setDiagnosisId] = useState<string | null>(null)

  const move = MOVES.find((m) => m.id === moveId) ?? null

  function chooseMove(id: string) {
    setMoveId(id)
    setStep('diagnose')
  }

  function chooseDiagnosis(id: string) {
    setDiagnosisId(id)
    const correct = id === CORRECT_DIAGNOSIS
    const processGood = move?.process === 'good'
    recordAttempt(CONTENT_ID, id, correct, { move: moveId, processGood })
    setStep('revealed')
  }

  function reset() {
    setStep('investigate')
    setMoveId(null)
    setDiagnosisId(null)
  }

  const last = step === 'investigate' ? getLatestAttempt(CONTENT_ID) : null

  return (
    <div className="case">
      <style>{styles}</style>
      <p className="case-symptom">
        VPN logins for every user started failing at once, today. The LDAP-auth appliance shows a
        generic "invalid credentials" for all of them, simultaneously.
      </p>

      {step === 'investigate' && (
        <>
          <p className="case-prompt">What's your first move?</p>
          <div className="case-options">
            {MOVES.map((m) => (
              <button key={m.id} type="button" onClick={() => chooseMove(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'diagnose' && move && (
        <>
          <div className="case-evidence">{move.evidence}</div>
          <p className="case-prompt">Given that, what's actually going on?</p>
          <div className="case-options">
            {DIAGNOSES.map((d) => (
              <button key={d.id} type="button" onClick={() => chooseDiagnosis(d.id)}>
                {d.label}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'revealed' && move && (
        <div className="case-feedback">
          <p data-correct={diagnosisId === CORRECT_DIAGNOSIS}>
            {diagnosisId === CORRECT_DIAGNOSIS ? 'Correct outcome.' : 'Not the right outcome.'}{' '}
            Everyone failing at once, instantly, is the tell: this is a distinct and more severe
            failure class than any individual credential problem. The appliance's entire auth path
            is down — it can't reach a DC at all, a DC's LDAPS certificate quietly expired (a
            silent, calendar-driven failure with nothing to do with any user's password activity),
            or in a search-then-bind setup, the appliance's own service account is expired,
            disabled, or locked. Testing individual passwords is pointless once you're here.
          </p>
          <p data-process={move.process}>
            {move.process === 'good' &&
              "Process: substituting a known-good account through the identical path is the fastest way to prove or rule out \"this is about credentials\" entirely — one test, unambiguous answer."}
            {move.process === 'ok' &&
              "Process: reasonable to check, but the connection log was never going to carry the auth-specific detail — that lives in the appliance's dedicated auth/debug log instead."}
            {move.process === 'risky' &&
              "Process: this treats the symptom as if it were about individual accounts before confirming that's even the right category of problem — costly and, here, completely beside the point."}
          </p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </div>
      )}

      {last && (
        <p className="case-history">
          Last attempt: {last.correct ? 'correct outcome' : 'incorrect outcome'}
          {typeof last.meta?.processGood === 'boolean' && (last.meta.processGood ? ', good process' : ', risky process')} (
          {new Date(last.timestamp).toLocaleString()})
        </p>
      )}
    </div>
  )
}
