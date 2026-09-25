import { DEV, DEVICES, PORTS, STACK_MEMBERS, TIES, rackSide, tieKey } from './catalog';
import { DROPS, VMS } from './baseline';
import type { Cable, DeviceDef, PortDef, SimState } from './types';

export interface LinkInfo { up: boolean; reason: string; speed?: string; peer?: string; cable?: string; kind: 'data' | 'power' | 'none' }
export interface Check { id: string; group: string; label: string; status: 'ok' | 'warn' | 'fail'; detail: string; focus?: string }
export interface VmInfo { host: string | null; reachable: boolean; reason: string }
export interface Derived {
  portCable: Record<string, Cable>;
  links: Record<string, LinkInfo>;
  outletLive: Record<string, boolean>;
  inletLive: Record<string, boolean>;
  devPowered: Record<string, boolean>;
  devRunning: Record<string, boolean>;
  devStatus: Record<string, string>;
  devAlerts: Record<string, string[]>;
  ups: { mode: 'online' | 'battery' | 'off'; runtimeMin: number; loadW: number; ebm: boolean; inputLive: boolean };
  pduLive: Record<string, boolean>;
  pduLoadA: Record<string, number>;
  stack: { formed: boolean; links: number };
  /** Air temperature at each running device's intake, °C. */
  inletC: Record<string, number>;
  coldAisleC: number;
  hotAisleC: number;
  internet: boolean;
  internetReason: string;
  paths: Record<string, number>;
  san: { raid: string; failed: number; ctrls: number; online: boolean };
  cluster: { nodes: Record<string, { up: boolean; inQuorum: boolean }>; quorum: boolean; clusterNet: boolean; comm: boolean; witness: boolean; summary: string };
  vms: Record<string, VmInfo>;
  checks: Check[];
  leds: Record<string, 'green' | 'amber' | 'off'>;
  segs: Record<string, string[]>; // attachment id -> segments (debug / inspector)
}

const WATTS: Record<string, number> = { server2u: 380, server1u: 120, san: 320, switch: 90, firewall: 60, isp: 12, dumbswitch: 5 };

// Connector kinds that feed power into a device, and that deliver it out.
const INLETS = ['c14', 'c20', 'dc'];
const OUTLETS = ['c13', 'c19', 'l530r', 'nema515r'];

function uf() {
  const parent: Record<string, string> = {};
  const find = (k: string): string => { if (parent[k] === undefined) parent[k] = k; while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; };
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  return { find, union };
}

export function derive(s: SimState): Derived {
  const portCable: Record<string, Cable> = {};
  Object.values(s.cables).forEach((c) => { portCable[c.a] = c; portCable[c.b] = c; });
  const other = (c: Cable, pid: string) => (c.a === pid ? c.b : c.a);
  const compOk = (dev: string, comp?: string) => { if (!comp) return true; const c = s.devices[dev]?.comps[comp]; return !!c && c.installed && !c.failed; };
  const compPresent = (dev: string, comp?: string) => { if (!comp) return true; return !!s.devices[dev]?.comps[comp]?.installed; };

  // ---------------- power ----------------
  const outletLive: Record<string, boolean> = {};
  const inletLive: Record<string, boolean> = {};
  const pduLive: Record<string, boolean> = { 'PDU-A': false, 'PDU-B': false };
  outletLive['DEMARC:UTILITY'] = s.utilityOn;
  const upsIn = portCable['UPS-01:INPUT'];
  const upsInputLive = !!upsIn && !upsIn.faulty && outletLive[other(upsIn, 'UPS-01:INPUT')] === true;
  const ebmCable = portCable['UPS-01:EBM'];
  const ebm = !!ebmCable && other(ebmCable, 'UPS-01:EBM') === 'EBM-01:EBM';
  const battOk = compOk('UPS-01', 'battery');
  const upsOn = s.devices['UPS-01'].powerOn !== false;
  let upsMode: 'online' | 'battery' | 'off' = 'off';
  if (upsOn) upsMode = upsInputLive ? 'online' : battOk && s.upsCharge > 0.002 ? 'battery' : 'off';
  DEV['UPS-01'].ports.forEach((p) => { if (p.kind === 'c13' || p.kind === 'c19') outletLive[p.id] = upsMode !== 'off'; });
  for (const id of ['PDU-A', 'PDU-B']) {
    const c = portCable[`${id}:INLET`];
    const live = !!c && !c.faulty && outletLive[other(c, `${id}:INLET`)] === true && s.pduBreaker[id] !== false;
    pduLive[id] = live;
    DEV[id].ports.forEach((p) => { if (p.kind === 'c13') outletLive[p.id] = live; });
  }
  // Power strips: live outlets only if the strip is fed AND its rocker switch is on.
  // Two passes so a strip plugged into another strip (daisy-chained) still resolves.
  const strips = DEVICES.filter((d) => d.type === 'strip');
  const stripFed: Record<string, boolean> = {};
  for (let pass = 0; pass < 2; pass++) {
    strips.forEach((d) => {
      const c = portCable[`${d.id}:INLET`];
      stripFed[d.id] = !!c && !c.faulty && outletLive[other(c, `${d.id}:INLET`)] === true;
      const live = stripFed[d.id] && s.devices[d.id].powerOn;
      d.ports.forEach((p) => { if (p.kind === 'nema515r') outletLive[p.id] = live; });
    });
  }
  const devPowered: Record<string, boolean> = {};
  const psuFed: Record<string, boolean> = {};
  DEVICES.forEach((d) => {
    const inlets = d.ports.filter((p) => INLETS.includes(p.kind));
    let any = false;
    inlets.forEach((p) => {
      const c = portCable[p.id];
      const fed = !!c && !c.faulty && outletLive[other(c, p.id)] === true;
      inletLive[p.id] = fed;
      psuFed[p.id] = fed && compOk(d.id, p.comp);
      if (psuFed[p.id]) any = true;
    });
    devPowered[d.id] = d.type === 'pdu' ? pduLive[d.id] : d.type === 'ups' ? upsMode !== 'off' || upsInputLive : d.type === 'strip' ? stripFed[d.id] : any;
  });

  // ---------------- device running / alerts ----------------
  const devRunning: Record<string, boolean> = {};
  const devStatus: Record<string, string> = {};
  const devAlerts: Record<string, string[]> = {};
  DEVICES.forEach((d) => {
    const st = s.devices[d.id];
    const alerts: string[] = [];
    const cs = st.comps;
    d.comps.forEach((c) => {
      const x = cs[c.id];
      if (x?.installed && x.failed) alerts.push(`${c.label}: FAILED`);
    });
    const psuPorts = d.ports.filter((p) => p.kind === 'c14');
    if (psuPorts.length >= 2 && devPowered[d.id]) {
      psuPorts.forEach((p) => {
        if (!compPresent(d.id, p.comp)) alerts.push(`${p.label}: not installed`);
        else if (!inletLive[p.id]) alerts.push(`${p.label}: no AC input`);
      });
    }
    let running = false;
    let status = '';
    if (['patch', 'tiepanel', 'cablemgr', 'blank', 'wallpanel', 'ebm', 'shelf'].includes(d.type)) { running = true; status = 'Passive'; }
    else if (d.type === 'strip') { running = stripFed[d.id] && st.powerOn; status = !stripFed[d.id] ? 'Cord not getting power' : st.powerOn ? 'Switch ON' : 'Switch OFF'; }
    else if (d.type === 'pdu') { running = pduLive[d.id]; status = running ? 'Energized' : 'No input power'; }
    else if (d.type === 'ups') { running = upsMode !== 'off'; status = upsMode === 'online' ? 'Online' : upsMode === 'battery' ? 'ON BATTERY' : 'Output off'; if (!battOk) alerts.push('Battery module fault / missing'); if (!ebm) alerts.push('External battery module not detected'); }
    else if (!devPowered[d.id]) { status = 'No power'; }
    else if (!st.powerOn) { status = d.serviceable ? 'Standby (BMC on aux power)' : 'Off'; }
    else if (d.type === 'server2u' || d.type === 'server1u') {
      const bankA = d.comps.filter((c) => c.id.startsWith('dimmA'));
      const fans = d.comps.filter((c) => c.kind === 'fan');
      const fansBad = fans.filter((c) => !compOk(d.id, c.id)).length;
      if (!compOk(d.id, 'cpu1')) status = 'POST halted: CPU1 not detected';
      else if (!bankA.some((c) => compOk(d.id, c.id))) status = 'POST halted: no memory on CPU1 channels';
      else if (!compOk(d.id, 'raid')) status = 'No boot device: storage controller not found';
      else if (d.type === 'server2u' && !compOk(d.id, 'drive0') && !compOk(d.id, 'drive1')) status = 'No boot device: boot volume missing';
      else if (fansBad >= 3) status = 'Thermal shutdown: insufficient cooling';
      else { running = true; status = 'Running'; }
      if (d.type === 'server2u') {
        if (compOk(d.id, 'drive0') !== compOk(d.id, 'drive1')) alerts.push('Boot RAID-1 degraded');
        const bankB = d.comps.filter((c) => c.id.startsWith('dimmB'));
        if (!compPresent(d.id, 'cpu2') && bankB.some((c) => compPresent(d.id, c.id))) alerts.push('DIMMs on CPU2 channels unusable: CPU2 missing');
      }
      if (fansBad > 0 && fansBad < 3) alerts.push(`${fansBad} fan(s) failed/missing – fan redundancy lost`);
      if (st.lidOff) alerts.push('Chassis intrusion: cover removed');
    } else if (d.type === 'san') {
      const ctrls = ['ctrlA', 'ctrlB'].filter((c) => compOk(d.id, c)).length;
      running = ctrls > 0;
      status = running ? (ctrls === 2 ? 'Online (dual controller)' : 'Online (single controller)') : 'No controller';
      if (st.lidOff) alerts.push('Enclosure cover removed');
    } else { running = true; status = 'Running'; }
    devRunning[d.id] = running;
    devStatus[d.id] = status;
    devAlerts[d.id] = alerts;
  });

  // ---------------- UPS / load ----------------
  let loadW = 0;
  const pduLoadA: Record<string, number> = { 'PDU-A': 0, 'PDU-B': 0 };
  DEVICES.forEach((d) => {
    const w = WATTS[d.type];
    if (!w || !devPowered[d.id]) return;
    const actual = devRunning[d.id] ? w : w * 0.08;
    loadW += actual;
    const fedPorts = d.ports.filter((p) => psuFed[p.id]);
    fedPorts.forEach((p) => { const c = portCable[p.id]; const pd = other(c, p.id).split(':')[0]; if (pduLoadA[pd] !== undefined) pduLoadA[pd] += actual / fedPorts.length / 120; });
  });
  const runtimeMin = s.upsCharge * (ebm ? 48 : 14) * (1100 / Math.max(loadW, 250));

  // ---------------- links ----------------
  const links: Record<string, LinkInfo> = {};
  const isSwitch = (p: PortDef) => DEV[p.deviceId].type === 'switch';
  const portActive = (p: PortDef): string | null => {
    const d = DEV[p.deviceId];
    if (d.type === 'patch' || d.type === 'tiepanel') return null;
    if (!compPresent(d.id, p.comp)) return `${p.comp} not installed`;
    if (!compOk(d.id, p.comp)) return 'adapter failed';
    if (p.name === 'BMC' || p.name === 'NMC') return devPowered[d.id] ? null : 'no power';
    if (!devRunning[d.id]) return devPowered[d.id] ? 'device not running' : 'no power';
    if (isSwitch(p)) { const cfg = s.swPorts[p.id]; if (cfg && !cfg.enabled) return 'administratively down'; if (cfg?.errDisabled) return 'err-disabled (port-security violation)'; }
    return null;
  };
  // A data "circuit" is everything between two real endpoints: usually one
  // cable, but a run through the tie panels is patch cord -> permanent tie
  // link -> patch cord. Link state is decided end to end, and every port on
  // the way reports the same result.
  const walk = (start: string, via: Cable) => {
    const chain = [via];
    let pid = start;
    let tieBroken = false;
    for (let hop = 0; hop < 8 && TIES[pid]; hop++) {
      if (s.tieFaults[tieKey(pid)]) tieBroken = true;
      const partner = TIES[pid];
      const next = portCable[partner];
      if (!next) return { term: partner, open: true, chain, tieBroken };
      chain.push(next);
      pid = other(next, partner);
    }
    return { term: pid, open: false, chain, tieBroken };
  };
  const evalData = (pa: PortDef, pb: PortDef, type: Cable['type'], faulty: boolean, cable: string): LinkInfo => {
    const info: LinkInfo = { up: false, reason: '', kind: 'data', cable };
    const kinds = [pa.kind, pb.kind];
    const ks = kinds.includes('keystone');
    const actA = portActive(pa), actB = portActive(pb);
    if (faulty) info.reason = type === 'om4' || type === 'os2sc' ? 'No light received (Rx < -30 dBm)' : 'No carrier';
    else if (kinds.includes('console')) info.reason = kinds[0] === kinds[1] ? 'Serial console session (no Ethernet link)' : 'Console port is RS-232, not Ethernet';
    else if (ks && kinds[0] === kinds[1]) info.reason = 'Patch panel to patch panel – no active device';
    else if (ks) {
      const kp = pa.kind === 'keystone' ? pa : pb;
      const ap = kp === pa ? pb : pa;
      const drop = DROPS[kp.id];
      const act = portActive(ap);
      if (!drop) info.reason = 'No device on this drop';
      else if (act) info.reason = act;
      else if (drop.poe && !(ap.poe && isSwitch(ap))) info.reason = 'Endpoint unpowered (needs PoE)';
      else return { up: true, reason: 'Link up', speed: drop.kind === 'phone' ? '100M' : '1G', kind: 'data', cable };
    } else if (actA) info.reason = `${pa.deviceId}: ${actA}`;
    else if (actB) info.reason = `${pb.deviceId}: ${actB}`;
    else {
      const speed = type === 'dac' || type === 'om4' ? '10G' : type === 'stack' ? 'Stack 40G' : type === 'os2sc' ? 'GPON' : '1G';
      return { up: true, reason: 'Link up', speed, kind: 'data', cable };
    }
    return info;
  };
  const seen = new Set<string>();
  Object.values(s.cables).forEach((c) => {
    const pa = PORTS[c.a], pb = PORTS[c.b];
    if (!pa || !pb || seen.has(c.id)) return;
    if (['pwr13', 'pwr19', 'pwr530', 'brick'].includes(c.type)) {
      const out = OUTLETS.includes(pa.kind) ? pa : pb;
      const live = outletLive[out.id] === true && !c.faulty;
      const info: LinkInfo = { up: live, reason: live ? 'Energized' : 'No voltage from source', kind: 'power', cable: c.id };
      links[c.a] = { ...info, peer: c.b };
      links[c.b] = { ...info, peer: c.a };
      return;
    }
    if (c.type === 'ebm') {
      const info: LinkInfo = { up: true, reason: 'Battery string connected', kind: 'power', cable: c.id };
      links[c.a] = { ...info, peer: c.b };
      links[c.b] = { ...info, peer: c.a };
      return;
    }
    const left = walk(c.a, c), right = walk(c.b, c);
    const chain = [...new Set([...left.chain, ...right.chain])];
    chain.forEach((x) => seen.add(x.id));
    const open = left.open ? left.term : right.open ? right.term : null;
    const info: LinkInfo = open
      ? { up: false, reason: `Nothing patched on ${open.replace(':', ' ')} – open circuit`, kind: 'data', cable: c.id }
      : left.tieBroken || right.tieBroken
        ? { up: false, reason: 'No carrier', kind: 'data', cable: c.id }
        : evalData(PORTS[left.term], PORTS[right.term], c.type, chain.some((x) => x.faulty), c.id);
    // Every port on the circuit reports the circuit; the real endpoints see each other as peers.
    chain.forEach((x) => { links[x.a] = { ...info, peer: x.b }; links[x.b] = { ...info, peer: x.a }; });
    if (!open) {
      links[left.term] = { ...info, peer: right.term };
      links[right.term] = { ...info, peer: left.term };
    }
  });
  const leds: Record<string, 'green' | 'amber' | 'off'> = {};
  Object.values(PORTS).forEach((p) => {
    if (!links[p.id]) links[p.id] = { up: false, reason: 'No cable connected', kind: 'none' };
    const cfg = s.swPorts[p.id];
    leds[p.id] = links[p.id].up && links[p.id].kind === 'data' ? 'green' : cfg?.errDisabled ? 'amber' : 'off';
  });

  // ---------------- L2 fabric ----------------
  const stackCables = Object.values(s.cables).filter((c) => c.type === 'stack' && PORTS[c.a].deviceId !== PORTS[c.b].deviceId && links[c.a].up);
  const stackFormed = stackCables.length > 0;
  const dom = (dev: string) => (stackFormed && STACK_MEMBERS.includes(dev) ? 'STACK' : dev);
  const U = uf();
  const segOf = (swPort: string, tag: number | null): string | null => {
    const cfg = s.swPorts[swPort];
    if (!cfg) return null;
    const d = dom(PORTS[swPort].deviceId);
    if (tag != null) return cfg.mode === 'trunk' && (cfg.allowed.includes(tag) || tag === cfg.vlan) ? `${d}:${tag}` : null;
    return `${d}:${cfg.vlan}`;
  };
  // inter-switch links
  Object.values(s.cables).forEach((c) => {
    const pa = PORTS[c.a], pb = PORTS[c.b];
    if (!links[c.a].up || !isSwitch(pa) || !isSwitch(pb)) return;
    const ca = s.swPorts[c.a], cb = s.swPorts[c.b];
    if (!ca || !cb) return;
    const da = dom(pa.deviceId), db = dom(pb.deviceId);
    U.union(`${da}:${ca.vlan}`, `${db}:${cb.vlan}`);
    if (ca.mode === 'trunk' && cb.mode === 'trunk') ca.allowed.filter((v) => cb.allowed.includes(v)).forEach((v) => U.union(`${da}:${v}`, `${db}:${v}`));
  });
  // An unmanaged switch is one flat, untagged segment: it simply joins
  // whatever access VLAN its uplink lands in.
  const isDumb = (p: PortDef) => DEV[p.deviceId].type === 'dumbswitch';
  Object.values(s.cables).forEach((c) => {
    const pa = PORTS[c.a], pb = PORTS[c.b];
    if (!links[c.a].up) return;
    [[pa, pb], [pb, pa]].forEach(([d, o]) => {
      if (!isDumb(d)) return;
      if (isSwitch(o)) { const seg = segOf(o.id, null); if (seg) U.union(`dumb:${d.deviceId}`, seg); }
      else if (isDumb(o)) U.union(`dumb:${d.deviceId}`, `dumb:${o.deviceId}`);
    });
  });
  const peerSeg = (peer: PortDef, cable: string | undefined, tag: number | null): string | null =>
    isSwitch(peer) ? segOf(peer.id, tag) : isDumb(peer) ? (tag == null ? `dumb:${peer.deviceId}` : null) : `direct:${cable}:${tag ?? 'u'}`;
  const attSegs = (ports: string[], tag: number | null): string[] => {
    const out = new Set<string>();
    ports.forEach((pid) => {
      const l = links[pid];
      if (!l?.up || !l.peer) return;
      const seg = peerSeg(PORTS[l.peer], l.cable, tag);
      if (seg) out.add(U.find(seg));
    });
    return [...out];
  };
  interface Att { segs: string[]; vlan: number; alive: boolean }
  const segsDbg: Record<string, string[]> = {};
  const mk = (id: string, dev: string, ports: string[], tag: number | null, vlan: number, needPower = false): Att => {
    const alive = needPower ? devPowered[dev] : devRunning[dev];
    const segs = alive ? attSegs(ports.map((p) => `${dev}:${p}`), tag) : [];
    segsDbg[id] = segs;
    return { segs, vlan, alive };
  };
  const inter = (a: string[], b: string[]) => a.some((x) => b.includes(x));

  const fwUp = devRunning['FW-01'];
  const fwSeg: Record<number, string[]> = {};
  s.fwSubifs.forEach((v) => (fwSeg[v] = fwUp ? attSegs(['LAN1', 'LAN2', 'LAN3', 'LAN4'].map((p) => `FW-01:${p}`), v) : []));
  const fwWan = ['WAN1', 'WAN2'].some((w) => { const l = links[`FW-01:${w}`]; return l.up && l.peer?.startsWith('NTE:ETH'); });
  const nteLine = links['NTE:LINE'];
  const lineOk = nteLine.up && nteLine.peer === 'DEMARC:FIBER';
  const internet = fwUp && fwWan && lineOk && devRunning['NTE'];
  const internetReason = !devRunning['NTE'] ? 'ISP NTE has no power' : !lineOk ? 'NTE: carrier fiber down (LOS)' : !fwUp ? 'Firewall down' : !fwWan ? 'Firewall WAN not linked to NTE handoff' : 'Up';

  const reach = (a: Att, b: Att) => {
    if (!a.alive || !b.alive) return false;
    if (a.vlan === b.vlan && inter(a.segs, b.segs)) return true;
    if (!fwUp || a.vlan === b.vlan) return false;
    return !!s.fwPolicies[`${a.vlan}>${b.vlan}`] && inter(fwSeg[a.vlan] ?? [], a.segs) && inter(fwSeg[b.vlan] ?? [], b.segs);
  };
  const inet = (a: Att) => a.alive && internet && !!s.fwPolicies[`${a.vlan}>inet`] && inter(fwSeg[a.vlan] ?? [], a.segs);
  const gw = (a: Att) => a.alive && fwUp && inter(fwSeg[a.vlan] ?? [], a.segs);

  const hosts = ['HV-01', 'HV-02'];
  const hMgmt: Record<string, Att> = {}, hVm: Record<string, Att> = {}, hClu: Record<string, Att> = {};
  hosts.forEach((h) => {
    const n = s.hostNet[h];
    hMgmt[h] = mk(`${h} mgmt`, h, ['NIC1-P1', 'NIC1-P2'], n.mgmtTag, 99);
    hVm[h] = mk(`${h} VM network`, h, ['NIC1-P1', 'NIC1-P2'], n.vmTag, 10);
    hClu[h] = mk(`${h} cluster`, h, ['LOM1', 'LOM2'], n.clusterTag, 50);
  });
  const bkData = mk('BK-01 data', 'BK-01', ['NIC1-P1', 'NIC1-P2'], null, 10);
  const mgmtAtts: [string, Att][] = [
    ['HV-01 BMC', mk('HV-01 BMC', 'HV-01', ['BMC'], null, 99, true)],
    ['HV-02 BMC', mk('HV-02 BMC', 'HV-02', ['BMC'], null, 99, true)],
    ['BK-01 BMC', mk('BK-01 BMC', 'BK-01', ['BMC'], null, 99, true)],
    ['SAN-01 ctrl A', mk('SAN A', 'SAN-01', ['A-MGMT'], null, 99)],
    ['SAN-01 ctrl B', mk('SAN B', 'SAN-01', ['B-MGMT'], null, 99)],
    ['SS-01 mgmt', mk('SS mgmt', 'SS-01', ['MGMT'], null, 99)],
    ['UPS-01 NMC', mk('UPS NMC', 'UPS-01', ['NMC'], null, 99, true)],
  ];

  // drops
  const dropAtt = (kid: string): Att | null => {
    const drop = DROPS[kid];
    const l = links[kid];
    if (!drop || !l.up || !l.peer) return { segs: [], vlan: drop?.vlan ?? 20, alive: true };
    const seg = peerSeg(PORTS[l.peer], l.cable, null);
    return { segs: seg ? [U.find(seg)] : [], vlan: drop.vlan, alive: true };
  };

  // ---------------- storage ----------------
  const sanSt = s.devices['SAN-01'];
  const failedDrives = DEV['SAN-01'].comps.filter((c) => c.kind === 'drive' && !(sanSt.comps[c.id].installed && !sanSt.comps[c.id].failed)).length;
  const raid = failedDrives === 0 ? 'Optimal' : failedDrives === 1 ? 'Degraded (RAID-6, 1 member missing)' : failedDrives === 2 ? 'Critical (no redundancy)' : 'FAILED – volume offline';
  const ctrls = devRunning['SAN-01'] ? ['ctrlA', 'ctrlB'].filter((c) => compOk('SAN-01', c)).length : 0;
  const sanOnline = devRunning['SAN-01'] && failedDrives < 3 && ctrls > 0;
  // iSCSI: a path is a host iSCSI port and an array port that land in the
  // same L2 segment (the storage switch's VLANs), array port alive, host
  // allowed in the array's access list. 2 host ports x 2 array ports per
  // VLAN = 4 paths per host when everything is right.
  const SAN_PORTS = ['A-P1', 'A-P2', 'B-P1', 'B-P2'].map((p) => `SAN-01:${p}`);
  const sanSeg = (pid: string): string | null => {
    const l = links[pid];
    if (!l.up || !l.peer) return null;
    const seg = peerSeg(PORTS[l.peer], l.cable, null);
    return seg ? U.find(seg) : null;
  };
  const arraySegs = SAN_PORTS.map(sanSeg).filter((x): x is string => !!x);
  const paths: Record<string, number> = {};
  hosts.forEach((h) => {
    let n = 0;
    ['NIC2-P1', 'NIC2-P2'].forEach((hp) => {
      const pid = `${h}:${hp}`;
      const l = links[pid];
      if (!l.up || !l.peer) return;
      if (PORTS[l.peer].deviceId === 'SAN-01') { n += 1; return; } // direct-attached
      const seg = sanSeg(pid);
      if (seg) n += arraySegs.filter((x) => x === seg).length;
    });
    paths[h] = sanOnline && s.sanMap[h] && devRunning[h] ? n : 0;
  });

  // ---------------- cluster ----------------
  const up = (h: string) => devRunning[h];
  const clusterNet = up('HV-01') && up('HV-02') && inter(hClu['HV-01'].segs, hClu['HV-02'].segs);
  const mgmtNet = up('HV-01') && up('HV-02') && inter(hMgmt['HV-01'].segs, hMgmt['HV-02'].segs);
  const comm = clusterNet || mgmtNet;
  const witnessFor = (h: string) => up(h) && devRunning['BK-01'] && reach(hMgmt[h], bkData);
  const nodes: Derived['cluster']['nodes'] = {};
  hosts.forEach((h) => (nodes[h] = { up: up(h), inQuorum: false }));
  if (comm) {
    const votes = 2 + (witnessFor('HV-01') || witnessFor('HV-02') ? 1 : 0);
    if (votes >= 2) hosts.forEach((h) => (nodes[h].inQuorum = true));
  } else {
    let witnessTaken = false;
    hosts.forEach((h) => {
      if (!up(h)) return;
      let v = 1;
      if (!witnessTaken && witnessFor(h)) { v++; witnessTaken = true; }
      nodes[h].inQuorum = v >= 2;
    });
  }
  const quorum = hosts.some((h) => nodes[h].inQuorum);
  const witness = witnessFor('HV-01') || witnessFor('HV-02');
  let summary = quorum ? `Quorum OK (${hosts.filter((h) => nodes[h].inQuorum).length} node(s)${witness ? ' + witness' : ''})` : 'Cluster DOWN – quorum lost';
  if (up('HV-01') && up('HV-02') && !comm) summary += ' · nodes partitioned';

  // ---------------- VMs ----------------
  const vms: Record<string, VmInfo> = {};
  const lunOk = (h: string) => paths[h] > 0;
  VMS.forEach((vm) => {
    // A paused (drained) node takes no VMs while any other node can.
    const eligible = [vm.pref, vm.alt].filter((h) => nodes[h].inQuorum && lunOk(h));
    const cand = eligible.find((h) => !s.maintenance[h]) ?? eligible[0] ?? null;
    let reason = '';
    if (!cand) reason = !quorum ? 'Stopped: cluster has no quorum' : 'Stopped: no node with storage access';
    const vmAtt: Att = cand ? { ...hVm[cand] } : { segs: [], vlan: 10, alive: false };
    const reachable = !!cand && vmAtt.segs.length > 0;
    if (cand && !reachable) reason = `Running on ${cand} but VM network uplinks are down`;
    if (cand && reachable) reason = cand === vm.pref ? `Running on ${cand}` : s.maintenance[vm.pref] ? `Live-migrated to ${cand} (${vm.pref} paused)` : `Failed over to ${cand}`;
    vms[vm.id] = { host: cand, reachable, reason };
  });
  const vmAtt = (id: string): Att => { const v = vms[id]; return v.host ? hVm[v.host] : { segs: [], vlan: 10, alive: false }; };

  // ---------------- thermal ----------------
  // Single rack, front-to-back: the front is room air, the rear is server
  // exhaust. Anything whose intake ends up at the rear breathes that exhaust.
  const coldAisleC = 22;
  const hotAisleC = Math.round((coldAisleC + 14 * Math.min(1.3, loadW / 1600)) * 10) / 10;
  const intakeSide = (d: DeviceDef) => rackSide(d, (s.devices[d.id].airflow ?? d.airflow ?? 'f2b') === 'f2b' ? 'front' : 'rear');
  const inletC: Record<string, number> = {};
  DEVICES.forEach((d) => { if (WATTS[d.type] && devRunning[d.id]) inletC[d.id] = intakeSide(d) === 'front' ? coldAisleC : hotAisleC; });

  // ---------------- checks ----------------
  const checks: Check[] = [];
  const add = (group: string, id: string, label: string, status: Check['status'], detail: string, focus?: string) => checks.push({ group, id, label, status, detail, focus });
  add('Power', 'util', 'Utility feed (CKT 14)', upsInputLive ? 'ok' : 'fail', upsInputLive ? '120V present at UPS input' : !s.utilityOn ? 'Breaker 14 tripped / off' : 'UPS input not connected to receptacle', 'DEMARC');
  add('Power', 'ups', 'UPS-01', upsMode === 'online' ? (ebm && battOk ? 'ok' : 'warn') : upsMode === 'battery' ? 'warn' : 'fail', upsMode === 'online' ? `Online · load ${Math.round(loadW)} W · ${ebm ? '' : 'NO EXT BATTERY · '}runtime ${runtimeMin.toFixed(0)} min` : upsMode === 'battery' ? `ON BATTERY · ${Math.round(s.upsCharge * 100)}% · ~${runtimeMin.toFixed(1)} min left` : 'Output OFF – rack unpowered', 'UPS-01');
  ['PDU-A', 'PDU-B'].forEach((p) => add('Power', p, p, pduLive[p] ? 'ok' : 'fail', pduLive[p] ? `${pduLoadA[p].toFixed(1)} A` : 'No input power', p));
  const nonRedundant = DEVICES.filter((d) => d.ports.filter((p) => p.kind === 'c14').length >= 2 && devPowered[d.id] && d.ports.filter((p) => p.kind === 'c14' && psuFed[p.id]).length < 2).map((d) => d.id);
  const hot = Object.entries(inletC).filter(([, t]) => t > 35).sort((a, b) => b[1] - a[1]);
  add('Environment', 'thermal', 'Device inlet temperatures', hot.length === 0 ? 'ok' : hot.some(([, t]) => t > 45) ? 'fail' : 'warn', hot.length ? `Above 35 °C: ${hot.map(([id, t]) => `${id} ${t.toFixed(0)} °C`).join(', ')}` : `All intakes at ${coldAisleC} °C (cold side)`, hot[0]?.[0]);
  add('Power', 'psu', 'PSU redundancy', nonRedundant.length ? 'warn' : 'ok', nonRedundant.length ? `Single feed: ${nonRedundant.join(', ')}` : 'All dual-PSU devices on A+B feeds');

  const bothSw = devRunning['SW-01'] && devRunning['SW-02'];
  add('Network', 'stack', 'Switch stack', !bothSw ? 'fail' : stackCables.length >= 2 ? 'ok' : stackFormed ? 'warn' : 'fail', !bothSw ? 'Stack member offline' : stackCables.length >= 2 ? 'Ring topology, 2 members' : stackFormed ? 'Chain topology – stack ring broken' : 'SPLIT – members operating independently', 'SW-01');
  add('Network', 'fw', 'Firewall FW-01', fwUp ? 'ok' : 'fail', fwUp ? `Inside VLANs: ${s.fwSubifs.filter((v) => fwSeg[v]?.length).join(', ') || 'none reachable'}` : devStatus['FW-01'], 'FW-01');
  add('Network', 'inet', 'Internet circuit', internet ? 'ok' : 'fail', internetReason, 'NTE');

  add('Storage', 'raid', 'SAN-01 disk group', failedDrives === 0 && devRunning['SAN-01'] ? 'ok' : failedDrives < 3 && devRunning['SAN-01'] ? 'warn' : 'fail', devRunning['SAN-01'] ? raid : devStatus['SAN-01'], 'SAN-01');
  add('Storage', 'ctrl', 'SAN-01 controllers', ctrls === 2 ? 'ok' : ctrls === 1 ? 'warn' : 'fail', `${ctrls}/2 controllers online`, 'SAN-01');
  hosts.forEach((h) => add('Storage', `paths-${h}`, `${h} iSCSI paths`, paths[h] >= 4 ? 'ok' : paths[h] > 0 ? 'warn' : 'fail', devRunning[h] ? `${paths[h]}/4 active paths${!s.sanMap[h] ? ' · not in array host access list' : ''}` : 'Host not running', h));

  ['HV-01', 'HV-02', 'BK-01'].forEach((h) => add('Compute', h, h, !devRunning[h] ? 'fail' : devAlerts[h].length || s.maintenance[h] ? 'warn' : 'ok', devRunning[h] ? devAlerts[h][0] ?? (s.maintenance[h] ? 'Paused for maintenance' : 'Running') : devStatus[h], h));
  add('Compute', 'quorum', 'Cluster quorum', quorum ? (hosts.every((h) => nodes[h].inQuorum) ? 'ok' : 'warn') : 'fail', summary, 'HV-01');
  add('Compute', 'clnet', 'Cluster network (VLAN 50)', clusterNet ? 'ok' : up('HV-01') && up('HV-02') ? 'warn' : 'fail', clusterNet ? 'Heartbeat + live migration OK' : up('HV-01') && up('HV-02') ? (mgmtNet ? 'Partitioned – heartbeat on mgmt network only' : 'No cluster communication') : 'Node(s) offline', 'HV-02');
  add('Compute', 'witness', 'File-share witness (BK-01 NAS)', witness ? 'ok' : 'warn', witness ? 'Reachable from cluster' : 'Witness unreachable', 'BK-01');

  const pcDrops = Object.keys(DROPS).filter((k) => DROPS[k].kind === 'pc');
  const phoneDrops = Object.keys(DROPS).filter((k) => DROPS[k].kind === 'phone');
  VMS.forEach((vm) => {
    const v = vms[vm.id];
    add('Services', vm.id, `${vm.id} · ${vm.role}`, !v.host || !v.reachable ? 'fail' : v.host !== vm.pref ? 'warn' : 'ok', v.reason, v.host ?? vm.pref);
  });
  const endpoint = (k: string) => { const a = dropAtt(k)!; return { a, up: a.segs.length > 0 }; };
  const drops = (ks: string[]) => ks.map((k) => ({ k, ...endpoint(k) }));
  const pcs = drops(pcDrops);
  const fmtCount = (ok: number, total: number, bad: string[]) => `${ok}/${total}${bad.length ? ` · failing: ${bad.join(', ')}` : ''}`;
  const badPc = pcs.filter((x) => !(reach(x.a, vmAtt('FILE01')) && reach(x.a, vmAtt('APP01')))).map((x) => DROPS[x.k].name);
  add('Services', 'users', 'Workstations → file server & LOB app', badPc.length === 0 ? 'ok' : badPc.length < pcDrops.length ? 'warn' : 'fail', fmtCount(pcDrops.length - badPc.length, pcDrops.length, badPc), 'PP-A');
  const inetPc = pcs.filter((x) => inet(x.a)).length;
  add('Services', 'uinet', 'User internet (by IP)', inetPc === pcDrops.length ? 'ok' : inetPc ? 'warn' : 'fail', `${inetPc}/${pcDrops.length} workstations`, 'FW-01');
  // Cloud apps need the internet AND name resolution, which here is the on-prem DC.
  const badCloud = pcs.filter((x) => !(inet(x.a) && reach(x.a, vmAtt('DC01')))).map((x) => DROPS[x.k].name);
  add('Services', 'cloud', 'Cloud apps (email, identity, files)', badCloud.length === 0 ? 'ok' : badCloud.length < pcDrops.length ? 'warn' : 'fail', fmtCount(pcDrops.length - badCloud.length, pcDrops.length, badCloud), 'FW-01');
  // Hosted VoIP: a phone registers if its voice VLAN gets out to the provider.
  const badPh = drops(phoneDrops).filter((x) => !inet(x.a)).map((x) => DROPS[x.k].name.replace(' desk phone', ''));
  add('Services', 'phones', 'Desk phones registered (hosted)', badPh.length === 0 ? 'ok' : badPh.length < phoneDrops.length ? 'warn' : 'fail', `${phoneDrops.length - badPh.length}/${phoneDrops.length} registered${badPh.length ? ' · down: ' + badPh.join(', ') : ''}`, 'PP-B');
  const printers = drops(Object.keys(DROPS).filter((k) => DROPS[k].kind === 'printer'));
  const badPr = printers.filter((x) => !(x.up && reach(x.a, vmAtt('FILE01')))).map((x) => DROPS[x.k].name);
  add('Services', 'printers', 'Printers reachable', badPr.length === 0 ? 'ok' : 'warn', badPr.length ? `Unreachable: ${badPr.join(', ')}` : `${printers.length}/${printers.length} online`, 'PP-A');
  const bkOk = devRunning['BK-01'] && VMS.every((vm) => reach(bkData, vmAtt(vm.id)));
  add('Services', 'backup', 'Nightly backups', bkOk ? 'ok' : 'fail', bkOk ? 'BK-01 can reach all VMs' : !devRunning['BK-01'] ? 'BK-01 down' : 'BK-01 cannot reach one or more VMs', 'BK-01');
  const badMgmt = mgmtAtts.filter(([, a]) => !gw(a)).map(([n]) => n);
  add('Management', 'oob', 'Out-of-band management', badMgmt.length ? 'warn' : 'ok', badMgmt.length ? `Unreachable: ${badMgmt.join(', ')}` : `${mgmtAtts.length}/${mgmtAtts.length} interfaces reachable`, 'SW-02');
  hosts.forEach((h) => { if (devRunning[h] && !gw(hMgmt[h])) add('Management', `hm-${h}`, `${h} host management`, 'warn', 'Hypervisor management IP unreachable', h); });

  return {
    portCable, links, outletLive, inletLive, devPowered, devRunning, devStatus, devAlerts,
    ups: { mode: upsMode, runtimeMin, loadW, ebm, inputLive: upsInputLive },
    pduLive, pduLoadA, stack: { formed: stackFormed, links: stackCables.length }, inletC, coldAisleC, hotAisleC, internet, internetReason,
    paths, san: { raid, failed: failedDrives, ctrls, online: sanOnline },
    cluster: { nodes, quorum, clusterNet, comm, witness, summary }, vms, checks, leds, segs: segsDbg,
  };
}
