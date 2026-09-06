import { useState } from 'react'
import { recordAttempt, getLatestAttempt } from '../../lib/progress'
import styles from './Case.css?raw'

const CONTENT_ID = 'case-snmp-oid-mismatch'

type Step = 'investigate' | 'diagnose' | 'revealed'

const MOVES = [
  {
    id: 'check-creds',
    label: 'Assume the SNMP credentials or version expired and rotate them',
    process: 'risky' as const,
    evidence: "The device accepts the new credentials fine — and the sensor is still red. Credentials were never the problem; a real auth failure would look different from this.",
  },
  {
    id: 'manual-poll',
    label: 'Manually query the exact OID yourself (snmpwalk / snmpget) and read the raw response',
    process: 'good' as const,
    evidence: 'The response is "No Such Object" — not a timeout, not a refusal. The device answered; it just doesn\'t have anything at that specific tree location anymore.',
  },
  {
    id: 'reboot-device',
    label: 'Reboot the device and see if the sensor recovers',
    process: 'risky' as const,
    evidence: "The device comes back up healthy. The sensor is still red — a reboot can't fix an OID that no longer exists at the address the monitoring tool is polling.",
  },
] as const

const DIAGNOSES = [
  { id: 'oid-renumbered', label: 'The firmware upgrade renumbered the OID — the monitoring tool is polling a location that no longer maps to that value' },
  { id: 'device-down', label: 'The device itself is down' },
  { id: 'wrong-creds', label: 'The SNMP credentials are wrong' },
] as const

const CORRECT_DIAGNOSIS = 'oid-renumbered'

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
        An SNMP sensor that's monitored this device for years suddenly shows red, right after a
        firmware upgrade.
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
            "No Such Object" is the device answering just fine — it's telling you plainly that
            nothing lives at the specific address you asked about anymore. A firmware upgrade
            renumbering OIDs is a common, mundane cause; the sensor isn't lying about the device
            being unhealthy, it's asking the wrong question now.
          </p>
          <p data-process={move.process}>
            {move.process === 'good' &&
              "Process: reading the raw response yourself is the only way to tell \"No Such Object\" apart from an actual timeout or a real value — the dashboard's red icon doesn't distinguish between them."}
            {move.process === 'risky' &&
              "Process: this retries a fix aimed at a different failure mode entirely — nothing here suggests credentials or device health were ever the problem, only a look at the actual response would show that."}
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
