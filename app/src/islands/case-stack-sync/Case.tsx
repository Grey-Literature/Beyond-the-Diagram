import { useState } from 'react'
import { recordAttempt, getLatestAttempt } from '../../lib/progress'
import styles from './Case.css?raw'

const CONTENT_ID = 'case-stack-sync'

type Step = 'investigate' | 'diagnose' | 'revealed'

const MOVES = [
  {
    id: 'check-interfaces',
    label: 'Follow the suggestion — pull interface counters and duplex settings on the stack uplinks',
    process: 'risky' as const,
    evidence:
      'Everything is clean. No CRC errors, no drops, no duplex mismatch, no interface flaps. Every member reports operational. You have spent twenty minutes confirming that nothing is visibly wrong, which is exactly what the users have been telling you.',
  },
  {
    id: 'check-stack-state',
    label: 'Question the sequencing — loss to many destinations at once points at the shared layer, so check stack membership and sync state first',
    process: 'good' as const,
    evidence:
      'One member is only partially synced. The control plane disagrees with itself about membership, so traffic through that member is forwarded inconsistently. No physical-layer errors anywhere, because the hardware is genuinely fine.',
  },
  {
    id: 'escalate-circuit',
    label: 'Escalate to the circuit provider — users are mostly complaining about internet-facing applications',
    process: 'risky' as const,
    evidence:
      'The provider tests clean, which you could have predicted: your own triangulation already showed the same loss to internal destinations that never touch the circuit. You have spent a day of ticket time re-proving something you had evidence against before you opened it.',
  },
] as const

const DIAGNOSES = [
  {
    id: 'stack-sync',
    label: 'A stack member is partially synced — the control plane is confused about membership and forwards inconsistently',
  },
  { id: 'interface-errors', label: 'A physical-layer problem on one of the uplinks — errors or a duplex mismatch' },
  { id: 'circuit', label: 'Degradation on the site’s internet circuit' },
] as const

const CORRECT_DIAGNOSIS = 'stack-sync'

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
        One site reports slow email, remote sessions dropping, and degraded access to shares at
        other sites. Two other sites are fine. The circuit is provisioned well above what the site
        actually uses. Nobody reports changing anything.
      </p>

      <div className="case-context">
        <span className="case-context-label">What the session has established so far</span>
        <ul>
          <li>You ran a pull-prompt session; the questions were good and you answered them with real data.</li>
          <li>Ping triangulation from machines above and below the site&apos;s access-switch stack shows packet loss with variance, to several destinations at once.</li>
          <li>The loss appears to internal destinations as well as external ones.</li>
          <li>That pattern rules out routing, the firewall, and the circuit. Everything at this site transits the stack.</li>
        </ul>
      </div>

      <div className="case-ai">
        <div className="case-ai-label">The assistant&apos;s next suggestion</div>
        <div className="case-ai-body">
          <p>
            Good — that narrows it to the stack. Next, check the stack uplinks for interface errors
            and duplex mismatches. CRC errors or a speed/duplex negotiation problem on a member
            uplink would produce exactly this kind of intermittent loss across multiple flows.
          </p>
        </div>
      </div>

      {step === 'investigate' && (
        <>
          <p className="case-prompt">What&apos;s your next move?</p>
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
          <p className="case-prompt">Given that, what&apos;s actually going on?</p>
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
            {diagnosisId === CORRECT_DIAGNOSIS ? 'Correct outcome.' : 'Not the right outcome.'} A
            member sitting in a partially-synced state passes traffic inconsistently while every
            physical indicator stays clean, because nothing physical is broken. A full stack cycle
            clears it.
          </p>
          <p data-process={move.process}>
            {move.process === 'good' &&
              'Process: you overrode a suggestion that was not wrong, on the grounds that it was wrongly ordered. That is the harder version of this skill — rejecting good advice because it belongs later in the sequence, rather than waiting for it to fail.'}
            {move.id === 'check-interfaces' &&
              'Process: you followed a reasonable instruction without asking whether it fit the symptom profile you had already built. The check itself was cheap; the cost was the twenty minutes and the false reassurance that came with a clean result.'}
            {move.id === 'escalate-circuit' &&
              'Process: this abandons evidence you already held. Triangulation had eliminated the circuit before you started, and escalating anyway trades your own findings for someone else’s confirmation of them.'}
          </p>
          <div className="case-epilogue">
            <strong>What actually changed:</strong> someone had rebooted a single stack member after
            hours. They had clearance to do it, it worked, and they did not log it &mdash; because
            in their head, rebooting one member of a redundant stack was not a &ldquo;change.&rdquo;
            The irony is that the cautious move caused this: bouncing the whole stack costs about
            ninety seconds of downtime and carries no sync risk at all. The careful half-measure was
            the more dangerous one.
          </div>
          <p className="case-lesson">
            Two things worth taking from this. First, the assistant&apos;s advice was accurate and
            useless &mdash; interface errors really do cause this symptom profile, and{' '}
            <strong>clean interface counters on a stack with a sync problem look identical to clean
            interface counters on a healthy stack.</strong> A correct answer that cannot distinguish
            between your hypotheses has not helped you. That is{' '}
            <a href="/ai-fluency/lab-discernment.html">product versus process discernment</a> coming
            apart: right information, wrong position in the half-split. Second, this is a variant of{' '}
            <a href="/concepts/diagnostic-methodology.html">&ldquo;what changed&rdquo;</a> worth
            naming on its own &mdash; not a failure with no proximate change, but a change that
            happened and was never reported, because the person who made it did not classify it as
            one. Ask what was <em>done</em>, not what was changed.
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
