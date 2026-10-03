import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

type Role = 'admin' | 'super-admin';
type Row = Record<string, unknown>;
type AdminPageKey = 'overview' | 'matches' | 'random' | 'codes' | 'affiliate' | 'withdrawals' | 'guide';
type SuperPageKey = 'dashboard' | 'admins' | 'users' | 'transactions' | 'binance' | 'momo' | 'userdeposits' | 'affwithdrawals' | 'payouts' | 'walletwithdrawals' | 'commission';
type PageKey = AdminPageKey | SuperPageKey;

const text = (value: unknown, fallback = '—') => value === null || value === undefined || value === '' ? fallback : typeof value === 'object' ? JSON.stringify(value) : String(value);
const rows = (value: unknown): Row[] => {
  if (Array.isArray(value)) return value as Row[];
  if (value && typeof value === 'object') {
    const record = value as Row;
    for (const key of ['content', 'items', 'results', 'data', 'records']) if (Array.isArray(record[key])) return record[key] as Row[];
  }
  return [];
};
const numberValue = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
const money = (value: unknown) => `₵${numberValue(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const idOf = (row: Row) => text(row.id ?? row.userId ?? row.adminId ?? row.transactionId, '');
const labelOf = (row: Row) => text(row.name ?? row.email ?? row.username ?? row.userName ?? row.id, 'Unknown');

function decodeToken(): Row {
  try {
    const raw = localStorage.getItem('accessToken') || localStorage.getItem('token') || localStorage.getItem('authToken') || '';
    const part = raw.split('.')[1];
    return part ? JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as Row : {};
  } catch { return {}; }
}
export function roleFromToken(): string {
  const claims = decodeToken();
  const values = [claims.role, claims.roles, claims.authorities, claims.authority, claims.userRole].flat(Infinity).map(value => String(value).toLowerCase());
  return values.find(value => value.includes('super')) || values.find(value => value.includes('admin')) || 'user';
}

const adminPages: { id: AdminPageKey; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'space_dashboard' },
  { id: 'matches', label: 'Matches', icon: 'sports_soccer' },
  { id: 'random', label: 'Random games', icon: 'casino' },
  { id: 'codes', label: 'Booking codes', icon: 'confirmation_number' },
  { id: 'affiliate', label: 'Affiliate', icon: 'group_add' },
  { id: 'withdrawals', label: 'Withdrawals', icon: 'payments' },
  { id: 'guide', label: 'How to use', icon: 'help' },
];

const superPages: { id: SuperPageKey; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' },
  { id: 'admins', label: 'Administrators', icon: 'admin_panel_settings' },
  { id: 'users', label: 'Users', icon: 'group' },
  { id: 'transactions', label: 'Transactions', icon: 'receipt_long' },
  { id: 'binance', label: 'Binance deposits', icon: 'currency_bitcoin' },
  { id: 'momo', label: 'MoMo deposits', icon: 'smartphone' },
  { id: 'userdeposits', label: 'User deposits', icon: 'account_balance' },
  { id: 'affwithdrawals', label: 'Affiliate withdrawals', icon: 'partner_exchange' },
  { id: 'payouts', label: 'Payout requests', icon: 'request_quote' },
  { id: 'walletwithdrawals', label: 'Wallet withdrawals', icon: 'payments' },
  { id: 'commission', label: 'Commission analytics', icon: 'monitoring' },
];

function Notice({ message, error }: { message: string; error?: boolean }) { return message ? <div className={`admin-notice ${error ? 'is-error' : 'is-success'}`}><span className="material-symbols-rounded">{error ? 'error' : 'check_circle'}</span>{message}</div> : null; }
function Intro({ title, description, onRefresh, loading }: { title: string; description: string; onRefresh: () => void; loading: boolean }) { return <div className="admin-intro"><div><span className="admin-eyebrow">LUCKYSTAKE CONTROL ROOM</span><h1>{title}</h1><p>{description}</p></div><button className="admin-refresh" onClick={onRefresh} aria-label="Refresh data"><span className={`material-symbols-rounded ${loading ? 'admin-spin' : ''}`}>refresh</span></button></div>; }
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="admin-panel"><div className="admin-panel-title"><h2>{title}</h2>{action}</div>{children}</section>; }
function Table({ data, columns, actions }: { data: Row[]; columns: string[]; actions?: (row: Row) => React.ReactNode }) { return <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{columns.map(column => <th key={column}>{column.replace(/([A-Z])/g, ' $1')}</th>)}{actions && <th>Actions</th>}</tr></thead><tbody>{data.length === 0 ? <tr><td className="admin-empty" colSpan={columns.length + (actions ? 1 : 0)}>No records found.</td></tr> : data.map((row, index) => <tr key={idOf(row) || String(index)}>{columns.map(column => <td key={column}>{column === 'id' ? <code>{text(row[column])}</code> : text(row[column])}</td>)}{actions && <td><div className="admin-actions">{actions(row)}</div></td>}</tr>)}</tbody></table></div>; }
function Button({ children, onClick, tone = 'secondary' }: { children: React.ReactNode; onClick?: () => void; tone?: 'primary' | 'secondary' | 'danger' }) { return <button className={`admin-button ${tone}`} onClick={onClick}>{children}</button>; }

// ============================================================================
// REGULAR ADMIN TABS
// ============================================================================

function AdminOverview({ onNavigate }: { onNavigate: (page: AdminPageKey) => void }) {
  const [stats, setStats] = useState<Row>({});
  const [links, setLinks] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [s, l] = await Promise.allSettled([
        api('GET', '/api/admin/affiliate/stats'),
        api('GET', '/api/admin/affiliate/links'),
      ]);
      if (s.status === 'fulfilled') setStats((s.value || {}) as Row);
      if (l.status === 'fulfilled') setLinks(rows(l.value));
      if (s.status === 'rejected' && l.status === 'rejected') setError('Could not load affiliate stats.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load overview'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const createLink = async () => {
    try {
      await api('POST', '/api/admin/affiliate/links', {});
      setMessage('Referral link created.');
      const l = await api('GET', '/api/admin/affiliate/links');
      setLinks(rows(l));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create link'); }
  };
  const requestPayout = async () => {
    if (!window.confirm('Request payout of your commission balance?')) return;
    try {
      await api('POST', '/api/admin/affiliate/payout-request', {});
      setMessage('Payout requested.');
      load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Payout request failed'); }
  };
  const cards = [
    ['Referrals', text(stats.totalReferrals ?? stats.referralCount, '0'), 'group_add', 'affiliate'],
    ['Commission today', money(stats.commissionToday), 'today', 'affiliate'],
    ['Users deposited today', text(stats.usersDepositedToday, '0'), 'person_add', 'affiliate'],
    ['Deposits today', `${text(stats.depositCountToday, '0')} · ${money(stats.depositsToday ?? stats.totalDepositsToday)}`, 'account_balance_wallet', 'affiliate'],
  ] as const;
  return <div className="admin-stack">
    <Intro title="Operations overview" description="Your referrals, commission, deposits and payout balance at a glance." onRefresh={load} loading={loading} />
    <Notice message={error} error /><Notice message={message} />
    <div className="admin-stat-grid">{cards.map(([title, value, icon, target]) => <button className="admin-stat" key={title} onClick={() => onNavigate(target as AdminPageKey)}><span className="material-symbols-rounded">{icon}</span><small>{title}</small><strong>{loading ? '…' : value}</strong><span className="material-symbols-rounded admin-stat-arrow">chevron_right</span></button>)}</div>
    <div className="admin-two-col">
      <Panel title="Payout balance" action={<Button tone="primary" onClick={requestPayout}><span className="material-symbols-rounded">request_quote</span>Request payout</Button>}>
        <div className="admin-status-list">
          <div><span>Available balance</span><b>{money(stats.commissionAmount ?? stats.availableBalance)}</b></div>
          <div><span>Lifetime commission</span><b>{money(stats.lifetimeCommission)}</b></div>
          <div><span>Total deposits referred</span><b>{money(stats.totalDeposits)}</b></div>
        </div>
      </Panel>
      <Panel title="Referral links" action={<Button onClick={createLink}><span className="material-symbols-rounded">add_link</span>New link</Button>}>
        {links.length ? links.slice(0, 5).map((l, i) => <div className="admin-status-list" key={i}><div><span><code>{text(l.code ?? l.link)}</code></span><b><button className="admin-button" onClick={() => { navigator.clipboard?.writeText(text(l.url ?? l.link)); setMessage('Link copied.'); }}>Copy</button></b></div></div>) : <p style={{ color: '#a99bb3', fontSize: 12 }}>No referral links yet. Create one to start earning.</p>}
      </Panel>
    </div>
  </div>;
}

function AdminMatches() {
  const [matches, setMatches] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ homeTeam: '', awayTeam: '', league: '', kickoffAt: '', homeScore: '', awayScore: '' });
  const load = async () => {
    setLoading(true); setError('');
    try { setMatches(rows(await api('GET', '/api/admin/matches'))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load matches'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const schedule = async () => {
    if (!form.homeTeam.trim() || !form.awayTeam.trim() || !form.kickoffAt) { setError('Home team, away team and kickoff time are required.'); return; }
    try {
      const res = await api('POST', '/admin/matches/auto', {
        homeTeam: form.homeTeam.trim(), awayTeam: form.awayTeam.trim(), league: form.league.trim() || 'Featured',
        kickoffAt: new Date(form.kickoffAt).toISOString(),
        finalScoreHome: Number(form.homeScore) || 0, finalScoreAway: Number(form.awayScore) || 0,
        featured: true,
      }) as Row;
      // Auto-create an ADMIN_ONLY booking code for the scheduled match
      try {
        await api('POST', '/api/admin/booking-codes', {
          bookingType: 'ADMIN_ONLY', label: `${form.homeTeam} v ${form.awayTeam}`,
          stake: 10, currency: 'GHS', maxRedemptions: 100,
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          selections: [{ fixture_id: res.matchId ?? res.id, match: `${form.homeTeam} vs ${form.awayTeam}`, market: '1X2', pick: '1', odds: 2.00, result: null }],
        });
      } catch { /* code creation is best-effort */ }
      setMessage('Match scheduled with booking code.');
      setForm({ homeTeam: '', awayTeam: '', league: '', kickoffAt: '', homeScore: '', awayScore: '' });
      setStep(1);
      load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not schedule match'); }
  };
  const setLive = async (row: Row) => {
    try { await api('PATCH', `/api/admin/matches/${encodeURIComponent(idOf(row))}/status`, { status: 'LIVE' }); setMessage('Match set live.'); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  };
  const setScore = async (row: Row) => {
    const home = window.prompt('Home score', String(row.scoreHome ?? '0'));
    if (home === null) return;
    const away = window.prompt('Away score', String(row.scoreAway ?? '0'));
    if (away === null) return;
    try { await api('PATCH', `/api/admin/matches/${encodeURIComponent(idOf(row))}/score`, { scoreHome: Number(home), scoreAway: Number(away) }); setMessage('Score updated.'); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  };
  const setFullTime = async (row: Row) => {
    try { await api('PATCH', `/api/admin/matches/${encodeURIComponent(idOf(row))}/status`, { status: 'FULL_TIME' }); setMessage('Match set to full time.'); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  };
  return <div className="admin-stack">
    <Intro title="Matches" description="Schedule matches and manage live scores." onRefresh={load} loading={loading} />
    <Notice message={error} error /><Notice message={message} />
    <Panel title={`Schedule a match — step ${step} of 3`}>
      {step === 1 && <div className="admin-form-grid">
        <input placeholder="Home team" value={form.homeTeam} onChange={e => setForm({ ...form, homeTeam: e.target.value })} />
        <input placeholder="Away team" value={form.awayTeam} onChange={e => setForm({ ...form, awayTeam: e.target.value })} />
        <input placeholder="League (optional)" value={form.league} onChange={e => setForm({ ...form, league: e.target.value })} />
        <Button tone="primary" onClick={() => setStep(2)}><span className="material-symbols-rounded">arrow_forward</span>Next</Button>
      </div>}
      {step === 2 && <div className="admin-form-grid">
        <input type="datetime-local" value={form.kickoffAt} onChange={e => setForm({ ...form, kickoffAt: e.target.value })} />
        <input type="number" min="0" placeholder="Final home score" value={form.homeScore} onChange={e => setForm({ ...form, homeScore: e.target.value })} />
        <input type="number" min="0" placeholder="Final away score" value={form.awayScore} onChange={e => setForm({ ...form, awayScore: e.target.value })} />
        <Button onClick={() => setStep(1)}><span className="material-symbols-rounded">arrow_back</span>Back</Button>
        <Button tone="primary" onClick={() => setStep(3)}><span className="material-symbols-rounded">arrow_forward</span>Review</Button>
      </div>}
      {step === 3 && <div>
        <div className="admin-status-list">
          <div><span>Fixture</span><b>{form.homeTeam} vs {form.awayTeam}</b></div>
          <div><span>Kickoff</span><b>{form.kickoffAt.replace('T', ' ')}</b></div>
          <div><span>Planned score</span><b>{form.homeScore || '0'} – {form.awayScore || '0'}</b></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Button onClick={() => setStep(2)}><span className="material-symbols-rounded">arrow_back</span>Back</Button>
          <Button tone="primary" onClick={schedule}><span className="material-symbols-rounded">event_available</span>Schedule match</Button>
        </div>
      </div>}
    </Panel>
    <Panel title="Managed matches">
      <Table data={matches} columns={['id', 'homeTeam', 'awayTeam', 'status', 'scoreHome', 'scoreAway', 'kickoffAt']} actions={row => <><Button onClick={() => setLive(row)}>Go live</Button><Button onClick={() => setScore(row)}>Score</Button><Button tone="danger" onClick={() => setFullTime(row)}>Full time</Button></>} />
    </Panel>
  </div>;
}

const RANDOM_TEAMS = ['Accra Lions', 'Kumasi Chiefs', 'Takoradi Waves', 'Tamale Stars', 'Cape Coast Royals', 'Ho Dynamo', 'Sunyani Sparks', 'Koforidua Kings', 'Tema Mariners', 'Obuasi Miners', 'Wa Warriors', 'Bolgatanga Bulls'];
function AdminRandomGames() {
  const [games, setGames] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const generate = () => {
    setLoading(true);
    const shuffled = [...RANDOM_TEAMS].sort(() => Math.random() - 0.5);
    const fresh: Row[] = [];
    for (let i = 0; i + 1 < shuffled.length && fresh.length < 4; i += 2) {
      fresh.push({
        id: `rnd-${Date.now()}-${i}`,
        homeTeam: shuffled[i], awayTeam: shuffled[i + 1],
        homeScore: Math.floor(Math.random() * 4), awayScore: Math.floor(Math.random() * 4),
        league: 'LuckyStake Lower Division', kickoffAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      });
    }
    setGames(fresh);
    setLoading(false);
    setMessage('Fixtures generated. Review scores, then mint booking codes.');
  };
  const mintCode = async (game: Row, combined: boolean) => {
    const targets = combined ? games : [game];
    try {
      const res = await api('POST', '/api/admin/booking-codes', {
        bookingType: 'ADMIN_ONLY',
        label: combined ? 'Random games acca' : `${game.homeTeam} v ${game.awayTeam}`,
        stake: 10, currency: 'GHS', maxRedemptions: 100,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        selections: targets.map(g => ({
          fixture_id: g.id, match: `${g.homeTeam} vs ${g.awayTeam}`,
          market: '1X2', pick: '1', odds: 2.00, result: null,
        })),
      }) as Row;
      setMessage(`Booking code minted: ${text(res.code ?? res.bookingCode, 'created')}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not mint code'); }
  };
  return <div className="admin-stack">
    <Intro title="Random games" description="Generate fictional lower-division fixtures and mint booking codes." onRefresh={generate} loading={loading} />
    <Notice message={error} error /><Notice message={message} />
    <Panel title="Fixtures" action={<Button tone="primary" onClick={generate}><span className="material-symbols-rounded">casino</span>Generate fixtures</Button>}>
      {games.length === 0 ? <p style={{ color: '#a99bb3', fontSize: 12 }}>No fixtures yet. Generate a set to get started.</p> :
        <><Table data={games} columns={['homeTeam', 'awayTeam', 'homeScore', 'awayScore', 'league']} actions={row => <Button onClick={() => mintCode(row, false)}><span className="material-symbols-rounded">confirmation_number</span>Mint code</Button>} />
        <div className="admin-toolbar" style={{ marginTop: 12 }}>
          <input type="number" placeholder="Home score override" id="rnd-h" style={{ maxWidth: 180 }} />
          <input type="number" placeholder="Away score override" id="rnd-a" style={{ maxWidth: 180 }} />
        </div>
        <Button tone="primary" onClick={() => mintCode(games[0], true)}><span className="material-symbols-rounded">confirmation_number</span>Mint combined code for all</Button></>}
    </Panel>
  </div>;
}

function AdminBookingCodes() {
  const [codes, setCodes] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ label: '', stake: '10', maxRedemptions: '100', legs: '' });
  const load = async () => {
    setLoading(true); setError('');
    try { setCodes(rows(await api('GET', '/api/admin/booking-codes?page=0&size=20'))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load codes'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    let legs: Row[] = [];
    try { legs = form.legs ? JSON.parse(form.legs) : []; } catch { setError('Legs must be valid JSON.'); return; }
    if (!legs.length) { setError('Add at least one leg as JSON.'); return; }
    try {
      const res = await api('POST', '/api/admin/booking-codes', {
        label: form.label.trim() || 'Admin booking code',
        stake: Number(form.stake) || 10, currency: 'GHS',
        maxRedemptions: Number(form.maxRedemptions) || 100,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        selections: legs,
      }) as Row;
      setMessage(`Code created: ${text(res.code ?? res.bookingCode, '')}`);
      setForm({ label: '', stake: '10', maxRedemptions: '100', legs: '' });
      load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create code'); }
  };
  return <div className="admin-stack">
    <Intro title="Booking codes" description="Build booking codes manually and track live codes." onRefresh={load} loading={loading} />
    <Notice message={error} error /><Notice message={message} />
    <Panel title="Create booking code">
      <div className="admin-form-grid">
        <input placeholder="Label" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
        <input placeholder="Reference stake (GHS)" type="number" min="1" value={form.stake} onChange={e => setForm({ ...form, stake: e.target.value })} />
        <input placeholder="Max redemptions" type="number" min="1" value={form.maxRedemptions} onChange={e => setForm({ ...form, maxRedemptions: e.target.value })} />
      </div>
      <div className="admin-toolbar" style={{ marginTop: 9 }}>
        <input placeholder='Legs JSON: [{"match":"A vs B","market":"1X2","pick":"1","odds":2.0}]' value={form.legs} onChange={e => setForm({ ...form, legs: e.target.value })} />
      </div>
      <Button tone="primary" onClick={create}><span className="material-symbols-rounded">confirmation_number</span>Create code</Button>
    </Panel>
    <Panel title="Live codes">
      <Table data={codes} columns={['code', 'label', 'stake', 'loads', 'maxRedemptions', 'status', 'expiresAt']} actions={row => <Button onClick={() => { navigator.clipboard?.writeText(text(row.code)); setMessage('Code copied.'); }}>Copy</Button>} />
    </Panel>
  </div>;
}

function AdminAffiliate() {
  const [stats, setStats] = useState<Row>({});
  const [links, setLinks] = useState<Row[]>([]);
  const [referred, setReferred] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [s, l, r] = await Promise.allSettled([
        api('GET', '/api/admin/affiliate/stats'),
        api('GET', '/api/admin/affiliate/links'),
        api('GET', '/api/admin/affiliate/referred-users'),
      ]);
      if (s.status === 'fulfilled') setStats((s.value || {}) as Row);
      if (l.status === 'fulfilled') setLinks(rows(l.value));
      if (r.status === 'fulfilled') setReferred(rows(r.value));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load affiliate'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const createLink = async () => {
    try { await api('POST', '/api/admin/affiliate/links', {}); setMessage('Referral link created.'); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create link'); }
  };
  const requestPayout = async () => {
    if (!window.confirm('Request payout of your commission balance?')) return;
    try { await api('POST', '/api/admin/affiliate/payout-request', {}); setMessage('Payout requested.'); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Payout request failed'); }
  };
  return <div className="admin-stack">
    <Intro title="Affiliate" description="Referral stats, links and commission payouts." onRefresh={load} loading={loading} />
    <Notice message={error} error /><Notice message={message} />
    <div className="admin-stat-grid">
      {[['Referrals', text(stats.totalReferrals, '0'), 'group_add'], ['Lifetime commission', money(stats.lifetimeCommission), 'payments'], ['Balance', money(stats.commissionAmount ?? stats.availableBalance), 'account_balance_wallet'], ['Links', String(links.length), 'link']].map(([t, v, icon]) =>
        <div className="admin-stat" key={t}><span className="material-symbols-rounded">{icon}</span><small>{t}</small><strong>{loading ? '…' : v}</strong></div>)}
    </div>
    <div className="admin-two-col">
      <Panel title="Referral links" action={<Button onClick={createLink}><span className="material-symbols-rounded">add_link</span>New link</Button>}>
        {links.length ? links.map((l, i) => <div className="admin-status-list" key={i}><div><span><code>{text(l.code ?? l.link)}</code></span><b><button className="admin-button" onClick={() => { navigator.clipboard?.writeText(text(l.url ?? l.link)); setMessage('Link copied.'); }}>Copy</button></b></div></div>) : <p style={{ color: '#a99bb3', fontSize: 12 }}>No links yet.</p>}
      </Panel>
      <Panel title="Commission" action={<Button tone="primary" onClick={requestPayout}><span className="material-symbols-rounded">request_quote</span>Request payout</Button>}>
        <div className="admin-status-list">
          <div><span>Commission today</span><b>{money(stats.commissionToday)}</b></div>
          <div><span>Referred users</span><b>{text(stats.totalReferrals, String(referred.length))}</b></div>
        </div>
      </Panel>
    </div>
    <Panel title="Referred users"><Table data={referred} columns={['id', 'name', 'email', 'createdAt']} /></Panel>
  </div>;
}

function AdminWithdrawals() {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setData(rows(await api('GET', '/api/wallet/withdrawals/admin/pending?page=0&size=50'))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load withdrawals'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const act = async (row: Row, kind: 'approve' | 'reject') => {
    try {
      await api('POST', `/api/wallet/withdrawals/admin/${encodeURIComponent(idOf(row))}/${kind}`, { note: '' });
      setMessage(`${kind === 'approve' ? 'Approved' : 'Rejected'}.`); load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); }
  };
  return <div className="admin-stack">
    <Intro title="Withdrawals" description="Review and action pending withdrawal requests." onRefresh={load} loading={loading} />
    <Notice message={error} error /><Notice message={message} />
    <Panel title="Pending review">
      <Table data={data} columns={['id', 'amount', 'status', 'createdAt']} actions={row => <><Button tone="primary" onClick={() => act(row, 'approve')}>Approve</Button><Button tone="danger" onClick={() => act(row, 'reject')}>Reject</Button></>} />
    </Panel>
  </div>;
}

function AdminGuide() {
  return <div className="admin-stack">
    <Intro title="How to use" description="A quick guide to the admin control room." onRefresh={() => {}} loading={false} />
    <Panel title="Admin guide">
      <div className="admin-status-list">
        <div><span>Overview</span><b>Track referrals, commission and deposits</b></div>
        <div><span>Matches</span><b>Schedule fixtures in 3 steps; set live, scores and full time</b></div>
        <div><span>Random games</span><b>Generate fictional fixtures and mint booking codes</b></div>
        <div><span>Booking codes</span><b>Create shareable codes with custom legs</b></div>
        <div><span>Affiliate</span><b>Manage referral links and request commission payouts</b></div>
        <div><span>Withdrawals</span><b>Approve or reject pending withdrawals</b></div>
      </div>
    </Panel>
    <Panel title="Booking codes while staking">
      <p style={{ color: '#a99bb3', fontSize: 13, margin: 0 }}>Every bet you place automatically generates a booking code in the background. Find it on the ticket detail page and share it with players — they can load your slip with the code.</p>
    </Panel>
  </div>;
}

// ============================================================================
// SUPER ADMIN TABS
// ============================================================================

function SuperDashboard({ onNavigate }: { onNavigate: (page: SuperPageKey) => void }) {
  const [metrics, setMetrics] = useState<Row>({});
  const [deposits, setDeposits] = useState<Row>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    const result = await Promise.allSettled([
      api('GET', '/api/super-admin/metrics'),
      api('GET', '/api/super-admin/metrics/deposits'),
    ]);
    if (result[0].status === 'fulfilled') setMetrics((result[0].value || {}) as Row);
    if (result[1].status === 'fulfilled') setDeposits((result[1].value || {}) as Row);
    if (result.some(r => r.status === 'rejected')) setError('Some dashboard sources could not be loaded.');
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const cards = [
    ['Registered users', text(metrics.totalUsers ?? metrics.userCount, '0'), 'group', 'users'],
    ['Administrators', text(metrics.totalAdmins ?? metrics.adminCount, '0'), 'admin_panel_settings', 'admins'],
    ['Deposited all time', money(deposits.totalDepositsAllTime ?? deposits.totalDeposits), 'account_balance_wallet', 'userdeposits'],
    ['Withdrawn all time', money(deposits.totalWithdrawalsAllTime ?? metrics.totalWithdrawals), 'payments', 'walletwithdrawals'],
  ] as const;
  return <div className="admin-stack">
    <Intro title="Platform overview" description="A live view of the sportsbook, finance queues, and staff activity." onRefresh={load} loading={loading} />
    <Notice message={error} error />
    <div className="admin-stat-grid">{cards.map(([title, value, icon, target]) => <button className="admin-stat" key={title} onClick={() => onNavigate(target as SuperPageKey)}><span className="material-symbols-rounded">{icon}</span><small>{title}</small><strong>{loading ? '…' : value}</strong><span className="material-symbols-rounded admin-stat-arrow">chevron_right</span></button>)}</div>
    <div className="admin-two-col">
      <Panel title="Quick actions">
        <div className="admin-quick-grid">
          <Button onClick={() => onNavigate('momo')}><span className="material-symbols-rounded">smartphone</span>MoMo deposits</Button>
          <Button onClick={() => onNavigate('walletwithdrawals')}><span className="material-symbols-rounded">payments</span>Wallet withdrawals</Button>
          <Button onClick={() => onNavigate('payouts')}><span className="material-symbols-rounded">request_quote</span>Payout requests</Button>
          <Button onClick={() => onNavigate('commission')}><span className="material-symbols-rounded">monitoring</span>Commission analytics</Button>
        </div>
      </Panel>
      <Panel title="System status">
        <div className="admin-status-list">
          <div><span>API connection</span><b className="online"><i />Operational</b></div>
          <div><span>Session role</span><b>Super admin</b></div>
          <div><span>Last refreshed</span><b>{new Date().toLocaleTimeString()}</b></div>
        </div>
      </Panel>
    </div>
  </div>;
}

function SuperAdmins() {
  const [data, setData] = useState<Row[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', commissionRate: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try { setData(rows(await api('GET', '/api/super-admin/admins/with-commission'))); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load administrators'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    const rate = Number(form.commissionRate);
    if (!form.name.trim() || !form.email.trim() || !form.password || !Number.isFinite(rate) || rate < 0 || rate > 100) { setError('Name, email, password, and a commission rate from 0 to 100 are required.'); return; }
    const parts = form.name.trim().split(/\s+/);
    try {
      await api('POST', '/api/super-admin/admins/with-commission', { email: form.email.trim(), password: form.password, firstName: parts.shift(), lastName: parts.join(' '), commissionRate: String(rate) });
      setForm({ name: '', email: '', password: '', commissionRate: '' });
      setMessage('Administrator created successfully.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create administrator'); }
  };
  const updateRate = async (row: Row) => {
    const value = window.prompt('Commission rate (%)', String(row.commissionRate ?? ''));
    if (value === null) return;
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) { setError('Commission rate must be between 0% and 100%.'); return; }
    try { await api('PATCH', `/api/super-admin/admins/${encodeURIComponent(idOf(row))}/commission-rate`, { commissionRate: rate }); setMessage('Commission rate updated.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update rate'); }
  };
  const addFunds = async (row: Row) => {
    const value = window.prompt('Amount to add (GHS)', '100');
    if (value === null) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a valid amount.'); return; }
    try { await api('POST', `/api/super-admin/admins/${encodeURIComponent(idOf(row))}/add-funds`, { amount }); setMessage('Funds added.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not add funds'); }
  };
  return <div className="admin-stack">
    <Intro title="Administrators" description="Create staff accounts, manage commission rates, and top up funds." onRefresh={load} loading={loading} />
    <Notice message={message} /><Notice message={error} error />
    <Panel title="Create administrator">
      <div className="admin-form-grid">
        <input placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Email address" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Temporary password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <input placeholder="Commission rate (%)" type="number" min="0" max="100" value={form.commissionRate} onChange={e => setForm({ ...form, commissionRate: e.target.value })} />
        <Button tone="primary" onClick={create}><span className="material-symbols-rounded">person_add</span>Create administrator</Button>
      </div>
    </Panel>
    <Panel title="Administrator accounts">
      <Table data={data} columns={['id', 'name', 'email', 'role', 'commissionRate', 'balance', 'status']} actions={row => <><Button onClick={() => updateRate(row)}>Edit rate</Button><Button onClick={() => addFunds(row)}>Top up</Button></>} />
    </Panel>
  </div>;
}

function SuperUsers() {
  const [data, setData] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const query = search ? `&search=${encodeURIComponent(search)}` : '';
      setData(rows(await api('GET', `/api/super-admin/users?page=0&size=50${query}`)));
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load users'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const toggle = async (row: Row) => {
    const id = idOf(row);
    const active = String(row.status ?? row.active ?? '').toLowerCase().includes('active') || row.active === true;
    try { await api('POST', `/api/v1/super-admin/users/${encodeURIComponent(id)}/${active ? 'deactivate' : 'activate'}`); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update user'); }
  };
  const credit = async (row: Row) => {
    const value = window.prompt('Amount to credit (GHS)', '50');
    if (value === null) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a valid amount.'); return; }
    try { await api('POST', `/api/super-admin/users/${encodeURIComponent(idOf(row))}/add-funds`, { amount }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not credit user'); }
  };
  return <div className="admin-stack">
    <Intro title="Users" description="Search customers, review account state, and manage access safely." onRefresh={load} loading={loading} />
    <Notice message={error} error />
    <Panel title="Customer directory">
      <div className="admin-toolbar">
        <input placeholder="Search by name or email" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        <Button onClick={load}><span className="material-symbols-rounded">search</span>Search</Button>
      </div>
      <Table data={data} columns={['id', 'name', 'email', 'role', 'status', 'createdAt']} actions={row => <><Button onClick={() => toggle(row)}>{String(row.status ?? row.active ?? '').toLowerCase().includes('active') ? 'Deactivate' : 'Activate'}</Button><Button onClick={() => credit(row)}>Credit</Button></>} />
    </Panel>
  </div>;
}

function SuperFinanceQueue({ page }: { page: SuperPageKey }) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('pending');
  const endpoint = useMemo(() => {
    const qs = '?page=0&size=50';
    switch (page) {
      case 'transactions': return `/api/super-admin/transactions${qs}`;
      case 'binance': return filter === 'pending' ? `/api/admin/binance-deposits/pending${qs}` : `/api/admin/binance-deposits${qs}`;
      case 'momo': return filter === 'pending' ? `/api/admin/momo-deposits/pending${qs}` : `/api/admin/momo-deposits${qs}`;
      case 'affwithdrawals': return `/api/super-admin/affiliate-withdrawals${qs}`;
      case 'payouts': return `/api/super-admin/payout-requests${qs}`;
      case 'walletwithdrawals': return `/api/wallet/withdrawals?page=0&size=50`;
      default: return `/api/super-admin/transactions${qs}`;
    }
  }, [page, filter]);
  const load = async () => {
    setLoading(true);
    try {
      const payload = await api('GET', endpoint);
      const r = rows(payload);
      setData(r.length ? r : (payload && typeof payload === 'object' && !Array.isArray(payload) ? [payload as Row] : []));
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this queue'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [endpoint]);
  const act = async (row: Row, kind: 'approve' | 'reject' | 'settle' | 'mark-paid' | 'mark-failed') => {
    const id = idOf(row);
    if (!id) return;
    const reason = kind === 'reject' ? window.prompt('Rejection reason (optional)', '') ?? '' : '';
    try {
      let path = '';
      if (page === 'binance') path = `/api/admin/binance-deposits/${encodeURIComponent(id)}/${kind}`;
      else if (page === 'momo') path = `/api/admin/momo-deposits/${encodeURIComponent(id)}/${kind}`;
      else if (page === 'affwithdrawals') path = `/api/super-admin/affiliate-withdrawals/${encodeURIComponent(id)}/${kind}`;
      else if (page === 'payouts') path = `/api/super-admin/payout-requests/${encodeURIComponent(id)}/${kind}`;
      else if (page === 'walletwithdrawals') path = kind === 'settle'
        ? `/api/wallet/withdrawals/super-admin/${encodeURIComponent(id)}/settle`
        : kind === 'mark-failed'
        ? `/api/wallet/withdrawals/super-admin/${encodeURIComponent(id)}/mark-failed`
        : `/api/wallet/withdrawals/super-admin/${encodeURIComponent(id)}/${kind}`;
      await api('POST', path, { note: reason, reason });
      setMessage('Action completed.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); }
  };
  const title = page === 'transactions' ? 'Transactions' : page === 'binance' ? 'Binance deposits' : page === 'momo' ? 'MoMo deposits' : page === 'affwithdrawals' ? 'Affiliate withdrawals' : page === 'payouts' ? 'Payout requests' : 'Wallet withdrawals';
  const desc = page === 'transactions' ? 'Paginated wallet transaction ledger.' : 'Review and action pending items.';
  const columns = data.length ? Object.keys(data[0]).filter(key => !['password', 'token'].includes(key)).slice(0, 8) : ['id', 'status', 'createdAt', 'amount'];
  const actionable = page !== 'transactions';
  return <div className="admin-stack">
    <Intro title={title} description={desc} onRefresh={load} loading={loading} />
    <Notice message={message} /><Notice message={error} error />
    <Panel title={actionable ? 'Pending review' : 'Latest records'} action={(page === 'binance' || page === 'momo') ? <div className="admin-toolbar" style={{ margin: 0 }}><Button tone={filter === 'pending' ? 'primary' : 'secondary'} onClick={() => setFilter('pending')}>Pending</Button><Button tone={filter === 'all' ? 'primary' : 'secondary'} onClick={() => setFilter('all')}>All</Button></div> : undefined}>
      <Table data={data} columns={columns} actions={actionable ? row => <><Button tone="primary" onClick={() => act(row, 'approve')}>Approve</Button>{page === 'walletwithdrawals' && <Button onClick={() => act(row, 'settle')}>Settle</Button>}{page === 'walletwithdrawals' && <Button onClick={() => act(row, 'mark-failed')}>Mark failed</Button>}{page === 'payouts' && <Button onClick={() => act(row, 'mark-paid')}>Mark paid</Button>}<Button tone="danger" onClick={() => act(row, 'reject')}>Reject</Button></> : undefined} />
    </Panel>
  </div>;
}

function SuperUserDeposits() {
  const [data, setData] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    if (!query.trim()) { setError('Enter an email or user ID.'); return; }
    setLoading(true); setError('');
    try { setData(rows(await api('GET', `/api/super-admin/users/${encodeURIComponent(query.trim())}/deposits`))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load deposits'); }
    finally { setLoading(false); }
  };
  return <div className="admin-stack">
    <Intro title="User deposits" description="Look up one user's full deposit history." onRefresh={() => {}} loading={loading} />
    <Notice message={error} error />
    <Panel title="Find user">
      <div className="admin-toolbar">
        <input placeholder="Email or user ID" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        <Button tone="primary" onClick={load}><span className="material-symbols-rounded">search</span>Look up</Button>
      </div>
    </Panel>
    {data.length > 0 && <Panel title="Deposit history"><Table data={data} columns={Object.keys(data[0]).filter(k => !['password', 'token'].includes(k)).slice(0, 8)} /></Panel>}
  </div>;
}

function SuperCommission() {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setData(rows(await api('GET', '/api/super-admin/commission/daily'))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load commission data'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  return <div className="admin-stack">
    <Intro title="Commission analytics" description="Per-admin commission earned — see who is actively working." onRefresh={load} loading={loading} />
    <Notice message={error} error />
    <Panel title="Daily commission by admin">
      <Table data={data} columns={data.length ? Object.keys(data[0]).filter(k => !['password', 'token'].includes(k)).slice(0, 8) : ['adminId', 'adminName', 'commissionToday']} />
    </Panel>
  </div>;
}

// ============================================================================
// MAIN PANEL
// ============================================================================

export default function AdminPanel({ role }: { role: Role }) {
  const isSuper = role === 'super-admin';
  const available = isSuper ? superPages : adminPages;
  const [page, setPage] = useState<PageKey>(isSuper ? 'dashboard' : 'overview');
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => { setPage(isSuper ? 'dashboard' : 'overview'); }, [isSuper]);

  const content = (() => {
    if (!isSuper) {
      switch (page as AdminPageKey) {
        case 'overview': return <AdminOverview onNavigate={setPage as (p: AdminPageKey) => void} />;
        case 'matches': return <AdminMatches />;
        case 'random': return <AdminRandomGames />;
        case 'codes': return <AdminBookingCodes />;
        case 'affiliate': return <AdminAffiliate />;
        case 'withdrawals': return <AdminWithdrawals />;
        case 'guide': return <AdminGuide />;
        default: return <AdminOverview onNavigate={setPage as (p: AdminPageKey) => void} />;
      }
    }
    switch (page as SuperPageKey) {
      case 'dashboard': return <SuperDashboard onNavigate={setPage as (p: SuperPageKey) => void} />;
      case 'admins': return <SuperAdmins />;
      case 'users': return <SuperUsers />;
      case 'userdeposits': return <SuperUserDeposits />;
      case 'commission': return <SuperCommission />;
      default: return <SuperFinanceQueue page={page as SuperPageKey} />;
    }
  })();

  return <div className="admin-app">
    <aside className={`admin-sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="admin-brand"><span className="admin-brand-mark">S</span><div><strong>Lucky<span>Stake</span></strong><small>{isSuper ? 'Super admin' : 'Admin'} control</small></div></div>
      <nav>{available.map(item => <button className={page === item.id ? 'active' : ''} key={item.id} onClick={() => { setPage(item.id); setMobileNav(false); }}><span className="material-symbols-rounded">{item.icon}</span>{item.label}</button>)}</nav>
      <a className="admin-exit" href="/"><span className="material-symbols-rounded">arrow_back</span>Back to sportsbook</a>
    </aside>
    {mobileNav && <button className="admin-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <main className="admin-main">
      <div className="admin-mobile-bar"><button onClick={() => setMobileNav(true)} aria-label="Open admin navigation"><span className="material-symbols-rounded">menu</span></button><strong>{isSuper ? 'Super admin' : 'Admin'}</strong></div>
      {content}
    </main>
  </div>;
}
