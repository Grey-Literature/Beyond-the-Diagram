import { useState } from 'react';
import { SCENARIOS } from '../../../sim/baseline';
import { WIDE, useDerived, useSim, useUI } from '../store';
import { focusDevice } from '../scene/camera';

export function HealthPanel() {
  const checks = useDerived((s) => s.d.checks);
  const scenarioId = useSim((s) => s.scenarioId);
  const events = useSim((s) => s.events);
  const [open, setOpen] = useState(WIDE);
  const [tab, setTab] = useState<'health' | 'log'>('health');
  const sc = SCENARIOS.find((s) => s.id === scenarioId);
  const groups = [...new Set(checks.map((c) => c.group))];
  const bad = checks.filter((c) => c.status !== 'ok').length;
  if (!open) {
    return <button onClick={() => setOpen(true)} className="srv-reopen left">{bad ? `⚠ ${bad} issues` : '✓ Healthy'} · Show status</button>;
  }
  return (
    <div className="srv-panel srv-panel-left">
      <div className="srv-panel-head">
        <button onClick={() => setTab('health')} className={`srv-tab${tab === 'health' ? ' is-on' : ''}`}>Environment</button>
        <button onClick={() => setTab('log')} className={`srv-tab${tab === 'log' ? ' is-on' : ''}`}>Event log</button>
        <button onClick={() => setOpen(false)} className="srv-collapse" aria-label="Collapse panel">‹</button>
      </div>
      <div className="srv-panel-body">
        {sc && (
          <div className="srv-ticket">
            <div className="srv-kicker">Ticket</div>
            <div className="srv-title">{sc.title}</div>
            <div>{sc.ticket}</div>
            {scenarioId !== 'baseline' && (
              <div className={`srv-ticket-status${bad === 0 ? ' ok' : ''}`}>{bad === 0 ? '✓ All checks passing – ticket can be resolved' : `${bad} check(s) not passing`}</div>
            )}
          </div>
        )}
        {tab === 'health' && groups.map((g) => (
          <div key={g} className="srv-mb">
            <div className="srv-h">{g}</div>
            {checks.filter((c) => c.group === g).map((c) => (
              <button key={c.id} onClick={() => { if (c.focus) { useUI.getState().select({ kind: 'device', dev: c.focus }); focusDevice(c.focus); } }} className="srv-list-btn top">
                <span className={`srv-dot ${c.status}`} />
                <span>
                  <span className="srv-check-label">{c.label}</span>
                  <span className={`srv-check-detail${c.status === 'ok' ? '' : ` ${c.status}`}`}>{c.detail}</span>
                </span>
              </button>
            ))}
          </div>
        ))}
        {tab === 'log' && (
          <div className="srv-log">
            {[...events].reverse().map((e, i) => (
              <div key={i} className={e.level === 'info' ? '' : e.level}>
                <span className="srv-log-time">{new Date(e.t).toLocaleTimeString()}</span> {e.msg}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
