// Physical and procedural rules the simulator must refuse to break, plus
// consequences that must follow from state rather than being scripted.
import { expect, test } from 'vitest';
import { baselineState } from './baseline';
import { apply, type Action } from './actions';
import { derive } from './engine';
import type { SimState } from './types';

function refused(s: SimState, a: Action): string {
  const r = apply(s, a);
  if (r.ok) throw new Error(`expected ${a.type} to be refused`);
  return r.error;
}

function ok(s: SimState, ...actions: Action[]): SimState {
  for (const a of actions) {
    const r = apply(s, a);
    if (!r.ok) throw new Error(`${a.type} refused: ${r.error}`);
    s = r.state;
  }
  return s;
}

const cableAt = (s: SimState, port: string) => Object.values(s.cables).find((c) => c.a === port || c.b === port)!.id;

test('no cable joins a power outlet to a NIC', () => {
  expect(refused(baselineState(), { type: 'connect', a: 'PDU-A:12', b: 'HV-01:LOM3' })).toMatch(/No cable exists/);
});

test('a patched spare port comes up at both ends', () => {
  const d = derive(ok(baselineState(), { type: 'connect', a: 'HV-01:LOM3', b: 'SW-01:13' }));
  expect(d.links['HV-01:LOM3'].up).toBe(true);
  expect(d.links['SW-01:13'].up).toBe(true);
});

test('an occupied port is refused', () => {
  expect(refused(baselineState(), { type: 'connect', a: 'HV-01:LOM3', b: 'SW-01:1' })).toMatch(/already occupied/);
});

test('rear ports are out of reach with the rear door closed — for plugging and unplugging', () => {
  const s = ok(baselineState(), { type: 'toggleRack', key: 'rearDoorOpen' });
  expect(refused(s, { type: 'connect', a: 'HV-01:LOM3', b: 'SW-01:13' })).toMatch(/Rear rack door is closed/);
  expect(refused(s, { type: 'disconnect', cableId: cableAt(s, 'HV-01:PSU1') })).toMatch(/Rear rack door is closed/);
});

test('a cable end cannot be re-homed onto a port its connector does not fit', () => {
  const s = baselineState();
  expect(refused(s, { type: 'moveEnd', cableId: cableAt(s, 'SW-01:X1'), from: 'SW-01:X1', to: 'SW-01:13' })).toMatch(/cannot terminate/);
});

test('internal parts need the chassis out, the lid off and the shroud off — and cold-swap parts need it powered down', () => {
  let s = baselineState();
  expect(refused(s, { type: 'removeComp', dev: 'HV-01', comp: 'dimmA1' })).toMatch(/Extend the chassis/);
  s = ok(s, { type: 'toggleExtend', dev: 'HV-01' });
  expect(refused(s, { type: 'removeComp', dev: 'HV-01', comp: 'dimmA1' })).toMatch(/top cover/);
  s = ok(s, { type: 'toggleLid', dev: 'HV-01' });
  expect(refused(s, { type: 'removeComp', dev: 'HV-01', comp: 'dimmA1' })).toMatch(/air shroud/);
  s = ok(s, { type: 'toggleShroud', dev: 'HV-01' });
  expect(refused(s, { type: 'removeComp', dev: 'HV-01', comp: 'dimmA1' })).toMatch(/not hot-swappable/);
});

test('a PSU cannot be pulled with its power cord still plugged in', () => {
  expect(refused(baselineState(), { type: 'removeComp', dev: 'HV-01', comp: 'psu1' })).toMatch(/Disconnect PSU1 first/);
});

test('an extended chassis blocks closing the front door; an open lid blocks sliding it back in', () => {
  const s = ok(baselineState(), { type: 'toggleExtend', dev: 'HV-01' }, { type: 'toggleLid', dev: 'HV-01' });
  expect(refused(s, { type: 'toggleRack', key: 'frontDoorOpen' })).toMatch(/slide it back in/);
  expect(refused(s, { type: 'toggleExtend', dev: 'HV-01' })).toMatch(/Refit the top cover/);
});

test('draining a node moves its VMs; shutting down an undrained one is logged as an unplanned failover', () => {
  const drained = ok(baselineState(), { type: 'setMaintenance', dev: 'HV-02', on: true });
  const d = derive(drained);
  expect(d.vms.APP01.host).toBe('HV-01');
  const planned = ok(drained, { type: 'setPower', dev: 'HV-02', on: false });
  expect(planned.events.at(-1)!.level).toBe('info');
  const unplanned = ok(baselineState(), { type: 'setPower', dev: 'HV-02', on: false });
  expect(unplanned.events.at(-1)!.msg).toMatch(/unplanned failover/);
});

test('a drain with nowhere to go is refused', () => {
  const s = ok(baselineState(), { type: 'setMaintenance', dev: 'HV-01', on: true }, { type: 'setPower', dev: 'HV-01', on: false });
  expect(refused(s, { type: 'setMaintenance', dev: 'HV-02', on: true })).toMatch(/no other node/);
});

test('losing PDU-A drops single-PSU gear on it but not dual-PSU hosts', () => {
  const s = baselineState();
  const d = derive(ok(s, { type: 'disconnect', cableId: cableAt(s, 'PDU-A:INLET') }));
  expect(d.devRunning.NTE).toBe(false);
  expect(d.devRunning['HV-01']).toBe(true);
  expect(d.checks.find((c) => c.id === 'inet')!.status).toBe('fail');
  expect(d.checks.find((c) => c.id === 'psu')!.status).toBe('warn');
});

test('the consumer strip is a single point of failure for the ONT and the desktop switch', () => {
  const d = derive(ok(baselineState(), { type: 'setStripSwitch', dev: 'STRIP', on: false }));
  expect(d.devRunning.NTE).toBe(false);
  expect(d.devRunning.DSW).toBe(false);
  expect(d.internet).toBe(false);
  expect(d.devRunning['FW-01']).toBe(true);
});

test('the label printer really lives behind the desktop switch, not on the port documented for it', () => {
  const s = baselineState();
  expect(s.swPorts['SW-01:12'].desc).toMatch(/Label printer/);
  expect(Object.values(s.cables).some((c) => c.a === 'SW-01:12' || c.b === 'SW-01:12')).toBe(false);
  const d = derive(s);
  expect(d.links['PP-A:12'].peer).toBe('DSW:2');
  expect(d.checks.find((c) => c.id === 'printers')!.status).toBe('ok');
  // Unplug the "spare" uplink and the printer goes with it.
  const cut = derive(ok(s, { type: 'disconnect', cableId: Object.values(s.cables).find((c) => c.a === 'DSW:1' || c.b === 'DSW:1')!.id }));
  expect(cut.checks.find((c) => c.id === 'printers')!.status).toBe('warn');
});

test('iSCSI paths follow the storage VLANs: a host port moved to the wrong VLAN loses its paths', () => {
  const d = derive(ok(baselineState(), { type: 'setSwPort', pid: 'SS-01:X4', cfg: { vlan: 1 } }));
  expect(d.paths['HV-02']).toBe(2);
  expect(d.paths['HV-01']).toBe(4);
});

test('server-side copper runs through the tie panels, and the endpoints still see each other', () => {
  const d = derive(baselineState());
  expect(d.links['HV-01:LOM1'].peer).toBe('SW-01:17');
  expect(d.links['SW-01:17'].peer).toBe('HV-01:LOM1');
  expect(d.links['TP-R:1'].up).toBe(true);
});

test('a broken tie link takes the circuit down while both patch cords are fine', () => {
  const s = ok(baselineState());
  s.tieFaults['TP-R:5'] = true;
  const d = derive(s);
  expect(d.links['HV-01:BMC'].up).toBe(false);
  const cords = Object.values(s.cables).filter((c) => ['TP-R:5', 'TP-F:5'].includes(c.a) || ['TP-R:5', 'TP-F:5'].includes(c.b));
  expect(cords).toHaveLength(2);
  expect(cords.every((c) => !c.faulty)).toBe(true);
  expect(refused(ok(s, { type: 'toggleRack', key: 'rearDoorOpen' }), { type: 'reterminateTie', port: 'TP-R:5' })).toMatch(/rear rack door/);
});

test('unplugging the front half of a tie circuit leaves it open, not silently up', () => {
  const s = baselineState();
  const front = Object.values(s.cables).find((c) => c.a === 'TP-F:1' || c.b === 'TP-F:1')!;
  const d = derive(ok(s, { type: 'disconnect', cableId: front.id }));
  expect(d.links['HV-01:LOM1'].up).toBe(false);
  expect(d.links['HV-01:LOM1'].reason).toMatch(/open circuit/);
});

test('the rear-facing storage switch is patched from the rear, but its airflow kit swaps from the front', () => {
  const rearShut = ok(baselineState(), { type: 'toggleRack', key: 'rearDoorOpen' });
  expect(refused(rearShut, { type: 'connect', a: 'SS-01:X5', b: 'SS-01:X6', pref: 'om4' })).toMatch(/Rear rack door/);
  const frontShut = ok(baselineState(), { type: 'toggleRack', key: 'frontDoorOpen' });
  expect(refused(frontShut, { type: 'swapAirflowKit', dev: 'SS-01', airflow: 'b2f' })).toMatch(/front rack door/);
});

test('a rear-facing switch with standard airflow breathes server exhaust', () => {
  const s = baselineState();
  s.devices['SS-01'].airflow = 'f2b';
  const d = derive(s);
  expect(d.inletC['SS-01']).toBe(d.hotAisleC);
  expect(d.inletC['SW-01']).toBe(d.coldAisleC);
});
