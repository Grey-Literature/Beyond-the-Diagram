import { useState } from 'react'
import { recordAttempt, getLatestAttempt } from '../../lib/progress'
import styles from './Case.css?raw'

const CONTENT_ID = 'case-spf-lookup-limit'

type Step = 'investigate' | 'diagnose' | 'revealed'

const MOVES = [
  {
    id: 'dmarc-reports',
    label: "Check yesterday's DMARC aggregate reports for alignment failures",
    process: 'ok' as const,
    evidence: "The reports show a spike in SPF failures across every sending tool, not just one — but DMARC reports are a day behind, so this only confirms something's wrong, not what.",
  },
  {
    id: 'count-lookups',
    label: 'Pull the SPF record and count every DNS lookup it triggers (dig txt, then walk each include)',
    process: 'good' as const,
    evidence: 'The record resolves to 12 total lookups once nested includes are counted — two over the RFC 7208 ceiling of 10.',
  },
  {
    id: 'remove-newest',
    label: "Just remove the marketing team's newest SaaS include and see if mail flows again",
    process: 'risky' as const,
    evidence: "Mail starts flowing again. You still don't know if that tool was actually the one over the limit, or if you got lucky and any one of several removals would've worked.",
  },
] as const

const DIAGNOSES = [
  { id: 'permerror-ceiling', label: 'The SPF record exceeded the 10-DNS-lookup limit, causing a PermError that fails every sender' },
  { id: 'dkim-rotation', label: "A DKIM key rotated and the DNS selector record wasn't updated" },
  { id: 'dmarc-tightened', label: 'Someone tightened the DMARC policy from none to reject' },
] as const

const CORRECT_DIAGNOSIS = 'permerror-ceiling'

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
        Marketing mail started bouncing — or landing in spam — for every sender on the domain,
        right after the marketing team added a new SaaS tool's SPF <code>include:</code>.
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
            {diagnosisId === CORRECT_DIAGNOSIS ? 'Correct outcome.' : 'Not the right outcome.'} Once
            an SPF record crosses 10 DNS lookups, the check returns <code>PermError</code> for
            everyone sending as the domain — not just the integration that happened to tip it
            over. The fix is getting the total lookup count back under the ceiling, which might
            mean removing the newest addition, or might mean flattening or removing something
            older that was already close to the limit.
          </p>
          <p data-process={move.process}>
            {move.process === 'good' &&
              'Process: counting the actual lookups is the only way to confirm the mechanism — everything else is a guess dressed up as a fix.'}
            {move.process === 'risky' &&
              "Process: removing the newest addition worked here, but you still don't know why — if a different tool gets added next month and the count creeps back over 10, you're solving the same ticket blind again."}
            {move.process === 'ok' &&
              "Process: confirms something's wrong across the board, which is a fine sanity check, but a day-old aggregate report can't tell you the mechanism — only a direct count of the record's lookups can."}
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
