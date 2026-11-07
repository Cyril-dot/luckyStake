/**
 * The bet slip, shared by every page that lets a player pick an odd.
 * The slip lives in localStorage under `luckystakeSlip` and holds an
 * ACCUMULATOR: one selection per match, as many matches as the player
 * wants. Every odd button on the site must go through `toggleSlipLeg` —
 * writing a single-leg object straight to storage (what Home, Sports,
 * the sportsbook page and match details all used to do) silently
 * REPLACES the whole slip, so a second game's odd wiped the first.
 */
export type SlipLeg = { matchId: string; selection: string; odds: number | string; market?: string; homeTeam?: string; awayTeam?: string; league?: string; country?: string; homeLogo?: string; awayLogo?: string };

// Older saved slips (booking codes, other skins) sometimes carry the
// match as one "Home vs Away" string and the pick under `pick` instead
// of `selection`. Normalise so teams + selection never render blank.
export function normalizeLeg(raw: any): SlipLeg {
  const leg = raw as SlipLeg & { match?: string; pick?: string };
  let homeTeam = leg.homeTeam;
  let awayTeam = leg.awayTeam;
  if ((!homeTeam || !awayTeam) && typeof leg.match === 'string') {
    const parts = leg.match.split(/\s+vs\s+/i);
    homeTeam = homeTeam || parts[0];
    awayTeam = awayTeam || parts[1];
  }
  const selection = leg.selection || leg.pick || '';
  return { ...leg, homeTeam, awayTeam, selection };
}

export function readSlipLegs(): { legs: SlipLeg[]; fromCode: string } {
  try {
    const raw = JSON.parse(localStorage.getItem('luckystakeSlip') || 'null');
    if (!raw) return { legs: [], fromCode: '' };
    if (Array.isArray(raw.selections) && raw.selections.length) return { legs: (raw.selections as any[]).map(normalizeLeg), fromCode: String(raw.fromCode || '') };
    if (raw.matchId) return { legs: [normalizeLeg({ ...(raw as SlipLeg), market: raw.market || '1X2' })], fromCode: '' };
  } catch { /* corrupted storage reads as an empty slip */ }
  return { legs: [], fromCode: '' };
}

export function writeSlipLegs(legs: SlipLeg[], fromCode = '') {
  if (!legs.length) localStorage.removeItem('luckystakeSlip');
  else localStorage.setItem('luckystakeSlip', JSON.stringify(legs.length === 1 && !fromCode ? legs[0] : { selections: legs, ...(fromCode ? { fromCode } : {}) }));
  window.dispatchEvent(new Event('slip:update'));
}

/**
 * Toggle one pick on the slip. Same match + same selection → the leg
 * comes OFF (returns false). Same match, different selection → that
 * match's pick is REPLACED (one selection per match). A different
 * match → the leg is APPENDED, so the accumulator grows. Adding opens
 * the slip drawer so the player sees the leg land; removing just
 * refreshes the badge and the highlights.
 */
export function toggleSlipLeg(leg: SlipLeg): boolean {
  const { legs, fromCode } = readSlipLegs();
  const matchId = String(leg.matchId);
  const existingIndex = legs.findIndex((l) => String(l.matchId) === matchId);
  if (existingIndex >= 0 && legs[existingIndex].selection === leg.selection) {
    const next = legs.filter((_, i) => i !== existingIndex);
    writeSlipLegs(next, next.length ? fromCode : '');
    return false;
  }
  const next = existingIndex >= 0
    ? legs.map((l, i) => (i === existingIndex ? normalizeLeg(leg) : l))
    : [...legs, normalizeLeg(leg)];
  writeSlipLegs(next, fromCode);
  window.dispatchEvent(new Event('slip:open'));
  return true;
}

/** matchId → selection for every leg on the slip, for card highlights. */
export function slipSelectionMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const leg of readSlipLegs().legs) map[String(leg.matchId)] = leg.selection;
  return map;
}
