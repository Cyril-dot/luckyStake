import { useState } from 'react';
import { api, setToken } from './api';

export default function BroadcastAuth({ initialMode }: { initialMode: 'login' | 'register' }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const register = mode === 'register';

  async function submit() {
    if (register && !accepted) { setMessage('Please accept the terms and responsible play policy.'); return; }
    setBusy(true); setMessage('');
    try {
      const path = register ? '/api/auth/register' : '/api/auth/login';
      const body = register ? { email, password, firstName: firstName || 'Lucky', lastName: lastName || 'Player' } : { email, password };
      const result = await api<Record<string, unknown>>('POST', path, body);
      const token = result.accessToken || result.access_token || result.token;
      if (typeof token === 'string') setToken(token);
      setMessage(register ? 'Account created successfully.' : 'Signed in successfully.');
      window.setTimeout(() => { window.location.href = '/'; }, 450);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  return <section className="broadcast-auth-page">
    <div className="broadcast-auth-atmosphere" aria-hidden="true"><span className="broadcast-orbit broadcast-orbit-one" /><span className="broadcast-orbit broadcast-orbit-two" /><span className="broadcast-grid-lines" /></div>
    <div className="broadcast-auth-header"><a href="/" className="broadcast-brand" onClick={event => { event.preventDefault(); window.location.href = '/'; }}>Lucky<span>Stake</span></a><div><a href="#help">Help center</a><span className="broadcast-locale">EN <span className="material-symbols-rounded">expand_more</span></span></div></div>
    <div className="broadcast-ticker" aria-label="Live match update"><span className="broadcast-live-dot" /> <b>LIVE NOW</b><strong>ARSENAL <i>2</i></strong><em>—</em><strong>CHELSEA <i>1</i></strong><small>83:24</small><span className="broadcast-ticker-odds">Match odds <b>1.42</b></span></div>
    <div className="broadcast-auth-layout">
      <div className="broadcast-auth-story"><div className="broadcast-signal"><span className="material-symbols-rounded">sensors</span></div><small>LIVE FROM THE MOMENT</small><h1>Never miss<br /><b>the signal.</b></h1><p>Step into the action with live odds, instant markets, and every game worth watching.</p><div className="broadcast-proof"><span><span className="material-symbols-rounded">check_circle</span> Fast payouts</span><span><span className="material-symbols-rounded">check_circle</span> Secure play</span></div></div>
      <div className="broadcast-auth-card"><div className="broadcast-card-shine" /><div className="broadcast-auth-tabs"><button className={!register ? 'active' : ''} onClick={() => { setMode('login'); setMessage(''); }}>Log in</button><button className={register ? 'active' : ''} onClick={() => { setMode('register'); setMessage(''); }}>Register</button><span className="broadcast-secure"><span className="material-symbols-rounded">lock</span> Secure</span></div><h2>{register ? 'Create your account' : 'Good to see you.'}</h2><p className="broadcast-card-copy">{register ? 'Join LuckyStake and keep your bets, balance, and games in one place.' : 'Enter your details to continue to LuckyStake.'}</p>{register && <div className="broadcast-field-row"><label>First name<input value={firstName} onChange={event => setFirstName(event.target.value)} placeholder="Lucky" /></label><label>Last name<input value={lastName} onChange={event => setLastName(event.target.value)} placeholder="Player" /></label></div>}<label>{register ? 'Email address' : 'Email'}<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••••" autoComplete={register ? 'new-password' : 'current-password'} /></label>{register && <label className="broadcast-check"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} /><span>I agree to the terms and responsible play policy</span></label>}<button className="broadcast-submit" onClick={submit} disabled={busy}>{busy ? 'Connecting…' : register ? 'Create account' : 'Log in'} <span className="material-symbols-rounded">arrow_forward</span></button>{message && <p className="broadcast-message" role="status">{message}</p>}{!register && <a className="broadcast-forgot" href="#forgot">Forgot password?</a>}<p className="broadcast-switch">{register ? 'Already have an account?' : 'New to LuckyStake?'} <button onClick={() => { setMode(register ? 'login' : 'register'); setMessage(''); }}>{register ? 'Log in' : 'Register now'}</button></p></div>
    </div>
    <div className="broadcast-auth-footer"><span><span className="material-symbols-rounded">verified_user</span> Responsible play tools available</span><span>© 2026 LuckyStake</span></div>
  </section>;
}
