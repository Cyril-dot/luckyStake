import { useEffect, useState } from 'react';
import { api } from './api';

export type CashoutBetInfo = { id: string; stake: number; potentialReturn: number };

function money(value: number) { return `GH₵${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export function cashoutFallback(bet: CashoutBetInfo) { return Math.max(0, bet.potentialReturn * 0.5); }

/** Live cashout offer from the backend; null when the preview call fails. */
export async function fetchCashoutPreview(betId: string): Promise<number | null> {
  try {
    const p = await api<Record<string, unknown>>('GET', `/api/bets/${encodeURIComponent(betId)}/cashout/preview?pct=100`);
    const base = Number(p.estimatedPayout ?? p.amount ?? p.cashoutAmount ?? NaN);
    return Number.isFinite(base) ? base : null;
  } catch { return null; }
}

function CashoutStyles() {
  return <style>{`
    .ls-cashout-scrim{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:18px;background:rgba(10,6,16,.72);backdrop-filter:blur(3px)}
    .ls-cashout-dialog{width:min(420px,100%);border:1px solid #5a456b;border-radius:14px;background:linear-gradient(145deg,#2b2138,#1c1527);color:#fff;box-shadow:0 24px 60px rgba(0,0,0,.5);overflow:hidden;font-family:'Rajdhani',Manrope,system-ui,sans-serif}
    .ls-cashout-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #433253}
    .ls-cashout-head h3{margin:0;font-size:18px;font-weight:800}
    .ls-cashout-x{border:0;background:transparent;color:#a99db2;font-size:20px;cursor:pointer;line-height:1}
    .ls-cashout-body{padding:18px;display:grid;gap:14px}
    .ls-cashout-amount{text-align:center;padding:14px;border-radius:10px;background:rgba(214,238,70,.08);border:1px solid rgba(214,238,70,.25)}
    .ls-cashout-amount small{display:block;color:#a99db2;font-size:11px;letter-spacing:.08em;text-transform:uppercase}
    .ls-cashout-amount strong{display:block;margin-top:4px;font-size:34px;color:#d6ee46;font-weight:800}
    .ls-cashout-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .ls-cashout-modes button{padding:11px;border:1px solid #5a456b;border-radius:8px;background:#21182e;color:#b7abbf;font:800 13px 'Rajdhani';cursor:pointer}
    .ls-cashout-modes button.active{border-color:#d6ee46;background:rgba(214,238,70,.12);color:#d6ee46}
    .ls-cashout-slider label{display:flex;justify-content:space-between;color:#a99db2;font-size:12px;margin-bottom:6px}
    .ls-cashout-slider label b{color:#d6ee46}
    .ls-cashout-slider input{width:100%;accent-color:#d6ee46}
    .ls-cashout-meta{display:flex;justify-content:space-between;color:#a99db2;font-size:12px}
    .ls-cashout-meta b{color:#fff}
    .ls-cashout-confirm{padding:14px;border:0;border-radius:8px;background:#d6ee46;color:#211b29;font:800 15px 'Rajdhani';cursor:pointer}
    .ls-cashout-confirm:disabled{opacity:.55;cursor:wait}
    .ls-cashout-error{padding:10px 12px;border-radius:8px;background:rgba(174,64,91,.16);border:1px solid #854459;color:#ffb7c5;font-size:12px}
    .ls-cashout-success{text-align:center;padding:26px 18px;display:grid;gap:10px;justify-items:center}
    .ls-cashout-success .material-symbols-rounded{font-size:46px;color:#d6ee46}
    .ls-cashout-success h3{margin:0;font-size:20px}
    .ls-cashout-success strong{font-size:30px;color:#d6ee46}
    .ls-cashout-success p{margin:0;color:#a99db2;font-size:12px}
  `}</style>;
}

export default function CashoutDialog({ bet, onClose, onDone }: { bet: CashoutBetInfo; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [pct, setPct] = useState(50);
  const [preview, setPreview] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<number | null>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      const p = await fetchCashoutPreview(bet.id);
      if (!dead) setPreview(p ?? cashoutFallback(bet));
    })();
    return () => { dead = true; };
  }, [bet.id]);

  const offer = preview == null ? null : mode === 'full' ? preview : Math.round(preview * pct) / 100;

  const confirm = async () => {
    if (busy || offer == null) return;
    setBusy(true); setError('');
    try {
      const updated = mode === 'full'
        ? await api<Record<string, unknown>>('POST', `/api/bets/${encodeURIComponent(bet.id)}/cashout/full`)
        : await api<Record<string, unknown>>('POST', `/api/bets/${encodeURIComponent(bet.id)}/cashout/partial?pct=${pct}`);
      const payout = Number((updated as Record<string, unknown>)?.payout ?? (updated as Record<string, unknown>)?.cashoutAmount ?? offer);
      setSuccess(Number.isFinite(payout) ? payout : offer);
    } catch (e) { setError(e instanceof Error ? e.message : 'Cashout failed. Try again.'); }
    finally { setBusy(false); }
  };

  return <div className="ls-cashout-scrim" onClick={onClose}>
    <CashoutStyles />
    <div className="ls-cashout-dialog" onClick={e => e.stopPropagation()}>
      <div className="ls-cashout-head"><h3>Cash out</h3><button type="button" className="ls-cashout-x" onClick={onClose} aria-label="Close">×</button></div>
      {success != null ? <div className="ls-cashout-success">
        <span className="material-symbols-rounded">check_circle</span>
        <h3>Cashout successful</h3>
        <strong>{money(success)}</strong>
        <p>Credited to your wallet.</p>
        <button type="button" className="ls-cashout-confirm" onClick={() => { onDone(); onClose(); }}>Done</button>
      </div> : <div className="ls-cashout-body">
        <div className="ls-cashout-amount"><small>{mode === 'full' ? 'Full cashout — you get' : `Partial cashout (${pct}%) — you get`}</small><strong>{offer == null ? '…' : money(offer)}</strong></div>
        <div className="ls-cashout-modes">
          <button type="button" className={mode === 'full' ? 'active' : ''} onClick={() => setMode('full')}>Full</button>
          <button type="button" className={mode === 'partial' ? 'active' : ''} onClick={() => setMode('partial')}>Partial</button>
        </div>
        {mode === 'partial' && <div className="ls-cashout-slider">
          <label><span>Cashout percentage</span><b>{pct}%</b></label>
          <input type="range" min={10} max={90} step={5} value={pct} onChange={e => setPct(Number(e.target.value))} aria-label="Cashout percentage" />
        </div>}
        <div className="ls-cashout-meta"><span>Stake</span><b>{money(bet.stake)}</b></div>
        <div className="ls-cashout-meta"><span>Potential return</span><b>{money(bet.potentialReturn)}</b></div>
        {error && <div className="ls-cashout-error">{error}</div>}
        <button type="button" className="ls-cashout-confirm" onClick={confirm} disabled={busy || offer == null}>{busy ? 'Processing…' : offer == null ? 'Loading offer…' : `Cash out ${money(offer)}`}</button>
      </div>}
    </div>
  </div>;
}
