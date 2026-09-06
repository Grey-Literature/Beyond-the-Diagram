import { useState } from 'react'
import { getPlacement, setPlacement, type Tier } from '../../lib/progress'
import styles from './Quiz.css?raw'

// Per-module placement — this instance is for "Email Authentication".
const MODULE_ID = 'email-authentication'

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
    id: 'vendor-spam',
    symptom: "A vendor's marketing emails keep landing in the recipients' spam folders.",
    options: [
      { id: 'a', label: "Check the vendor's SPF/DKIM setup guide and re-verify the DNS records line by line", signal: 'less-seasoned' },
      { id: 'b', label: 'Pull the raw email headers and check the Authentication-Results header directly, per mechanism', signal: 'veteran' },
    ],
  },
  {
    id: 'dmarc-spike',
    symptom: 'DMARC aggregate reports show a sudden spike in failures for one subdomain.',
    options: [
      { id: 'a', label: 'Open the report in a browser-based DMARC analyzer and read the summary', signal: 'less-seasoned' },
      { id: 'b', label: 'Parse the raw XML report yourself and check the alignment mode (relaxed vs. strict) per record', signal: 'veteran' },
    ],
  },
  {
    id: 'spf-suddenly-fails',
    symptom: 'SPF suddenly stops validating mail from one specific SaaS platform your company uses.',
    options: [
      { id: 'a', label: "Check the SaaS platform's own status page for a reported outage", signal: 'less-seasoned' },
      { id: 'b', label: 'Count every DNS lookup the SPF record triggers by hand, including nested includes', signal: 'veteran' },
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
          Recommended tier for <strong>Email Authentication</strong>:{' '}
          <span data-tier={result}>{result === 'veteran' ? 'Veteran' : 'Less-seasoned'}</span>
        </p>
        <p className="quiz-explain">
          {result === 'veteran'
            ? 'You reached for the raw records and headers more than once — Veteran tier starts you straight at reading SPF/DKIM/DMARC output directly, skipping the guided setup-checklist framing.'
            : "You reached for guides and status pages first — Less-seasoned tier starts there, building the instinct to rule out the obvious before parsing raw authentication output yourself."}
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
