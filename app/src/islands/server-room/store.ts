import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STATE_VERSION, baselineState, scenarioState } from '../../sim/baseline';
import { apply, type Action } from '../../sim/actions';
import { derive, type Derived } from '../../sim/engine';
import type { HostNetCfg, SimState, SwitchPortCfg } from '../../sim/types';

type Result = string | null; // error message or null

// Thin wrapper: every learner action goes through sim/actions.ts's pure
// apply(), so the rules live in one place the test harness can reach.
interface Actions {
  dispatch: (a: Action) => Result;
  loadScenario: (id: string) => void;
  toggleRack: (k: keyof SimState['rack']) => Result;
  setPower: (dev: string, on: boolean) => Result;
  toggleExtend: (dev: string) => Result;
  toggleLid: (dev: string) => Result;
  toggleShroud: (dev: string) => Result;
  setMaintenance: (dev: string, on: boolean) => Result;
  removeComp: (dev: string, comp: string) => Result;
  installComp: (dev: string, comp: string) => Result;
  connect: (a: string, b: string, pref: string, color?: string) => Result;
  moveEnd: (cableId: string, from: string, to: string) => Result;
  disconnect: (cableId: string) => Result;
  replaceCable: (cableId: string) => Result;
  setSwPort: (pid: string, cfg: Partial<SwitchPortCfg>) => Result;
  setSanMap: (h: string, on: boolean) => Result;
  setFwPolicy: (k: string, on: boolean) => Result;
  setFwSubif: (v: number, on: boolean) => Result;
  setHostNet: (h: string, cfg: Partial<HostNetCfg>) => Result;
  setUtility: (on: boolean) => Result;
  setPduBreaker: (id: string, on: boolean) => Result;
  setUpsOutput: (on: boolean) => Result;
  setStripSwitch: (dev: string, on: boolean) => Result;
  tick: (dt: number, mode: string) => void;
}

const simState = (s: SimState): SimState => ({
  version: s.version, scenarioId: s.scenarioId, rack: s.rack, devices: s.devices, cables: s.cables, swPorts: s.swPorts, vlans: s.vlans, sanMap: s.sanMap, fwPolicies: s.fwPolicies, fwSubifs: s.fwSubifs, hostNet: s.hostNet, maintenance: s.maintenance, tieFaults: s.tieFaults, utilityOn: s.utilityOn, upsCharge: s.upsCharge, pduBreaker: s.pduBreaker, events: s.events,
});

export const useSim = create<SimState & Actions>()(
  persist(
    (set, get) => {
      const dispatch = (a: Action): Result => {
        const r = apply(simState(get()), a);
        if (!r.ok) return r.error;
        set(r.state);
        return null;
      };
      return {
        ...baselineState(),
        dispatch,
        loadScenario: (id) => set(scenarioState(id)),
        toggleRack: (key) => dispatch({ type: 'toggleRack', key }),
        setPower: (dev, on) => dispatch({ type: 'setPower', dev, on }),
        toggleExtend: (dev) => dispatch({ type: 'toggleExtend', dev }),
        toggleLid: (dev) => dispatch({ type: 'toggleLid', dev }),
        toggleShroud: (dev) => dispatch({ type: 'toggleShroud', dev }),
        setMaintenance: (dev, on) => dispatch({ type: 'setMaintenance', dev, on }),
        removeComp: (dev, comp) => dispatch({ type: 'removeComp', dev, comp }),
        installComp: (dev, comp) => dispatch({ type: 'installComp', dev, comp }),
        connect: (a, b, pref, color) => dispatch({ type: 'connect', a, b, pref, color }),
        moveEnd: (cableId, from, to) => dispatch({ type: 'moveEnd', cableId, from, to }),
        disconnect: (cableId) => dispatch({ type: 'disconnect', cableId }),
        replaceCable: (cableId) => dispatch({ type: 'replaceCable', cableId }),
        setSwPort: (pid, cfg) => dispatch({ type: 'setSwPort', pid, cfg }),
        setSanMap: (host, on) => dispatch({ type: 'setSanMap', host, on }),
        setFwPolicy: (key, on) => dispatch({ type: 'setFwPolicy', key, on }),
        setFwSubif: (vlan, on) => dispatch({ type: 'setFwSubif', vlan, on }),
        setHostNet: (host, cfg) => dispatch({ type: 'setHostNet', host, cfg }),
        setUtility: (on) => dispatch({ type: 'setUtility', on }),
        setPduBreaker: (pdu, on) => dispatch({ type: 'setPduBreaker', pdu, on }),
        setUpsOutput: (on) => dispatch({ type: 'setUpsOutput', on }),
        setStripSwitch: (dev, on) => dispatch({ type: 'setStripSwitch', dev, on }),
        // Real-time battery drain / recharge — the one piece of state that
        // changes with the clock rather than a learner action.
        tick: (dt, mode) => {
          const s = get();
          const d = useDerived.getState().d;
          if (mode === 'battery') {
            const drainPerSec = 1 / Math.max(30, (d.ups.runtimeMin / Math.max(s.upsCharge, 0.01)) * 60);
            const next = Math.max(0, s.upsCharge - drainPerSec * dt);
            set({ upsCharge: next });
            if (next === 0) set({ events: [...s.events, { t: Date.now(), msg: 'UPS-01 battery exhausted – output dropped', level: 'error' as const }].slice(-60) });
          } else if (mode === 'online' && s.upsCharge < 1) {
            set({ upsCharge: Math.min(1, s.upsCharge + 0.004 * dt) });
          }
        },
      };
    },
    {
      name: 'btd:sim:server-room',
      version: STATE_VERSION,
      migrate: () => baselineState() as never,
      partialize: (s) => simState(s),
    },
  ),
);

// ---------------- derived state ----------------
export const useDerived = create<{ d: Derived }>(() => ({ d: derive(simState(useSim.getState())) }));
// Recompute once per burst of state changes. A microtask, not
// requestAnimationFrame: rAF pauses in background tabs, which left status
// panels showing stale health until the tab was painted again.
let pending = false;
useSim.subscribe(() => {
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    useDerived.setState({ d: derive(simState(useSim.getState())) });
  });
});
// compute once after rehydration
setTimeout(() => useDerived.setState({ d: derive(simState(useSim.getState())) }), 0);

// ---------------- UI state ----------------
export type Selection =
  | { kind: 'device'; dev: string }
  | { kind: 'port'; dev: string; id: string }
  | { kind: 'cable'; id: string }
  | { kind: 'comp'; dev: string; id: string }
  | null;

export interface Hover { title: string; lines?: string[]; tone?: 'ok' | 'bad' | 'info' }

interface UIState {
  selected: Selection;
  hover: Hover | null;
  pending: { from: string; cableId?: string } | null;
  dragging: boolean;
  cablePref: string;
  cableColor: string;
  fly: { pos: [number, number, number]; target: [number, number, number] } | null;
  toast: { msg: string; tone: 'ok' | 'bad' | 'info'; t: number } | null;
  /** In-app confirmation. Native confirm() is blocked in embedded browsers (it returns false without showing anything). */
  ask: { msg: string; yes: string; onYes: () => void } | null;
  /** Rack list shown even with nothing selected. Selecting anything shows the Inspector regardless. */
  inspectorOpen: boolean;
  select: (s: Selection) => void;
  setHover: (h: Hover | null) => void;
  flyTo: (pos: [number, number, number], target: [number, number, number]) => void;
  notify: (msg: string, tone?: 'ok' | 'bad' | 'info') => void;
}
/** On a narrow screen (or the desktop app's browser pane) the side panels start collapsed so the rack is visible. */
export const WIDE = typeof window === 'undefined' || window.innerWidth >= 1100;

export const useUI = create<UIState>((set) => ({
  selected: null,
  hover: null,
  pending: null,
  dragging: false,
  cablePref: 'auto',
  cableColor: '#2563eb',
  fly: null,
  toast: null,
  ask: null,
  inspectorOpen: WIDE,
  select: (selected) => set({ selected }),
  setHover: (hover) => set({ hover }),
  flyTo: (pos, target) => set({ fly: { pos, target } }),
  notify: (msg, tone = 'info') => set({ toast: { msg, tone, t: Date.now() } }),
}));

/** Ask before doing something destructive, via the in-app confirm bar. */
export function askFirst(msg: string, yes: string, onYes: () => void) {
  useUI.setState({ ask: { msg, yes, onYes } });
}

/** run an action that may return an error and surface it */
export function act(r: Result, okMsg?: string) {
  if (r) useUI.getState().notify(r, 'bad');
  else if (okMsg) useUI.getState().notify(okMsg, 'ok');
  return !r;
}

// shared mutable animation values (read in useFrame)
export const anim = { ext: {} as Record<string, number>, pointer: null as null | [number, number, number] };
