import { useState } from 'react'
import { recordAttempt, getLatestAttempt } from '../../lib/progress'
import styles from './Case.css?raw'

const CONTENT_ID = 'case-radius-reason-code'

type Step = 'investigate' | 'diagnose' | 'revealed'

const MOVES = [
  {
    id: 'check-nps-log',
    label: "Check the NPS server's own Event Viewer for the actual Reason Code",
    process: 'good' as const,
    evidence: 'Event ID 6273, Reason Code 65.',
  },
  {
    id: 'reset-password',
    label: 'Have the user reset their password and try again',
    process: 'risky' as const,
    evidence: 'Still denied. The password was never the problem — and now there\'s an unnecessary password reset sitting in the audit log.',
  },
  {
    id: 'retry-login',
    label: 'Have the user try logging in a few more times to rule out a fluke',
    process: 'risky' as const,
    evidence: "The account is now locked out from the repeated attempts — retrying just extends the lockout window, and whatever the original denial reason was is still sitting there underneath it, unaddressed.",
  },
] as const

const DIAGNOSES = [
  { id: 'authz-failure', label: 'Authorization failure — valid credentials, but network access policy denies this account' },
  { id: 'authn-failure', label: 'Authentication failure — the credentials themselves are wrong' },
  { id: 'account-locked', label: 'The account is locked out' },
] as const

const CORRECT_DIAGNOSIS = 'authz-failure'

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
        A user's VPN login is denied. The RADIUS server just logs "Access-Reject" — nothing else
        visible to the user or the VPN admin console.
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
            RADIUS is the sharpest example of a client learning nothing —{' '}
            <a href="/concepts/cross-cutting-concepts.html#trust-boundary-flattening">
              trust-boundary flattening
            </a>{' '}
            collapses every possible reason into one flat "Access-Reject," partly as deliberate
            security hygiene. Reason Code 65 specifically means the credentials were valid but a
            network access policy denied the connection anyway — a completely different fix from
            Reason Code 16 (bad credentials). Only the server-side log disambiguates; nothing
            client-visible ever will.
          </p>
          <p data-process={move.process}>
            {move.process === 'good' &&
              "Process: the server log is the only place this information exists at all — everything client-visible was designed to hide it."}
            {move.process === 'risky' &&
              "Process: acting on the client-visible symptom without checking the source-of-truth log risks making things worse — a lockout in particular closes off the very account you'd need to test with next."}
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
