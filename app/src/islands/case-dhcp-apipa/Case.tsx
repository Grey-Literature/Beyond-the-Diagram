import { useState } from 'react'
import { recordAttempt, getLatestAttempt } from '../../lib/progress'
import './Case.css'

const CONTENT_ID = 'case-dhcp-apipa'

type Step = 'investigate' | 'diagnose' | 'revealed'

const MOVES = [
  {
    id: 'pool-stats',
    label: 'Check DHCP scope statistics for pool exhaustion (Get-DhcpServerv4ScopeStatistics)',
    process: 'ok' as const,
    evidence: 'The scope shows 340 of 512 addresses still free. Pool exhaustion is ruled out — there\'s no shortage of leases available.',
  },
  {
    id: 'pcap-discover',
    label: "Packet capture a client's DHCPDISCOVER broadcast",
    process: 'good' as const,
    evidence: 'Zero DHCPOFFERs come back — not even a slow one. Nothing between the client and the DHCP server is completing the exchange at all.',
  },
  {
    id: 'restart-service',
    label: 'Restart the DHCP Server service and see if it starts leasing again',
    process: 'risky' as const,
    evidence: "The service restarts cleanly and reports healthy. Clients still fall back to APIPA — restarting fixed nothing, because the DHCP server was never actually the problem.",
  },
] as const

const DIAGNOSES = [
  { id: 'relay-misconfig', label: "The VLAN's switch/router lost its ip helper-address (relay) configuration" },
  { id: 'server-down', label: 'The DHCP server itself is down or unauthorized in AD' },
  { id: 'nic-driver', label: 'A bad NIC driver on the affected clients' },
] as const

const CORRECT_DIAGNOSIS = 'relay-misconfig'

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
      <p className="case-symptom">
        Users on VLAN 20 report they can't get on the network this morning. Their machines show a{' '}
        <code>169.254.x.x</code> address.
      </p>

      {step === 'investigate' && (
        <>
          <p className="case-prompt">What's your first move?</p>
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
          <p className="case-prompt">Given that, what's actually going on?</p>
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
            169 address means the client never completed any part of the DHCP exchange — zero
            offers came back. That points upstream of the DHCP server entirely: the VLAN's relay
            (<code>ip helper-address</code>) configuration is gone. Classic trap: an unrelated
            switch reboot reverted an unsaved config change, and nothing about it looked like a
            "recent change" from the DHCP side.
          </p>
          <p data-process={move.process}>
            {move.process === 'good' &&
              "Process: the packet capture is decisive — zero offers rules out the DHCP server itself immediately, before you touch anything."}
            {move.process === 'risky' &&
              "Process: restarting a service that was never broken doesn't get you evidence, it just costs time and risks masking the real fix if it coincidentally seems to help later."}
            {move.process === 'ok' &&
              "Process: reasonable check, but it only rules out one cause (pool exhaustion) — it doesn't tell you whether any offer is coming back at all."}
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
