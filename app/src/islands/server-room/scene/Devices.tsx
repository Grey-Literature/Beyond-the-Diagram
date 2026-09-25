import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { DEV, EXTEND_DIST, PDU_LEN, STACK_MEMBERS, U, deviceHeight, devicePose } from '../../../sim/catalog';
import type { DeviceDef } from '../../../sim/types';
import { act, anim, useDerived, useSim, useUI } from '../store';
import { BOX, CYL, MAT, faceTexture, ventTexture, type TextItem } from './labels';
import { Port3D } from './Port3D';
import { Comp3D } from './Parts';
import { deviceHover, isClick } from './interact';

const TAPE = { bg: '#f2f1ea', color: '#111', bold: true, mono: true } as const;

function B({ s, p, m, children, ...rest }: { s: [number, number, number]; p?: [number, number, number]; m?: THREE.Material; children?: React.ReactNode } & Record<string, unknown>) {
  return <mesh geometry={BOX} scale={s} position={p} material={m} {...rest}>{children}</mesh>;
}

/** printed text on a face; rear=true mirrors so text reads correctly from behind */
function Print({ w, h, z, items, rear, id, y0 = 0 }: { w: number; h: number; z: number; items: TextItem[]; rear?: boolean; id: string; y0?: number }) {
  const tex = useMemo(() => faceTexture(id, w, h, rear ? items.map((i) => ({ ...i, x: -i.x })) : items), [id, w, h, items, rear]);
  return (
    <mesh position={[0, y0 + h / 2, z]} rotation-y={rear ? Math.PI : 0} renderOrder={1}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} toneMapped={false} />
    </mesh>
  );
}

function portLabels(def: DeviceDef, face: 'front' | 'rear', dy = 0.0088): TextItem[] {
  return def.ports.filter((p) => p.face === face).map((p) => {
    const below = def.type === 'switch' && p.kind === 'rj45' && p.y < 0.02 && p.name !== 'MGMT';
    return { text: p.label, x: p.x, y: below ? p.y - 0.0085 : p.y + dy, size: p.label.length > 5 ? 0.0028 : 0.0033, color: '#cfd5dc' };
  });
}

// ---------------------------------------------------------------------------
export const Device3D = memo(function Device3D({ def }: { def: DeviceDef }) {
  const pose = devicePose(def);
  const slide = useRef<THREE.Group>(null);
  const mid = useRef<THREE.Group>(null);
  const extended = useSim((s) => s.devices[def.id].extended);
  const selected = useUI((s) => s.selected && 'dev' in s.selected && s.selected.dev === def.id && s.selected.kind === 'device');
  useFrame((_, dt) => {
    if (!def.serviceable || !slide.current) return;
    const cur = anim.ext[def.id] ?? (extended ? 1 : 0);
    const target = extended ? 1 : 0;
    const next = Math.abs(target - cur) < 0.002 ? target : THREE.MathUtils.damp(cur, target, 6, dt);
    anim.ext[def.id] = next;
    slide.current.position.z = next * EXTEND_DIST;
    if (mid.current) mid.current.position.z = next * EXTEND_DIST * 0.5;
  });
  const H = deviceHeight(def);
  const events = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); useUI.getState().setHover(deviceHover(def.id)); },
    onPointerOut: () => useUI.getState().setHover(null),
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (isClick(e)) useUI.getState().select({ kind: 'device', dev: def.id }); },
  };
  let body: React.ReactNode;
  switch (def.type) {
    case 'server2u': case 'server1u': case 'san': body = <Serviceable def={def} />; break;
    case 'pdu': body = <PduBody def={def} />; break;
    case 'wallpanel': body = <WallPanel def={def} />; break;
    case 'ups': body = <UpsBody def={def} />; break;
    case 'shelf': body = <ShelfBody def={def} />; break;
    case 'isp': case 'dumbswitch': case 'strip': body = <DesktopBody def={def} />; break;
    default: body = <SimpleBody def={def} />;
  }
  return (
    <group position={pose.pos} rotation-y={pose.rotY}>
      <group ref={slide}>
        <group {...events}>{body}</group>
        {def.ports.map((p) => <Port3D key={p.id} p={p} />)}
        {selected && def.type !== 'wallpanel' && (
          <lineSegments position={[0, H / 2, 0]}>
            <edgesGeometry args={[new THREE.BoxGeometry(def.width + 0.006, H + 0.004, def.depth + 0.006)]} />
            <lineBasicMaterial color="#38bdf8" />
          </lineSegments>
        )}
        {def.serviceable && ([-1, 1] as const).map((sd) => <B key={sd} s={[0.003, H * 0.4, def.depth * 0.92]} p={[sd * 0.2185, H / 2, 0]} m={MAT.zinc} />)}
      </group>
      {def.serviceable && (
        <>
          <group ref={mid}>{([-1, 1] as const).map((sd) => <B key={sd} s={[0.003, H * 0.5, 0.62]} p={[sd * 0.2215, H / 2, 0.025 - pose.pos[2]]} m={MAT.steel} />)}</group>
          {([-1, 1] as const).map((sd) => <B key={sd} s={[0.004, Math.min(0.036, H * 0.6), 0.85]} p={[sd * 0.2245, H / 2, 0.025 - pose.pos[2]]} m={MAT.zinc} />)}
        </>
      )}
    </group>
  );
});

// ---------------------------------------------------------------------------
function SimpleBody({ def }: { def: DeviceDef }) {
  const H = def.h * U - 0.0008;
  const d = def.depth;
  const running = useDerived((s) => s.d.devRunning[def.id]);
  const stackFormed = useDerived((s) => s.d.stack.formed);
  const alerts = useDerived((s) => (s.d.devAlerts[def.id]?.length ?? 0) > 0);
  const t = def.type;
  const stackMember = STACK_MEMBERS.includes(def.id);
  const frontCol = t === 'firewall' ? '#2b2426' : t === 'patch' || t === 'tiepanel' || t === 'blank' || t === 'cablemgr' ? '#16171a' : stackMember ? '#2e333a' : '#20252c';
  const frontItems = useMemo<TextItem[]>(() => {
    const it: TextItem[] = portLabels(def, 'front');
    const tag = def.id;
    if (t === 'switch') {
      it.push({ text: tag, x: 0.185, y: 0.011, size: 0.0045, ...TAPE }, { text: stackMember ? 'SYS  PSU  STK' : 'SYS  PSU', x: 0.18, y: 0.037, size: 0.0024 });
    } else if (t === 'tiepanel') {
      it.push({ text: tag, x: -0.215, y: 0.02, size: 0.0042, ...TAPE, align: 'left' });
      it.push({ text: def.facing === 'rear' ? 'TIE → TP-F  (SERVER SIDE)' : 'TIE → TP-R  (SWITCH SIDE)', x: 0.212, y: 0.02, size: 0.0026, align: 'right', color: '#9aa3ad' });
    } else if (t === 'patch') {
      it.push({ text: tag, x: -0.215, y: 0.02, size: 0.0042, ...TAPE, align: 'left' });
      it.push({ text: tag === 'PP-A' ? 'OFFICE DATA  A01–A24' : 'VOICE / CONF  B01–B24', x: 0.212, y: 0.02, size: 0.0026, align: 'right', color: '#9aa3ad' });
    } else if (t === 'firewall') {
      it.push({ text: tag, x: 0.17, y: 0.022, size: 0.0045, ...TAPE }, { text: 'INSIDE', x: -0.0375, y: 0.004, size: 0.0024, color: '#ef4444' }, { text: 'OUTSIDE', x: -0.1125, y: 0.004, size: 0.0024, color: '#ef4444' });
    } else if (t === 'ebm') {
      it.push({ text: 'EXTENDED BATTERY MODULE', x: 0, y: 0.06, size: 0.004, color: '#9aa3ad' }, { text: 'EBM-01', x: 0.18, y: 0.02, size: 0.0045, ...TAPE });
    }
    return it;
  }, [def, t, stackMember]);
  const rearItems = useMemo<TextItem[]>(() => [...portLabels(def, 'rear', t === 'ebm' ? 0.017 : 0.0155), ...(t === 'switch' ? [{ text: def.id, x: 0, y: 0.022, size: 0.004, ...TAPE }] : []), ...(t === 'ebm' ? [{ text: 'DC 72V – CONNECT TO UPS EXT BATT ONLY', x: -0.05, y: 0.03, size: 0.0032, color: '#fbbf24' }] : [])], [def, t]);

  if (t === 'blank') return <B s={[0.4826, H, 0.003]} p={[0, H / 2, d / 2 - 0.0015]}><meshStandardMaterial color="#1b1c1f" roughness={0.8} /></B>;
  if (t === 'cablemgr') {
    return (
      <group>
        <B s={[0.4826, H, 0.003]} p={[0, H / 2, -0.03]} m={MAT.black} />
        {Array.from({ length: 11 }, (_, i) => <B key={i} s={[0.006, H * 0.85, 0.07]} p={[-0.2 + i * 0.04, H / 2, 0.005]} m={MAT.plastic} />)}
        <B s={[0.44, 0.003, 0.07]} p={[0, 0.003, 0.005]} m={MAT.plastic} />
      </group>
    );
  }
  return (
    <group>
      <B s={[0.434, H, d - 0.003]} p={[0, H / 2, -0.0015]}><meshStandardMaterial color="#2a2e35" metalness={0.45} roughness={0.55} /></B>
      <B s={[0.4826, H, 0.003]} p={[0, H / 2, d / 2 - 0.0015]}><meshStandardMaterial color={frontCol} metalness={0.3} roughness={0.6} /></B>
      {t === 'firewall' && <B s={[0.4826, 0.002, 0.0032]} p={[0, H - 0.002, d / 2 - 0.0015]}><meshStandardMaterial color="#b91c1c" /></B>}
      {t === 'patch' && <B s={[0.43, H * 0.7, 0.03]} p={[0, H / 2, d / 2 - 0.06]} m={MAT.black} />}
      {t === 'patch' && <PatchBundle def={def} />}
      {t === 'tiepanel' && <B s={[0.43, H * 0.7, 0.02]} p={[0, H / 2, d / 2 - 0.02]} m={MAT.black} />}
      {t === 'tiepanel' && def.facing !== 'rear' && <TieBundle def={def} />}
      {(t === 'switch' || t === 'firewall' || t === 'ebm') && (
        <mesh position={[t === 'ebm' ? 0 : -0.07, H / 2, -d / 2 - 0.0006]} rotation-y={Math.PI}>
          <planeGeometry args={[t === 'ebm' ? 0.3 : 0.14, H * 0.7]} />
          <meshStandardMaterial map={ventTexture()} roughness={0.8} />
        </mesh>
      )}
      {t === 'switch' && (
        <>
          {(stackMember ? [0, 1, 2] : [0, 1]).map((i) => <B key={i} s={[0.0022, 0.0016, 0.001]} p={[0.169 + i * 0.0105, 0.0335, d / 2 + 0.0005]} m={i === 2 ? (stackFormed ? MAT.ledGreen : MAT.ledAmber) : running ? (i === 1 && alerts ? MAT.ledAmber : MAT.ledGreen) : MAT.ledOff} />)}
          {stackMember && <Print id={`${def.id}-stk`} w={0.01} h={0.012} z={d / 2 + 0.0006} y0={0.004} items={running ? [{ text: String(STACK_MEMBERS.indexOf(def.id) + 1), x: 0, y: 0.006, size: 0.009, color: '#4ade80', mono: true, bold: true }] : []} />}
        </>
      )}
      {t === 'firewall' && <B s={[0.0024, 0.0018, 0.001]} p={[0.13, 0.022, d / 2 + 0.0005]} m={running ? MAT.ledGreen : MAT.ledOff} />}
      <Print id={`${def.id}-f`} w={0.4826} h={H} z={d / 2 + 0.0004} items={frontItems} />
      <Print id={`${def.id}-r`} w={0.434} h={H} z={-d / 2 - 0.0004} items={rearItems} rear />
    </group>
  );
}

// ---------------------------------------------------------------------------
/** A 2U cantilever shelf: where carrier and consumer gear ends up in real rooms. */
function ShelfBody({ def }: { def: DeviceDef }) {
  const d = def.depth;
  const vent = useMemo(() => { const t = ventTexture().clone(); t.needsUpdate = true; t.repeat.set(24, 22); return t; }, []);
  return (
    <group>
      <mesh position={[0, 0.002, 0]}>
        <boxGeometry args={[0.44, 0.004, d]} />
        <meshStandardMaterial map={vent} color="#8a9099" metalness={0.5} roughness={0.5} />
      </mesh>
      <B s={[0.4826, 0.02, 0.003]} p={[0, 0.01, d / 2 - 0.0015]} m={MAT.chassis} />
      <B s={[0.44, 0.012, 0.003]} p={[0, 0.006, -d / 2 + 0.0015]} m={MAT.chassis} />
    </group>
  );
}

/** Desktop gear sitting on the shelf — the ISP's ONT, a consumer switch, a power strip. */
function DesktopBody({ def }: { def: DeviceDef }) {
  const H = deviceHeight(def);
  const W = def.width;
  const d = def.depth;
  const t = def.type;
  const running = useDerived((s) => s.d.devRunning[def.id]);
  const powered = useDerived((s) => s.d.devPowered[def.id]);
  const lineUp = useDerived((s) => !!s.d.links['NTE:LINE']?.up);
  const on = useSim((s) => s.devices[def.id].powerOn);
  const light = t === 'isp' || t === 'strip';
  const body = t === 'isp' ? '#e9eaec' : t === 'strip' ? '#f1f0ea' : '#2a2d33';
  const labelCol = light ? '#2a2d33' : '#cfd5dc';
  const frontItems = useMemo<TextItem[]>(() => {
    const it: TextItem[] = def.ports.filter((p) => p.face === 'front').map((p) => ({ text: p.label, x: p.x, y: p.y + 0.009, size: 0.0026, color: labelCol }));
    if (t === 'isp') it.push({ text: 'CARRIER EQUIPMENT – DO NOT UNPLUG', x: 0.045, y: H - 0.007, size: 0.0026, bg: '#f59e0b', color: '#111', bold: true });
    if (t === 'isp') it.push({ text: 'PWR  PON  LOS', x: 0.06, y: 0.009, size: 0.0022, color: '#555' });
    return it;
  }, [def, t, H, labelCol]);
  const rearItems = useMemo<TextItem[]>(() => def.ports.filter((p) => p.face === 'rear').map((p) => ({ text: p.label, x: p.x, y: p.y + 0.01, size: 0.0024, color: labelCol })), [def, labelCol]);
  const leds = t === 'isp'
    ? [running, running && lineUp, running && !lineUp].map((lit, i) => ({ lit, amber: i === 2, x: 0.048 + i * 0.012 }))
    : t === 'dumbswitch' ? [{ lit: running, amber: false, x: 0.042 }] : [];
  const toggle = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (isClick(e)) act(useSim.getState().setStripSwitch(def.id, !on)); };
  return (
    <group>
      <B s={[W, H, d]} p={[0, H / 2, 0]}><meshStandardMaterial color={body} metalness={light ? 0.05 : 0.3} roughness={0.6} /></B>
      {leds.map((l, i) => <B key={i} s={[0.0022, 0.0022, 0.001]} p={[l.x, 0.005 + (t === 'isp' ? 0 : 0.012), d / 2 + 0.0005]} m={!l.lit ? MAT.ledOff : l.amber ? MAT.ledAmber : MAT.ledGreen} />)}
      {t === 'strip' && (
        <group
          position={[-W / 2 + 0.018, H / 2, d / 2 + 0.003]}
          onClick={toggle}
          onPointerOver={(e) => { e.stopPropagation(); useUI.getState().setHover({ title: `${def.id} rocker switch`, lines: [on ? 'ON – click to switch off' : 'OFF – click to switch on', powered ? 'Cord is live' : 'Cord is not getting power'], tone: on && powered ? 'ok' : 'bad' }); }}
          onPointerOut={() => useUI.getState().setHover(null)}
        >
          <B s={[0.016, 0.022, 0.006]} m={MAT.black} />
          <B s={[0.012, 0.016, 0.004]} p={[0, 0, 0.004]} rotation-x={on ? -0.25 : 0.25}><meshStandardMaterial color={on && powered ? '#ef4444' : '#7f1d1d'} emissive={on && powered ? '#ef4444' : '#000'} emissiveIntensity={on && powered ? 0.6 : 0} /></B>
        </group>
      )}
      <Print id={`${def.id}-f`} w={W} h={H} z={d / 2 + 0.0004} items={frontItems} />
      <Print id={`${def.id}-r`} w={W} h={H} z={-d / 2 - 0.0004} items={rearItems} rear />
    </group>
  );
}

/** The permanent links between a back-to-back tie-panel pair, drawn from the front panel. */
function TieBundle({ def }: { def: DeviceDef }) {
  const faults = useSim((s) => Object.values(s.tieFaults).filter(Boolean).length);
  const pose = devicePose(def);
  const twin = devicePose(DEV['TP-R']);
  const back = pose.pos[2] - def.depth / 2;
  const twinBack = twin.pos[2] + DEV['TP-R'].depth / 2;
  const len = back - twinBack;
  const H = def.h * U;
  return (
    <mesh
      position={[0, H / 2, -def.depth / 2 - len / 2]}
      onPointerOver={(e) => { e.stopPropagation(); useUI.getState().setHover({ title: 'Permanent tie links TP-F ⇄ TP-R', lines: ['24 punched-down Cat6 runs between the two panels', faults ? `${faults} link(s) failing continuity` : 'Not something you re-patch – you re-terminate'], tone: faults ? 'bad' : 'info' }); }}
      onPointerOut={() => useUI.getState().setHover(null)}
    >
      <boxGeometry args={[0.36, 0.01, len]} />
      <meshStandardMaterial color="#5b6fa8" roughness={0.7} />
    </mesh>
  );
}

/** building cable runs terminating on patch panel keystones (rear), leaving via the roof */
function PatchBundle({ def }: { def: DeviceDef }) {
  const geo = useMemo(() => {
    const pose = devicePose(def);
    const top = 2.33 - pose.pos[1];
    const z0 = def.depth / 2 - 0.08;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.18, 0.02, z0), new THREE.Vector3(0.24, 0.025, z0 - 0.04), new THREE.Vector3(0.27, 0.06 + top * 0.3, z0 - 0.1), new THREE.Vector3(0.27, top, z0 - 0.12),
    ]);
    return new THREE.TubeGeometry(curve, 24, 0.012, 10, false);
  }, [def]);
  return (
    <group>
      <mesh geometry={geo}><meshStandardMaterial color="#5b6fa8" roughness={0.7} /></mesh>
      <B s={[0.4, 0.012, 0.02]} p={[0, 0.02, def.depth / 2 - 0.085]} m={MAT.zinc} />
    </group>
  );
}

// ---------------------------------------------------------------------------
function UpsBody({ def }: { def: DeviceDef }) {
  const H = def.h * U - 0.0008;
  const d = def.depth;
  const ups = useDerived((s) => s.d.ups);
  const charge = useSim((s) => s.upsCharge);
  // Front LCD: redrawn into a fresh texture whenever what it shows changes.
  const tex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const g = canvas.getContext('2d')!;
    g.fillStyle = ups.mode === 'off' ? '#101412' : ups.mode === 'battery' ? '#3a2a08' : '#0e2a1c';
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = ups.mode === 'battery' ? '#ffcc55' : '#7dffb0';
    g.font = 'bold 22px monospace';
    if (ups.mode !== 'off') {
      g.fillText(ups.mode === 'online' ? 'ONLINE' : 'ON BATTERY', 10, 28);
      g.font = '18px monospace';
      g.fillText(`LOAD ${Math.round(ups.loadW)}W ${Math.round((ups.loadW / 2700) * 100)}%`, 10, 55);
      g.fillText(`BATT ${Math.round(charge * 100)}% ${ups.runtimeMin.toFixed(0)}min`, 10, 80);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [ups.mode, ups.loadW, ups.runtimeMin, charge]);
  useEffect(() => () => tex.dispose(), [tex]);
  const items = useMemo<TextItem[]>(() => [{ text: 'UPS-01', x: -0.19, y: 0.012, size: 0.0045, ...TAPE }, { text: '3000VA ONLINE', x: -0.1, y: 0.075, size: 0.0035, color: '#9aa3ad' }], []);
  const rearItems = useMemo<TextItem[]>(() => [...portLabels(def, 'rear', 0.02), { text: 'OUTPUT 120V', x: -0.053, y: 0.082, size: 0.0028, color: '#fbbf24' }], [def]);
  return (
    <group>
      <B s={[0.434, H, d - 0.003]} p={[0, H / 2, -0.0015]} m={MAT.chassis} />
      <B s={[0.4826, H, 0.003]} p={[0, H / 2, d / 2 - 0.0015]}><meshStandardMaterial color="#16171a" roughness={0.7} /></B>
      <mesh position={[-0.1, 0.046, d / 2 + 0.0006]}><planeGeometry args={[0.07, 0.026]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      {[0, 1, 2, 3].map((i) => <B key={i} s={[0.007, 0.005, 0.002]} p={[-0.125 + i * 0.016, 0.022, d / 2 + 0.001]} m={MAT.plastic} />)}
      <B s={[0.004, 0.004, 0.001]} p={[-0.05, 0.056, d / 2 + 0.0006]} m={ups.mode === 'online' ? MAT.ledGreen : MAT.ledOff} />
      <B s={[0.004, 0.004, 0.001]} p={[-0.05, 0.046, d / 2 + 0.0006]} m={ups.mode === 'battery' ? MAT.ledAmber : MAT.ledOff} />
      {def.comps.map((c) => <Comp3D key={c.id} def={def} c={c} />)}
      <Print id="ups-f" w={0.4826} h={H} z={d / 2 + 0.0004} items={items} />
      <Print id="ups-r" w={0.434} h={H} z={-d / 2 - 0.0004} items={rearItems} rear />
    </group>
  );
}

// ---------------------------------------------------------------------------
function PduBody({ def }: { def: DeviceDef }) {
  const live = useDerived((s) => s.d.pduLive[def.id]);
  const amps = useDerived((s) => s.d.pduLoadA[def.id]);
  const d = def.depth;
  const items = useMemo<TextItem[]>(() => [{ text: live ? `${amps.toFixed(1)}A` : '', x: 0, y: PDU_LEN - 0.03, size: 0.012, color: '#ff5a4a', mono: true, bold: true }, { text: def.id, x: 0, y: PDU_LEN - 0.07, size: 0.008, ...TAPE }, ...def.ports.map((p) => ({ text: p.label, x: -0.018, y: p.y + (p.name === 'INLET' ? 0.022 : 0.018), size: 0.006, color: '#cbd5e1' }))], [live, amps, def]);
  return (
    <group>
      <B s={[def.width, PDU_LEN, d]} p={[0, PDU_LEN / 2, 0]}><meshStandardMaterial color="#1b1d21" metalness={0.4} roughness={0.6} /></B>
      <B s={[0.03, 0.02, 0.002]} p={[0, PDU_LEN - 0.03, -d / 2 - 0.0008]} m={MAT.hole} />
      {[0.1, PDU_LEN - 0.1].map((y) => <B key={y} s={[0.07, 0.02, 0.004]} p={[0, y, d / 2 + 0.002]} m={MAT.zinc} />)}
      <Print id={`${def.id}-p`} w={def.width} h={PDU_LEN} z={-d / 2 - 0.0012} items={items} rear />
    </group>
  );
}

// ---------------------------------------------------------------------------
function WallPanel({ def }: { def: DeviceDef }) {
  const utilityOn = useSim((s) => s.utilityOn);
  const d = def.depth;
  const items = useMemo<TextItem[]>(() => [
    { text: 'BUILDING ENTRANCE / DEMARC', x: 0, y: 0.43, size: 0.018, color: '#1f2937', bold: true },
    { text: 'ISP FIBER', x: -0.15, y: 0.35, size: 0.012, color: '#1f2937' },
    { text: 'PSTN 1   PSTN 2', x: -0.005, y: 0.35, size: 0.011, color: '#1f2937' },
    { text: 'L5-30R  CKT 14', x: 0.16, y: 0.2, size: 0.012, color: '#1f2937' },
    { text: 'UPS-01 INPUT', x: 0.16, y: 0.05, size: 0.011, color: '#b91c1c', bold: true },
  ], []);
  const breakerItems = useMemo<TextItem[]>(() => [{ text: 'PANEL LP-2', x: 0, y: 0.34, size: 0.016, color: '#111', bold: true }, { text: 'CKT 14 · SERVER RACK UPS', x: 0, y: 0.075, size: 0.011, color: '#111' }, { text: 'ON', x: 0.04, y: 0.23, size: 0.012, color: '#15803d', bold: true }, { text: 'OFF', x: 0.04, y: 0.15, size: 0.012, color: '#b91c1c', bold: true }], []);
  return (
    <group>
      {/* fire-rated plywood backboard */}
      <B s={[1.3, 1.1, 0.02]} p={[0.25, 0.3, -d / 2 - 0.01]}><meshStandardMaterial color="#c9a36a" roughness={0.9} /></B>
      <B s={[def.width, 0.46, d]} p={[0, 0.23, 0]}><meshStandardMaterial color="#e5e7ea" roughness={0.6} /></B>
      <B s={[0.1, 0.1, 0.004]} p={[-0.15, 0.3, d / 2 + 0.002]}><meshStandardMaterial color="#9ca3af" /></B>
      <B s={[0.1, 0.06, 0.004]} p={[-0.005, 0.3, d / 2 + 0.002]}><meshStandardMaterial color="#e7dcc5" /></B>
      <B s={[0.1, 0.1, 0.004]} p={[0.16, 0.12, d / 2 + 0.002]}><meshStandardMaterial color="#9ca3af" /></B>
      <Print id="demarc" w={def.width} h={0.46} z={d / 2 + 0.0045} items={items} />
      {/* breaker panel */}
      <group position={[0.58, 0.05, 0]}>
        <B s={[0.24, 0.4, 0.07]} p={[0, 0.2, 0]}><meshStandardMaterial color="#9aa0a7" metalness={0.5} roughness={0.5} /></B>
        <Print id="brk" w={0.24} h={0.4} z={0.0355} items={breakerItems} />
        <group
          position={[-0.02, utilityOn ? 0.215 : 0.165, 0.04]}
          onClick={(e) => { e.stopPropagation(); if (!isClick(e)) return; act(useSim.getState().setUtility(!utilityOn)); }}
          onPointerOver={(e) => { e.stopPropagation(); useUI.getState().setHover({ title: 'Breaker CKT 14 (UPS-01 feed)', lines: [utilityOn ? 'ON – click to trip/switch off' : 'OFF – click to reset/switch on'], tone: utilityOn ? 'ok' : 'bad' }); }}
          onPointerOut={() => useUI.getState().setHover(null)}
        >
          <B s={[0.05, 0.035, 0.02]} m={MAT.black} />
          <B s={[0.012, 0.018, 0.02]} p={[0, 0, 0.018]}><meshStandardMaterial color={utilityOn ? '#16a34a' : '#dc2626'} /></B>
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
function Serviceable({ def }: { def: DeviceDef }) {
  const st = useSim((s) => s.devices[def.id]);
  const running = useDerived((s) => s.d.devRunning[def.id]);
  const powered = useDerived((s) => s.d.devPowered[def.id]);
  const alerts = useDerived((s) => (s.d.devAlerts[def.id]?.length ?? 0) > 0);
  const H = def.h * U - 0.0008;
  const d = def.depth;
  const fz = d / 2, rz = -d / 2;
  const lid = useRef<THREE.Group>(null);
  const [interior, setInterior] = useState(st.lidOff);
  const lidT = useRef(st.lidOff ? 1 : 0);
  useFrame((_, dt) => {
    const target = st.lidOff ? 1 : 0;
    lidT.current = Math.abs(target - lidT.current) < 0.003 ? target : THREE.MathUtils.damp(lidT.current, target, 5, dt);
    if (lid.current) {
      lid.current.position.set(0, lidT.current * 0.28, -lidT.current * 0.12);
      lid.current.visible = lidT.current < 0.97;
    }
    const vis = lidT.current > 0.01;
    if (vis !== interior) setInterior(vis);
  });
  const isSan = def.type === 'san';
  const is2u = def.type === 'server2u';
  const drives = def.comps.filter((c) => c.kind === 'drive');
  const driveTop = Math.max(...drives.map((c) => c.pos[1] + c.size[1] / 2));
  const driveBot = Math.min(...drives.map((c) => c.pos[1] - c.size[1] / 2));
  const driveL = Math.min(...drives.map((c) => c.pos[0] - c.size[0] / 2));
  const driveR = Math.max(...drives.map((c) => c.pos[0] + c.size[0] / 2));
  const psuX0 = Math.min(...def.comps.filter((c) => c.kind === 'psu').map((c) => c.pos[0] - c.size[0] / 2));
  const alwaysVisible = (k: string) => ['drive', 'psu', 'nic', 'hba', 'lom', 'controller', 'raid'].includes(k);
  const frontItems = useMemo<TextItem[]>(() => [
    { text: def.id, x: -0.229, y: H * 0.5, size: 0.0042, ...TAPE },
    ...drives.map((c) => ({ text: c.id.replace('drive', ''), x: c.pos[0] + (c.size[1] > c.size[0] ? 0 : -c.size[0] * 0.44), y: c.size[1] > c.size[0] ? c.pos[1] + c.size[1] / 2 + 0.003 : c.pos[1], size: 0.0026, color: '#9aa3ad' })),
  ], [def, drives, H]);
  const rearItems = useMemo<TextItem[]>(() => [...portLabels(def, 'rear', 0.0085), ...(is2u ? [{ text: 'RISER 1', x: -0.16, y: H - 0.005, size: 0.0026, color: '#9aa3ad' }] : [])], [def, is2u, H]);
  const lidItems = useMemo<TextItem[]>(() => [
    { text: `${def.id} · SERVICE INFORMATION`, x: 0, y: d * 0.9, size: 0.012, color: '#1f2937', bold: true },
    { text: isSan ? 'Controllers & PCMs hot-swap from rear. Drives hot-swap from front.' : 'DIMM/CPU/PCIe: power off & remove AC first. Fans, drives, PSUs: hot-swap.', x: 0, y: d * 0.84, size: 0.008, color: '#1f2937' },
    { text: `SN: ${def.id.replace('-', '')}X7Q${def.u}  ·  Asset tag: IT-${1000 + def.u}`, x: 0, y: d * 0.1, size: 0.008, color: '#374151', mono: true },
  ], [def, d, isSan]);
  const lidTex = useMemo(() => faceTexture(`${def.id}-lid`, 0.4, d, lidItems, 900), [def.id, d, lidItems]);
  const toggleShroud = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (isClick(e)) act(useSim.getState().toggleShroud(def.id)); };

  return (
    <group>
      {/* shell */}
      <B s={[0.434, 0.002, d]} p={[0, 0.001, 0]} m={MAT.chassis} />
      <B s={[0.0016, H - 0.002, d]} p={[-0.2162, H / 2, 0]} m={MAT.chassis} />
      <B s={[0.0016, H - 0.002, d]} p={[0.2162, H / 2, 0]} m={MAT.chassis} />
      {/* front frame around drive cage */}
      <B s={[0.434, Math.max(0.001, driveBot - 0.001), 0.003]} p={[0, driveBot / 2, fz - 0.0015]} m={MAT.chassisLight} />
      <B s={[0.434, Math.max(0.001, H - driveTop), 0.003]} p={[0, (H + driveTop) / 2, fz - 0.0015]} m={MAT.chassisLight} />
      {driveL > -0.21 && <B s={[driveL + 0.217, driveTop - driveBot, 0.003]} p={[(driveL - 0.217) / 2, (driveTop + driveBot) / 2, fz - 0.0015]} m={MAT.chassisLight} />}
      {driveR < 0.21 && (
        <mesh position={[(driveR + 0.217) / 2, (driveTop + driveBot) / 2, fz - 0.0012]}>
          <boxGeometry args={[0.217 - driveR, driveTop - driveBot, 0.003]} />
          <meshStandardMaterial map={ventTexture()} metalness={0.3} roughness={0.6} />
        </mesh>
      )}
      {/* rack ears + control panel */}
      <B s={[0.024, H, 0.003]} p={[-0.229, H / 2, fz - 0.0015]} m={MAT.chassisLight} />
      <B s={[0.024, H, 0.003]} p={[0.229, H / 2, fz - 0.0015]} m={MAT.chassisLight} />
      <PowerButton def={def} y={H * 0.62} z={fz} running={running} powered={powered} />
      <B s={[0.004, 0.003, 0.001]} p={[0.229, H * 0.28, fz + 0.0006]} m={alerts && powered ? MAT.ledAmber : powered ? MAT.ledBlue : MAT.ledOff} />
      {/* rear panel (not over PSU/controller bays) */}
      {!isSan && <B s={[psuX0 + 0.217, H - 0.002, 0.003]} p={[(psuX0 - 0.217) / 2, H / 2, rz + 0.0015]} m={MAT.chassis} />}
      {isSan && <B s={[0.02, H - 0.002, 0.003]} p={[-0.123, H / 2, rz + 0.0015]} m={MAT.chassis} />}
      {isSan && <B s={[0.02, H - 0.002, 0.003]} p={[0.123, H / 2, rz + 0.0015]} m={MAT.chassis} />}
      {/* lid */}
      <group ref={lid}
        onClick={(e) => { e.stopPropagation(); if (isClick(e)) useUI.getState().select({ kind: 'device', dev: def.id }); }}>
        <B s={[0.434, 0.0014, d]} p={[0, H - 0.0007, 0]}><meshStandardMaterial color="#8e959e" metalness={0.6} roughness={0.45} /></B>
        <mesh position={[0, H + 0.0002, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.4, d]} />
          <meshBasicMaterial map={lidTex} transparent depthWrite={false} toneMapped={false} />
        </mesh>
        <B s={[0.06, 0.004, 0.02]} p={[0, H + 0.002, 0.05]} m={MAT.touch} />
      </group>
      {/* components */}
      {def.comps.map((c) => (alwaysVisible(c.kind) || interior ? <Comp3D key={c.id} def={def} c={c} /> : null))}
      {interior && (
        <group>
          <B s={[0.425, 0.002, is2u ? 0.52 : isSan ? 0.02 : 0.42]} p={[0, 0.004, is2u ? -0.1 : isSan ? 0 : -0.1]} m={isSan ? MAT.chassis : MAT.pcbMobo} />
          {/* drive backplane / midplane */}
          <B s={[0.42, H * 0.82, 0.003]} p={[0, H * 0.46, isSan ? 0.075 : fz - (is2u ? 0.135 : 0.205)]} m={MAT.pcb} />
          {!isSan && (
            <>
              <B s={[0.024, 0.006, 0.024]} p={[0.1, 0.008, -0.12]} m={MAT.alu} />
              <mesh geometry={CYL} scale={[0.01, 0.003, 0.01]} position={[0.08, 0.007, -0.2]} material={MAT.steel} />
              <B s={[0.09, 0.003, 0.06]} p={[psuX0 + 0.045, H * 0.5, -d / 2 + 0.25]} m={MAT.pcb} />
              <SasCable def={def} />
            </>
          )}
          {is2u && (
            <>
              <B s={[0.004, 0.075, 0.07]} p={[-0.085, 0.042, rz + 0.11]} m={MAT.pcb} />
              <B s={[0.004, 0.075, 0.07]} p={[0.035, 0.042, rz + 0.11]} m={MAT.pcb} />
              <B s={[0.43, 0.003, 0.004]} p={[0, H - 0.004, 0.19]} m={MAT.plastic} />
              {!st.shroudOff && (
                <group onClick={toggleShroud} onPointerOver={(e) => { e.stopPropagation(); useUI.getState().setHover({ title: `${def.id} · Air shroud`, lines: ['Directs airflow over CPUs and DIMMs', 'Click to remove (lid must be off)'] }); }} onPointerOut={() => useUI.getState().setHover(null)}>
                  <mesh geometry={BOX} scale={[0.33, 0.002, 0.16]} position={[-0.035, 0.081, 0.055]} material={MAT.shroud} />
                  <mesh geometry={BOX} scale={[0.002, 0.078, 0.16]} position={[-0.2, 0.042, 0.055]} material={MAT.shroud} />
                  <mesh geometry={BOX} scale={[0.002, 0.078, 0.16]} position={[0.13, 0.042, 0.055]} material={MAT.shroud} />
                  <mesh geometry={BOX} scale={[0.04, 0.004, 0.012]} position={[-0.035, 0.084, 0.12]} material={MAT.touch} />
                </group>
              )}
            </>
          )}
          {def.type === 'server1u' && !st.shroudOff && (
            <group onClick={toggleShroud}>
              <mesh geometry={BOX} scale={[0.2, 0.002, 0.16]} position={[-0.06, 0.04, -0.03]} material={MAT.shroud} />
              <mesh geometry={BOX} scale={[0.03, 0.003, 0.01]} position={[-0.06, 0.042, 0.03]} material={MAT.touch} />
            </group>
          )}
          {isSan && (
            <>
              {/* controller interiors visible from above: cache DIMM + backup battery on each canister */}
              {['ctrlA', 'ctrlB'].map((cid, i) => st.comps[cid].installed ? (
                <group key={cid} position={[0, i === 0 ? 0.0845 : 0.0425, rz + 0.13]}>
                  <B s={[0.06, 0.001, 0.02]} p={[-0.05, 0, 0]} m={MAT.pcb} />
                  <B s={[0.04, 0.001, 0.05]} p={[0.06, 0, 0.02]}><meshStandardMaterial color="#1e40af" /></B>
                </group>
              ) : null)}
            </>
          )}
        </group>
      )}
      <Print id={`${def.id}-f`} w={0.4826} h={H} z={fz + 0.0004} items={frontItems} />
      <Print id={`${def.id}-r`} w={0.434} h={H} z={rz - 0.0004} items={rearItems} rear />
    </group>
  );
}

function SasCable({ def }: { def: DeviceDef }) {
  const geo = useMemo(() => {
    const is2u = def.type === 'server2u';
    const d = def.depth;
    const pts = is2u
      ? [[0.12, 0.03, d / 2 - 0.14], [0.13, 0.012, 0.15], [0.132, 0.012, -0.02], [0.09, 0.02, -0.1], [-0.03, 0.058, d * -0.5 + 0.19]]
      : [[0.1, 0.02, d / 2 - 0.21], [0.12, 0.012, 0.05], [0.05, 0.012, -d / 2 + 0.25]];
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...(p as [number, number, number])))), 32, 0.0025, 6, false);
  }, [def]);
  return <mesh geometry={geo} material={MAT.black} />;
}

function PowerButton({ def, y, z, running, powered }: { def: DeviceDef; y: number; z: number; running: boolean; powered: boolean }) {
  const on = useSim((s) => s.devices[def.id].powerOn);
  return (
    <group
      position={[0.229, y, z]}
      onClick={(e) => { e.stopPropagation(); if (!isClick(e)) return; act(useSim.getState().setPower(def.id, !on), on ? `${def.id}: graceful shutdown initiated` : `${def.id}: power on`); }}
      onPointerOver={(e) => { e.stopPropagation(); useUI.getState().setHover({ title: `${def.id} power button`, lines: [on ? (running ? 'On – click for graceful shutdown' : 'On – not running') : powered ? 'Standby – click to power on' : 'No AC power'], tone: running ? 'ok' : 'info' }); }}
      onPointerOut={() => useUI.getState().setHover(null)}
    >
      <mesh geometry={CYL} rotation-x={Math.PI / 2} scale={[0.0055, 0.004, 0.0055]} position-z={0.002} material={running ? MAT.ledGreen : powered ? MAT.ledAmber : MAT.ledOff} />
      <mesh geometry={CYL} rotation-x={Math.PI / 2} scale={[0.004, 0.005, 0.004]} position-z={0.0025} material={MAT.plastic} />
    </group>
  );
}

export function AllDevices() {
  return <>{Object.values(DEV).map((d) => <Device3D key={d.id} def={d} />)}</>;
}
