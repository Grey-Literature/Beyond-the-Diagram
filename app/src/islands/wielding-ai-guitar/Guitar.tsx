import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import styles from './Guitar.css?raw'
import { NOTE_FRETS, PARTS, STRINGS, SWITCH } from './content'
import type { Kind, Part, PartSound } from './content'
import { getExplored, markExplored, resetExplored } from '../../lib/progress'
import { capo, caseOpen, pedal, pickupHum, plugIn, pluck, reference, rustle, selectorVoice, swell, tuneUp } from './sound'

// Nothing on the guitar is labelled on purpose: the module is about finding
// an instrument's range by playing it. Strings are the six practice groups,
// the notes on them are that group's content, and the hardware plus the
// floor are the parts of the product from Knowing the instrument.

const SCOPE = 'wielding-ai-guitar'

// Geometry, in viewBox units. The neck runs from the nut to the bridge at a
// real fret spacing, so the notes sit where frets 5, 7, 9 and 12 would.
const NUT_X = 152
const BRIDGE_X = 932
const SCALE = BRIDGE_X - NUT_X
const nutY = (i: number) => 155 + 14 * i
const bridgeY = (i: number) => 140 + 20 * i
const yAt = (i: number, x: number) => nutY(i) + ((x - NUT_X) / SCALE) * (bridgeY(i) - nutY(i))
const fretX = (n: number) => NUT_X + SCALE * (1 - 2 ** (-n / 12))
const noteX = (fret: number) => (fretX(fret - 1) + fretX(fret)) / 2
const edgeTop = (x: number) => 150 - ((x - 152) * 10) / 468
const edgeBottom = (x: number) => 230 + ((x - 152) * 10) / 468
const GAUGE = [2.6, 2.2, 1.8, 1.4, 1.1, 0.9]
const POSTS = [
  { x: 125, y: 160 }, { x: 90, y: 160 }, { x: 55, y: 160 },
  { x: 55, y: 220 }, { x: 90, y: 220 }, { x: 125, y: 220 },
]
const FRETS = Array.from({ length: 16 }, (_, k) => fretX(k + 1))
const SIDE_DOTS = [3, 5, 7, 9]

type Selection =
  | { type: 'intro' }
  | { type: 'string'; i: number }
  | { type: 'note'; i: number; n: number }
  | { type: 'part'; id: string }
  | { type: 'switch'; pos: number }

const PART: Record<string, Part> = Object.fromEntries(PARTS.map((p) => [p.id, p]))

const ZONES = [
  { label: 'Strings', ids: STRINGS.map((s) => `string:${s.id}`) },
  { label: 'Notes', ids: STRINGS.flatMap((s) => s.notes.map((n) => `note:${n.id}`)) },
  {
    label: 'On the guitar',
    ids: [...PARTS.filter((p) => p.zone === 'guitar').map((p) => `part:${p.id}`), ...SWITCH.map((s) => `switch:${s.id}`)],
  },
  { label: 'On the floor', ids: PARTS.filter((p) => p.zone === 'floor').map((p) => `part:${p.id}`) },
]
const TOTAL = ZONES.reduce((sum, z) => sum + z.ids.length, 0)

const PLAY: Record<PartSound, () => void> = {
  reverb: () => pedal('reverb'),
  distortion: () => pedal('distortion'),
  echo: () => pedal('echo'),
  oscillator: () => pedal('oscillator'),
  rustle: () => rustle('sheet'),
  setlist: () => rustle('scrap'),
  case: caseOpen,
  tune: tuneUp,
  reference,
  capo,
  hum: pickupHum,
  swell,
  plug: plugIn,
}

const EFFECT_LABEL: Partial<Record<PartSound, string>> = {
  reverb: 'reverb',
  distortion: 'distortion',
  echo: 'an echo',
  oscillator: 'raw oscillators instead of strings',
}

const KIND_CLASS: Record<Kind, string> = { Lab: 'k-lab', Case: 'k-case', 'Classification Drill': 'k-drill' }
const KIND_VERB: Record<Kind, string> = { Lab: 'Open the lab', Case: 'Open the case', 'Classification Drill': 'Open the drill' }

function Hot({
  label,
  onPlay,
  className = '',
  children,
}: {
  label: string
  onPlay: () => void
  className?: string
  children: ReactNode
}) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onPlay()
    }
  }
  return (
    <g role="button" tabIndex={0} aria-label={label} className={`wg-hot ${className}`} onClick={onPlay} onKeyDown={onKeyDown}>
      {children}
    </g>
  )
}

export function Guitar() {
  const [explored, setExplored] = useState<Set<string>>(() => new Set(getExplored(SCOPE)))
  const [sel, setSel] = useState<Selection>({ type: 'intro' })
  const [switchPos, setSwitchPos] = useState(2)
  const [ring, setRing] = useState<{ i: number; n: number } | null>(null)
  const [sound, setSound] = useState(false)
  const [nudge, setNudge] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)

  const discover = (id: string) => {
    markExplored(SCOPE, id)
    setExplored((prev) => (prev.has(id) ? prev : new Set([...prev, id])))
  }
  const strum = (i: number, midi: number) => {
    setRing((r) => ({ i, n: (r?.n ?? 0) + 1 }))
    if (sound) pluck(midi)
  }

  const playString = (i: number) => {
    setSel({ type: 'string', i })
    discover(`string:${STRINGS[i].id}`)
    strum(i, STRINGS[i].midi)
  }
  const playNote = (i: number, n: number) => {
    setSel({ type: 'note', i, n })
    discover(`note:${STRINGS[i].notes[n].id}`)
    strum(i, STRINGS[i].midi + NOTE_FRETS[n])
  }
  const playPart = (id: string) => {
    setSel({ type: 'part', id })
    discover(`part:${id}`)
    const s = PART[id].sound
    if (!s) return
    if (sound) PLAY[s]()
    else setNudge((n) => n + 1)
  }
  const flipSwitch = () => {
    const pos = (switchPos + 1) % 3
    setSwitchPos(pos)
    setSel({ type: 'switch', pos })
    discover(`switch:${SWITCH[pos].id}`)
    if (sound) selectorVoice(pos)
    else setNudge((n) => n + 1)
  }
  const forget = () => {
    resetExplored(SCOPE)
    setExplored(new Set())
    setSel({ type: 'intro' })
  }

  const isSel = (type: Selection['type'], key?: string | number) => {
    if (sel.type !== type) return false
    if (sel.type === 'part') return sel.id === key
    if (sel.type === 'string') return sel.i === key
    return true
  }
  const partClass = (id: string) => `${isSel('part', id) ? 'is-selected' : ''} ${explored.has(`part:${id}`) ? 'is-found' : ''}`
  const partLabel = (id: string) => `${PART[id].thing}: ${PART[id].title}`

  // The five-skills list above the guitar links to #choosing, #knowing and so
  // on (the fallback list's ids). With the guitar mounted, those links pluck
  // the matching string instead, and bring the guitar into view.
  useEffect(() => {
    const pluckFromHash = (hash: string) => {
      const i = STRINGS.findIndex((s) => `#${s.id}` === hash)
      if (i < 0) return false
      const id = `string:${STRINGS[i].id}`
      markExplored(SCOPE, id)
      setExplored((prev) => (prev.has(id) ? prev : new Set([...prev, id])))
      setSel({ type: 'string', i })
      setRing((r) => ({ i, n: (r?.n ?? 0) + 1 }))
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      stageRef.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
      return true
    }
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="#"]')
      const hash = link?.getAttribute('href') ?? ''
      if (pluckFromHash(hash)) {
        e.preventDefault()
        history.pushState(null, '', hash)
      }
    }
    pluckFromHash(window.location.hash)
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const found = explored.size
  const complete = found >= TOTAL

  return (
    <div className="wg">
      <style>{styles}</style>
      <div className="wg-stage" ref={stageRef}>
        <svg
          className="wg-svg"
          viewBox="0 0 1240 580"
          role="group"
          aria-label="A guitar, its pedalboard, a case and a music stand. Nothing is labelled: play any part to find out what it is."
        >
          {/* Drawn headstock-left, then mirrored: a right-handed guitar seen from the
              front has its headstock on the right and the low E string on top. */}
          <g transform="matrix(-1 0 0 1 1200 0)">
          <line className="wg-floor" x1="20" y1="552" x2="1180" y2="552" />

          {/* The floor: case, music stand, pedalboard. */}
          <Hot label={partLabel('case')} onPlay={() => playPart('case')} className={partClass('case')}>
            <rect className="hs wg-case" x="30" y="440" width="260" height="100" rx="44" />
            <ellipse className="wg-plush" cx="228" cy="490" rx="50" ry="34" />
            <rect className="wg-plush" x="70" y="480" width="116" height="20" rx="6" />
            <rect className="wg-plush" x="104" y="508" width="44" height="20" rx="4" />
          </Hot>

          <Hot label={partLabel('stand')} onPlay={() => playPart('stand')} className={partClass('stand')}>
            <line className="wg-metal" x1="380" y1="476" x2="380" y2="548" />
            <path className="wg-metal" d="M380 532L354 552M380 532L406 552" />
            <rect className="wg-ledge" x="330" y="471" width="100" height="5" />
            <g transform="rotate(-5 380 438)">
              <rect className="hs wg-paper" x="332" y="405" width="96" height="66" />
              {[0, 1].map((s) =>
                [0, 1, 2, 3, 4].map((k) => (
                  <line key={`${s}${k}`} className="wg-staff" x1="340" x2="420" y1={418 + s * 26 + k * 3.5} y2={418 + s * 26 + k * 3.5} />
                )),
              )}
              {[352, 366, 381, 399, 412].map((x, k) => (
                <ellipse key={x} className="wg-ink" cx={x} cy={421 + ((k * 5) % 11) + (k % 2) * 26} rx="2.6" ry="2" />
              ))}
            </g>
          </Hot>

          <rect className="wg-board" x="570" y="492" width="480" height="50" rx="6" />
          <path className="wg-patch" d="M680 480C688 460 692 460 700 480M780 480C788 460 792 460 800 478M920 478C928 460 932 460 940 480" />

          <Hot label={partLabel('search')} onPlay={() => playPart('search')} className={partClass('search')}>
            <rect className="hs wg-pedal p-search" x="600" y="470" width="80" height="62" rx="6" />
            <circle className="wg-knob-s" cx="626" cy="486" r="6" />
            <circle className="wg-knob-s" cx="654" cy="486" r="6" />
            <circle className="wg-foot" cx="640" cy="516" r="7" />
          </Hot>
          <Hot label={partLabel('sandbox')} onPlay={() => playPart('sandbox')} className={partClass('sandbox')}>
            <rect className="hs wg-pedal p-sandbox" x="700" y="470" width="80" height="62" rx="6" />
            <circle className="wg-knob-s" cx="740" cy="486" r="6" />
            <rect className="wg-led" x="733" y="496" width="14" height="4" rx="1" />
            <circle className="wg-foot" cx="740" cy="516" r="7" />
          </Hot>
          <Hot label={partLabel('looper')} onPlay={() => playPart('looper')} className={partClass('looper')}>
            <rect className="hs wg-pedal p-looper" x="800" y="466" width="120" height="68" rx="8" />
            <circle className={`wg-loop-ring ${isSel('part', 'looper') ? 'is-spinning' : ''}`} cx="860" cy="505" r="20" />
            <circle className="wg-foot" cx="860" cy="505" r="11" />
          </Hot>
          <Hot label={partLabel('diy')} onPlay={() => playPart('diy')} className={partClass('diy')}>
            <rect className="hs wg-pedal p-diy" x="940" y="470" width="80" height="62" rx="3" />
            <path className="wg-trace" d="M952 484H972V500H996M952 516H984V492M1008 484V520" />
            <circle className="wg-chip" cx="972" cy="484" r="3" />
            <circle className="wg-chip" cx="996" cy="500" r="3" />
            <circle className="wg-chip" cx="984" cy="516" r="3" />
            <rect className="wg-chip" x="1000" y="506" width="16" height="8" rx="1" />
          </Hot>

          {/* The cable runs from the jack under the body down to the board. */}
          <g className={`wg-cable-hit ${partClass('jack')}`} onClick={() => playPart('jack')} aria-hidden="true">
            <path className="wg-cable" d="M1072 262C1150 300 1170 390 1110 450S1040 488 1022 500" />
            <path className="hs wg-cable-core" d="M1072 262C1150 300 1170 390 1110 450S1040 488 1022 500" />
          </g>

          {/* The body. */}
          <path
            className="wg-body"
            d="M610 110C600 55 690 25 770 45C830 60 860 92 915 78C1000 55 1090 80 1095 180C1100 300 1010 352 905 338C860 332 830 312 770 332C690 358 595 330 608 268C614 238 618 150 610 110Z"
          />
          <path
            className="wg-body-inner"
            d="M626 118C618 72 694 46 766 62C826 76 858 108 914 94C990 74 1072 96 1078 182C1082 290 1004 334 906 322C862 316 832 298 772 316C700 338 614 314 624 266C630 238 634 152 626 118Z"
          />

          <Hot label={partLabel('pickups')} onPlay={() => playPart('pickups')} className={partClass('pickups')}>
            {[690, 840].map((x) => (
              <g key={x}>
                <rect className="hs wg-pickup" x={x} y="134" width="40" height="112" rx="5" />
                {STRINGS.map((_, i) => (
                  <circle key={i} className="wg-pole" cx={x + 20} cy={yAt(i, x + 20)} r="2.4" />
                ))}
              </g>
            ))}
          </Hot>

          <rect className="wg-bridge" x="926" y="130" width="14" height="120" rx="3" />

          <Hot label={partLabel('knobs')} onPlay={() => playPart('knobs')} className={partClass('knobs')}>
            {[
              { x: 985, y: 288, a: -30 },
              { x: 1035, y: 262, a: 50 },
            ].map((k) => (
              <g key={k.x}>
                <circle className="hs wg-knob" cx={k.x} cy={k.y} r="14" />
                <circle className="wg-knurl" cx={k.x} cy={k.y} r="10" />
                <line className="wg-pointer" x1={k.x} y1={k.y} x2={k.x} y2={k.y - 11} transform={`rotate(${k.a} ${k.x} ${k.y})`} />
              </g>
            ))}
          </Hot>

          <Hot
            label={`Pickup selector, set to: ${SWITCH[switchPos].title}`}
            onPlay={flipSwitch}
            className={`${sel.type === 'switch' ? 'is-selected' : ''}`}
          >
            {/* A blade selector between the bridge pickup and the knobs: toward the
                neck is advises, toward the bridge is acts. */}
            <g transform="rotate(-22 880 292)">
              <rect className="hs wg-switch-plate" x="856" y="287" width="48" height="10" rx="5" />
              {[-1, 0, 1].map((k) => (
                <line key={k} className="wg-tick" x1={880 + k * 13} y1="282" x2={880 + k * 13} y2="279" />
              ))}
              <rect className="wg-blade" x="876" y="284" width="8" height="16" rx="2" style={{ transform: `translateX(${(switchPos - 1) * 13}px)` }} />
            </g>
          </Hot>

          <Hot label={partLabel('jack')} onPlay={() => playPart('jack')} className={partClass('jack')}>
            <circle className="hs wg-jack" cx="1072" cy="262" r="9" />
            <circle className="wg-jack-hole" cx="1072" cy="262" r="3.5" />
          </Hot>

          <Hot label={partLabel('setlist')} onPlay={() => playPart('setlist')} className={partClass('setlist')}>
            <g transform="rotate(-8 757 86)">
              <rect className="hs wg-paper" x="735" y="58" width="44" height="56" />
              {[68, 76, 84, 92, 100].map((y, k) => (
                <line key={y} className="wg-scrawl" x1="741" y1={y} x2={741 + [30, 22, 27, 18, 25][k]} y2={y} />
              ))}
              <rect className="wg-tape" x="747" y="53" width="20" height="9" />
            </g>
          </Hot>

          {/* The neck. */}
          <path className="wg-headstock" d="M152 150L40 128Q22 126 20 142L20 238Q22 254 40 252L152 230Z" />
          <polygon className="wg-fretboard" points="152,150 620,140 620,240 152,230" />
          {FRETS.map((x, k) => (
            <line key={k} className="wg-fret" x1={x} y1={edgeTop(x)} x2={x} y2={edgeBottom(x)} />
          ))}
          {SIDE_DOTS.map((f) => (
            <circle key={f} className="wg-side-dot" cx={noteX(f)} cy={edgeTop(noteX(f)) - 6} r="2" />
          ))}
          <circle className="wg-side-dot" cx={noteX(12) - 5} cy={edgeTop(noteX(12)) - 6} r="2" />
          <circle className="wg-side-dot" cx={noteX(12) + 5} cy={edgeTop(noteX(12)) - 6} r="2" />
          <rect className="wg-nut" x="148" y="149" width="6" height="82" rx="1" />

          <Hot label={partLabel('pegs')} onPlay={() => playPart('pegs')} className={partClass('pegs')}>
            {POSTS.map((p, i) => {
              const top = i < 3
              const edge = top ? 150 - ((152 - p.x) * 22) / 112 : 230 + ((152 - p.x) * 22) / 112
              const knobY = top ? edge - 15 : edge + 15
              return (
                <g key={i}>
                  <line className="wg-shaft" x1={p.x} y1={edge} x2={p.x} y2={knobY} />
                  <ellipse className="hs wg-peg" cx={p.x} cy={knobY} rx="8" ry="10" />
                  <circle className="wg-post" cx={p.x} cy={p.y} r="3.6" />
                </g>
              )
            })}
          </Hot>

          <Hot label={partLabel('tuner')} onPlay={() => playPart('tuner')} className={partClass('tuner')}>
            {/* Clamped to the end of the headstock, display facing out. */}
            <rect className="wg-clamp" x="12" y="176" width="16" height="28" rx="3" />
            <line className="wg-shaft" x1="12" y1="190" x2="-6" y2="190" />
            <rect className="hs wg-tuner" x="-36" y="166" width="30" height="46" rx="5" />
            <rect className="wg-screen" x="-31" y="172" width="20" height="26" rx="2" />
            <line className="wg-needle" x1="-21" y1="194" x2="-17" y2="180" />
          </Hot>

          {/* Strings: the short run over the headstock, then nut to bridge. */}
          {STRINGS.map((s, i) => (
            <line
              key={`head-${s.id}`}
              className={`wg-string ${i < 3 ? 'wound' : ''}`}
              x1={POSTS[i].x}
              y1={POSTS[i].y}
              x2={NUT_X}
              y2={nutY(i)}
              strokeWidth={GAUGE[i]}
            />
          ))}
          {STRINGS.map((s, i) => (
            <line
              key={ring?.i === i ? `str-${s.id}-${ring.n}` : `str-${s.id}`}
              className={`wg-string ${i < 3 ? 'wound' : ''} ${ring?.i === i ? 'is-ringing' : ''} ${isSel('string', i) ? 'is-selected' : ''}`}
              x1={NUT_X}
              y1={nutY(i)}
              x2={BRIDGE_X}
              y2={bridgeY(i)}
              strokeWidth={GAUGE[i]}
            />
          ))}
          {STRINGS.map((s, i) => (
            <Hot
              key={`hit-${s.id}`}
              label={`String ${s.number}: ${s.title}`}
              onPlay={() => playString(i)}
              className={`wg-string-hit ${explored.has(`string:${s.id}`) ? 'is-found' : ''}`}
            >
              <line x1={NUT_X + 4} y1={yAt(i, NUT_X + 4)} x2={680} y2={yAt(i, 680)} />
              <line x1={740} y1={yAt(i, 740)} x2={836} y2={yAt(i, 836)} />
              <circle className="wg-string-mark" cx={NUT_X - 10} cy={nutY(i)} r="2.2" />
            </Hot>
          ))}

          <Hot label={partLabel('capo')} onPlay={() => playPart('capo')} className={partClass('capo')}>
            <rect className="hs wg-capo" x="219" y="134" width="12" height="112" rx="4" />
            {/* Clamped from the bass side, so the screw sits above the low E. */}
            <line className="wg-shaft" x1="225" y1="134" x2="225" y2="130" />
            <circle className="wg-capo-screw" cx="225" cy="124" r="6" />
          </Hot>

          {STRINGS.map((s, i) =>
            s.notes.map((note, n) => {
              const x = noteX(NOTE_FRETS[n])
              const cls = `wg-note ${KIND_CLASS[note.kind]} ${explored.has(`note:${note.id}`) ? 'is-found' : ''} ${
                sel.type === 'note' && sel.i === i && sel.n === n ? 'is-selected' : ''
              }`
              return (
                <Hot key={note.id} label={`${note.kind}: ${note.title}`} onPlay={() => playNote(i, n)} className={cls}>
                  <circle className="wg-note-hit" cx={x} cy={yAt(i, x)} r="9" />
                  <circle className="hs wg-note-dot" cx={x} cy={yAt(i, x)} r="5.5" />
                </Hot>
              )
            }),
          )}
          </g>
        </svg>
      </div>
      <p className="wg-swipe" aria-hidden="true">Swipe along the neck →</p>

      <div className="wg-panel">
        <div className="wg-detail" aria-live="polite">
          <Detail sel={sel} switchPos={switchPos} explored={explored} sound={sound} onNote={playNote} />
        </div>
        <aside className="wg-side">
          <p className="wg-eyebrow">Your range so far</p>
          <p className="wg-count">
            <strong>{found}</strong> of {TOTAL} found
          </p>
          <ul className="wg-zones">
            {ZONES.map((z) => {
              const n = z.ids.filter((id) => explored.has(id)).length
              return (
                <li key={z.label} className={n === z.ids.length ? 'is-done' : ''}>
                  <span>{z.label}</span>
                  <span>
                    {n}/{z.ids.length}
                  </span>
                </li>
              )
            })}
          </ul>
          {complete ? (
            <p className="wg-complete">
              That's every part we drew. The rest of the range is in your own product's settings menu.
            </p>
          ) : null}
          <div className="wg-controls">
            <button
              key={nudge}
              type="button"
              className={`wg-button ${nudge > 0 && !sound ? 'is-nudged' : ''}`}
              aria-pressed={sound}
              onClick={() => setSound(!sound)}
            >
              Sound {sound ? 'on' : 'off'}
            </button>
            {found > 0 ? (
              <button type="button" className="wg-button wg-quiet" onClick={forget}>
                Forget what I've found
              </button>
            ) : null}
          </div>
          <details className="wg-all">
            <summary>Everything on it, as a list</summary>
            <EverythingList />
          </details>
        </aside>
      </div>
    </div>
  )
}

function LinkList({ links }: { links: { href: string; label: string }[] }) {
  return (
    <ul className="wg-links">
      {links.map((l) => (
        <li key={l.href + l.label}>
          <a href={l.href}>
            {l.label} <span aria-hidden="true">↗</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function Detail({
  sel,
  switchPos,
  explored,
  sound,
  onNote,
}: {
  sel: Selection
  switchPos: number
  explored: Set<string>
  sound: boolean
  onNote: (i: number, n: number) => void
}) {
  if (sel.type === 'string') {
    const s = STRINGS[sel.i]
    return (
      <>
        <p className="wg-eyebrow">String {s.number}</p>
        <h3>{s.title}</h3>
        <p className="wg-lead">{s.skill}</p>
        <p className="wg-dim">{s.groupNote}</p>
        <p className="wg-eyebrow wg-sub">On this string</p>
        <ul className="wg-notes">
          {s.notes.map((note, n) => (
            <li key={note.id}>
              <button type="button" className={`wg-note-row ${KIND_CLASS[note.kind]}`} onClick={() => onNote(sel.i, n)}>
                <span className="wg-kind">{note.kind}</span>
                <span className="wg-note-title">{note.title}</span>
                {explored.has(`note:${note.id}`) ? <span className="wg-found-tag">found</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </>
    )
  }
  if (sel.type === 'note') {
    const s = STRINGS[sel.i]
    const note = s.notes[sel.n]
    return (
      <>
        <p className="wg-eyebrow">
          String {s.number} <span aria-hidden="true">/</span> {s.title}
        </p>
        <p className={`wg-kind ${KIND_CLASS[note.kind]}`}>{note.kind}</p>
        <h3>{note.title}</h3>
        <p className="wg-lead">{note.desc}</p>
        <a className="wg-go" href={note.href}>
          {KIND_VERB[note.kind]} <span aria-hidden="true">↗</span>
        </a>
      </>
    )
  }
  if (sel.type === 'part') {
    const p = PART[sel.id]
    return (
      <>
        <p className="wg-eyebrow">{p.thing}</p>
        <h3>{p.title}</h3>
        <p className="wg-on-guitar">{p.onGuitar}</p>
        {p.sound && EFFECT_LABEL[p.sound] ? (
          <p className="wg-effect">
            Same chord as every pedal here, through {EFFECT_LABEL[p.sound]}.{sound ? '' : ' Turn sound on to hear it.'}
          </p>
        ) : null}
        {p.twin ? <p className="wg-twin">Infrastructure twin: {p.twin}</p> : null}
        {p.body ? <p className="wg-lead">{p.body}</p> : null}
        {p.runsOut ? (
          <p className="wg-dim">
            <span className="wg-label">Runs out:</span> {p.runsOut}
          </p>
        ) : null}
        {p.tell ? (
          <p className="wg-dim">
            <span className="wg-label">The tell:</span> {p.tell}
          </p>
        ) : null}
        <LinkList links={p.links} />
      </>
    )
  }
  if (sel.type === 'switch') {
    const pos = SWITCH[sel.pos]
    return (
      <>
        <p className="wg-eyebrow">The pickup selector <span aria-hidden="true">/</span> who has hands on the keyboard</p>
        <ol className="wg-positions" aria-label="Switch positions">
          {SWITCH.map((p, k) => (
            <li key={p.id} className={k === switchPos ? 'is-on' : ''}>
              {p.title}
            </li>
          ))}
        </ol>
        <h3>{pos.title}</h3>
        <p className="wg-on-guitar">Same strings, different voice.</p>
        <p className="wg-lead">{pos.body}</p>
        <p className="wg-dim">The answer changes what you owe in checking and disclosure. Flip it again.</p>
        <LinkList links={pos.links} />
      </>
    )
  }
  return (
    <>
      <p className="wg-eyebrow">Pick it up</p>
      <h3>Nothing on it is labelled.</h3>
      <p className="wg-lead">
        Pluck a string to find out what that skill is for. The notes along it are its labs, cases and drills. The
        hardware, and what's on the floor, is the product you're holding.
      </p>
      <p className="wg-dim">Find the edges on purpose.</p>
    </>
  )
}

function EverythingList() {
  return (
    <div className="wg-everything">
      {STRINGS.map((s) => (
        <div key={s.id}>
          <p className="wg-all-head">
            <span>{s.number}</span> {s.title}
          </p>
          <ul>
            {s.notes.map((n) => (
              <li key={n.id}>
                <a href={n.href}>{n.title}</a> <span className="wg-all-kind">{n.kind}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <p className="wg-all-head">
          <span>↗</span> The hardware and the floor
        </p>
        <ul>
          {PARTS.map((p) => (
            <li key={p.id}>
              <a href={p.links[0].href}>{p.title}</a> <span className="wg-all-kind">{p.thing.replace(/^The /, '')}</span>
            </li>
          ))}
          <li>
            <a href="drill-who-acted.html">Advised, executed, or acted?</a> <span className="wg-all-kind">pickup selector</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
