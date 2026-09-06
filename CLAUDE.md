# CLAUDE.md — Beyond the Diagram (repo root)

## What this repo is

An IT fundamentals & troubleshooting learning platform — teaches protocol/system mechanism *and* diagnostic methodology, and uses a troubleshooting-game layer (Cases) to test the second using the first. Sibling in spirit to `webApps/portfolio/` (same author, same vault), but a serious standalone educational tool rather than a toy/game portfolio piece — don't carry over portfolio conventions (easter-egg protocol, whimsical tone) here without deliberately deciding to.

## Source of truth

**`it-troubleshooting-platform-concept.md` is canonical.** It's the full design doc — origin/vision, difficulty tiering, the three content types (Labs/Cases/Classification Drills), cross-cutting concepts (Signal vs. Silence, Eventual Consistency, Fail-Open vs. Fail-Closed, Trust-Boundary Flattening), named diagnostic methodology, the AI-fluency module, home-lab track, domain module content, and — importantly — its own "Open Design Questions" section (tech stack, scope, version-pinning strategy are all still genuinely undecided as of this writing). Don't duplicate its content into other docs; reference it instead. If code/implementation ever disagrees with it, flag the discrepancy rather than silently reconciling.

`ROADMAP.md` translates that concept doc into a phased backlog. Update the roadmap as phases complete or priorities shift; the concept doc itself should stay a stable reference, not a running task list.

## Structure — two unwired halves right now

- **Repo root** (`index.html`, this file, README, ROADMAP) — plain static HTML/CSS, no build step. Deploys as-is via GitHub Pages using the repo's `CNAME`. This is what's currently live.
- **`app/`** — a Vite + React + TypeScript scaffold. Exploratory only right now: stock template, no real content, **not linked from the landing page and not part of the deploy**. The concept doc leaves tech stack as an open question ("maybe the whole platform is Vite+React, maybe not — use where it makes sense"), so treat this as a testbed, not a commitment, until that question actually gets resolved.

When that question does get resolved, update this file to describe the real split (e.g. "root index.html is a thin static shell, everything else is the React app" or whatever it ends up being) rather than leaving this two-track description stale.

## Case-sensitivity (deploy-time gotcha)

Same caveat as the portfolio repo: local dev is likely Windows (case-insensitive), GitHub Pages is Linux (case-sensitive). Verify on-disk casing matches link casing exactly before committing.
