import { SCENARIOS } from '../../../sim/baseline';
import { useSim, useUI, act, askFirst } from '../store';
import { PRESETS } from '../scene/camera';

const COLORS = ['#2563eb', '#eab308', '#dc2626', '#16a34a', '#f97316', '#a855f7', '#e5e7eb', '#111827'];

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return <button onClick={onClick} className={`srv-btn${on ? ' is-on' : ''}`}>{label}</button>;
}

export function TopBar() {
  const scenarioId = useSim((s) => s.scenarioId);
  const rack = useSim((s) => s.rack);
  const pref = useUI((s) => s.cablePref);
  const color = useUI((s) => s.cableColor);
  const toggle = (k: keyof typeof rack) => act(useSim.getState().toggleRack(k));
  return (
    <div className="srv-topbar">
      <div className="srv-brand">
        <a href="/">~/</a>
        <span className="srv-brand-name">server-room</span>
      </div>
      <select
        value={scenarioId}
        onChange={(e) => {
          const id = e.target.value;
          askFirst(`Load "${SCENARIOS.find((s) => s.id === id)?.title}"? The current rack state will be replaced.`, 'Load scenario', () => { useSim.getState().loadScenario(id); useUI.setState({ selected: null, pending: null }); });
        }}
        className="srv-select"
        title="Scenario"
      >
        {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
      <div className="srv-sep" />
      <div className="srv-group">
        <span className="srv-group-label">View</span>
        {(['front', 'rear'] as const).map((k) => (
          <button key={k} onClick={() => useUI.getState().flyTo(PRESETS[k].pos, PRESETS[k].target)} className="srv-btn">{PRESETS[k].label}</button>
        ))}
        <select value="" onChange={(e) => { const p = PRESETS[e.target.value]; if (p) useUI.getState().flyTo(p.pos, p.target); }} className="srv-select">
          <option value="">More views…</option>
          {Object.entries(PRESETS).filter(([k]) => k !== 'front' && k !== 'rear').map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        </select>
      </div>
      <div className="srv-sep" />
      <div className="srv-group">
        <span className="srv-group-label">Rack</span>
        <Toggle on={rack.frontDoorOpen} label="Front door" onClick={() => toggle('frontDoorOpen')} />
        <Toggle on={rack.rearDoorOpen} label="Rear door" onClick={() => toggle('rearDoorOpen')} />
        <Toggle on={rack.leftPanelOff} label="L side off" onClick={() => toggle('leftPanelOff')} />
        <Toggle on={rack.rightPanelOff} label="R side off" onClick={() => toggle('rightPanelOff')} />
      </div>
      <div className="srv-sep" />
      <div className="srv-group">
        <span className="srv-group-label">Cable</span>
        <select value={pref} onChange={(e) => useUI.setState({ cablePref: e.target.value })} className="srv-select">
          <option value="auto">Auto (by ports)</option>
          <option value="cat6">Cat6 patch</option>
          <option value="dac">SFP+ DAC</option>
          <option value="om4">OM4 LC fiber</option>
        </select>
        <span className="srv-group" title="Cat6 jacket color">
          {COLORS.map((c) => (
            <button key={c} onClick={() => useUI.setState({ cableColor: c })} className={`srv-swatch${color === c ? ' is-on' : ''}`} style={{ background: c }} aria-label={`Cable color ${c}`} />
          ))}
        </span>
      </div>
      <div className="srv-spacer">
        <button onClick={() => askFirst('Reset this scenario to its starting state? Everything you changed will be undone.', 'Reset', () => { useSim.getState().loadScenario(scenarioId); useUI.setState({ selected: null, pending: null }); })} className="srv-btn danger">Reset</button>
      </div>
    </div>
  );
}
