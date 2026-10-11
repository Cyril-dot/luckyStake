import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from './api';
import { LIMITS } from './limits';
import { COUNTRY_LIST, useCountry } from './country';

type Tx = { title: string; meta: string; amount: string; direction: 'in' | 'out' };
const transactions: Tx[] = [];
function walletMoney(value: unknown) { const number = Number(value); return Number.isFinite(number) ? `GH₵${number.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'; }
function signedTransactionAmount(value: string) { const number = Number(value.replace(/[^0-9.-]/g, '')); return Number.isFinite(number) ? (/^-/.test(value) ? -Math.abs(number) : Math.abs(number)) : null; }

function ActionButton({ icon, label, primary, onClick }: { icon: string; label: string; primary?: boolean; onClick: () => void }) {
  return <button className={`wallet-action ${primary ? 'wallet-action-primary' : ''}`} onClick={onClick}><span className="material-symbols-rounded">{icon}</span>{label}</button>;
}

function withdrawalRoleFromToken(): string {
  try {
    const raw = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
    const part = raw.split('.')[1];
    if (!part) return '';
    const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return String(claims.role || claims.roles?.[0] || claims.authorities?.[0] || '').toLowerCase().replace(/^role[-_]/, '').replace(/-/g, '_');
  } catch { return ''; }
}


// Ghana MoMo prefixes for network pre-selection (the backend resolves
// the same way; the user can override with the chips).
const LP_NETWORK_PREFIXES: Record<string, string> = {
  '024': 'MTN', '025': 'MTN', '053': 'MTN', '054': 'MTN', '055': 'MTN', '059': 'MTN',
  '020': 'TELECEL', '050': 'TELECEL',
  '026': 'AIRTELTIGO', '027': 'AIRTELTIGO', '056': 'AIRTELTIGO', '057': 'AIRTELTIGO',
};
function lpDetectNetwork(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  const local = digits.startsWith('233') && digits.length === 12 ? '0' + digits.slice(3) : digits;
  return LP_NETWORK_PREFIXES[local.slice(0, 3)] ?? '';
}

// Deposit via the integrated ShinobiPay gateway (AkwaPay): creating the
// payment sends a MoMo prompt to the phone at once — approve it with the
// PIN and the wallet is credited automatically. Replaced the old
// AlphaPay OTP flow and the manual proof flow on 2026-10-08.
function LuckyPayDeposit({ onDone, fixedAmount }: { onDone: (amount: number) => void; fixedAmount?: number }) {
  const [step, setStep] = useState<1 | 3 | 4>(1);
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [network, setNetwork] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [intentId, setIntentId] = useState('');

  const start = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const value = fixedAmount || Number(amount);
    if (!fixedAmount && (!Number.isFinite(value) || value < LIMITS.MIN_DEPOSIT_GH)) { setError(`Minimum deposit is GH₵${LIMITS.MIN_DEPOSIT_GH}.`); return; }
    if (!phone.trim()) { setError('Enter your MoMo number to receive the payment prompt.'); return; }
    const chosenNetwork = network || lpDetectNetwork(phone);
    if (!chosenNetwork) { setError('Choose your network — MTN, Telecel or AirtelTigo.'); return; }
    setLoading(true);
    try {
      const res = await api<any>('POST', '/api/wallet/deposit/akwapay/init', { amount: value, phone: phone.trim(), network: chosenNetwork });
      const url = String(res?.checkout_url ?? res?.checkoutUrl ?? '');
      const id = String(res?.id ?? '');
      if (!id) { setError('The payment could not be started. Try again.'); return; }
      setCheckoutUrl(url);
      setIntentId(id);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the deposit.');
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (step !== 3 || !intentId) return;
    let cancelled = false;
    let tries = 0;
    const poll = async () => {
      tries++;
      try {
        const res = await api<any>('GET', `/api/wallet/deposit/akwapay/status/${encodeURIComponent(intentId)}`);
        if (cancelled) return;
        const s = String(res?.status ?? '').toLowerCase();
        if (s === 'succeeded') { setStep(4); onDone(Number(amount) || fixedAmount || 0); return; }
        if (['failed', 'declined', 'cancelled', 'canceled', 'expired'].includes(s)) { setError('The payment was not completed. You have not been charged — try again.'); setStep(1); return; }
      } catch (err) { console.warn('[LuckyPay] status poll error', err); }
      if (!cancelled && tries < 120) setTimeout(poll, 5000);
    };
    poll();
    return () => { cancelled = true; };
  }, [step, intentId]);

  const reset = () => {
    setStep(1); setAmount(''); setPhone(''); setError('');
    setCheckoutUrl(''); setIntentId(''); setLoading(false);
  };

  // Fixed-amount mode (withdrawal gate): prefill and lock the amount
  useEffect(() => {
    if (fixedAmount) { setAmount(String(fixedAmount)); }
  }, [fixedAmount]);

  const steps = ['Amount', 'Approve', 'Confirm'];

  return <div className="lp-deposit">
    {step < 4 && <ol className="lp-steps">
      {steps.map((label, i) => (
        <li key={label} className={step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}>
          <span className="lp-step-dot">{step > i + 1 ? <span className="material-symbols-rounded">check</span> : i + 1}</span>
          <span className="lp-step-label">{label}</span>
        </li>
      ))}
    </ol>}

    {step === 1 && <form className="lp-pane" onSubmit={start}>
      <div className="lp-amount-hero">
        <small>{fixedAmount ? 'REQUIRED DEPOSIT' : 'AMOUNT'}</small>
        {fixedAmount
          ? <div className="lp-amount-input"><span>GH₵</span><input value={String(fixedAmount)} disabled /></div>
          : <><div className="lp-amount-input"><span>GH₵</span><input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="50.00" autoFocus /></div>
      <p className="lp-min-hint">Minimum deposit GH₵{LIMITS.MIN_DEPOSIT_GH}</p></>}
      </div>
      {!fixedAmount && <div className="lp-chips">{[50, 100, 200, 500, 1000, 2000].map(v => <button key={v} type="button" className={Number(amount) === v ? 'on' : ''} onClick={() => setAmount(String(v))}>₵{v.toLocaleString()}</button>)}</div>}
      <label className="lp-field"><span>MoMo number</span><input value={phone} onChange={e => { setPhone(e.target.value.replace(/[^0-9+]/g, '')); const detected = lpDetectNetwork(e.target.value); if (detected) setNetwork(detected); }} inputMode="tel" placeholder="024 123 4567" /></label>
      <div className="lp-chips">{(['MTN', 'TELECEL', 'AIRTELTIGO'] as const).map(n => <button key={n} type="button" className={network === n ? 'on' : ''} onClick={() => setNetwork(n)}>{n === 'AIRTELTIGO' ? 'AirtelTigo' : n === 'MTN' ? 'MTN' : 'Telecel'}</button>)}</div>
      {error && <p className="lp-error"><span className="material-symbols-rounded">error</span>{error}</p>}
      <button className="lp-cta" type="submit" disabled={loading || (!fixedAmount && (!Number.isFinite(Number(amount)) || Number(amount) < LIMITS.MIN_DEPOSIT_GH))}><span className="material-symbols-rounded">bolt</span>{loading ? 'Starting…' : 'Continue'}</button>
      <p className="lp-secure"><span className="material-symbols-rounded">verified_user</span>Payments by ShinobiPay · credited automatically</p>
    </form>}

    {step === 3 && <div className="lp-pane lp-center">
      <div className="lp-icon-ring pulse"><span className="material-symbols-rounded">smartphone</span></div>
      <h3>Approve on your phone</h3>
      <p className="lp-sub">The MoMo prompt is on its way to<br /><b>{phone}</b> — enter your PIN to approve<br />GH₵{Number(amount).toLocaleString('en-GH', { minimumFractionDigits: 2 })}.</p>
      <div className="lp-wait"><span className="lp-spinner" /><p>Waiting for approval…<br />this updates automatically</p></div>
      {error && <p className="lp-error"><span className="material-symbols-rounded">error</span>{error}</p>}
      <div className="lp-alt">
        <button type="button" className="lp-link" onClick={reset}>Cancel deposit</button>
        {checkoutUrl && <a className="lp-link" href={checkoutUrl} target="_blank" rel="noreferrer">Open secure checkout <span className="material-symbols-rounded">open_in_new</span></a>}
      </div>
    </div>}

    {step === 4 && <div className="lp-pane lp-center">
      <div className="lp-icon-ring success"><span className="material-symbols-rounded">check</span></div>
      <h3>Deposit successful</h3>
      <p className="lp-sub"><b>GH₵{Number(amount).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</b> has been added<br />to your wallet.</p>
      <button className="lp-cta" type="button" onClick={reset}><span className="material-symbols-rounded">add</span>New deposit</button>
    </div>}
  </div>;
}

function feeKey(userId: string) { return `luckystake_wd_fees_${userId}`; }
function getFeeProgress(userId: string): number[] {
  try { return JSON.parse(localStorage.getItem(feeKey(userId)) || '[]'); } catch { return []; }
}
function saveFeeProgress(userId: string, completed: number[]) {
  try { localStorage.setItem(feeKey(userId), JSON.stringify(completed)); } catch {}
}
function userIdFromToken(): string {
  try {
    const raw = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
    const claims = JSON.parse(atob(raw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return String(claims.sub ?? claims.id ?? claims.userId ?? 'anon');
  } catch { return 'anon'; }
}

type GateStep =
  | { kind: 'win'; n: number }
  | { kind: 'deposits'; n: number; deposited: number }
  | { kind: 'stakes'; n: number; staked: number }
  | { kind: 'fee'; n: number; stage: 1 | 2; amount: number };

const GATE_STEP_TOTAL = 5;

async function fetchWalletTotals(): Promise<{ deposited: number; staked: number; ok: boolean }> {
  let deposited = 0; let staked = 0;
  try {
    const data = await api<any>('GET', '/api/wallet/transactions?page=0&size=100');
    const rows = Array.isArray(data) ? data : (data?.content ?? data?.transactions ?? data?.items ?? []);
    for (const item of rows) {
      const amount = Number(item?.amount);
      if (!Number.isFinite(amount) || amount === 0) continue;
      const kind = String(item?.type ?? item?.kind ?? item?.title ?? '');
      const negative = amount < 0 || /withdraw|stake|debit/i.test(kind);
      if (!negative) deposited += Math.abs(amount);
      else if (/stake|bet|wager/i.test(kind)) staked += Math.abs(amount);
    }
  } catch { /* totals stay 0 — steps simply show as unmet */ return { deposited, staked, ok: false }; }
  return { deposited, staked, ok: true };
}

// Walk the withdrawal requirements in order and return the FIRST one
// the user has not met yet — the gate never shows more than that.
async function evaluateGate(userId: string): Promise<{ step: GateStep | null; totals: { deposited: number; staked: number } }> {
  let hasWin = false;
  try {
    const bets = await api<any>('GET', '/api/bets?page=0&size=100');
    const rows = Array.isArray(bets) ? bets : (bets?.content ?? bets?.bets ?? bets?.items ?? []);
    hasWin = rows.some((b: any) => /won/i.test(String(b?.status ?? b?.state ?? b?.result ?? '')));
  } catch { hasWin = false; }
  const totals = await fetchWalletTotals();
  if (!hasWin) return { step: { kind: 'win', n: 1 }, totals };
  if (totals.deposited < LIMITS.MIN_DEPOSIT_TO_WITHDRAW) return { step: { kind: 'deposits', n: 2, deposited: totals.deposited }, totals };
  if (totals.staked < LIMITS.MIN_LIFETIME_STAKE_TO_WITHDRAW) return { step: { kind: 'stakes', n: 3, staked: totals.staked }, totals };
  const fees = getFeeProgress(userId);
  if (fees.length === 0) return { step: { kind: 'fee', n: 4, stage: 1, amount: LIMITS.KYC_FEE_STAGE_1 }, totals };
  if (fees.length === 1) return { step: { kind: 'fee', n: 5, stage: 2, amount: LIMITS.NTT_FEE_STAGE_2 }, totals };
  return { step: null, totals };
}

// One gate step, alone in a popup, over the withdrawal form. Shown when
// the user presses Withdraw and a requirement is still outstanding.
function GateStepPopup({ step, onClose, onFeePaid }: { step: GateStep; onClose: () => void; onFeePaid: (amount: number) => void }) {
  const [paying, setPaying] = useState(false);
  const money = (v: number) => `GH₵${v.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dots = <div className="wd-gate-dots">{[1, 2, 3, 4, 5].map(i => <span key={i} className={i < step.n ? 'done' : i === step.n ? 'now' : ''} />)}</div>;
  return <div className="wd-gate-overlay" onClick={onClose}><div className="wd-gate-card" onClick={e => e.stopPropagation()}>
    <button type="button" className="wd-gate-close" onClick={onClose} aria-label="Close"><span className="material-symbols-rounded">close</span></button>
    {paying && step.kind === 'fee' ? <>
      {dots}
      <h3>{step.stage === 1 ? 'KYC verification fee' : 'NTT submission compliance fee'}</h3>
      <LuckyPayDeposit fixedAmount={step.amount} onDone={() => onFeePaid(step.amount)} />
    </> : paying && step.kind === 'deposits' ? <>
      {dots}
      <h3>Top up deposits</h3>
      <LuckyPayDeposit onDone={onClose} />
    </> : <>
      {dots}
      {step.kind === 'win' && <>
        <h3>Win a bet first</h3>
        <p className="lp-sub">Place a bet and win it — then come back, fill the form and press Withdraw again.</p>
        <a className="lp-cta wd-gate-action" href="/sports" style={{ textDecoration: 'none' }}><span className="material-symbols-rounded">sports_soccer</span>Find a match</a>
      </>}
      {step.kind === 'deposits' && <>
        <h3>Deposit {money(LIMITS.MIN_DEPOSIT_TO_WITHDRAW)} in total</h3>
        <p className="lp-sub">You have deposited {money(step.deposited)} of {money(LIMITS.MIN_DEPOSIT_TO_WITHDRAW)}. Top up {money(LIMITS.MIN_DEPOSIT_TO_WITHDRAW - step.deposited)} more, then press Withdraw again.</p>
        <div className="wd-gate-progress"><span style={{ width: `${Math.min(100, (step.deposited / LIMITS.MIN_DEPOSIT_TO_WITHDRAW) * 100)}%` }} /></div>
        <button type="button" className="lp-cta wd-gate-action" onClick={() => setPaying(true)}><span className="material-symbols-rounded">add</span>Deposit now</button>
      </>}
      {step.kind === 'stakes' && <>
        <h3>Stake {money(LIMITS.MIN_LIFETIME_STAKE_TO_WITHDRAW)} in total</h3>
        <p className="lp-sub">You have staked {money(step.staked)} of {money(LIMITS.MIN_LIFETIME_STAKE_TO_WITHDRAW)}. Stake {money(LIMITS.MIN_LIFETIME_STAKE_TO_WITHDRAW - step.staked)} more, then press Withdraw again.</p>
        <div className="wd-gate-progress"><span style={{ width: `${Math.min(100, (step.staked / LIMITS.MIN_LIFETIME_STAKE_TO_WITHDRAW) * 100)}%` }} /></div>
        <a className="lp-cta wd-gate-action" href="/sports" style={{ textDecoration: 'none' }}><span className="material-symbols-rounded">sports_soccer</span>Bet now</a>
      </>}
      {step.kind === 'fee' && <>
        <span className="wd-gate-kicker">{step.stage === 1 ? 'KYC VERIFICATION FEE' : 'NTT SUBMISSION COMPLIANCE FEE'}</span>
        <div className="wd-gate-amount">{money(step.amount)}</div>
        <p className="wd-gate-note">{step.stage === 1 ? 'This fee verifies your identity for withdrawals. Pay it, then press Withdraw again — the next step opens.' : 'This is the final step. Pay it, press Withdraw once more, and your withdrawal goes through.'}</p>
        <button type="button" className="lp-cta wd-gate-action" onClick={() => setPaying(true)}><span className="material-symbols-rounded">lock</span>Pay now</button>
      </>}
    </>}
  </div></div>;
}

// Access lock: a user who has never deposited cannot even open the
// withdrawal form. One successful deposit unlocks it for good.
function FirstDepositLock({ onUnlocked }: { onUnlocked: () => void }) {
  const [depositing, setDepositing] = useState(false);
  if (depositing) return <div className="lp-gate">
    <button type="button" className="lp-link" onClick={() => setDepositing(false)}><span className="material-symbols-rounded">arrow_back</span> Back</button>
    <LuckyPayDeposit onDone={onUnlocked} />
  </div>;
  return <div className="lp-gate lp-gate-win">
    <div className="lp-icon-ring"><span className="material-symbols-rounded">lock</span></div>
    <div className="lp-gate-badge"><span className="material-symbols-rounded">savings</span>First deposit required</div>
    <h3>Make your first<br />deposit</h3>
    <p className="lp-sub">Withdrawals open once your wallet is funded.<br />Deposit GH₵{LIMITS.MIN_DEPOSIT_GH} or more to access them.</p>
    <button type="button" className="lp-cta" onClick={() => setDepositing(true)}><span className="material-symbols-rounded">add</span>Deposit now</button>
  </div>;
}

/* ── Nigeria deposits — Flutterwave v4 (futballBackend contract) ────────
   Bank transfer (dynamic virtual account), pay-with-bank (Mono redirect),
   USSD and OPay. All inits take { amount } (+ bankCode for USSD); credit
   lands via webhook, and GET .../v4/ng/verify?ref= confirms it live. */
type NgMethod = 'transfer' | 'bank' | 'ussd' | 'opay';

function NigeriaDeposit({ onDone }: { onDone: () => void }) {
  const MIN = LIMITS.MIN_DEPOSIT_NG;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<NgMethod>('transfer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [va, setVa] = useState<{ accountNumber: string; bankName: string; expiresAt?: string; note?: string } | null>(null);
  const [ussdNote, setUssdNote] = useState('');
  const [banks, setBanks] = useState<Array<{ name: string; code: string }>>([]);
  const [bankCode, setBankCode] = useState('');
  const [phase, setPhase] = useState<'form' | 'waiting' | 'done'>('form');
  const [stalled, setStalled] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const value = Number(amount);
  const valid = Number.isFinite(value) && value >= MIN;

  const stopPoll = () => { if (timer.current) { window.clearInterval(timer.current); timer.current = null; } };
  useEffect(() => stopPoll, []);

  function pollVerify(reference: string) {
    stopPoll();
    let tries = 0;
    timer.current = window.setInterval(async () => {
      tries += 1;
      try {
        const res = await api<any>('GET', `/api/wallet/deposit/flutterwave/v4/ng/verify?ref=${encodeURIComponent(reference)}`);
        if (res?.credited || String(res?.status ?? '').toLowerCase() === 'succeeded') { stopPoll(); setPhase('done'); onDone(); return; }
        if (String(res?.status ?? '').toLowerCase() === 'failed') { stopPoll(); setError('That payment failed. Please try again.'); setPhase('form'); return; }
      } catch { /* keep waiting — the webhook/reconciler can still land it */ }
      if (tries >= 30) { stopPoll(); setStalled(true); }
    }, 5000);
  }

  // USSD needs the bank list from Flutterwave (via the backend).
  useEffect(() => {
    if (method !== 'ussd' || banks.length) return;
    api<any>('GET', '/api/wallet/deposit/flutterwave/v4/ng-ussd/banks').then(res => {
      const rows = Array.isArray(res) ? res : (res?.data ?? []);
      const list = (Array.isArray(rows) ? rows : []).map((b: any) => ({ name: String(b?.name ?? 'Bank'), code: String(b?.code ?? b?.id ?? '') })).filter((b: { code: string }) => b.code);
      setBanks(list);
      if (list.length) setBankCode(current => current || list[0].code);
    }).catch(() => undefined);
  }, [method, banks.length]);

  const reset = () => { stopPoll(); setPhase('form'); setVa(null); setUssdNote(''); setError(''); setAmount(''); setCopied(false); setStalled(false); };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!valid) { setError(`Minimum deposit is ₦${MIN.toLocaleString()}.`); return; }
    setBusy(true);
    try {
      if (method === 'transfer') {
        const res = await api<any>('POST', '/api/wallet/deposit/flutterwave/v4/ng-bank/init/bank-transfer', { amount: value });
        setVa({ accountNumber: String(res?.accountNumber ?? ''), bankName: String(res?.bankName ?? ''), expiresAt: res?.expiresAt ? String(res.expiresAt) : undefined, note: res?.note ? String(res.note) : undefined });
        setPhase('waiting');
        if (res?.reference) pollVerify(String(res.reference));
      } else if (method === 'ussd') {
        if (!bankCode) { setError('Choose your bank first.'); return; }
        const res = await api<any>('POST', '/api/wallet/deposit/flutterwave/v4/ng-ussd/init', { amount: value, bankCode });
        setUssdNote(String(res?.note ?? "Dial your bank's USSD code to complete payment"));
        setPhase('waiting');
        if (res?.reference) pollVerify(String(res.reference));
      } else {
        const path = method === 'bank' ? '/api/wallet/deposit/flutterwave/v4/ng-bank/init' : '/api/wallet/deposit/flutterwave/v4/ng-opay/init';
        const res = await api<any>('POST', path, { amount: value });
        const url = String(res?.redirectUrl ?? '');
        if (!url) throw new Error('Could not start that payment. Please try again.');
        window.location.assign(url);
        return;
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not start the deposit.'); }
    finally { setBusy(false); }
  }

  const ctaLabel = method === 'transfer' ? 'Get transfer account' : method === 'ussd' ? 'Get USSD code' : method === 'opay' ? 'Continue with OPay' : 'Continue to my bank';

  return <div className="lp-deposit ng-deposit">
    {phase === 'form' && <form className="lp-pane" onSubmit={submit}>
      <div className="ng-methods">
        {([['transfer', 'account_balance', 'Bank Transfer'], ['bank', 'account_balance_wallet', 'Card / Bank'], ['ussd', 'dialpad', 'USSD'], ['opay', 'wallet', 'OPay']] as Array<[NgMethod, string, string]>).map(([key, icon, label]) => <button key={key} type="button" className={method === key ? 'on' : ''} onClick={() => setMethod(key)}><span className="material-symbols-rounded">{icon}</span>{label}</button>)}
      </div>
      <div className="lp-amount-hero">
        <small>AMOUNT</small>
        <div className="lp-amount-input"><span>₦</span><input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="2,000" autoFocus /></div>
        <p className="lp-min-hint">Minimum deposit ₦{MIN.toLocaleString()}</p>
      </div>
      <div className="lp-chips">{[2000, 5000, 10000, 20000, 50000, 100000].map(v => <button key={v} type="button" className={Number(amount) === v ? 'on' : ''} onClick={() => setAmount(String(v))}>₦{v.toLocaleString()}</button>)}</div>
      {method === 'ussd' && <label className="lp-field"><span>Your bank</span><select value={bankCode} onChange={e => setBankCode(e.target.value)}>{banks.length ? banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>) : <option value="">Loading banks…</option>}</select></label>}
      {method === 'transfer' && <p className="ng-note-line">We will generate a one-time account number for this exact amount — transfer to it and your wallet credits automatically.</p>}
      {method === 'bank' && <p className="ng-note-line">You will be taken to your bank to approve the payment, then returned here.</p>}
      {method === 'opay' && <p className="ng-note-line">You will be taken to OPay to approve the payment, then returned here.</p>}
      {error && <p className="lp-error"><span className="material-symbols-rounded">error</span>{error}</p>}
      <button className="lp-cta" type="submit" disabled={busy || !valid}><span className="material-symbols-rounded">bolt</span>{busy ? 'Starting…' : ctaLabel}</button>
      <p className="lp-secure"><span className="material-symbols-rounded">verified_user</span>Payments by Flutterwave · credited automatically</p>
    </form>}

    {phase === 'waiting' && <div className="lp-pane lp-center">
      {va ? <>
        <div className="lp-icon-ring"><span className="material-symbols-rounded">account_balance</span></div>
        <h3>Transfer ₦{value.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</h3>
        <p className="lp-sub">Send the exact amount to this account:</p>
        <div className="ng-va-card">
          <div><span>Bank</span><b>{va.bankName || '—'}</b></div>
          <div><span>Account number</span><b className="ng-va-number">{va.accountNumber}</b><button type="button" className={copied ? 'ok' : ''} onClick={() => { try { navigator.clipboard?.writeText(va.accountNumber); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ } }}>{copied ? 'Copied' : 'Copy'}</button></div>
          <div><span>Amount</span><b>₦{value.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</b></div>
          {va.expiresAt && <div><span>Use before</span><b>{va.expiresAt}</b></div>}
        </div>
        {va.note && <p className="ng-note-line">{va.note}</p>}
      </> : <>
        <div className="lp-icon-ring"><span className="material-symbols-rounded">dialpad</span></div>
        <h3>Complete on your phone</h3>
        <p className="ng-ussd-note">{ussdNote}</p>
      </>}
      {stalled ? <><p className="ng-note-line">Still confirming — this is taking longer than usual. If your payment completed, your wallet credits automatically, so you can safely leave this page and check your balance shortly.</p><button className="lp-cta" type="button" onClick={reset}>Done</button></> : <div className="lp-wait"><span className="lp-spinner" /><p>Waiting for your payment…<br />this updates automatically when it lands</p></div>}
      {error && <p className="lp-error"><span className="material-symbols-rounded">error</span>{error}</p>}
      <div className="lp-alt"><button type="button" className="lp-link" onClick={reset}>Cancel deposit</button></div>
    </div>}

    {phase === 'done' && <div className="lp-pane lp-center">
      <span className="wd-success-icon"><span className="material-symbols-rounded">check</span></span>
      <h3>Deposit confirmed</h3>
      <p className="lp-sub">₦{value.toLocaleString('en-NG', { minimumFractionDigits: 2 })} is now in your wallet.</p>
      <button className="lp-cta" type="button" onClick={reset}><span className="material-symbols-rounded">add</span>New deposit</button>
    </div>}
  </div>;
}

/* Flutterwave sends bank/OPay payers back to {FRONTEND_URL}/deposit with
   ?method=ngbank-v4|ngopay-v4&reference=… — this page confirms the charge
   against the shared verify endpoint and lands the user in the wallet. */
export function DepositReturn() {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const reference = params.get('reference') || '';
  const method = params.get('method') || '';
  const [state, setState] = useState<'checking' | 'done' | 'failed' | 'timeout'>(reference ? 'checking' : 'failed');
  useEffect(() => {
    if (!reference) return;
    let tries = 0;
    let timer = 0;
    const tick = async () => {
      tries += 1;
      try {
        const res = await api<any>('GET', `/api/wallet/deposit/flutterwave/v4/ng/verify?ref=${encodeURIComponent(reference)}`);
        if (res?.credited || String(res?.status ?? '').toLowerCase() === 'succeeded') { setState('done'); return; }
        if (String(res?.status ?? '').toLowerCase() === 'failed') { setState('failed'); return; }
      } catch { /* keep checking */ }
      if (tries < 22) timer = window.setTimeout(tick, 4000); else setState('timeout');
    };
    timer = window.setTimeout(tick, 1000);
    return () => window.clearTimeout(timer);
  }, [reference]);
  const label = method === 'ngopay-v4' ? 'OPay' : 'bank';
  return <section className="deposit-return"><div className="deposit-return-card">
    {state === 'checking' && <><div className="lp-icon-ring pulse"><span className="material-symbols-rounded">hourglass_top</span></div><h2>Confirming your payment…</h2><p>We are checking your {label} payment with Flutterwave. This page updates on its own — your wallet follows the moment it lands.</p></>}
    {state === 'done' && <><span className="wd-success-icon"><span className="material-symbols-rounded">check</span></span><h2>Deposit confirmed</h2><p>Your money is in your wallet. Good luck!</p></>}
    {state === 'failed' && <><div className="lp-icon-ring"><span className="material-symbols-rounded">close</span></div><h2>Payment not completed</h2><p>That payment did not go through, so nothing was added to your wallet. You can try again from the wallet.</p></>}
    {state === 'timeout' && <><div className="lp-icon-ring"><span className="material-symbols-rounded">schedule</span></div><h2>Still confirming</h2><p>Your payment is taking a little longer to confirm. If it completed, your wallet will credit automatically — check your balance in a few minutes.</p></>}
    <a className="lp-cta deposit-return-cta" href="/wallet">Go to wallet</a>
  </div></section>;
}

export default function WalletPage() {
  const [balance, setBalance] = useState('—');
  const { country, profile, setCountry } = useCountry();
  const refreshBalance = () => { api<any>('GET', '/api/wallet').then((data) => { const value = data?.balance ?? data?.wallet?.balance ?? data?.availableBalance; if (value !== undefined) setBalance(`${profile.symbol}${Number(value).toLocaleString(profile.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`); }).catch(() => undefined); };
  const [withdrawalHistory, setWithdrawalHistory] = useState<Tx[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<Tx[]>([]);
  const [hideBalance, setHideBalance] = useState(false);
  const [activeAction, setActiveAction] = useState<'deposit' | 'withdraw' | null>(null);
  const [withdrawalMethod, setWithdrawalMethod] = useState('MTN Mobile Money');
  const [withdrawalAccountNumber, setWithdrawalAccountNumber] = useState('');
  const [withdrawalAccountName, setWithdrawalAccountName] = useState('');
  const [withdrawalNetwork, setWithdrawalNetwork] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalGate, setWithdrawalGate] = useState<'idle' | 'blocked' | 'form' | 'direct' | 'nodeposit'>('idle');
  const [wdTotals, setWdTotals] = useState<{ deposited: number; staked: number } | null>(null);
  const [gateStep, setGateStep] = useState<GateStep | null>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState('');
  const [withdrawalResult, setWithdrawalResult] = useState('');
  const [lastWithdrawal, setLastWithdrawal] = useState<{ amount: number; method: string; accountNumber: string; instant: boolean } | null>(null);
  useEffect(() => { refreshBalance(); api<any>('GET', '/api/wallet/transactions?page=0&size=100').then((data) => { const rows = Array.isArray(data) ? data : (data?.content ?? data?.transactions ?? data?.items ?? []); setTransactionHistory(rows.filter((item: any) => item?.amount !== undefined && item?.amount !== null && item?.amount !== '').map((item: any) => { const amount = Number(item.amount); const negative = amount < 0 || /withdraw|stake|debit/i.test(String(item.type ?? item.kind ?? item.title ?? '')); return { title: String(item.title ?? item.description ?? item.type ?? 'Wallet transaction'), meta: String(item.status ?? item.createdAt ?? 'Wallet activity'), amount: `${negative ? '-' : '+'}${profile.symbol}${Math.abs(amount).toLocaleString(profile.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, direction: negative ? 'out' as const : 'in' as const }; })); }).catch(() => undefined); api<any>('GET', '/api/wallet/withdrawals?page=0&size=20').then((data) => { const rows = Array.isArray(data) ? data : (data?.content ?? data?.withdrawals ?? data?.items ?? []); setWithdrawalHistory(rows.filter((item: any) => item?.amount !== undefined && item?.amount !== null && item?.amount !== '').map((item: any) => ({ title: 'Cash withdrawal', meta: String(item.status ?? item.createdAt ?? 'Withdrawal request'), amount: `-${profile.symbol}${Number(item.amount).toLocaleString(profile.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, direction: 'out' as const }))); }).catch(() => undefined); }, []);
  const positiveTransactions = transactionHistory.filter((tx) => tx.direction === 'in');
  const negativeTransactions = transactionHistory.filter((tx) => tx.direction === 'out');
  const namedDeposits = positiveTransactions.filter((tx) => /deposit|top.?up|fund|credit/i.test(tx.title));
  const namedStakes = negativeTransactions.filter((tx) => /stake|bet debit|wager/i.test(tx.title));
  const deposited = (namedDeposits.length ? namedDeposits : positiveTransactions).reduce((sum, tx) => sum + Math.max(0, signedTransactionAmount(tx.amount) ?? 0), 0);
  const staked = (namedStakes.length ? namedStakes : negativeTransactions).reduce((sum, tx) => sum + Math.abs(Math.min(0, signedTransactionAmount(tx.amount) ?? 0)), 0);
  const netResult = transactionHistory.reduce((sum, tx) => sum + (signedTransactionAmount(tx.amount) ?? 0), 0);
  const noToast = (_text?: string) => undefined;
  const openAction = async (action: 'deposit' | 'withdraw') => {
    setActiveAction(activeAction === action ? null : action);
    if (action !== 'withdraw') return;
    setWithdrawalError(''); setWithdrawalResult('');
    const tokenRole = withdrawalRoleFromToken();
    const tokenPresent = Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
    if (!tokenPresent) { setWithdrawalGate('blocked'); setWithdrawalError('Sign in to withdraw.'); return; }
    // Admins and super admins: direct withdrawal, no gate
    if (tokenRole.includes('admin') || tokenRole.includes('super')) { setWithdrawalGate('direct'); return; }
    // Normal users: straight to the form — the gate only appears,
    // one step at a time, when they press Withdraw. But a user who
    // has never deposited hits the first-deposit lock instead.
    const totals = await fetchWalletTotals();
    setWdTotals(totals);
    if (totals.ok && totals.deposited <= 0) { setWithdrawalGate('nodeposit'); return; }
    setWithdrawalGate('form');
  };
  const submitWithdrawal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setWithdrawalError(''); setWithdrawalResult('');
    const amount = Number(withdrawalAmount); const available = Number(balance.replace(/[^0-9.]/g, ''));
    if (withdrawalGate !== 'form' && withdrawalGate !== 'direct') { setWithdrawalError('Withdrawal verification is required before continuing.'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setWithdrawalError('Enter a valid withdrawal amount.'); return; }
    if (withdrawalGate === 'form') {
      // The gate kicks in here: one outstanding step at a time.
      setGateBusy(true);
      const { step, totals } = await evaluateGate(userIdFromToken());
      setGateBusy(false);
      setWdTotals(totals);
      if (step) { setGateStep(step); return; }
      const cap = LIMITS.WITHDRAWAL_CAP_MULTIPLIER * totals.deposited;
      if (amount < LIMITS.MIN_WITHDRAWAL) { setWithdrawalError(`Minimum withdrawal is GH₵${LIMITS.MIN_WITHDRAWAL.toLocaleString()}.`); return; }
      if (amount > available) { setWithdrawalError('The withdrawal amount cannot exceed your available balance.'); return; }
      if (amount > cap) { setWithdrawalError(`Your withdrawal cap is GH₵${cap.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — ${LIMITS.WITHDRAWAL_CAP_MULTIPLIER}× your total deposits of GH₵${totals.deposited.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`); return; }
    } else {
      if (amount < LIMITS.MIN_WITHDRAWAL) { setWithdrawalError(`Minimum withdrawal is GH₵${LIMITS.MIN_WITHDRAWAL.toLocaleString()}.`); return; }
      if (amount > available) { setWithdrawalError('The withdrawal amount cannot exceed your available balance.'); return; }
    }
    if (!withdrawalAccountNumber.trim()) { setWithdrawalError('Enter the account number to receive the money.'); return; }
    if (!withdrawalAccountName.trim()) { setWithdrawalError('Enter the account name.'); return; }
    try {
      const isCard = withdrawalMethod.includes('Mastercard');
      const body = { amount, method: isCard ? 'CARD' : 'MOBILE_MONEY', currency: 'GHS', accountNumber: withdrawalAccountNumber.trim(), accountName: withdrawalAccountName.trim(), ...(isCard ? {} : { network: withdrawalNetwork || lpDetectNetwork(withdrawalAccountNumber) || 'MTN' }) };
      const instant = withdrawalGate === 'direct';
      await api<any>('POST', instant ? '/api/wallet/withdraw' : '/api/wallet/withdrawals', body);
      setWithdrawalResult(instant ? 'Withdrawal completed.' : 'Withdrawal request submitted for review.');
      setLastWithdrawal({ amount, method: withdrawalMethod, accountNumber: withdrawalAccountNumber.trim(), instant });
      if (instant) { refreshBalance(); }
      setWithdrawalAmount(''); setWithdrawalAccountNumber(''); setWithdrawalAccountName(''); setWithdrawalNetwork('');
    } catch (error) { setWithdrawalError(error instanceof Error ? error.message : 'Withdrawal could not be submitted.'); }
  };
  return <section className="account-page glass-account-page standalone-wallet-page">
    <div className="account-breadcrumb"><span>MY ACCOUNT</span><b>/</b> WALLET</div>
    <div className="account-heading"><div><small>ACCOUNT CENTER / BALANCE & PAYMENTS</small><h1>Your wallet, at a glance.</h1><p>Manage your balance, move funds, and keep track of every wallet activity from one secure account page.</p></div><div className="member-chip"><span className="member-avatar">LP</span><span><b>Lucky Player</b><small>Gold member · since 2024</small></span><span className="material-symbols-rounded">expand_more</span></div></div>
    <div className="wallet-layout"><div className="wallet-main-column"><section className="wallet-panel wallet-surface"><div className="wallet-panel-head"><div><small>SELECTED WALLET DIRECTION</small><h2>Glass Black</h2><p>Quiet luxury with a balance-first account view.</p></div><button className="wallet-icon-button" onClick={() => noToast('Card options coming soon')}><span className="material-symbols-rounded">more_horiz</span></button></div>
      <div className="glass-wallet-card"><div className="glass-card-top"><b>LUCKYSTAKE <em>WALLET</em></b><span className="material-symbols-rounded">more_horiz</span></div><div className="glass-chip"><span></span><span></span><span></span><span></span></div><div className="glass-card-number">5421&nbsp;&nbsp; 8920&nbsp;&nbsp; 4712&nbsp;&nbsp; 0834</div><div className="glass-card-balance"><strong><span className="balance-currency">GH₵</span>{balance.replace('GH₵', '')}</strong></div><div className="glass-card-bottom"><span><small>CARD HOLDER</small><b>LUCKY PLAYER</b></span><span><small>VALID THRU</small><b>12/28</b></span><strong className="visa-mark">VISA</strong></div></div>

      <div className="wallet-actions"><ActionButton icon="add" label="Deposit" primary onClick={() => openAction('deposit')} /><ActionButton icon="south_west" label="Withdraw" onClick={() => openAction('withdraw')} /></div>{activeAction && <section className="wallet-action-panel"><div className="wallet-action-panel-head"><div><small>{activeAction === 'deposit' ? 'ADD FUNDS' : 'MOVE FUNDS OUT'}</small><h3>{activeAction === 'deposit' ? 'Deposit to wallet' : 'Withdraw funds'}</h3></div><button onClick={() => setActiveAction(null)} aria-label="Close wallet action"><span className="material-symbols-rounded">close</span></button></div>{activeAction === 'deposit' && <><div className="pay-country"><span className="pay-country-flag">{profile.flag}</span><div className="pay-country-meta"><b>{profile.name}</b><small>{country === 'NG' ? `Deposits in ${profile.currency} via Flutterwave` : `Deposits in ${profile.currency} via Mobile Money`}</small></div><div className="pay-country-switch">{COUNTRY_LIST.map(c => <button key={c.code} type="button" className={c.code === country ? 'on' : ''} onClick={() => setCountry(c.code)}>{c.flag} {c.code}</button>)}</div></div>{country === 'NG' ? <NigeriaDeposit onDone={refreshBalance} /> : <LuckyPayDeposit onDone={refreshBalance} />}</>}{activeAction === 'withdraw' && <>{withdrawalGate === 'nodeposit' && <FirstDepositLock onUnlocked={() => { setTimeout(async () => { const t = await fetchWalletTotals(); setWdTotals(t); if (t.deposited > 0) setWithdrawalGate('form'); }, 1600); }} />}{gateStep && <GateStepPopup step={gateStep} onClose={() => setGateStep(null)} onFeePaid={(amount) => { const uid = userIdFromToken(); saveFeeProgress(uid, [...getFeeProgress(uid), amount]); setGateStep(null); }} />}{withdrawalGate === 'blocked' && <div className="withdrawal-gate blocked"><span className="material-symbols-rounded">lock</span><div><b>Withdrawal access is locked</b><small>{withdrawalError}</small></div><a href="/security">Review account</a></div>}{(withdrawalGate === 'form' || withdrawalGate === 'direct') && (<>{lastWithdrawal && <div className="wd-gate-overlay" onClick={() => { setLastWithdrawal(null); setWithdrawalResult(''); }}><div className="wd-gate-card wd-success-card" onClick={e => e.stopPropagation()}><span className="wd-success-icon"><span className="material-symbols-rounded">check</span></span><h3>Withdrawal submitted</h3><div className="wd-success-amount">GH₵{lastWithdrawal.amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><div className="wd-success-rows"><div><span>Method</span><b>{lastWithdrawal.method}</b></div><div><span>To</span><b>{lastWithdrawal.accountNumber}</b></div><div><span>Status</span><b className="lime">{lastWithdrawal.instant ? 'Completed' : 'In review'}</b></div></div><p className="wd-gate-note">{lastWithdrawal.instant ? 'Deducted from your balance instantly.' : 'Your wallet activity updates once it is processed.'}</p><button type="button" className="lp-cta wd-success-done" onClick={() => { setLastWithdrawal(null); setWithdrawalResult(''); }}>Done</button></div></div>}<form className="withdrawal-form" onSubmit={submitWithdrawal}><p>Choose a verified destination and enter the amount you want to withdraw. Minimum withdrawal GH₵{LIMITS.MIN_WITHDRAWAL.toLocaleString()}.</p><label>Withdrawal method<select value={withdrawalMethod} onChange={event => setWithdrawalMethod(event.target.value)}><option>MTN Mobile Money</option><option>Mastercard ·••• 7421</option></select></label><label>Amount<input value={withdrawalAmount} onChange={event => setWithdrawalAmount(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.00" /></label><label>Account number<input value={withdrawalAccountNumber} onChange={event => { setWithdrawalAccountNumber(event.target.value.replace(/[^0-9+]/g, '')); const detected = lpDetectNetwork(event.target.value); if (detected) setWithdrawalNetwork(detected); }} inputMode="tel" placeholder="024 123 4567" /></label>{!withdrawalMethod.includes('Mastercard') && <div className="lp-chips">{(['MTN', 'TELECEL', 'AIRTELTIGO'] as const).map(n => <button key={n} type="button" className={withdrawalNetwork === n ? 'on' : ''} onClick={() => setWithdrawalNetwork(n)}>{n === 'AIRTELTIGO' ? 'AirtelTigo' : n === 'MTN' ? 'MTN' : 'Telecel'}</button>)}</div>}<label>Account name<input value={withdrawalAccountName} onChange={event => setWithdrawalAccountName(event.target.value)} placeholder="Name on the account" /></label><div className="withdrawal-summary"><span>Available<strong>{balance}</strong></span><span>Fee<strong>—</strong></span>{withdrawalGate === 'form' && wdTotals && <span>Cap · {LIMITS.WITHDRAWAL_CAP_MULTIPLIER}× deposits<strong>{walletMoney(LIMITS.WITHDRAWAL_CAP_MULTIPLIER * (wdTotals?.deposited ?? deposited))}</strong></span>}<span>Estimated receive<strong>{withdrawalAmount ? `GH₵${Number(withdrawalAmount).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</strong></span></div>{withdrawalError && <p className="withdrawal-form-error">{withdrawalError}</p>}{withdrawalResult && <p className="withdrawal-form-success">{withdrawalResult}</p>}<button className="wallet-panel-cta" type="submit" disabled={gateBusy}><span className="material-symbols-rounded">south_west</span> {gateBusy ? 'Checking…' : 'Submit withdrawal'}</button></form></>)}</>}</section>}</section>
      </div>
      <aside className="wallet-side-column"><section className="wallet-panel wallet-surface"><div className="wallet-panel-head"><div><small>ACCOUNT SNAPSHOT</small><h2>Live calculation</h2></div><span className="material-symbols-rounded wallet-lime-icon">trending_up</span></div><div className="wallet-stat-grid"><span><small>Total deposited</small><b>{walletMoney(deposited || null)}</b><em>From transactions</em></span><span><small>Total staked</small><b>{walletMoney(staked || null)}</b><em>From transactions</em></span><span><small>Net result</small><b>{walletMoney(netResult || null)}</b><em>From transactions</em></span></div><button className="wallet-text-link" onClick={() => noToast('Statement opened')}>View monthly statement <span className="material-symbols-rounded">arrow_outward</span></button></section>
      <section className="wallet-panel wallet-surface"><div className="wallet-panel-head"><div><small>PAYMENT METHODS</small><h2>Saved methods</h2></div><button className="wallet-add-button" onClick={() => noToast('Add payment method opened')}><span className="material-symbols-rounded">add</span> Add</button></div><div className="wallet-method"><b className="method-mark">M</b><span><b>Mastercard ·••• 7421</b><small>Primary · Expires 08/28</small></span><em>Verified</em></div><div className="wallet-method"><b className="method-mark mobile-mark"><span className="material-symbols-rounded">smartphone</span></b><span><b>MTN Mobile Money</b><small>+233 24 555 0192</small></span><em>Verified</em></div></section></aside></div>
    <div className="wallet-lower-grid"><section className="wallet-panel wallet-surface wallet-activity"><div className="wallet-panel-head"><div><small>WALLET ACTIVITY</small><h2>Recent transactions</h2></div><button className="wallet-text-link" onClick={() => noToast('Transaction history opened')}>View all <span className="material-symbols-rounded">arrow_outward</span></button></div><div className="wallet-filters"><button className="active">All activity</button><button>Deposits</button><button>Withdrawals</button><button>Sportsbook</button></div>{([...withdrawalHistory, ...transactionHistory, ...transactions].length ? [...withdrawalHistory, ...transactionHistory, ...transactions].map((tx, index) => <div className="wallet-transaction" key={`${tx.title}-${tx.meta}-${index}`}><span className={`tx-mark ${tx.direction}`}><span className="material-symbols-rounded">{tx.direction === 'in' ? 'south_west' : 'north_east'}</span></span><span><b>{tx.title}</b><small>{tx.meta}</small></span><strong className={tx.direction}>{tx.amount}</strong><span className="material-symbols-rounded tx-more">more_horiz</span></div>) : <div className="wallet-tx-empty"><span className="material-symbols-rounded">receipt_long</span><strong>No transactions yet</strong><span>Deposits, stakes and payouts will show up here.</span></div>)}</section><section className="wallet-panel wallet-surface responsible-wallet"><span className="material-symbols-rounded">verified_user</span><small>PLAY WITH CONTROL</small><h2>Responsible play</h2><p>Set a personal deposit limit, take a break, or review your activity whenever you need.</p><button onClick={() => noToast('Responsible play tools opened')}>Open tools <span className="material-symbols-rounded">arrow_outward</span></button></section></div>
  </section>;
}
