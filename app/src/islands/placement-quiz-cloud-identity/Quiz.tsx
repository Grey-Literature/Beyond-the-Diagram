import { useState } from 'react'
import { getPlacement, setPlacement, type Tier } from '../../lib/progress'
import styles from './Quiz.css?raw'

// Per-module placement — this instance is for "Cloud Identity".
const MODULE_ID = 'cloud-identity'

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
    id: 'group-add-no-app',
    symptom: "A user was added to a group but doesn't have the app it should grant yet.",
    options: [
      { id: 'a', label: 'Wait a while and have them check again later', signal: 'less-seasoned' },
      { id: 'b', label: 'Check the Entra ID admin center to see which pipeline stage the change is actually at', signal: 'veteran' },
    ],
  },
  {
    id: 'ca-blocks-user',
    symptom: 'A Conditional Access policy seems to be blocking a user unexpectedly.',
    options: [
      { id: 'a', label: 'Temporarily disable the policy to confirm it\'s the cause', signal: 'less-seasoned' },
      { id: 'b', label: 'Use the Conditional Access What-If tool to simulate the sign-in without changing anything live', signal: 'veteran' },
    ],
  },
  {
    id: 'intune-pending',
    symptom: "Intune shows a device policy as \"Pending\" for hours.",
    options: [
      { id: 'a', label: 'Force a device sync from the Intune console', signal: 'less-seasoned' },
      { id: 'b', label: 'Check whether the underlying group membership or directory write has actually completed yet', signal: 'veteran' },
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
          Recommended tier for <strong>Cloud Identity</strong>:{' '}
          <span data-tier={result}>{result === 'veteran' ? 'Veteran' : 'Less-seasoned'}</span>
        </p>
        <p className="quiz-explain">
          {result === 'veteran'
            ? "You reached for the tools that show pipeline state directly — Veteran tier starts you at reasoning about which propagation stage you're stuck at, rather than retrying the end of the pipeline."
            : "You reached for the simplest retry-or-wait move first — Less-seasoned tier starts there, building the instinct to check state directly once the simple retry doesn't resolve it."}
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
