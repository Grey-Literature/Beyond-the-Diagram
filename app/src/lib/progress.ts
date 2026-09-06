// Shared browser-scoped progress store for interactive content islands
// (Cases, Classification Drills, the placement quiz). No accounts, no
// backend — a deliberate tradeoff for this stage, not an oversight. See
// root CLAUDE.md's "Structure" section.

const KEY_PREFIX = 'btd:'

export interface Attempt {
  choice: string
  correct: boolean
  timestamp: number
}

function storageKey(contentId: string): string {
  return `${KEY_PREFIX}${contentId}`
}

function readAttempts(contentId: string): Attempt[] {
  try {
    const raw = localStorage.getItem(storageKey(contentId))
    return raw ? (JSON.parse(raw) as Attempt[]) : []
  } catch {
    // Unavailable (private browsing, quota, disabled storage) — treat as empty rather than failing the island.
    return []
  }
}

export function recordAttempt(contentId: string, choice: string, correct: boolean): Attempt {
  const attempt: Attempt = { choice, correct, timestamp: Date.now() }
  try {
    const attempts = readAttempts(contentId)
    attempts.push(attempt)
    localStorage.setItem(storageKey(contentId), JSON.stringify(attempts))
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
