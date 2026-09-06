import { useState } from 'react'
import { recordAttempt, getLatestAttempt } from '../../lib/progress'
import styles from './Case.css?raw'

const CONTENT_ID = 'case-dns-split-horizon'

type Step = 'investigate' | 'diagnose' | 'revealed'

const MOVES = [
  {
    id: 'nslookup-internal',
    label: 'nslookup the hostname against the internal DNS server',
    process: 'ok' as const,
    evidence: 'Resolves correctly to the private IP, from a machine on the internal network. Internal resolution is fine — this alone doesn\'t explain what home users see.',
  },
  {
    id: 'nslookup-public',
    label: 'nslookup the hostname against a public resolver (8.8.8.8)',
    process: 'good' as const,
    evidence: 'Public resolution returns a completely different answer than the internal one — an IP that isn\'t reachable from outside the corporate network at all.',
  },
  {
    id: 'hosts-file',
    label: 'Tell affected users to add a hosts file entry as a workaround',
    process: 'risky' as const,
    evidence: "It works for the users who do it. It tells you nothing about why the DNS records disagree, and it's now something someone has to remember to remove later.",
  },
] as const

const DIAGNOSES = [
  { id: 'split-horizon-drift', label: 'Split-horizon DNS: the internal and external views of the zone disagree' },
  { id: 'ssl-cert', label: "The intranet site's SSL certificate is misconfigured" },
  { id: 'home-router-dns', label: "A DNS caching bug in users' home routers" },
] as const

const CORRECT_DIAGNOSIS = 'split-horizon-drift'

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
        Employees can reach the intranet site by IP but not by name from home — though it works
        fine, by name, from the office.
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
            "Works from the office, not from home" is the classic split-horizon fingerprint — the
            office uses the internal resolver, home uses a public one, and the two views of the
            zone have drifted apart. This isn't automatically a bug — confirm split-horizon is
            actually intended for this name before assuming the external view needs fixing.
          </p>
          <p data-process={move.process}>
            {move.process === 'good' &&
              'Process: comparing the two resolvers directly is what actually reveals the split — you can\'t see it from one vantage point alone.'}
            {move.process === 'risky' &&
              "Process: the hosts-file workaround fixes the symptom for exactly the people who do it, and leaves the actual DNS drift undiagnosed and unfixed for everyone else."}
            {move.process === 'ok' &&
              "Process: confirms internal resolution works, but a single vantage point can't reveal a split — you need to compare it against another view."}
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
