# app/ — islands

This is not a single-page app. It's a build tool for **React islands**: small,
independently-mounted bundles for the pieces of the platform that actually
hold state (Cases, Classification Drills, the placement quiz). Everything
else — Labs, concept pages, nav, the landing page — is plain static HTML/CSS
elsewhere in the repo. See the root [`CLAUDE.md`](../CLAUDE.md) for the full
rationale.

## Adding a new island

1. `src/islands/<name>/` — a component plus a `main.tsx` that mounts it into
   `document.getElementById('<name>-root')`. See `drill-401-403/` for the
   pattern.
2. Colocate scoped CSS with the component (`Component.css`), but **import it
   as a raw string and render it inline** rather than a normal CSS import:
   ```tsx
   import styles from './Component.css?raw'
   // ...
   return (
     <div className="my-island">
       <style>{styles}</style>
       {/* ... */}
     </div>
   )
   ```
   This isn't just style preference — with unhashed asset filenames (needed
   so a hand-written page can link a stable name), two islands whose CSS
   ends up byte-identical after edits get silently deduped into one file by
   Rollup, dropping the other's stylesheet. Hit this for real between the
   DHCP and DNS Drills. Inlining means a consuming page only ever needs the
   `<script>` tag, never a matching `<link rel="stylesheet">` to remember
   and keep in sync. Still: never write element-level selectors (`body`,
   `button`, ...) in that CSS — it mounts into someone else's page.
3. Register the entry in `vite.config.ts`'s `islands` object.
4. Add a mount div + `<script type="module">` tag to `index.html` so you can
   preview it locally with `npm run dev`. That file is a dev-only sandbox —
   it's not part of the production build and never gets deployed.
5. Use `src/lib/progress.ts` for any state that should survive a reload
   (localStorage-backed, browser-scoped — no accounts, no backend).
6. **Watch the whitespace in prose-heavy JSX.** When a text line ends and
   the next line starts with an inline element, JSX drops the newline
   *without* substituting a space — so
   ```tsx
   ... A missing
   <code>Access-Control-Allow-Origin</code> header ...
   ```
   renders as "A missingAccess-Control-Allow-Origin header". Write
   `{' '}` at the end of the text line whenever the next line opens with
   `<code>`, `<em>`, `<a>` or `<strong>`. Hit this for real in the CORS
   Drill; it's invisible in the source and only shows up when you read
   the rendered page text back, so do that rather than eyeballing the
   component.

## The server-room simulator is the exception

`src/islands/server-room/` is a full-viewport 3D island (three.js via React
Three Fiber), so it has its own dev page, `server-room.html`, instead of a
slot in `index.html`. Its simulation lives outside the island, in
`src/sim/`: plain TypeScript with no React and no three.js.

- `catalog.ts` holds the hardware as data. Ports exist because the data says so.
- `engine.ts` has `derive(state)`, which works out power, links, VLAN segments, iSCSI paths, cluster and services.
- `actions.ts` has `apply(state, action)`, which carries every rule a learner can bump into.
- `baseline.ts` holds the default room and the scenarios.

The island's zustand store is a thin wrapper around `apply()`. Keep new rules
in `src/sim/`, never inside a 3D component, because that's what the tests can
reach.

`src/sim/scenarios.test.ts` is the scenario harness. For every scenario it
checks that loading it breaks exactly the expected health checks, and that a
scripted fix made of real learner actions returns everything to green.
Changing the engine or the topology means updating the expectations there on
purpose, not by accident. `src/sim/rules.test.ts` covers the physical and
procedural rules.

## Commands

```bash
npm run dev      # sandbox at index.html, all registered islands mounted
npm run build     # builds each island to dist/islands/<name>.js
npm run preview   # serves the dist/ build
npm test          # vitest: the server-room engine's scenario harness + rules
```

## Deploy

`.github/workflows/deploy.yml` builds this on every push to `main` and
assembles the deployed site from the repo root's hand-written pages plus
`dist/islands/`. Nothing here gets committed to git — see root `CLAUDE.md`.
`../islands-demo.html` references the built paths directly, so it's only
meaningful once deployed (or against a local static simulation of the
assembled site) — use `index.html` here for day-to-day dev instead.
