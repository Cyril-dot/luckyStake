import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

type Role = 'admin' | 'super-admin';
type Row = Record<string, unknown>;
type PageKey = 'dashboard' | 'admins' | 'users' | 'transactions' | 'deposits' | 'withdrawals' | 'analytics' | 'audit';

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

const pages: { id: PageKey; label: string; icon: string; superOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Overview', icon: 'space_dashboard' },
  { id: 'admins', label: 'Administrators', icon: 'admin_panel_settings', superOnly: true },
  { id: 'users', label: 'Users', icon: 'group', superOnly: true },
  { id: 'transactions', label: 'Transactions', icon: 'receipt_long', superOnly: true },
  { id: 'deposits', label: 'Deposit queues', icon: 'account_balance' },
  { id: 'withdrawals', label: 'Withdrawals', icon: 'payments' },
  { id: 'analytics', label: 'Analytics', icon: 'monitoring' },
  { id: 'audit', label: 'Audit log', icon: 'fact_check' },
];

function Notice({ message, error }: { message: string; error?: boolean }) { return message ? <div className={`admin-notice ${error ? 'is-error' : 'is-success'}`}><span className="material-symbols-rounded">{error ? 'error' : 'check_circle'}</span>{message}</div> : null; }
function Intro({ title, description, onRefresh, loading }: { title: string; description: string; onRefresh: () => void; loading: boolean }) { return <div className="admin-intro"><div><span className="admin-eyebrow">LUCKYSTAKE CONTROL ROOM</span><h1>{title}</h1><p>{description}</p></div><button className="admin-refresh" onClick={onRefresh} aria-label="Refresh data"><span className={`material-symbols-rounded ${loading ? 'admin-spin' : ''}`}>refresh</span></button></div>; }
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="admin-panel"><div className="admin-panel-title"><h2>{title}</h2>{action}</div>{children}</section>; }
function Table({ data, columns, actions }: { data: Row[]; columns: string[]; actions?: (row: Row) => React.ReactNode }) { return <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{columns.map(column => <th key={column}>{column.replace(/([A-Z])/g, ' $1')}</th>)}{actions && <th>Actions</th>}</tr></thead><tbody>{data.length === 0 ? <tr><td className="admin-empty" colSpan={columns.length + (actions ? 1 : 0)}>No records found.</td></tr> : data.map((row, index) => <tr key={idOf(row) || String(index)}>{columns.map(column => <td key={column}>{column === 'id' ? <code>{text(row[column])}</code> : text(row[column])}</td>)}{actions && <td><div className="admin-actions">{actions(row)}</div></td>}</tr>)}</tbody></table></div>; }
function Button({ children, onClick, tone = 'secondary' }: { children: React.ReactNode; onClick?: () => void; tone?: 'primary' | 'secondary' | 'danger' }) { return <button className={`admin-button ${tone}`} onClick={onClick}>{children}</button>; }

function Dashboard({ role, onNavigate }: { role: Role; onNavigate: (page: PageKey) => void }) {
  const [metrics, setMetrics] = useState<Row>({}); const [deposits, setDeposits] = useState<Row>({}); const [analytics, setAnalytics] = useState<Row>({}); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = async () => { setLoading(true); setError(''); const requests: Promise<unknown>[] = role === 'super-admin' ? [api('GET', '/api/super-admin/metrics'), api('GET', '/api/super-admin/metrics/deposits')] : [api('GET', '/api/admin/analytics?range=7d'), api('GET', '/api/admin/matches')]; const result = await Promise.allSettled(requests); const first = result[0]; const second = result[1]; if (first.status === 'fulfilled') role === 'super-admin' ? setMetrics((first.value || {}) as Row) : setAnalytics((first.value || {}) as Row); if (second.status === 'fulfilled') role === 'super-admin' ? setDeposits((second.value || {}) as Row) : setMetrics({ matches: rows(second.value).length }); if (result.some(item => item.status === 'rejected')) setError('Some dashboard sources could not be loaded. Check the endpoint response or refresh.'); setLoading(false); };
  useEffect(() => { load(); }, [role]);
  const cards = role === 'super-admin' ? [['Registered users', text(metrics.totalUsers ?? metrics.userCount, '0'), 'group', 'users'], ['Administrators', text(metrics.totalAdmins ?? metrics.adminCount, '0'), 'admin_panel_settings', 'admins'], ['Deposited all time', money(deposits.totalDepositsAllTime ?? deposits.totalDeposits), 'account_balance_wallet', 'deposits'], ['Withdrawn all time', money(deposits.totalWithdrawalsAllTime ?? metrics.totalWithdrawals), 'payments', 'withdrawals']] as const : [['Matches in feed', text(metrics.matches ?? metrics.totalMatches, '0'), 'sports_soccer', 'analytics'], ['Predictions', text(analytics.predictions ?? analytics.totalPredictions, '0'), 'insights', 'analytics'], ['Active tickets', text(analytics.activeBets ?? analytics.openBets, '0'), 'confirmation_number', 'analytics'], ['Audit events', text(analytics.auditEvents ?? analytics.auditCount, '0'), 'fact_check', 'audit']] as const;
  return <div className="admin-stack"><Intro title={role === 'super-admin' ? 'Platform overview' : 'Operations overview'} description="A live view of the sportsbook, finance queues, and staff activity." onRefresh={load} loading={loading} /><Notice message={error} error /><div className="admin-stat-grid">{cards.map(([title, value, icon, target]) => <button className="admin-stat" key={title} onClick={() => onNavigate(target as PageKey)}><span className="material-symbols-rounded">{icon}</span><small>{title}</small><strong>{loading ? '…' : value}</strong><span className="material-symbols-rounded admin-stat-arrow">chevron_right</span></button>)}</div><div className="admin-two-col"><Panel title="Quick actions"><div className="admin-quick-grid"><Button onClick={() => onNavigate('deposits')}><span className="material-symbols-rounded">account_balance</span>Review deposits</Button><Button onClick={() => onNavigate('withdrawals')}><span className="material-symbols-rounded">payments</span>Process withdrawals</Button><Button onClick={() => onNavigate('audit')}><span className="material-symbols-rounded">fact_check</span>Inspect audit log</Button><Button onClick={() => onNavigate(role === 'super-admin' ? 'users' : 'analytics')}><span className="material-symbols-rounded">monitoring</span>Open analytics</Button></div></Panel><Panel title="System status"><div className="admin-status-list"><div><span>API connection</span><b className="online"><i />Operational</b></div><div><span>Session role</span><b>{role === 'super-admin' ? 'Super admin' : 'Administrator'}</b></div><div><span>Last refreshed</span><b>{new Date().toLocaleTimeString()}</b></div></div></Panel></div></div>;
}

function Admins() {
  const [data, setData] = useState<Row[]>([]); const [form, setForm] = useState({ name: '', email: '', password: '', commissionRate: '' }); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const load = async () => { setLoading(true); try { setData(rows(await api('GET', '/api/super-admin/admins/with-commission'))); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load administrators'); } finally { setLoading(false); } }; useEffect(() => { load(); }, []);
  const create = async () => { const rate = Number(form.commissionRate); if (!form.name.trim() || !form.email.trim() || !form.password || !Number.isFinite(rate) || rate < 0 || rate > 100) { setError('Name, email, password, and a commission rate from 0 to 100 are required.'); return; } const parts = form.name.trim().split(/\s+/); try { await api('POST', '/api/super-admin/admins/with-commission', { email: form.email.trim(), password: form.password, firstName: parts.shift(), lastName: parts.join(' '), commissionRate: String(rate) }); setForm({ name: '', email: '', password: '', commissionRate: '' }); setMessage('Administrator created successfully.'); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not create administrator'); } };
  const updateRate = async (row: Row) => { const value = window.prompt('Commission rate (%)', String(row.commissionRate ?? '')); if (value === null) return; const rate = Number(value); if (!Number.isFinite(rate) || rate < 0 || rate > 100) { setError('Commission rate must be between 0% and 100%.'); return; } try { await api('PATCH', `/api/super-admin/admins/${encodeURIComponent(idOf(row))}/commission-rate`, { commissionRate: rate }); setMessage('Commission rate updated.'); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update rate'); } };
  return <div className="admin-stack"><Intro title="Administrators" description="Create staff accounts, manage commission rates, and keep operations funded." onRefresh={load} loading={loading} /><Notice message={message} /><Notice message={error} error /><Panel title="Create administrator"><div className="admin-form-grid"><input placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input placeholder="Email address" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><input placeholder="Temporary password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /><input placeholder="Commission rate (%)" type="number" min="0" max="100" value={form.commissionRate} onChange={e => setForm({ ...form, commissionRate: e.target.value })} /><Button tone="primary" onClick={create}><span className="material-symbols-rounded">person_add</span>Create administrator</Button></div></Panel><Panel title="Administrator accounts"><Table data={data} columns={['id', 'name', 'email', 'role', 'commissionRate', 'balance', 'status']} actions={row => <Button onClick={() => updateRate(row)}>Edit rate</Button>} /></Panel></div>;
}

function Users() {
  const [data, setData] = useState<Row[]>([]); const [search, setSearch] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const load = async () => { setLoading(true); try { const query = search ? `&search=${encodeURIComponent(search)}` : ''; setData(rows(await api('GET', `/api/super-admin/users?page=0&size=50${query}`))); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load users'); } finally { setLoading(false); } }; useEffect(() => { load(); }, []);
  const toggle = async (row: Row) => { const id = idOf(row); const active = String(row.status ?? row.active ?? '').toLowerCase().includes('active') || row.active === true; try { await api('POST', `/api/v1/super-admin/users/${encodeURIComponent(id)}/${active ? 'deactivate' : 'activate'}`); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update user'); } };
  return <div className="admin-stack"><Intro title="Users" description="Search customers, review account state, and manage access safely." onRefresh={load} loading={loading} /><Notice message={error} error /><Panel title="Customer directory"><div className="admin-toolbar"><input placeholder="Search by name or email" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} /><Button onClick={load}><span className="material-symbols-rounded">search</span>Search</Button></div><Table data={data} columns={['id', 'name', 'email', 'role', 'status', 'createdAt']} actions={row => <Button onClick={() => toggle(row)}>{String(row.status ?? row.active ?? '').toLowerCase().includes('active') ? 'Deactivate' : 'Activate'}</Button>} /></Panel></div>;
}

function DataPage({ role, page }: { role: Role; page: PageKey }) {
  const [data, setData] = useState<Row[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const endpoint = useMemo(() => { if (page === 'transactions') return '/api/super-admin/transactions?page=0&size=50'; if (page === 'audit') return role === 'super-admin' ? '/api/super-admin/audit-log?page=0&size=50' : '/api/admin/audit-log?page=0&size=50'; if (page === 'analytics') return role === 'super-admin' ? '/api/super-admin/predictions?page=0&size=50' : '/api/admin/analytics?range=30d'; if (page === 'withdrawals') return '/api/wallet/withdrawals?status=PENDING&page=0&size=50'; return '/api/admin/bank-deposits/pending?page=0&size=50'; }, [page, role]);
  const load = async () => { setLoading(true); try { const payload = await api('GET', endpoint); setData(rows(payload)); if (!rows(payload).length && payload && typeof payload === 'object' && !Array.isArray(payload)) setData([payload as Row]); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this queue'); } finally { setLoading(false); } }; useEffect(() => { load(); }, [endpoint]);
  const action = async (row: Row, kind: 'approve' | 'reject') => { const id = idOf(row); if (!id) return; try { const path = page === 'deposits' ? `/api/admin/bank-deposits/${encodeURIComponent(id)}/${kind}` : kind === 'approve' ? `/api/wallet/withdrawals/admin/${encodeURIComponent(id)}/approve` : `/api/wallet/withdrawals/admin/${encodeURIComponent(id)}/reject`; await api('POST', path, page === 'withdrawals' ? { note: '' } : undefined); setMessage(`${kind === 'approve' ? 'Approved' : 'Rejected'} successfully.`); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); } };
  const title = page === 'deposits' ? 'Deposit queues' : page === 'withdrawals' ? 'Wallet withdrawals' : page === 'transactions' ? 'Transactions' : page === 'analytics' ? 'Analytics' : 'Audit log';
  const columns = data.length ? Object.keys(data[0]).filter(key => !['password', 'token'].includes(key)).slice(0, 8) : ['id', 'status', 'createdAt', 'amount'];
  return <div className="admin-stack"><Intro title={title} description="Live data from the shared LuckyStake / PowerBet backend endpoint." onRefresh={load} loading={loading} /><Notice message={message} /><Notice message={error} error /><Panel title={page === 'deposits' || page === 'withdrawals' ? 'Pending review' : 'Latest records'}><Table data={data} columns={columns} actions={(page === 'deposits' || page === 'withdrawals') ? row => <><Button tone="primary" onClick={() => action(row, 'approve')}>Approve</Button><Button tone="danger" onClick={() => action(row, 'reject')}>Reject</Button></> : undefined} /></Panel></div>;
}

export default function AdminPanel({ role }: { role: Role }) {
  const available = pages.filter(page => !page.superOnly || role === 'super-admin'); const [page, setPage] = useState<PageKey>('dashboard'); const [mobileNav, setMobileNav] = useState(false);
  const content = page === 'dashboard' ? <Dashboard role={role} onNavigate={setPage} /> : page === 'admins' ? <Admins /> : page === 'users' ? <Users /> : <DataPage role={role} page={page} />;
  return <div className="admin-app"><aside className={`admin-sidebar ${mobileNav ? 'open' : ''}`}><div className="admin-brand"><span className="admin-brand-mark">S</span><div><strong>Lucky<span>Stake</span></strong><small>{role === 'super-admin' ? 'Super admin' : 'Admin'} control</small></div></div><nav>{available.map(item => <button className={page === item.id ? 'active' : ''} key={item.id} onClick={() => { setPage(item.id); setMobileNav(false); }}><span className="material-symbols-rounded">{item.icon}</span>{item.label}</button>)}</nav><a className="admin-exit" href="/"><span className="material-symbols-rounded">arrow_back</span>Back to sportsbook</a></aside>{mobileNav && <button className="admin-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} /> }<main className="admin-main"><div className="admin-mobile-bar"><button onClick={() => setMobileNav(true)} aria-label="Open admin navigation"><span className="material-symbols-rounded">menu</span></button><strong>{role === 'super-admin' ? 'Super admin' : 'Admin'}</strong></div>{content}</main></div>;
}
