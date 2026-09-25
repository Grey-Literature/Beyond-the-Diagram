import { useEffect, useRef, useState } from 'react';
import { PORTS, CABLE_INFO } from '../../../sim/catalog';
import { WIDE, useSim, useUI } from '../store';

export function Tooltip() {
  const hover = useUI((s) => s.hover);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mv = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const x = Math.min(e.clientX + 16, window.innerWidth - el.offsetWidth - 8);
      const y = Math.min(e.clientY + 16, window.innerHeight - el.offsetHeight - 8);
      el.style.transform = `translate(${x}px, ${y}px)`;
    };
    window.addEventListener('pointermove', mv);
    return () => window.removeEventListener('pointermove', mv);
  }, []);
  const lineTone = (l: string) => (l.startsWith('✗') || l.startsWith('○') ? ' bad' : l.startsWith('✓') || l.startsWith('●') ? ' ok' : '');
  return (
    <div ref={ref} className="srv-tip-wrap" style={{ display: hover ? 'block' : 'none' }}>
      {hover && (
        <div className={`srv-tip${hover.tone === 'bad' ? ' bad' : hover.tone === 'ok' ? ' ok' : ''}`}>
          <div className="srv-tip-title">{hover.title}</div>
          {hover.lines?.filter(Boolean).map((l, i) => <div key={i} className={`srv-tip-line${lineTone(l)}`}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

export function Toast() {
  const toast = useUI((s) => s.toast);
  // Each toast is identified by its timestamp; hide it once its timer fires.
  const [expired, setExpired] = useState<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setExpired(toast.t), toast.tone === 'bad' ? 4200 : 2600);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast || expired === toast.t) return null;
  return <div className={`srv-toast${toast.tone === 'bad' ? ' bad' : toast.tone === 'ok' ? ' ok' : ''}`}>{toast.msg}</div>;
}

export function PendingBanner() {
  const pending = useUI((s) => s.pending);
  const cablePref = useUI((s) => s.cablePref);
  const cable = useSim((s) => (pending?.cableId ? s.cables[pending.cableId] : null));
  if (!pending) return null;
  const p = PORTS[pending.from];
  return (
    <div className="srv-banner">
      {cable ? <>Moving the <b>{CABLE_INFO[cable.type].name}</b> end from <b>{p.deviceId} {p.label}</b></> : <>New cable from <b>{p.deviceId} {p.label}</b> · stock: <b>{cablePref === 'auto' ? 'auto-select' : CABLE_INFO[cablePref].name}</b></>}
      {' '}— compatible free ports glow green. Click one, or press <kbd className="srv-kbd">Esc</kbd>.
      <button className="srv-btn" onClick={() => useUI.setState({ pending: null })}>Cancel</button>
    </div>
  );
}

export function ConfirmBar() {
  const ask = useUI((s) => s.ask);
  if (!ask) return null;
  const close = () => useUI.setState({ ask: null });
  return (
    <div className="srv-banner srv-confirm" role="alertdialog" aria-label="Confirm">
      {ask.msg}
      <button className="srv-btn primary" autoFocus onClick={() => { close(); ask.onYes(); }}>{ask.yes}</button>
      <button className="srv-btn" onClick={close}>Cancel</button>
    </div>
  );
}

export function HelpHint() {
  const [open, setOpen] = useState(WIDE);
  if (!open) {
    return <button onClick={() => setOpen(true)} className="srv-help">Controls</button>;
  }
  return (
    <div className="srv-help">
      <span><b>Drag</b> orbit</span><span><b>Right-drag</b> pan</span><span><b>Wheel</b> zoom to cursor</span><span><b>Dbl-click</b> fly to point</span><span><b>WASD/QE</b> walk</span><span><b>Click port</b> start cable · <b>drag port→port</b> connect</span>
      <button onClick={() => setOpen(false)} className="srv-collapse" aria-label="Hide controls">✕</button>
    </div>
  );
}
