import { useState } from 'react'
import { getPlacement, setPlacement, type Tier } from '../../lib/progress'
import styles from './Quiz.css?raw'

// Per-module placement — this instance is for "AI Fluency".
const MODULE_ID = 'ai-fluency'

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
    id: 'first-ask',
    symptom: "You're stuck on an ambiguous symptom and decide to ask an AI for help.",
    options: [
      { id: 'a', label: 'Describe the symptom and ask what is most likely causing it', signal: 'less-seasoned' },
      {
        id: 'b',
        label: 'Describe the symptom, state your access and tooling, and ask it to interview you one question at a time with a check attached to each',
        signal: 'veteran',
      },
    ],
  },
  {
    id: 'confident-answer',
    symptom: 'An AI hands you a confident, well-written root cause for a problem you have been stuck on for an hour.',
    options: [
      { id: 'a', label: 'Implement it — it matches the symptom and you are out of ideas', signal: 'less-seasoned' },
      {
        id: 'b',
        label: 'Treat it as one hypothesis and find the cheapest way to disprove it against the live system first',
        signal: 'veteran',
      },
    ],
  },
  {
    id: 'packet-capture',
    symptom: 'You want an AI to help you make sense of a 400 MB packet capture.',
    options: [
      { id: 'a', label: 'Upload the capture and ask it what looks wrong', signal: 'less-seasoned' },
      {
        id: 'b',
        label: 'Filter it to the relevant conversation, export a text slice, and state what the traffic should look like before asking',
        signal: 'veteran',
      },
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
          Recommended tier for <strong>AI Fluency</strong>:{' '}
          <span data-tier={result}>{result === 'veteran' ? 'Veteran' : 'Less-seasoned'}</span>
        </p>
        <p className="quiz-explain">
          {result === 'veteran'
            ? 'You reached for context and verification more than once — Veteran tier starts you at the harder half: baseline articulation, spotting an unpaired question mid-interview, and disproving a plausible answer cheaply.'
            : 'You reached for the direct ask first — Less-seasoned tier starts with the pull-prompt itself, building the habit of demanding a check with every question before worrying about baselines or near-misses.'}
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
      <p className="quiz-prompt">What do you actually do?</p>
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
