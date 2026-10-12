import { useEffect, useState } from 'react';
import { api } from './api';

/**
 * Country-based accounts. The backend user record carries a `country`
 * (RegisterRequest / UserDto / PATCH /api/users/me all support it); the
 * frontend captures it at signup, keeps the auth user in localStorage,
 * and lets the country drive the currency and the deposit rail:
 * GH → GHS Mobile Money (ShinobiPay), NG → NGN Flutterwave v4.
 */
export type CountryCode = 'GH' | 'NG';

export interface CountryProfile {
  code: CountryCode;
  name: string;
  currency: string;
  symbol: string;
  flag: string;
  locale: string;
}

export const COUNTRY_PROFILES: Record<CountryCode, CountryProfile> = {
  GH: { code: 'GH', name: 'Ghana', currency: 'GHS', symbol: 'GH₵', flag: '🇬🇭', locale: 'en-GH' },
  NG: { code: 'NG', name: 'Nigeria', currency: 'NGN', symbol: '₦', flag: '🇳🇬', locale: 'en-NG' },
};

export const COUNTRY_LIST: CountryProfile[] = [COUNTRY_PROFILES.GH, COUNTRY_PROFILES.NG];

export function normalizeCountry(raw: unknown): CountryCode {
  const v = String(raw ?? '').trim().toUpperCase();
  return v === 'NG' || v === 'NGN' || v === 'NGA' || v === 'NIGERIA' ? 'NG' : 'GH';
}

const USER_KEY = 'luckystake_user';
export const COUNTRY_EVENT = 'luckystake:country';

type StoredUser = Record<string, unknown> & { country?: string };

export function storeAuthUser(user: unknown) {
  if (!user || typeof user !== 'object') return;
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch { /* private mode */ }
}

export function storedUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch { return null; }
}

export function storedCountry(): CountryCode {
  return normalizeCountry(storedUser()?.country);
}

function applyCountryLocal(code: CountryCode) {
  const u = storedUser();
  if (u) storeAuthUser({ ...u, country: code });
  window.dispatchEvent(new Event(COUNTRY_EVENT));
}

let serverSyncStarted = false;

/** The signed-in user's country: local copy first, server record wins. */
export function useCountry() {
  const [country, setCountryState] = useState<CountryCode>(() => storedCountry());

  // One server sync per app load — accounts created before signup had a
  // country field get their real country from GET /api/users/me.
  useEffect(() => {
    if (serverSyncStarted) return;
    serverSyncStarted = true;
    if (!localStorage.getItem('accessToken')) return;
    api<Record<string, unknown>>('GET', '/api/users/me')
      .then(me => {
        const raw = (me as { country?: unknown })?.country ?? (me as { user?: { country?: unknown } })?.user?.country;
        if (raw == null || raw === '') return;
        const code = normalizeCountry(raw);
        storeAuthUser({ ...(storedUser() ?? {}), ...me, country: code });
        setCountryState(code);
        window.dispatchEvent(new Event(COUNTRY_EVENT));
      })
      .catch(() => undefined);
  }, []);

  // Other mounted components (header chip, wallet) follow changes.
  useEffect(() => {
    const handler = () => setCountryState(storedCountry());
    addEventListener(COUNTRY_EVENT, handler);
    return () => removeEventListener(COUNTRY_EVENT, handler);
  }, []);

  const setCountry = (code: CountryCode) => {
    setCountryState(code);
    applyCountryLocal(code);
    if (localStorage.getItem('accessToken')) {
      api('PATCH', '/api/users/me', { country: code }).catch(() => undefined);
    }
  };

  return { country, profile: COUNTRY_PROFILES[country], setCountry };
}
