// Runs on app startup. Fetches the build's version.json (never cached) and
// compares it to the last-seen version. On mismatch (fresh redeploy), clears
// stale browser caches and hard-reloads so users never run old code.
const VERSION_KEY = 'app_build_id';
const CHECK_INTERVAL = 5 * 60 * 1000; // re-check every 5 minutes

async function fetchBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.buildId === 'string' ? data.buildId : null;
  } catch {
    return null;
  }
}

function clearStaleCaches() {
  // Clear Cache Storage (service worker / fetch caches)
  try {
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  } catch { /* noop */ }
  // Clear session storage (per-tab stale state)
  try { sessionStorage.clear(); } catch { /* noop */ }
  // NOTE: localStorage is intentionally preserved (auth tokens, user prefs).
}

export function initVersionCheck() {
  let lastSeen: string | null = null;
  try { lastSeen = localStorage.getItem(VERSION_KEY); } catch { /* noop */ }

  const check = async () => {
    const buildId = await fetchBuildId();
    if (!buildId) return;
    if (lastSeen && lastSeen !== buildId) {
      console.log(`[version] new deploy detected (${lastSeen} -> ${buildId}), clearing caches`);
      try { localStorage.setItem(VERSION_KEY, buildId); } catch { /* noop */ }
      clearStaleCaches();
      // Hard reload bypassing HTTP cache
      window.location.reload();
      return;
    }
    if (!lastSeen) {
      try { localStorage.setItem(VERSION_KEY, buildId); } catch { /* noop */ }
      lastSeen = buildId;
    }
  };

  check();
  setInterval(check, CHECK_INTERVAL);
}
