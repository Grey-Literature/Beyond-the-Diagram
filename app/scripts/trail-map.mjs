// Generates the landing page's relief trail map and writes it into index.html between
// the trail-map markers. Static output on purpose: the home page ships no JS.
//   node app/scripts/trail-map.mjs
//
// The model: a terraced relief (like a laser-cut topo map). Terrace k is step k of the
// scientific method, never difficulty. Home, where the root cause ends up, is the ground.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const INDEX = fileURLToPath(new URL('../../index.html', import.meta.url));

// Projection: a table model seen from the front and above, turned slightly.
const S = 4.3, TILT = 0.5, H = 13, ANG = -9 * Math.PI / 180;
const LEVELS = 5, WALL_STEPS = 8;
const f = (n) => Math.round(n * 10) / 10;
function P(x, y, z) {
  const xr = x * Math.cos(ANG) - y * Math.sin(ANG);
  const yr = x * Math.sin(ANG) + y * Math.cos(ANG);
  return [xr * S, yr * S * TILT - z * H];
}

// Ranges. c = base centre, R = base radius, drift = how far the summit leans per terrace.
const massifs = [
  { id: 'names', name: 'Names & Addresses', c: [-58, -12], R: 36, drift: [3, 2.5], seed: 1 },
  { id: 'gear', name: 'Wire & Gear', c: [-110, 30], R: 22, drift: [-1.5, 1.5], seed: 2 },
  { id: 'lookout', name: 'The Lookout', c: [0, -32], R: 17, drift: [0, 0.6], seed: 3 },
  { id: 'trust', name: 'Trust & Delivery', c: [52, 20], R: 28, drift: [-1.5, -1], seed: 4 },
  { id: 'identity', name: 'Identity', c: [104, -38], R: 34, drift: [-3, 2], seed: 5 },
];
const M = Object.fromEntries(massifs.map((m) => [m.id, m]));

// Trailheads: θ in degrees, 90 = facing the viewer. Trails switchback up the face they start on.
const trailheads = [
  { id: 'dhcp', m: 'names', th: 118, name: 'DHCP', href: 'dhcp/index.html' },
  { id: 'dns', m: 'names', th: 62, name: 'DNS', href: 'dns/index.html' },
  { id: 'gear', m: 'gear', th: 45, name: 'Abstracted Gear', href: 'prosumer-networking/index.html' },
  { id: 'monitoring', m: 'lookout', th: 90, name: 'Monitoring', href: 'monitoring/index.html' },
  { id: 'email', m: 'trust', th: 120, name: 'Email Auth', href: 'email-auth/index.html' },
  { id: 'remote', m: 'trust', th: 48, name: 'Remote Access', href: 'remote-access/index.html' },
  { id: 'authn', m: 'identity', th: 182, name: 'Authn / Authz', href: 'authn-authz/index.html' },
  { id: 'ad', m: 'identity', th: 100, name: 'AD / GPO', href: 'ad-gpo/index.html' },
  { id: 'cloud', m: 'identity', th: 42, name: 'Cloud Identity', href: 'cloud-identity/index.html' },
];

// Deterministic wobble so the ranges look surveyed rather than drawn with a compass.
function harmonics(seed) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return [2, 3, 5, 7].map((n, i) => ({ n, a: [0.07, 0.05, 0.03, 0.018][i] * (0.7 + rnd() * 0.6), p: rnd() * Math.PI * 2 }));
}
massifs.forEach((m) => { m.h = harmonics(m.seed); });

const frac = (k) => 1 - (k - 1) / 5.4;
function centre(m, k) { const t = Math.max(0, Math.min(LEVELS - 1, k - 1)); return [m.c[0] + m.drift[0] * t, m.c[1] + m.drift[1] * t]; }
function radius(m, k, th) {
  let w = 1;
  for (const h of m.h) w += h.a * Math.sin(h.n * th + h.p + k * 0.45);
  return m.R * frac(k) * w;
}
function ring(m, k, n = 120) {
  const [cx, cy] = centre(m, k), pts = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2, r = radius(m, k, th);
    pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
  }
  return pts;
}
const rings = {};
for (const m of massifs) for (let k = 1; k <= LEVELS; k++) rings[`${m.id}-${k}`] = ring(m, k);

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function height(x, y) {
  let z = 0;
  for (const m of massifs) for (let k = LEVELS; k > z; k--) if (inside(rings[`${m.id}-${k}`], x, y)) { z = k; break; }
  return z;
}

const pathOf = (pts, z, close = true) =>
  pts.map(([x, y], i) => { const [X, Y] = P(x, y, z); return `${i ? 'L' : 'M'}${f(X)} ${f(Y)}`; }).join('') + (close ? 'Z' : '');

// Split a world-space polyline into constant-terrace runs plus the risers between them.
function drape(pts) {
  const runs = [], risers = [];
  let cur = null;
  for (const [x, y] of pts) {
    const z = height(x, y);
    if (!cur || cur.z !== z) {
      if (cur) {
        // The step up (or down) happens at this sample; both runs meet on its riser.
        risers.push({ z: Math.max(z, cur.z), lo: Math.min(z, cur.z), x, y });
        cur.pts.push([x, y]);
      }
      cur = { z, pts: [] };
      runs.push(cur);
    }
    cur.pts.push([x, y]);
  }
  return { runs, risers };
}

function switchback(t) {
  const m = M[t.m], out = [], N = 360, turns = t.turns ?? 3, amp = ((t.amp ?? 26) * Math.PI) / 180;
  const th0 = (t.th * Math.PI) / 180;
  for (let i = 0; i <= N; i++) {
    const u = i / N, rho = 1.14 * (1 - u);
    const k = 1 + 5.4 * (1 - rho);
    const [cx, cy] = centre(m, k);
    const th = th0 + amp * Math.sin(Math.PI * turns * u) * (1 - 0.6 * u);
    const r = rho * radius(m, Math.min(k, LEVELS), th) / frac(Math.max(1, Math.min(k, LEVELS)));
    out.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
  }
  return out;
}
const trails = trailheads.map((t) => ({ ...t, pts: switchback(t) }));
for (const t of trails) t.start = t.pts[0];

// The valley: a network drawn at ground level. Every junction is a half-split.
const HOME = [2, 68], F1 = [2, 50], LJ = [-48, 46], RJ = [50, 52], LJ2 = [-74, 50], RJ2 = [88, 30], CABIN = [-104, 66];
const th = Object.fromEntries(trails.map((t) => [t.id, t.start]));
const valley = [
  { id: 'home', routes: 'dhcp dns gear cabin monitoring email remote authn ad cloud', pts: [HOME, F1] },
  { id: 'reach', routes: 'dhcp dns gear cabin', pts: [F1, [-20, 50], LJ] },
  { id: 'trust-side', routes: 'email remote authn ad cloud', pts: [F1, [26, 53], RJ] },
  { id: 'monitoring', trail: 'monitoring', pts: [F1, [4, 22], th.monitoring] },
  { id: 'names', routes: 'dhcp dns', pts: [LJ, [-52, 36], [-56, 30]] },
  { id: 'dhcp', trail: 'dhcp', pts: [[-56, 30], th.dhcp] },
  { id: 'dns', trail: 'dns', pts: [[-56, 30], [-44, 26], th.dns] },
  { id: 'gear-side', routes: 'gear cabin', pts: [LJ, LJ2] },
  { id: 'gear', trail: 'gear', pts: [LJ2, th.gear] },
  { id: 'cabin', trail: 'cabin', pts: [LJ2, [-90, 62], CABIN] },
  { id: 'email', trail: 'email', pts: [RJ, [44, 50], th.email] },
  { id: 'remote', trail: 'remote', pts: [RJ, [66, 50], th.remote] },
  { id: 'id-side', routes: 'authn ad cloud', pts: [RJ, [78, 44], RJ2] },
  { id: 'authn', trail: 'authn', pts: [RJ2, [84, 8], [70, -14], th.authn] },
  { id: 'ad', trail: 'ad', pts: [RJ2, th.ad] },
  { id: 'cloud', trail: 'cloud', pts: [RJ2, [104, 26], th.cloud] },
];
// Catmull-Rom through world points, sampled so the drape check sees every step.
function smooth(pts, per = 18) {
  if (pts.length < 3) {
    const out = [];
    for (let i = 0; i <= per; i++) { const u = i / per; out.push([pts[0][0] + (pts[1][0] - pts[0][0]) * u, pts[0][1] + (pts[1][1] - pts[0][1]) * u]); }
    return out;
  }
  const out = [], p = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < p.length - 2; i++) {
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((d) => 0.5 * ((2 * p[i][d]) + (-p[i - 1][d] + p[i + 1][d]) * t + (2 * p[i - 1][d] - 5 * p[i][d] + 4 * p[i + 1][d] - p[i + 2][d]) * t2 + (-p[i - 1][d] + 3 * p[i][d] - 3 * p[i + 1][d] + p[i + 2][d]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const warnings = [];
for (const v of valley) {
  v.world = smooth(v.pts);
  const high = v.world.filter(([x, y]) => height(x, y) > 0).length;
  if (high) warnings.push(`valley segment "${v.id}" climbs onto terrain at ${high} samples`);
}

// Creek and lake, ground level.
const creek = smooth([[14, -80], [16, -52], [22, -22], [20, 4], [24, 30], [27, 56]], 20);
const lake = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; lake.push([30 + 9 * Math.cos(a) * (1 + 0.08 * Math.sin(3 * a)), 64 + 5 * Math.sin(a)]); }
for (const [x, y] of [...creek, ...lake]) if (height(x, y) > 0) { warnings.push('creek or lake touches terrain'); break; }

// ---------- render ----------
const BOARD = [[-136, -80], [136, -80], [136, 80], [-136, 80]];
const g = [];
const defs = [];
const uses = (id, cls) => { const out = []; for (let j = WALL_STEPS; j >= 1; j--) out.push(`<use href="#${id}" class="${cls}${j === WALL_STEPS ? ' wall-foot' : ''}" transform="translate(0 ${f((j * H) / WALL_STEPS)})"/>`); return out.join(''); };

// Board with a base thickness.
defs.push(`<path id="tm-board" d="${pathOf(BOARD, 0)}"/>`);
g.push(`<g class="tm-base">${uses('tm-board', 'board-edge')}<use href="#tm-board" class="board-face"/></g>`);

// Ground: faint survey grid, creek, lake, valley network.
const grid = [];
for (let x = -120; x <= 120; x += 20) grid.push(pathOf([[x, -80], [x, 80]], 0, false));
for (let y = -60; y <= 60; y += 20) grid.push(pathOf([[-136, y], [136, y]], 0, false));
const ground = [`<path class="grid" d="${grid.join('')}"/>`, `<path class="creek" d="${pathOf(creek, 0, false)}"/>`, `<path class="lake" d="${pathOf(lake, 0)}"/>`];
const valleyRuns = { 0: [] };
for (let k = 1; k <= LEVELS; k++) valleyRuns[k] = [];
const risersBy = {}; for (let k = 1; k <= LEVELS; k++) risersBy[k] = [];
for (const v of valley) {
  const d = drape(v.world);
  for (const r of d.runs) valleyRuns[r.z].push(`<path class="valley" data-routes="${v.routes ?? v.trail}" d="${pathOf(r.pts, r.z, false)}"/>`);
}
const trailRuns = { 0: [] }; for (let k = 1; k <= LEVELS; k++) trailRuns[k] = [];
for (const t of trails) {
  const d = drape(t.pts);
  for (const r of d.runs) trailRuns[r.z].push(`<path class="trail" data-trail="${t.id}" d="${pathOf(r.pts, r.z, false)}"/>`);
  for (const s of d.risers) {
    const [x1, y1] = P(s.x, s.y, s.lo), [x2, y2] = P(s.x, s.y, s.z);
    risersBy[s.z].push(`<path class="trail riser" data-trail="${t.id}" d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}"/>`);
  }
}
g.push(`<g class="tm-ground">${ground.join('')}${valleyRuns[0].join('')}${trailRuns[0].join('')}</g>`);

// Terraces, lowest first: every wall of a level, then its risers, then every face.
for (let k = 1; k <= LEVELS; k++) {
  const walls = [], faces = [], engr = [];
  for (const m of massifs) {
    const id = `tm-${m.id}-${k}`;
    defs.push(`<path id="${id}" d="${pathOf(rings[`${m.id}-${k}`], k)}"/>`);
    walls.push(uses(id, 'wall'));
    faces.push(`<use href="#${id}" class="face"/>`);
    // An engraved intermediate contour halfway to the next terrace.
    const mid = ring(m, k + 0.5).map(([x, y]) => [x, y]);
    engr.push(`<path class="engrave" d="${pathOf(mid, k)}"/>`);
  }
  g.push(`<g class="tm-level" data-level="${k}" style="--rise: ${k * H}px">${walls.join('')}${risersBy[k].join('')}${faces.join('')}${engr.join('')}${valleyRuns[k].join('')}${trailRuns[k].join('')}</g>`);
}

// Contour numbers down the front of Names & Addresses: the step you're on.
const numbers = [];
for (let k = 1; k <= LEVELS; k++) {
  const m = M.names, [cx, cy] = centre(m, k), a = (100 * Math.PI) / 180, r = radius(m, k, a) - 3.2;
  const [X, Y] = P(cx + r * Math.cos(a), cy + r * Math.sin(a), k);
  numbers.push(`<text class="elev" x="${f(X)}" y="${f(Y + 3.5)}">${k}</text>`);
}

// Landmarks: summit marks, the lookout tower, home, the cabin, junction nodes.
const marks = [];
for (const m of massifs) {
  const [x, y] = centre(m, LEVELS), [X, Y] = P(x, y, LEVELS);
  if (m.id === 'lookout') {
    marks.push(`<g class="tower" transform="translate(${f(X)} ${f(Y)})"><path d="M-6 0L-3.5 -22M6 0L3.5 -22M-5 -8L5 -8M-4.3 -15L4.3 -15M-5 -8L4.3 -15M5 -8L-4.3 -15"/><path class="cab" d="M-6.5 -22h13v-7h-13z"/><path class="roof" d="M-8 -29L0 -34L8 -29z"/></g>`);
  } else {
    marks.push(`<path class="summit" d="M${f(X)} ${f(Y - 7)}l5 8h-10z"/>`);
  }
}
const node = (pt, cls) => { const [X, Y] = P(pt[0], pt[1], 0); return `<g class="${cls}" transform="translate(${f(X)} ${f(Y)})"><ellipse rx="6" ry="3.4"/><ellipse class="core" rx="2.2" ry="1.3"/></g>`; };
marks.push(node(F1, 'junction'), node(LJ, 'junction'), node(RJ, 'junction'), node(LJ2, 'junction'), node(RJ2, 'junction'), node([-56, 30], 'junction'));
for (const t of trails) {
  const [X, Y] = P(t.start[0], t.start[1], 0);
  marks.push(`<g class="trailhead" data-trail="${t.id}" transform="translate(${f(X)} ${f(Y)})"><path d="M0 0v-12"/><rect x="-4" y="-17" width="8" height="6" rx="1"/></g>`);
}
{
  const [X, Y] = P(HOME[0], HOME[1], 0);
  marks.push(`<g class="home" transform="translate(${f(X)} ${f(Y)})"><path class="wall" d="M-11 0v-10h22v10z"/><path class="roof" d="M-14 -9L0 -19L14 -9z"/><path class="door" d="M-2.5 0v-6h5v6"/></g>`);
  const [CX, CY] = P(CABIN[0], CABIN[1], 0);
  marks.push(`<g class="cabin" data-trail="cabin" transform="translate(${f(CX)} ${f(CY)})"><path class="wall" d="M-7 0v-7h14v7z"/><path class="roof" d="M-9 -6L0 -13L9 -6z"/><path class="chimney" d="M4 -10v-5h2.5v3.2"/></g>`);
}

// Bounds and viewBox.
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
const grow = (X, Y) => { minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y); };
for (const [x, y] of BOARD) { grow(...P(x, y, 0)); const [X, Y] = P(x, y, 0); grow(X, Y + H); }
for (const m of massifs) for (const [x, y] of rings[`${m.id}-${LEVELS}`]) grow(...P(x, y, LEVELS + 2.4));
const pad = 14, padBottom = 44; // room under the board for Home's caption
const vb = [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad + padBottom].map(f);
const pct = (X, Y) => [f(((X - vb[0]) / vb[2]) * 100), f(((Y - vb[1]) / vb[3]) * 100)];

// HTML pins, positioned in percentages of the viewBox so they track the SVG at any width.
const pins = [];
for (const t of trails) {
  const [x, y] = pct(...P(t.start[0], t.start[1], 0));
  pins.push(`<a class="pin pin-trailhead" data-trail="${t.id}" href="${t.href}" style="--x: ${x}%; --y: ${y}%"><span>${t.name}</span></a>`);
}
for (const m of massifs) {
  if (m.id === 'lookout') continue;
  const [cx, cy] = centre(m, LEVELS), [x, y] = pct(...P(cx, cy, LEVELS + 0.9));
  pins.push(`<span class="pin pin-range" style="--x: ${x}%; --y: ${y}%">${m.name}</span>`);
}
{
  const [cx, cy] = centre(M.lookout, LEVELS), [x, y] = pct(...P(cx, cy, LEVELS + 2.6));
  pins.push(`<span class="pin pin-range" style="--x: ${x}%; --y: ${y}%">The Lookout</span>`);
  const [hx, hy] = pct(...P(HOME[0], HOME[1], 0));
  pins.push(`<span class="pin pin-home" style="--x: ${hx}%; --y: ${hy}%"><strong>Home</strong> Every trail starts and ends here</span>`);
  const [bx, by] = pct(...P(CABIN[0], CABIN[1], 0));
  pins.push(`<a class="pin pin-trailhead pin-cabin" data-trail="cabin" href="server-room/" style="--x: ${bx}%; --y: ${by}%"><span>Server room cabin</span></a>`);
  const q = (pt, text, cls = '') => { const [x, y] = pct(...P(pt[0], pt[1], 0)); pins.push(`<span class="pin pin-fork${cls}" style="--x: ${x}%; --y: ${y}%">${text}</span>`); };
  q(LJ, 'Can it get there?', ' fork-left');
  q(RJ, 'Is it allowed?', ' fork-right');
}

// Hover a trailhead: its trail lights up. One rule per trail, since :has can't read attributes.
const hover = [...trails.map((t) => t.id), 'cabin']
  .map((id) => `.trail-map:has(.pin[data-trail="${id}"]:is(:hover, :focus-visible)) :is(:is(.trail, .trailhead, .cabin)[data-trail="${id}"], .valley[data-routes~="${id}"])`)
  .join(',\n');

const svg = `<svg class="relief" viewBox="${vb.join(' ')}" aria-hidden="true" focusable="false">
<defs>${defs.join('')}</defs>
${g.join('\n')}
<g class="tm-marks">${numbers.join('')}${marks.join('')}</g>
</svg>`;

const fragment = `<!-- trail-map:start (generated by app/scripts/trail-map.mjs; edit the script, not this block) -->
<style>
${hover} { --lit: 1; }
</style>
<div class="relief-frame">
${svg}
<nav class="map-pins" aria-label="Trailheads on the map">
${pins.join('\n')}
</nav>
</div>
<!-- trail-map:end -->`;

const html = readFileSync(INDEX, 'utf8');
const re = /<!-- trail-map:start[\s\S]*?<!-- trail-map:end -->/;
if (!re.test(html)) throw new Error('index.html has no trail-map markers');
writeFileSync(INDEX, html.replace(re, () => fragment));
console.log(`trail map written: viewBox ${vb.join(' ')}, ${(fragment.length / 1024).toFixed(1)} KB`);
for (const w of warnings) console.warn('warning:', w);
