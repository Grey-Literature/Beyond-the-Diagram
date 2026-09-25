import { useState } from 'react';
import { CABLE_INFO, DEV, DEVICES, PORTS, PORT_KIND_NAME, STACK_MEMBERS, TIES, portSide, portWorld, tieKey } from '../../../sim/catalog';
import { DROPS, FW_POLICIES, VMS } from '../../../sim/baseline';
import { act, askFirst, useDerived, useSim, useUI } from '../store';
import { focusDevice, focusPort } from '../scene/camera';
import type { CompDef, DeviceDef, SwitchPortCfg } from '../../../sim/types';

type Status = 'ok' | 'warn' | 'fail' | 'off';
const Dot = ({ s }: { s: Status }) => <span className={`srv-dot ${s}`} />;
const niceName = (dev: string) => DEV[dev].name.replace(/\s{2,}/, ' – ');
const OUTLET_KINDS = ['c13', 'c19', 'l530r', 'nema515r'];
/** Rack position for sorting/labels; shelf gear sorts with its shelf. */
const rackU = (d: DeviceDef) => d.u || (d.place ? DEV[d.place.on].u : -1);
const uLabel = (d: DeviceDef) => (d.place ? `shelf` : d.u ? `U${d.u}${d.h > 1 ? '-' + (d.u + d.h - 1) : ''}${d.facing === 'rear' ? ' r' : ''}` : d.type === 'pdu' ? '0U' : 'wall');

export function Inspector() {
  const sel = useUI((s) => s.selected);
  const open = useUI((s) => s.inspectorOpen);
  useSim((s) => s.devices); // re-render on state changes
  if (!open && !sel) {
    return <button onClick={() => useUI.setState({ inspectorOpen: true })} className="srv-reopen right">Rack list ›</button>;
  }
  return (
    <div className="srv-panel srv-panel-right">
      <div className="srv-panel-head">
        <strong>{sel ? 'Inspector' : 'Rack A1 elevation'}</strong>
        {sel && <button onClick={() => useUI.getState().select(null)} className="srv-link srv-small">← Rack list</button>}
        <button onClick={() => useUI.setState({ selected: null, inspectorOpen: false })} className="srv-collapse" aria-label="Close panel">×</button>
      </div>
      <div className="srv-panel-body">
        {!sel && <Elevation />}
        {sel?.kind === 'device' && <DeviceView dev={sel.dev} />}
        {sel?.kind === 'port' && <PortView pid={sel.id} />}
        {sel?.kind === 'cable' && <CableView cid={sel.id} />}
        {sel?.kind === 'comp' && <CompView dev={sel.dev} comp={sel.id} />}
      </div>
    </div>
  );
}

function Elevation() {
  const d = useDerived((s) => s.d);
  const list = DEVICES.filter((x) => !['blank', 'cablemgr', 'shelf'].includes(x.type)).sort((a, b) => rackU(b) - rackU(a));
  return (
    <div>
      <p className="srv-dim">Click any hardware in the scene, or pick it here. Double-click in 3D to fly closer.</p>
      {list.map((x) => {
        const s = !d.devRunning[x.id] ? 'fail' : d.devAlerts[x.id]?.length ? 'warn' : 'ok';
        return (
          <button key={x.id} onClick={() => { useUI.getState().select({ kind: 'device', dev: x.id }); focusDevice(x.id); }} className="srv-list-btn">
            <span className="srv-u">{uLabel(x)}</span>
            <Dot s={s} />
            <span className="srv-truncate">{niceName(x.id)}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
function DeviceView({ dev }: { dev: string }) {
  const def = DEV[dev];
  const st = useSim((s) => s.devices[dev]);
  const paused = useSim((s) => !!s.maintenance[dev]);
  const d = useDerived((s) => s.d);
  const sim = useSim.getState();
  const loc = def.place ? `Rack A1 · on the shelf at U${DEV[def.place.on].u}` : def.u ? `Rack A1 · U${def.u}${def.h > 1 ? '–U' + (def.u + def.h - 1) : ''}` : def.type === 'pdu' ? 'Rack A1 · rear 0U channel' : 'Left wall backboard';
  const running = d.devRunning[dev];
  return (
    <div>
      <div className="srv-title">{niceName(dev)}</div>
      <div className="srv-dim">{def.model}</div>
      <div className="srv-dim">{loc}{def.facing === 'rear' ? ' · mounted facing the rear' : ''}</div>
      <Airflow dev={dev} />
      <div className="srv-row"><Dot s={running ? (d.devAlerts[dev].length ? 'warn' : 'ok') : 'fail'} /><span>{d.devStatus[dev]}</span></div>
      {d.devAlerts[dev].length > 0 && <ul className="srv-alerts">{d.devAlerts[dev].map((a) => <li key={a}>{a}</li>)}</ul>}
      <div className="srv-wrap">
        {def.type !== 'wallpanel' && def.type !== 'pdu' && <button className="srv-btn" onClick={() => focusDevice(dev, 'front')}>View front</button>}
        {def.type !== 'wallpanel' && <button className="srv-btn" onClick={() => focusDevice(dev, def.type === 'pdu' ? undefined : 'rear')}>View rear</button>}
        {st.lidOff && <button className="srv-btn" onClick={() => focusDevice(dev, 'top')}>View inside</button>}
        {def.type === 'wallpanel' && <button className="srv-btn" onClick={() => focusDevice(dev)}>Go to demarc</button>}
      </div>
      {def.serviceable && (
        <div className="srv-sec">
          <div className="srv-h">Service</div>
          <div className="srv-wrap">
            {def.type === 'server2u' && (
              <button className="srv-btn" onClick={() => act(sim.setMaintenance(dev, !paused), paused ? `${dev} resumed` : `${dev} paused and drained`)}>{paused ? 'Resume node' : 'Pause & drain'}</button>
            )}
            <button className={`srv-btn ${st.powerOn ? 'warn' : 'primary'}`} onClick={() => act(sim.setPower(dev, !st.powerOn))}>{st.powerOn ? 'Graceful shutdown' : 'Power on'}</button>
            <button className="srv-btn" onClick={() => { if (act(sim.toggleExtend(dev))) setTimeout(() => focusDevice(dev, st.extended ? 'front' : 'top'), 50); }}>{st.extended ? 'Slide into rack' : 'Extend on rails'}</button>
            <button className="srv-btn" disabled={!st.extended} onClick={() => { if (act(sim.toggleLid(dev)) && !st.lidOff) setTimeout(() => focusDevice(dev, 'top'), 50); }}>{st.lidOff ? 'Refit top cover' : 'Remove top cover'}</button>
            {def.type !== 'san' && <button className="srv-btn" disabled={!st.lidOff} onClick={() => act(sim.toggleShroud(dev))}>{st.shroudOff ? 'Refit air shroud' : 'Remove air shroud'}</button>}
          </div>
          <div className="srv-note">Rails: {st.extended ? 'extended (cable management arm keeps rear cables attached)' : 'racked'} · Cover: {st.lidOff ? 'removed' : 'fitted'}</div>
        </div>
      )}
      {def.type === 'ups' && <UpsConfig />}
      {def.type === 'pdu' && <PduConfig dev={dev} />}
      {def.type === 'wallpanel' && <WallConfig />}
      {def.type === 'switch' && <SwitchConfig dev={dev} />}
      {def.type === 'firewall' && <FirewallConfig />}
      {def.type === 'strip' && <StripConfig dev={dev} />}
      {def.type === 'tiepanel' && <TieCircuits dev={dev} />}
      {def.type === 'san' && <SanConfig />}
      {def.type === 'server2u' && <HostConfig dev={dev} />}
      {dev === 'BK-01' && <div className="srv-sec"><div className="srv-h">Roles</div><div>File-share witness: {d.cluster.witness ? 'reachable' : 'unreachable'}</div></div>}
      {def.comps.length > 0 && <CompList dev={dev} />}
      {def.ports.length > 0 && def.type !== 'switch' && <PortList dev={dev} />}
    </div>
  );
}

function CompList({ dev }: { dev: string }) {
  const def = DEV[dev];
  const st = useSim((s) => s.devices[dev]);
  const selectedComp = useUI((s) => (s.selected?.kind === 'comp' ? s.selected.id : null));
  const kinds = [...new Set(def.comps.map((c) => c.kind))];
  return (
    <div className="srv-sec">
      <div className="srv-h">Serviceable components</div>
      {kinds.map((k) => (
        <div key={k} className="srv-wrap">
          {def.comps.filter((c) => c.kind === k).map((c) => {
            const s = st.comps[c.id];
            const state = !s.installed ? ' empty' : s.failed ? ' fault' : '';
            return (
              <button key={c.id} title={`${c.label} – ${c.part}`} onClick={() => useUI.getState().select({ kind: 'comp', dev, id: c.id })}
                className={`srv-chip${state}${selectedComp === c.id ? ' is-sel' : ''}`}>
                {c.label.replace('Riser 1 · ', '').replace('Riser 2 · ', '')}{!s.installed ? ' (empty)' : s.failed ? ' ⚠' : ''}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PortList({ dev }: { dev: string }) {
  const def = DEV[dev];
  const d = useDerived((s) => s.d);
  const st = useSim((s) => s.devices[dev]);
  return (
    <div className="srv-sec">
      <div className="srv-h">Ports & connections</div>
      {def.ports.filter((p) => !p.comp || st.comps[p.comp]?.installed).map((p) => {
        const l = d.links[p.id];
        return (
          <button key={p.id} onClick={() => { useUI.getState().select({ kind: 'port', dev, id: p.id }); focusPort(p.id); }} className="srv-list-btn">
            <Dot s={l.kind === 'none' ? 'off' : l.up ? 'ok' : 'fail'} />
            <span className="srv-port-name">{p.name}</span>
            <span className="srv-truncate srv-dim">{l.peer ? `→ ${l.peer}` : DROPS[p.id] ? DROPS[p.id].name : OUTLET_KINDS.includes(p.kind) ? (d.outletLive[p.id] ? 'live, unused' : 'dead') : '—'}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
function vlanList() {
  return Object.entries(useSim.getState().vlans).map(([k, v]) => ({ id: Number(k), name: v }));
}

function SwitchPortEditor({ pid, compact }: { pid: string; compact?: boolean }) {
  const cfg = useSim((s) => s.swPorts[pid]);
  const led = useDerived((s) => s.d.leds[pid]);
  const [allowed, setAllowed] = useState(cfg?.allowed.join(',') ?? '');
  if (!cfg) return null;
  const set = (c: Partial<SwitchPortCfg>) => useSim.getState().setSwPort(pid, c);
  const p = PORTS[pid];
  return (
    <div className={`srv-swport${compact ? ' compact' : ''}`}>
      {compact && <button className="srv-link srv-port-name" onClick={() => { useUI.getState().select({ kind: 'port', dev: p.deviceId, id: pid }); focusPort(pid); }}>{p.name}</button>}
      <Dot s={led === 'green' ? 'ok' : led === 'amber' ? 'warn' : 'off'} />
      <select className="srv-select" value={cfg.mode} onChange={(e) => set({ mode: e.target.value as 'access' | 'trunk' })}>
        <option value="access">access</option>
        <option value="trunk">trunk</option>
      </select>
      <select className="srv-select" value={cfg.vlan} onChange={(e) => set({ vlan: Number(e.target.value) })} title={cfg.mode === 'trunk' ? 'native VLAN' : 'access VLAN'}>
        {vlanList().map((v) => <option key={v.id} value={v.id}>{cfg.mode === 'trunk' ? 'nat ' : ''}{v.id} {v.name}</option>)}
      </select>
      {cfg.mode === 'trunk' && <input className="srv-input" value={allowed} placeholder="10,20" onChange={(e) => setAllowed(e.target.value)} onBlur={() => set({ allowed: allowed.split(/[ ,]+/).map(Number).filter((n) => n > 0 && n < 4095) })} title="allowed VLANs" />}
      <label className="srv-label srv-small"><input className="srv-check-input" type="checkbox" checked={cfg.enabled} onChange={(e) => set({ enabled: e.target.checked })} />up</label>
      {cfg.errDisabled && <span className="srv-tag">err-disabled</span>}
      {compact && cfg.desc && <span className="srv-truncate srv-dim srv-small">{cfg.desc}</span>}
    </div>
  );
}

function SwitchConfig({ dev }: { dev: string }) {
  const d = useDerived((s) => s.d);
  const def = DEV[dev];
  const ports = def.ports.filter((p) => useSim.getState().swPorts[p.id]);
  const stackMember = STACK_MEMBERS.includes(dev);
  return (
    <>
      {stackMember && <div className="srv-sec">
        <div className="srv-h">Stack</div>
        <div>{d.stack.formed ? `Stack formed · member ${STACK_MEMBERS.indexOf(dev) + 1} · ${d.stack.links} stack link(s)${d.stack.links < 2 ? ' – ring broken' : ''}` : 'Stack NOT formed – standalone'}</div>
        <div className="srv-wrap">
          {def.ports.filter((p) => !useSim.getState().swPorts[p.id]).map((p) => (
            <button key={p.id} className="srv-btn" onClick={() => { useUI.getState().select({ kind: 'port', dev, id: p.id }); focusPort(p.id); }}>
              <Dot s={d.links[p.id].kind === 'none' ? 'off' : d.links[p.id].up ? 'ok' : 'fail'} /> {p.name}
            </button>
          ))}
        </div>
      </div>}
      <div className="srv-sec">
        <div className="srv-h">Interface configuration</div>
        {ports.map((p) => <SwitchPortEditor key={p.id} pid={p.id} compact />)}
      </div>
    </>
  );
}

function FirewallConfig() {
  const pol = useSim((s) => s.fwPolicies);
  const subs = useSim((s) => s.fwSubifs);
  const d = useDerived((s) => s.d);
  const sim = useSim.getState();
  return (
    <>
      <div className="srv-sec">
        <div className="srv-h">Interfaces</div>
        <div>WAN: {d.internet ? <span className="srv-ok-text">up – internet reachable</span> : <span className="srv-fail-text">{d.internetReason}</span>}</div>
        <div className="srv-dim">Inside VLAN sub-interfaces (tagged on LAN1–LAN4):</div>
        <div className="srv-wrap">
          {vlanList().filter((v) => v.id !== 1).map((v) => (
            <label key={v.id} className="srv-label"><input className="srv-check-input" type="checkbox" checked={subs.includes(v.id)} onChange={(e) => sim.setFwSubif(v.id, e.target.checked)} />{v.id} {v.name}</label>
          ))}
        </div>
      </div>
      <div className="srv-sec">
        <div className="srv-h">Security policy</div>
        {FW_POLICIES.map((p) => (
          <label key={p.key} className="srv-label"><input className="srv-check-input" type="checkbox" checked={!!pol[p.key]} onChange={(e) => sim.setFwPolicy(p.key, e.target.checked)} />{p.label}</label>
        ))}
        <div className="srv-note">Implicit deny for everything else.</div>
      </div>
    </>
  );
}

function SanConfig() {
  const map = useSim((s) => s.sanMap);
  const d = useDerived((s) => s.d);
  return (
    <div className="srv-sec">
      <div className="srv-h">Storage</div>
      <div>Disk group DG01 (RAID-6, 12 drives): <span className={d.san.failed ? 'srv-warn-text' : 'srv-ok-text'}>{d.san.raid}</span></div>
      <div>Controllers online: {d.san.ctrls}/2</div>
      <div className="srv-dim">Volumes: LUN0 CSV-01 (4 TB) · LUN1 CSV-02 (4 TB)</div>
      <div className="srv-dim">Host access list (iSCSI initiator IQNs allowed to see the volumes):</div>
      {['HV-01', 'HV-02'].map((h) => (
        <label key={h} className="srv-label"><input className="srv-check-input" type="checkbox" checked={!!map[h]} onChange={(e) => useSim.getState().setSanMap(h, e.target.checked)} />{h} — {d.paths[h]} active path(s)</label>
      ))}
    </div>
  );
}

type HostTag = 'mgmtTag' | 'vmTag' | 'clusterTag';

function HostTagSelect({ dev, k }: { dev: string; k: HostTag }) {
  const value = useSim((s) => s.hostNet[dev][k]);
  return (
    <select className="srv-select" value={value ?? 'u'} onChange={(e) => useSim.getState().setHostNet(dev, { [k]: e.target.value === 'u' ? null : Number(e.target.value) })}>
      <option value="u">untagged</option>
      {vlanList().filter((v) => v.id !== 1).map((v) => <option key={v.id} value={v.id}>VLAN {v.id}</option>)}
    </select>
  );
}

function HostConfig({ dev }: { dev: string }) {
  const d = useDerived((s) => s.d);
  const paused = useSim((s) => !!s.maintenance[dev]);
  const node = d.cluster.nodes[dev];
  return (
    <>
      <div className="srv-sec">
        <div className="srv-h">Hypervisor networking</div>
        <div className="srv-grid2">
          <span>Mgmt vNIC on 10G team (NIC1 P1+P2)</span><HostTagSelect dev={dev} k="mgmtTag" />
          <span>VM port group on 10G team</span><HostTagSelect dev={dev} k="vmTag" />
          <span>Cluster/LM team (LOM 1+2)</span><HostTagSelect dev={dev} k="clusterTag" />
        </div>
      </div>
      <div className="srv-sec">
        <div className="srv-h">Cluster & storage</div>
        <div>Node: {node.up ? (node.inQuorum ? 'Up, in quorum' : 'Up, NOT in quorum') : 'Down'}{paused ? ' · paused (drained)' : ''}</div>
        <div>iSCSI MPIO paths to SAN-01: {d.paths[dev]}/4</div>
        <div>VMs hosted:</div>
        {VMS.filter((v) => d.vms[v.id].host === dev).map((v) => <div key={v.id} className="srv-indent">• {v.id} <span className="srv-dim">({v.role}){d.vms[v.id].reachable ? '' : ' – unreachable'}</span></div>)}
        {VMS.every((v) => d.vms[v.id].host !== dev) && <div className="srv-indent srv-dim">none</div>}
      </div>
    </>
  );
}

function UpsConfig() {
  const d = useDerived((s) => s.d);
  const charge = useSim((s) => s.upsCharge);
  const on = useSim((s) => s.devices['UPS-01'].powerOn);
  return (
    <div className="srv-sec">
      <div className="srv-h">UPS status</div>
      <div>Mode: <b className={d.ups.mode === 'online' ? 'srv-ok-text' : 'srv-warn-text'}>{d.ups.mode.toUpperCase()}</b> · Input: {d.ups.inputLive ? '120V OK' : 'NO INPUT'}</div>
      <div>Load: {Math.round(d.ups.loadW)} W ({Math.round((d.ups.loadW / 2700) * 100)}%) · Battery {Math.round(charge * 100)}% · Runtime ≈ {d.ups.runtimeMin.toFixed(1)} min</div>
      <div>External battery module: {d.ups.ebm ? 'connected' : <span className="srv-warn-text">not connected</span>}</div>
      <div className="srv-wrap">
        <button className={`srv-btn ${on ? 'warn' : 'primary'}`} onClick={() => { if (on) askFirst('Turn UPS output OFF? The entire rack will lose power.', 'Turn output off', () => act(useSim.getState().setUpsOutput(false))); else act(useSim.getState().setUpsOutput(true)); }}>{on ? 'Turn output off' : 'Turn output on'}</button>
      </div>
    </div>
  );
}

function Airflow({ dev }: { dev: string }) {
  const def = DEV[dev];
  const kit = useSim((s) => s.devices[dev].airflow);
  const inlet = useDerived((s) => s.d.inletC[dev]);
  const cold = useDerived((s) => s.d.coldAisleC);
  if (inlet === undefined) return null;
  const flow = kit ?? def.airflow ?? 'f2b';
  const other = flow === 'f2b' ? 'b2f' : 'f2b';
  return (
    <div className="srv-row srv-small">
      <span className={inlet > 35 ? 'srv-warn-text' : 'srv-dim'}>Inlet {inlet.toFixed(0)} °C{inlet > cold ? ' – drawing rack exhaust' : ''}</span>
      <span className="srv-dim">· airflow {flow === 'f2b' ? 'port-side intake' : 'port-side exhaust'}</span>
      {def.airflow && <button className="srv-link" onClick={() => act(useSim.getState().dispatch({ type: 'swapAirflowKit', dev, airflow: other }), `${dev}: airflow kit swapped`)}>swap kit</button>}
    </div>
  );
}

function TieCircuits({ dev }: { dev: string }) {
  const d = useDerived((s) => s.d);
  const def = DEV[dev];
  return (
    <div className="srv-sec">
      <div className="srv-h">Tie circuits (this panel ⇄ {dev === 'TP-F' ? 'TP-R' : 'TP-F'})</div>
      {def.ports.filter((p) => d.portCable[p.id] || d.portCable[TIES[p.id]]).map((p) => {
        const l = d.links[p.id];
        const twin = d.links[TIES[p.id]];
        const ends = [d.portCable[p.id] ? l.peer : null, d.portCable[TIES[p.id]] ? twin.peer : null];
        return (
          <button key={p.id} onClick={() => { useUI.getState().select({ kind: 'port', dev, id: p.id }); focusPort(p.id); }} className="srv-list-btn">
            <Dot s={l.kind === 'none' && twin.kind === 'none' ? 'off' : l.up ? 'ok' : 'fail'} />
            <span className="srv-port-name">{p.label}</span>
            <span className="srv-truncate srv-dim">{ends[0] ?? '—'} ⇄ {ends[1] ?? '—'}</span>
          </button>
        );
      })}
    </div>
  );
}

function StripConfig({ dev }: { dev: string }) {
  const on = useSim((s) => s.devices[dev].powerOn);
  const status = useDerived((s) => s.d.devStatus[dev]);
  return (
    <div className="srv-sec">
      <div className="srv-h">Power strip</div>
      <div>{status}</div>
      <div className="srv-note">Consumer gear, plugged into a PDU outlet through a C14 adapter cord. No monitoring, no alerts, one rocker switch.</div>
      <div className="srv-wrap">
        <button className={`srv-btn ${on ? 'warn' : 'primary'}`} onClick={() => act(useSim.getState().setStripSwitch(dev, !on))}>{on ? 'Flip rocker OFF' : 'Flip rocker ON'}</button>
      </div>
    </div>
  );
}

function PduConfig({ dev }: { dev: string }) {
  const brk = useSim((s) => s.pduBreaker[dev]);
  const d = useDerived((s) => s.d);
  return (
    <div className="srv-sec">
      <div className="srv-h">PDU</div>
      <div>{d.pduLive[dev] ? `Energized · ${d.pduLoadA[dev].toFixed(1)} A` : 'No input power'}</div>
      <label className="srv-label"><input className="srv-check-input" type="checkbox" checked={brk !== false} onChange={(e) => useSim.getState().setPduBreaker(dev, e.target.checked)} />Branch breaker closed</label>
    </div>
  );
}

function WallConfig() {
  const on = useSim((s) => s.utilityOn);
  return (
    <div className="srv-sec">
      <div className="srv-h">Panel LP-2</div>
      <div>Breaker CKT 14 (UPS-01 feed): <b className={on ? 'srv-ok-text' : 'srv-fail-text'}>{on ? 'ON' : 'OFF / TRIPPED'}</b></div>
      <div className="srv-wrap">
        <button className={`srv-btn ${on ? 'warn' : 'primary'}`} onClick={() => act(useSim.getState().setUtility(!on))}>{on ? 'Switch off (simulate outage)' : 'Reset breaker'}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function cableTest(cid: string): string {
  const c = useSim.getState().cables[cid];
  const a = portWorld(PORTS[c.a]).pos, b = portWorld(PORTS[c.b]).pos;
  const len = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 1.35 + 0.4;
  const fiber = c.type === 'om4' || c.type === 'os2sc';
  if (c.type.startsWith('pwr') || c.type === 'ebm') return c.faulty ? 'FAIL – open conductor' : 'PASS – continuity OK';
  if (c.faulty) return fiber ? `FAIL – insertion loss 34.7 dB (break ≈ ${(len * 0.6).toFixed(1)} m)` : `FAIL – pair 3-6 open at ${(len * 0.55).toFixed(1)} m`;
  return fiber ? `PASS – loss 0.4 dB over ${len.toFixed(1)} m` : `PASS – ${len.toFixed(1)} m, wiremap OK`;
}

function CableActions({ cid, from }: { cid: string; from?: string }) {
  const [res, setRes] = useState<string | null>(null);
  const c = useSim((s) => s.cables[cid]);
  if (!c) return null;
  return (
    <div>
      <div className="srv-wrap">
        <button className="srv-btn" onClick={() => setRes(cableTest(cid))}>{c.type === 'om4' || c.type === 'os2sc' ? 'Light-meter test' : 'Cable test'}</button>
        {from && <button className="srv-btn" onClick={() => useUI.setState({ pending: { from, cableId: cid } })}>Move this end…</button>}
        <button className="srv-btn" onClick={() => { if (act(useSim.getState().replaceCable(cid), 'Cable swapped for new stock')) setRes(null); }}>Replace with new cable</button>
        <button className="srv-btn warn" onClick={() => { if (act(useSim.getState().disconnect(cid))) useUI.getState().select(from ? { kind: 'port', dev: PORTS[from].deviceId, id: from } : null); }}>Unplug & remove</button>
      </div>
      {res && <div className={`srv-result ${res.startsWith('PASS') ? 'pass' : 'fail'}`}>{res}</div>}
    </div>
  );
}

function PortView({ pid }: { pid: string }) {
  const p = PORTS[pid];
  const d = useDerived((s) => s.d);
  const l = d.links[pid];
  const c = d.portCable[pid];
  const drop = DROPS[pid];
  const peer = l.peer ? PORTS[l.peer] : null;
  const swCfg = useSim((s) => s.swPorts[pid]);
  return (
    <div>
      <button className="srv-link dim" onClick={() => useUI.getState().select({ kind: 'device', dev: p.deviceId })}>{niceName(p.deviceId)}</button>
      <div className="srv-title">Port {p.label} <span className="srv-dim">({portSide(p) ?? 'wall'} of rack)</span></div>
      <div className="srv-dim">{PORT_KIND_NAME[p.kind]}{p.poe ? ' · PoE+' : ''}{p.role ? ` · ${p.role}` : ''}</div>
      {drop && <div>Horizontal run → <b>{drop.name}</b></div>}
      {TIES[pid] && <TieLink pid={pid} />}
      <div className="srv-row"><Dot s={l.kind === 'none' ? 'off' : l.up ? 'ok' : 'fail'} />{l.kind === 'none' ? (OUTLET_KINDS.includes(p.kind) ? (d.outletLive[pid] ? 'Outlet live – nothing plugged in' : 'Outlet de-energized') : 'Nothing connected') : l.up ? (l.kind === 'power' ? 'Energized' : `Link up · ${l.speed}`) : l.reason}</div>
      {c && (
        <div className="srv-sec">
          <div className="srv-h">Cable</div>
          <div>{CABLE_INFO[c.type].name}</div>
          <div className="srv-dim">Label: {c.label ?? <span className="srv-warn-text">none — unlabeled</span>}</div>
          {peer && <button className="srv-link" onClick={() => { useUI.getState().select({ kind: 'port', dev: peer.deviceId, id: peer.id }); focusPort(peer.id); }}>Far end → {peer.deviceId} {peer.label} ↗</button>}
          <CableActions cid={c.id} from={pid} />
        </div>
      )}
      {!c && (
        <div className="srv-wrap">
          <button className="srv-btn primary" onClick={() => useUI.setState({ pending: { from: pid } })}>Start new cable here</button>
        </div>
      )}
      <div className="srv-wrap"><button className="srv-btn" onClick={() => focusPort(pid)}>Zoom to port</button></div>
      {swCfg && (
        <div className="srv-sec">
          <div className="srv-h">Switchport config</div>
          <SwitchPortEditor pid={pid} />
          <div className="srv-note">{swCfg.desc}</div>
        </div>
      )}
    </div>
  );
}

function TieLink({ pid }: { pid: string }) {
  const [res, setRes] = useState<string | null>(null);
  const broken = useSim((s) => !!s.tieFaults[tieKey(pid)]);
  const twin = TIES[pid];
  return (
    <div>
      <div>Permanent tie link → <b>{twin.replace(':', ' ')}</b></div>
      <div className="srv-wrap">
        <button className="srv-btn" onClick={() => setRes(broken ? 'FAIL – pair 1-2 open at the punch-down' : 'PASS – permanent link, wiremap OK')}>Test permanent link</button>
        <button className="srv-btn" onClick={() => { if (act(useSim.getState().dispatch({ type: 'reterminateTie', port: pid }), 'Tie link re-terminated')) setRes(null); }}>Re-terminate</button>
      </div>
      {res && <div className={`srv-result ${res.startsWith('PASS') ? 'pass' : 'fail'}`}>{res}</div>}
    </div>
  );
}

function CableView({ cid }: { cid: string }) {
  const c = useSim((s) => s.cables[cid]);
  const l = useDerived((s) => s.d.links[c?.a ?? '']);
  if (!c) return <div className="srv-dim">Cable removed.</div>;
  return (
    <div>
      <div className="srv-title">{CABLE_INFO[c.type].name}</div>
      <div className="srv-dim">Label: {c.label ?? <span className="srv-warn-text">none — unlabeled</span>}</div>
      <div className="srv-row"><Dot s={l?.up ? 'ok' : 'fail'} />{l?.up ? (l.kind === 'power' ? 'Energized' : `Link up ${l.speed ?? ''}`) : l?.reason}</div>
      {[c.a, c.b].map((pid, i) => (
        <div key={pid}>
          <button className="srv-link" onClick={() => { useUI.getState().select({ kind: 'port', dev: PORTS[pid].deviceId, id: pid }); focusPort(pid); }}>End {i ? 'B' : 'A'}: {PORTS[pid].deviceId} {PORTS[pid].label} ↗</button>
        </div>
      ))}
      <CableActions cid={cid} />
    </div>
  );
}

function CompView({ dev, comp }: { dev: string; comp: string }) {
  const def = DEV[dev];
  const c = def.comps.find((x) => x.id === comp) as CompDef;
  const st = useSim((s) => s.devices[dev]);
  const rack = useSim((s) => s.rack);
  const powered = useDerived((s) => s.d.devPowered[dev]);
  const cs = st.comps[comp];
  const portCable = useDerived((s) => s.d.portCable);
  const cabled = def.ports.filter((p) => p.comp === comp && portCable[p.id]).map((p) => p.label);
  const isServer = def.type === 'server2u' || def.type === 'server1u';
  const req: [string, boolean][] = [];
  if (c.access === 'front') req.push(['Front door open', rack.frontDoorOpen]);
  if (c.access === 'rear') req.push(['Rear door open', rack.rearDoorOpen]);
  if (c.access === 'internal') { req.push(['Chassis extended', st.extended], ['Top cover removed', st.lidOff]); if (c.needsShroudOff) req.push(['Air shroud removed', st.shroudOff]); }
  if (!c.hotSwap && isServer) req.push(['Server shut down', !(st.powerOn && powered)]);
  if (cabled.length) req.push([`Cables unplugged (${cabled.join(', ')})`, false]);
  return (
    <div>
      <button className="srv-link dim" onClick={() => useUI.getState().select({ kind: 'device', dev })}>{niceName(dev)}</button>
      <div className="srv-title">{c.label}</div>
      <div className="srv-dim">{c.part}</div>
      <div className="srv-row"><Dot s={!cs.installed ? 'off' : cs.failed ? 'warn' : 'ok'} />{!cs.installed ? 'Slot empty' : cs.failed ? 'FAULT – replace' : 'Installed, healthy'}</div>
      <div className="srv-note">{c.hotSwap ? 'Hot-swappable' : 'Cold-swap only'} · {c.access === 'internal' ? 'internal' : `${c.access} access`}</div>
      <div className="srv-sec">
        <div className="srv-h">Procedure checks</div>
        {req.length === 0 && <div className="srv-dim">No prerequisites.</div>}
        {req.map(([t, ok]) => <div key={t} className={ok ? 'srv-ok-text' : 'srv-warn-text'}>{ok ? '✓' : '✗'} {t}</div>)}
      </div>
      <div className="srv-wrap">
        {cs.installed ? (
          <button className="srv-btn warn" onClick={() => act(useSim.getState().removeComp(dev, comp), `${c.label} removed`)}>Remove {c.kind === 'drive' ? 'drive' : 'part'}</button>
        ) : (
          <button className="srv-btn primary" onClick={() => act(useSim.getState().installComp(dev, comp), `New ${c.label} installed`)}>Install new part from spares</button>
        )}
        <button className="srv-btn" onClick={() => focusDevice(dev, c.access === 'internal' ? 'top' : c.access === 'rear' ? 'rear' : 'front')}>Show me</button>
      </div>
    </div>
  );
}
