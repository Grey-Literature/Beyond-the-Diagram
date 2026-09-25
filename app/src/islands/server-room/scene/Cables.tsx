import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CABLE_INFO, DEV, PORTS, RACK, portWorld } from '../../../sim/catalog';
import type { Cable, PortKind } from '../../../sim/types';
import { anim, useDerived, useSim, useUI } from '../store';
import { dragOrigin, isClick } from './interact';
import { BOX } from './labels';

const PLUG: Partial<Record<PortKind, [number, number, number]>> = {
  rj45: [0.0112, 0.0082, 0.024], keystone: [0.0112, 0.0082, 0.024], console: [0.0112, 0.0082, 0.024],
  sfp: [0.0135, 0.0085, 0.05], stack: [0.018, 0.0085, 0.05], sc: [0.009, 0.009, 0.03], nema515r: [0.03, 0.024, 0.045], dc: [0.008, 0.008, 0.02],
  c13: [0.02, 0.014, 0.038], c14: [0.024, 0.017, 0.04], c19: [0.028, 0.02, 0.045], c20: [0.028, 0.022, 0.045], l530r: [0.042, 0.042, 0.06], l530p: [0.042, 0.042, 0.06], ebm: [0.03, 0.019, 0.045],
};
const PLUG_COLOR: Record<string, string> = { dac: '#8b939c', om4: '#2e343b', os2sc: '#16a34a', stack: '#8b939c', pwr13: '#141518', pwr19: '#141518', pwr530: '#141518', ebm: '#9a2b20', brick: '#1c1d21' };

interface End { pos: THREE.Vector3; n: THREE.Vector3; face: string; wall: boolean; plug: number }
function endOf(pid: string): End {
  const p = PORTS[pid];
  const d = DEV[p.deviceId];
  const w = portWorld(p, d.serviceable ? anim.ext[d.id] ?? 0 : 0);
  return { pos: new THREE.Vector3(...w.pos), n: new THREE.Vector3(...w.n), face: w.n[2] < 0 ? 'rear' : 'front', wall: d.type === 'wallpanel', plug: PLUG[p.kind]?.[2] ?? 0.02 };
}

function routePoints(A: End, B: End): THREE.Vector3[] {
  const a0 = A.pos.clone().addScaledVector(A.n, A.plug);
  const b0 = B.pos.clone().addScaledVector(B.n, B.plug);
  const a1 = a0.clone().addScaledVector(A.n, 0.03);
  const b1 = b0.clone().addScaledVector(B.n, 0.03);
  let pts: THREE.Vector3[];
  if (A.wall || B.wall) {
    const [W0, W1, R0, R1, R] = A.wall ? [a0, a1, b0, b1, B] : [b0, b1, a0, a1, A];
    const ez = R.face === 'rear' ? -0.47 : 0.42;
    const path = [W0, W1, new THREE.Vector3(W1.x + 0.06, 2.32, W1.z), new THREE.Vector3(-0.32, 2.32, W1.z), new THREE.Vector3(-0.3, 2.32, ez), new THREE.Vector3(-0.3, RACK.height - 0.04, ez), new THREE.Vector3(-0.3, R1.y + 0.04, (ez + R1.z) / 2), R1, R0];
    pts = A.wall ? path : path.reverse();
  } else if (A.n.dot(B.n) > 0.5) {
    const dist = a1.distanceTo(b1);
    const bulge = Math.min(0.08, 0.01 + dist * 0.08);
    const p1 = a1.clone().lerp(b1, 0.3).addScaledVector(A.n, bulge);
    const p2 = a1.clone().lerp(b1, 0.7).addScaledVector(A.n, bulge);
    const sag = Math.min(0.03, dist * 0.05);
    p1.y -= sag;
    p2.y -= sag;
    pts = dist < 0.05 ? [a0, a1, b1, b0] : [a0, a1, p1, p2, b1, b0];
  } else {
    const front = A.face === 'front' ? a1 : b1;
    const sideX = front.x < 0 ? -0.292 : 0.292;
    const f = A.face === 'front';
    const [F1, F0, R1, R0] = f ? [a1, a0, b1, b0] : [b1, b0, a1, a0];
    const path = [F0, F1, new THREE.Vector3(sideX * 0.9, F1.y, F1.z + 0.01), new THREE.Vector3(sideX, (F1.y + R1.y) / 2, (F1.z + R1.z) / 2), new THREE.Vector3(sideX * 0.9, R1.y, R1.z - 0.01), R1, R0];
    pts = f ? path : path.reverse();
  }
  // keep intermediate points inside the rack doors
  for (let i = 2; i < pts.length - 2; i++) {
    const p = pts[i];
    if (Math.abs(p.x) < 0.4 && p.y < RACK.height + 0.02) p.z = THREE.MathUtils.clamp(p.z, -0.535, 0.535);
  }
  return pts;
}

function buildGeo(c: Cable) {
  const A = endOf(c.a), B = endOf(c.b);
  const pts = routePoints(A, B);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const len = curve.getLength();
  return { geo: new THREE.TubeGeometry(curve, Math.min(160, Math.max(24, Math.round(len * 50))), CABLE_INFO[c.type].radius, 7, false), A, B };
}

const Plug = ({ end, kind, color }: { end: End; kind: PortKind; color: string }) => {
  const s = PLUG[kind] ?? [0.01, 0.01, 0.02];
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), end.n), [end.n]);
  const pos = end.pos.clone().addScaledVector(end.n, s[2] / 2);
  return (
    <mesh geometry={BOX} position={pos} quaternion={q} scale={s}>
      <meshStandardMaterial color={color} roughness={0.55} metalness={kind === 'sfp' || kind === 'stack' ? 0.6 : 0.1} />
    </mesh>
  );
};

const CableMesh = memo(function CableMesh({ c }: { c: Cable }) {
  const mesh = useRef<THREE.Mesh>(null);
  const extKey = () => `${c.a}|${c.b}|${(anim.ext[PORTS[c.a].deviceId] ?? 0).toFixed(3)}|${(anim.ext[PORTS[c.b].deviceId] ?? 0).toFixed(3)}`;
  const key = useRef<string | null>(null);
  const selected = useUI((s) => (s.selected?.kind === 'cable' && s.selected.id === c.id) || (s.selected?.kind === 'port' && (s.selected.id === c.a || s.selected.id === c.b)));
  const [built, setBuilt] = useState(() => buildGeo(c));
  // Rebuild when an end moves (a chassis sliding on its rails, or a cable end
  // re-homed to another port) — checked per frame since extension animates.
  useFrame(() => {
    const k = extKey();
    if (key.current === null) key.current = k;
    else if (k !== key.current) {
      key.current = k;
      setBuilt(buildGeo(c));
    }
  });
  useEffect(() => () => built.geo.dispose(), [built]);
  const plugColor = c.type === 'cat6' ? c.color : PLUG_COLOR[c.type] ?? '#222';
  return (
    <group>
      <mesh
        ref={mesh}
        geometry={built.geo}
        onClick={(e) => { e.stopPropagation(); if (isClick(e)) useUI.getState().select({ kind: 'cable', id: c.id }); }}
        onPointerOver={(e) => {
          e.stopPropagation();
          const l = useDerived.getState().d.links[c.a];
          useUI.getState().setHover({ title: CABLE_INFO[c.type].name, lines: [`${c.a}  ↔  ${c.b}`, l.up ? `● ${l.kind === 'power' ? 'Energized' : 'Link up ' + (l.speed ?? '')}` : `○ ${l.reason}`], tone: l.up ? 'ok' : 'bad' });
        }}
        onPointerOut={() => useUI.getState().setHover(null)}
      >
        <meshStandardMaterial color={c.color} roughness={c.type.startsWith('pwr') ? 0.7 : 0.45} emissive={selected ? '#38bdf8' : '#000'} emissiveIntensity={selected ? 0.9 : 0} transparent={c.type === 'om4'} opacity={c.type === 'om4' ? 0.92 : 1} />
      </mesh>
      <Plug end={built.A} kind={PORTS[c.a].kind} color={plugColor} />
      <Plug end={built.B} kind={PORTS[c.b].kind} color={plugColor} />
    </group>
  );
});

export function Cables() {
  const cables = useSim((s) => s.cables);
  return <>{Object.values(cables).map((c) => <CableMesh key={c.id} c={c} />)}</>;
}

/** live preview while a new cable is being routed */
export function PendingCable() {
  const mesh = useRef<THREE.Mesh>(null);
  const pending = useUI((s) => s.pending);
  const dragging = useUI((s) => s.dragging);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const origin = dragOrigin() ?? pending?.from;
    if (!origin || !anim.pointer) { m.visible = false; return; }
    const A = endOf(origin);
    const a0 = A.pos.clone().addScaledVector(A.n, A.plug);
    const a1 = a0.clone().addScaledVector(A.n, 0.05);
    const p = new THREE.Vector3(...anim.pointer);
    const mid = a1.clone().lerp(p, 0.5);
    mid.y -= 0.02;
    const old = m.geometry;
    m.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a0, a1, mid, p]), 24, 0.0025, 6, false);
    old.dispose();
    m.visible = true;
  });
  if (!pending && !dragging) return null;
  return (
    <mesh ref={mesh} raycast={() => null}>
      <boxGeometry args={[0.001, 0.001, 0.001]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} depthTest={false} />
    </mesh>
  );
}
