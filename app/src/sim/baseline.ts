import { DEVICES, DEV, PORTS, CABLE_INFO } from './catalog';
import type { Cable, DeviceState, SimState, SwitchPortCfg } from './types';

export const STATE_VERSION = 6;

export const VLANS: Record<number, string> = { 1: 'default', 10: 'Servers', 20: 'Users', 30: 'Voice', 50: 'Cluster', 60: 'iSCSI-A', 61: 'iSCSI-B', 99: 'Management' };

export interface Drop { name: string; vlan: number; poe?: boolean; kind: 'pc' | 'printer' | 'phone' }
export const DROPS: Record<string, Drop> = {};
const pcs = ['Reception', 'Office Mgr', 'Accounts 1', 'Accounts 2', 'Accounts 3', 'Sales 1', 'Sales 2', 'Sales 3', 'Ops 1', 'Ops 2'];
pcs.forEach((n, i) => (DROPS[`PP-A:${i + 1}`] = { name: `${n} PC`, vlan: 20, kind: 'pc' }));
DROPS['PP-A:11'] = { name: 'Copier / MFP', vlan: 20, kind: 'printer' };
DROPS['PP-A:12'] = { name: 'Label printer (warehouse)', vlan: 20, kind: 'printer' };
['Reception', 'Office Mgr', 'Accounts', 'Sales 1', 'Sales 2', 'Ops', 'Warehouse', 'Conf room'].forEach((n, i) => (DROPS[`PP-B:${i + 1}`] = { name: `${n} desk phone`, vlan: 30, poe: true, kind: 'phone' }));
DROPS['PP-B:9'] = { name: 'Conf room PC', vlan: 20, kind: 'pc' };

// Cloud-heavy SMB: identity and email live in the cloud; what's still on
// the hosts is the DC (on-prem DNS/DHCP), the file server and the one
// line-of-business app that never made the move.
export interface VM { id: string; role: string; pref: string; alt: string }
export const VMS: VM[] = [
  { id: 'DC01', role: 'Domain controller / DNS / DHCP', pref: 'HV-01', alt: 'HV-02' },
  { id: 'FILE01', role: 'File server', pref: 'HV-01', alt: 'HV-02' },
  { id: 'APP01', role: 'Line-of-business app server', pref: 'HV-02', alt: 'HV-01' },
];

export const FW_POLICIES: { key: string; label: string }[] = [
  { key: '20>10', label: 'Users → Servers (DNS, SMB, LOB app)' },
  { key: '20>inet', label: 'Users → Internet (NAT)' },
  { key: '10>inet', label: 'Servers → Internet (updates, cloud sync)' },
  { key: '30>inet', label: 'Voice → hosted phone provider' },
  { key: '99>10', label: 'Management → Servers (witness, backup)' },
  { key: '10>99', label: 'Servers → Management (monitoring)' },
  { key: '20>99', label: 'Users (IT) → Management' },
];

function devState(id: string): DeviceState {
  const d = DEV[id];
  const comps: DeviceState['comps'] = {};
  d.comps.forEach((c) => {
    let installed = true;
    if (d.type === 'server2u' && c.kind === 'drive' && !['drive0', 'drive1'].includes(c.id)) installed = false;
    comps[c.id] = { installed, failed: false };
  });
  return { powerOn: true, extended: false, lidOff: false, shroudOff: false, comps };
}

const defaultPort = (): SwitchPortCfg => ({ mode: 'access', vlan: 1, allowed: [], enabled: true });

let cid = 0;
export function newCableId() {
  return `c${Date.now().toString(36)}${(cid++).toString(36)}`;
}

const short = (pid: string) => pid.replace(':', ' ');

export function baselineState(): SimState {
  const devices: Record<string, DeviceState> = {};
  DEVICES.forEach((d) => (devices[d.id] = devState(d.id)));
  const swPorts: Record<string, SwitchPortCfg> = {};
  DEVICES.filter((d) => d.type === 'switch').forEach((sw) => sw.ports.filter((p) => ['rj45', 'sfp'].includes(p.kind) && p.name !== 'MGMT').forEach((p) => (swPorts[p.id] = defaultPort())));
  const cables: Record<string, Cable> = {};
  let n = 0;
  const C = (a: string, b: string, type: string, opts: { color?: string; unlabeled?: boolean } = {}) => {
    if (!PORTS[a] || !PORTS[b]) throw new Error(`bad port ${a} ${b}`);
    const id = `b${n++}`;
    cables[id] = { id, a, b, type: type as Cable['type'], color: opts.color ?? CABLE_INFO[type].color, ...(opts.unlabeled ? {} : { label: `${short(a)} ⇄ ${short(b)}` }) };
  };
  const cfg = (id: string, c: Partial<SwitchPortCfg>) => {
    if (!swPorts[id]) throw new Error(`not a switchport: ${id}`);
    swPorts[id] = { ...swPorts[id], ...c };
  };
  const GREY = '#3b3f46';
  // Rear-side copper to a front-facing switch: patch into the next rear
  // tie-panel port, and out of its twin on the front.
  let tiePort = 0;
  const tie = (rearEnd: string, switchPort: string, color: string) => {
    tiePort++;
    C(rearEnd, `TP-R:${tiePort}`, 'cat6', { color });
    C(`TP-F:${tiePort}`, switchPort, 'cat6', { color });
  };

  // --- power: dual-PSU gear split A/B, single-PSU gear split across the two ---
  C('DEMARC:UTILITY', 'UPS-01:INPUT', 'pwr530');
  C('EBM-01:EBM', 'UPS-01:EBM', 'ebm');
  C('UPS-01:OUT7', 'PDU-A:INLET', 'pwr19');
  C('UPS-01:OUT8', 'PDU-B:INLET', 'pwr19', { color: GREY });
  const aFeed = ['SW-01:PSU', 'FW-01:PSU', 'STRIP:INLET', 'HV-01:PSU1', 'HV-02:PSU1', 'BK-01:PSU1', 'SAN-01:PSU1'];
  aFeed.forEach((p, i) => C(`PDU-A:${i + 1}`, p, 'pwr13'));
  const bFeed = ['SW-02:PSU', 'SS-01:PSU', 'HV-01:PSU2', 'HV-02:PSU2', 'SAN-01:PSU2'];
  bFeed.forEach((p, i) => C(`PDU-B:${i + 1}`, p, 'pwr13', { color: GREY }));
  // The consumer strip on the shelf: the ONT's brick and the desktop switch's brick.
  C('STRIP:1', 'NTE:PWR', 'brick', { unlabeled: true });
  C('STRIP:2', 'DSW:PWR', 'brick', { unlabeled: true });

  // --- carrier ---
  C('DEMARC:FIBER', 'NTE:LINE', 'os2sc');
  C('FW-01:WAN1', 'NTE:ETH1', 'cat6', { color: '#dc2626' });

  // --- stack ring ---
  C('SW-01:STK1', 'SW-02:STK2', 'stack');
  C('SW-01:STK2', 'SW-02:STK1', 'stack');

  // --- firewall inside trunk: one link, into stack member 1 ---
  C('FW-01:LAN1', 'SW-01:24', 'cat6', { color: '#dc2626' });
  cfg('SW-01:24', { mode: 'trunk', vlan: 1, allowed: [10, 20, 30, 99], desc: 'FW-01 inside trunk' });

  // --- hosts ---
  (['HV-01', 'HV-02'] as const).forEach((h, i) => {
    C(`${h}:NIC1-P1`, `SW-01:X${i + 1}`, 'dac');
    C(`${h}:NIC1-P2`, `SW-02:X${i + 1}`, 'dac');
    cfg(`SW-01:X${i + 1}`, { mode: 'trunk', vlan: 1, allowed: [10, 99], desc: `${h} 10G A` });
    cfg(`SW-02:X${i + 1}`, { mode: 'trunk', vlan: 1, allowed: [10, 99], desc: `${h} 10G B` });
    tie(`${h}:LOM1`, `SW-01:${17 + i}`, '#f97316');
    tie(`${h}:LOM2`, `SW-02:${17 + i}`, '#f97316');
    cfg(`SW-01:${17 + i}`, { vlan: 50, desc: `${h} cluster A` });
    cfg(`SW-02:${17 + i}`, { vlan: 50, desc: `${h} cluster B` });
    // iSCSI: two paths per host, one per storage VLAN, over fiber to the storage switch.
    C(`${h}:NIC2-P1`, `SS-01:X${i * 2 + 1}`, 'om4');
    C(`${h}:NIC2-P2`, `SS-01:X${i * 2 + 2}`, 'om4');
    cfg(`SS-01:X${i * 2 + 1}`, { vlan: 60, desc: `${h} iSCSI-A` });
    cfg(`SS-01:X${i * 2 + 2}`, { vlan: 61, desc: `${h} iSCSI-B` });
  });
  tie('HV-01:BMC', 'SW-01:19', '#eab308');
  tie('HV-02:BMC', 'SW-02:19', '#eab308');
  cfg('SW-01:19', { vlan: 99, desc: 'HV-01 BMC' });
  cfg('SW-02:19', { vlan: 99, desc: 'HV-02 BMC' });

  // --- backup NAS ---
  C('BK-01:NIC1-P1', 'SW-01:X3', 'dac');
  C('BK-01:NIC1-P2', 'SW-02:X3', 'dac');
  cfg('SW-01:X3', { vlan: 10, desc: 'BK-01 data A' });
  cfg('SW-02:X3', { vlan: 10, desc: 'BK-01 data B' });
  tie('BK-01:BMC', 'SW-01:20', '#eab308');
  cfg('SW-01:20', { vlan: 99, desc: 'BK-01 IPMI' });

  // --- storage array: each controller has a port on each iSCSI VLAN ---
  C('SAN-01:A-P1', 'SS-01:X9', 'om4');
  C('SAN-01:A-P2', 'SS-01:X10', 'om4');
  C('SAN-01:B-P1', 'SS-01:X11', 'om4');
  C('SAN-01:B-P2', 'SS-01:X12', 'om4');
  cfg('SS-01:X9', { vlan: 60, desc: 'SAN-01 ctrl A iSCSI-A' });
  cfg('SS-01:X10', { vlan: 61, desc: 'SAN-01 ctrl A iSCSI-B' });
  cfg('SS-01:X11', { vlan: 60, desc: 'SAN-01 ctrl B iSCSI-A' });
  cfg('SS-01:X12', { vlan: 61, desc: 'SAN-01 ctrl B iSCSI-B' });
  tie('SAN-01:A-MGMT', 'SW-01:21', '#eab308');
  tie('SAN-01:B-MGMT', 'SW-02:21', '#eab308');
  cfg('SW-01:21', { vlan: 99, desc: 'SAN-01 ctrl A mgmt' });
  cfg('SW-02:21', { vlan: 99, desc: 'SAN-01 ctrl B mgmt' });
  tie('SS-01:MGMT', 'SW-02:20', '#eab308');
  cfg('SW-02:20', { vlan: 99, desc: 'SS-01 mgmt' });
  tie('UPS-01:NMC', 'SW-02:22', '#eab308');
  cfg('SW-02:22', { vlan: 99, desc: 'UPS-01 NMC' });

  // --- office drops ---
  for (let i = 1; i <= 11; i++) {
    C(`PP-A:${i}`, `SW-01:${i}`, 'cat6', { color: '#2563eb' });
    cfg(`SW-01:${i}`, { vlan: 20, desc: DROPS[`PP-A:${i}`].name });
  }
  for (let i = 1; i <= 9; i++) {
    const d = DROPS[`PP-B:${i}`];
    C(`PP-B:${i}`, `SW-02:${i}`, 'cat6', { color: d.vlan === 30 ? '#a855f7' : '#2563eb' });
    cfg(`SW-02:${i}`, { vlan: d.vlan, desc: d.name });
  }
  // The mess. Someone moved the label printer behind a desktop switch on the
  // shelf; the switch config still documents the old port, and the uplink
  // that really carries it is described as a spare and has no label.
  cfg('SW-01:12', { vlan: 20, desc: 'Label printer (warehouse)' });
  C('PP-A:12', 'DSW:2', 'cat6', { color: '#e5e7eb', unlabeled: true });
  C('DSW:1', 'SW-01:14', 'cat6', { color: '#e5e7eb', unlabeled: true });
  cfg('SW-01:14', { vlan: 20, desc: 'spare' });

  return {
    version: STATE_VERSION,
    scenarioId: 'baseline',
    rack: { frontDoorOpen: true, rearDoorOpen: true, leftPanelOff: false, rightPanelOff: false },
    devices,
    cables,
    swPorts,
    vlans: { ...VLANS },
    sanMap: { 'HV-01': true, 'HV-02': true },
    fwPolicies: Object.fromEntries(FW_POLICIES.map((p) => [p.key, true])),
    fwSubifs: [10, 20, 30, 99],
    hostNet: {
      'HV-01': { mgmtTag: 99, vmTag: 10, clusterTag: null },
      'HV-02': { mgmtTag: 99, vmTag: 10, clusterTag: null },
    },
    maintenance: { 'HV-01': false, 'HV-02': false },
    tieFaults: {},
    utilityOn: true,
    upsCharge: 1,
    pduBreaker: { 'PDU-A': true, 'PDU-B': true },
    events: [{ t: Date.now(), msg: 'Environment loaded', level: 'info' }],
  };
}

// ---------------- scenarios ----------------
export interface Scenario { id: string; title: string; ticket: string; apply: (s: SimState) => void }

function findCable(s: SimState, portId: string) {
  return Object.values(s.cables).find((c) => c.a === portId || c.b === portId);
}
function removeCable(s: SimState, portId: string) {
  const c = findCable(s, portId);
  if (c) delete s.cables[c.id];
}

export const SCENARIOS: Scenario[] = [
  { id: 'baseline', title: 'Operational baseline', ticket: 'Everything is healthy. Explore the rack, trace cables, open chassis and inspect how the environment is built.', apply: () => {} },
  {
    id: 'greenfield', title: 'New build: rack & stack complete, nothing cabled',
    ticket: 'Hardware has been racked but nothing is cabled or configured. HV-02 arrived without memory installed (DIMMs are in the spares kit). Power the rack from the wall, cable power (A/B feeds), networking, iSCSI storage and the carrier circuit, configure switchports/VLANs and the array\'s host access, then bring the cluster online.',
    apply: (s) => {
      s.cables = {};
      Object.keys(s.swPorts).forEach((k) => (s.swPorts[k] = { mode: 'access', vlan: 1, allowed: [], enabled: true }));
      s.sanMap = { 'HV-01': false, 'HV-02': false };
      s.fwPolicies = Object.fromEntries(FW_POLICIES.map((p) => [p.key, false]));
      Object.entries(s.devices['HV-02'].comps).forEach(([k, c]) => { if (k.startsWith('dimm')) c.installed = false; });
      Object.entries(s.devices).forEach(([id, d]) => { if (DEV[id].serviceable || id === 'UPS-01') d.powerOn = false; });
      s.rack.leftPanelOff = true;
    },
  },
  { id: 'san-disk', title: 'Storage array alert', ticket: 'Automated email: "SAN-01 – disk group degraded". Identify the failed drive and replace it without taking storage offline.', apply: (s) => { s.devices['SAN-01'].comps.drive5.failed = true; } },
  { id: 'psu', title: 'Power redundancy lost', ticket: 'Monitoring shows HV-01 and SAN-01 both reporting "power supply redundancy lost". Investigate both.', apply: (s) => { s.devices['HV-01'].comps.psu2.failed = true; removeCable(s, 'SAN-01:PSU2'); } },
  { id: 'dimm', title: 'Memory errors on HV-02', ticket: 'HV-02 is logging correctable ECC errors that are escalating. Drain the host, power it off, and replace the faulty DIMM. Bring it back into the cluster afterwards.', apply: (s) => { s.devices['HV-02'].comps.dimmB3.failed = true; } },
  { id: 'fiber', title: 'Storage paths degraded', ticket: 'Cluster reports storage path redundancy lost on both hosts – HV-01 is worst. Someone was working in the rear of the rack yesterday.', apply: (s) => { const c = findCable(s, 'HV-01:NIC2-P2'); if (c) c.faulty = true; removeCable(s, 'SAN-01:B-P1'); } },
  { id: 'vlan', title: 'Accounting has no network', ticket: 'Accounts 1-3 users say their PCs show "no internet / no domain". Everyone else is fine. A contractor was changing switch configs last night.', apply: (s) => { [3, 4, 5].forEach((i) => (s.swPorts[`SW-01:${i}`].vlan = 30)); } },
  { id: 'nic', title: 'Line-of-business app unreachable', ticket: 'The line-of-business app is down. The cluster says both nodes are up and nothing failed over, yet APP01 cannot be reached.', apply: (s) => { s.devices['HV-02'].comps.nic1.failed = true; } },
  { id: 'stack', title: 'Every desk phone is dead', ticket: 'Every desk phone lost registration overnight and the conference room PC is offline. Switch stack alert emails arrived around the same time.', apply: (s) => { const a = findCable(s, 'SW-01:STK1'); if (a) a.faulty = true; removeCable(s, 'SW-01:STK2'); } },
  { id: 'power', title: 'UPS alarming – building power', ticket: 'The UPS is beeping. Facilities say breaker 14 tripped. Restore utility power and make sure the UPS has its full battery runtime.', apply: (s) => { s.utilityOn = false; removeCable(s, 'UPS-01:EBM'); s.upsCharge = 0.8; } },
  { id: 'firewall', title: '"The internet is down"', ticket: 'After last night\'s firewall change window, users say nothing works: no mapped drives, no line-of-business app, and "the internet is down". The helpdesk swears pinging 8.8.8.8 from a user PC works fine.', apply: (s) => { s.fwPolicies['20>10'] = false; } },
  { id: 'lun-access', title: 'HV-02 lost all storage', ticket: 'After storage array maintenance last night, HV-02 can no longer see the cluster volumes. Its VMs failed over to HV-01.', apply: (s) => { s.sanMap['HV-02'] = false; } },
  { id: 'patch', title: 'Sales 2 PC – no link', ticket: 'Sales 2 says the network icon shows a red X. The desk jack and PC NIC were already tested by the helpdesk.', apply: (s) => { const c = findCable(s, 'PP-A:7'); if (c) c.faulty = true; } },
  { id: 'cluster', title: 'Cluster network warnings', ticket: 'Cluster manager reports the cluster network is partitioned on HV-02 and live migration is failing.', apply: (s) => { s.hostNet['HV-02'].clusterTag = 50; } },
  { id: 'airflow', title: 'Storage switch running hot', ticket: 'SS-01 was replaced under RMA on Tuesday. Since then its fans have been loud and monitoring shows it running hot. Nothing is down yet. The replacement came from a different distributor than the original.', apply: (s) => { s.devices['SS-01'].airflow = 'f2b'; } },
  { id: 'tie-link', title: 'HV-01 out-of-band management lost', ticket: 'Monitoring lost HV-01’s out-of-band management interface after the rack was re-patched last weekend. The server itself is fine. The helpdesk already swapped the patch cable at the switch and says the switchport is up.', apply: (s) => { s.tieFaults['TP-R:5'] = true; } },
  { id: 'strip', title: 'Internet down for the whole office', ticket: 'Nobody can reach email or the cloud apps, every desk phone shows "no service", and the warehouse label printer stopped printing. The servers look fine. The cleaners were in last night.', apply: (s) => { s.devices['STRIP'].powerOn = false; } },
];

export function scenarioState(id: string): SimState {
  const s = baselineState();
  const sc = SCENARIOS.find((x) => x.id === id);
  sc?.apply(s);
  s.scenarioId = id;
  s.events = [{ t: Date.now(), msg: `Scenario loaded: ${sc?.title ?? id}`, level: 'info' }];
  return s;
}
