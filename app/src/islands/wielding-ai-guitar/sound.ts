// Every sound the guitar makes, synthesized on the spot — no audio files to
// ship. Only ever called from a click the player made after turning sound
// on, so the AudioContext is always created inside a user gesture.
//
// The four pedals all play the same chord; only the pedal changes. That's
// the module's point, heard: same instrument, different technique.

let ctx: AudioContext | null = null
let master: GainNode | null = null
const plucks = new Map<number, AudioBuffer>()
let noise: AudioBuffer | null = null
let room: AudioBuffer | null = null

// Open E major, low string to high.
const CHORD = [40, 47, 52, 56, 59, 64]

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

function audio(): { ac: AudioContext; out: GainNode } {
  if (!ctx || !master) {
    ctx = new AudioContext()
    // A compressor at the end keeps a distorted chord from clipping the speakers.
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -14
    limiter.ratio.value = 6
    master = ctx.createGain()
    master.gain.value = 0.8
    master.connect(limiter).connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return { ac: ctx, out: master }
}

// Karplus-Strong: a burst of noise fed round a short, slightly lossy loop.
function pluckBuffer(ac: AudioContext, midi: number): AudioBuffer {
  const cached = plucks.get(midi)
  if (cached) return cached
  const rate = ac.sampleRate
  const length = Math.floor(rate * 2.2)
  const period = Math.max(2, Math.round(rate / hz(midi)))
  const buffer = ac.createBuffer(1, length, rate)
  const data = buffer.getChannelData(0)
  const ring = new Float32Array(period)
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1
  const decay = midi < 52 ? 0.997 : 0.994
  for (let i = 0; i < length; i++) {
    const idx = i % period
    const sample = ring[idx]
    data[i] = sample
    ring[idx] = decay * 0.5 * (sample + ring[(idx + 1) % period])
  }
  plucks.set(midi, buffer)
  return buffer
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise) return noise
  noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return noise
}

// A made-up room: stereo noise that dies away over a couple of seconds.
function roomBuffer(ac: AudioContext): AudioBuffer {
  if (room) return room
  const length = Math.floor(ac.sampleRate * 2.8)
  room = ac.createBuffer(2, length, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = room.getChannelData(ch)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3
  }
  return room
}

// Tear a chain down once its tail has died, so feedback loops don't linger.
function after(seconds: number, nodes: AudioNode[]) {
  setTimeout(() => nodes.forEach((n) => n.disconnect()), seconds * 1000)
}

function strum(ac: AudioContext, into: AudioNode, gain = 0.16, transpose = 0, delay = 0) {
  const now = ac.currentTime + delay
  CHORD.forEach((midi, k) => {
    const source = ac.createBufferSource()
    source.buffer = pluckBuffer(ac, midi + transpose)
    const g = ac.createGain()
    g.gain.value = gain
    source.connect(g).connect(into)
    source.start(now + k * 0.028)
  })
}

function safely(play: () => void) {
  try {
    play()
  } catch {
    // No Web Audio (or it's blocked) — the guitar still works silently.
  }
}

export function pluck(midi: number): void {
  safely(() => {
    const { ac, out } = audio()
    const source = ac.createBufferSource()
    source.buffer = pluckBuffer(ac, midi)
    const gain = ac.createGain()
    gain.gain.value = 0.28
    source.connect(gain).connect(out)
    source.start()
  })
}

export type Effect = 'reverb' | 'distortion' | 'echo' | 'oscillator'

export function pedal(effect: Effect): void {
  safely(() => {
    const { ac, out } = audio()
    if (effect === 'reverb') {
      const input = ac.createGain()
      const wet = ac.createConvolver()
      wet.buffer = roomBuffer(ac)
      const wetGain = ac.createGain()
      wetGain.gain.value = 0.9
      const dry = ac.createGain()
      dry.gain.value = 0.45
      input.connect(dry).connect(out)
      input.connect(wet).connect(wetGain).connect(out)
      strum(ac, input, 0.42)
      after(6, [input, wet, wetGain, dry])
    } else if (effect === 'distortion') {
      const drive = ac.createGain()
      drive.gain.value = 5
      const shaper = ac.createWaveShaper()
      const curve = new Float32Array(1024)
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1
        curve[i] = Math.tanh(x * 3.2)
      }
      shaper.curve = curve
      shaper.oversample = '4x'
      // A rough speaker cabinet: nothing above the amp's top end.
      const cab = ac.createBiquadFilter()
      cab.type = 'lowpass'
      cab.frequency.value = 3200
      const level = ac.createGain()
      level.gain.value = 0.17
      drive.connect(shaper).connect(cab).connect(level).connect(out)
      strum(ac, drive, 0.2)
      after(4, [drive, shaper, cab, level])
    } else if (effect === 'echo') {
      const input = ac.createGain()
      const delay = ac.createDelay(1)
      delay.delayTime.value = 0.34
      const feedback = ac.createGain()
      feedback.gain.value = 0.5
      const tone = ac.createBiquadFilter()
      tone.type = 'lowpass'
      tone.frequency.value = 2400
      input.connect(out)
      input.connect(delay)
      delay.connect(tone).connect(feedback).connect(delay)
      tone.connect(out)
      strum(ac, input, 0.22)
      after(7, [input, delay, feedback, tone])
    } else {
      // Nothing plucked at all: the chord built from raw oscillators, a
      // filter sweeping open and shut, and a slow wobble.
      const now = ac.currentTime
      const filter = ac.createBiquadFilter()
      filter.type = 'lowpass'
      filter.Q.value = 7
      filter.frequency.setValueAtTime(260, now)
      filter.frequency.exponentialRampToValueAtTime(3600, now + 0.5)
      filter.frequency.exponentialRampToValueAtTime(500, now + 1.9)
      const env = ac.createGain()
      env.gain.setValueAtTime(0.0001, now)
      env.gain.exponentialRampToValueAtTime(0.09, now + 0.06)
      env.gain.setValueAtTime(0.09, now + 1.2)
      env.gain.exponentialRampToValueAtTime(0.0001, now + 2.2)
      filter.connect(env).connect(out)
      const wobble = ac.createOscillator()
      wobble.frequency.value = 5.5
      const depth = ac.createGain()
      depth.gain.value = 4
      wobble.connect(depth)
      const oscs: OscillatorNode[] = []
      for (const midi of CHORD.slice(1)) {
        for (const detune of [-7, 7]) {
          const osc = ac.createOscillator()
          osc.type = 'sawtooth'
          osc.frequency.value = hz(midi)
          osc.detune.value = detune
          depth.connect(osc.detune)
          osc.connect(filter)
          oscs.push(osc)
        }
      }
      for (const o of [wobble, ...oscs]) {
        o.start(now)
        o.stop(now + 2.3)
      }
      after(3, [filter, env, depth])
    }
  })
}

// A sheet of music being picked up: a handful of short, bright crinkles.
// The taped setlist is a smaller piece of paper, so fewer and quieter.
export function rustle(size: 'sheet' | 'scrap' = 'sheet'): void {
  safely(() => {
    const { ac, out } = audio()
    const now = ac.currentTime
    const buffer = noiseBuffer(ac)
    const crinkles = size === 'sheet' ? 11 : 5
    const scale = size === 'sheet' ? 1 : 0.6
    for (let k = 0; k < crinkles; k++) {
      const t = now + k * 0.04 + Math.random() * 0.03
      const length = 0.02 + Math.random() * 0.06
      const source = ac.createBufferSource()
      source.buffer = buffer
      const band = ac.createBiquadFilter()
      band.type = 'bandpass'
      band.frequency.value = 2500 + Math.random() * 4500
      band.Q.value = 0.8 + Math.random()
      const g = ac.createGain()
      const peak = (0.18 + Math.random() * 0.3) * scale
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(peak, t + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, t + length)
      source.connect(band).connect(g).connect(out)
      source.start(t, Math.random() * 0.8, length + 0.01)
    }
  })
}

// The case: two latches snapping open, then the lid landing.
export function caseOpen(): void {
  safely(() => {
    const { ac, out } = audio()
    const now = ac.currentTime
    const buffer = noiseBuffer(ac)
    for (const t of [now, now + 0.16]) {
      const snap = ac.createBufferSource()
      snap.buffer = buffer
      const high = ac.createBiquadFilter()
      high.type = 'highpass'
      high.frequency.value = 2800
      const sg = ac.createGain()
      sg.gain.setValueAtTime(0.85, t)
      sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.012)
      snap.connect(high).connect(sg).connect(out)
      snap.start(t, Math.random() * 0.5, 0.02)
      // The ring of a metal latch.
      const ping = ac.createOscillator()
      ping.frequency.value = 2150 + Math.random() * 200
      const pg = ac.createGain()
      pg.gain.setValueAtTime(0.1, t)
      pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
      ping.connect(pg).connect(out)
      ping.start(t)
      ping.stop(t + 0.07)
    }
    // The lid: a low, soft thump that drops in pitch.
    const t = now + 0.5
    const thud = ac.createOscillator()
    thud.frequency.setValueAtTime(110, t)
    thud.frequency.exponentialRampToValueAtTime(45, t + 0.16)
    const tg = ac.createGain()
    tg.gain.setValueAtTime(0.0001, t)
    tg.gain.exponentialRampToValueAtTime(0.55, t + 0.008)
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
    thud.connect(tg).connect(out)
    thud.start(t)
    thud.stop(t + 0.3)
    const body = ac.createBufferSource()
    body.buffer = buffer
    const low = ac.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.value = 400
    const bg = ac.createGain()
    bg.gain.setValueAtTime(0.35, t)
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    body.connect(low).connect(bg).connect(out)
    body.start(t, 0, 0.14)
  })
}

// A short, bright click: a clamp closing, a switch landing, a plug going in.
function click(ac: AudioContext, out: AudioNode, t: number, level = 0.5) {
  const source = ac.createBufferSource()
  source.buffer = noiseBuffer(ac)
  const high = ac.createBiquadFilter()
  high.type = 'highpass'
  high.frequency.value = 2000
  const g = ac.createGain()
  g.gain.setValueAtTime(level, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.015)
  source.connect(high).connect(g).connect(out)
  source.start(t, Math.random() * 0.5, 0.02)
}

// Mains hum through a single-coil pickup: 60 Hz and its harmonics.
function hum(ac: AudioContext, out: AudioNode, t: number, length: number, level: number) {
  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(level, t + 0.08)
  env.gain.setValueAtTime(level, t + length * 0.6)
  env.gain.exponentialRampToValueAtTime(0.0001, t + length)
  const tone = ac.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 1200
  tone.connect(env).connect(out)
  const oscs = [60, 120, 180, 300].map((f, k) => {
    const osc = ac.createOscillator()
    osc.frequency.value = f
    const g = ac.createGain()
    g.gain.value = [1, 0.55, 0.35, 0.2][k]
    osc.connect(g).connect(tone)
    return osc
  })
  const buzz = ac.createOscillator()
  buzz.type = 'sawtooth'
  buzz.frequency.value = 60
  const bg = ac.createGain()
  bg.gain.value = 0.25
  buzz.connect(bg).connect(tone)
  for (const o of [...oscs, buzz]) {
    o.start(t)
    o.stop(t + length + 0.05)
  }
}

// The tuning pegs: a string starting flat and bending up into tune.
export function tuneUp(): void {
  safely(() => {
    const { ac, out } = audio()
    const now = ac.currentTime
    const source = ac.createBufferSource()
    source.buffer = pluckBuffer(ac, 52)
    source.playbackRate.setValueAtTime(2 ** (-1.4 / 12), now)
    source.playbackRate.setValueAtTime(2 ** (-1.4 / 12), now + 0.15)
    source.playbackRate.exponentialRampToValueAtTime(1, now + 0.75)
    const g = ac.createGain()
    g.gain.value = 0.4
    source.connect(g).connect(out)
    source.start(now)
  })
}

// The clip-on tuner: a clean reference A.
export function reference(): void {
  safely(() => {
    const { ac, out } = audio()
    const now = ac.currentTime
    const osc = ac.createOscillator()
    osc.frequency.value = 440
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.03)
    g.gain.setValueAtTime(0.12, now + 0.7)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1)
    osc.connect(g).connect(out)
    osc.start(now)
    osc.stop(now + 1.05)
  })
}

// The capo: it clamps on, and the same chord starts again two frets up.
export function capo(): void {
  safely(() => {
    const { ac, out } = audio()
    click(ac, out, ac.currentTime, 0.6)
    strum(ac, out, 0.16, 2, 0.18)
  })
}

// The pickups, with nothing ringing over them: all they hear is the room.
export function pickupHum(): void {
  safely(() => {
    const { ac, out } = audio()
    hum(ac, out, ac.currentTime, 1.3, 0.07)
  })
}

// The volume knob: one note, swelling up. Louder, never more.
export function swell(): void {
  safely(() => {
    const { ac, out } = audio()
    const now = ac.currentTime
    const source = ac.createBufferSource()
    source.buffer = pluckBuffer(ac, 57)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(2, now + 0.55)
    source.connect(g).connect(out)
    source.start(now)
  })
}

// The pickup selector: the same note, three voices. Neck pickup warm,
// middle plainer, bridge pickup thin and bright.
export function selectorVoice(position: number): void {
  safely(() => {
    const { ac, out } = audio()
    const now = ac.currentTime
    click(ac, out, now, 0.35)
    const source = ac.createBufferSource()
    source.buffer = pluckBuffer(ac, 55)
    const g = ac.createGain()
    g.gain.value = 0.6
    const voice = ac.createBiquadFilter()
    if (position === 0) {
      voice.type = 'lowpass'
      voice.frequency.value = 700
    } else if (position === 1) {
      voice.type = 'lowpass'
      voice.frequency.value = 2200
    } else {
      voice.type = 'highpass'
      voice.frequency.value = 600
    }
    const shine = ac.createBiquadFilter()
    shine.type = 'highshelf'
    shine.frequency.value = 2500
    shine.gain.value = position === 2 ? 10 : 0
    source.connect(voice).connect(shine).connect(g).connect(out)
    source.start(now + 0.05)
  })
}

// The jack: the crackle of a cable going in, a pop, and then the hum.
export function plugIn(): void {
  safely(() => {
    const { ac, out } = audio()
    const now = ac.currentTime
    for (let k = 0; k < 7; k++) click(ac, out, now + Math.random() * 0.12, 0.15 + Math.random() * 0.25)
    const t = now + 0.14
    const pop = ac.createOscillator()
    pop.frequency.setValueAtTime(90, t)
    pop.frequency.exponentialRampToValueAtTime(40, t + 0.09)
    const pg = ac.createGain()
    pg.gain.setValueAtTime(0.0001, t)
    pg.gain.exponentialRampToValueAtTime(0.5, t + 0.005)
    pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)
    pop.connect(pg).connect(out)
    pop.start(t)
    pop.stop(t + 0.16)
    hum(ac, out, t + 0.05, 1.1, 0.07)
  })
}
