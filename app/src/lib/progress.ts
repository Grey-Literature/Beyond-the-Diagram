// Shared browser-scoped progress store for interactive content islands
// (Cases, Classification Drills, the placement quiz). No accounts, no
// backend — a deliberate tradeoff for this stage, not an oversight. See
// root CLAUDE.md's "Structure" section.

const KEY_PREFIX = 'btd:'

export interface Attempt {
  choice: string
  correct: boolean
  timestamp: number
  // Optional extra structured data an island wants to keep with the
  // attempt — e.g. a Case scoring process separately from outcome
  // (concept doc's "Score process separately from outcome" principle)
  // shouldn't need to overload `correct` to do it.
  meta?: Record<string, unknown>
}

function attemptsKey(contentId: string): string {
  return `${KEY_PREFIX}attempts:${contentId}`
}

function readAttempts(contentId: string): Attempt[] {
  try {
    const raw = localStorage.getItem(attemptsKey(contentId))
    return raw ? (JSON.parse(raw) as Attempt[]) : []
  } catch {
    // Unavailable (private browsing, quota, disabled storage) — treat as empty rather than failing the island.
    return []
  }
}

export function recordAttempt(
  contentId: string,
  choice: string,
  correct: boolean,
  meta?: Record<string, unknown>,
): Attempt {
  const attempt: Attempt = { choice, correct, timestamp: Date.now(), ...(meta ? { meta } : {}) }
  try {
    const attempts = readAttempts(contentId)
    attempts.push(attempt)
    localStorage.setItem(attemptsKey(contentId), JSON.stringify(attempts))
  } catch {
    // Same as above — the attempt still gets returned so the UI can proceed even if it couldn't be saved.
  }
  return attempt
}

export function getAttempts(contentId: string): Attempt[] {
  return readAttempts(contentId)
}

export function getLatestAttempt(contentId: string): Attempt | null {
  const attempts = readAttempts(contentId)
  return attempts.length ? attempts[attempts.length - 1] : null
}

// --- Placement / tiering ---------------------------------------------
//
// Per-module, not global (concept doc: someone can place as veteran in
// networking and beginner in AD/GPO). This is a standing classification,
// not a scored attempt log, so it gets its own small key scheme rather
// than living in the Attempt list above.

export type Tier = 'less-seasoned' | 'veteran'

function placementKey(moduleId: string): string {
  return `${KEY_PREFIX}placement:${moduleId}`
}

export function setPlacement(moduleId: string, tier: Tier): void {
  try {
    localStorage.setItem(placementKey(moduleId), tier)
  } catch {
    // Unavailable — the quiz's in-memory result still displays to the learner this session, it just won't persist.
  }
}

// --- Exploration -----------------------------------------------------
//
// For islands that reward poking around rather than scoring an answer
// (the Wielding AI guitar): the set of things a learner has found. Not an
// attempt — nothing is right or wrong — so it gets its own key scheme too.

function exploredKey(scopeId: string): string {
  return `${KEY_PREFIX}explored:${scopeId}`
}

export function getExplored(scopeId: string): string[] {
  try {
    const raw = localStorage.getItem(exploredKey(scopeId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function markExplored(scopeId: string, itemId: string): string[] {
  const found = getExplored(scopeId)
  if (!found.includes(itemId)) found.push(itemId)
  try {
    localStorage.setItem(exploredKey(scopeId), JSON.stringify(found))
  } catch {
    // Unavailable — the island keeps its in-memory set for this visit.
  }
  return found
}

export function resetExplored(scopeId: string): void {
  try {
    localStorage.removeItem(exploredKey(scopeId))
  } catch {
    // Nothing stored to clear.
  }
}

export function getPlacement(moduleId: string): Tier | null {
  try {
    const raw = localStorage.getItem(placementKey(moduleId))
    return raw === 'less-seasoned' || raw === 'veteran' ? raw : null
  } catch {
    return null
  }
}
