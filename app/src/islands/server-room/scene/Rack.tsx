import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { PDU_LEN, RACK, U } from '../../../sim/catalog';
import { act, useSim, useUI } from '../store';
import { BOX, MAT, faceTexture, gridTexture, perfTexture, type TextItem } from './labels';
import { isClick } from './interact';

const W = RACK.width, D = RACK.depth, HT = RACK.height;
const railH = RACK.units * U;

function B({ s, p, m, ...rest }: { s: [number, number, number]; p: [number, number, number]; m?: THREE.Material } & Record<string, unknown>) {
  return <mesh geometry={BOX} scale={s} position={p} material={m} {...rest} />;
}

const frameMat = new THREE.MeshStandardMaterial({ color: '#23262b', metalness: 0.55, roughness: 0.5 });
const panelMat = new THREE.MeshStandardMaterial({ color: '#2a2d33', metalness: 0.45, roughness: 0.55, side: THREE.DoubleSide });

function railTexture() {
  const cv = document.createElement('canvas');
  cv.width = 32;
  cv.height = 96;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#b9bec5';
  g.fillRect(0, 0, 32, 96);
  g.fillStyle = '#0c0d0f';
  [16, 48, 80].forEach((y) => g.fillRect(10, y - 6, 12, 12));
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, RACK.units);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Door({ side }: { side: 'front' | 'rear' }) {
  const open = useSim((s) => (side === 'front' ? s.rack.frontDoorOpen : s.rack.rearDoorOpen));
  const pivot = useRef<THREE.Group>(null);
  const tex = useMemo(() => { const t = perfTexture().clone(); t.needsUpdate = true; t.repeat.set(15, 36); return t; }, []);
  useFrame((_, dt) => {
    if (!pivot.current) return;
    const target = open ? -1.95 : 0;
    pivot.current.rotation.y = THREE.MathUtils.damp(pivot.current.rotation.y, target, 5, dt);
  });
  const h = HT - 0.16;
  const dw = W - 0.01;
  const sgn = side === 'front' ? 1 : -1; // door extends +x from pivot (front) or -x (rear)
  const onClick = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (isClick(e)) act(useSim.getState().toggleRack(side === 'front' ? 'frontDoorOpen' : 'rearDoorOpen')); };
  return (
    <group ref={pivot} position={[side === 'front' ? -W / 2 : W / 2, 0.11, side === 'front' ? D / 2 + 0.008 : -D / 2 - 0.008]}>
      <group
        position={[sgn * dw / 2, h / 2, 0]}
        onClick={onClick}
        onPointerOver={(e) => { e.stopPropagation(); useUI.getState().setHover({ title: `${side === 'front' ? 'Front' : 'Rear'} door (perforated)`, lines: [open ? 'Open – click to close' : 'Closed – click to open'] }); }}
        onPointerOut={() => useUI.getState().setHover(null)}
      >
        <mesh>
          <planeGeometry args={[dw - 0.06, h - 0.06]} />
          <meshStandardMaterial color="#2b2e33" metalness={0.5} roughness={0.5} alphaMap={tex} alphaTest={0.5} transparent side={THREE.DoubleSide} />
        </mesh>
        <B s={[dw, 0.03, 0.014]} p={[0, h / 2 - 0.015, 0]} m={frameMat} />
        <B s={[dw, 0.03, 0.014]} p={[0, -h / 2 + 0.015, 0]} m={frameMat} />
        <B s={[0.03, h, 0.014]} p={[-dw / 2 + 0.015, 0, 0]} m={frameMat} />
        <B s={[0.03, h, 0.014]} p={[dw / 2 - 0.015, 0, 0]} m={frameMat} />
        <B s={[0.018, 0.16, 0.02]} p={[sgn * (dw / 2 - 0.03), 0.05, sgn * 0.012]} m={MAT.steel} />
      </group>
    </group>
  );
}

function SidePanel({ side }: { side: 'left' | 'right' }) {
  const off = useSim((s) => (side === 'left' ? s.rack.leftPanelOff : s.rack.rightPanelOff));
  const g = useRef<THREE.Group>(null);
  const t = useRef(off ? 1 : 0);
  useFrame((_, dt) => {
    t.current = THREE.MathUtils.damp(t.current, off ? 1 : 0, 5, dt);
    if (g.current) {
      const s = side === 'left' ? -1 : 1;
      g.current.position.set(s * (W / 2 + 0.006 + t.current * 0.35), 0, 0);
      g.current.visible = t.current < 0.97;
    }
  });
  return (
    <group ref={g}>
      <mesh
        position={[0, 0.1 + (HT - 0.12) / 2, 0]}
        material={panelMat}
        onClick={(e) => { e.stopPropagation(); if (isClick(e)) act(useSim.getState().toggleRack(side === 'left' ? 'leftPanelOff' : 'rightPanelOff')); }}
        onPointerOver={(e) => { e.stopPropagation(); useUI.getState().setHover({ title: `${side} side panel`, lines: ['Click to lift off'] }); }}
        onPointerOut={() => useUI.getState().setHover(null)}
      >
        <boxGeometry args={[0.008, HT - 0.14, D - 0.06]} />
      </mesh>
    </group>
  );
}

export function Rack() {
  const rt = useMemo(() => railTexture(), []);
  const uItems = useMemo<TextItem[]>(() => Array.from({ length: RACK.units }, (_, i) => ({ text: String(i + 1), x: 0, y: (i + 0.5) * U, size: 0.0065, color: '#e5e7eb', bold: true })), []);
  const uTex = useMemo(() => faceTexture('urail', 0.014, railH, uItems, 1000), [uItems]);
  const labelTex = useMemo(() => faceTexture('racklbl', 0.16, 0.03, [{ text: 'RACK A1 · SERVER / NETWORK', x: 0, y: 0.015, size: 0.011, color: '#111', bold: true, bg: '#f2f1ea' }], 2400), []);
  const railZ = [RACK.frontRailZ, RACK.rearRailZ];
  return (
    <group>
      {/* plinth + levelling feet */}
      <B s={[W, 0.09, D]} p={[0, 0.055, 0]} m={frameMat} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => <mesh key={i} position={[x * (W / 2 - 0.05), 0.005, z * (D / 2 - 0.05)]} material={MAT.black}><cylinderGeometry args={[0.025, 0.03, 0.01, 16]} /></mesh>)}
      {/* corner posts & top frame */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => <B key={i} s={[0.035, HT - 0.1, 0.035]} p={[x * (W / 2 - 0.0175), 0.1 + (HT - 0.1) / 2, z * (D / 2 - 0.0175)]} m={frameMat} />)}
      <B s={[W - 0.12, 0.02, D]} p={[0.06, HT - 0.01, 0]} m={frameMat} />
      <B s={[0.12, 0.012, D - 0.1]} p={[-W / 2 + 0.06, HT - 0.006, 0]}><meshStandardMaterial color="#0d0e10" roughness={1} /></B>
      {[-1, 1].map((z) => <B key={z} s={[W, 0.035, 0.035]} p={[0, 0.1, z * (D / 2 - 0.0175)]} m={frameMat} />)}
      {[-1, 1].map((x) => <B key={x} s={[0.035, 0.035, D]} p={[x * (W / 2 - 0.0175), 0.1, 0]} m={frameMat} />)}
      {/* 19" mounting rails */}
      {railZ.map((z) => [-1, 1].map((x) => (
        <group key={`${z}${x}`}>
          <mesh position={[x * (RACK.railX + 0.004), RACK.baseY + railH / 2, z + 0.0016]}>
            <planeGeometry args={[0.016, railH]} />
            <meshStandardMaterial map={rt} metalness={0.6} roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
          <B s={[0.003, railH, 0.045]} p={[x * (RACK.railX + 0.013), RACK.baseY + railH / 2, z - 0.02]} m={MAT.zinc} />
          <B s={[0.03, railH, 0.003]} p={[x * (RACK.railX + 0.028), RACK.baseY + railH / 2, z - 0.04]} m={MAT.zinc} />
        </group>
      )))}
      {/* U numbering printed on the front-left rail flange */}
      <mesh position={[-(RACK.railX + 0.02), RACK.baseY + railH / 2, RACK.frontRailZ + 0.0025]} renderOrder={1}>
        <planeGeometry args={[0.014, railH]} />
        <meshBasicMaterial map={uTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[RACK.railX + 0.02, RACK.baseY + railH / 2, RACK.rearRailZ - 0.0025]} rotation-y={Math.PI} renderOrder={1}>
        <planeGeometry args={[0.014, railH]} />
        <meshBasicMaterial map={uTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* front vertical finger managers */}
      {[-1, 1].map((x) => (
        <group key={x}>
          <B s={[0.07, railH, 0.003]} p={[x * 0.318, RACK.baseY + railH / 2, 0.43]} m={MAT.black} />
          {Array.from({ length: Math.floor(RACK.units / 2) }, (_, i) => <B key={i} s={[0.07, 0.008, 0.06]} p={[x * 0.318, RACK.baseY + (i * 2 + 1) * U, 0.46]} m={MAT.plastic} />)}
        </group>
      ))}
      {/* rear PDU mounting brackets */}
      {[-1, 1].map((x) => <B key={x} s={[0.02, 0.03, 0.08]} p={[x * 0.33, 0.2 + PDU_LEN - 0.1, -0.47]} m={frameMat} />)}
      <Door side="front" />
      <Door side="rear" />
      <SidePanel side="left" />
      <SidePanel side="right" />
      {/* rack label */}
      <mesh position={[0.2, HT - 0.035, D / 2 + 0.02]}>
        <planeGeometry args={[0.16, 0.03]} />
        <meshBasicMaterial map={labelTex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
function Tray({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const mid = a.clone().lerp(b, 0.5);
  const ang = Math.atan2(b.x - a.x, b.z - a.z);
  const rungs = Math.floor(len / 0.25);
  return (
    <group position={mid} rotation-y={ang}>
      {[-0.15, 0.15].map((x) => <B key={x} s={[0.006, 0.05, len]} p={[x, 0, 0]} m={MAT.zinc} />)}
      {Array.from({ length: rungs }, (_, i) => <B key={i} s={[0.3, 0.008, 0.02]} p={[0, -0.02, -len / 2 + (i + 0.5) * (len / rungs)]} m={MAT.zinc} />)}
      {[-len / 2 + 0.1, len / 2 - 0.1].map((z) => [-0.14, 0.14].map((x) => <B key={`${z}${x}`} s={[0.008, 0.6, 0.008]} p={[x, 0.3, z]} m={MAT.zinc} />))}
    </group>
  );
}

export function Room() {
  const floor = useMemo(() => { const t = gridTexture('#b9bcc0', '#9fa3a8', 256, 3).clone(); t.needsUpdate = true; t.repeat.set(9, 10); return t; }, []);
  const wall = new THREE.MeshStandardMaterial({ color: '#d9dcdf', roughness: 0.9 });
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0.4]} receiveShadow>
        <planeGeometry args={[4.5, 5]} />
        <meshStandardMaterial map={floor} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.45, -2.1]} material={wall}><planeGeometry args={[4.5, 2.9]} /></mesh>
      <mesh position={[-2.25, 1.45, 0.4]} rotation-y={Math.PI / 2} material={wall}><planeGeometry args={[5, 2.9]} /></mesh>
      <mesh position={[2.25, 1.45, 0.4]} rotation-y={-Math.PI / 2} material={wall}><planeGeometry args={[5, 2.9]} /></mesh>
      <mesh position={[0, 1.45, 2.9]} rotation-y={Math.PI} material={wall}><planeGeometry args={[4.5, 2.9]} /></mesh>
      <mesh position={[0, 2.9, 0.4]} rotation-x={Math.PI / 2}><planeGeometry args={[4.5, 5]} /><meshStandardMaterial color="#eceef0" roughness={1} /></mesh>
      {[[-0.9, -0.9], [0.9, -0.9], [-0.9, 1.2], [0.9, 1.2]].map(([x, z], i) => (
        <mesh key={i} position={[x, 2.895, z]} rotation-x={Math.PI / 2}><planeGeometry args={[0.6, 1.2]} /><meshBasicMaterial color="#fbfdff" /></mesh>
      ))}
      {/* skirting / wall base */}
      <mesh position={[0, 0.05, -2.095]}><planeGeometry args={[4.5, 0.1]} /><meshStandardMaterial color="#5a5f66" /></mesh>
      {/* overhead ladder trays: office cabling and carrier entrance */}
      <Tray from={[-2.2, 2.34, 0.27]} to={[2.2, 2.34, 0.27]} />
      <Tray from={[-2.2, 2.34, -1.0]} to={[-0.3, 2.34, -1.0]} />
      <Tray from={[-0.3, 2.34, -1.0]} to={[-0.3, 2.34, -0.2]} />
      {/* ESD mat at the front of the rack */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 1.05]}><planeGeometry args={[0.9, 0.6]} /><meshStandardMaterial color="#2f5f8f" roughness={0.9} /></mesh>
    </group>
  );
}
