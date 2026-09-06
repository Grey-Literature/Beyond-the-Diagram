import { useState } from 'react'
import { getPlacement, setPlacement, type Tier } from '../../lib/progress'
import styles from './Quiz.css?raw'

// Per-module placement — this instance is for "Abstracted Networking Gear".
const MODULE_ID = 'prosumer-networking'

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
    id: 'vlan-slowdown-no-alert',
    symptom: 'Users on a couple of VLANs report slowdowns; no loop alert has fired.',
    options: [
      { id: 'a', label: 'Check the switch dashboard for any red or warning indicators', signal: 'less-seasoned' },
      { id: 'b', label: 'Watch the port/client mapping over time for a device flapping between two ports', signal: 'veteran' },
    ],
  },
  {
    id: 'ap-drops',
    symptom: 'A consumer-grade access point shows all green, but clients keep dropping.',
    options: [
      { id: 'a', label: 'Reboot the access point', signal: 'less-seasoned' },
      { id: 'b', label: 'Pull a packet capture on the client to see what happens at association/auth time', signal: 'veteran' },
    ],
  },
  {
    id: 'dashboard-quiet-during-outage',
    symptom: "A prosumer switch's dashboard shows nothing wrong during a known outage.",
    options: [
      { id: 'a', label: 'Trust the dashboard and look elsewhere for the cause', signal: 'less-seasoned' },
      { id: 'b', label: "Assume the alerting logic may simply not be built to catch this failure mode, and verify manually", signal: 'veteran' },
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
          Recommended tier for <strong>Abstracted Networking Gear</strong>:{' '}
          <span data-tier={result}>{result === 'veteran' ? 'Veteran' : 'Less-seasoned'}</span>
        </p>
        <p className="quiz-explain">
          {result === 'veteran'
            ? "You reached past the dashboard more than once — Veteran tier starts you assuming the UI may not have been built to catch this failure at all, and verifying directly instead."
            : "You reached for what the dashboard shows first — Less-seasoned tier starts there, building the instinct to eventually distrust a clean-looking UI on gear that trades diagnostic depth for simplicity."}
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
