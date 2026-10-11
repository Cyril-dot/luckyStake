import { useEffect, useState } from 'react';
import { api } from './api';
import { COUNTRY_EVENT, COUNTRY_LIST, normalizeCountry, storeAuthUser, storedUser, type CountryCode } from './country';

/**
 * Enforced country setup. Accounts created before signup collected a
 * country have none on their server record — when such a user enters,
 * this gate appears and CANNOT be dismissed: they pick a country, it is
 * saved to the account (PATCH /api/users/me), and the whole app
 * (currency, deposit rail) follows it. Only a POSITIVE read of an
 * empty country triggers the gate — if the profile can't be read we
 * never lock anyone out on a guess.
 */
let gateChecked = false;
let gateNeeded = false;
const listeners = new Set<() => void>();
function notify() { listeners.forEach(fn => fn()); }

async function checkGate() {
  if (gateChecked) return;
  gateChecked = true;
  if (!localStorage.getItem('accessToken')) return;
  try {
    const me = await api<Record<string, unknown>>('GET', '/api/users/me');
    const raw = (me as { country?: unknown })?.country ?? (me as { user?: { country?: unknown } })?.user?.country;
    if (raw == null || String(raw).trim() === '') {
      gateNeeded = true;
      notify();
    } else {
      const code = normalizeCountry(raw);
      storeAuthUser({ ...(storedUser() ?? {}), ...(me ?? {}), country: code });
      window.dispatchEvent(new Event(COUNTRY_EVENT));
    }
  } catch {
    gateChecked = false; // unverified — allow retry on a later mount, never gate blind
  }
}

export default function CountryGate() {
  const [, setTick] = useState(0);
  const [selected, setSelected] = useState<CountryCode | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const needed = gateNeeded;

  useEffect(() => {
    const fn = () => setTick(x => x + 1);
    listeners.add(fn);
    checkGate();
    return () => { listeners.delete(fn); };
  }, []);

  // The gate owns the screen while it is up.
  useEffect(() => {
    if (!needed) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [needed]);

  if (!needed) return null;

  async function save() {
    if (!selected || saving) return;
    setSaving(true);
    setError('');
    try {
      await api('PATCH', '/api/users/me', { country: selected });
      storeAuthUser({ ...(storedUser() ?? {}), country: selected });
      window.dispatchEvent(new Event(COUNTRY_EVENT));
      gateNeeded = false;
      notify();
    } catch {
      setError('Could not save that — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="country-gate-overlay">
      <div className="country-gate-card" role="dialog" aria-modal="true" aria-labelledby="country-gate-title">
        <span className="country-gate-icon"><span className="material-symbols-rounded">public</span></span>
        <small className="country-gate-kicker">ONE QUICK STEP</small>
        <h2 id="country-gate-title">Set your country</h2>
        <p>Your account does not have a country yet. LuckyStake uses your country to set your wallet currency and show the right deposit options for you — so we need it before you continue.</p>
        <div className="country-gate-options">
          {COUNTRY_LIST.map(c => (
            <button key={c.code} type="button" className={selected === c.code ? 'on' : ''} onClick={() => setSelected(c.code)} aria-pressed={selected === c.code}>
              <span className="cg-flag">{c.flag}</span>
              <span className="cg-meta"><b>{c.name}</b><small>{c.currency} wallet · {c.code === 'NG' ? 'Flutterwave deposits' : 'Mobile Money deposits'}</small></span>
              <span className="material-symbols-rounded cg-check">{selected === c.code ? 'check_circle' : 'radio_button_unchecked'}</span>
            </button>
          ))}
        </div>
        {error && <p className="lp-error"><span className="material-symbols-rounded">error</span>{error}</p>}
        <button type="button" className="lp-cta" disabled={!selected || saving} onClick={save}>
          <span className="material-symbols-rounded">check</span>{saving ? 'Saving…' : 'Save & continue'}
        </button>
        <p className="country-gate-fine">You can change your country later in your wallet.</p>
      </div>
    </div>
  );
}
