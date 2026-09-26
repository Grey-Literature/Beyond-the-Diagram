// Generates a module's half-splitting mini-map: a top-down view of the same terraced model as the
// home page. Terrace k is step k of the method; the forks sit on the Experiment ridge (4) and each
// cause gets its own summit (5, Analyze). Writes into the module's index.html between markers.
//   node app/scripts/minimap.mjs dhcp
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { modules } from './minimap-modules.mjs';

const id = process.argv[2];
const mod = modules[id];
if (!mod) throw new Error(`no mini-map defined for "${id}". Known: ${Object.keys(modules).join(', ')}`);
const INDEX = fileURLToPath(new URL(`../../${id}/index.html`, import.meta.url));

const W = 1200, HGT = 790, CX = 600, CY = 340, LIFT = 5;
const f = (n) => Math.round(n * 10) / 10;

function harmonics(seed) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return [2, 3, 5, 7].map((n, i) => ({ n, a: [0.05, 0.04, 0.025, 0.015][i] * (0.7 + rnd() * 0.6), p: rnd() * Math.PI * 2 }));
}
function blob({ c, rx, ry }, seed, n = 140) {
  const h = harmonics(seed), pts = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    let w = 1;
    for (const k of h) w += k.a * Math.sin(k.n * th + k.p);
    pts.push([CX + c[0] + rx * w * Math.cos(th), CY + c[1] + ry * w * Math.sin(th)]);
  }
  return pts;
}
const d = (pts, close = true) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('') + (close ? 'Z' : '');

// Catmull-Rom through absolute points.
function smooth(pts, per = 14) {
  if (pts.length < 3) return pts;
  const out = [], p = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < p.length - 2; i++) for (let j = 0; j < per; j++) {
    const t = j / per, t2 = t * t, t3 = t2 * t;
    out.push([0, 1].map((k) => 0.5 * ((2 * p[i][k]) + (-p[i - 1][k] + p[i + 1][k]) * t + (2 * p[i - 1][k] - 5 * p[i][k] + 4 * p[i + 1][k] - p[i + 2][k]) * t2 + (-p[i - 1][k] + 3 * p[i][k] - 3 * p[i + 1][k] + p[i + 2][k]) * t3)));
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const abs = ([x, y]) => [CX + x, CY + y];

// Terrain: four nested terraces, then one small summit per cause.
const levels = [
  { k: 1, shape: { c: [0, 40], rx: 540, ry: 320 } },
  { k: 2, shape: { c: [0, 15], rx: 490, ry: 265 } },
  { k: 3, shape: { c: [0, -5], rx: 440, ry: 205 } },
  { k: 4, shape: { c: [0, -55], rx: 395, ry: 140 } },
];
const svg = [];
svg.push(`<rect class="mm-ground" x="0" y="0" width="${W}" height="${HGT}"/>`);
const grid = [];
for (let x = 50; x < W; x += 50) grid.push(`M${x} 0V${HGT}`);
for (let y = 50; y < HGT; y += 50) grid.push(`M0 ${y}H${W}`);
svg.push(`<path class="mm-grid" d="${grid.join('')}"/>`);

const layer = (pts, k) => `<g class="mm-level" data-level="${k}"><path class="mm-wall" transform="translate(0 ${LIFT})" d="${d(pts)}"/><path class="mm-face" d="${d(pts)}"/></g>`;
levels.forEach((l, i) => {
  const pts = blob(l.shape, mod.seed + i);
  svg.push(layer(pts, l.k));
  const mid = blob({ c: l.shape.c, rx: l.shape.rx - 22, ry: l.shape.ry - 18 }, mod.seed + i + 10);
  if (l.k < 4) svg.push(`<path class="mm-engrave" d="${d(mid)}"/>`);
});
for (const [i, leaf] of mod.leaves.entries()) {
  svg.push(layer(blob({ c: leaf.at, rx: 44, ry: 30 }, mod.seed + 20 + i), 5));
}


// Routes. data-routes lists every leaf a segment leads to, so hovering a leaf lights its whole path.
const all = mod.leaves.map((l) => l.id).join(' ');
const route = (pts, routes, cls = 'mm-trail') => `<path class="${cls}" data-routes="${routes}" d="${d(smooth(pts.map(abs)), false)}"/>`;
svg.push(route(mod.descent, all, 'mm-descent'));
svg.push(route(mod.trunk, all));
for (const b of mod.branches) svg.push(route(b.pts, b.routes));

// Markers: waypoints on the trunk, junctions at the forks, summits, home.
for (const w of mod.waypoints) { const [x, y] = abs(w.at); svg.push(`<g class="mm-waypoint" transform="translate(${f(x)} ${f(y)})"><circle r="9"/><text y="4">${w.step}</text></g>`); }
for (const fk of mod.forks) { const [x, y] = abs(fk.at); svg.push(`<g class="mm-junction" transform="translate(${f(x)} ${f(y)})"><circle r="8"/><circle class="core" r="3"/></g>`); }
for (const leaf of mod.leaves) { const [x, y] = abs(leaf.at); svg.push(`<path class="mm-summit" data-routes="${leaf.id}" d="M${f(x)} ${f(y - 9)}l8 13h-16z"/>`); }
{ const [x, y] = abs(mod.home); svg.push(`<g class="mm-home" transform="translate(${f(x)} ${f(y)})"><path class="wall" d="M-14 0v-13h28v13z"/><path class="roof" d="M-18 -12L0 -25L18 -12z"/><path class="door" d="M-3.5 0v-8h7v8"/></g>`); }

// HTML labels, in viewBox percentages.
const pct = ([x, y]) => { const [ax, ay] = abs([x, y]); return `--x: ${f((ax / W) * 100)}%; --y: ${f((ay / HGT) * 100)}%`; };
const labels = [];
for (const w of mod.waypoints) labels.push(`<div class="mm-label mm-label-waypoint mm-side-${w.side ?? 'right'}" style="${pct(w.at)}"><span class="mm-step">${w.stepName}</span>${w.href ? `<a href="${w.href}">${w.text}</a>` : w.text}${w.note ? `<small>${w.note}</small>` : ''}</div>`);
for (const fk of mod.forks) labels.push(`<div class="mm-label mm-label-fork" style="${pct(fk.labelAt)}"><span class="mm-step">4 Experiment</span><span class="mm-question">${fk.question}</span><span class="mm-test">${fk.test}</span></div>`);
for (const b of mod.branches) if (b.answer) labels.push(`<span class="mm-label mm-answer" style="${pct(b.answerAt)}">${b.answer}</span>`);
for (const leaf of mod.leaves) {
  const link = leaf.href ? `<a class="mm-leaf-link" href="${leaf.href}"><i class="blaze blaze-${leaf.kind}" aria-hidden="true"></i>${leaf.linkText}</a>` : '';
  labels.push(`<div class="mm-label mm-label-leaf mm-side-${leaf.side ?? 'above'}" style="${pct(leaf.at)}" data-leaf="${leaf.id}" tabindex="0"><span class="mm-step">5 Analyze</span><span class="mm-leaf-name">${leaf.name}</span><small>${leaf.note}</small>${link}</div>`);
}
labels.push(`<div class="mm-label mm-label-home" style="${pct(mod.home)}"><strong>Home</strong> ${mod.homeNote}</div>`);
labels.push(`<span class="mm-label mm-answer mm-descent-label" style="${pct(mod.descentLabelAt)}">6 Conclusion: the way home</span>`);

const hover = mod.leaves.map((l) => `.minimap:has([data-leaf="${l.id}"]:is(:hover, :focus-within)) [data-routes~="${l.id}"]`).join(',\n');

const fragment = `<!-- minimap:start (generated by app/scripts/minimap.mjs; edit the script or minimap-modules.mjs, not this block) -->
<style>
${hover} { --lit: 1; }
</style>
<div class="minimap">
<svg class="mm-svg" viewBox="0 0 ${W} ${HGT}" aria-hidden="true" focusable="false">
${svg.join('\n')}
</svg>
<div class="mm-labels">
${labels.join('\n')}
</div>
</div>
<!-- minimap:end -->`;

const html = readFileSync(INDEX, 'utf8');
const re = /<!-- minimap:start[\s\S]*?<!-- minimap:end -->/;
if (!re.test(html)) throw new Error(`${id}/index.html has no minimap markers`);
writeFileSync(INDEX, html.replace(re, () => fragment));
console.log(`mini-map written to ${id}/index.html (${(fragment.length / 1024).toFixed(1)} KB)`);
