import { useEffect, useState } from 'react';
import { api } from './api';

const ACCOUNT_EMOJIS = ['😀','😎','🤩','🥳','😇','🤠','🤑','🤖','👾','🎃','🦊','🐼','🐯','🦁','🐸','🐵','🐙','🦄','🐝','🦋','🌟','⭐','✨','💫','🔥','⚡','🌈','☀️','🌙','🌍','🌴','🍀','🌸','🌺','🌻','🌹','🍎','🍉','🍋','🍒','🥝','🍇','🍓','🥭','🍍','🥥','🥑','🍕','🍔','🍩','🍪','🎂','🍿','⚽','🏀','🏆','🎯','🎲','🎮','🎧','🎵','🎸','🎹','🚀','✈️','🚗','🏎️','🚲','⛵','🛸','💎','💡','🔒','🔑','🛡️','⚙️','💻','📱','💰','💳','💵','🎁','🎈','🎉','🎊','❤️','💜','💙','💚','💛','🧡','🖤','🤍','💖','💯','✅','🌶️','🍯','🧿','🪩','🧸','🦖'] as const;
type Profile = { firstName: string; username: string; email: string };
type Activity = { title: string; meta: string; amount: string; direction: 'positive' | 'negative' };

function initialProfile(): Profile { const fallback = { firstName: 'Lucky Player', username: 'luckyplayer', email: 'lucky.player@example.com' }; try { const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || ''; const payload = token.split('.')[1]; if (!payload) return fallback; const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))); return { firstName: String(claims.firstName ?? claims.first_name ?? claims.name ?? fallback.firstName), username: String(claims.username ?? claims.userName ?? claims.preferred_username ?? fallback.username), email: String(claims.email ?? fallback.email) }; } catch { return fallback; } }
function money(value: unknown) { const number = Number(value); return Number.isFinite(number) ? `GH₵${number.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'GH₵0.00'; }
function rowsFrom(payload: any, fallbackTitle: string): any[] { return Array.isArray(payload) ? payload : (payload?.content ?? payload?.data ?? payload?.transactions ?? payload?.withdrawals ?? payload?.bets ?? payload?.items ?? []); }
function activityFrom(item: any, fallbackTitle: string): Activity | null { const raw = item?.amount ?? item?.value ?? item?.netAmount; if (raw === undefined || raw === null || raw === '') return null; const value = Number(raw); if (!Number.isFinite(value)) return null; const negative = value < 0 || /withdraw|stake|debit/i.test(String(item?.type ?? item?.kind ?? item?.title ?? '')); return { title: String(item?.title ?? item?.description ?? item?.type ?? fallbackTitle), meta: String(item?.status ?? item?.createdAt ?? item?.date ?? 'Wallet activity'), amount: `${negative ? '-' : '+'}${money(Math.abs(value))}`, direction: negative ? 'negative' : 'positive' }; }
function isActiveBet(item: any) { const status = String(item?.status ?? item?.state ?? item?.betStatus ?? item?.result ?? '').toLowerCase(); if (item?.active === true || item?.isActive === true) return true; if (!status) return true; return !/settled|won|lost|cancel|void|reject|expire|cashout|complete|paid|failed/i.test(status); }
function countFrom(payload: any, rows: any[]) { const total = Number(payload?.totalElements ?? payload?.total ?? payload?.count); return Number.isFinite(total) && total >= 0 ? total : rows.length; }

export default function AccountHomePage() {
  const [profile, setProfile] = useState<Profile>(initialProfile());
  const [balance, setBalance] = useState('GH₵0.00');
  const [activeBets, setActiveBets] = useState(0);
  const [betSlips, setBetSlips] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [avatarEmoji] = useState(() => ACCOUNT_EMOJIS[Math.floor(Math.random() * ACCOUNT_EMOJIS.length)]);
  useEffect(() => { let cancelled = false; (async () => {
    try { const result = await api<any>('GET', '/api/users/me'); const user = result?.user ?? result?.profile ?? result?.account ?? result; if (user && !cancelled) setProfile({ firstName: String(user.firstName ?? user.first_name ?? user.name ?? 'Lucky Player'), username: String(user.username ?? user.userName ?? user.handle ?? 'luckyplayer'), email: String(user.email ?? 'lucky.player@example.com') }); } catch { /* token fallback remains visible */ }
    const [walletResult, betsResult, transactionResult, withdrawalResult] = await Promise.allSettled([
      api<any>('GET', '/api/wallet'),
      api<any>('GET', '/api/bets?page=0&size=100'),
      api<any>('GET', '/api/wallet/transactions?page=0&size=10'),
      api<any>('GET', '/api/wallet/withdrawals?page=0&size=10'),
    ]);
    if (cancelled) return;
    if (walletResult.status === 'fulfilled') { const wallet = walletResult.value; const value = wallet?.balance ?? wallet?.wallet?.balance ?? wallet?.availableBalance; setBalance(money(value)); }
    if (betsResult.status === 'fulfilled') { const betRows = rowsFrom(betsResult.value, 'Bet'); setBetSlips(countFrom(betsResult.value, betRows)); setActiveBets(betRows.filter(isActiveBet).length); }
    const transactionRows = transactionResult.status === 'fulfilled' ? rowsFrom(transactionResult.value, 'Wallet transaction') : [];
    const withdrawalRows = withdrawalResult.status === 'fulfilled' ? rowsFrom(withdrawalResult.value, 'Cash withdrawal') : [];
    setActivities([...withdrawalRows.map((item: any) => activityFrom({ ...item, type: 'Cash withdrawal', amount: -Math.abs(Number(item?.amount ?? 0)) }, 'Cash withdrawal')), ...transactionRows.map((item: any) => activityFrom(item, 'Wallet transaction'))].filter(Boolean).slice(0, 6) as Activity[]);
  })(); return () => { cancelled = true; }; }, []);
  return <section className="account-timeline-page">
    <div className="account-timeline-heading"><div><small>PERSONAL ACCOUNT / OVERVIEW</small><h1>Welcome back, {profile.firstName}.</h1><p>Manage your profile, wallet, and account activity from one secure place.</p></div></div>
    <section className="account-timeline-profile"><div className="account-timeline-avatar" aria-label="Random account emoji">{avatarEmoji}</div><div className="account-profile-copy"><h2>{profile.firstName}</h2><p>@{profile.username} · {profile.email}</p><span className="account-verified"><i></i> Verified account</span></div><a className="account-edit-link" href="/security">Edit profile <span className="account-icon-glyph" aria-hidden="true">✎</span></a></section>
    <section className="account-timeline-balance"><span><small>AVAILABLE BALANCE</small><strong>{balance}</strong><span>Live wallet balance · Updated from account API</span></span></section>
    <section className="account-timeline-stats"><div><span className="account-icon-glyph" aria-hidden="true">⚽</span><small>ACTIVE BETS</small><strong>{activeBets}</strong></div><div><span className="account-icon-glyph" aria-hidden="true">🧾</span><small>BET SLIPS</small><strong>{betSlips}</strong></div><div><span className="account-icon-glyph" aria-hidden="true">💳</span><small>WALLET ACTIONS</small><strong>{activities.length}</strong></div></section>
    <div className="account-timeline-layout"><section className="account-activity-panel"><div className="account-timeline-section-head"><div><small>ACCOUNT ACTIVITY</small><h2>Recent activity</h2></div><a href="/wallet">Wallet</a></div><div className="account-activity-list">{activities.length ? activities.map((item, index) => <div className="account-activity-item" key={`${item.title}-${item.meta}-${index}`}><span className={`account-activity-icon ${/wallet|withdraw/i.test(item.title) ? 'wallet' : ''}`}><span className="account-icon-glyph" aria-hidden="true">{/withdraw/i.test(item.title) ? '↘' : /bet|stake/i.test(item.title) ? '⚽' : '💳'}</span></span><div><strong>{item.title}</strong><small>{item.meta}</small></div><div className="account-activity-end"><b className={item.direction}>{item.amount}</b><small>Live API</small></div></div>) : <div className="account-activity-empty">No wallet activity returned yet.</div>}</div></section><aside className="account-timeline-tools"><small>ACCOUNT TOOLS</small><a href="/wallet"><span className="account-icon-glyph" aria-hidden="true">💳</span><span><strong>Wallet & payments</strong><small>Live balance, deposits, and withdrawals</small></span><span className="account-icon-glyph" aria-hidden="true">›</span></a><a href="/security"><span className="account-icon-glyph" aria-hidden="true">🛡️</span><span><strong>Sign-in & security</strong><small>Protect your account access</small></span><span className="account-icon-glyph" aria-hidden="true">›</span></a><a href="/support"><span className="account-icon-glyph" aria-hidden="true">?</span><span><strong>Help & support</strong><small>Get assistance from our team</small></span><span className="account-icon-glyph" aria-hidden="true">›</span></a></aside></div>
    <button className="account-timeline-signout account-bottom-signout" type="button"><span className="account-icon-glyph" aria-hidden="true">↪</span> Sign out</button>
  </section>;
}
