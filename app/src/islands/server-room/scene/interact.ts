import { CABLE_INFO, DEV, PORTS, PORT_KIND_NAME, compatibleTypes } from '../../../sim/catalog';
import { DROPS } from '../../../sim/baseline';
import { act, useDerived, useSim, useUI, type Hover } from '../store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ctrl: { current: any } = { current: null };
let downPort: string | null = null;

function release() {
  downPort = null;
  if (ctrl.current) ctrl.current.enabled = true;
  if (useUI.getState().dragging) useUI.setState({ dragging: false });
}
window.addEventListener('pointerup', () => { if (downPort) release(); });

export function dragOrigin() {
  return downPort;
}

export function portDown(pid: string) {
  downPort = pid;
  if (ctrl.current) ctrl.current.enabled = false;
  useUI.setState({ dragging: true });
}

export function portUp(pid: string) {
  const from = downPort;
  release();
  const ui = useUI.getState();
  const sim = useSim.getState();
  const d = useDerived.getState().d;
  const port = PORTS[pid];
  if (from && from !== pid) {
    const c = d.portCable[from];
    const ok = c ? act(sim.moveEnd(c.id, from, pid), 'Cable end moved') : act(sim.connect(from, pid, ui.cablePref, ui.cableColor), 'Cable connected');
    if (ok) useUI.setState({ pending: null, selected: { kind: 'port', dev: port.deviceId, id: pid } });
    return;
  }
  if (ui.pending && ui.pending.from !== pid) {
    const r = ui.pending.cableId ? sim.moveEnd(ui.pending.cableId, ui.pending.from, pid) : sim.connect(ui.pending.from, pid, ui.cablePref, ui.cableColor);
    if (act(r, ui.pending.cableId ? 'Cable end moved' : 'Cable connected')) useUI.setState({ pending: null, selected: { kind: 'port', dev: port.deviceId, id: pid } });
    return;
  }
  if (ui.pending && ui.pending.from === pid) {
    useUI.setState({ pending: null });
    return;
  }
  if (d.portCable[pid]) {
    useUI.setState({ selected: { kind: 'port', dev: port.deviceId, id: pid } });
  } else {
    useUI.setState({ pending: { from: pid }, selected: { kind: 'port', dev: port.deviceId, id: pid } });
    ui.notify(`New cable from ${port.deviceId} ${port.label} – click (or drag to) a compatible port. Esc to cancel.`, 'info');
  }
}

/** Returns null if a pending cable could land here, else reason */
export function landingCheck(pid: string): { ok: boolean; msg: string } | null {
  const ui = useUI.getState();
  const origin = downPort ?? ui.pending?.from;
  if (!origin || origin === pid) return null;
  const d = useDerived.getState().d;
  const sim = useSim.getState();
  const movingCable = ui.pending?.cableId ? sim.cables[ui.pending.cableId] : downPort ? d.portCable[downPort] : undefined;
  const fixed = movingCable ? (movingCable.a === origin ? movingCable.b : movingCable.a) : origin;
  const types = compatibleTypes(PORTS[fixed], PORTS[pid]);
  if (movingCable && !types.includes(movingCable.type)) return { ok: false, msg: `${CABLE_INFO[movingCable.type].name} does not fit ${PORT_KIND_NAME[PORTS[pid].kind]}` };
  if (!types.length) return { ok: false, msg: `Incompatible: ${PORT_KIND_NAME[PORTS[fixed].kind]} → ${PORT_KIND_NAME[PORTS[pid].kind]}` };
  if (d.portCable[pid]) return { ok: false, msg: 'Port occupied' };
  const pref = ui.cablePref;
  const t = movingCable ? movingCable.type : types.includes(pref) ? pref : types.includes('dac') ? 'dac' : types[0];
  return { ok: true, msg: `Connect with ${CABLE_INFO[t].name}` };
}

export function portHover(pid: string): Hover {
  const p = PORTS[pid];
  const d = useDerived.getState().d;
  const sim = useSim.getState();
  const l = d.links[pid];
  const lines: string[] = [PORT_KIND_NAME[p.kind]];
  if (p.role) lines.push(p.role);
  const drop = DROPS[pid];
  if (drop) lines.push(`Drop → ${drop.name}`);
  const cfg = sim.swPorts[pid];
  if (cfg) lines.push(cfg.mode === 'access' ? `access VLAN ${cfg.vlan}` : `trunk native ${cfg.vlan} allowed ${cfg.allowed.join(',') || 'none'}`);
  if (l.kind !== 'none') {
    const c = d.portCable[pid];
    lines.push(`${CABLE_INFO[c.type].name} → ${l.peer}`);
    lines.push(l.up ? `● ${l.kind === 'power' ? 'Energized' : `Link up ${l.speed ?? ''}`}` : `○ ${l.reason}`);
  } else if (['c13', 'c19', 'l530r', 'nema515r'].includes(p.kind)) {
    lines.push(d.outletLive[pid] ? 'Outlet live' : 'Outlet de-energized');
  } else lines.push('Empty');
  const lc = landingCheck(pid);
  if (lc) lines.push((lc.ok ? '✓ ' : '✗ ') + lc.msg);
  return { title: `${p.deviceId} · ${p.label}`, lines, tone: lc ? (lc.ok ? 'ok' : 'bad') : l.up ? 'ok' : 'info' };
}

export function deviceHover(dev: string): Hover {
  const d = useDerived.getState().d;
  const def = DEV[dev];
  return { title: def.name.replace(/\s{2,}/g, ' · '), lines: [def.model, d.devStatus[dev], ...(d.devAlerts[dev] ?? []).slice(0, 3)], tone: d.devAlerts[dev]?.length ? 'bad' : 'info' };
}

export function isClick(e: { delta: number }) {
  return e.delta < 5;
}
