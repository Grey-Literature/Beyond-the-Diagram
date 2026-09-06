import { useState } from 'react'
import { recordAttempt, getLatestAttempt } from '../../lib/progress'
import styles from './Case.css?raw'

const CONTENT_ID = 'case-entra-group-sync'

type Step = 'investigate' | 'diagnose' | 'revealed'

const MOVES = [
  {
    id: 'force-sync',
    label: "Force an immediate device sync from the Intune console and see if the app shows up",
    process: 'risky' as const,
    evidence: 'The sync completes successfully — and the app still does not appear. The device dutifully checked in, but there was nothing new for it to pick up yet.',
  },
  {
    id: 'check-membership',
    label: 'Check the Entra admin center directly — has the group membership itself actually taken effect yet?',
    process: 'good' as const,
    evidence: "The group's member list in Entra ID still doesn't show this user — the directory write from the group owner happened only 10 minutes ago, and dynamic group membership re-evaluation has no published SLA.",
  },
  {
    id: 'reboot-device',
    label: "Have the user restart their machine",
    process: 'risky' as const,
    evidence: "The app still isn't there after the restart. A reboot doesn't make a group membership propagate any faster — it just re-runs the same client-application stage against the same stale directory state.",
  },
] as const

const DIAGNOSES = [
  { id: 'pipeline-in-flight', label: "The change is genuinely still propagating — group membership hasn't re-evaluated yet, so nothing downstream has anything to act on" },
  { id: 'assignment-broken', label: 'The Intune app assignment itself is misconfigured' },
  { id: 'device-not-enrolled', label: "The device was never actually enrolled in Intune" },
] as const

const CORRECT_DIAGNOSIS = 'pipeline-in-flight'

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
        A user was just added to a group that should grant them an app via Intune. Two hours
        later, they still don't have it.
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
            "It's assigned, why doesn't the user have it" can be failing at any one of several
            independently-owned stages — directory write, group re-evaluation, policy push, client
            check-in — and forcing a sync only helps once the <em>earlier</em> stages have already
            finished. Two hours isn't unusual for dynamic group re-evaluation specifically, which
            has no published SLA.
          </p>
          <p data-process={move.process}>
            {move.process === 'good' &&
              'Process: checking whether the membership itself has actually landed yet tells you which stage of the pipeline you\'re stuck at, instead of guessing at the end and working backwards.'}
            {move.process === 'risky' &&
              "Process: this retries a later stage of the pipeline without confirming the earlier stages actually finished — if the group membership hasn't landed yet, nothing downstream has anything new to act on, no matter how many times you re-trigger it."}
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
