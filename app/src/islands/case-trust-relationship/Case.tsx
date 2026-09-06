import { useState } from 'react'
import { recordAttempt, getLatestAttempt } from '../../lib/progress'
import './Case.css'

const CONTENT_ID = 'case-trust-relationship'

type Step = 'investigate' | 'diagnose' | 'revealed'

const MOVES = [
  {
    id: 'secure-channel',
    label: 'Run Test-ComputerSecureChannel on the workstation',
    process: 'good' as const,
    evidence:
      'Test-ComputerSecureChannel returns False. The machine can reach a domain controller — this is not a connectivity problem.',
  },
  {
    id: 'rejoin',
    label: 'Just remove it from the domain and rejoin immediately',
    process: 'risky' as const,
    evidence:
      "It works. You never found out why — if this happens again next week on the same machine, you're back here with no more information than you started with.",
  },
  {
    id: 'ping-dc',
    label: 'Ping a domain controller to confirm basic connectivity',
    process: 'ok' as const,
    evidence:
      'Ping succeeds. The machine can reach the network and a DC — connectivity itself is not the issue, but this alone doesn\'t explain the error message.',
  },
] as const

const DIAGNOSES = [
  { id: 'secure-channel-desync', label: "Secure channel / computer account password desynced" },
  { id: 'never-reached-dc', label: 'The machine never reached any domain controller at all' },
  { id: 'dns-misconfig', label: 'DNS is pointing the machine at the wrong domain controller' },
] as const

const CORRECT_DIAGNOSIS = 'secure-channel-desync'

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
      <p className="case-symptom">
        A user calls in: <em>"It says something about a trust relationship, I can't log in."</em>
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
            {diagnosisId === CORRECT_DIAGNOSIS ? 'Correct outcome.' : 'Not the right outcome.'} The
            machine reached a DC fine — the secure channel (the computer account's own password)
            is what's desynced. <code>Test-ComputerSecureChannel -Repair</code> or a rejoin both fix
            it, but only the check tells you rejoining wasn't blind luck.
          </p>
          <p data-process={move.process}>
            {move.process === 'good' &&
              'Process: you gathered evidence before committing to a fix — that\'s the move that scales when the quick fix stops working.'}
            {move.process === 'risky' &&
              "Process: you fixed it without finding out why. This time it probably works — but if it recurs, you're starting from zero again. A reboot or a rejoin \"fixing\" something isn't the same as understanding it."}
            {move.process === 'ok' &&
              "Process: reasonable first check, but it only ruled out connectivity — it didn't actually get you to the cause."}
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
