import { useState } from 'react'
import { getPlacement, setPlacement, type Tier } from '../../lib/progress'
import './Quiz.css'

// Per-module placement — this instance is for "Networking Fundamentals".
// A different module (AD/GPO, cloud identity, ...) gets its own instance
// with its own MODULE_ID and questions; tiers never share across modules.
const MODULE_ID = 'networking-fundamentals'

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
    id: 'slow-share',
    symptom: "A user says the file share won't load and it's been slow all morning.",
    options: [
      { id: 'a', label: 'ipconfig /all, then ping the file server', signal: 'less-seasoned' },
      { id: 'b', label: 'Start a packet capture on the client filtered to SMB and watch the wire', signal: 'veteran' },
    ],
  },
  {
    id: 'dns-timeout',
    symptom: 'DNS lookups are timing out for one specific site, not for anything else.',
    options: [
      { id: 'a', label: 'nslookup the domain against a couple of different resolvers, compare answers', signal: 'less-seasoned' },
      { id: 'b', label: 'Capture the actual query/response and check the raw flags and response code', signal: 'veteran' },
    ],
  },
  {
    id: 'apipa-fallback',
    symptom: 'A DHCP client fell back to an APIPA (169.254.x.x) address.',
    options: [
      { id: 'a', label: 'Check Event Viewer and gpresult, then look at the DHCP scope', signal: 'less-seasoned' },
      { id: 'b', label: 'Packet capture on the DHCPDISCOVER to see if any offer comes back at all', signal: 'veteran' },
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
        <p className="quiz-result">
          Recommended tier for <strong>Networking Fundamentals</strong>:{' '}
          <span data-tier={result}>{result === 'veteran' ? 'Veteran' : 'Less-seasoned'}</span>
        </p>
        <p className="quiz-explain">
          {result === 'veteran'
            ? 'You reached for packet-level tools more than once — Veteran tier starts you straight at protocol-level digging, skipping the beginner scaffolding.'
            : "You reached for the GUI-visible checks (ipconfig, ping, Event Viewer) — Less-seasoned tier starts there, building the instinct to check something systematically before going deeper."}
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
