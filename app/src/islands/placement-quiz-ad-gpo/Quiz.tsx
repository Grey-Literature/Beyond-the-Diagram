import { useState } from 'react'
import { getPlacement, setPlacement, type Tier } from '../../lib/progress'
import styles from './Quiz.css?raw'

// Per-module placement — this instance is for "AD / GPO".
const MODULE_ID = 'ad-gpo'

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
    id: 'slow-login-print-fail',
    symptom: "A user's login is slow and printing fails intermittently.",
    options: [
      { id: 'a', label: 'Check Event Viewer for logon errors and run gpresult /r', signal: 'less-seasoned' },
      { id: 'b', label: "Check whether the client fell back to a cached logon, since that alone explains both symptoms", signal: 'veteran' },
    ],
  },
  {
    id: 'gpo-one-site-not-other',
    symptom: 'A GPO setting works at one site but not another.',
    options: [
      { id: 'a', label: 'Re-link the GPO to the OU and force a gpupdate', signal: 'less-seasoned' },
      { id: 'b', label: 'Compare GPO version numbers across sites (gpresult /h) before touching anything', signal: 'veteran' },
    ],
  },
  {
    id: 'trust-error',
    symptom: 'A workstation shows a domain trust relationship error.',
    options: [
      { id: 'a', label: 'Remove it from the domain and rejoin', signal: 'less-seasoned' },
      { id: 'b', label: 'Run Test-ComputerSecureChannel first to confirm it\'s actually a secure-channel issue', signal: 'veteran' },
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
          Recommended tier for <strong>AD / GPO</strong>:{' '}
          <span data-tier={result}>{result === 'veteran' ? 'Veteran' : 'Less-seasoned'}</span>
        </p>
        <p className="quiz-explain">
          {result === 'veteran'
            ? 'You reached for the specific diagnostic command before acting — Veteran tier starts you straight at confirming mechanism (secure channel state, replication version) rather than the general symptom checklist.'
            : "You reached for the general first-response checklist — Less-seasoned tier starts there, building the instinct to gather basic evidence before jumping to a specific diagnosis."}
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
