import { useState } from 'react'
import { recordAttempt, getLatestAttempt } from '../../lib/progress'
import styles from './Case.css?raw'

const CONTENT_ID = 'case-vlan-loop'

type Step = 'investigate' | 'diagnose' | 'revealed'

const MOVES = [
  {
    id: 'check-loop-alerts',
    label: "Check the switch's loop-detection alerts and logs",
    process: 'ok' as const,
    evidence: 'Nothing. No loop alert has ever fired, and there\'s no network-wide broadcast storm either.',
  },
  {
    id: 'watch-port-mapping',
    label: "Watch the upstream switch's port/client mapping over time, looking for anything flapping between ports",
    process: 'good' as const,
    evidence: 'One device shows up on port 5 — then a few minutes later on port 17 — then back on port 5 again. It keeps repeating.',
  },
  {
    id: 'ask-ai',
    label: "Ask an AI tool what's causing the slowdown",
    process: 'risky' as const,
    evidence: "It correctly guesses \"probably a loop\" fairly quickly — general diagnosis is cheap — but it can't tell you where, since it has no visibility into the switch's actual live state.",
  },
] as const

const DIAGNOSES = [
  { id: 'vlan-scoped-loop', label: 'A physical loop confined to specific VLANs, invisible to network-wide loop detection' },
  { id: 'overloaded-ap', label: 'A single overloaded access point' },
  { id: 'dhcp-misconfig', label: 'A misconfigured DHCP scope' },
] as const

const CORRECT_DIAGNOSIS = 'vlan-scoped-loop'

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
        Users on a couple of VLANs are seeing massive slowdowns and intermittent drops. No loop
        alert has fired, and there's no network-wide broadcast storm.
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
            General loop detection never fires here because the loop only exists within a subset
            of VLANs, never presenting as a network-wide storm. A device flapping repeatedly
            between two ports in the forwarding table <em>is</em> the loop's fingerprint — visible
            only through direct{' '}
            <a href="/concepts/diagnostic-methodology.html#behavioral-temporal">
              behavioral/temporal observation
            </a>
            , never through any alert the switch was built to raise.
          </p>
          <p data-process={move.process}>
            {move.process === 'good' &&
              "Process: there's nothing to read here, only something to watch — this is exactly the diagnostic move that finds a fault no alert was ever designed to surface."}
            {move.process === 'risky' &&
              "Process: general diagnosis (\"probably a loop\") is genuinely cheap and often right — but finding where requires visibility into live switch state that no outside tool has, AI included."}
            {move.process === 'ok' &&
              "Process: reasonable to rule out — but a switch's alerting logic may simply never have been designed to catch a VLAN-scoped loop at all. Absence of an alert isn't evidence of absence."}
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
