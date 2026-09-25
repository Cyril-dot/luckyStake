import { useEffect, useMemo, useState } from 'react';
import { api, fetchMatchDetail, formatKickoff, isFinishedMatch, isLiveStatus, isMatchLive, liveClock, normalizeMatches, parseKickoff, type MatchRow } from './api';

type AnyRecord = Record<string, any>;
type SlipSelection = {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  selection: string;
  odds: number;
  status?: string;
  kickoffAt?: string;
  scoreHome?: number;
  scoreAway?: number;
};
type SlipBet = {
  id: string;
  status: string;
  stake: number;
  odds: number;
  potentialReturn: number;
  placedAt?: string;
  selections: SlipSelection[];
  raw: AnyRecord;
};

const OPEN_STATUSES = new Set(['PENDING', 'OPEN', 'ACTIVE', 'PLACED', 'RUNNING', 'IN_PLAY', 'LIVE']);
const WIN_STATUSES = new Set(['WON', 'WIN', 'CASHED_OUT', 'CASHOUT', 'PAID']);
const LOSS_STATUSES = new Set(['LOST', 'LOSS', 'LOSE', 'VOID', 'CANCELLED', 'CANCELED']);

function numberValue(...values: unknown[]) {
  const visited = new Set<unknown>();
  const read = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string' && value.trim()) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
    if (!value || typeof value !== 'object' || visited.has(value)) return 0;
    visited.add(value);
    if (Array.isArray(value)) { for (const entry of value) { const found = read(entry); if (found > 0) return found; } return 0; }
    const object = value as AnyRecord;
    for (const key of ['oddsLocked', 'submittedOdds', 'selectionOdds', 'decimalOdds', 'oddValue', 'odd', 'price', 'value', 'odds']) { const found = read(object[key]); if (found > 0) return found; }
    return 0;
  };
  for (const value of values) { const parsed = read(value); if (parsed > 0) return parsed; }
  return 0;
}

function nestedScore(value: unknown, side: 'home' | 'away', depth = 0): number | undefined { if (depth > 6 || value == null) return undefined; if (typeof value === 'string') { const parts = value.match(/(\d+)\s*[-:]\s*(\d+)/); if (parts) return Number(parts[side === 'home' ? 1 : 2]); return undefined; } if (Array.isArray(value)) { for (const item of value) { const found = nestedScore(item, side, depth + 1); if (found != null) return found; } return undefined; } if (typeof value !== 'object') return undefined; const object = value as AnyRecord; const keys = side === 'home' ? ['homeScore','home_score','scoreHome','score_home','homeGoals','home_goals','goalsHome','homePoints','home'] : ['awayScore','away_score','scoreAway','score_away','awayGoals','away_goals','goalsAway','awayPoints','away']; for (const key of keys) { const direct = Number(object[key]); if (Number.isFinite(direct)) return direct; } for (const key of ['score','scores','liveScore','live_score','scoreboard','currentScore','current_score','current','live','goals','fullTime','full_time','ft','result','results','periods','period']) { const found = nestedScore(object[key], side, depth + 1); if (found != null) return found; } return undefined; }
function stringValue(...values: unknown[]) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '') != null
    ? String(values.find(value => value !== undefined && value !== null && String(value).trim() !== ''))
    : '';
}

function listFrom(payload: unknown): AnyRecord[] {
  if (Array.isArray(payload)) return payload as AnyRecord[];
  if (!payload || typeof payload !== 'object') return [];
  const object = payload as AnyRecord;
  for (const key of ['content', 'bets', 'items', 'results', 'data']) {
    if (Array.isArray(object[key])) return object[key] as AnyRecord[];
    if (object[key] && typeof object[key] === 'object') {
      const nested = listFrom(object[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}

function selectionList(raw: AnyRecord): AnyRecord[] {
  const source = raw.selections ?? raw.picks ?? raw.legs ?? raw.betSelections ?? raw.events ?? [];
  return Array.isArray(source) ? source : [];
}

function nestedOdds(raw: AnyRecord) {
  const direct = numberValue(raw.oddsLocked, raw.submittedOdds, raw.selectionOdds, raw.oddValue, raw.odd, raw.price, raw.odds, raw.value);
  if (direct > 0) return direct;
  const containers = [raw.odds, raw.price, raw.outcome, raw.selection, raw.marketSelection];
  for (const container of containers) {
    if (!container || typeof container !== 'object') continue;
    const value = numberValue(container.submittedOdds, container.selectionOdds, container.oddValue, container.odd, container.price, container.odds, container.value, container.decimalOdds);
    if (value > 0) return value;
  }
  return 0;
}

function normalizeSelection(raw: AnyRecord, index: number): SlipSelection {
  const match = raw.match && typeof raw.match === 'object' ? raw.match : {};
  const homeTeam = stringValue(raw.homeTeam, raw.home_team, raw.homeName, match.homeTeam, match.home, raw.event?.homeTeam, 'Home team');
  const awayTeam = stringValue(raw.awayTeam, raw.away_team, raw.awayName, match.awayTeam, match.away, raw.event?.awayTeam, 'Away team');
  return {
    id: stringValue(raw.id, raw.selectionId, `${index}`),
    matchId: stringValue(raw.matchId, raw.match_id, raw.eventId, match.id),
    homeTeam,
    awayTeam,
    market: stringValue(raw.market, raw.marketName, raw.betType, 'Match result'),
    selection: stringValue(raw.selection, raw.outcome, raw.pick, raw.value, 'Selection'),
    odds: nestedOdds(raw),
    status: stringValue(raw.status, raw.result),
    kickoffAt: stringValue(raw.kickoffAt, raw.kickoff_at, raw.startTime, raw.scheduledAt, match.kickoffAt),
    scoreHome: nestedScore(raw, 'home') ?? nestedScore(match, 'home') ?? match.scoreHome,
    scoreAway: nestedScore(raw, 'away') ?? nestedScore(match, 'away') ?? match.scoreAway,
  };
}

function normalizeBet(raw: AnyRecord, index: number): SlipBet {
  const selections = selectionList(raw).map(normalizeSelection);
  const calculatedOdds = selections.reduce((total, selection) => total * (selection.odds > 0 ? selection.odds : 1), 1);
  const odds = numberValue(raw.totalOdds, raw.odds, raw.combinedOdds, calculatedOdds);
  if (import.meta.env.DEV) console.log('[LuckyStake][OpenBetOdds][normalize]', { betId: raw.id ?? raw.betId ?? raw.ticketId, selections: selections.map(selection => ({ teams: `${selection.homeTeam} vs ${selection.awayTeam}`, homeTeam: selection.homeTeam, awayTeam: selection.awayTeam, selectionId: selection.id, matchId: selection.matchId, selection: selection.selection, odds: selection.odds })), calculatedOdds, totalOdds: odds });
  const stake = numberValue(raw.stake, raw.amount, raw.stakeAmount, raw.betAmount);
  return {
    id: stringValue(raw.id, raw.betId, raw.ticketId, raw.reference, `ticket-${index}`),
    status: stringValue(raw.status, raw.state, raw.result, 'PENDING').toUpperCase(),
    stake,
    odds,
    potentialReturn: numberValue(raw.potentialReturn, raw.potentialWin, raw.possibleWin, raw.payout, raw.returnAmount, stake * odds),
    placedAt: stringValue(raw.placedAt, raw.createdAt, raw.created_at, raw.date, raw.updatedAt),
    selections,
    raw,
  };
}

function money(value: number) {
  return `GH₵${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(value?: string) {
  if (!value) return 'Recent';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recent' : date.toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusLabel(status: string) {
  if (WIN_STATUSES.has(status)) return 'WON';
  if (LOSS_STATUSES.has(status)) return status === 'CASHED_OUT' || status === 'CASHOUT' ? 'CASHED OUT' : 'LOST';
  return 'OPEN';
}

function isOpen(bet: SlipBet) { return OPEN_STATUSES.has(bet.status) || (!WIN_STATUSES.has(bet.status) && !LOSS_STATUSES.has(bet.status)); }

function matchTitle(selection: SlipSelection) {
  return `${selection.homeTeam} vs ${selection.awayTeam}`;
}

function SlipStyles() {
  return <style>{`
    .ls-slip-page{max-width:1120px;margin:0 auto;padding:26px 18px 46px;background:#f2f4f8;color:#20242d;font-family:Manrope,system-ui,sans-serif;min-height:calc(100vh - 180px)}
    .ls-slip-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:18px}.ls-slip-kicker{display:block;color:#1e6bff;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.ls-slip-hero h1{margin:6px 0 5px;font-size:clamp(27px,5vw,42px);letter-spacing:-.045em}.ls-slip-hero p{margin:0;color:#667085;font-size:13px;line-height:1.5}.ls-slip-refresh{display:inline-flex;align-items:center;gap:7px;padding:10px 13px;border:1px solid #d6dce7;border-radius:9px;background:#fff;color:#1e6bff;font:800 12px Manrope;cursor:pointer}.ls-slip-refresh:disabled{opacity:.55}
    .ls-slip-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:5px;margin-bottom:14px;border-radius:12px;background:#e2e7ef}.ls-slip-tabs button{padding:12px;border:0;border-radius:8px;background:transparent;color:#687386;font:800 12px Manrope;cursor:pointer}.ls-slip-tabs button.active{background:#1e6bff;color:#fff;box-shadow:0 6px 14px rgba(30,107,255,.2)}
    .ls-slip-tools{display:flex;align-items:center;gap:8px;margin-bottom:13px;overflow:auto}.ls-slip-tools button{white-space:nowrap;padding:8px 11px;border:1px solid #d6dce7;border-radius:999px;background:#fff;color:#667085;font:800 11px Manrope;cursor:pointer}.ls-slip-tools button.active{border-color:#1e6bff;background:#eaf0ff;color:#1e6bff}
    .ls-slip-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.ls-ticket{overflow:hidden;border:1px solid #dbe1ea;border-radius:14px;background:#fff;box-shadow:0 8px 22px rgba(30,44,70,.08)}.ls-ticket-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:linear-gradient(120deg,#1246a8,#1e6bff);color:#fff}.ls-ticket-head small{display:block;color:rgba(255,255,255,.72);font-size:10px;font-weight:700;letter-spacing:.08em}.ls-ticket-head strong{font-size:12px}.ls-ticket-status{padding:5px 7px;border-radius:999px;background:rgba(255,255,255,.18);font-size:9px;letter-spacing:.08em}.ls-ticket-status.won{background:#b8f33c;color:#132000}.ls-ticket-status.lost{background:#ffe1e4;color:#9e2430}.ls-ticket-body{padding:13px}.ls-ticket-leg{padding:10px 0;border-bottom:1px solid #edf0f4}.ls-ticket-leg:first-child{padding-top:0}.ls-ticket-leg:last-child{border-bottom:0}.ls-ticket-match{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;font-weight:800}.ls-ticket-match b{color:#1e6bff;font-size:13px}.ls-ticket-meta{display:flex;align-items:center;gap:6px;margin-top:5px;color:#737986;font-size:10px}.ls-live-dot{width:6px;height:6px;border-radius:50%;background:#0da653;box-shadow:0 0 0 3px rgba(13,166,83,.12)}.ls-ticket-pick{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;padding:7px 9px;border-radius:8px;background:#f7f9fc;color:#667085;font-size:10px}.ls-ticket-pick strong{color:#20242d}.ls-ticket-pick b{color:#1e6bff;font-size:12px}.ls-ticket-total{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding-top:12px}.ls-ticket-total span{display:flex;flex-direction:column;gap:3px;color:#737986;font-size:9px}.ls-ticket-total strong{color:#20242d;font-size:12px}.ls-ticket-total .return strong{color:#16854b}.ls-ticket-actions{display:flex;gap:8px;margin-top:12px}.ls-ticket-actions button{flex:1;padding:10px;border-radius:8px;font:800 11px Manrope;cursor:pointer}.ls-primary{border:0;background:#1e6bff;color:#fff}.ls-secondary{border:1px solid #d6dce7;background:#fff;color:#526071}.ls-primary:disabled{opacity:.55;cursor:wait}
    .ls-empty,.ls-error{padding:34px 18px;text-align:center;border:1px solid #dbe1ea;border-radius:14px;background:#fff}.ls-empty .material-symbols-rounded,.ls-error .material-symbols-rounded{display:block;margin-bottom:8px;color:#1e6bff;font-size:30px}.ls-empty strong,.ls-error strong{display:block;font-size:14px}.ls-empty p,.ls-error p{margin:6px 0 14px;color:#737986;font-size:12px}.ls-empty a{display:inline-flex;padding:10px 13px;border-radius:8px;background:#1e6bff;color:#fff;font-size:11px;font-weight:800}
    .ls-detail{margin-top:14px;padding:16px;border:1px solid #dbe1ea;border-radius:14px;background:#fff;box-shadow:0 8px 22px rgba(30,44,70,.08)}.ls-detail-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.ls-detail h2{margin:0;font-size:17px}.ls-detail-close{border:0;background:transparent;color:#667085;cursor:pointer}.ls-detail-code{color:#667085;font-size:10px}.ls-detail .ls-ticket-body{padding:0}.ls-busy{display:flex;align-items:center;justify-content:center;gap:8px;padding:38px;color:#667085;font-size:12px}.ls-spin{width:15px;height:15px;border:2px solid #cbd6ec;border-top-color:#1e6bff;border-radius:50%;animation:lsSpin .7s linear infinite}@keyframes lsSpin{to{transform:rotate(360deg)}}
    @media(max-width:680px){.ls-slip-page{padding:20px 12px 34px}.ls-slip-hero{align-items:flex-start;flex-direction:column}.ls-slip-refresh{align-self:stretch;justify-content:center}.ls-slip-grid{grid-template-columns:1fr}.ls-ticket-total{gap:5px}.ls-ticket-total strong{font-size:11px}}

    /* Selected direction: LuckyStake Option 3 — Stadium Ribbon. The live page
       intentionally uses the same dark arena panel, lime payout ribbon, and
       white action treatment as the chosen /slip-preview design. */
    .ls-slip-page{background:linear-gradient(155deg,#10151e,#27213b)!important;color:#fff!important;font-family:'Rajdhani',Manrope,system-ui,sans-serif!important;max-width:none!important;margin:0!important;padding:28px max(18px,calc((100% - 1160px)/2)) 70px!important;min-height:calc(100vh - 170px)!important}
    .ls-slip-hero h1{font-family:'Rajdhani',sans-serif!important;font-weight:600!important;letter-spacing:.01em!important}.ls-slip-hero p{color:#b7abbf!important;font-family:'Rajdhani',sans-serif!important}.ls-slip-kicker{color:#d6ee46!important;font-family:'Rajdhani',sans-serif!important;letter-spacing:.12em!important}.ls-slip-refresh{border:1px solid rgba(214,238,70,.35)!important;background:rgba(255,255,255,.06)!important;color:#d6ee46!important;font-family:'Rajdhani',sans-serif!important}
    .ls-slip-tabs{background:#211a2d!important;border:1px solid #433253!important;border-radius:8px!important}.ls-slip-tabs button{color:#a99db2!important;font-family:'Rajdhani',sans-serif!important}.ls-slip-tabs button.active{background:#d6ee46!important;color:#201a29!important;box-shadow:none!important}
    .ls-slip-tools button{border:1px solid #433253!important;background:#211a2d!important;color:#a99db2!important;font-family:'Rajdhani',sans-serif!important}.ls-slip-tools button.active{border-color:#d6ee46!important;background:rgba(214,238,70,.14)!important;color:#d6ee46!important}
    .ls-slip-grid{grid-template-columns:repeat(auto-fit,minmax(290px,1fr))!important}.ls-ticket{border:1px solid #433253!important;border-radius:10px!important;background:linear-gradient(145deg,#21182e,#17121f)!important;box-shadow:0 16px 38px rgba(8,4,16,.25)!important}.ls-ticket-head{background:transparent!important;color:#fff!important;padding:14px!important}.ls-ticket-head small{color:#a99db2!important;font-family:'Rajdhani',sans-serif!important}.ls-ticket-head strong{font-family:'Rajdhani',sans-serif!important}.ls-ticket-status{background:#332342!important;color:#d6ee46!important;font-family:'Rajdhani',sans-serif!important}.ls-ticket-status.won{background:#d6ee46!important;color:#201a29!important}.ls-ticket-status.lost{background:#4a2734!important;color:#ffb4be!important}.ls-ticket-body{padding:0 14px 14px!important}.ls-ticket-leg{border-bottom:1px solid rgba(255,255,255,.12)!important}.ls-ticket-match,.ls-ticket-meta,.ls-ticket-pick,.ls-ticket-total{font-family:'Rajdhani',sans-serif!important}.ls-ticket-match{font-size:14px!important}.ls-ticket-match b{color:#d6ee46!important;font-size:16px!important}.ls-ticket-meta{color:#a99db2!important;font-size:11px!important}.ls-ticket-pick{background:rgba(255,255,255,.06)!important;color:#b7abbf!important;border-radius:4px!important}.ls-ticket-pick strong{color:#fff!important}.ls-ticket-total{grid-template-columns:1fr 1fr!important;gap:10px!important;padding-top:14px!important}.ls-ticket-total span{color:#aaa0b2!important;font-size:12px!important}.ls-ticket-total strong{color:#fff!important;font-size:15px!important}.ls-ticket-total .return{grid-column:1/-1!important;margin:0 -14px!important;padding:16px 14px!important;min-height:68px!important;border-radius:0!important;background:linear-gradient(90deg,#d6ee46,#94ac2b)!important;color:#201a29!important}.ls-ticket-total .return strong{color:#201a29!important;font-size:32px!important;line-height:1!important}.ls-ticket-actions{margin-top:16px!important}.ls-ticket-actions button{font-family:'Rajdhani',sans-serif!important;font-size:13px!important}.ls-primary{border:0!important;border-radius:4px!important;background:#fff!important;color:#231d2e!important}.ls-secondary{border:1px solid #433253!important;background:transparent!important;color:#d6ee46!important;border-radius:4px!important}.ls-empty,.ls-error{border:1px solid #433253!important;border-radius:10px!important;background:#21182e!important;color:#fff!important}.ls-empty .material-symbols-rounded,.ls-error .material-symbols-rounded{color:#d6ee46!important}.ls-empty strong,.ls-error strong{font-family:'Rajdhani',sans-serif!important}.ls-empty p,.ls-error p{color:#a99db2!important}.ls-empty a{background:#d6ee46!important;color:#201a29!important;border-radius:4px!important}.ls-detail{border:1px solid #433253!important;border-radius:10px!important;background:#21182e!important;color:#fff!important;box-shadow:0 16px 38px rgba(8,4,16,.25)!important}.ls-detail h2{font-family:'Rajdhani',sans-serif!important}.ls-detail-code,.ls-detail-close{color:#a99db2!important}.ls-busy{color:#a99db2!important}.ls-spin{border-color:#433253!important;border-top-color:#d6ee46!important}
    /* Final selected direction: LuckyStake Mobile Ticket. Compact phone-ticket
       rhythm from the chosen preview: dark purple sheet, lime payout, compact
       rows, and thumb-friendly actions. */
    .ls-slip-page{background:linear-gradient(145deg,#171220,#2a2038)!important;font-family:'Rajdhani',Manrope,system-ui,sans-serif!important}
    .ls-slip-hero{max-width:520px;margin-left:auto;margin-right:auto}.ls-slip-hero h1{font-size:34px!important;line-height:1!important}.ls-slip-hero p{font-size:12px!important}.ls-slip-refresh{border-radius:7px!important;background:#21182e!important;color:#d6ee46!important}
    .ls-slip-tabs{max-width:520px;margin-left:auto;margin-right:auto;background:#21182e!important;border-color:#5a456b!important;border-radius:9px!important}.ls-slip-tabs button{font-size:13px!important}.ls-slip-tabs button.active{background:#8951ce!important;color:#fff!important}
    .ls-slip-tools{max-width:520px;margin-left:auto;margin-right:auto}.ls-slip-tools button{border-color:#5a456b!important;background:#21182e!important}.ls-slip-tools button.active{background:rgba(214,238,70,.12)!important;color:#d6ee46!important}
    .ls-slip-grid{display:grid!important;grid-template-columns:1fr!important;max-width:520px!important;margin:0 auto!important;gap:12px!important}.ls-ticket{border-color:#5a456b!important;border-radius:12px!important;background:#21182e!important;box-shadow:0 12px 30px rgba(8,4,16,.3)!important}.ls-ticket-head{padding:12px 14px!important}.ls-ticket-head small{font-size:9px!important}.ls-ticket-head strong{font-size:13px!important}.ls-ticket-status{background:#332342!important}.ls-ticket-body{padding:0 14px 14px!important}.ls-ticket-leg{padding:9px 0!important}.ls-ticket-match{font-size:13px!important}.ls-ticket-match b{font-size:16px!important}.ls-ticket-meta{font-size:10px!important}.ls-ticket-pick{margin-top:6px!important;padding:8px!important;border:1px solid #493957!important;background:#1d1628!important}.ls-ticket-total{grid-template-columns:1fr 1fr!important;padding-top:11px!important;gap:8px!important}.ls-ticket-total span{font-size:10px!important}.ls-ticket-total strong{font-size:14px!important}.ls-ticket-total .return{grid-column:1/-1!important;margin:1px 0 0!important;padding:10px 0!important;min-height:0!important;border-radius:0!important;border-top:1px solid #59456d!important;border-bottom:1px solid #59456d!important;background:transparent!important;color:#c8b7d2!important}.ls-ticket-total .return strong{color:#d6ee46!important;font-size:25px!important}.ls-ticket-total .return{text-align:right!important;align-items:flex-end!important}.ls-ticket-actions{margin-top:11px!important}.ls-ticket-actions button{min-height:42px!important;border-radius:5px!important;font-size:12px!important}.ls-primary{background:#d6ee46!important;color:#211b29!important}.ls-secondary{border-color:#6b517e!important;background:#21182e!important;color:#d4c7dc!important}.ls-detail{max-width:520px;margin:14px auto 0!important;background:#21182e!important;border-color:#5a456b!important}.ls-empty,.ls-error{max-width:520px;margin:0 auto!important;background:#21182e!important;border-color:#5a456b!important}
    .ls-ticket-match{font-size:16px!important;line-height:1.15!important}.ls-ticket-match span{font-weight:700!important}.ls-ticket-match em{color:#a99db2!important;font-style:normal!important;font-weight:500!important}.ls-ticket-match b{min-width:42px;text-align:right;font-size:15px!important;line-height:1!important}.ls-ticket-meta{font-size:12px!important;flex-wrap:wrap!important}.ls-ticket-pick{font-size:13px!important}.ls-ticket-pick strong{min-width:42px;text-align:right;color:#d6ee46!important;font-size:15px!important;line-height:1!important}.ls-live-label{color:#d6ee46!important;font-size:12px!important}.ls-ended-check{color:#39c878!important;font-size:18px!important;line-height:1!important}.ls-live-score{color:#fff!important;font-size:14px!important;margin-left:3px!important}.ls-ticket-actions .ls-primary{width:100%!important}@media(max-width:560px){.ls-ticket-match{font-size:17px!important}.ls-ticket-match b{font-size:16px!important}.ls-ticket-meta{font-size:13px!important}.ls-ticket-pick{padding:10px!important;font-size:14px!important}.ls-ticket-pick strong{font-size:16px!important}.ls-ticket-head small,.ls-ticket-head strong{font-size:12px!important}.ls-ticket-total span{font-size:12px!important}.ls-ticket-total strong{font-size:16px!important}.ls-ticket-total .return strong{font-size:28px!important}}
    .ls-ticket{cursor:pointer;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}.ls-ticket:active{transform:scale(.99)}.ls-ticket-open{border-color:#5a456b!important}.ls-ticket-won{border-color:#d6ee46!important;background:linear-gradient(145deg,#2b2531,#21182e)!important;box-shadow:0 12px 30px rgba(214,238,70,.12)!important}.ls-ticket-won .ls-ticket-status{background:#d6ee46!important;color:#211b29!important}.ls-ticket-status-wrap{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}.ls-ticket-win-badge{display:inline-flex;align-items:center;gap:4px;color:#d6ee46;font-size:10px;font-weight:900;letter-spacing:.04em}.ls-ticket-win-badge img{width:22px;height:22px;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}.ls-ticket-won .ls-ticket-total .return{border-color:rgba(214,238,70,.55)!important}.ls-ticket-lost{border-color:#7b4050!important;background:linear-gradient(145deg,#291c2b,#21182e)!important}.ls-ticket-lost .ls-ticket-status{background:#4a2734!important;color:#ffb4be!important}.ls-ticket-lost .ls-ticket-total .return strong{color:#ff9cab!important}.ls-ticket-actions{pointer-events:auto!important}
    .ls-ticket-total .return{display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;white-space:nowrap!important;text-align:left!important}.ls-ticket-total .return strong{margin-left:auto!important;color:#d6ee46!important;font-family:'Rajdhani',sans-serif!important;font-size:20px!important;font-weight:600!important;letter-spacing:.01em!important}
  `}</style>;
}

function TicketCard({ bet, matchUpdates, onDetails, onCashout, cashingOut }: { bet: SlipBet; matchUpdates: Record<string, MatchRow>; onDetails: () => void; onCashout: () => void; cashingOut: boolean }) {
  const open = isOpen(bet);
  const status = statusLabel(bet.status);
  return <article className={`ls-ticket ${status === 'WON' ? 'ls-ticket-won' : status === 'LOST' ? 'ls-ticket-lost' : 'ls-ticket-open'}`} onClick={open ? undefined : onDetails} role={open ? undefined : 'button'} tabIndex={open ? undefined : 0} onKeyDown={open ? undefined : event => { if (event.key === 'Enter' || event.key === ' ') onDetails(); }}>
    <div className="ls-ticket-head"><div><small>{bet.selections.length || 1} selection{bet.selections.length === 1 ? '' : 's'}</small><strong>{dateLabel(bet.placedAt)}</strong></div><div className="ls-ticket-status-wrap">{status === 'WON' && <span className="ls-ticket-win-badge"><img src="/superbet-victory-trophy.png" alt="" /> WINNING TICKET</span>}<span className={`ls-ticket-status ${status === 'WON' ? 'won' : status === 'LOST' ? 'lost' : ''}`}>{status}</span></div></div>
    <div className="ls-ticket-body">
      {(bet.selections.length ? bet.selections : [{ id: 'empty', matchId: '', homeTeam: 'Bet selection', awayTeam: '', market: 'Match result', selection: 'Awaiting selection', odds: bet.odds }]).map((selection, index) => {
        const match = matchUpdates[selection.matchId];
        const homeTeam = match?.homeTeam || selection.homeTeam;
        const awayTeam = match?.awayTeam || selection.awayTeam;
        const matchStatus = match?.status || selection.status;
        const kickoff = match?.kickoffAt || selection.kickoffAt;
        const scoreHome = match?.scoreHome ?? selection.scoreHome;
        const scoreAway = match?.scoreAway ?? selection.scoreAway;
        const displayOdds = selection.odds;
        const ended = Boolean((match && isFinishedMatch(match)) || ['FINISHED', 'FULL_TIME', 'FT', 'ENDED', 'COMPLETED', 'COMPLETE'].includes(String(matchStatus || '').toUpperCase())); const live = !ended && (match ? isMatchLive(match) : isLiveStatus(matchStatus));
        if (import.meta.env.DEV) { console.log('[LuckyStake][OpenBetScore][render]', { betId: bet.id, teams: `${homeTeam} vs ${awayTeam}`, homeTeam, awayTeam, selectionId: selection.id, matchId: selection.matchId, selectionScore: { home: selection.scoreHome, away: selection.scoreAway }, matchScore: { home: match?.scoreHome, away: match?.scoreAway }, matchStatus, kickoff, ended, live, renderedScore: scoreHome != null && scoreAway != null ? `${scoreHome}-${scoreAway}` : null }); console.log('[LuckyStake][OpenBetOdds][render]', { betId: bet.id, teams: `${homeTeam} vs ${awayTeam}`, homeTeam, awayTeam, selectionId: selection.id, matchId: selection.matchId, selection: selection.selection, odds: selection.odds, displayOdds, displayedText: displayOdds > 0 ? displayOdds.toFixed(2) : 'Not available' }); }
        return <div className="ls-ticket-leg" key={`${selection.id}-${index}`}><div className="ls-ticket-match"><span>{homeTeam} <em>vs</em> {awayTeam}</span></div><div className="ls-ticket-meta">{ended ? <><span className="ls-ended-check material-symbols-rounded" aria-label="Match ended">check_circle</span>{scoreHome != null && scoreAway != null && <strong className="ls-live-score">{scoreHome} - {scoreAway}</strong>}</> : live ? <><i className="ls-live-dot" /> <strong className="ls-live-label">LIVE {match ? liveClock(match) : 'Live'}</strong>{scoreHome != null && scoreAway != null && <strong className="ls-live-score">{scoreHome} - {scoreAway}</strong>}</> : kickoff && <span>{formatKickoff(kickoff)}</span>}<span>· {selection.market}</span></div><div className="ls-ticket-pick"><span>{selection.selection}</span><strong>{displayOdds > 0 ? displayOdds.toFixed(2) : 'Not available'}</strong></div></div>;
      })}
      <div className="ls-ticket-total"><span>Stake<strong>{money(bet.stake)}</strong></span><span>Odds<strong>{bet.odds.toFixed(2)}×</strong></span><span className="return">{open ? 'Potential return' : 'Return'}<strong>{money(bet.potentialReturn)}</strong></span></div>
      {open && <div className="ls-ticket-actions"><button className="ls-primary" type="button" onClick={event => { event.stopPropagation(); onCashout(); }} disabled={cashingOut}>{cashingOut ? 'Cashing out…' : 'Cash out'}</button></div>}
    </div>
  </article>;
}

export default function SlipPage() {
  const [tab, setTab] = useState<'open' | 'history'>('open');
  const [bets, setBets] = useState<SlipBet[]>([]);
  const [matchUpdates, setMatchUpdates] = useState<Record<string, MatchRow>>({});
  const [selected, setSelected] = useState<SlipBet | null>(null);
  const [filter, setFilter] = useState<'all' | 'won' | 'lost'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [cashoutId, setCashoutId] = useState('');
  const [, repaintClock] = useState(0);

  const load = async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const payload = await api<unknown>('GET', '/api/bets?page=0&size=100');
      setBets(listFrom(payload).map(normalizeBet));
    } catch (e) {
      setError(e instanceof Error && (e as any).status === 401 ? 'Log in to see your bets.' : e instanceof Error ? e.message : 'We could not load your bets right now.');
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    const clockTimer = window.setInterval(() => repaintClock(value => value + 1), 1000);
    load();
    const timer = window.setInterval(() => { load(true); }, 30000);
    return () => { window.clearInterval(timer); window.clearInterval(clockTimer); };
  }, []);
  useEffect(() => {
    const ids = Array.from(new Set(bets.flatMap(bet => bet.selections.map(selection => selection.matchId)).filter(Boolean)));
    if (!ids.length) return;
    let cancelled = false;
    const refreshMatches = () => Promise.all([
      Promise.all(ids.map(async id => { try { return await fetchMatchDetail(id); } catch (error) { if (import.meta.env.DEV) console.error('[LuckyStake][OpenBetScore][detail-error]', { id, error }); return null; } })),
      api<unknown>('GET', '/api/public/football/matches/live').then(payload => normalizeMatches(payload, 'football')).catch(error => { if (import.meta.env.DEV) console.error('[LuckyStake][OpenBetScore][live-feed-error]', error); return [] as MatchRow[]; }),
    ]).then(([directRows, liveRows]) => {
      if (import.meta.env.DEV) console.debug('[LuckyStake][OpenBetScore][refresh]', { ids, directRows, liveRows });
      if (cancelled) return;
      setMatchUpdates(previous => {
        const next = { ...previous };
        ids.forEach((id, index) => {
          const selection = bets.flatMap(bet => bet.selections).find(item => item.matchId === id);
          const direct = directRows[index];
          const live = liveRows.find(item => item.id === id || String((item as MatchRow & { externalId?: string }).externalId || '') === id || (selection && item.homeTeam === selection.homeTeam && item.awayTeam === selection.awayTeam));
          if (import.meta.env.DEV) console.debug('[LuckyStake][OpenBetScore][merge]', { id, teams: selection ? `${selection.homeTeam} vs ${selection.awayTeam}` : 'Unknown teams', homeTeam: selection?.homeTeam, awayTeam: selection?.awayTeam, selection, direct, live, merged: direct || live ? { ...(live || {}), ...(direct || {}) } : next[id] });
          if (direct || live) next[id] = { ...(live || {}), ...(direct || {}) } as MatchRow;
        });
        return next;
      });
    });
    refreshMatches();
    const timer = window.setInterval(refreshMatches, 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [bets]);

  const openBets = useMemo(() => bets.filter(isOpen), [bets]);
  const history = useMemo(() => bets.filter(bet => !isOpen(bet)), [bets]);
  const visible = useMemo(() => {
    const source = tab === 'open' ? openBets : history;
    if (tab === 'open' || filter === 'all') return source;
    if (filter === 'won') return source.filter(bet => WIN_STATUSES.has(bet.status));
    return source.filter(bet => LOSS_STATUSES.has(bet.status));
  }, [filter, history, openBets, tab]);

  function openTicket(id: string) {
    window.history.pushState({}, '', `/ticket/${encodeURIComponent(id)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  async function cashout(bet: SlipBet) {
    setCashoutId(bet.id);
    try { await api('POST', `/api/bets/${encodeURIComponent(bet.id)}/cashout`); await load(true); setSelected(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Cashout could not be completed.'); }
    finally { setCashoutId(''); }
  }

  return <main className="ls-slip-page"><SlipStyles /><div className="ls-slip-tabs"><button className={tab === 'open' ? 'active' : ''} type="button" onClick={() => { setTab('open'); setFilter('all'); setSelected(null); }}>Open Bets <span>({openBets.length})</span></button><button className={tab === 'history' ? 'active' : ''} type="button" onClick={() => { setTab('history'); setSelected(null); }}>Bet History <span>({history.length})</span></button></div>
    {tab === 'history' && <div className="ls-slip-tools"><button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => setFilter('all')}>All results</button><button className={filter === 'won' ? 'active' : ''} type="button" onClick={() => setFilter('won')}>Won</button><button className={filter === 'lost' ? 'active' : ''} type="button" onClick={() => setFilter('lost')}>Lost</button></div>}
    {error && <div className="ls-error"><span className="material-symbols-rounded">error</span><strong>{error}</strong><p>Check your session and try refreshing the page.</p><a href="/login">Log in</a></div>}
    {!error && loading && <div className="ls-busy"><span className="ls-spin" /> Loading your bets…</div>}
    {!error && !loading && !visible.length && <div className="ls-empty"><span className="material-symbols-rounded">receipt_long</span><strong>{tab === 'open' ? 'No open bets yet' : 'No settled bets yet'}</strong><p>{tab === 'open' ? 'Your active tickets will appear here after you place a bet.' : 'Completed tickets will appear here after a match is settled.'}</p><a href="/sports">Browse sportsbook</a></div>}
    {!error && !loading && visible.length > 0 && <div className="ls-slip-grid">{visible.map(bet => <TicketCard key={bet.id} bet={bet} matchUpdates={matchUpdates} onDetails={() => openTicket(bet.id)} onCashout={() => cashout(bet)} cashingOut={cashoutId === bet.id} />)}</div>}
  </main>;
}
