// Camera presets and fly-to helpers. Kept out of Scene.tsx so that file
// only exports components (fast refresh), and so UI panels can import them
// without pulling in the Canvas.
import * as THREE from 'three';
import { DEV, EXTEND_DIST, PORTS, deviceHeight, devicePose, portWorld } from '../../../sim/catalog';
import { anim, useSim, useUI } from '../store';

export type V3 = [number, number, number];
export const PRESETS: Record<string, { label: string; pos: V3; target: V3 }> = {
  front: { label: 'Front', pos: [0.4, 1.05, 2.2], target: [0, 0.62, 0.1] },
  rear: { label: 'Rear', pos: [-0.3, 1.05, -1.95], target: [0, 0.62, -0.2] },
  network: { label: 'Network (front)', pos: [0.12, 1.25, 1.0], target: [0, 1.0, 0.45] },
  netRear: { label: 'Network (rear)', pos: [-0.1, 1.3, -1.1], target: [0, 1.0, -0.3] },
  shelf: { label: 'Shelf (front)', pos: [0.1, 0.78, 0.95], target: [0, 0.6, 0.35] },
  servers: { label: 'Servers (front)', pos: [0.2, 0.62, 1.15], target: [0, 0.4, 0.45] },
  srvRear: { label: 'Servers (rear)', pos: [-0.1, 0.66, -1.2], target: [0, 0.4, -0.35] },
  power: { label: 'Power / UPS (rear)', pos: [0.4, 0.45, -1.3], target: [0, 0.25, -0.4] },
  demarc: { label: 'Demarc wall', pos: [-1.1, 1.45, -1.0], target: [-2.15, 1.25, -1.0] },
};

export function focusDevice(dev: string, face?: 'front' | 'rear' | 'top') {
  const def = DEV[dev];
  const st = useSim.getState().devices[dev];
  const pose = devicePose(def);
  const ui = useUI.getState();
  if (def.type === 'wallpanel') return ui.flyTo(PRESETS.demarc.pos, PRESETS.demarc.target);
  if (def.type === 'pdu') { const x = pose.pos[0]; return ui.flyTo([x * 0.3, 1.1, -1.35], [x, 0.95, -0.5]); }
  const H = deviceHeight(def);
  const yc = pose.pos[1] + H / 2;
  const ext = st.extended ? EXTEND_DIST : 0;
  const f = face ?? (st.lidOff && st.extended ? 'top' : 'front');
  if (f === 'top') { const zc = pose.pos[2] + ext; return ui.flyTo([0.05, yc + 0.55, zc + 0.42], [0, yc, zc]); }
  // +1 looks at the rack's front, -1 at its rear.
  const dir = (f === 'rear' ? -1 : 1) * (def.facing === 'rear' ? -1 : 1);
  const z = pose.pos[2] + dir * def.depth / 2 + ext;
  ui.flyTo([0.1 * dir, yc + 0.1, z + dir * 0.62], [0, yc, z]);
}

export function focusPort(pid: string) {
  const p = PORTS[pid];
  const d = DEV[p.deviceId];
  const w = portWorld(p, d.serviceable ? anim.ext[d.id] ?? 0 : 0);
  const t = new THREE.Vector3(...w.pos);
  const n = new THREE.Vector3(...w.n);
  const pos = t.clone().addScaledVector(n, 0.28).add(new THREE.Vector3(0, 0.06, 0));
  useUI.getState().flyTo(pos.toArray() as V3, t.toArray() as V3);
}

