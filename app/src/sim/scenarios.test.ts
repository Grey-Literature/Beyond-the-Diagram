// Scenario harness: the mechanical version of "does every scenario actually
// do what its ticket says?" For each one:
//   1. baseline is all-green,
//   2. loading the scenario breaks exactly the checks we expect — nothing
//      unrelated,
//   3. a scripted fix made only of real learner actions (same rules the UI
//      enforces: doors, rails, hot-swap, cables in the way) returns every
//      check to green.
// If a scenario's intended failures drift after an engine change, or a fix
// stops being physically possible, this is what catches it.
import { describe, expect, test } from 'vitest';
import { SCENARIOS, baselineState, scenarioState } from './baseline';
import { apply, type Action } from './actions';
import { derive } from './engine';
import type { SimState } from './types';

function failing(s: SimState): string[] {
  return derive(s).checks.filter((c) => c.status !== 'ok').map((c) => c.id).sort();
}

function cableAt(s: SimState, port: string): string {
  const c = Object.values(s.cables).find((x) => x.a === port || x.b === port);
  if (!c) throw new Error(`no cable at ${port}`);
  return c.id;
}

/** Steps may be plain actions, or functions of the current state (for cable ids). */
type Step = Action | ((s: SimState) => Action);

function run(s: SimState, steps: Step[]): SimState {
  steps.forEach((step, i) => {
    const a = typeof step === 'function' ? step(s) : step;
    const r = apply(s, a);
    if (!r.ok) throw new Error(`step ${i} (${a.type}) refused: ${r.error}`);
    s = r.state;
  });
  return s;
}

/** Cold-swap an internal server part the proper way: drain, shut down, open up, swap, close, restart, resume. */
function coldSwap(dev: string, comp: string, opts: { shroud?: boolean; drain?: boolean; recable?: Step[]; uncable?: Step[] } = {}): Step[] {
  const { shroud = false, drain = true, recable = [], uncable = [] } = opts;
  return [
    ...(drain ? [{ type: 'setMaintenance', dev, on: true } as Action] : []),
    { type: 'setPower', dev, on: false },
    ...uncable,
    { type: 'toggleExtend', dev },
    { type: 'toggleLid', dev },
    ...(shroud ? [{ type: 'toggleShroud', dev } as Action] : []),
    { type: 'removeComp', dev, comp },
    { type: 'installComp', dev, comp },
    ...(shroud ? [{ type: 'toggleShroud', dev } as Action] : []),
    { type: 'toggleLid', dev },
    { type: 'toggleExtend', dev },
    ...recable,
    { type: 'setPower', dev, on: true },
    ...(drain ? [{ type: 'setMaintenance', dev, on: false } as Action] : []),
  ];
}

interface Case { expect: string[]; fix: Step[] }

const CASES: Record<string, Case> = {
  'san-disk': {
    expect: ['raid'],
    fix: [{ type: 'removeComp', dev: 'SAN-01', comp: 'drive5' }, { type: 'installComp', dev: 'SAN-01', comp: 'drive5' }],
  },
  psu: {
    expect: ['HV-01', 'psu'],
    fix: [
      (s) => ({ type: 'disconnect', cableId: cableAt(s, 'HV-01:PSU2') }),
      { type: 'removeComp', dev: 'HV-01', comp: 'psu2' },
      { type: 'installComp', dev: 'HV-01', comp: 'psu2' },
      { type: 'connect', a: 'PDU-B:3', b: 'HV-01:PSU2' },
      { type: 'connect', a: 'PDU-B:5', b: 'SAN-01:PSU2' },
    ],
  },
  dimm: {
    expect: ['HV-02'],
    fix: coldSwap('HV-02', 'dimmB3', { shroud: true }),
  },
  fiber: {
    expect: ['paths-HV-01', 'paths-HV-02'],
    fix: [
      (s) => ({ type: 'replaceCable', cableId: cableAt(s, 'HV-01:NIC2-P2') }),
      { type: 'connect', a: 'SAN-01:B-P1', b: 'SS-01:X11', pref: 'om4' },
    ],
  },
  vlan: {
    expect: ['cloud', 'uinet', 'users'],
    fix: [3, 4, 5].map((i) => ({ type: 'setSwPort', pid: `SW-01:${i}`, cfg: { vlan: 20 } }) as Action),
  },
  nic: {
    expect: ['APP01', 'HV-02', 'backup', 'hm-HV-02', 'users'],
    fix: coldSwap('HV-02', 'nic1', {
      uncable: [(s) => ({ type: 'disconnect', cableId: cableAt(s, 'HV-02:NIC1-P1') }), (s) => ({ type: 'disconnect', cableId: cableAt(s, 'HV-02:NIC1-P2') })],
      recable: [{ type: 'connect', a: 'HV-02:NIC1-P1', b: 'SW-01:X2' }, { type: 'connect', a: 'HV-02:NIC1-P2', b: 'SW-02:X2' }],
    }),
  },
  stack: {
    expect: ['cloud', 'oob', 'phones', 'stack', 'uinet', 'users'],
    fix: [
      (s) => ({ type: 'replaceCable', cableId: cableAt(s, 'SW-01:STK1') }),
      { type: 'connect', a: 'SW-01:STK2', b: 'SW-02:STK1' },
    ],
  },
  power: {
    expect: ['ups', 'util'],
    fix: [{ type: 'setUtility', on: true }, { type: 'connect', a: 'EBM-01:EBM', b: 'UPS-01:EBM' }],
  },
  firewall: {
    expect: ['cloud', 'printers', 'users'],
    fix: [{ type: 'setFwPolicy', key: '20>10', on: true }],
  },
  'lun-access': {
    expect: ['APP01', 'paths-HV-02'],
    fix: [{ type: 'setSanMap', host: 'HV-02', on: true }],
  },
  patch: {
    expect: ['cloud', 'uinet', 'users'],
    fix: [(s) => ({ type: 'replaceCable', cableId: cableAt(s, 'PP-A:7') })],
  },
  cluster: {
    expect: ['clnet'],
    fix: [{ type: 'setHostNet', host: 'HV-02', cfg: { clusterTag: null } }],
  },
  airflow: {
    expect: ['thermal'],
    fix: [{ type: 'swapAirflowKit', dev: 'SS-01', airflow: 'b2f' }],
  },
  'tie-link': {
    expect: ['oob'],
    fix: [{ type: 'reterminateTie', port: 'TP-F:5' }],
  },
  strip: {
    expect: ['cloud', 'inet', 'phones', 'printers', 'uinet'],
    fix: [{ type: 'setStripSwitch', dev: 'STRIP', on: true }],
  },
};

test('baseline is all green', () => {
  expect(failing(baselineState())).toEqual([]);
});

test('every scenario except baseline/greenfield has a harness case', () => {
  const ids = SCENARIOS.map((s) => s.id).filter((id) => id !== 'baseline' && id !== 'greenfield').sort();
  expect(Object.keys(CASES).sort()).toEqual(ids);
});

describe.each(Object.entries(CASES))('scenario %s', (id, c) => {
  test('breaks exactly the expected checks', () => {
    expect(failing(scenarioState(id))).toEqual([...c.expect].sort());
  });
  test('scripted fix returns everything to green', () => {
    expect(failing(run(scenarioState(id), c.fix))).toEqual([]);
  });
});

test('greenfield can be built all the way back up to baseline health', () => {
  const base = baselineState();
  let s = scenarioState('greenfield');
  const steps: Step[] = [];
  // Memory for HV-02 from the spares kit (it's powered off in greenfield).
  steps.push({ type: 'toggleExtend', dev: 'HV-02' }, { type: 'toggleLid', dev: 'HV-02' }, { type: 'toggleShroud', dev: 'HV-02' });
  Object.keys(base.devices['HV-02'].comps).filter((k) => k.startsWith('dimm')).forEach((comp) => steps.push({ type: 'installComp', dev: 'HV-02', comp }));
  steps.push({ type: 'toggleShroud', dev: 'HV-02' }, { type: 'toggleLid', dev: 'HV-02' }, { type: 'toggleExtend', dev: 'HV-02' });
  // Every baseline cable, re-run by hand.
  Object.values(base.cables).forEach((c) => steps.push({ type: 'connect', a: c.a, b: c.b, pref: c.type }));
  // Configuration.
  Object.entries(base.swPorts).forEach(([pid, cfg]) => steps.push({ type: 'setSwPort', pid, cfg }));
  Object.keys(base.sanMap).forEach((host) => steps.push({ type: 'setSanMap', host, on: true }));
  Object.keys(base.fwPolicies).forEach((key) => steps.push({ type: 'setFwPolicy', key, on: true }));
  // Power up.
  steps.push({ type: 'setUpsOutput', on: true });
  ['SAN-01', 'HV-01', 'HV-02', 'BK-01'].forEach((dev) => steps.push({ type: 'setPower', dev, on: true }));
  s = run(s, steps);
  expect(failing(s)).toEqual([]);
});
