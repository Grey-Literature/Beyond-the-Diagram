// Every change a learner can make to the world, as a pure function:
// apply(state, action) -> new state, or a human-readable refusal. The
// zustand store in the island is a thin wrapper around this, and the
// scenario test harness drives it directly with no React or three.js.
import { CABLE_INFO, DEV, PORTS, TIES, compatibleTypes, portSide, rackSide, tieKey } from './catalog';
import { newCableId } from './baseline';
import { derive, type Derived } from './engine';
import type { Airflow, Cable, HostNetCfg, SimState, SwitchPortCfg } from './types';

type RackKey = keyof SimState['rack'];

export type Action =
  | { type: 'toggleRack'; key: RackKey }
  | { type: 'setPower'; dev: string; on: boolean }
  | { type: 'toggleExtend'; dev: string }
  | { type: 'toggleLid'; dev: string }
  | { type: 'toggleShroud'; dev: string }
  | { type: 'setMaintenance'; dev: string; on: boolean }
  | { type: 'removeComp'; dev: string; comp: string }
  | { type: 'installComp'; dev: string; comp: string }
  | { type: 'connect'; a: string; b: string; pref?: string; color?: string }
  | { type: 'moveEnd'; cableId: string; from: string; to: string }
  | { type: 'disconnect'; cableId: string }
  | { type: 'replaceCable'; cableId: string }
  | { type: 'setSwPort'; pid: string; cfg: Partial<SwitchPortCfg> }
  | { type: 'setSanMap'; host: string; on: boolean }
  | { type: 'setFwPolicy'; key: string; on: boolean }
  | { type: 'setFwSubif'; vlan: number; on: boolean }
  | { type: 'setHostNet'; host: string; cfg: Partial<HostNetCfg> }
  | { type: 'setUtility'; on: boolean }
  | { type: 'setPduBreaker'; pdu: string; on: boolean }
  | { type: 'setUpsOutput'; on: boolean }
  | { type: 'setStripSwitch'; dev: string; on: boolean }
  | { type: 'swapAirflowKit'; dev: string; airflow: Airflow }
  | { type: 'reterminateTie'; port: string };

export type Result = { ok: true; state: SimState } | { ok: false; error: string };

const MAX_EVENTS = 60;

function portAccess(s: SimState, pid: string): string | null {
  const p = PORTS[pid];
  const d = DEV[p.deviceId];
  const side = portSide(p);
  if (side === 'front' && !s.rack.frontDoorOpen) return 'Front rack door is closed';
  if (side === 'rear' && !s.rack.rearDoorOpen) return 'Rear rack door is closed';
  if (p.comp && !s.devices[d.id].comps[p.comp]?.installed) return `${p.comp.toUpperCase()} is not installed – no port there`;
  return null;
}

function validateEnd(s: SimState, pid: string, ignoreCable?: string): string | null {
  const occ = Object.values(s.cables).find((c) => (c.a === pid || c.b === pid) && c.id !== ignoreCable);
  if (occ) return `${PORTS[pid].deviceId} ${PORTS[pid].label} is already occupied`;
  return portAccess(s, pid);
}

function compAccess(s: SimState, d: Derived, dev: string, comp: string, removing: boolean): string | null {
  const def = DEV[dev];
  const c = def.comps.find((x) => x.id === comp);
  if (!c) return `${dev} has no component ${comp}`;
  const st = s.devices[dev];
  const running = st.powerOn && d.devPowered[dev];
  const side = c.access === 'internal' ? null : rackSide(def, c.access);
  if (side === 'front' && !s.rack.frontDoorOpen) return 'Open the front rack door first';
  if (side === 'rear' && !s.rack.rearDoorOpen) return 'Open the rear rack door first';
  if (c.access === 'internal') {
    if (!st.extended) return 'Extend the chassis on its rails first';
    if (!st.lidOff) return 'Remove the top cover first';
    if (c.needsShroudOff && !st.shroudOff) return 'Remove the air shroud first';
  }
  if (!c.hotSwap && running && (def.type === 'server2u' || def.type === 'server1u')) return `${c.label} is not hot-swappable – shut the server down first`;
  if (removing) {
    const cabled = def.ports.filter((p) => p.comp === comp && d.portCable[p.id]);
    if (cabled.length) return `Disconnect ${cabled.map((p) => p.label).join(', ')} first`;
  }
  return null;
}

/** VMs currently running on a host, per the derived state. */
function vmsOn(d: Derived, host: string): string[] {
  return Object.entries(d.vms).filter(([, v]) => v.host === host).map(([id]) => id);
}

export function apply(prev: SimState, a: Action): Result {
  const d = derive(prev);
  const s: SimState = structuredClone(prev);
  const log = (msg: string, level: 'info' | 'warn' | 'error' = 'info') => s.events.push({ t: Date.now(), msg, level });
  const fail = (error: string): Result => ({ ok: false, error });

  switch (a.type) {
    case 'toggleRack': {
      if (a.key === 'frontDoorOpen' && s.rack.frontDoorOpen && Object.values(s.devices).some((x) => x.extended)) return fail('A chassis is extended – slide it back in before closing the front door');
      s.rack[a.key] = !s.rack[a.key];
      break;
    }
    case 'setPower': {
      if (!s.rack.frontDoorOpen && DEV[a.dev].serviceable) return fail('Front door closed – cannot reach power button');
      const hosted = a.on ? [] : vmsOn(d, a.dev);
      s.devices[a.dev].powerOn = a.on;
      if (hosted.length && !s.maintenance[a.dev]) log(`${a.dev} shut down while still hosting ${hosted.join(', ')} – unplanned failover`, 'warn');
      else log(`${a.dev} ${a.on ? 'powered on' : 'shut down gracefully'}`);
      break;
    }
    case 'toggleExtend': {
      const st = s.devices[a.dev];
      if (!s.rack.frontDoorOpen) return fail('Open the front rack door first');
      if (st.extended && st.lidOff) return fail('Refit the top cover before sliding the chassis back in');
      st.extended = !st.extended;
      break;
    }
    case 'toggleLid': {
      const st = s.devices[a.dev];
      if (!st.extended) return fail('Extend the chassis on its rails first');
      if (st.lidOff && st.shroudOff && DEV[a.dev].type !== 'san') return fail('Refit the air shroud before closing the cover');
      st.lidOff = !st.lidOff;
      if (st.lidOff && st.powerOn) log(`${a.dev}: chassis intrusion detected`, 'warn');
      break;
    }
    case 'toggleShroud': {
      const st = s.devices[a.dev];
      if (!st.lidOff) return fail('Remove the top cover first');
      st.shroudOff = !st.shroudOff;
      break;
    }
    case 'setMaintenance': {
      const def = DEV[a.dev];
      if (def.type !== 'server2u') return fail(`${a.dev} is not a cluster node`);
      if (a.on) {
        const hosted = vmsOn(d, a.dev);
        const others = Object.keys(d.cluster.nodes).filter((h) => h !== a.dev && d.cluster.nodes[h].inQuorum && d.paths[h] > 0 && !s.maintenance[h]);
        if (hosted.length && !others.length) return fail(`Drain failed: no other node can take ${hosted.join(', ')}`);
        s.maintenance[a.dev] = true;
        log(hosted.length ? `${a.dev} paused and drained – ${hosted.join(', ')} live-migrated` : `${a.dev} paused (no VMs to move)`);
      } else {
        s.maintenance[a.dev] = false;
        log(`${a.dev} resumed – available for VM placement`);
      }
      break;
    }
    case 'removeComp': {
      const err = compAccess(s, d, a.dev, a.comp, true);
      if (err) return fail(err);
      const label = DEV[a.dev].comps.find((c) => c.id === a.comp)!.label;
      s.devices[a.dev].comps[a.comp] = { installed: false, failed: false };
      log(`${a.dev}: ${label} removed`);
      break;
    }
    case 'installComp': {
      const err = compAccess(s, d, a.dev, a.comp, false);
      if (err) return fail(err);
      if (s.devices[a.dev].comps[a.comp].installed) return fail('Slot is already occupied – remove the part first');
      const label = DEV[a.dev].comps.find((c) => c.id === a.comp)!.label;
      s.devices[a.dev].comps[a.comp] = { installed: true, failed: false };
      log(`${a.dev}: new ${label} installed from spares`);
      break;
    }
    case 'connect': {
      if (a.a === a.b) return fail('Same port');
      const pa = PORTS[a.a], pb = PORTS[a.b];
      if (!pa || !pb) return fail('Unknown port');
      const types = compatibleTypes(pa, pb);
      if (!types.length) return fail(`No cable exists that joins ${pa.kind.toUpperCase()} to ${pb.kind.toUpperCase()}`);
      const e = validateEnd(s, a.a) ?? validateEnd(s, a.b);
      if (e) return fail(e);
      if (pa.deviceId === pb.deviceId && DEV[pa.deviceId].type !== 'switch') return fail('Looping a device back to itself is not a valid connection');
      const pref = a.pref ?? 'auto';
      let type = types.includes(pref) ? pref : types[0];
      if (pref === 'auto' && types.includes('dac') && pa.kind === 'sfp' && pb.kind === 'sfp') type = 'dac';
      const cable: Cable = { id: newCableId(), a: a.a, b: a.b, type: type as Cable['type'], color: a.color && type === 'cat6' ? a.color : CABLE_INFO[type].color };
      s.cables[cable.id] = cable;
      log(`Connected ${a.a} ↔ ${a.b} (${CABLE_INFO[type].name})`);
      break;
    }
    case 'moveEnd': {
      const c = s.cables[a.cableId];
      if (!c) return fail('Cable not found');
      const fixed = c.a === a.from ? c.b : c.a;
      if (a.to === fixed) return fail('Both ends cannot go in the same port');
      const types = compatibleTypes(PORTS[fixed], PORTS[a.to]);
      if (!types.includes(c.type)) return fail(`A ${CABLE_INFO[c.type].name} cannot terminate on a ${PORTS[a.to].kind.toUpperCase()} port`);
      const e = validateEnd(s, a.to, a.cableId);
      if (e) return fail(e);
      if (c.a === a.from) c.a = a.to;
      else c.b = a.to;
      log(`Moved cable end ${a.from} → ${a.to}`);
      break;
    }
    case 'disconnect': {
      const c = s.cables[a.cableId];
      if (!c) return fail('Cable not found');
      const e = portAccess(s, c.a) ?? portAccess(s, c.b);
      if (e) return fail(e);
      delete s.cables[a.cableId];
      log(`Removed cable ${c.a} ↔ ${c.b}`);
      break;
    }
    case 'replaceCable': {
      const c = s.cables[a.cableId];
      if (!c) return fail('Cable not found');
      const e = portAccess(s, c.a) ?? portAccess(s, c.b);
      if (e) return fail(e);
      c.faulty = false;
      log(`Replaced cable ${c.a} ↔ ${c.b} with new stock`);
      break;
    }
    case 'setSwPort': {
      const cur = s.swPorts[a.pid];
      if (!cur) return fail(`${a.pid} is not a configurable switchport`);
      const next = { ...cur, ...a.cfg };
      if (a.cfg.enabled === false) next.errDisabled = false;
      s.swPorts[a.pid] = next;
      log(`${a.pid}: ${Object.entries(a.cfg).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`).join(' ')}`);
      break;
    }
    case 'setSanMap':
      s.sanMap[a.host] = a.on;
      log(`SAN-01: ${a.host} initiator ${a.on ? 'added to' : 'removed from'} host access list`);
      break;
    case 'setFwPolicy':
      s.fwPolicies[a.key] = a.on;
      log(`FW-01: policy ${a.key} ${a.on ? 'enabled' : 'disabled'}`);
      break;
    case 'setFwSubif':
      s.fwSubifs = a.on ? [...new Set([...s.fwSubifs, a.vlan])].sort((x, y) => x - y) : s.fwSubifs.filter((x) => x !== a.vlan);
      log(`FW-01: sub-interface VLAN ${a.vlan} ${a.on ? 'added' : 'removed'}`);
      break;
    case 'setHostNet':
      s.hostNet[a.host] = { ...s.hostNet[a.host], ...a.cfg };
      log(`${a.host}: host networking changed (${Object.entries(a.cfg).map(([k, v]) => `${k}=${v ?? 'untagged'}`).join(' ')})`);
      break;
    case 'setUtility':
      s.utilityOn = a.on;
      log(`Breaker CKT 14 switched ${a.on ? 'ON' : 'OFF'}`, a.on ? 'info' : 'warn');
      break;
    case 'setPduBreaker':
      s.pduBreaker[a.pdu] = a.on;
      log(`${a.pdu}: branch breaker ${a.on ? 'closed' : 'opened'}`, a.on ? 'info' : 'warn');
      break;
    case 'setStripSwitch':
      if (DEV[a.dev]?.type !== 'strip') return fail(`${a.dev} is not a power strip`);
      s.devices[a.dev].powerOn = a.on;
      log(`${a.dev}: rocker switch ${a.on ? 'ON' : 'OFF'}`, a.on ? 'info' : 'warn');
      break;
    case 'swapAirflowKit': {
      const def = DEV[a.dev];
      if (!def?.airflow) return fail(`${a.dev} has no swappable airflow kit`);
      // The fan/PSU modules come out of the device's back, whichever way it faces.
      const side = rackSide(def, 'rear');
      if (side === 'front' && !s.rack.frontDoorOpen) return fail('Open the front rack door first');
      if (side === 'rear' && !s.rack.rearDoorOpen) return fail('Open the rear rack door first');
      s.devices[a.dev].airflow = a.airflow;
      log(`${a.dev}: fan/PSU modules swapped for ${a.airflow === 'b2f' ? 'port-side exhaust' : 'port-side intake'} airflow kit`);
      break;
    }
    case 'reterminateTie': {
      if (!TIES[a.port]) return fail(`${a.port} is not a tie-panel port`);
      if (!s.rack.rearDoorOpen) return fail('Open the rear rack door to reach the tie-panel punch-downs');
      const key = tieKey(a.port);
      delete s.tieFaults[key];
      log(`Tie link ${key.replace('TP-R:', '')} re-terminated (punched down again at both panels)`);
      break;
    }
    case 'setUpsOutput':
      s.devices['UPS-01'].powerOn = a.on;
      log(`UPS-01 output switched ${a.on ? 'ON' : 'OFF'}`, a.on ? 'info' : 'warn');
      break;
  }
  s.events = s.events.slice(-MAX_EVENTS);
  return { ok: true, state: s };
}
