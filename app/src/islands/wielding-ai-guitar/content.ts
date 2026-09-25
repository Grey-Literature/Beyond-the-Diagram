// Everything the guitar can say. Skill, group-note and lesson text is taken
// from wielding-ai/index.html; part text ("Runs out" / "The tell") from
// lab-knowing-the-instrument.html. The `onGuitar` lines are the only new
// copy — one short sentence each on why that part of the guitar stands for
// that part of the product. Keep this file in step with those pages rather
// than re-deriving the module from the Notion notes (see root CLAUDE.md).

export type Kind = 'Lab' | 'Case' | 'Classification Drill'

export interface Note {
  id: string
  href: string
  kind: Kind
  title: string
  desc: string
}

export interface GuitarString {
  id: string
  number: string
  title: string
  skill: string
  groupNote: string
  // Open-string pitch as a MIDI note number (standard tuning, low E first).
  midi: number
  notes: Note[]
}

export const STRINGS: GuitarString[] = [
  {
    id: 'choosing',
    number: '01',
    title: 'Choosing the instrument',
    skill: `Whether this job wants an assistant at all, which one, and at what setting.`,
    groupNote: `Looks like it isn't a decision at all — it gets made in about the time it takes to pick left or right at a familiar junction, which is not the same as not deciding.`,
    midi: 40,
    notes: [
      {
        id: 'lab-choosing-the-instrument',
        href: 'lab-choosing-the-instrument.html',
        kind: 'Lab',
        title: 'Whether, which one, and at what setting',
        desc: `Troubleshooting mapped onto the scientific method, and where an assistant fits at each of the six steps. Then which model and at what tier — plus why a mid-range daily driver covers most ITOps work if you're deliberate, and why your AI stack is infrastructure.`,
      },
    ],
  },
  {
    id: 'knowing',
    number: '02',
    title: 'Knowing the instrument',
    skill: `What every part of the product you use actually does, what it's good for in ITOps, and where each part runs out.`,
    groupNote: `Most people play three notes of it. The rest of the range is sitting in the settings menu.`,
    midi: 45,
    notes: [
      {
        id: 'lab-knowing-the-instrument',
        href: 'lab-knowing-the-instrument.html',
        kind: 'Lab',
        title: 'Every part of it, and where each runs out',
        desc: `Context, files, standing instructions, workspaces, memory, reasoning depth, search, connectors, code execution, agentic modes, and the API inside your own scripts — what each is for in ITOps work, the limit you'll hit, and a practice routine for finding the edges on purpose instead of mid-incident.`,
      },
    ],
  },
  {
    id: 'partnership',
    number: '03',
    title: 'Working the partnership',
    skill: `Briefing it, letting it interview you, feeding real evidence back each round — a conversation, not a query.`,
    groupNote: `Getting useful behavior back once you've decided to bring it in.`,
    midi: 50,
    notes: [
      {
        id: 'lab-pull-prompt',
        href: 'lab-pull-prompt.html',
        kind: 'Lab',
        title: 'The pull-prompt',
        desc: `Ask the AI to interview you instead of answer you — and demand a verification method with every question it asks. Side-by-side weak and strong prompts with both responses written out, plus the third shape: the discovery prompt, for when you don't yet know what evidence exists.`,
      },
      {
        id: 'drill-unpaired-question',
        href: 'drill-unpaired-question.html',
        kind: 'Classification Drill',
        title: 'A narrowing question with no way to check it',
        desc: `A verbatim AI reply. Classify it before you answer it.`,
      },
    ],
  },
  {
    id: 'checking',
    number: '04',
    title: 'Checking the work',
    skill: `The answer, the reasoning that produced it, and whether the session itself is still healthy.`,
    groupNote: `Three things that fail independently — the answer, the reasoning, and the session. Conflating them is why "check the AI's work" is useless advice.`,
    midi: 55,
    notes: [
      {
        id: 'lab-checking-the-work',
        href: 'lab-checking-the-work.html',
        kind: 'Lab',
        title: 'Judging what comes back',
        desc: `The answer, the path it took, and the session's health — why the path is hardest to check, and the precondition nobody names: none of it works if the answer pitched above your level. Plus the habit that fixes it, and the fallback ladder for when it doesn't — understand it if you can, cross-check when you can't, contain it regardless.`,
      },
      {
        id: 'case-ai-near-miss',
        href: 'case-ai-near-miss.html',
        kind: 'Case',
        title: `The AI's answer is confident, well-written, and wrong`,
        desc: `Symptom only — plus a plausible AI diagnosis you didn't ask to be tested on.`,
      },
      {
        id: 'case-narrativized-ticket',
        href: 'case-narrativized-ticket.html',
        kind: 'Case',
        title: `The ticket that describes work you didn't do`,
        desc: `Nothing is broken and the draft reads well. That's the problem — and a ticket is a record.`,
      },
      {
        id: 'case-stack-sync',
        href: 'case-stack-sync.html',
        kind: 'Case',
        title: 'Correct advice, wrong sequence',
        desc: `The suggestion isn't wrong information. It's wrongly ordered — and the check it sends you to can't tell your hypotheses apart.`,
      },
    ],
  },
  {
    id: 'owning',
    number: '05',
    title: 'Owning the result',
    skill: `What you put in, what you disclose, and what you put your name to on the way out.`,
    groupNote: `The part with actual professional consequences attached.`,
    midi: 59,
    notes: [
      {
        id: 'lab-owning-the-result',
        href: 'lab-owning-the-result.html',
        kind: 'Lab',
        title: 'What goes in, what you disclose, what you vouch for',
        desc: `The four questions to ask before an unfamiliar platform gets anything, where advising ends and acting begins, how that mix moves as you get better and the checks that should come with it, explaining it to someone who wasn't there, why disclosure follows blast radius, and the personal-account boundary.`,
      },
      {
        id: 'drill-who-acted',
        href: 'drill-who-acted.html',
        kind: 'Classification Drill',
        title: 'Advised, executed, or acted?',
        desc: `Same chat window, same amount of typing, completely different accountability. One question settles it.`,
      },
    ],
  },
  {
    id: 'literacies',
    number: '06',
    title: 'Underlying literacies',
    skill: `Two places where the gap isn't AI skill at all — it's not being able to read the evidence you'd be handing over.`,
    groupNote: `Worth doing independently of any assistant.`,
    midi: 64,
    notes: [
      {
        id: 'lab-packet-capture-with-ai',
        href: 'lab-packet-capture-with-ai.html',
        kind: 'Lab',
        title: 'Packet captures with AI help',
        desc: `A .pcap is binary and most tools can't read it. Reducing it to a text slice is itself half-splitting — and the AI still can't spot an anomaly until you state the baseline.`,
      },
      {
        id: 'lab-browser-console-literacy',
        href: 'lab-browser-console-literacy.html',
        kind: 'Lab',
        title: 'Reading a browser console',
        desc: `Four console errors worth recognizing on sight, and the three-bucket sort: yours to fix, the dev team's, or your infrastructure wearing a web-shaped disguise.`,
      },
      {
        id: 'drill-console-cors',
        href: 'drill-console-cors.html',
        kind: 'Classification Drill',
        title: 'A CORS error in the console',
        desc: `Whose problem is this? The reflex answer is right often enough to be dangerous.`,
      },
    ],
  },
]

// Frets the notes sit on, in order along each string. Marker frets, so the
// notes land where a player's eye already goes.
export const NOTE_FRETS = [5, 7, 9, 12]

export type Zone = 'guitar' | 'floor'

// What a part sounds like when played, with sound on. The pedals all play
// the same chord; the effect is the only thing that changes.
export type PartSound =
  | 'reverb' | 'distortion' | 'echo' | 'oscillator'
  | 'rustle' | 'case' | 'tune' | 'reference' | 'capo' | 'hum' | 'swell' | 'setlist' | 'plug'

export interface Part {
  id: string
  sound?: PartSound
  zone: Zone
  thing: string
  title: string
  onGuitar: string
  twin?: string
  runsOut?: string
  tell?: string
  body?: string
  links: { href: string; label: string }[]
}

const KNOWING = 'lab-knowing-the-instrument.html'

export const PARTS: Part[] = [
  {
    id: 'pegs',
    sound: 'tune',
    zone: 'guitar',
    thing: 'The tuning pegs',
    title: 'Standing instructions',
    onGuitar: `Tune it once and every note after inherits it — including the songs it's wrong for.`,
    twin: 'A baseline policy applied to every session',
    runsOut: `It applies everywhere, including the sessions it doesn't fit. A standing instruction you wrote three months ago and forgot is exactly as confusing as a policy nobody remembers linking.`,
    tell: `Behavior you can't explain from anything in the current conversation. Review these on a schedule, the same way you'd review group policy.`,
    links: [{ href: `${KNOWING}#standing-instructions`, label: 'Standing instructions, in Knowing the instrument' }],
  },
  {
    id: 'tuner',
    sound: 'reference',
    zone: 'guitar',
    thing: 'The clip-on tuner',
    title: 'Wielding AI tier check',
    onGuitar: `Find out where you're starting before you start playing.`,
    body: `Behavioral, not self-report. Skip this and start with choosing the instrument if you'd rather not bother.`,
    links: [{ href: 'placement-quiz.html', label: 'Take the tier check' }],
  },
  {
    id: 'capo',
    sound: 'capo',
    zone: 'guitar',
    thing: 'The capo',
    title: 'Edit, branch and regenerate',
    onGuitar: `Move the capo and the song starts again from a different fret.`,
    twin: 'Changing one variable and re-running the test',
    runsOut: `A regenerate is the same model reading the same context. Agreement between runs is not independent confirmation; for that you need an unrelated model.`,
    tell: `You're on your fourth "no, I meant…" in one thread. Scroll up, edit the message where it went wrong, and let the thread re-run from there.`,
    links: [{ href: `${KNOWING}#edit-branch-and-regenerate`, label: 'Edit, branch and regenerate, in Knowing the instrument' }],
  },
  {
    id: 'pickups',
    sound: 'hum',
    zone: 'guitar',
    thing: 'The pickups',
    title: 'The context window',
    onGuitar: `The pickups only hear what's ringing over them right now.`,
    twin: 'A buffer',
    runsOut: `Quietly, and before any hard limit. Long threads degrade — early material gets less weight, and a constraint you set in the first message stops being honored somewhere around turn fifteen without anything announcing it.`,
    tell: `It proposes something you ruled out at the start. Don't argue it back into line inside the same thread. Ask it for a handoff summary, check the summary against what you know actually happened, and start a fresh session with it.`,
    links: [{ href: `${KNOWING}#the-context-window`, label: 'The context window, in Knowing the instrument' }],
  },
  {
    id: 'knobs',
    sound: 'swell',
    zone: 'guitar',
    thing: 'The volume and tone knobs',
    title: 'Model choice and reasoning depth',
    onGuitar: `Turning it up doesn't add notes nobody played.`,
    twin: 'Sizing the box for the workload',
    runsOut: `More reasoning doesn't add evidence it doesn't have. Deep thinking on thin data is still guessing — it's guessing with more steps and more confidence.`,
    tell: `A long, careful-looking chain of reasoning built on the three sentences you gave it. Feed it evidence, not a bigger setting.`,
    links: [
      { href: `${KNOWING}#model-choice-and-reasoning-depth`, label: 'Model choice and reasoning depth, in Knowing the instrument' },
      { href: 'lab-choosing-the-instrument.html', label: 'Which model, and at what tier' },
    ],
  },
  {
    id: 'setlist',
    sound: 'setlist',
    zone: 'guitar',
    thing: 'The setlist taped to the body',
    title: 'Memory across sessions',
    onGuitar: `Taped on at a gig months ago. Nobody's checked it since.`,
    twin: 'A cache',
    runsOut: `Like every cache: it goes stale, and you often can't see everything that's in it. It can also carry forward a detail from one client's session into another's, which is a what-goes-in problem you didn't know you had.`,
    tell: `It "remembers" something that stopped being true. Find out whether your product lets you view and prune what's stored, and turn it off for work where carry-over would be a problem rather than a convenience.`,
    links: [{ href: `${KNOWING}#memory-across-sessions`, label: 'Memory across sessions, in Knowing the instrument' }],
  },
  {
    id: 'jack',
    sound: 'plug',
    zone: 'guitar',
    thing: 'The output jack and cable',
    title: 'Connectors and integrations',
    onGuitar: `Every cable you plug in is another path out of the instrument.`,
    twin: 'A service account',
    runsOut: `Every connector is access, and access accumulates. Read scope and write scope are completely different grants that can sit behind the same friendly toggle.`,
    tell: `You can't list, from memory, everything your assistant can currently reach. Least privilege applies exactly as it would to any other service account — read-only first.`,
    links: [
      { href: `${KNOWING}#connectors-and-integrations`, label: 'Connectors and integrations, in Knowing the instrument' },
      { href: 'lab-owning-the-result.html', label: 'Owning the result' },
    ],
  },
  {
    id: 'case',
    sound: 'case',
    zone: 'floor',
    thing: 'The case',
    title: 'Workspaces and projects',
    onGuitar: `Everything packed for one gig — and only that gig.`,
    twin: 'A per-engagement share with its own documentation',
    runsOut: `Everything in the workspace is evidence for every conversation in it. A stale diagram is stale evidence, trusted by default. And the workspace boundary is a data boundary: client A's documents do not belong anywhere near client B's questions.`,
    tell: `It cites a decision you've since reversed. Retire old documents from the workspace the way you'd retire them from the share — the version that's still sitting there is the one that gets read.`,
    links: [{ href: `${KNOWING}#workspaces-and-projects`, label: 'Workspaces and projects, in Knowing the instrument' }],
  },
  {
    id: 'stand',
    sound: 'rustle',
    zone: 'floor',
    thing: 'The music stand',
    title: 'Files and documents',
    onGuitar: `Put the sheet music in front of it instead of asking it to remember the tune.`,
    twin: 'Handing someone the manual instead of quizzing their memory',
    runsOut: `Large files may be only partly read, and many binary formats — packet captures, event log files — can't be read at all.`,
    tell: `It answers a question about page 80 of the guide fluently and generically. Ask it to quote the passage it's relying on. If it can't, it didn't read it.`,
    links: [
      { href: `${KNOWING}#files-and-documents`, label: 'Files and documents, in Knowing the instrument' },
      { href: 'lab-packet-capture-with-ai.html', label: 'Packet captures with AI help' },
    ],
  },
  {
    id: 'search',
    sound: 'reverb',
    zone: 'floor',
    thing: 'The first pedal',
    title: 'Web search and retrieval',
    onGuitar: `Brings in a sound from outside the room — and doesn't always say which part was the pedal.`,
    twin: 'Checking the vendor KB instead of trusting recall',
    runsOut: `It's exactly as good as what it found, and what it finds is often a forum post that matches your symptom rather than your cause. It can also blend what it retrieved with what it recalled and not say which is which.`,
    tell: `A claim with no source, or a source that doesn't say what the claim says. Ask for the links and open them. That's the whole check.`,
    links: [{ href: `${KNOWING}#web-search-and-retrieval`, label: 'Web search and retrieval, in Knowing the instrument' }],
  },
  {
    id: 'sandbox',
    sound: 'distortion',
    zone: 'floor',
    thing: 'The second pedal',
    title: 'Code execution and data analysis',
    onGuitar: `Sounds perfect through its own amp. Yours is a different amp.`,
    twin: 'A scratch box',
    runsOut: `It runs in its sandbox, against the file you gave it — not your environment. A script that ran cleanly there can still fail on your box: a different shell version, a missing module, an account without the right rights.`,
    tell: `"I ran it and it works." It works there. That's a test result from a different environment, and it transfers about as well as one.`,
    links: [{ href: `${KNOWING}#code-execution-and-data-analysis`, label: 'Code execution and data analysis, in Knowing the instrument' }],
  },
  {
    id: 'looper',
    sound: 'echo',
    zone: 'floor',
    thing: 'The looper',
    title: 'Agentic modes',
    onGuitar: `Keeps playing after you take your hands off the strings.`,
    twin: 'Someone with your credentials and no change ticket',
    runsOut: `This is the point where it stops advising and starts acting, and that changes what you owe. The Drill exists because it can feel identical to a normal chat.`,
    tell: `It did a step you didn't list. Learn this mode in a home lab, where finding out what it does when it's wrong costs you an evening instead of a client.`,
    links: [
      { href: `${KNOWING}#agentic-modes`, label: 'Agentic modes, in Knowing the instrument' },
      { href: 'drill-who-acted.html', label: 'Drill: advised, executed, or acted?' },
    ],
  },
  {
    id: 'diy',
    sound: 'oscillator',
    zone: 'floor',
    thing: 'The half-built pedal',
    title: 'The API — building it into your own tools',
    onGuitar: `One effect you built yourself, wired into your own rig.`,
    twin: 'A library call inside your own script',
    runsOut: `It only sees what the script sends it, and there's no conversation — no follow-up, no "why did you say that." Every call costs something, and the key that makes the call is a credential.`,
    tell: `Its paragraph in the report reads just as authoritative as the lookups around it. Label it as model output, and leave the tech a way to dig further rather than a verdict to accept.`,
    links: [
      { href: `${KNOWING}#the-api`, label: 'The API, in Knowing the instrument' },
      { href: 'lab-owning-the-result.html#the-mix-moves', label: 'The mix moves as you get better' },
    ],
  },
]

export interface SwitchPosition {
  id: 'advises' | 'executes' | 'acts'
  title: string
  body: string
  links: { href: string; label: string }[]
}

// The three-way pickup selector: same strings, different voice.
export const SWITCH: SwitchPosition[] = [
  {
    id: 'advises',
    title: 'It advises',
    body: `You decide and make the change. Where a tech starts, ITOps is almost entirely advisory — call it 90–95%.`,
    links: [{ href: 'drill-who-acted.html', label: 'Drill: advised, executed, or acted?' }],
  },
  {
    id: 'executes',
    title: 'It executes',
    body: `It carries out a task you defined exactly. One-off scripts turn into small reusable tools as the player grows with the instrument.`,
    links: [
      { href: 'lab-owning-the-result.html#the-mix-moves', label: 'The mix moves as you get better' },
      { href: 'drill-who-acted.html', label: 'Drill: advised, executed, or acted?' },
    ],
  },
  {
    id: 'acts',
    title: 'It acts',
    body: `It acts on a system on its own judgment. Executing and acting carry most of the risk whatever their share — which is why the share should grow on purpose rather than by drift.`,
    links: [
      { href: 'lab-owning-the-result.html#who-has-hands-on-the-keyboard-and-why-it-s-operational', label: 'Who has hands on the keyboard' },
      { href: `${KNOWING}#agentic-modes`, label: 'Agentic modes' },
    ],
  },
]
