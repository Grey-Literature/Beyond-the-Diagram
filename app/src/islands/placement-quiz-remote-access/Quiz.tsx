import { useState } from 'react'
import { getPlacement, setPlacement, type Tier } from '../../lib/progress'
import styles from './Quiz.css?raw'

// Per-module placement — this instance is for "Remote Access / VPN".
const MODULE_ID = 'remote-access'

interface Option {
  id: string
  label: string
  signal: Tier
}

interface Question {
  id: string
  symptom: string
  options: [Option, Option]
}

const QUESTIONS: Question[] = [
  {
    id: 'all-denied',
    symptom: 'Every VPN user is suddenly denied at once.',
    options: [
      { id: 'a', label: 'Check whether the VPN service itself is running', signal: 'less-seasoned' },
      { id: 'b', label: "Test a known-good account through the identical path to confirm it's not about credentials at all", signal: 'veteran' },
    ],
  },
  {
    id: 'ldap-generic-invalid',
    symptom: "An LDAP-auth appliance shows a generic \"invalid credentials\" for a user.",
    options: [
      { id: 'a', label: "Reset the affected user's password", signal: 'less-seasoned' },
      { id: 'b', label: 'Run ldapsearch from a neutral host with the same service account to test directory health independently', signal: 'veteran' },
    ],
  },
  {
    id: 'firewall-auth-stuck',
    symptom: "A firewall's VPN auth stopped working right after an AD server reboot.",
    options: [
      { id: 'a', label: 'Reboot the firewall and see if that fixes it', signal: 'less-seasoned' },
      { id: 'b', label: "Check whether the firewall's auth service needs a manual restart — some don't reconnect gracefully after an upstream bounce", signal: 'veteran' },
    ],
  },
]

export function Quiz() {
  const [index, setIndex] = useState(0)
  const [signals, setSignals] = useState<Tier[]>([])
  const [result, setResult] = useState<Tier | null>(() => getPlacement(MODULE_ID))

  function answer(signal: Tier) {
    const next = [...signals, signal]
    if (index + 1 < QUESTIONS.length) {
      setSignals(next)
      setIndex(index + 1)
      return
    }
    const veteranCount = next.filter((s) => s === 'veteran').length
    const tier: Tier = veteranCount >= Math.ceil(QUESTIONS.length / 2) ? 'veteran' : 'less-seasoned'
    setPlacement(MODULE_ID, tier)
    setResult(tier)
  }

  function retake() {
    setIndex(0)
    setSignals([])
    setResult(null)
  }

  if (result) {
    return (
      <div className="quiz">
        <style>{styles}</style>
        <p className="quiz-result">
          Recommended tier for <strong>Remote Access / VPN</strong>:{' '}
          <span data-tier={result}>{result === 'veteran' ? 'Veteran' : 'Less-seasoned'}</span>
        </p>
        <p className="quiz-explain">
          {result === 'veteran'
            ? "You reached for a test that isolates scope (individual vs. everyone) before acting — Veteran tier starts you at distinguishing a credential problem from a whole-path failure."
            : "You reached for the most direct service-level check first — Less-seasoned tier starts there, building the instinct to confirm basic service health before ruling out individual accounts."}
        </p>
        <button type="button" onClick={retake}>
          Retake
        </button>
      </div>
    )
  }

  const question = QUESTIONS[index]

  return (
    <div className="quiz">
      <style>{styles}</style>
      <p className="quiz-progress">
        Question {index + 1} of {QUESTIONS.length}
      </p>
      <p className="quiz-symptom">{question.symptom}</p>
      <p className="quiz-prompt">What's your first move?</p>
      <div className="quiz-options">
        {question.options.map((opt) => (
          <button key={opt.id} type="button" onClick={() => answer(opt.signal)}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
