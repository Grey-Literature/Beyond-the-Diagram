import { useState } from 'react'
import { getPlacement, setPlacement, type Tier } from '../../lib/progress'
import styles from './Quiz.css?raw'

// Per-module placement — this instance is for "Authn / Authz".
const MODULE_ID = 'authn-authz'

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
    id: 'vpn-denied',
    symptom: 'A VPN login is denied.',
    options: [
      { id: 'a', label: 'Ask the user to double-check their password and try again', signal: 'less-seasoned' },
      { id: 'b', label: "Check the RADIUS/NPS server's own event log for the specific Reason Code", signal: 'veteran' },
    ],
  },
  {
    id: 'http-403',
    symptom: 'A user gets a 403 error on an internal web app.',
    options: [
      { id: 'a', label: 'Have them log out and log back in', signal: 'less-seasoned' },
      { id: 'b', label: "Check NTFS and application-level authorization separately — 403 means authenticated but not permitted", signal: 'veteran' },
    ],
  },
  {
    id: 'repeated-lockout',
    symptom: 'An account keeps getting locked out.',
    options: [
      { id: 'a', label: 'Unlock the account and tell the user to try again', signal: 'less-seasoned' },
      { id: 'b', label: 'Check which source is generating the repeated bad logons (Event 4740) before unlocking anything', signal: 'veteran' },
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
          Recommended tier for <strong>Authn / Authz</strong>:{' '}
          <span data-tier={result}>{result === 'veteran' ? 'Veteran' : 'Less-seasoned'}</span>
        </p>
        <p className="quiz-explain">
          {result === 'veteran'
            ? 'You reached for the server-side log or root cause before acting — Veteran tier starts you at disambiguating authn vs. authz vs. account-state directly, rather than treating every denial as a credential problem.'
            : "You reached for the simplest user-facing fix first — Less-seasoned tier starts there, building the instinct to check the source-of-truth log before repeating an action that might make things worse."}
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
