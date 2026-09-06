import { useState } from 'react'
import { recordAttempt, getLatestAttempt } from '../../lib/progress'
import styles from './Case.css?raw'

const CONTENT_ID = 'case-narrativized-ticket'

type Step = 'investigate' | 'diagnose' | 'revealed'

const MOVES = [
  {
    id: 'ship-it',
    label: "Ship it — it reads well, and it's an internal ticket nobody outside the team will see",
    process: 'risky' as const,
    evidence:
      'It goes in as written. Six weeks later that endpoint comes up in a security review and someone pulls its ticket history. The record now says you investigated historical log data and verified there was no lateral movement. You either stand behind that or explain it.',
  },
  {
    id: 'read-against-reality',
    label: 'Read it line by line against what you actually did, and cut anything you can’t point to evidence for',
    process: 'good' as const,
    evidence:
      'What you actually did: read the alert, checked that endpoint for subsequent alerts, found none in thirty-plus days, and made a judgement call. That is the entire body of work. Three of the four claims in the draft describe things nobody performed.',
  },
  {
    id: 'ask-model-to-check',
    label: 'Ask the assistant whether the summary is accurate before you post it',
    process: 'risky' as const,
    evidence:
      'It confirms the summary is accurate, well-structured, and appropriate for the audience. Of course it does. It never had access to what you actually did — it is checking its own narrative for internal consistency, which the narrative has.',
  },
] as const

const DIAGNOSES = [
  {
    id: 'fabricated-work',
    label: 'It asserts investigation and verification steps that never happened — the only defensible claim is the absence of subsequent alerts',
  },
  { id: 'tone', label: "It's over-written for an internal ticket, but the substance is fine" },
  { id: 'thin', label: 'It needs more technical detail to be useful to whoever reads it later' },
] as const

const CORRECT_DIAGNOSIS = 'fabricated-work'

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
        A stale alert on your EDR platform needs a ticket entry so it can be closed. You read the
        alert, checked that endpoint for anything since, found nothing in thirty-plus days, and
        decided it was residue from something already dealt with. You gave the assistant those
        facts and asked for a ticket update.
      </p>

      <div className="case-ai">
        <div className="case-ai-label">The draft it returned</div>
        <div className="case-ai-body">
          <p>
            Investigated historical log data for the affected endpoint and adjacent systems.
            Verified no current persistent threats or lateral movement indicators present. Confirmed
            the alert as a residual artifact of a previously remediated event. Recommending closure.
          </p>
        </div>
      </div>

      {step === 'investigate' && (
        <>
          <p className="case-prompt">What do you do with it?</p>
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
          <p className="case-prompt">So what&apos;s actually wrong with that draft?</p>
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
            {diagnosisId === CORRECT_DIAGNOSIS ? 'Correct outcome.' : 'Not the right outcome.'} Four
            claims, one of them yours. You did not investigate historical log data, you did not
            examine adjacent systems, and you did not verify the absence of lateral movement. You
            observed that nothing else had fired on one endpoint in thirty days. That is a
            reasonable basis for closing a stale alert &mdash; and it is a much smaller claim than
            the one about to go into the record.
          </p>
          <div className="case-fix">
            The defensible version is shorter and not worse: &ldquo;No further alerts on this
            endpoint in 30+ days. No other indicators reviewed. Closing as residual; reopen if
            anything recurs.&rdquo; It says what happened, and it says what wasn&apos;t checked.
          </div>
          <p data-process={move.process}>
            {move.process === 'good' &&
              'Process: reading the output against what you actually did is the only check that can catch this, because the draft is internally coherent, professionally worded, and wrong. Nothing about its style signals the problem.'}
            {move.id === 'ship-it' &&
              'Process: the audience argument is the trap. A ticket is a record, and records get read later by people who were not in the room and will assume every sentence is a statement of fact.'}
            {move.id === 'ask-model-to-check' &&
              'Process: verification has to come from outside the conversation. Asking the source of a claim to validate the claim is structurally incapable of catching a fabrication — the same reason substitution means swapping the variable that differs, not re-testing the one that does not.'}
          </p>
          <p className="case-lesson">
            Worth being fair about what happened here: the assistant was not lying. You asked for a
            ticket update, and a competent ticket update has a shape &mdash; it describes what was
            investigated and what was verified. It filled that shape. Pattern completion is the
            mechanism, not deceit, which is exactly why it is so easy to wave through. The output
            sounded more thorough than the work that was done, and noticing that specific gap is
            the single most useful{' '}
            <a href="/ai-fluency/lab-discernment.html">discernment</a> reflex there is. Nobody made
            you post it. &ldquo;The AI wrote it&rdquo; is not available as a defense &mdash; see{' '}
            <a href="/ai-fluency/lab-diligence-agentic-boundary.html">Diligence</a>.
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
