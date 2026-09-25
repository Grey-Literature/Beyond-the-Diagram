import { memo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type * as THREE from 'three';
import type { CompDef, DeviceDef } from '../../../sim/types';
import { useDerived, useSim, useUI } from '../store';
import { BOX, CYL, MAT, ventTexture } from './labels';
import { isClick } from './interact';

function compHover(def: DeviceDef, c: CompDef) {
  const st = useSim.getState().devices[def.id].comps[c.id];
  const state = !st.installed ? 'EMPTY – spare available' : st.failed ? 'FAULT' : 'OK';
  const access = c.access === 'internal' ? `Internal${c.needsShroudOff ? ', under air shroud' : ''}` : `${c.access === 'front' ? 'Front' : 'Rear'} access`;
  return { title: `${def.id} · ${c.label}`, lines: [c.part, `Status: ${state}`, `${access} · ${c.hotSwap ? 'hot-swap' : 'cold-swap (power off)'}`], tone: (st.failed ? 'bad' : 'info') as 'bad' | 'info' };
}

export const Comp3D = memo(function Comp3D({ def, c }: { def: DeviceDef; c: CompDef }) {
  const st = useSim((s) => s.devices[def.id].comps[c.id]);
  const running = useDerived((s) => s.d.devRunning[def.id]);
  const powered = useDerived((s) => s.d.devPowered[def.id]);
  const psuLive = useDerived((s) => (c.kind === 'psu' ? !!s.d.inletLive[`${def.id}:${c.id.toUpperCase()}`] : false));
  const selected = useUI((s) => s.selected?.kind === 'comp' && s.selected.dev === def.id && s.selected.id === c.id);
  const [sx, sy, sz] = c.size;
  const events = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); useUI.getState().setHover(compHover(def, c)); },
    onPointerOut: () => useUI.getState().setHover(null),
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (isClick(e)) useUI.getState().select({ kind: 'comp', dev: def.id, id: c.id }); },
  };
  const sel = selected ? <meshBasicMaterial color="#38bdf8" wireframe /> : null;
  const outline = selected ? <mesh geometry={BOX} scale={[sx * 1.04, sy * 1.04, sz * 1.02]}>{sel}</mesh> : null;
  const ok = st.installed && !st.failed;

  let body: React.ReactNode = null;
  switch (c.kind) {
    case 'drive': {
      const vertical = sy > sx;
      if (!st.installed) {
        body = <mesh geometry={BOX} scale={[sx * 0.96, sy * 0.94, 0.012]} position-z={sz / 2 - 0.006}><meshStandardMaterial color="#15171a" map={ventTexture()} roughness={0.8} /></mesh>;
      } else {
        const act = running && ok;
        body = (
          <group>
            <mesh geometry={BOX} scale={[sx * 0.96, sy * 0.94, sz]} material={MAT.chassis} />
            <mesh geometry={BOX} scale={[sx * 0.96, sy * 0.94, 0.004]} position-z={sz / 2 + 0.001}><meshStandardMaterial color="#3d434c" metalness={0.4} roughness={0.5} /></mesh>
            <mesh geometry={BOX} scale={vertical ? [sx * 0.7, sy * 0.25, 0.005] : [sx * 0.25, sy * 0.6, 0.005]} position={vertical ? [0, -sy * 0.25, sz / 2 + 0.002] : [-sx * 0.3, 0, sz / 2 + 0.002]} material={MAT.terracotta} />
            <mesh geometry={BOX} scale={[0.0025, 0.0018, 0.001]} position={vertical ? [-0.003, sy * 0.4, sz / 2 + 0.0035] : [sx * 0.4, 0.005, sz / 2 + 0.0035]} material={act ? MAT.ledGreen : MAT.ledOff} />
            <mesh geometry={BOX} scale={[0.0025, 0.0018, 0.001]} position={vertical ? [0.003, sy * 0.4, sz / 2 + 0.0035] : [sx * 0.4, -0.005, sz / 2 + 0.0035]} material={st.failed && powered ? MAT.ledAmber : MAT.ledOff} />
          </group>
        );
      }
      break;
    }
    case 'dimm':
      body = (
        <group>
          <mesh geometry={BOX} scale={[sx + 0.002, 0.006, sz + 0.006]} position-y={-sy / 2 + 0.003} material={MAT.black} />
          <mesh geometry={BOX} scale={[sx + 0.003, 0.009, 0.004]} position={[0, -sy / 2 + 0.005, sz / 2 + 0.004]} material={MAT.touch} />
          <mesh geometry={BOX} scale={[sx + 0.003, 0.009, 0.004]} position={[0, -sy / 2 + 0.005, -sz / 2 - 0.004]} material={MAT.touch} />
          <mesh geometry={BOX} scale={[0.002, 0.002, 0.003]} position={[0, -sy / 2 + 0.001, sz / 2 + 0.009]} material={st.failed && powered ? MAT.ledAmber : MAT.ledOff} />
          {st.installed && (
            <>
              <mesh geometry={BOX} scale={[0.0013, sy, sz]} position-y={0.003} material={MAT.pcb} />
              <mesh geometry={BOX} scale={[0.0042, sy * 0.4, sz * 0.86]} position-y={sy * 0.08} material={MAT.chip} />
              <mesh geometry={BOX} scale={[0.0016, 0.003, sz * 0.96]} position-y={-sy / 2 + 0.006} material={MAT.gold} />
            </>
          )}
        </group>
      );
      break;
    case 'cpu': {
      const fins = [];
      const n = 16;
      for (let i = 0; i < n; i++) fins.push(<mesh key={i} geometry={BOX} scale={[0.0009, sy - 0.009, sz * 0.98]} position={[-sx / 2 + (i + 0.5) * (sx / n), 0.004, 0]} material={MAT.alu} />);
      body = (
        <group>
          <mesh geometry={BOX} scale={[0.064, 0.005, 0.078]} position-y={-sy / 2 + 0.0025} material={MAT.black} />
          <mesh geometry={BOX} scale={[0.05, 0.0055, 0.056]} position-y={-sy / 2 + 0.003} material={MAT.gold} />
          {st.installed && (
            <>
              <mesh geometry={BOX} scale={[sx, 0.007, sz]} position-y={-sy / 2 + 0.008} material={MAT.steel} />
              {fins}
              {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => (
                <mesh key={i} geometry={CYL} scale={[0.003, 0.012, 0.003]} position={[a * (sx / 2 - 0.004), sy / 2 - 0.004, b * (sz / 2 - 0.004)]} material={MAT.touch} />
              ))}
            </>
          )}
        </group>
      );
      break;
    }
    case 'fan':
      body = st.installed ? <Fan sx={sx} sy={sy} sz={sz} spin={running && ok} failed={st.failed && powered} /> : <mesh geometry={BOX} scale={[sx, 0.004, sz]} position-y={-sy / 2 + 0.002} material={MAT.black} />;
      break;
    case 'psu':
      body = st.installed ? (
        <group>
          <mesh geometry={BOX} scale={[sx * 0.98, sy * 0.96, sz]}><meshStandardMaterial color="#7d848d" metalness={0.6} roughness={0.45} /></mesh>
          <mesh position-z={-sz / 2 - 0.0008} rotation-y={Math.PI}>
            <planeGeometry args={[sx * 0.45, sy * 0.8]} />
            <meshStandardMaterial map={ventTexture()} roughness={0.8} />
          </mesh>
          <mesh geometry={BOX} scale={[0.005, sy * 0.7, 0.012]} position={[-sx * 0.42, 0, -sz / 2 - 0.006]} material={MAT.terracotta} />
          <mesh geometry={BOX} scale={[0.003, 0.003, 0.001]} position={[sx * 0.1, sy * 0.3, -sz / 2 - 0.001]} material={st.failed ? MAT.ledAmber : psuLive ? MAT.ledGreen : MAT.ledOff} />
        </group>
      ) : (
        <mesh geometry={BOX} scale={[sx, sy, sz * 0.2]} position-z={-sz * 0.35} material={MAT.hole} />
      );
      break;
    case 'nic':
    case 'hba':
    case 'raid':
    case 'lom': {
      if (def.type === 'ups') {
        body = st.installed ? <mesh geometry={BOX} scale={[sx, 0.028, 0.002]} position-z={-def.depth / 2 - c.pos[2] - 0.001} material={MAT.chassisLight} /> : <mesh geometry={BOX} scale={[sx, 0.028, 0.002]} position-z={-def.depth / 2 - c.pos[2] - 0.001} material={MAT.hole} />;
        break;
      }
      const pcb = c.kind === 'hba' ? MAT.pcbBlue : MAT.pcb;
      const myPorts = def.ports.filter((p) => p.comp === c.id);
      body = st.installed ? (
        <group>
          <mesh geometry={BOX} scale={[sx, 0.0016, sz]} position-y={-0.004} material={pcb} />
          <mesh geometry={BOX} scale={[0.022, 0.007, 0.022]} position={[0, 0.0005, 0.01]} material={MAT.alu} />
          {c.kind === 'raid' && (
            <>
              <mesh geometry={BOX} scale={[0.03, 0.005, 0.012]} position={[0.02, -0.001, -0.04]} material={MAT.chip} />
              <mesh geometry={BOX} scale={[0.012, 0.006, 0.008]} position={[-0.03, -0.001, sz / 2 - 0.01]} material={MAT.black} />
              <mesh geometry={BOX} scale={[0.012, 0.006, 0.008]} position={[-0.012, -0.001, sz / 2 - 0.01]} material={MAT.black} />
            </>
          )}
          {myPorts.map((p) => (
            <mesh key={p.id} geometry={BOX} scale={[p.kind === 'rj45' ? 0.0135 : 0.0148, 0.011, 0.04]} position={[p.x - c.pos[0], p.y - c.pos[1], -sz / 2 + 0.02]} material={p.kind === 'rj45' ? MAT.black : MAT.steel} />
          ))}
          {c.kind !== 'lom' && <mesh geometry={BOX} scale={[sx, 0.017, 0.0012]} position={[0, 0.002, -sz / 2 - 0.0006]} material={MAT.zinc} />}
        </group>
      ) : (
        <mesh geometry={BOX} scale={[0.006, 0.008, 0.07]} position={[sx / 2 - 0.004, -0.006, 0]} material={MAT.black} />
      );
      break;
    }
    case 'controller':
      body = st.installed ? (
        <group>
          <mesh geometry={BOX} scale={[sx * 0.98, sy * 0.95, sz]}><meshStandardMaterial color="#353a42" metalness={0.5} roughness={0.5} /></mesh>
          <mesh geometry={BOX} scale={[sx * 0.98, sy * 0.95, 0.003]} position-z={-sz / 2 - 0.0015}><meshStandardMaterial color="#2a2e34" metalness={0.4} roughness={0.5} /></mesh>
          <mesh geometry={BOX} scale={[0.03, 0.008, 0.012]} position={[sx * 0.38, -sy * 0.2, -sz / 2 - 0.006]} material={MAT.terracotta} />
          <mesh geometry={BOX} scale={[0.003, 0.003, 0.001]} position={[sx * 0.2, sy * 0.25, -sz / 2 - 0.0035]} material={ok && running ? MAT.ledGreen : MAT.ledOff} />
          <mesh geometry={BOX} scale={[0.003, 0.003, 0.001]} position={[sx * 0.24, sy * 0.25, -sz / 2 - 0.0035]} material={st.failed && powered ? MAT.ledAmber : MAT.ledOff} />
        </group>
      ) : (
        <mesh geometry={BOX} scale={[sx, sy, 0.02]} position-z={-sz / 2 + 0.03} material={MAT.hole} />
      );
      break;
    case 'battery': {
      const z = def.depth / 2 - c.pos[2] + 0.0015;
      body = st.installed ? (
        <group position={[0.11 - c.pos[0], 0, z]}>
          <mesh geometry={BOX} scale={[0.18, 0.075, 0.003]} material={MAT.black} />
          <mesh geometry={BOX} scale={[0.06, 0.008, 0.008]} position={[0, -0.02, 0.004]} material={MAT.terracotta} />
          <mesh geometry={BOX} scale={[0.003, 0.003, 0.001]} position={[0.07, 0.025, 0.002]} material={st.failed ? MAT.ledAmber : MAT.ledOff} />
        </group>
      ) : (
        <mesh geometry={BOX} scale={[0.18, 0.075, 0.003]} position={[0.11 - c.pos[0], 0, z - 0.002]} material={MAT.hole} />
      );
      break;
    }
  }
  return (
    <group position={c.pos} rotation-y={c.rot ?? 0} {...events}>
      {body}
      {outline}
    </group>
  );
});

function Fan({ sx, sy, sz, spin, failed }: { sx: number; sy: number; sz: number; spin: boolean; failed: boolean }) {
  const rotor = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (rotor.current && spin) rotor.current.rotation.z += dt * 30; });
  const r = Math.min(sx, sy) * 0.45;
  return (
    <group>
      {/* housing: four walls */}
      <mesh geometry={BOX} scale={[sx, 0.003, sz]} position-y={sy / 2 - 0.0015} material={MAT.plastic} />
      <mesh geometry={BOX} scale={[sx, 0.003, sz]} position-y={-sy / 2 + 0.0015} material={MAT.plastic} />
      <mesh geometry={BOX} scale={[0.003, sy, sz]} position-x={sx / 2 - 0.0015} material={MAT.plastic} />
      <mesh geometry={BOX} scale={[0.003, sy, sz]} position-x={-sx / 2 + 0.0015} material={MAT.plastic} />
      <group ref={rotor}>
        <mesh geometry={CYL} rotation-x={Math.PI / 2} scale={[r * 0.35, sz * 0.8, r * 0.35]} material={MAT.plastic} />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <mesh key={i} geometry={BOX} rotation={[0.35, 0, (i / 7) * Math.PI * 2]} position={[Math.cos((i / 7) * Math.PI * 2) * r * 0.6, Math.sin((i / 7) * Math.PI * 2) * r * 0.6, 0]} scale={[r * 0.75, r * 0.32, 0.002]} material={MAT.plastic} />
        ))}
      </group>
      <mesh geometry={BOX} scale={[sx * 0.4, 0.004, 0.012]} position={[0, sy / 2 + 0.002, 0]} material={MAT.terracotta} />
      <mesh geometry={BOX} scale={[0.003, 0.002, 0.003]} position={[sx * 0.35, sy / 2 + 0.001, 0]} material={failed ? MAT.ledAmber : MAT.ledOff} />
    </group>
  );
}
