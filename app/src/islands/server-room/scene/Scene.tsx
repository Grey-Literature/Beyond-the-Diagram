import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { anim, useUI } from '../store';
import { PRESETS, type V3 } from './camera';
import { Rack, Room } from './Rack';
import { AllDevices } from './Devices';
import { Cables, PendingCable } from './Cables';
import { ctrl } from './interact';

const ROOM_MIN = new THREE.Vector3(-2.15, 0.1, -2.0);
const ROOM_MAX = new THREE.Vector3(2.15, 2.8, 2.8);

function CameraRig() {
  const { camera, controls } = useThree();
  const fly = useUI((s) => s.fly);
  const keys = useRef<Record<string, boolean>>({});
  useEffect(() => {
    ctrl.current = controls;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = controls as any;
    if (!c) return;
    const stop = () => { if (useUI.getState().fly) useUI.setState({ fly: null }); };
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  }, [controls]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      keys.current[e.key.toLowerCase()] = true;
      if (e.key === 'Escape') useUI.setState({ pending: null, selected: null, ask: null });
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  useFrame((_, dt) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = controls as any;
    if (!c) return;
    if (fly) {
      const tp = new THREE.Vector3(...fly.pos), tt = new THREE.Vector3(...fly.target);
      const k = 1 - Math.exp(-dt * 6);
      camera.position.lerp(tp, k);
      c.target.lerp(tt, k);
      if (camera.position.distanceTo(tp) < 0.003 && c.target.distanceTo(tt) < 0.003) useUI.setState({ fly: null });
    }
    const k = keys.current;
    const move = new THREE.Vector3();
    const fwd = new THREE.Vector3().subVectors(c.target, camera.position).setY(0).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    if (k['w']) move.add(fwd);
    if (k['s']) move.sub(fwd);
    if (k['d']) move.add(right);
    if (k['a']) move.sub(right);
    if (k['e']) move.y += 1;
    if (k['q']) move.y -= 1;
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(dt * (k['shift'] ? 2.2 : 0.9));
      camera.position.add(move);
      c.target.add(move);
      if (fly) useUI.setState({ fly: null });
    }
    c.update();
    // Stay inside the room: walking (or orbiting) through a wall hides the rack behind it.
    camera.position.clamp(ROOM_MIN, ROOM_MAX);
    c.target.clamp(ROOM_MIN, ROOM_MAX);
  });
  return null;
}

export function Scene() {
  return (
    <Canvas
      camera={{ position: PRESETS.front.pos, fov: 50, near: 0.01, far: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onPointerMissed={() => { if (!useUI.getState().pending) useUI.getState().select(null); }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}
    >
      <color attach="background" args={['#cfd3d8']} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#7d8289', 0.9]} />
      <directionalLight position={[2.5, 4, 4]} intensity={1.5} />
      <directionalLight position={[-2, 3.5, -4]} intensity={1.1} />
      <directionalLight position={[3, 2, -1]} intensity={0.4} />
      <pointLight position={[0, 2.6, 1.2]} intensity={2.5} distance={6} decay={1.2} />
      <pointLight position={[0, 2.6, -1.0]} intensity={2.5} distance={6} decay={1.2} />
      <group
        onPointerMove={(e) => { anim.pointer = [e.point.x, e.point.y, e.point.z]; }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          const p = e.point.clone();
          const dir = new THREE.Vector3().subVectors(e.camera.position, p).normalize();
          useUI.getState().flyTo(p.clone().addScaledVector(dir, 0.32).toArray() as V3, p.toArray() as V3);
        }}
      >
        <Room />
        <Rack />
        <AllDevices />
        <Cables />
      </group>
      <PendingCable />
      <OrbitControls makeDefault target={PRESETS.front.target} enableDamping dampingFactor={0.12} minDistance={0.06} maxDistance={5} zoomToCursor zoomSpeed={0.9} panSpeed={0.9} rotateSpeed={0.6} maxPolarAngle={Math.PI * 0.95} />
      <CameraRig />
    </Canvas>
  );
}
