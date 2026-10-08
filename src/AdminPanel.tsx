import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

type Role = 'admin' | 'super-admin';
type Row = Record<string, unknown>;
type AdminPageKey = 'overview' | 'matches' | 'random' | 'codes' | 'affiliate' | 'withdrawals' | 'guide';
type SuperPageKey = 'dashboard' | 'admins' | 'users' | 'transactions' | 'binance' | 'userdeposits' | 'affwithdrawals' | 'payouts' | 'walletwithdrawals' | 'commission' | 'chats' | 'audit';
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
// Referral links point at /signup?ref=CODE. The backend returns the link's
// `code` (no full URL), so the shareable URL is built here — the code must be
// in the copied link or attribution is silently lost.
const referralUrlFor = (row: Row): string => {
  const rawUrl = text(row.url ?? row.link);
  if (rawUrl.startsWith('http')) return rawUrl;
  const code = text(row.code ?? rawUrl);
  if (typeof window === 'undefined' || !code) return rawUrl || code;
  return `${window.location.origin}/signup?ref=${encodeURIComponent(code)}`;
};
const isUserActive = (row: Row) => {
  if (row.active === true || row.isActive === true) return true;
  if (row.active === false || row.isActive === false) return false;
  const status = String(row.status ?? row.state ?? '').trim().toLowerCase();
  return status === 'active' || status === 'enabled' || status === 'true' || status === '1';
};

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

const adminPages: { id: AdminPageKey; label: string; icon: string; group: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'space_dashboard', group: 'Operate' },
  { id: 'matches', label: 'Matches', icon: 'sports_soccer', group: 'Operate' },
  { id: 'random', label: 'Random games', icon: 'casino', group: 'Operate' },
  { id: 'codes', label: 'Booking codes', icon: 'confirmation_number', group: 'Operate' },
  { id: 'affiliate', label: 'Affiliate', icon: 'group_add', group: 'Money' },
  { id: 'withdrawals', label: 'Withdrawals', icon: 'payments', group: 'Money' },
  { id: 'guide', label: 'How to use', icon: 'help', group: 'Help' },
];

const superPages: { id: SuperPageKey; label: string; icon: string; group: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'space_dashboard', group: 'Overview' },
  { id: 'commission', label: 'Commission analytics', icon: 'monitoring', group: 'Overview' },
  { id: 'admins', label: 'Administrators', icon: 'admin_panel_settings', group: 'People' },
  { id: 'users', label: 'Users', icon: 'group', group: 'People' },
  { id: 'chats', label: 'Upgrade chats', icon: 'forum', group: 'People' },
  { id: 'transactions', label: 'Transactions', icon: 'receipt_long', group: 'Money' },
  { id: 'binance', label: 'Binance deposits', icon: 'currency_bitcoin', group: 'Money' },
  { id: 'userdeposits', label: 'User deposits', icon: 'account_balance', group: 'Money' },
  { id: 'affwithdrawals', label: 'Affiliate withdrawals', icon: 'partner_exchange', group: 'Money' },
  { id: 'payouts', label: 'Payout requests', icon: 'request_quote', group: 'Money' },
  { id: 'walletwithdrawals', label: 'Wallet withdrawals', icon: 'payments', group: 'Money' },
  { id: 'audit', label: 'Audit trail', icon: 'fact_check', group: 'System' },
];

function Notice({ message, error }: { message: string; error?: boolean }) { return message ? <div className={`admin-notice ${error ? 'is-error' : 'is-success'}`}><span className="material-symbols-rounded">{error ? 'error' : 'check_circle'}</span>{message}</div> : null; }
function Intro({ title, description, onRefresh, loading }: { title: string; description: string; onRefresh: () => void; loading: boolean }) { return <div className="admin-intro"><div><span className="admin-eyebrow">LUCKYSTAKE CONTROL ROOM</span><h1>{title}</h1><p>{description}</p></div><button className="admin-refresh" onClick={onRefresh} aria-label="Refresh data"><span className={`material-symbols-rounded ${loading ? 'admin-spin' : ''}`}>refresh</span></button></div>; }
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="admin-panel"><div className="admin-panel-title"><h2>{title}</h2>{action}</div>{children}</section>; }
/** Raw database IDs mean nothing to a super admin — id/userId/adminId/walletId
 * columns are hidden from every table. Row actions keep using them internally
 * via idOf(), so approving, crediting and top-ups are unaffected. */
const isIdColumn = (key: string) => /^id$/i.test(key) || /Id$/.test(key);
function Table({ data, columns, actions, labels }: { data: Row[]; columns: string[]; actions?: (row: Row) => React.ReactNode; labels?: Record<string, string> }) {
  const visible = columns.filter(column => !isIdColumn(column));
  const cols = visible.length ? visible : columns;
  const title = (column: string) => labels?.[column] ?? column.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{cols.map(column => <th key={column}>{title(column)}</th>)}{actions && <th>Actions</th>}</tr></thead><tbody>{data.length === 0 ? <tr><td className="admin-empty" colSpan={cols.length + (actions ? 1 : 0)}>No records found.</td></tr> : data.map((row, index) => <tr key={idOf(row) || String(index)}>{cols.map(column => <td key={column} data-label={title(column)}>{text(row[column])}</td>)}{actions && <td data-label="Actions"><div className="admin-actions">{actions(row)}</div></td>}</tr>)}</tbody></table></div>;
}
function Button({ children, onClick, tone = 'secondary', disabled }: { children: React.ReactNode; onClick?: () => void; tone?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) { return <button className={`admin-button ${tone}`} onClick={onClick} disabled={disabled}>{children}</button>; }
function ScoreDialog({ home, away, initialHome, initialAway, onSubmit, onClose }: { home: string; away: string; initialHome: string; initialAway: string; onSubmit: (h: number, a: number) => void; onClose: () => void }) {
  const [h, setH] = useState(initialHome);
  const [a, setA] = useState(initialAway);
  const valid = h.trim() !== '' && a.trim() !== '' && Number.isFinite(Number(h)) && Number.isFinite(Number(a));
  return <div className="admin-modal-scrim" onClick={onClose}><div className="admin-modal" onClick={e => e.stopPropagation()}>
    <h3>Update score</h3>
    <div className="admin-score-grid">
      <label>{home}<input autoFocus type="number" min={0} value={h} onChange={e => setH(e.target.value)} aria-label="Home score" /></label>
      <span className="admin-score-dash">–</span>
      <label>{away}<input type="number" min={0} value={a} onChange={e => setA(e.target.value)} aria-label="Away score" onKeyDown={e => e.key === 'Enter' && valid && onSubmit(Number(h), Number(a))} /></label>
    </div>
    <div className="admin-modal-actions"><Button onClick={onClose}>Cancel</Button><Button tone="primary" disabled={!valid} onClick={() => valid && onSubmit(Number(h), Number(a))}>Save score</Button></div>
  </div></div>;
}
function PromptDialog({ title, label, initial, onSubmit, onClose }: { title: string; label: string; initial?: string; onSubmit: (v: string) => void; onClose: () => void }) {
  const [val, setVal] = useState(initial ?? '');
  return <div className="admin-modal-scrim" onClick={onClose}><div className="admin-modal" onClick={e => e.stopPropagation()}>
    <h3>{title}</h3><label>{label}<input autoFocus value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && val.trim() && onSubmit(val.trim())} /></label>
    <div className="admin-modal-actions"><Button onClick={onClose}>Cancel</Button><Button tone="primary" onClick={() => val.trim() && onSubmit(val.trim())}>Confirm</Button></div>
  </div></div>;
}

// ============================================================================
// REGULAR ADMIN TABS
// ============================================================================

function ReferralLinkCard({ link, onCopied }: { link: any; onCopied: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = String(link.url ?? link.link ?? '');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const fullUrl = url.startsWith('http') ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(fullUrl); } catch { try { const t = document.createElement('textarea'); t.value = fullUrl; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); } catch {} }
    setCopied(true); onCopied(); setTimeout(() => setCopied(false), 2000);
  };
  return <div className="ref-link-card">
    <div className="ref-link-info">
      <span className="material-symbols-rounded">link</span>
      <div><b>{String(link.label ?? link.name ?? link.code ?? 'Referral link')}</b><code>{fullUrl}</code></div>
    </div>
    <button type="button" className={`ref-copy-btn ${copied ? 'ok' : ''}`} onClick={copy}>
      <span className="material-symbols-rounded">{copied ? 'check' : 'content_copy'}</span>{copied ? 'Copied' : 'Copy'}
    </button>
  </div>;
}

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
        {links.length ? links.slice(0, 5).map((l, i) => <ReferralLinkCard key={i} link={l} onCopied={() => setMessage('Link copied to clipboard.')} />) : <p style={{ color: '#a99bb3', fontSize: 12 }}>No referral links yet. Create one to start earning.</p>}
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
  const [scoreFor, setScoreFor] = useState<Row | null>(null);
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
  const setScore = (row: Row) => setScoreFor(row);
  const saveScore = async (home: number, away: number) => {
    const row = scoreFor; setScoreFor(null); if (!row) return;
    try { await api('PATCH', `/api/admin/matches/${encodeURIComponent(idOf(row))}/score`, { scoreHome: home, scoreAway: away }); setMessage('Score updated.'); load(); }
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
    {scoreFor && <ScoreDialog home={text(scoreFor.homeTeam, 'Home')} away={text(scoreFor.awayTeam, 'Away')} initialHome={String(scoreFor.scoreHome ?? '0')} initialAway={String(scoreFor.scoreAway ?? '0')} onSubmit={saveScore} onClose={() => setScoreFor(null)} />}
  </div>;
}

// ============================================================================
// RANDOM GAMES — lower-division league library.
// Real lower-division leagues with their real clubs, grouped by region.
// "Mixed" mode draws each fixture from a different league; a single league
// keeps every fixture inside that competition, like PlusBet's generator
// but with a far deeper league + club pool (36 leagues, 450+ clubs).
// ============================================================================
type LeagueDef = { name: string; region: string; tier: string; teams: string[] };
const LOWER_LEAGUES: LeagueDef[] = [
  { name: 'EFL Championship', region: 'England', tier: 'Tier 2', teams: ['Coventry City', 'Middlesbrough', 'Ipswich Town', 'Southampton', 'Leicester City', 'West Bromwich Albion', 'Norwich City', 'Watford', 'Sheffield United', 'Blackburn Rovers', 'Millwall', 'Queens Park Rangers', 'Bristol City', 'Swansea City', 'Stoke City', 'Preston North End'] },
  { name: 'EFL League One', region: 'England', tier: 'Tier 3', teams: ['Barnsley', 'Blackpool', 'Bolton Wanderers', 'Bristol Rovers', 'Burton Albion', 'Cambridge United', 'Charlton Athletic', 'Exeter City', 'Leyton Orient', 'Lincoln City', 'Northampton Town', 'Peterborough United', 'Reading', 'Shrewsbury Town', 'Stevenage', 'Stockport County', 'Wigan Athletic', 'Wycombe Wanderers'] },
  { name: 'EFL League Two', region: 'England', tier: 'Tier 4', teams: ['Accrington Stanley', 'Barrow', 'Bradford City', 'Bromley', 'Carlisle United', 'Cheltenham Town', 'Chesterfield', 'Colchester United', 'Crewe Alexandra', 'Doncaster Rovers', 'Gillingham', 'Grimsby Town', 'Harrogate Town', 'MK Dons', 'Newport County', 'Notts County', 'Port Vale', 'Salford City', 'Swindon Town', 'Tranmere Rovers', 'Walsall'] },
  { name: 'National League', region: 'England', tier: 'Tier 5', teams: ['Aldershot Town', 'Altrincham', 'Barnet', 'Boston United', 'Braintree Town', 'Dagenham & Redbridge', 'Eastleigh', 'Ebbsfleet United', 'FC Halifax Town', 'Forest Green Rovers', 'Gateshead', 'Hartlepool United', 'Maidenhead United', 'Oldham Athletic', 'Rochdale', 'Solihull Moors', 'Southend United', 'Sutton United', 'Tamworth', 'Woking', 'Yeovil Town', 'York City'] },
  { name: 'National League North', region: 'England', tier: 'Tier 6', teams: ['AFC Fylde', 'Alfreton Town', 'Brackley Town', 'Buxton', 'Chester', 'Chorley', 'Curzon Ashton', 'Darlington', 'Hereford', 'Kidderminster Harriers', "King's Lynn Town", 'Leamington', 'Marine', 'Oxford City', 'Radcliffe', 'Scarborough Athletic', 'Scunthorpe United', 'South Shields', 'Southport', 'Spennymoor Town'] },
  { name: 'National League South', region: 'England', tier: 'Tier 6', teams: ['Bath City', 'Boreham Wood', 'Chelmsford City', 'Chesham United', 'Chippenham Town', 'Dorking Wanderers', 'Dover Athletic', 'Eastbourne Borough', 'Enfield Town', 'Farnborough', 'Hampton & Richmond', 'Hemel Hempstead Town', 'Hornchurch', 'Maidstone United', 'Salisbury', 'Slough Town', 'St Albans City', 'Tonbridge Angels', 'Torquay United', 'Truro City', 'Welling United', 'Weston-super-Mare', 'Worthing'] },
  { name: 'Isthmian Premier Division', region: 'England', tier: 'Tier 7', teams: ['Billericay Town', 'Bognor Regis Town', 'Canvey Island', 'Carshalton Athletic', 'Chatham Town', 'Cheshunt', 'Chichester City', 'Cray Wanderers', 'Dartford', 'Dulwich Hamlet', 'Folkestone Invicta', 'Hashtag United', 'Hastings United', 'Horsham', 'Lewes', 'Whitehawk'] },
  { name: 'Northern Premier League', region: 'England', tier: 'Tier 7', teams: ['Ashton United', 'Basford United', 'Blyth Spartans', 'Gainsborough Trinity', 'Guiseley', 'Hebburn Town', 'Hyde United', 'Ilkeston Town', 'Lancaster City', 'Leek Town', 'Macclesfield', 'Matlock Town', 'Morpeth Town', 'Prescot Cables', 'Stafford Rangers', 'Stockton Town', 'Warrington Town', 'Whitby Town', 'Worksop Town'] },
  { name: 'Southern League Premier Central', region: 'England', tier: 'Tier 7', teams: ['AFC Sudbury', 'Alvechurch', 'Banbury United', 'Barwell', 'Bedford Town', "Bishop's Stortford", 'Bromsgrove Sporting', 'Coalville Town', 'Halesowen Town', 'Harborough Town', 'Hitchin Town', 'Kettering Town', 'Leiston', 'Lowestoft Town', 'Redditch United', 'Royston Town', 'Spalding United', 'St Ives Town', 'Stamford', 'Stratford Town', 'AFC Telford United'] },
  { name: 'Scottish Championship', region: 'Scotland & Wales', tier: 'Tier 2', teams: ['Airdrieonians', 'Arbroath', 'Ayr United', 'Dunfermline Athletic', 'Falkirk', 'Greenock Morton', 'Livingston', 'Partick Thistle', "Queen's Park", 'Raith Rovers'] },
  { name: 'Scottish League One', region: 'Scotland & Wales', tier: 'Tier 3', teams: ['Alloa Athletic', 'Annan Athletic', 'Cove Rangers', 'Dumbarton', 'Hamilton Academical', 'Inverness Caledonian Thistle', 'Kelty Hearts', 'Montrose', 'Queen of the South', 'Stenhousemuir'] },
  { name: 'Scottish League Two', region: 'Scotland & Wales', tier: 'Tier 4', teams: ['Bonnyrigg Rose', 'Clyde', 'East Fife', 'Edinburgh City', 'Elgin City', 'Forfar Athletic', 'Peterhead', 'The Spartans', 'Stirling Albion', 'Stranraer'] },
  { name: 'Cymru Premier', region: 'Scotland & Wales', tier: 'Tier 1 · Wales', teams: ['Aberystwyth Town', 'Bala Town', 'Barry Town United', 'Caernarfon Town', 'Cardiff Metropolitan', "Connah's Quay Nomads", 'Flint Town United', 'Haverfordwest County', 'Llanelli Town', 'Newtown', 'Penybont', 'The New Saints'] },
  { name: 'Cymru South', region: 'Scotland & Wales', tier: 'Tier 2 · Wales', teams: ['Afan Lido', 'Ammanford', 'Baglan Dragons', 'Briton Ferry Llansawel', 'Caerau Ely', 'Cambrian United', 'Carmarthen Town', 'Cwmbran Celtic', 'Goytre United', 'Llantwit Major', 'Newport City', 'Pontardawe Town', 'Taffs Well', 'Trethomas Bluebirds', 'Ynyshir Albions'] },
  { name: 'League of Ireland First Division', region: 'Ireland', tier: 'Tier 2', teams: ['Athlone Town', 'Bray Wanderers', 'Cobh Ramblers', 'Dundalk', 'Finn Harps', 'Kerry FC', 'Longford Town', 'Treaty United', 'UCD', 'Wexford FC'] },
  { name: '2. Bundesliga', region: 'Europe', tier: 'Tier 2 · Germany', teams: ['Darmstadt 98', 'Dynamo Dresden', 'Eintracht Braunschweig', '1. FC Kaiserslautern', '1. FC Magdeburg', 'Fortuna Düsseldorf', 'Greuther Fürth', 'Hannover 96', 'Hertha BSC', 'Holstein Kiel', 'Karlsruher SC', '1. FC Nürnberg', 'SC Paderborn', 'Preußen Münster', 'Schalke 04', 'SV Elversberg', 'VfL Bochum'] },
  { name: '3. Liga', region: 'Europe', tier: 'Tier 3 · Germany', teams: ['1. FC Saarbrücken', 'Alemannia Aachen', 'Borussia Dortmund II', 'Energie Cottbus', 'Erzgebirge Aue', 'FC Ingolstadt', 'Hansa Rostock', 'MSV Duisburg', 'Rot-Weiss Essen', 'SC Verl', 'SSV Ulm', 'SV Waldhof Mannheim', 'TSV 1860 Munich', 'VfB Stuttgart II', 'VfL Osnabrück', 'Viktoria Köln', 'Wehen Wiesbaden'] },
  { name: 'Segunda División', region: 'Europe', tier: 'Tier 2 · Spain', teams: ['Albacete', 'Almería', 'FC Andorra', 'Burgos', 'Cádiz', 'Castellón', 'Córdoba', 'Deportivo La Coruña', 'Eibar', 'Granada', 'Huesca', 'Las Palmas', 'Leganés', 'Málaga', 'Mirandés', 'Racing Santander', 'Sporting Gijón', 'Real Valladolid', 'Real Zaragoza'] },
  { name: 'Primera Federación', region: 'Europe', tier: 'Tier 3 · Spain', teams: ['Antequera', 'Atlético Madrid B', 'Betis Deportivo', 'Celta Fortuna', 'Eldense', 'Gimnàstic Tarragona', 'UD Ibiza', 'Mérida', 'Real Murcia', 'Ponferradina', 'Sabadell', 'Sevilla Atlético', 'Tenerife', 'Unionistas de Salamanca', 'Villarreal B'] },
  { name: 'Serie B', region: 'Europe', tier: 'Tier 2 · Italy', teams: ['Avellino', 'Bari', 'Carrarese', 'Catanzaro', 'Cesena', 'Empoli', 'Frosinone', 'Juve Stabia', 'Mantova', 'Modena', 'Monza', 'Padova', 'Palermo', 'Pescara', 'Reggiana', 'Sampdoria', 'Spezia', 'Südtirol', 'Venezia', 'Virtus Entella'] },
  { name: 'Serie C', region: 'Europe', tier: 'Tier 3 · Italy', teams: ['Arezzo', 'Ascoli', 'Audace Cerignola', 'Benevento', 'Campobasso', 'Catania', 'Cosenza', 'Crotone', 'Foggia', 'Giugliano', 'Latina', 'Livorno', 'Monopoli', 'Perugia', 'Picerno', 'Potenza', 'Ravenna', 'Rimini', 'Salernitana', 'Siracusa', 'Sorrento', 'Torres', 'Trapani', 'Vicenza'] },
  { name: 'Ligue 2', region: 'Europe', tier: 'Tier 2 · France', teams: ['Amiens', 'Annecy', 'Bastia', 'Clermont Foot', 'Dunkerque', 'Grenoble', 'Guingamp', 'Laval', 'Le Mans', 'Montpellier', 'Nancy', 'Pau FC', 'Red Star', 'Stade de Reims', 'Rodez', 'Saint-Étienne', 'Troyes'] },
  { name: 'Championnat National', region: 'Europe', tier: 'Tier 3 · France', teams: ['Bourg-Péronnas', 'Caen', 'Châteauroux', 'Concarneau', 'Dijon', 'Fleury 91', 'Le Puy', 'Nîmes', 'Orléans', 'Paris 13 Atletico', 'Quevilly-Rouen', 'Rouen', 'Sochaux', 'Valenciennes', 'Versailles', 'Villefranche'] },
  { name: 'Eerste Divisie', region: 'Europe', tier: 'Tier 2 · Netherlands', teams: ['ADO Den Haag', 'Almere City', 'Cambuur', 'De Graafschap', 'Den Bosch', 'Dordrecht', 'FC Eindhoven', 'Emmen', 'Excelsior', 'Helmond Sport', 'Jong Ajax', 'Jong PSV', 'Jong Utrecht', 'MVV Maastricht', 'RKC Waalwijk', 'Roda JC', 'TOP Oss', 'Vitesse', 'VVV-Venlo', 'Willem II'] },
  { name: 'Liga Portugal 2', region: 'Europe', tier: 'Tier 2 · Portugal', teams: ['Académico Viseu', 'Benfica B', 'Chaves', 'Farense', 'Feirense', 'Felgueiras', 'Leixões', 'União Leiria', 'Marítimo', 'Oliveirense', 'Paços Ferreira', 'Penafiel', 'Porto B', 'Portimonense', 'Sporting CP B', 'Torreense', 'Vizela'] },
  { name: 'Challenger Pro League', region: 'Europe', tier: 'Tier 2 · Belgium', teams: ['Anderlecht Futures', 'Beerschot', 'SK Beveren', 'Club NXT', 'Eupen', 'Francs Borains', 'Jong Genk', 'Kortrijk', 'Lierse', 'Lokeren-Temse', 'Lommel', 'RWDM Brussels', 'Patro Eisden', 'RFC Liège', 'Seraing'] },
  { name: 'TFF 1. Lig', region: 'Europe', tier: 'Tier 2 · Türkiye', teams: ['Adanaspor', 'Amed SK', 'Ankara Keçiörengücü', 'Bandırmaspor', 'Bodrum FK', 'Boluspor', 'Çorum FK', 'Erzurumspor', 'Esenler Erokspor', 'Hatayspor', 'Iğdır FK', 'İstanbulspor', 'Manisa FK', 'Pendikspor', 'Sakaryaspor', 'Sivasspor', 'Ümraniyespor', 'Van Spor'] },
  { name: 'Ghana Premier League', region: 'Ghana & Africa', tier: 'Tier 1 · Ghana', teams: ['Accra Hearts of Oak', 'Asante Kotoko', 'Bechem United', 'Berekum Chelsea', 'Bibiani Gold Stars', 'Dreams FC', 'Heart of Lions', 'Karela United', 'Legon Cities', 'Medeama SC', 'Nations FC', 'Samartex', 'Vision FC', 'Young Apostles'] },
  { name: 'Ghana Division One League', region: 'Ghana & Africa', tier: 'Tier 2 · Ghana', teams: ['Asekem FC', 'Attram De Visser', 'BA United', 'Bofoakwa Tano', 'Ebusua Dwarfs', 'Eleven Wonders', 'Great Olympics', 'Hohoe United', 'King Faisal', 'Liberty Professionals', 'Mighty Jets', 'New Edubiase United', 'Nzema Kotoko', 'Okwawu United', 'Pac Academy', 'Skyy FC', 'Soccer Intellectuals', 'Steadfast FC', 'Tema Youth'] },
  { name: 'Nigeria National League', region: 'Ghana & Africa', tier: 'Tier 2 · Nigeria', teams: ['Abia Comets', 'Adamawa United', 'Beyond Limits FA', 'Crown FC', 'Dakkada FC', 'Edel FC', 'Gateway United', 'Gombe United', 'Kebbi United', 'Kogi United', 'Kun Khalifat FC', 'Osun United', 'Sokoto United', 'Sporting Lagos', 'Warri Wolves', 'Wikki Tourists'] },
  { name: 'USL Championship', region: 'Americas', tier: 'Tier 2 · USA', teams: ['Birmingham Legion', 'Charleston Battery', 'Colorado Springs Switchbacks', 'Detroit City FC', 'El Paso Locomotive', 'FC Tulsa', 'Hartford Athletic', 'Indy Eleven', 'Las Vegas Lights', 'Lexington SC', 'Loudoun United', 'Louisville City', 'Miami FC', 'Monterey Bay FC', 'New Mexico United', 'North Carolina FC', 'Oakland Roots', 'Orange County SC', 'Phoenix Rising', 'Pittsburgh Riverhounds', 'Rhode Island FC', 'Sacramento Republic', 'San Antonio FC', 'Tampa Bay Rowdies'] },
  { name: 'USL League One', region: 'Americas', tier: 'Tier 3 · USA', teams: ['AV Alta FC', 'Charlotte Independence', 'Chattanooga Red Wolves', 'FC Naples', 'Forward Madison', 'Greenville Triumph', 'One Knoxville', 'Portland Hearts of Pine', 'Richmond Kickers', 'South Georgia Tormenta', 'Spokane Velocity', 'Union Omaha', 'Westchester SC'] },
  { name: 'Brasileirão Série B', region: 'Americas', tier: 'Tier 2 · Brazil', teams: ['América Mineiro', 'Amazonas FC', 'Athletic Club MG', 'Atlético Goianiense', 'Avaí', 'Botafogo-SP', 'Ceará', 'Chapecoense', 'Coritiba', 'CRB', 'Cuiabá', 'Ferroviária', 'Goiás', 'Novorizontino', 'Operário-PR', 'Paysandu', 'Ponte Preta', 'Remo', 'Vila Nova', 'Volta Redonda'] },
  { name: 'Brasileirão Série C', region: 'Americas', tier: 'Tier 3 · Brazil', teams: ['ABC', 'Anápolis', 'Botafogo-PB', 'Brusque', 'Caxias', 'Confiança', 'CSA', 'Figueirense', 'Floresta', 'Guarani', 'Itabaiana', 'Ituano', 'Londrina', 'Maringá', 'Náutico', 'Retrô', 'São Bernardo', 'Tombense', 'Ypiranga'] },
  { name: 'Primera Nacional', region: 'Americas', tier: 'Tier 2 · Argentina', teams: ['Agropecuario', 'All Boys', 'Almagro', 'Alvarado', 'Atlanta', 'Atlético de Rafaela', 'Chacarita Juniors', 'Colón', 'Defensores de Belgrano', 'Deportivo Madryn', 'Deportivo Morón', 'Estudiantes BA', 'Ferro Carril Oeste', 'Gimnasia de Jujuy', 'Gimnasia de Mendoza', 'Nueva Chicago', 'Quilmes', 'Racing de Córdoba', 'San Martín de Tucumán', 'Temperley', 'Tristán Suárez'] },
  { name: 'J2 League', region: 'Asia & Oceania', tier: 'Tier 2 · Japan', teams: ['Blaublitz Akita', 'Ehime FC', 'FC Imabari', 'Fujieda MYFC', 'Iwaki FC', 'JEF United Chiba', 'Júbilo Iwata', 'Kataller Toyama', 'Mito HollyHock', 'Montedio Yamagata', 'Oita Trinita', 'RB Omiya Ardija', 'Renofa Yamaguchi', 'Roasso Kumamoto', 'Sagan Tosu', 'Tokushima Vortis', 'V-Varen Nagasaki', 'Vegalta Sendai', 'Ventforet Kofu'] },
];
const MIXED = 'Mixed — all lower divisions';
const LEAGUE_REGIONS = [...new Set(LOWER_LEAGUES.map(l => l.region))];
const TOTAL_CLUBS = LOWER_LEAGUES.reduce((n, l) => n + l.teams.length, 0);
const leagueByName = (name: string) => LOWER_LEAGUES.find(l => l.name === name);
/** Deterministic pseudo-strength from the club name so odds look priced, not random. */
const clubStrength = (name: string) => { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997; return 0.82 + (h % 40) / 100; };
const shuffle = <T,>(pool: T[]): T[] => { const copy = [...pool]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; };
const pricedOdds = (home: string, away: string) => {
  const diff = clubStrength(home) - clubStrength(away) + 0.12; // home edge
  const raw = 2.45 - diff * 2.1 + (Math.random() - 0.5) * 0.3;
  return Number(Math.min(4.6, Math.max(1.45, raw)).toFixed(2));
};

type RndGame = { homeTeam: string; awayTeam: string; league: string; kickoffAt: string; scoreHome: number; scoreAway: number; odds: number; id?: string };

function AdminRandomGames() {
  const [quantity, setQuantity] = useState('6');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [league, setLeague] = useState<string>(MIXED);
  const [dHome, setDHome] = useState('1');
  const [dAway, setDAway] = useState('0');
  const [games, setGames] = useState<RndGame[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [codeLabel, setCodeLabel] = useState('Random games booking code');
  const [createdCode, setCreatedCode] = useState('');
  const [individualCodes, setIndividualCodes] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState('');
  useEffect(() => {
    if (!date) {
      const d = new Date(Date.now() + 86400000);
      setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  }, [date]);
  const generate = () => {
    const count = Math.max(1, Math.min(30, Number(quantity) || 1));
    const kickoff = new Date(`${date}T${time}:00`);
    if (Number.isNaN(kickoff.getTime()) || kickoff.getTime() <= Date.now()) { setError('Choose a future start date and time.'); return; }
    const usedPairs = new Set<string>();
    const fresh: RndGame[] = [];
    const mixedPool = shuffle(LOWER_LEAGUES);
    for (let i = 0; i < count; i++) {
      const def = league === MIXED ? mixedPool[i % mixedPool.length] : leagueByName(league) ?? LOWER_LEAGUES[0];
      const teams = shuffle(def.teams);
      let home = teams[0]; let away = teams[1];
      let guard = 0;
      while (usedPairs.has(`${def.name}|${home}|${away}`) && guard++ < 8) {
        const again = shuffle(def.teams); home = again[0]; away = again[1];
      }
      usedPairs.add(`${def.name}|${home}|${away}`);
      fresh.push({
        homeTeam: home, awayTeam: away, league: def.name,
        kickoffAt: new Date(kickoff.getTime() + i * 5 * 60000).toISOString(),
        scoreHome: Number(dHome) || 0, scoreAway: Number(dAway) || 0,
        odds: pricedOdds(home, away),
      });
    }
    setGames(fresh); setCreatedCode(''); setIndividualCodes({}); setError('');
    setMessage(`${fresh.length} fixtures prepared across ${new Set(fresh.map(g => g.league)).size} league${new Set(fresh.map(g => g.league)).size === 1 ? '' : 's'}. Review scores, then create the games.`);
  };
  const upd = (index: number, patch: Partial<RndGame>) =>
    setGames(rs => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const removeGame = (index: number) => setGames(rs => rs.filter((_, i) => i !== index));
  const createGames = async () => {
    if (!games.length) { setError('Generate fixtures first.'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      const created: RndGame[] = [];
      for (const row of games) {
        const res = await api('POST', '/admin/matches/auto', {
          homeTeam: row.homeTeam, awayTeam: row.awayTeam, league: row.league,
          kickoffAt: row.kickoffAt,
          finalScoreHome: row.scoreHome, finalScoreAway: row.scoreAway,
          featured: true,
        }) as Row;
        created.push({ ...row, id: text(res.matchId ?? res.id) });
      }
      setGames(created);
      setMessage(`${created.length} games created and featured. Now mint booking codes below.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create games'); }
    finally { setSaving(false); }
  };
  const selectionFor = (row: RndGame) => ({
    fixture_id: row.id, match: `${row.homeTeam} vs ${row.awayTeam}`,
    market: '1X2', pick: '1', odds: row.odds, result: null,
  });
  const mintCode = async (targets: RndGame[], individual: boolean) => {
    const selected = targets.filter(r => r.id);
    if (!selected.length) { setError('Create the games first.'); return; }
    if (selected.some(r => !Number.isFinite(r.odds) || r.odds < 1.1)) { setError('Odds must be at least 1.10 for every game.'); return; }
    setLoading(true); setError('');
    try {
      let combined = '';
      for (const row of selected) {
        const res = await api('POST', '/api/admin/booking-codes', {
          bookingType: 'ADMIN_ONLY',
          label: individual ? `${codeLabel} — ${row.homeTeam} vs ${row.awayTeam}` : codeLabel,
          stake: 10, currency: 'GHS', maxRedemptions: 100,
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          selections: individual ? [selectionFor(row)] : selected.map(selectionFor),
        }) as Row;
        const code = text(res.code ?? res.bookingCode);
        if (individual && row.id) setIndividualCodes(c => ({ ...c, [row.id as string]: code }));
        if (!individual) { combined = code; break; }
      }
      if (!individual) setCreatedCode(combined);
      setMessage(individual ? `Minted ${selected.length} individual codes.` : `Combined booking code minted${combined ? `: ${combined}` : ''}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not mint code'); }
    finally { setLoading(false); }
  };
  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(''), 1800); }
    catch { setError('Clipboard unavailable — copy the code manually.'); }
  };
  const created = games.filter(g => g.id);
  const activeDef = league === MIXED ? null : leagueByName(league);
  return <div className="admin-stack">
    <Intro title="Random games" description="Generate lower-division fixtures from real leagues and clubs, create them as featured matches, then mint booking codes." onRefresh={generate} loading={loading} />
    <Notice message={error} error /><Notice message={message} />
    <div className="rnd-library-strip">
      <div><strong>{LOWER_LEAGUES.length}</strong><span>leagues</span></div>
      <div><strong>{TOTAL_CLUBS}</strong><span>clubs</span></div>
      <div><strong>{LEAGUE_REGIONS.length}</strong><span>regions</span></div>
      <p>Lower divisions only — Championship down to tier 7, plus Ghana, Nigeria, USL, Série B/C, J2 and more.</p>
    </div>
    <Panel title="Generate fixtures">
      <div className="admin-form-grid rnd-form">
        <label>Games<input type="number" min={1} max={30} value={quantity} onChange={e => setQuantity(e.target.value)} aria-label="Number of games" /></label>
        <label className="rnd-league-field">League
          <select value={league} onChange={e => setLeague(e.target.value)} aria-label="League">
            <option value={MIXED}>{MIXED}</option>
            {LEAGUE_REGIONS.map(region => <optgroup key={region} label={region}>
              {LOWER_LEAGUES.filter(l => l.region === region).map(l => <option key={l.name} value={l.name}>{l.name} · {l.teams.length} clubs</option>)}
            </optgroup>)}
          </select>
        </label>
        <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Start date" /></label>
        <label>Time<input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label="Start time" /></label>
        <label>Home score<input type="number" min={0} value={dHome} onChange={e => setDHome(e.target.value)} aria-label="Default home score" /></label>
        <label>Away score<input type="number" min={0} value={dAway} onChange={e => setDAway(e.target.value)} aria-label="Default away score" /></label>
      </div>
      {activeDef && <p className="rnd-league-note"><span className="material-symbols-rounded">stadium</span>{activeDef.name} — {activeDef.tier} · {activeDef.region} · {activeDef.teams.length} clubs in the pool</p>}
      <div className="admin-toolbar"><Button tone="primary" onClick={generate}><span className="material-symbols-rounded">casino</span>Generate fixtures</Button></div>
    </Panel>
    {games.length > 0 && <Panel title={`Review & create — ${games.length} fixtures`} action={<span className="admin-panel-note">Kickoffs staggered by 5 min</span>}>
      <div className="rnd-list">
        {games.map((g, i) => <article className="rnd-card" key={`${g.homeTeam}-${g.awayTeam}-${i}`}>
          <header className="rnd-card-head">
            <span className="rnd-card-league">{g.league}</span>
            <span className="rnd-card-time">{new Date(g.kickoffAt).toLocaleString('en-GH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            <span className={`admin-pill ${g.id ? 'ok' : 'wait'}`}>{g.id ? 'Created' : 'Ready'}</span>
            {!g.id && <button type="button" className="rnd-remove" onClick={() => removeGame(i)} aria-label={`Remove ${g.homeTeam} vs ${g.awayTeam}`}><span className="material-symbols-rounded">close</span></button>}
          </header>
          <div className="rnd-card-teams"><strong>{g.homeTeam}</strong><span>vs</span><strong>{g.awayTeam}</strong></div>
          <div className="rnd-card-editors">
            <label>Score<input type="number" min={0} value={g.scoreHome} onChange={e => upd(i, { scoreHome: Math.max(0, Number(e.target.value) || 0) })} aria-label="Home score" /></label>
            <span className="rnd-dash">–</span>
            <label className="rnd-away-score">Away<input type="number" min={0} value={g.scoreAway} onChange={e => upd(i, { scoreAway: Math.max(0, Number(e.target.value) || 0) })} aria-label="Away score" /></label>
            <label>Home odds<input type="number" min={1.1} step={0.01} value={g.odds} onChange={e => upd(i, { odds: Number(e.target.value) || 1.1 })} aria-label="Odds" /></label>
          </div>
          {g.id && individualCodes[g.id] && <div className="rnd-card-code"><code>{individualCodes[g.id as string]}</code><Button onClick={() => copyCode(individualCodes[g.id as string])}>{copied === individualCodes[g.id as string] ? 'Copied' : 'Copy'}</Button></div>}
        </article>)}
      </div>
      <div className="admin-toolbar" style={{ marginTop: 12 }}>
        <Button tone="primary" onClick={createGames} disabled={saving || created.length === games.length}>{saving ? 'Creating…' : 'Create & feature games'}</Button>
      </div>
    </Panel>}
    {created.length > 0 && <Panel title="Booking codes">
      <div className="admin-toolbar">
        <input value={codeLabel} onChange={e => setCodeLabel(e.target.value)} placeholder="Code label" aria-label="Code label" />
        <Button tone="primary" onClick={() => mintCode(created, false)} disabled={loading}><span className="material-symbols-rounded">confirmation_number</span>{loading ? 'Minting…' : 'Mint combined code'}</Button>
        <Button onClick={() => mintCode(created, true)} disabled={loading}>Mint individual codes</Button>
      </div>
      {createdCode && <div className="ref-link-card"><div className="ref-link-info"><span className="material-symbols-rounded">confirmation_number</span><div><b>Combined booking code</b><code>{createdCode}</code></div></div><button className={`ref-copy-btn${copied === createdCode ? ' ok' : ''}`} onClick={() => copyCode(createdCode)}><span className="material-symbols-rounded">content_copy</span>{copied === createdCode ? 'Copied' : 'Copy'}</button></div>}
    </Panel>}
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
  const [daily, setDaily] = useState<Row>({});
  const [links, setLinks] = useState<Row[]>([]);
  const [referred, setReferred] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [s, d, l, r] = await Promise.allSettled([
        api('GET', '/api/admin/affiliate/stats'),
        api('GET', '/api/admin/affiliate/commission/daily-summary'),
        api('GET', '/api/admin/affiliate/links'),
        api('GET', '/api/admin/affiliate/referred-users'),
      ]);
      if (s.status === 'fulfilled') setStats((s.value || {}) as Row);
      if (d.status === 'fulfilled') setDaily((d.value || {}) as Row);
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
      {[['Referrals', text(stats.totalReferrals, '0'), 'group_add'], ['Lifetime commission', money(stats.lifetimeCommission), 'payments'], ['Balance owed', money(stats.commissionBalance), 'account_balance_wallet'], ["Today's deposits", money(daily.totalDeposits), 'savings'], ['Commission today', money(daily.commissionAmount), 'today'], ['Links', String(links.length), 'link']].map(([t, v, icon]) =>
        <div className="admin-stat" key={t}><span className="material-symbols-rounded">{icon}</span><small>{t}</small><strong>{loading ? '…' : v}</strong></div>)}
    </div>
    <div className="admin-two-col">
      <Panel title="Referral links" action={<Button onClick={createLink}><span className="material-symbols-rounded">add_link</span>New link</Button>}>
        {links.length ? links.map((l, i) => { const url = referralUrlFor(l); return <div className="admin-status-list" key={i}><div><span><code>{url}</code></span><b><button className="admin-button" onClick={() => { navigator.clipboard?.writeText(url); setMessage('Referral link copied.'); }}>Copy</button></b></div></div>; }) : <p style={{ color: '#a99bb3', fontSize: 12 }}>No links yet.</p>}
      </Panel>
      <Panel title="Commission" action={<Button tone="primary" onClick={requestPayout}><span className="material-symbols-rounded">request_quote</span>Request payout</Button>}>
        <div className="admin-status-list">
          <div><span>Commission today</span><b>{money(daily.commissionAmount)}</b></div>
          <div><span>Deposits today ({text(daily.totalDepositCount, '0')})</span><b>{money(daily.totalDeposits)}</b></div>
          <div><span>Balance owed</span><b>{money(stats.commissionBalance)}</b></div>
          <div><span>Lifetime earned</span><b>{money(stats.totalEarnedLifetime ?? stats.lifetimeCommission)}</b></div>
          <div><span>Lifetime paid out</span><b>{money(stats.totalPaidOutLifetime)}</b></div>
          <div><span>Referred users</span><b>{text(stats.totalReferrals, String(referred.length))}</b></div>
        </div>
      </Panel>
    </div>
    <Panel title="Today's referred deposits">
      <Table data={rows(daily.depositsByUser).map(u => ({ ...u, name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || text(u.email, '—'), amount: money(u.depositTotal) }))} columns={['name', 'email', 'country', 'amount']} labels={{ name: 'User', email: 'Email', country: 'Country', amount: 'Deposited' }} />
    </Panel>
    <AffiliateInsights />
    <AffiliatePayoutHistory />
    <Panel title="Referred users"><Table data={referred} columns={['id', 'name', 'email', 'createdAt']} /></Panel>
  </div>;
}

function AffiliateInsights() {
  const [tab, setTab] = useState<'commission' | 'deposits'>('commission');
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [commission, setCommission] = useState<Row[]>([]);
  const [deposits, setDeposits] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      if (tab === 'commission') {
        const path = range === 'daily' ? '/api/admin/affiliate/commission/daily?days=30' : range === 'weekly' ? '/api/admin/affiliate/commission/weekly?weeks=12' : '/api/admin/affiliate/commission/monthly?months=12';
        setCommission(rows(await api('GET', path)));
      } else {
        const path = range === 'daily' ? '/api/admin/affiliate/deposits/by-country/daily?days=30' : range === 'weekly' ? '/api/admin/affiliate/deposits/by-country/weekly?weeks=12' : '/api/admin/affiliate/deposits/by-country/monthly?months=12';
        setDeposits(rows(await api('GET', path)));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load insights'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [tab, range]);
  const total = (list: Row[]) => list.reduce((t, r) => t + numberValue(r.amount ?? r.total ?? r.commissionAmount), 0);
  return <Panel title="Revenue insights" action={<div className="admin-toolbar admin-seg" style={{ margin: 0 }}>
    <Button tone={tab === 'commission' ? 'primary' : undefined} onClick={() => setTab('commission')}>Commission</Button>
    <Button tone={tab === 'deposits' ? 'primary' : undefined} onClick={() => setTab('deposits')}>Deposits by country</Button>
    {(['daily', 'weekly', 'monthly'] as const).map(r => <Button key={r} tone={range === r ? 'primary' : undefined} onClick={() => setRange(r)}>{r}</Button>)}
  </div>}>
    <Notice message={error} error />
    {loading ? <p style={{ color: '#a99bb3', fontSize: 12 }}>Loading…</p> :
      tab === 'commission'
        ? <><p style={{ color: '#a99bb3', fontSize: 12 }}>Total {range} commission: <b style={{ color: '#fff' }}>{money(total(commission))}</b></p>
            <Table data={commission} columns={['periodLabel', 'periodStart', 'amount', 'currency']} labels={{ periodLabel: 'Period', periodStart: 'Start', amount: 'Amount', currency: 'Currency' }} /></>
        : <><p style={{ color: '#a99bb3', fontSize: 12 }}>Total deposits: <b style={{ color: '#fff' }}>{money(total(deposits))}</b></p>
            <Table data={deposits} columns={['periodLabel', 'country', 'amount', 'depositCount']} labels={{ periodLabel: 'Period', country: 'Country', amount: 'Amount', depositCount: 'Deposits' }} /></>}
  </Panel>;
}

function AffiliatePayoutHistory() {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try { setData(rows(await api('GET', '/api/admin/affiliate/payout-requests?page=0&size=20'))); }
    catch { setData([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  return <Panel title="Affiliate payout history" action={<Button onClick={load}>Refresh</Button>}>
    {loading ? <p style={{ color: '#a99bb3', fontSize: 12 }}>Loading…</p> :
      <Table data={data.map(r => ({ ...r, amount: money(r.amount) }))} columns={['amount', 'status', 'method', 'createdAt', 'processedAt']} labels={{ amount: 'Amount', status: 'Status', method: 'Method', createdAt: 'Requested', processedAt: 'Processed' }} />}
  </Panel>;
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
    try {
      const list = rows(await api('GET', '/api/super-admin/admins/with-commission'));
      setData(list.map(r => ({ ...r, commissionRate: `${numberValue(r.commissionRate)}%`, unpaidBalance: money(r.unpaidBalance), lifetimeEarned: money(r.lifetimeEarned), lifetimePaidOut: money(r.lifetimePaidOut) })));
      setError('');
    }
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
  const [prompt, setPrompt] = useState<null | { title: string; label: string; initial: string; onSubmit: (v: string) => void }>(null);
  const updateRate = (row: Row) => {
    setPrompt({ title: 'Edit commission rate', label: `Rate for ${labelOf(row)} (%)`, initial: String(row.commissionRate ?? '').replace('%', ''),
      onSubmit: async (value) => { setPrompt(null);
        const rate = Number(value);
        if (!Number.isFinite(rate) || rate < 0 || rate > 100) { setError('Commission rate must be between 0% and 100%.'); return; }
        try { await api('PATCH', `/api/super-admin/admins/${encodeURIComponent(idOf(row))}/commission-rate`, { commissionRate: rate }); setMessage('Commission rate updated.'); await load(); }
        catch (e) { setError(e instanceof Error ? e.message : 'Could not update rate'); } } });
  };
  const addFunds = (row: Row) => {
    setPrompt({ title: 'Top up administrator', label: `Amount to add for ${labelOf(row)} (GHS)`, initial: '100',
      onSubmit: async (value) => { setPrompt(null);
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a valid amount.'); return; }
        try { await api('POST', `/api/super-admin/admins/${encodeURIComponent(idOf(row))}/add-funds`, { amount }); setMessage('Funds added.'); await load(); }
        catch (e) { setError(e instanceof Error ? e.message : 'Could not add funds'); } } });
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
      <Table data={data} columns={['adminName', 'email', 'commissionRate', 'unpaidBalance', 'lifetimeEarned', 'lifetimePaidOut']}
        labels={{ adminName: 'Admin', commissionRate: 'Rate', unpaidBalance: 'Unpaid', lifetimeEarned: 'Lifetime earned', lifetimePaidOut: 'Paid out' }}
        actions={row => <><Button onClick={() => updateRate(row)}>Edit rate</Button><Button onClick={() => addFunds(row)}>Top up</Button></>} />
    </Panel>
    {prompt && <PromptDialog title={prompt.title} label={prompt.label} initial={prompt.initial} onSubmit={prompt.onSubmit} onClose={() => setPrompt(null)} />}
  </div>;
}

function SuperUsers() {
  const [data, setData] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const query = search ? `&search=${encodeURIComponent(search)}` : '';
      const list = rows(await api('GET', `/api/super-admin/users?page=0&size=50${query}`));
      setData(list.map(r => {
        const fullName = [r.firstName, r.lastName].filter(Boolean).join(' ').trim();
        return { ...r, name: text(r.name ?? (fullName || undefined), labelOf(r)) };
      }));
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load users'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const toggle = async (row: Row) => {
    const id = idOf(row);
    const active = isUserActive(row);
    if (!window.confirm(`Are you sure you want to ${active ? 'deactivate' : 'activate'} this account?`)) return;
    try { await api('PATCH', `/api/v1/super-admin/users/${encodeURIComponent(id)}/${active ? 'deactivate' : 'activate'}`); setMessage(`Account ${active ? 'deactivated' : 'activated'}.`); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update user'); }
  };
  const [creditPrompt, setCreditPrompt] = useState<null | { row: Row }>(null);
  const credit = (row: Row) => { setCreditPrompt({ row }); };
  const doCredit = async (value: string) => {
    const row = creditPrompt?.row; setCreditPrompt(null); if (!row) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a valid amount.'); return; }
    try { await api('POST', `/api/super-admin/users/${encodeURIComponent(idOf(row))}/add-funds`, { amount }); setMessage('User credited.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not credit user'); }
  };
  return <div className="admin-stack">
    <Intro title="Users" description="Search customers, review account state, and manage access safely." onRefresh={load} loading={loading} />
    <Notice message={error} error /><Notice message={message} />
    <Panel title="Customer directory">
      <div className="admin-toolbar">
        <input placeholder="Search by name or email" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        <Button onClick={load}><span className="material-symbols-rounded">search</span>Search</Button>
      </div>
      <Table data={data} columns={['id', 'name', 'email', 'role', 'status', 'createdAt']} actions={row => <><Button onClick={() => toggle(row)}>{isUserActive(row) ? 'Deactivate' : 'Activate'}</Button><Button onClick={() => credit(row)}>Credit</Button></>} />
    </Panel>
    {creditPrompt && <PromptDialog title="Credit user" label={`Amount to credit ${labelOf(creditPrompt.row)} (GHS)`} initial="50" onSubmit={doCredit} onClose={() => setCreditPrompt(null)} />}
  </div>;
}

// ------------------------------------------------------------------ super-admin Binance deposits
// Crypto deposit proofs — approve requires the credited GHS amount, reject a reason.
function SuperBinanceQueue() {
  const [data, setData] = useState<Row[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [credited, setCredited] = useState('');
  const [note, setNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const payload = await api('GET', filter === 'pending' ? '/api/admin/binance-deposits/pending?page=0&size=50' : '/api/admin/binance-deposits?page=0&size=50');
      setData(rows(payload)); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load Binance deposits'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filter]);
  const openDetail = (row: Row) => {
    setSelected(row);
    setCredited(String(row.expectedGhsAmount ?? row.creditedGhsAmount ?? ''));
    setNote(String(row.adminNote ?? ''));
    setRejectReason(''); setFormErr('');
  };
  const approve = async () => {
    if (!selected) return;
    const amt = Number(credited);
    if (!Number.isFinite(amt) || amt <= 0) { setFormErr('Enter a valid credited GHS amount.'); return; }
    const id = idOf(selected); if (!id) return;
    setBusy(true); setFormErr('');
    try {
      await api('POST', `/api/admin/binance-deposits/${encodeURIComponent(id)}/approve`, { creditedGhsAmount: amt, adminNote: note.trim() || undefined });
      setMessage('Binance deposit approved and wallet credited.'); setSelected(null); await load();
    } catch (e) { setFormErr(e instanceof Error ? e.message : 'Approval failed'); }
    finally { setBusy(false); }
  };
  const reject = async () => {
    if (!selected) return;
    if (!rejectReason.trim()) { setFormErr('Enter a rejection reason.'); return; }
    const id = idOf(selected); if (!id) return;
    setBusy(true); setFormErr('');
    try {
      await api('POST', `/api/admin/binance-deposits/${encodeURIComponent(id)}/reject`, { adminNote: rejectReason.trim() });
      setMessage('Binance deposit rejected.'); setSelected(null); await load();
    } catch (e) { setFormErr(e instanceof Error ? e.message : 'Rejection failed'); }
    finally { setBusy(false); }
  };
  const tableData = data.map(r => ({ ...r, amountDeposited: money(r.expectedGhsAmount ?? r.cryptoAmount), crypto: `${text(r.cryptoAmount, '—')} ${text(r.coin, '')}`.trim() }));
  return <div className="admin-stack">
    <Intro title="Binance deposits" description="Crypto deposit proofs. Open a record to inspect the coin, amount, TXID and screenshot before approving." onRefresh={load} loading={loading} />
    <Notice message={message} /><Notice message={error} error />
    <Panel title="Binance deposit queue" action={<div className="admin-toolbar" style={{ margin: 0 }}><Button tone={filter === 'pending' ? 'primary' : 'secondary'} onClick={() => setFilter('pending')}>Pending</Button><Button tone={filter === 'all' ? 'primary' : 'secondary'} onClick={() => setFilter('all')}>All</Button></div>}>
      <Table data={tableData} columns={['crypto', 'amountDeposited', 'txid', 'network', 'status', 'createdAt']}
        labels={{ crypto: 'Crypto', amountDeposited: 'Expected GHS', txid: 'TXID', network: 'Network', status: 'Status', createdAt: 'Submitted' }}
        actions={row => <Button onClick={() => openDetail(row)}><span className="material-symbols-rounded">visibility</span>Details</Button>} />
    </Panel>
    {selected && <Panel title={`Binance deposit details · ${text(selected.txid, 'record')}`} action={<Button onClick={() => setSelected(null)}><span className="material-symbols-rounded">close</span>Close</Button>}>
      <Notice message={formErr} error />
      <div className="admin-status-list">
        <div><span>User ID</span><b>{text(selected.userId)}</b></div>
        <div><span>Crypto amount</span><b>{text(selected.cryptoAmount, '—')} {text(selected.coin, '')}</b></div>
        <div><span>Expected GHS</span><b>GHS {text(selected.expectedGhsAmount, '—')}</b></div>
        <div><span>TXID</span><b>{text(selected.txid)}</b></div>
        <div><span>Network</span><b>{text(selected.network, '—')}</b></div>
        <div><span>Sender address</span><b>{text(selected.senderAddress, '—')}</b></div>
      </div>
      {text(selected.userNote, '') !== '' && <p style={{ color: '#a99bb3', fontSize: 12 }}><b style={{ color: '#fff' }}>User note:</b> {text(selected.userNote)}</p>}
      {text(selected.screenshotUrl, '') !== '' && <a href={text(selected.screenshotUrl)} target="_blank" rel="noreferrer"><img src={text(selected.screenshotUrl)} alt="Deposit proof screenshot" className="admin-proof" /></a>}
      <div className="admin-form-grid cols-3" style={{ marginTop: 12 }}>
        <input type="number" min="0.01" step="0.01" value={credited} onChange={e => setCredited(e.target.value)} placeholder="Credited GHS amount" />
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Admin note for approval" />
        <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Required rejection reason" />
      </div>
      <div className="admin-toolbar" style={{ marginTop: 12 }}>
        <Button tone="primary" disabled={busy} onClick={approve}><span className="material-symbols-rounded">check</span>Approve & credit wallet</Button>
        <Button tone="danger" disabled={busy} onClick={reject}><span className="material-symbols-rounded">close</span>Reject deposit</Button>
      </div>
    </Panel>}
  </div>;
}


function SuperFinanceQueue({ page }: { page: SuperPageKey }) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const endpoint = useMemo(() => {
    const qs = '?page=0&size=50';
    switch (page) {
      case 'transactions': return `/api/super-admin/transactions${qs}`;
      case 'affwithdrawals': return `/api/super-admin/affiliate-withdrawals${qs}`;
      case 'payouts': return `/api/super-admin/payout-requests${qs}`;
      case 'walletwithdrawals': return `/api/wallet/withdrawals?page=0&size=50`;
      default: return `/api/super-admin/transactions${qs}`;
    }
  }, [page]);
  const load = async () => {
    setLoading(true);
    try {
      const payload = await api('GET', endpoint);
      setData(rows(payload));
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this queue'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [endpoint]);
  const [rejectFor, setRejectFor] = useState<Row | null>(null);
  const act = async (row: Row, kind: 'approve' | 'reject' | 'settle' | 'mark-paid' | 'mark-failed', reason = '') => {
    const id = idOf(row);
    if (!id) return;
    if (kind === 'reject' && reason === '' && rejectFor !== row) { setRejectFor(row); return; }
    try {
      let path = '';
      if (page === 'affwithdrawals') path = `/api/super-admin/affiliate-withdrawals/${encodeURIComponent(id)}/${kind}`;
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
  const title = page === 'transactions' ? 'Transactions' : page === 'affwithdrawals' ? 'Affiliate withdrawals' : page === 'payouts' ? 'Payout requests' : 'Wallet withdrawals';
  const desc = page === 'transactions' ? 'Paginated wallet transaction ledger.' : 'Review and action pending items.';
  const columns = data.length ? Object.keys(data[0]).filter(key => !['password', 'token'].includes(key)).slice(0, 8) : ['id', 'status', 'createdAt', 'amount'];
  const actionable = page !== 'transactions';
  return <div className="admin-stack">
    <Intro title={title} description={desc} onRefresh={load} loading={loading} />
    <Notice message={message} /><Notice message={error} error />
    <Panel title={actionable ? 'Pending review' : 'Latest records'}>
      <Table data={data} columns={columns} actions={actionable ? row => <><Button tone="primary" onClick={() => act(row, 'approve')}>Approve</Button>{page === 'walletwithdrawals' && <Button onClick={() => act(row, 'settle')}>Settle</Button>}{page === 'walletwithdrawals' && <Button onClick={() => act(row, 'mark-failed')}>Mark failed</Button>}{page === 'payouts' && <Button onClick={() => act(row, 'mark-paid')}>Mark paid</Button>}<Button tone="danger" onClick={() => act(row, 'reject')}>Reject</Button></> : undefined} />
    </Panel>
    {rejectFor && <PromptDialog title="Reject request" label="Rejection reason (optional)" initial="" onSubmit={v => { const row = rejectFor; setRejectFor(null); if (row) act(row, 'reject', v || ' '); }} onClose={() => setRejectFor(null)} />}
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
  const today = () => new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [data, setData] = useState<Row[]>([]);
  const [totals, setTotals] = useState({ admins: 0, earned: 0, unpaid: 0, deposits: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [settling, setSettling] = useState(false);
  const load = async (day: string) => {
    setLoading(true); setError('');
    try {
      // Real backend shape: GET /api/super-admin/commission/daily?date=YYYY-MM-DD
      // -> [{ adminId, adminEmail, adminName, commissionPercent, commissionEarned,
      //      commissionCurrency, commissionBalance, totalDeposits, depositCount }]
      const list = rows(await api('GET', `/api/super-admin/commission/daily?date=${encodeURIComponent(day)}`));
      const sum = (key: string) => list.reduce((t, r) => t + numberValue(r[key]), 0);
      setTotals({ admins: list.length, earned: sum('commissionEarned'), unpaid: sum('commissionBalance'), deposits: sum('totalDeposits') });
      setData(list.map(r => ({
        ...r,
        unpaidRaw: numberValue(r.commissionBalance),
        commissionPercent: `${numberValue(r.commissionPercent)}%`,
        commissionEarned: money(r.commissionEarned),
        commissionBalance: money(r.commissionBalance),
        totalDeposits: money(r.totalDeposits),
      })));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load commission data'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(date); }, [date]);
  const markPaid = async (row: Row) => {
    const name = text(row.adminName ?? row.adminEmail, 'this admin');
    if (!window.confirm(`Mark ${name}'s commission for ${date} as paid?`)) return;
    setSettling(true); setError(''); setMessage('');
    try {
      await api('POST', `/api/super-admin/commission/admins/${encodeURIComponent(idOf(row))}/pay?date=${encodeURIComponent(date)}`);
      setMessage(`Commission settled for ${name}.`);
      await load(date);
    } catch (e) { setError(e instanceof Error ? e.message : 'Settlement failed'); }
    finally { setSettling(false); }
  };
  const clearDay = async () => {
    if (!window.confirm(`Mark ALL unpaid commission for ${date} as paid? This settles every admin.`)) return;
    setSettling(true); setError(''); setMessage('');
    try {
      await api('POST', `/api/super-admin/commission/clear?date=${encodeURIComponent(date)}`);
      setMessage(`All commission for ${date} marked as paid.`);
      await load(date);
    } catch (e) { setError(e instanceof Error ? e.message : 'Clear failed'); }
    finally { setSettling(false); }
  };
  const stats: Array<[string, string, string]> = [
    ['Admins', String(totals.admins), 'group'],
    ['Commission earned', money(totals.earned), 'payments'],
    ['Unpaid balance', money(totals.unpaid), 'account_balance_wallet'],
    ['Referred deposits', money(totals.deposits), 'savings'],
  ];
  return <div className="admin-stack">
    <Intro title="Commission analytics" description="Per-admin commission earned — see who is actively working." onRefresh={() => load(date)} loading={loading} />
    <Notice message={error} error /><Notice message={message} />
    <div className="admin-stat-grid">{stats.map(([t, v, icon]) => <div className="admin-stat" key={t}><span className="material-symbols-rounded">{icon}</span><small>{t}</small><strong>{loading ? '…' : v}</strong></div>)}</div>
    <Panel title={`Commission by admin — ${date}`} action={<div className="admin-toolbar" style={{ margin: 0 }}><input type="date" value={date} max={today()} onChange={e => { if (e.target.value) setDate(e.target.value); }} aria-label="Commission date" /><Button onClick={clearDay} disabled={settling || totals.unpaid <= 0}><span className="material-symbols-rounded">done_all</span>{settling ? 'Settling…' : 'Settle day'}</Button></div>}>
      <Table data={data} columns={['adminName', 'adminEmail', 'commissionPercent', 'commissionEarned', 'commissionBalance', 'totalDeposits', 'depositCount']}
        labels={{ adminName: 'Admin', adminEmail: 'Email', commissionPercent: 'Rate', commissionEarned: 'Earned', commissionBalance: 'Unpaid', totalDeposits: 'Deposits', depositCount: 'Deposit count' }}
        actions={row => numberValue(row.unpaidRaw) > 0 ? <Button onClick={() => markPaid(row)} disabled={settling}>{settling ? '…' : 'Mark paid'}</Button> : null} />
    </Panel>
  </div>;
}

function SuperChats() {
  const [chats, setChats] = useState<Row[]>([]);
  const [msgs, setMsgs] = useState<Row[]>([]);
  const [active, setActive] = useState<Row | null>(null);
  const [draft, setDraft] = useState('');
  const [rate, setRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setChats(rows(await api('GET', '/api/super-admin/upgrade-chats/pending'))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load chats'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const open = async (row: Row) => {
    setActive(row); setMsgs([]);
    try { setMsgs(rows(await api('GET', `/api/super-admin/upgrade-chats/${encodeURIComponent(idOf(row))}/messages`))); }
    catch { setMsgs([]); }
  };
  const send = async () => {
    if (!active || !draft.trim()) return;
    try {
      await api('POST', `/api/super-admin/upgrade-chats/${encodeURIComponent(idOf(active))}/messages`, { content: draft.trim() });
      setDraft(''); setMessage('Reply sent.'); open(active);
    } catch (e) { setError(e instanceof Error ? e.message : 'Send failed'); }
  };
  const setCommission = async () => {
    if (!active) return;
    const value = Number(rate);
    if (!Number.isFinite(value) || value < 0 || value > 100) { setError('Enter a commission rate between 0 and 100.'); return; }
    try {
      await api('POST', `/api/super-admin/upgrade-chats/${encodeURIComponent(idOf(active))}/set-commission`, { commissionRate: value });
      setMessage(`Commission set to ${value}%.`); setRate(''); load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not set commission'); }
  };
  return <div className="admin-stack">
    <Intro title="Upgrade chats" description="Review pending upgrade conversations and commission requests." onRefresh={load} loading={loading} />
    <Notice message={error} error /><Notice message={message} />
    <Panel title="Pending chats">
      {chats.length === 0 ? <p style={{ color: '#a99bb3', fontSize: 12 }}>{loading ? 'Loading…' : 'No pending chats.'}</p> :
        chats.map((r, i) => <div className="admin-status-list" key={idOf(r) || i}><div><span>{text(r.adminEmail ?? r.email ?? r.subject, 'Chat')}<br /><small style={{ color: '#a99bb3' }}>{text(r.updatedAt ?? r.createdAt)}</small></span><b><span style={{ marginRight: 8 }}>{text(r.status)}</span><button className="admin-button" onClick={() => open(r)}>Open</button></b></div></div>)}
    </Panel>
    {active && <Panel title={`Chat — ${text(active.adminEmail ?? active.email ?? 'conversation')}`} action={<Button onClick={() => setActive(null)}>Close</Button>}>
      {msgs.length === 0 ? <p style={{ color: '#a99bb3', fontSize: 12 }}>No messages yet.</p> :
        msgs.map((m, i) => <div className="admin-status-list" key={i}><div><span><b>{text(m.sender ?? m.from, 'Message')}</b><br />{text(m.content ?? m.body ?? m.message)}</span><b><small style={{ color: '#a99bb3' }}>{text(m.createdAt)}</small></b></div></div>)}
      <div className="admin-toolbar" style={{ marginTop: 12 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type a reply…" onKeyDown={e => { if (e.key === 'Enter') send(); }} />
        <Button tone="primary" onClick={send}>Send</Button>
      </div>
      <div className="admin-toolbar">
        <input value={rate} onChange={e => setRate(e.target.value)} placeholder="Commission % (0–100)" inputMode="decimal" style={{ maxWidth: 200 }} />
        <Button onClick={setCommission}>Set commission</Button>
      </div>
    </Panel>}
  </div>;
}

function SuperAudit() {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setData(rows(await api('GET', '/api/super-admin/audit-log?page=0&size=50'))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load audit trail'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  return <div className="admin-stack">
    <Intro title="Audit trail" description="Staff actions across the platform, newest first." onRefresh={load} loading={loading} />
    <Notice message={error} error />
    <Panel title="Recent activity">
      <Table data={data} columns={['actor', 'actorEmail', 'action', 'entity', 'createdAt']}
        labels={{ actor: 'Actor', actorEmail: 'Email', action: 'Action', entity: 'Entity', createdAt: 'When' }} />
    </Panel>
  </div>;
}

// ============================================================================
// MAIN PANEL
// ============================================================================

export default function AdminPanel({ role }: { role: Role }) {
  const isSuper = role === 'super-admin';
  const [page, setPage] = useState<PageKey>(isSuper ? 'dashboard' : 'overview');
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => { setPage(isSuper ? 'dashboard' : 'overview'); }, [isSuper]);
  const go = (id: PageKey) => { setPage(id); setMobileNav(false); };
  const pages = (isSuper ? superPages : adminPages) as { id: PageKey; label: string; icon: string; group: string }[];
  const current = pages.find(item => item.id === page) ?? pages[0];
  const navBtn = (item: { id: PageKey; label: string; icon: string; group: string }) => (
    <button className={`admin-nav-btn${page === item.id ? ' active' : ''}`} key={item.id} onClick={() => go(item.id)} aria-current={page === item.id ? 'page' : undefined}>
      <span className="admin-nav-ico"><span className="material-symbols-rounded">{item.icon}</span></span>
      <span className="admin-nav-label">{item.label}</span>
      <span className="material-symbols-rounded admin-nav-chev">chevron_right</span>
    </button>
  );
  // PlusBet behaviour: the active tab scrolls itself into view in the strip.
  useEffect(() => {
    try {
      document.querySelector('.admin-sidebar .admin-nav-btn.active')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    } catch { /* older engines */ }
  }, [page]);

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
      case 'chats': return <SuperChats />;
      case 'audit': return <SuperAudit />;
      case 'binance': return <SuperBinanceQueue />;
      default: return <SuperFinanceQueue page={page as SuperPageKey} />;
    }
  })();

  return <div className="admin-app">
    <aside className={`admin-sidebar ${mobileNav ? 'open' : ''}`} aria-label={isSuper ? 'Super admin sections' : 'Admin sections'}>
      <div className="admin-brand">
        <span className="admin-brand-mark">S</span>
        <div className="admin-brand-text"><strong>Lucky<span>Stake</span></strong><small>{isSuper ? 'Super admin centre' : 'Admin centre'}</small></div>
        <button className="admin-drawer-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><span className="material-symbols-rounded">close</span></button>
      </div>
      <div className="admin-role"><span className="material-symbols-rounded">{isSuper ? 'shield_person' : 'verified_user'}</span>{isSuper ? 'Super administrator' : 'Administrator'}</div>
      <nav className="admin-nav">
        {pages.map(navBtn)}
      </nav>
      <div className="admin-side-foot">
        <a className="admin-exit" href="/"><span className="material-symbols-rounded">arrow_back</span>Back to sportsbook</a>
      </div>
    </aside>
    {mobileNav && <button className="admin-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <main className="admin-main">
      <div className="admin-mobile-bar">
        <button className="admin-burger" onClick={() => setMobileNav(true)} aria-label="Open admin navigation"><span className="material-symbols-rounded">menu</span></button>
        <span className="material-symbols-rounded admin-mobile-bar-ico">{current.icon}</span>
        <div className="admin-mobile-bar-text"><small>{isSuper ? 'Super admin' : 'Admin'} · {current.group}</small><strong>{current.label}</strong></div>
        <span className={`admin-role-pill${isSuper ? ' super' : ''}`}>{isSuper ? 'Super' : 'Admin'}</span>
      </div>
      {content}
    </main>
  </div>;
}
