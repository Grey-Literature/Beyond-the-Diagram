import type { CompDef, DeviceDef, PortDef, PortKind, Face } from './types';

export const U = 0.04445;
export const RACK = {
  width: 0.75,
  depth: 1.1,
  baseY: 0.1,
  units: 24, // half-height four-post: what an SMB room actually has
  railX: 0.2413,
  frontRailZ: 0.45,
  rearRailZ: -0.4,
  deviceFrontZ: 0.47,
  chassisW: 0.434,
  earW: 0.4826,
  height: 0,
};
RACK.height = RACK.baseY + RACK.units * U + 0.06;
export const EXTEND_DIST = 0.56;

let cur: DeviceDef;
function port(name: string, kind: PortKind, face: Face, x: number, y: number, extra: Partial<PortDef> = {}): void {
  cur.ports.push({ id: `${cur.id}:${name}`, deviceId: cur.id, name, label: extra.label ?? name, kind, face, x, y, ...extra });
}
function comp(c: CompDef) {
  cur.comps.push(c);
}
function dev(d: Omit<DeviceDef, 'ports' | 'comps' | 'width'> & { width?: number }, build?: () => void): DeviceDef {
  cur = { width: RACK.chassisW, ...d, ports: [], comps: [] };
  build?.();
  return cur;
}

// --------------- builders ---------------
function patchPanel(id: string, name: string, u: number) {
  return dev({ id, name, model: '24-port Cat6 keystone patch panel', type: 'patch', u, h: 1, depth: 0.12, serviceable: false }, () => {
    for (let i = 0; i < 24; i++) {
      const group = Math.floor(i / 6);
      const x = -0.19 + i * 0.0148 + group * 0.006 + 0.005;
      port(String(i + 1), 'keystone', 'front', x, 0.02, { label: String(i + 1).padStart(2, '0') });
    }
  });
}

/** One half of a back-to-back tie-panel pair: 24 keystones, permanently linked to its twin. */
function tiePanel(id: string, name: string, u: number, facing: 'front' | 'rear') {
  return dev({ id, name, model: '24-port Cat6 keystone tie panel (back-to-back pair)', type: 'tiepanel', u, h: 1, depth: 0.08, serviceable: false, facing }, () => {
    for (let i = 0; i < 24; i++) {
      const group = Math.floor(i / 6);
      const x = -0.19 + i * 0.0148 + group * 0.006 + 0.005;
      port(String(i + 1), 'keystone', 'front', x, 0.02, { label: String(i + 1).padStart(2, '0') });
    }
  });
}

function accessSwitch(id: string, name: string, u: number) {
  return dev({ id, name, model: '24x1G PoE+ / 4x10G SFP+ stackable L2/L3 switch', type: 'switch', u, h: 1, depth: 0.3, serviceable: false }, () => {
    port('CON', 'console', 'front', -0.196, 0.022, { label: 'CON', role: 'Serial console' });
    port('MGMT', 'rj45', 'front', -0.18, 0.022, { label: 'MGMT', role: 'Out-of-band management' });
    for (let i = 0; i < 24; i++) {
      const col = Math.floor(i / 2);
      const top = i % 2 === 0;
      const x = -0.15 + col * 0.0145 + Math.floor(col / 6) * 0.008;
      port(String(i + 1), 'rj45', 'front', x, top ? 0.0305 : 0.0135, { poe: true, label: String(i + 1) });
    }
    for (let i = 0; i < 4; i++) {
      const x = 0.1 + (i % 2) * 0.018 + Math.floor(i / 2) * 0.042;
      port(`X${i + 1}`, 'sfp', 'front', x + 0.0, i % 2 === 0 ? 0.03 : 0.03, { label: `X${i + 1}` });
    }
    // fix SFP layout: 4 cages in a row
    cur.ports.filter((p) => p.kind === 'sfp').forEach((p, i) => { p.x = 0.098 + i * 0.019; p.y = 0.022; });
    port('STK1', 'stack', 'rear', -0.15, 0.022, { label: 'STACK 1' });
    port('STK2', 'stack', 'rear', -0.12, 0.022, { label: 'STACK 2' });
    port('PSU', 'c14', 'rear', 0.16, 0.022, { label: 'PSU' }); // single fixed PSU, as most SMB access switches have
  });
}

/** 10G SFP+ switch dedicated to iSCSI — the "fiber switch in between" host and array. */
function storageSwitch(id: string, name: string, u: number) {
  // Mounted facing the rear, next to the servers' iSCSI ports, so the fiber
  // runs stay short and out of the way; ordered with port-side-exhaust fans
  // so it still breathes cold-aisle air.
  return dev({ id, name, model: '1U 12-port 10G SFP+ switch (iSCSI fabric), port-side exhaust', type: 'switch', u, h: 1, depth: 0.3, serviceable: false, facing: 'rear', airflow: 'b2f' }, () => {
    port('CON', 'console', 'front', -0.196, 0.022, { label: 'CON', role: 'Serial console' });
    port('MGMT', 'rj45', 'front', -0.178, 0.022, { label: 'MGMT', role: 'Out-of-band management' });
    for (let i = 0; i < 12; i++) port(`X${i + 1}`, 'sfp', 'front', -0.12 + i * 0.019 + Math.floor(i / 4) * 0.012, 0.022, { label: `X${i + 1}` });
    port('PSU', 'c14', 'rear', 0.16, 0.022, { label: 'PSU' });
  });
}

function server2u(id: string, name: string, u: number) {
  const d = 0.72;
  const fz = d / 2;
  const rz = -d / 2;
  return dev({ id, name, model: '2U dual-socket virtualization host', type: 'server2u', u, h: 2, depth: d, serviceable: true }, () => {
    for (let i = 0; i < 8; i++) {
      comp({ id: `drive${i}`, kind: 'drive', label: `Bay ${i}`, part: '960GB SAS SSD, 2.5" hot-plug carrier', pos: [-0.16 + i * 0.0168, 0.044, fz - 0.065], size: [0.0155, 0.074, 0.13], hotSwap: true, access: 'front' });
    }
    for (let i = 0; i < 6; i++) {
      comp({ id: `fan${i}`, kind: 'fan', label: `Fan ${i + 1}`, part: '60mm dual-rotor hot-swap fan', pos: [-0.175 + i * 0.07, 0.042, 0.19], size: [0.06, 0.064, 0.038], hotSwap: true, access: 'internal' });
    }
    const cpus: [string, number][] = [['cpu1', -0.115], ['cpu2', 0.045]];
    cpus.forEach(([cid, cx], ci) => {
      comp({ id: cid, kind: 'cpu', label: `CPU ${ci + 1}`, part: '16-core server processor with 2U heatsink', pos: [cx, 0.034, 0.055], size: [0.074, 0.056, 0.09], hotSwap: false, access: 'internal', needsShroudOff: true });
      const bank = ci === 0 ? 'A' : 'B';
      for (let k = 0; k < 8; k++) {
        const side = k < 4 ? -1 : 1;
        const off = 0.046 + (k % 4) * 0.0085;
        comp({ id: `dimm${bank}${k + 1}`, kind: 'dimm', label: `DIMM ${bank}${k + 1}`, part: '32GB DDR4-3200 ECC RDIMM', pos: [cx + side * off, 0.022, 0.055], size: [0.0055, 0.031, 0.133], hotSwap: false, access: 'internal', needsShroudOff: true });
      }
    });
    comp({ id: 'nic1', kind: 'nic', label: 'Riser 1 · Slot 1 NIC', part: 'Dual-port 10GbE SFP+ adapter', pos: [-0.14, 0.064, rz + 0.1], size: [0.105, 0.018, 0.17], hotSwap: false, access: 'internal' });
    comp({ id: 'nic2', kind: 'nic', label: 'Riser 1 · Slot 2 NIC (iSCSI)', part: 'Dual-port 10GbE SFP+ adapter, SR optics', pos: [-0.14, 0.03, rz + 0.1], size: [0.105, 0.018, 0.17], hotSwap: false, access: 'internal' });
    comp({ id: 'raid', kind: 'raid', label: 'Riser 2 · RAID controller', part: '12Gb SAS RAID controller, 4GB cache', pos: [-0.02, 0.064, rz + 0.11], size: [0.1, 0.018, 0.17], hotSwap: false, access: 'internal' });
    comp({ id: 'lom', kind: 'lom', label: 'OCP NIC (LOM)', part: 'Quad-port 1GbE OCP mezzanine', pos: [-0.035, 0.012, rz + 0.06], size: [0.075, 0.018, 0.1], hotSwap: false, access: 'internal' });
    comp({ id: 'psu1', kind: 'psu', label: 'PSU 1', part: '1100W Platinum hot-plug PSU', pos: [0.17, 0.022, rz + 0.11], size: [0.086, 0.04, 0.22], hotSwap: true, access: 'rear' });
    comp({ id: 'psu2', kind: 'psu', label: 'PSU 2', part: '1100W Platinum hot-plug PSU', pos: [0.17, 0.066, rz + 0.11], size: [0.086, 0.04, 0.22], hotSwap: true, access: 'rear' });
    port('NIC1-P1', 'sfp', 'rear', -0.17, 0.066, { comp: 'nic1', label: 'P1', role: '10GbE uplink A (mgmt / VM trunk)' });
    port('NIC1-P2', 'sfp', 'rear', -0.148, 0.066, { comp: 'nic1', label: 'P2', role: '10GbE uplink B (mgmt / VM trunk)' });
    port('NIC2-P1', 'sfp', 'rear', -0.17, 0.032, { comp: 'nic2', label: 'P1', role: 'iSCSI path A' });
    port('NIC2-P2', 'sfp', 'rear', -0.148, 0.032, { comp: 'nic2', label: 'P2', role: 'iSCSI path B' });
    for (let i = 0; i < 4; i++) port(`LOM${i + 1}`, 'rj45', 'rear', -0.062 + i * 0.0145, 0.012, { comp: 'lom', label: String(i + 1), role: i < 2 ? '1GbE cluster / live-migration' : '1GbE spare' });
    port('BMC', 'rj45', 'rear', 0.03, 0.012, { label: 'BMC', role: 'Baseboard management controller' });
    port('PSU1', 'c14', 'rear', 0.195, 0.022, { comp: 'psu1', label: 'PSU1' });
    port('PSU2', 'c14', 'rear', 0.195, 0.066, { comp: 'psu2', label: 'PSU2' });
  });
}

/** Backup NAS appliance: a small server underneath, one PSU, 4 LFF bays. */
function server1u(id: string, name: string, u: number) {
  const d = 0.65;
  const fz = d / 2;
  const rz = -d / 2;
  return dev({ id, name, model: '1U 4-bay backup NAS appliance', type: 'server1u', u, h: 1, depth: d, serviceable: true }, () => {
    for (let i = 0; i < 4; i++) {
      comp({ id: `drive${i}`, kind: 'drive', label: `Bay ${i}`, part: '8TB NL-SAS 3.5" hot-plug HDD', pos: [-0.153 + i * 0.102, 0.022, fz - 0.1], size: [0.1, 0.027, 0.2], hotSwap: true, access: 'front' });
    }
    for (let i = 0; i < 5; i++) {
      comp({ id: `fan${i}`, kind: 'fan', label: `Fan ${i + 1}`, part: '40mm hot-swap fan', pos: [-0.17 + i * 0.075, 0.021, 0.08], size: [0.04, 0.038, 0.028], hotSwap: true, access: 'internal' });
    }
    comp({ id: 'cpu1', kind: 'cpu', label: 'CPU 1', part: '12-core server processor, 1U heatsink', pos: [-0.06, 0.017, -0.03], size: [0.074, 0.026, 0.09], hotSwap: false, access: 'internal', needsShroudOff: true });
    for (let k = 0; k < 8; k++) {
      const side = k < 4 ? -1 : 1;
      const off = 0.046 + (k % 4) * 0.0085;
      comp({ id: `dimmA${k + 1}`, kind: 'dimm', label: `DIMM A${k + 1}`, part: '16GB DDR4-3200 ECC RDIMM', pos: [-0.06 + side * off, 0.018, -0.03], size: [0.0055, 0.03, 0.133], hotSwap: false, access: 'internal', needsShroudOff: true });
    }
    comp({ id: 'nic1', kind: 'nic', label: 'Riser 1 NIC', part: 'Dual-port 10GbE SFP+ adapter (low profile)', pos: [-0.165, 0.028, rz + 0.09], size: [0.07, 0.016, 0.15], hotSwap: false, access: 'internal' });
    comp({ id: 'raid', kind: 'raid', label: 'RAID controller', part: '12Gb SAS RAID controller (mezzanine)', pos: [0.03, 0.01, rz + 0.2], size: [0.07, 0.012, 0.09], hotSwap: false, access: 'internal' });
    comp({ id: 'lom', kind: 'lom', label: 'LOM', part: 'Dual-port 1GbE onboard', pos: [-0.07, 0.01, rz + 0.04], size: [0.04, 0.016, 0.05], hotSwap: false, access: 'internal' });
    comp({ id: 'psu1', kind: 'psu', label: 'PSU', part: '300W fixed PSU', pos: [0.186, 0.021, rz + 0.1], size: [0.054, 0.039, 0.2], hotSwap: false, access: 'rear' });
    port('NIC1-P1', 'sfp', 'rear', -0.185, 0.026, { comp: 'nic1', label: 'P1', role: '10GbE data A' });
    port('NIC1-P2', 'sfp', 'rear', -0.164, 0.026, { comp: 'nic1', label: 'P2', role: '10GbE data B' });
    port('LOM1', 'rj45', 'rear', -0.085, 0.018, { comp: 'lom', label: '1' });
    port('LOM2', 'rj45', 'rear', -0.07, 0.018, { comp: 'lom', label: '2' });
    port('BMC', 'rj45', 'rear', -0.035, 0.018, { label: 'IPMI', role: 'Out-of-band management' });
    port('PSU1', 'c14', 'rear', 0.196, 0.021, { comp: 'psu1', label: 'PSU' });
  });
}

function san(id: string, name: string, u: number) {
  const d = 0.6;
  const fz = d / 2;
  const rz = -d / 2;
  return dev({ id, name, model: '2U dual-controller iSCSI storage array, 12x LFF', type: 'san', u, h: 2, depth: d, serviceable: true }, () => {
    for (let i = 0; i < 12; i++) {
      const row = Math.floor(i / 4);
      const col = i % 4;
      comp({ id: `drive${i}`, kind: 'drive', label: `Slot ${i}`, part: '4TB NL-SAS 3.5" drive in carrier', pos: [-0.153 + col * 0.102, 0.072 - row * 0.028, fz - 0.11], size: [0.1, 0.026, 0.22], hotSwap: true, access: 'front' });
    }
    comp({ id: 'ctrlA', kind: 'controller', label: 'Controller A', part: 'iSCSI controller canister, 2x 10G SFP+, 8GB cache + BBU', pos: [0, 0.064, rz + 0.13], size: [0.24, 0.04, 0.26], hotSwap: true, access: 'rear' });
    comp({ id: 'ctrlB', kind: 'controller', label: 'Controller B', part: 'iSCSI controller canister, 2x 10G SFP+, 8GB cache + BBU', pos: [0, 0.022, rz + 0.13], size: [0.24, 0.04, 0.26], hotSwap: true, access: 'rear' });
    comp({ id: 'psu1', kind: 'psu', label: 'PCM 1', part: '764W power & cooling module', pos: [-0.17, 0.044, rz + 0.13], size: [0.08, 0.084, 0.26], hotSwap: true, access: 'rear' });
    comp({ id: 'psu2', kind: 'psu', label: 'PCM 2', part: '764W power & cooling module', pos: [0.17, 0.044, rz + 0.13], size: [0.08, 0.084, 0.26], hotSwap: true, access: 'rear' });
    (['A', 'B'] as const).forEach((c) => {
      const y = c === 'A' ? 0.066 : 0.024;
      port(`${c}-P1`, 'sfp', 'rear', -0.07, y, { comp: `ctrl${c}`, label: 'P1', role: `Controller ${c} iSCSI port 1 (path A)` });
      port(`${c}-P2`, 'sfp', 'rear', -0.048, y, { comp: `ctrl${c}`, label: 'P2', role: `Controller ${c} iSCSI port 2 (path B)` });
      port(`${c}-MGMT`, 'rj45', 'rear', 0.03, y, { comp: `ctrl${c}`, label: 'MGMT', role: `Controller ${c} management` });
    });
    port('PSU1', 'c14', 'rear', -0.17, 0.03, { comp: 'psu1', label: 'PCM1' });
    port('PSU2', 'c14', 'rear', 0.17, 0.03, { comp: 'psu2', label: 'PCM2' });
  });
}

export const STACK_MEMBERS = ['SW-01', 'SW-02'];

// 24U, loaded bottom-heavy the way a real rack is: batteries and UPS at the
// floor, then storage and compute, the messy shelf, and network gear and
// patching at the top where the horizontal runs come in.
export const DEVICES: DeviceDef[] = [
  patchPanel('PP-A', 'PP-A  Office drops 01-24', 24),
  dev({ id: 'CM-1', name: 'Horizontal cable manager', model: '1U finger duct', type: 'cablemgr', u: 23, h: 1, depth: 0.1, serviceable: false }),
  accessSwitch('SW-01', 'SW-01  Stack member 1', 22),
  accessSwitch('SW-02', 'SW-02  Stack member 2', 21),
  dev({ id: 'CM-2', name: 'Horizontal cable manager', model: '1U finger duct', type: 'cablemgr', u: 20, h: 1, depth: 0.1, serviceable: false }),
  patchPanel('PP-B', 'PP-B  Voice / conf drops', 19),
  dev({ id: 'FW-01', name: 'FW-01  Firewall', model: '1U UTM firewall appliance', type: 'firewall', u: 18, h: 1, depth: 0.34, serviceable: false }, () => {
    port('CON', 'console', 'front', -0.19, 0.022, { label: 'CON' });
    port('MGMT', 'rj45', 'front', -0.17, 0.022, { label: 'MGMT' });
    port('WAN1', 'rj45', 'front', -0.12, 0.022, { label: 'WAN1', role: 'Internet (ISP handoff)' });
    port('WAN2', 'rj45', 'front', -0.105, 0.022, { label: 'WAN2', role: 'Secondary WAN' });
    for (let i = 0; i < 4; i++) port(`LAN${i + 1}`, 'rj45', 'front', -0.06 + i * 0.015, 0.022, { label: `LAN${i + 1}`, role: 'Inside trunk (VLAN sub-interfaces)' });
    port('HA', 'rj45', 'front', 0.02, 0.022, { label: 'HA' });
    port('PSU', 'c14', 'rear', 0.17, 0.022, { label: 'PSU' });
  }),
  storageSwitch('SS-01', 'SS-01  iSCSI storage switch', 17),
  // Single rack: server-side copper comes in at the rear panel and leaves
  // from the front one, instead of snaking round to front-facing switches.
  tiePanel('TP-F', 'TP-F  Tie panel (front)', 16, 'front'),
  tiePanel('TP-R', 'TP-R  Tie panel (rear)', 16, 'rear'),
  dev({ id: 'CM-3', name: 'Horizontal cable manager', model: '1U finger duct', type: 'cablemgr', u: 15, h: 1, depth: 0.1, serviceable: false }),
  dev({ id: 'SHELF-1', name: 'Cantilever shelf', model: '2U vented cantilever shelf', type: 'shelf', u: 12, h: 2, depth: 0.45, serviceable: false }),
  server1u('BK-01', 'BK-01  Backup NAS / cluster witness', 11),
  server2u('HV-01', 'HV-01  Hyper-V cluster node 1', 9),
  server2u('HV-02', 'HV-02  Hyper-V cluster node 2', 7),
  san('SAN-01', 'SAN-01  Storage array', 5),
  dev({ id: 'UPS-01', name: 'UPS-01  3kVA online UPS', model: '2U 3000VA double-conversion UPS', type: 'ups', u: 3, h: 2, depth: 0.62, serviceable: false }, () => {
    comp({ id: 'battery', kind: 'battery', label: 'Internal battery module', part: '72V VRLA battery tray (front-replaceable)', pos: [0, 0.044, 0.1], size: [0.4, 0.07, 0.35], hotSwap: true, access: 'front' });
    comp({ id: 'nmc', kind: 'nic', label: 'Network management card', part: 'UPS network management card', pos: [-0.13, 0.068, -0.27], size: [0.07, 0.02, 0.1], hotSwap: true, access: 'rear' });
    port('INPUT', 'l530p', 'rear', -0.185, 0.035, { label: 'AC INPUT L5-30P' });
    for (let i = 0; i < 6; i++) port(`OUT${i + 1}`, 'c13', 'rear', -0.085 + (i % 3) * 0.032, i < 3 ? 0.062 : 0.028, { label: String(i + 1) });
    port('OUT7', 'c19', 'rear', 0.05, 0.045, { label: '7' });
    port('OUT8', 'c19', 'rear', 0.09, 0.045, { label: '8' });
    port('EBM', 'ebm', 'rear', 0.17, 0.03, { label: 'EXT BATT' });
    port('NMC', 'rj45', 'rear', -0.13, 0.068, { comp: 'nmc', label: 'NET' });
  }),
  dev({ id: 'EBM-01', name: 'EBM-01  Extended battery module', model: '2U external battery module', type: 'ebm', u: 1, h: 2, depth: 0.6, serviceable: false }, () => {
    port('EBM', 'ebm', 'rear', 0.17, 0.045, { label: 'BATT OUT' });
  }),
];

// ---- the shelf: carrier and consumer gear that never got a proper home ----
DEVICES.push(
  dev({ id: 'NTE', name: 'ISP-ONT  Carrier fiber ONT', model: 'ISP-owned desktop fiber ONT (optical network terminal)', type: 'isp', u: 0, h: 0, boxH: 0.036, width: 0.19, depth: 0.14, serviceable: false, place: { on: 'SHELF-1', x: -0.105 } }, () => {
    port('LINE', 'sc', 'front', -0.07, 0.018, { label: 'PON', role: 'Carrier fiber from building entrance' });
    port('ETH1', 'rj45', 'front', 0.0, 0.018, { label: 'LAN1', role: 'Customer Ethernet handoff' });
    port('ETH2', 'rj45', 'front', 0.018, 0.018, { label: 'LAN2', role: 'Customer Ethernet handoff' });
    port('PWR', 'dc', 'rear', 0.07, 0.018, { label: '12V DC', role: 'Power brick' });
  }),
  dev({ id: 'DSW', name: 'DSW  Desktop 5-port switch', model: 'Unmanaged 5-port gigabit desktop switch', type: 'dumbswitch', u: 0, h: 0, boxH: 0.026, width: 0.1, depth: 0.08, serviceable: false, place: { on: 'SHELF-1', x: 0.07 } }, () => {
    for (let i = 0; i < 5; i++) port(String(i + 1), 'rj45', 'front', -0.036 + i * 0.015, 0.013, { label: String(i + 1) });
    port('PWR', 'dc', 'rear', 0.03, 0.013, { label: '5V DC', role: 'Power brick' });
  }),
  dev({ id: 'STRIP', name: 'STRIP  Consumer surge strip', model: '6-outlet consumer surge strip on a C14 adapter cord', type: 'strip', u: 0, h: 0, boxH: 0.04, width: 0.2, depth: 0.05, serviceable: false, place: { on: 'SHELF-1', x: -0.1, z: 0.3 } }, () => {
    port('INLET', 'c14', 'rear', 0.09, 0.02, { label: 'CORD', role: 'Adapter cord to a PDU outlet' });
    for (let i = 0; i < 6; i++) port(String(i + 1), 'nema515r', 'front', -0.055 + i * 0.026, 0.02, { label: String(i + 1) });
  }),
);

// PDUs: 0U vertical, mounted in the rear channel between rail and side panel
export const PDU_LEN = 0.95;
function pdu(id: string, side: 'left' | 'right') {
  return dev({ id, name: `${id}  Metered PDU (${side === 'left' ? 'A-feed' : 'B-feed'})`, model: '0U metered PDU, 12x C13', type: 'pdu', u: 0, h: 0, depth: 0.05, width: 0.055, serviceable: false, side }, () => {
    port('INLET', 'c20', 'rear', 0, 0.05, { label: 'IN', vertical: true });
    for (let i = 0; i < 12; i++) port(String(i + 1), 'c13', 'rear', 0, PDU_LEN - 0.09 - i * 0.066, { label: String(i + 1), vertical: true });
  });
}
DEVICES.push(pdu('PDU-A', 'left'), pdu('PDU-B', 'right'));

DEVICES.push(
  dev({ id: 'DEMARC', name: 'Building entrance / demarc panel', model: 'Wall-mounted demarcation panel', type: 'wallpanel', u: 0, h: 0, depth: 0.08, width: 0.5, serviceable: false }, () => {
    port('FIBER', 'sc', 'front', -0.15, 0.3, { label: 'ISP FIBER (SC/APC)', role: 'Carrier single-mode fiber' });
    port('UTILITY', 'l530r', 'front', 0.16, 0.12, { label: 'L5-30R  CKT 14' });
  }),
);

// blanking panels in unused space
// Blanks go on the front rails wherever nothing occupies the front. A shallow
// rear-mounted device (the storage switch) still leaves a front gap, and an
// unblanked gap is where hot exhaust recirculates to the intakes.
const used = new Set<number>();
DEVICES.forEach((d) => { if (d.facing === 'rear' && d.depth < 0.5) return; for (let i = 0; i < d.h; i++) used.add(d.u + i); });
for (let u = 1; u <= RACK.units; u++) {
  if (!used.has(u)) {
    DEVICES.push(dev({ id: `BLANK-${u}`, name: 'Blanking panel', model: '1U blanking panel', type: 'blank', u, h: 1, depth: 0.02, serviceable: false }));
  }
}

export const DEV: Record<string, DeviceDef> = Object.fromEntries(DEVICES.map((d) => [d.id, d]));

/** Permanent tie-panel links, both directions: TP-R:n <-> TP-F:n. */
export const TIES: Record<string, string> = {};
for (let i = 1; i <= 24; i++) { TIES[`TP-R:${i}`] = `TP-F:${i}`; TIES[`TP-F:${i}`] = `TP-R:${i}`; }
/** The key a tie link is stored under in state (its rear port). */
export const tieKey = (pid: string) => (pid.startsWith('TP-F:') ? TIES[pid] : pid);
export const PORTS: Record<string, PortDef> = {};
DEVICES.forEach((d) => d.ports.forEach((p) => (PORTS[p.id] = p)));

// ---------- geometry helpers ----------
export interface Pose { pos: [number, number, number]; rotY: number }
/** Physical height in metres: rack units for mounted gear, measured height for shelf items. */
export function deviceHeight(d: DeviceDef): number {
  return d.boxH ?? (d.type === 'pdu' ? PDU_LEN : d.h * U);
}

export function devicePose(d: DeviceDef): Pose {
  if (d.type === 'pdu') return { pos: [d.side === 'left' ? -0.315 : 0.315, 0.2, -0.47], rotY: 0 };
  if (d.place) {
    const shelf = DEV[d.place.on];
    const shelfY = RACK.baseY + (shelf.u - 1) * U + 0.004;
    return { pos: [d.place.x, shelfY, RACK.deviceFrontZ - 0.03 - (d.place.z ?? 0) - d.depth / 2], rotY: 0 };
  }
  if (d.type === 'wallpanel') return { pos: [-2.2 + 0.04, 1.05, -1.0], rotY: Math.PI / 2 };
  if (d.facing === 'rear') return { pos: [0, RACK.baseY + (d.u - 1) * U, -RACK.deviceFrontZ + 0.05 + d.depth / 2], rotY: Math.PI };
  return { pos: [0, RACK.baseY + (d.u - 1) * U, RACK.deviceFrontZ - d.depth / 2], rotY: 0 };
}

/** Which side of the rack a device-relative side actually points to. */
export function rackSide(d: DeviceDef, side: 'front' | 'rear'): 'front' | 'rear' {
  return d.facing === 'rear' ? (side === 'front' ? 'rear' : 'front') : side;
}

/** Which side of the rack a port is reached from (null for the wall). */
export function portSide(p: PortDef): 'front' | 'rear' | null {
  const d = DEV[p.deviceId];
  if (p.face === 'wall' || d.type === 'wallpanel') return null;
  return rackSide(d, p.face);
}

/** world position and outward normal of a port. ext = animated extension 0..1 */
export function portWorld(p: PortDef, ext = 0): { pos: [number, number, number]; n: [number, number, number] } {
  const d = DEV[p.deviceId];
  const pose = devicePose(d);
  const lz = p.face === 'rear' ? -d.depth / 2 : d.depth / 2;
  const nz = p.face === 'rear' ? -1 : 1;
  const c = Math.cos(pose.rotY), s = Math.sin(pose.rotY);
  const lx = p.x, ly = p.y;
  const wx = pose.pos[0] + lx * c + lz * s;
  const wz = pose.pos[2] - lx * s + lz * c + ext * EXTEND_DIST;
  return { pos: [wx, pose.pos[1] + ly, wz], n: [nz * s, 0, nz * c] };
}

// ---------- port/cable compatibility ----------
export const CABLE_INFO: Record<string, { name: string; ends: [PortKind[], PortKind[]]; radius: number; color: string }> = {
  cat6: { name: 'Cat6 patch cable (RJ45)', ends: [['rj45', 'console', 'keystone'], ['rj45', 'console', 'keystone']], radius: 0.0028, color: '#2563eb' },
  dac: { name: '10G SFP+ direct-attach copper', ends: [['sfp'], ['sfp']], radius: 0.0024, color: '#1f2226' },
  om4: { name: 'OM4 LC-LC duplex fiber', ends: [['sfp'], ['sfp']], radius: 0.0019, color: '#22d3ee' },
  os2sc: { name: 'OS2 SC/APC single-mode fiber', ends: [['sc'], ['sc']], radius: 0.0018, color: '#facc15' },
  stack: { name: 'Stacking cable', ends: [['stack'], ['stack']], radius: 0.0034, color: '#16181b' },
  pwr13: { name: 'C13-C14 power cord', ends: [['c13'], ['c14']], radius: 0.0036, color: '#16171a' },
  pwr19: { name: 'C19-C20 power cord', ends: [['c19'], ['c20']], radius: 0.0048, color: '#16171a' },
  pwr530: { name: 'L5-30 input cord', ends: [['l530r'], ['l530p']], radius: 0.0065, color: '#101114' },
  ebm: { name: 'Battery cable (DC power connector)', ends: [['ebm'], ['ebm']], radius: 0.0055, color: '#111' },
  brick: { name: 'Plug-in power brick', ends: [['nema515r'], ['dc']], radius: 0.0016, color: '#15161a' },
};

export const PORT_KIND_NAME: Record<PortKind, string> = {
  rj45: 'RJ45 1GbE', console: 'RJ45 serial console', sfp: 'SFP+ 10GbE cage', stack: 'Stacking port', sc: 'SC/APC fiber', c13: 'C13 outlet', c14: 'C14 inlet', c19: 'C19 outlet', c20: 'C20 inlet', l530r: 'L5-30R receptacle', l530p: 'L5-30P input', ebm: 'Battery connector', keystone: 'RJ45 keystone', nema515r: 'NEMA 5-15R outlet', dc: 'DC barrel jack',
};

/** returns cable types that could physically join these two ports (in either orientation) */
export function compatibleTypes(a: PortDef, b: PortDef): string[] {
  const out: string[] = [];
  for (const [t, info] of Object.entries(CABLE_INFO)) {
    const [e0, e1] = info.ends;
    if ((e0.includes(a.kind) && e1.includes(b.kind)) || (e1.includes(a.kind) && e0.includes(b.kind))) out.push(t);
  }
  // an FC port has a fixed LC optic installed, DAC cannot go there (handled by ends). SFP<->SFP prefer DAC
  return out;
}
export function typesForPort(a: PortDef): string[] {
  return Object.entries(CABLE_INFO).filter(([, i]) => i.ends[0].includes(a.kind) || i.ends[1].includes(a.kind)).map(([t]) => t);
}
