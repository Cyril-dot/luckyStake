import { useState } from 'react';

const designs = [
  {
    id: '01',
    name: 'Dark Arena',
    tag: 'Bold / conversion-first',
    className: 'auth-preview-arena',
    eyebrow: 'LUCKYSTAKE ACCESS',
    title: 'Play the moment.',
    copy: 'A high-contrast entry point built for fast decisions, live odds, and the next big win.',
    icon: 'bolt',
  },
  {
    id: '02',
    name: 'Split Signal',
    tag: 'Editorial / confident',
    className: 'auth-preview-split',
    eyebrow: 'WELCOME TO THE CLUB',
    title: 'Your game starts here.',
    copy: 'A calmer split-screen direction that puts brand story and the account action on equal footing.',
    icon: 'auto_awesome',
  },
  {
    id: '03',
    name: 'Neon Wallet',
    tag: 'Playful / casino-led',
    className: 'auth-preview-neon',
    eyebrow: 'READY WHEN YOU ARE',
    title: 'Make your move.',
    copy: 'A glowing, energetic treatment for a sportsbook that wants to feel alive before the first click.',
    icon: 'local_fire_department',
  },
  {
    id: '04',
    name: 'Quiet Pro',
    tag: 'Premium / trust-led',
    className: 'auth-preview-pro',
    eyebrow: 'SECURE ACCOUNT ACCESS',
    title: 'Welcome back.',
    copy: 'A refined, product-led direction with less noise, stronger hierarchy, and a clearer trust signal.',
    icon: 'verified_user',
  },
  {
    id: '05',
    name: 'Midnight Broadcast',
    tag: 'Cinematic / live-sport energy',
    className: 'auth-preview-broadcast',
    eyebrow: 'LIVE FROM THE MOMENT',
    title: 'Never miss the signal.',
    copy: 'A cinematic match-night entrance with live-market energy, broadcast rhythm, and a glassy account gateway.',
    icon: 'sensors',
  },
];

function BrandMark() {
  return <span className="auth-preview-brand">Lucky<span>Stake</span></span>;
}

function AuthCard({ register, onToggle }: { register: boolean; onToggle: () => void }) {
  return (
    <div className="auth-preview-card">
      <div className="auth-preview-card-top">
        <div className="auth-preview-tabs"><button className={!register ? 'active' : ''} onClick={register ? onToggle : undefined}>Log in</button><button className={register ? 'active' : ''} onClick={!register ? onToggle : undefined}>Register</button></div>
        <span className="auth-preview-secure"><span className="material-symbols-rounded">lock</span> Secure</span>
      </div>
      <h3>{register ? 'Create your account' : 'Good to see you.'}</h3>
      <p className="auth-preview-card-copy">{register ? 'Join LuckyStake and keep your bets, balance, and games in one place.' : 'Enter your details to continue to LuckyStake.'}</p>
      {register && <div className="auth-preview-field-row"><label>First name<input placeholder="Lucky" /></label><label>Last name<input placeholder="Player" /></label></div>}
      <label>{register ? 'Email address' : 'Email'}<input type="email" placeholder="you@example.com" /></label>
      <label>Password<input type="password" placeholder="••••••••••" /></label>
      {register && <label className="auth-preview-check"><input type="checkbox" /> <span>I agree to the terms and responsible play policy</span></label>}
      <button className="auth-preview-submit">{register ? 'Create account' : 'Log in'} <span className="material-symbols-rounded">arrow_forward</span></button>
      {!register && <a className="auth-preview-forgot" href="#preview">Forgot password?</a>}
      <p className="auth-preview-switch">{register ? 'Already have an account?' : 'New to LuckyStake?'} <button onClick={onToggle}>{register ? 'Log in' : 'Register now'}</button></p>
    </div>
  );
}

function AuthPreview({ design }: { design: typeof designs[number] }) {
  const [register, setRegister] = useState(false);
  return <article className={`auth-preview-option ${design.className}`}>
    <div className="auth-preview-meta"><span className="auth-preview-index">{design.id}</span><div><h2>{design.name}</h2><p>{design.tag}</p></div><span className="auth-preview-status">Login + register</span></div>
    <div className="auth-preview-canvas">
      <div className="auth-preview-topbar"><BrandMark /><div><span className="auth-preview-help">Help center</span><span className="auth-preview-locale">EN <span className="material-symbols-rounded">expand_more</span></span></div></div>
      <div className="auth-preview-ticker"><span><i /> LIVE NOW</span><b>ARSENAL <em>2</em></b><strong>—</strong><b>CHELSEA <em>1</em></b><small>83:24</small><span className="auth-preview-ticker-odd">Match odds <b>1.42</b></span></div>
      <div className="auth-preview-body">
        <div className="auth-preview-story"><span className="auth-preview-story-icon material-symbols-rounded">{design.icon}</span><small>{design.eyebrow}</small><h3>{design.title}</h3><p>{design.copy}</p><div className="auth-preview-proof"><span className="material-symbols-rounded">check_circle</span><span>Fast payouts</span><span className="material-symbols-rounded">check_circle</span><span>Secure play</span></div></div>
        <AuthCard register={register} onToggle={() => setRegister(value => !value)} />
      </div>
    </div>
  </article>;
}

export default function AuthDesigns() {
  return <section className="auth-previews-page">
    <div className="auth-previews-heading"><div><small>LUCKYSTAKE AUTH / FIVE DIRECTIONS</small><h1>Choose the feeling<br /><b>before the first bet.</b></h1><p>Five login and register concepts built from the current LuckyStake purple, charcoal, lime, and violet palette. Each option keeps the existing auth endpoints intact while giving the experience a more intentional point of view.</p></div><div className="auth-preview-legend"><span><i className="legend-lime" /> Primary action</span><span><i className="legend-purple" /> Brand accent</span><span><i className="legend-charcoal" /> Base surface</span></div></div>
    <div className="auth-preview-grid">{designs.map(design => <AuthPreview key={design.id} design={design} />)}</div>
  </section>;
}
