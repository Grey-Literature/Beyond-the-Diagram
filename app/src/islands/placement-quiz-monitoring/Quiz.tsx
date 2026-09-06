import { useState } from 'react'
import { getPlacement, setPlacement, type Tier } from '../../lib/progress'
import styles from './Quiz.css?raw'

// Per-module placement — this instance is for "Monitoring".
const MODULE_ID = 'monitoring'

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
    id: 'snmp-red',
    symptom: 'An SNMP sensor goes red with no other detail visible.',
    options: [
      { id: 'a', label: 'Restart the monitored device and see if it clears', signal: 'less-seasoned' },
      { id: 'b', label: 'Manually poll the exact OID with snmpget and read the raw response', signal: 'veteran' },
    ],
  },
  {
    id: 'ping-check-fails',
    symptom: 'A ping-based monitoring check reports failure.',
    options: [
      { id: 'a', label: 'Try pinging the same host from a different machine', signal: 'less-seasoned' },
      { id: 'b', label: 'Read the exact ICMP message — timeout vs. host unreachable vs. port unreachable — before assuming anything', signal: 'veteran' },
    ],
  },
  {
    id: 'http-monitor-down',
    symptom: 'An HTTP monitor flags a site as down.',
    options: [
      { id: 'a', label: 'Open the site in a browser to see if it loads', signal: 'less-seasoned' },
      { id: 'b', label: 'Curl the endpoint directly and check the actual status code and TLS handshake', signal: 'veteran' },
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
          Recommended tier for <strong>Monitoring</strong>:{' '}
          <span data-tier={result}>{result === 'veteran' ? 'Veteran' : 'Less-seasoned'}</span>
        </p>
        <p className="quiz-explain">
          {result === 'veteran'
            ? 'You reached for the raw protocol response more than once — Veteran tier starts you straight at reading the actual error code or ICMP message, skipping the surface-level retry.'
            : "You reached for the simplest reproduction step first — Less-seasoned tier starts there, building the instinct to isolate the symptom before reading raw protocol output."}
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
