import { memo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { DEV, compatibleTypes, PORTS } from '../../../sim/catalog';
import type { PortDef, PortKind } from '../../../sim/types';
import { useDerived, useSim, useUI } from '../store';
import { BOX, CYL, MAT } from './labels';
import { portDown, portHover, portUp } from './interact';

const PORT_SIZE: Record<PortKind, [number, number]> = {
  rj45: [0.0118, 0.0104], keystone: [0.0118, 0.0112], console: [0.0118, 0.0104], sfp: [0.0142, 0.0096],
  stack: [0.019, 0.009], sc: [0.0095, 0.0115], nema515r: [0.02, 0.018], dc: [0.007, 0.007], c13: [0.022, 0.016], c14: [0.026, 0.02], c19: [0.03, 0.022],
  c20: [0.03, 0.024], l530r: [0.046, 0.046], l530p: [0.046, 0.046], ebm: [0.032, 0.02],
};

function Shape({ kind, hl }: { kind: PortKind; hl: string | null }) {
  const [w, h] = PORT_SIZE[kind];
  const frame = kind === 'console' ? MAT.blue : ['sfp', 'stack'].includes(kind) ? MAT.steel : kind === 'sc' ? null : MAT.zinc;
  const hlMat = hl ? <meshBasicMaterial color={hl} /> : null;
  switch (kind) {
    case 'l530r':
    case 'l530p':
      return (
        <group>
          <mesh geometry={CYL} rotation-x={Math.PI / 2} scale={[w / 2, 0.012, w / 2]} position-z={0.006}>{hlMat ?? <meshStandardMaterial color={kind === 'l530r' ? '#e8e4da' : '#1a1a1a'} roughness={0.6} />}</mesh>
          <mesh geometry={CYL} rotation-x={Math.PI / 2} scale={[w / 2.8, 0.013, w / 2.8]} position-z={0.0065} material={MAT.hole} />
        </group>
      );
    case 'c13':
    case 'c19':
      return (
        <group>
          <mesh geometry={BOX} scale={[w, h, 0.004]} position-z={0.002}>{hlMat ?? <meshStandardMaterial color="#17181b" roughness={0.7} />}</mesh>
          <mesh geometry={BOX} scale={[w * 0.62, h * 0.5, 0.0045]} position-z={0.002} material={MAT.hole} />
        </group>
      );
    case 'c14':
    case 'c20':
      return (
        <group>
          <mesh geometry={BOX} scale={[w, h, 0.003]} position-z={0.0015}>{hlMat ?? <meshStandardMaterial color="#1c1d20" roughness={0.6} />}</mesh>
          <mesh geometry={BOX} scale={[w * 0.7, h * 0.62, 0.0035]} position-z={0.0015} material={MAT.hole} />
          {[-0.3, 0, 0.3].map((x, i) => (
            <mesh key={i} geometry={BOX} scale={[0.0015, 0.004, 0.0038]} position={[x * w * 0.6, i === 1 ? h * 0.12 : -h * 0.08, 0.0015]} material={MAT.alu} />
          ))}
        </group>
      );
    case 'nema515r':
      return (
        <group>
          <mesh geometry={BOX} scale={[w, h, 0.003]} position-z={0.0015}>{hlMat ?? <meshStandardMaterial color="#e8e6df" roughness={0.6} />}</mesh>
          <mesh geometry={BOX} scale={[0.0018, 0.006, 0.0035]} position={[-0.0035, 0.002, 0.0015]} material={MAT.hole} />
          <mesh geometry={BOX} scale={[0.0018, 0.006, 0.0035]} position={[0.0035, 0.002, 0.0015]} material={MAT.hole} />
          <mesh geometry={CYL} rotation-x={Math.PI / 2} scale={[0.0017, 0.0035, 0.0017]} position={[0, -0.005, 0.0015]} material={MAT.hole} />
        </group>
      );
    case 'dc':
      return (
        <group>
          <mesh geometry={CYL} rotation-x={Math.PI / 2} scale={[w / 2, 0.003, w / 2]} position-z={0.0015}>{hlMat ?? <meshStandardMaterial color="#1c1d20" roughness={0.6} />}</mesh>
          <mesh geometry={CYL} rotation-x={Math.PI / 2} scale={[w / 4, 0.0035, w / 4]} position-z={0.0015} material={MAT.hole} />
        </group>
      );
    case 'sc':
      return (
        <group>
          <mesh geometry={BOX} scale={[w, h, 0.006]} position-z={0.003}>{hlMat ?? <meshStandardMaterial color="#1f8a3a" roughness={0.5} />}</mesh>
          <mesh geometry={BOX} scale={[w * 0.5, h * 0.55, 0.0065]} position-z={0.003} material={MAT.hole} />
        </group>
      );
    case 'ebm':
      return (
        <group>
          <mesh geometry={BOX} scale={[w, h, 0.012]} position-z={0.006}>{hlMat ?? <meshStandardMaterial color="#8c8f94" roughness={0.6} />}</mesh>
          <mesh geometry={BOX} scale={[w * 0.35, h * 0.6, 0.0125]} position={[-w * 0.2, 0, 0.006]} material={MAT.hole} />
          <mesh geometry={BOX} scale={[w * 0.35, h * 0.6, 0.0125]} position={[w * 0.2, 0, 0.006]} material={MAT.hole} />
        </group>
      );
    default:
      return (
        <group>
          <mesh geometry={BOX} scale={[w, h, 0.002]} position-z={0.001} material={hl ? undefined : frame!}>{hlMat}</mesh>
          <mesh geometry={BOX} scale={[w * 0.8, h * 0.72, 0.0024]} position-z={0.001} material={MAT.hole} />
          {kind === 'keystone' && <mesh geometry={BOX} scale={[w * 1.05, 0.002, 0.0026]} position={[0, -h * 0.58, 0.001]} material={MAT.steel} />}
        </group>
      );
  }
}

export const Port3D = memo(function Port3D({ p }: { p: PortDef }) {
  const d = DEV[p.deviceId];
  const installed = useSim((s) => (p.comp ? !!s.devices[p.deviceId].comps[p.comp]?.installed : true));
  const led = useDerived((s) => s.d.leds[p.id]);
  const hl = useUI((s) => {
    if (s.selected?.kind === 'port' && s.selected.id === p.id) return '#38bdf8';
    const origin = s.pending?.from;
    if (!origin) return null;
    if (origin === p.id) return '#38bdf8';
    const movingType = s.pending?.cableId ? useSim.getState().cables[s.pending.cableId]?.type : null;
    const fixed = movingType ? (() => { const c = useSim.getState().cables[s.pending!.cableId!]; return c.a === origin ? c.b : c.a; })() : origin;
    const types = compatibleTypes(PORTS[fixed], p);
    const ok = movingType ? types.includes(movingType) : types.length > 0;
    if (!ok) return null;
    return useDerived.getState().d.portCable[p.id] ? null : '#22c55e';
  });
  if (!installed) return null;
  const z = p.face === 'rear' ? -d.depth / 2 : d.depth / 2;
  const [w, h] = PORT_SIZE[p.kind];
  const hasLed = ['rj45', 'sfp', 'stack'].includes(p.kind) && d.type !== 'patch';
  const onOver = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); useUI.getState().setHover(portHover(p.id)); document.body.style.cursor = 'pointer'; };
  const onOut = () => { useUI.getState().setHover(null); document.body.style.cursor = ''; };
  return (
    <group position={[p.x, p.y, z]} rotation={[0, p.face === 'rear' ? Math.PI : 0, p.vertical ? Math.PI / 2 : 0]}>
      <Shape kind={p.kind} hl={hl} />
      {hasLed && (
        <>
          <mesh geometry={BOX} scale={[0.0022, 0.0014, 0.0008]} position={[-w / 2 + 0.0016, h / 2 - 0.001, 0.0026]} material={led === 'green' ? MAT.ledGreen : led === 'amber' ? MAT.ledAmber : MAT.ledOff} />
          <mesh geometry={BOX} scale={[0.0022, 0.0014, 0.0008]} position={[w / 2 - 0.0016, h / 2 - 0.001, 0.0026]} material={led === 'green' ? MAT.ledAmber : MAT.ledOff} />
        </>
      )}
      <mesh
        geometry={BOX}
        scale={[w * 1.25, h * 1.3, 0.012]}
        position-z={0.005}
        material={MAT.hit}
        onPointerOver={onOver}
        onPointerOut={onOut}
        onPointerDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); portDown(p.id); }}
        onPointerUp={(e) => { e.stopPropagation(); portUp(p.id); useUI.getState().setHover(portHover(p.id)); }}
        onClick={(e) => e.stopPropagation()}
      />
    </group>
  );
});
