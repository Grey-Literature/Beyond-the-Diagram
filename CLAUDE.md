# CLAUDE.md — Beyond the Diagram (repo root)

## What this repo is

An IT fundamentals & troubleshooting learning platform — teaches protocol/system mechanism *and* diagnostic methodology, and uses a troubleshooting-game layer (Cases) to test the second using the first. Sibling in spirit to `webApps/portfolio/` (same author, same vault), but a serious standalone educational tool rather than a toy/game portfolio piece — don't carry over portfolio conventions (easter-egg protocol, whimsical tone) here without deliberately deciding to.

## Source of truth

**`it-troubleshooting-platform-concept.md` is canonical.** It's the full design doc — origin/vision, difficulty tiering, the three content types (Labs/Cases/Classification Drills), cross-cutting concepts (Signal vs. Silence, Eventual Consistency, Fail-Open vs. Fail-Closed, Trust-Boundary Flattening), named diagnostic methodology, the AI-fluency module, home-lab track, domain module content, and its own "Open Design Questions" section (scope and version-pinning strategy are still undecided; tech stack is resolved — see Structure section below and ROADMAP.md Phase 1). Don't duplicate its content into other docs; reference it instead. If code/implementation ever disagrees with it, flag the discrepancy rather than silently reconciling.

`ROADMAP.md` translates that concept doc into a phased backlog. Update the roadmap as phases complete or priorities shift; the concept doc itself should stay a stable reference, not a running task list.

## Structure — resolved: static-first with React islands (Phase 1)

Tech stack question is resolved. Not "fully static" or "fully React" — split by whether a piece of content actually holds state:

- **Static, no JS**: everything without a state machine — Labs prose, cross-cutting concept pages, domain module content, nav, landing. Includes the AI Fluency module: it's a paired weak-prompt/strong-pull-prompt example plus "now run both yourself against your own AI tool," never a live model call, so it never needed a backend or API key in the first place. Authored as plain HTML/CSS for now; revisit a static-site generator only once page count makes hand-authoring genuinely painful.
- **React, one isolated component per content type**: only where there's real state to hold — Cases (investigation path + score, process scored separately from outcome), Classification Drills (attempt + feedback), the placement quiz (answers → per-module tier, behavioral not self-reported). Each is a separate Vite entry point mounted into a `<div id="...">` on an otherwise-static page — not one SPA with a router owning the whole site. `app/`'s job is to build these bundles, not to be the app.
- **State persistence**: localStorage only, scoped to the browser. No accounts, no backend, resets on a cleared cache or a new device — that's the deliberate tradeoff for this stage, not an oversight. A shared, small localStorage wrapper module belongs in `app/src/`, imported by whichever island needs it, rather than each island rolling its own key scheme.

The stock Vite+React+TS template (counter demo, logos, docs/social links) has been stripped. `app/` now builds five real islands, each following the same pattern — a component + `main.tsx` mount entry, colocated scoped CSS (never element-level selectors — the bundle mounts into someone else's page), registered as an entry in `vite.config.ts`, previewable via the dev-only sandbox at `app/index.html`:

- `src/islands/drill-401-403/` — Classification Drill, HTTP 401-vs-403 "label lies to you" case (authn/authz domain, built to prove the mechanism, not part of the DHCP module below)
- `src/islands/case-trust-relationship/` — a Case: investigate-then-diagnose, process scored separately from outcome (concept doc's own design principle; AD domain, same proof purpose as the Drill above)
- `src/islands/placement-quiz/` — the behavioral placement quiz, currently wired up for one module (Networking Fundamentals)
- `src/islands/case-dhcp-apipa/` and `src/islands/drill-dhcp-1059/` — the real DHCP module's Case and Drill (Phase 2's vertical slice) — structurally identical to the two proof islands above, just different content, which is the actual confirmation that the islands pattern generalizes rather than being a one-off

See `app/README.md` for the exact steps to add another island. `src/lib/progress.ts` is the shared localStorage wrapper every stateful island uses — attempt logging (with an optional `meta` field for extras like process-vs-outcome), plus a separate per-module tier store for placement.

**Content pages live in a per-domain folder at the repo root** — `dhcp/` is the first and the pattern for the rest (`dns/`, `ad-gpo/`, ... as Phase 4 builds them out): a module `index.html` linking to one page per content item, Labs as plain static HTML/CSS, Cases and Drills as a thin static page mounting the matching island. `it-troubleshooting-platform-concept.md`'s DHCP section is the source for the real content (scope/lease/APIPA mechanism, the `ip helper-address` relay trap, the Event ID 1059 fail-closed race) — write new domain content from there, not from scratch.

**Deploy is resolved: GitHub Actions, not committed build output.** `.github/workflows/deploy.yml` builds `app/` on every push to `main`, then assembles the deployed site via an *exclude*-based `rsync` (skips `.git`, `.github`, `.claude`, `app/`, docs, `LICENSE`) rather than an explicit copy-list — a new top-level content folder ships automatically, it doesn't need the workflow edited. Learned this the hard way: the first version only copied `index.html`+`CNAME`+built islands, which would have silently 404'd on `assets/`, `dhcp/`, and `islands-demo.html` once deployed — caught by a local dry run before it ever shipped, not after. `islands-demo.html` at repo root is the proof/QA page: it references the built bundles directly (`/islands/<name>.js`, `/islands/assets/<name>.css`) so it only works once actually deployed (or against a local static-file simulation of `_site/`), unlike `app/index.html` which is dev-only. Asset filenames are deliberately unhashed so a hand-written page can link them by a stable name — see the comment in `vite.config.ts`. **One manual step still needed:** GitHub Pages' source needs to be switched to "GitHub Actions" in the repo's own Settings → Pages before this workflow can actually publish anything.

## Case-sensitivity (deploy-time gotcha)

Same caveat as the portfolio repo: local dev is likely Windows (case-insensitive), GitHub Pages is Linux (case-sensitive). Verify on-disk casing matches link casing exactly before committing.
