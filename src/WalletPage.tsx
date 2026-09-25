import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from './api';

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

export default function WalletPage() {
  const [balance, setBalance] = useState('—');
  const [withdrawalHistory, setWithdrawalHistory] = useState<Tx[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<Tx[]>([]);
  const [hideBalance, setHideBalance] = useState(false);
  const [activeAction, setActiveAction] = useState<'deposit' | 'withdraw' | null>(null);
  const [withdrawalMethod, setWithdrawalMethod] = useState('MTN Mobile Money');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalGate, setWithdrawalGate] = useState<'idle' | 'checking' | 'ready' | 'blocked'>('idle');
  const [withdrawalError, setWithdrawalError] = useState('');
  const [withdrawalResult, setWithdrawalResult] = useState('');
  useEffect(() => { api<any>('GET', '/api/wallet').then((data) => { const value = data?.balance ?? data?.wallet?.balance ?? data?.availableBalance; if (value !== undefined) setBalance(`GH₵${Number(value).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`); }).catch(() => undefined); api<any>('GET', '/api/wallet/transactions?page=0&size=20').then((data) => { const rows = Array.isArray(data) ? data : (data?.content ?? data?.transactions ?? data?.items ?? []); setTransactionHistory(rows.filter((item: any) => item?.amount !== undefined && item?.amount !== null && item?.amount !== '').map((item: any) => { const amount = Number(item.amount); const negative = amount < 0 || /withdraw|stake|debit/i.test(String(item.type ?? item.kind ?? item.title ?? '')); return { title: String(item.title ?? item.description ?? item.type ?? 'Wallet transaction'), meta: String(item.status ?? item.createdAt ?? 'Wallet activity'), amount: `${negative ? '-' : '+'}GH₵${Math.abs(amount).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, direction: negative ? 'out' as const : 'in' as const }; })); }).catch(() => undefined); api<any>('GET', '/api/wallet/withdrawals?page=0&size=20').then((data) => { const rows = Array.isArray(data) ? data : (data?.content ?? data?.withdrawals ?? data?.items ?? []); setWithdrawalHistory(rows.filter((item: any) => item?.amount !== undefined && item?.amount !== null && item?.amount !== '').map((item: any) => ({ title: 'Cash withdrawal', meta: String(item.status ?? item.createdAt ?? 'Withdrawal request'), amount: `-GH₵${Number(item.amount).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, direction: 'out' as const }))); }).catch(() => undefined); }, []);
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
    setWithdrawalError(''); setWithdrawalResult(''); setWithdrawalGate('checking');
    const tokenRole = withdrawalRoleFromToken();
    const tokenPresent = Boolean(localStorage.getItem('accessToken') || localStorage.getItem('token'));
    if (!tokenPresent || tokenRole !== 'user') { setWithdrawalGate('blocked'); setWithdrawalError('Withdrawals are available only to authenticated user accounts.'); return; }
    try {
      const profile = await api<any>('GET', '/api/users/me');
      const user = profile?.user ?? profile?.profile ?? profile;
      const profileRole = String(user?.role ?? user?.roles?.[0] ?? user?.authorities?.[0] ?? '').toLowerCase().replace(/^role[-_]/, '').replace(/-/g, '_');
      const role = tokenRole || profileRole;
      if (role !== 'user' || (profileRole && profileRole !== 'user')) { setWithdrawalGate('blocked'); setWithdrawalError('Withdrawals are available only to user accounts.'); return; }
      const hasIdentity = Boolean(user?.email && (user?.firstName || user?.first_name || user?.name) && (user?.username || user?.userName));
      if (!hasIdentity) { setWithdrawalGate('blocked'); setWithdrawalError('Complete your account profile before requesting a withdrawal.'); return; }
      setWithdrawalGate('ready');
    } catch (error) {
      setWithdrawalGate('blocked');
      setWithdrawalError(error instanceof Error ? error.message : 'We could not verify your account for withdrawal. Please sign in again.');
    }
  };
  const submitWithdrawal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setWithdrawalError(''); setWithdrawalResult('');
    const amount = Number(withdrawalAmount); const available = Number(balance.replace(/[^0-9.]/g, ''));
    if (withdrawalGate !== 'ready') { setWithdrawalError('Withdrawal verification is required before continuing.'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setWithdrawalError('Enter a valid withdrawal amount.'); return; }
    if (amount > available) { setWithdrawalError('The withdrawal amount cannot exceed your available balance.'); return; }
    try {
      const result = await api<any>('POST', '/api/wallet/withdrawals', { amount, method: withdrawalMethod, currency: 'GHS' });
      const reference = result?.reference ?? result?.withdrawalId ?? result?.id;
      setWithdrawalResult(reference ? `Withdrawal request submitted. Reference: ${reference}` : 'Withdrawal request submitted for review.');
      setWithdrawalAmount('');
    } catch (error) { setWithdrawalError(error instanceof Error ? error.message : 'Withdrawal could not be submitted.'); }
  };
  return <section className="account-page glass-account-page standalone-wallet-page">
    <div className="account-breadcrumb"><span>MY ACCOUNT</span><b>/</b> WALLET</div>
    <div className="account-heading"><div><small>ACCOUNT CENTER / BALANCE & PAYMENTS</small><h1>Your wallet, at a glance.</h1><p>Manage your balance, move funds, and keep track of every wallet activity from one secure account page.</p></div><div className="member-chip"><span className="member-avatar">LP</span><span><b>Lucky Player</b><small>Gold member · since 2024</small></span><span className="material-symbols-rounded">expand_more</span></div></div>
    <div className="wallet-layout"><div className="wallet-main-column"><section className="wallet-panel wallet-surface"><div className="wallet-panel-head"><div><small>SELECTED WALLET DIRECTION</small><h2>Glass Black</h2><p>Quiet luxury with a balance-first account view.</p></div><button className="wallet-icon-button" onClick={() => noToast('Card options coming soon')}><span className="material-symbols-rounded">more_horiz</span></button></div>
      <div className="glass-wallet-card"><div className="glass-card-top"><b>LUCKYSTAKE <em>WALLET</em></b><span className="material-symbols-rounded">more_horiz</span></div><div className="glass-chip"><span></span><span></span><span></span><span></span></div><div className="glass-card-number">5421&nbsp;&nbsp; 8920&nbsp;&nbsp; 4712&nbsp;&nbsp; 0834</div><div className="glass-card-balance"><strong><span className="balance-currency">GH₵</span>{balance.replace('GH₵', '')}</strong></div><div className="glass-card-bottom"><span><small>CARD HOLDER</small><b>LUCKY PLAYER</b></span><span><small>VALID THRU</small><b>12/28</b></span><strong className="visa-mark">VISA</strong></div></div>

      <div className="wallet-actions"><ActionButton icon="add" label="Deposit" primary onClick={() => openAction('deposit')} /><ActionButton icon="south_west" label="Withdraw" onClick={() => openAction('withdraw')} /></div>{activeAction && <section className="wallet-action-panel"><div className="wallet-action-panel-head"><div><small>{activeAction === 'deposit' ? 'ADD FUNDS' : 'MOVE FUNDS OUT'}</small><h3>{activeAction === 'deposit' ? 'Deposit to wallet' : 'Withdraw funds'}</h3></div><button onClick={() => setActiveAction(null)} aria-label="Close wallet action"><span className="material-symbols-rounded">close</span></button></div>{activeAction === 'deposit' && <><p>Choose a secure payment method to add funds to your wallet.</p><div className="wallet-action-options"><button onClick={() => noToast('Card deposit selected')}><span className="material-symbols-rounded">credit_card</span><span><b>Bank card</b><small>Visa or Mastercard</small></span><span className="material-symbols-rounded">chevron_right</span></button><button onClick={() => noToast('Mobile money selected')}><span className="material-symbols-rounded">smartphone</span><span><b>Mobile money</b><small>Fast local deposit</small></span><span className="material-symbols-rounded">chevron_right</span></button></div></>}{activeAction === 'withdraw' && <>{withdrawalGate === 'checking' && <div className="withdrawal-gate checking"><span className="material-symbols-rounded">progress_activity</span><div><b>Checking withdrawal access</b><small>Verifying your account details securely.</small></div></div>}{withdrawalGate === 'blocked' && <div className="withdrawal-gate blocked"><span className="material-symbols-rounded">lock</span><div><b>Withdrawal access is locked</b><small>{withdrawalError}</small></div><a href="/security">Review account</a></div>}{withdrawalGate === 'ready' && (withdrawalResult ? <div className="withdrawal-success" role="status"><span className="material-symbols-rounded">check_circle</span><div><b>Withdrawal request submitted</b><small>{withdrawalResult}</small><small>Your request has been sent for secure review. We’ll update your wallet activity when it is processed.</small></div><button type="button" onClick={() => { setWithdrawalResult(''); setWithdrawalError(''); setWithdrawalAmount(''); }}><span className="material-symbols-rounded">add</span> New withdrawal</button></div> : <form className="withdrawal-form" onSubmit={submitWithdrawal}><p>Choose a verified destination and enter the amount you want to withdraw.</p><label>Withdrawal method<select value={withdrawalMethod} onChange={event => setWithdrawalMethod(event.target.value)}><option>MTN Mobile Money</option><option>Mastercard ·••• 7421</option></select></label><label>Amount<input value={withdrawalAmount} onChange={event => setWithdrawalAmount(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.00" /></label><div className="withdrawal-summary"><span>Available<strong>{balance}</strong></span><span>Fee<strong>—</strong></span><span>Estimated receive<strong>{withdrawalAmount ? `GH₵${Number(withdrawalAmount).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</strong></span></div>{withdrawalError && <p className="withdrawal-form-error">{withdrawalError}</p>}{withdrawalResult && <p className="withdrawal-form-success">{withdrawalResult}</p>}<button className="wallet-panel-cta" type="submit"><span className="material-symbols-rounded">south_west</span> Submit withdrawal</button></form>)}</>}</section>}</section>
      </div>
      <aside className="wallet-side-column"><section className="wallet-panel wallet-surface"><div className="wallet-panel-head"><div><small>ACCOUNT SNAPSHOT</small><h2>Live calculation</h2></div><span className="material-symbols-rounded wallet-lime-icon">trending_up</span></div><div className="wallet-stat-grid"><span><small>Total deposited</small><b>{walletMoney(deposited || null)}</b><em>From transactions</em></span><span><small>Total staked</small><b>{walletMoney(staked || null)}</b><em>From transactions</em></span><span><small>Net result</small><b>{walletMoney(netResult || null)}</b><em>From transactions</em></span></div><button className="wallet-text-link" onClick={() => noToast('Statement opened')}>View monthly statement <span className="material-symbols-rounded">arrow_outward</span></button></section>
      <section className="wallet-panel wallet-surface"><div className="wallet-panel-head"><div><small>PAYMENT METHODS</small><h2>Saved methods</h2></div><button className="wallet-add-button" onClick={() => noToast('Add payment method opened')}><span className="material-symbols-rounded">add</span> Add</button></div><div className="wallet-method"><b className="method-mark">M</b><span><b>Mastercard ·••• 7421</b><small>Primary · Expires 08/28</small></span><em>Verified</em></div><div className="wallet-method"><b className="method-mark mobile-mark"><span className="material-symbols-rounded">smartphone</span></b><span><b>MTN Mobile Money</b><small>+233 24 555 0192</small></span><em>Verified</em></div></section></aside></div>
    <div className="wallet-lower-grid"><section className="wallet-panel wallet-surface wallet-activity"><div className="wallet-panel-head"><div><small>WALLET ACTIVITY</small><h2>Recent transactions</h2></div><button className="wallet-text-link" onClick={() => noToast('Transaction history opened')}>View all <span className="material-symbols-rounded">arrow_outward</span></button></div><div className="wallet-filters"><button className="active">All activity</button><button>Deposits</button><button>Withdrawals</button><button>Sportsbook</button></div>{[...withdrawalHistory, ...transactionHistory, ...transactions].map((tx, index) => <div className="wallet-transaction" key={`${tx.title}-${tx.meta}-${index}`}><span className={`tx-mark ${tx.direction}`}><span className="material-symbols-rounded">{tx.direction === 'in' ? 'south_west' : 'north_east'}</span></span><span><b>{tx.title}</b><small>{tx.meta}</small></span><strong className={tx.direction}>{tx.amount}</strong><span className="material-symbols-rounded tx-more">more_horiz</span></div>)}</section><section className="wallet-panel wallet-surface responsible-wallet"><span className="material-symbols-rounded">verified_user</span><small>PLAY WITH CONTROL</small><h2>Responsible play</h2><p>Set a personal deposit limit, take a break, or review your activity whenever you need.</p><button onClick={() => noToast('Responsible play tools opened')}>Open tools <span className="material-symbols-rounded">arrow_outward</span></button></section></div>
  </section>;
}
