import { useState } from 'react'
import { recordAttempt, getLatestAttempt } from '../../lib/progress'
import styles from './Case.css?raw'

const CONTENT_ID = 'case-ai-near-miss'

type Step = 'investigate' | 'diagnose' | 'revealed'

const MOVES = [
  {
    id: 'implement-ai',
    label: "Do what the AI said — reissue the certificate with the full chain and republish it",
    process: 'risky' as const,
    evidence:
      "Certificate reissued, full chain published, clients updated. The warning at that branch is unchanged. Worth noting what you learned on the way: the old certificate had eight months left on it. It was never expired.",
  },
  {
    id: 'read-client-cert',
    label: 'Have someone at the affected branch click through the warning and read the certificate they actually received',
    process: 'good' as const,
    evidence:
      'The certificate they receive is issued by "Branch-FW-SSL-Inspect" — not by your internal CA. They are not being served your certificate at all.',
  },
  {
    id: 'check-from-desk',
    label: 'Check the certificate yourself from your own workstation to confirm it is valid',
    process: 'risky' as const,
    evidence:
      "It looks perfect from here: issued by your internal CA, complete chain, eight months remaining, no warning in your browser. Which tells you the server is fine — and nothing at all about what that branch is receiving.",
  },
] as const

const DIAGNOSES = [
  {
    id: 'proxy-resign',
    label: "An SSL-inspecting device at that branch is re-signing the connection, and those clients don't trust its CA",
  },
  {
    id: 'cert-expired',
    label: 'The internal CA certificate expired, or the intermediate is missing from the chain',
  },
  { id: 'app-misconfig', label: 'The web server is bound to the wrong certificate' },
] as const

const CORRECT_DIAGNOSIS = 'proxy-resign'

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
        Users at one branch office get a certificate warning on the internal intranet site. Only
        that branch. It started sometime this week. Nobody reports changing anything.
      </p>

      <div className="case-ai">
        <div className="case-ai-label">You pasted the symptom into an AI. It answered:</div>
        <div className="case-ai-body">
          <p>
            This is almost certainly a certificate chain problem. The most common cause of a
            certificate warning on an internal site is that the certificate has expired, or that
            the intermediate CA certificate is missing from the chain the server presents — clients
            that happen to have the intermediate cached will work fine, while clients that
            don&apos;t will show exactly this warning, which explains why it looks site-specific.
          </p>
          <p>
            Reissue the certificate from your internal CA, make sure the server is configured to
            present the full chain (leaf plus intermediate, not just the leaf), and republish. That
            should resolve it for the affected users.
          </p>
        </div>
      </div>

      {step === 'investigate' && (
        <>
          <p className="case-prompt">What&apos;s your first move?</p>
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
            firewall at that branch is decrypting and re-signing HTTPS, and the GPO that
            distributes its inspection CA to the trusted root store never applied to that site.
            The server, the certificate and the chain were all fine the entire time — the clients
            were simply never being handed them.
          </p>
          <p data-process={move.process}>
            {move.process === 'good' &&
              'Process: reading the certificate the affected client actually received is the only move that could distinguish these three causes, because it is the only one taken from the vantage point where the failure happens.'}
            {move.id === 'implement-ai' &&
              'Process: you acted on a hypothesis before testing it. It cost a certificate reissue and a publish cycle, and the one genuinely useful fact it surfaced — eight months of validity left — was available in ten seconds without changing anything.'}
            {move.id === 'check-from-desk' &&
              'Process: right instinct, wrong vantage point. Substitution only tells you something when you swap the variable that differs — and here the thing that differs is the network path, so testing from your own desk confirms only that your desk works.'}
          </p>
          <p className="case-lesson">
            The AI&apos;s answer was not stupid. An expired certificate or a missing intermediate
            genuinely is the most common cause of that symptom, and the explanation it offered for
            why it looked site-specific was internally coherent and completely plausible. It was
            also wrong here — and nothing inside the answer itself could have told you that. Only
            evidence from the live system could. Treat an AI hypothesis exactly like a search
            result that matches your symptom: a candidate to disprove cheaply, never a verdict to
            implement on confidence.
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
