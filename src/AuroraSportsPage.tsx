import { useEffect, useMemo, useState } from 'react';
import { api, formatKickoff, formatKickoffDate, isFinishedMatch, isLiveStatus, liveClock, normalizeMatches, primaryOdds, sportFeedPath, type Feed, type MatchRow, type Sport } from './api';

type SportChoice = { key: 'all' | Sport; label: string; icon: string };
const SPORT_CHOICES: SportChoice[] = [
  { key: 'all', label: 'All sports', icon: '✦' },
  { key: 'football', label: 'Football', icon: '◉' },
  { key: 'basketball', label: 'Basketball', icon: '◌' },
  { key: 'tennis', label: 'Tennis', icon: '⌁' },
  { key: 'nfl', label: 'NFL', icon: '◇' },
  { key: 'baseball', label: 'Baseball', icon: '◍' },
  { key: 'mma', label: 'MMA', icon: '✹' },
];
const DATA_SPORTS: Sport[] = SPORT_CHOICES.filter((item): item is SportChoice & { key: Sport } => item.key !== 'all').map(item => item.key);
const TODAY_FEED: Record<Sport, Feed> = { football: 'today', baseball: 'today', nfl: 'today', basketball: 'upcoming', tennis: 'upcoming', mma: 'upcoming' };
function displayStatus(match: MatchRow) {
  if (isLiveStatus(match.status)) return <><i className="aurora-live-dot" /> {liveClock(match)}</>;
  return formatKickoffDate(match.kickoffAt) ? `${formatKickoffDate(match.kickoffAt)} · ${formatKickoff(match.kickoffAt)}` : 'SCHEDULED';
}

function chooseOdd(match: MatchRow, selection: string, odds: string) {
  localStorage.setItem('luckystakeSlip', JSON.stringify({
    matchId: match.id,
    selection,
    odds,
    market: 'Match result',
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    league: match.league,
    homeLogo: match.displayHomeLogo || match.homeLogo,
    awayLogo: match.displayAwayLogo || match.awayLogo,
    country: match.league?.split(' ')[0] || 'International',
  }));
  window.dispatchEvent(new Event('slip:open'));
  window.dispatchEvent(new Event('slip:update'));
}

function MatchCard({ match }: { match: MatchRow }) {
  const live = isLiveStatus(match.status);
  return <article className={`aurora-match-card${live ? ' live' : ''}`}>
    <div className="aurora-card-meta"><span><i className="aurora-league-dot" />{match.league || `${match.sport || 'Sports'} market`}</span><b>{displayStatus(match)}</b></div>
    <a className="aurora-card-fixture" href={`/match/${encodeURIComponent(match.id)}`}>
      <div className="aurora-team"><img src={match.displayHomeLogo || match.homeLogo || '/admin-logos/team-home-01.png'} alt="" /><strong>{match.homeTeam}</strong></div>
      <div className="aurora-score">{live ? <b>{match.scoreHome ?? 0}<small>—</small>{match.scoreAway ?? 0}</b> : <b>VS</b>}<small>{live ? 'LIVE' : 'KICKOFF'}</small></div>
      <div className="aurora-team away"><img src={match.displayAwayLogo || match.awayLogo || '/admin-logos/team-away-01.png'} alt="" /><strong>{match.awayTeam}</strong></div>
    </a>
    <div className="aurora-odds-row">
      <button onClick={() => chooseOdd(match, match.homeTeam, match.homeOdds || '')}><span>1</span><b>{match.homeOdds || '—'}</b></button>
      <button onClick={() => chooseOdd(match, 'Draw', match.drawOdds || '')}><span>X</span><b>{match.drawOdds || '—'}</b></button>
      <button onClick={() => chooseOdd(match, match.awayTeam, match.awayOdds || '')}><span>2</span><b>{match.awayOdds || '—'}</b></button>
      <a href={`/match/${encodeURIComponent(match.id)}`} className="aurora-more">+ markets</a>
    </div>
  </article>;
}

export default function AuroraSportsPage() {
  const [activeSport, setActiveSport] = useState<'all' | Sport>('all');
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  async function loadSportFeed(sport: Sport) {
    const preferred = TODAY_FEED[sport];
    const candidates: Feed[] = Array.from(new Set<Feed>([preferred, ...(preferred === 'today' ? ['upcoming' as Feed] : []), 'live']));
    const rows: MatchRow[] = [];
    for (const candidate of candidates) {
      try {
        const data = await api<unknown>('GET', sportFeedPath(sport, candidate));
        rows.push(...normalizeMatches(data, sport).map(match => ({ ...match, sport })));
      } catch { /* unavailable sport feeds stay silent in the customer UI */ }
    }
    const normalized = normalizeMatches(rows, sport);
    if (sport !== 'baseball') return normalized;
    const enriched = await Promise.all(normalized.slice(0, 30).map(async match => {
      try {
        const odds = await api<unknown>('GET', `/api/public/baseball/matches/${encodeURIComponent(match.id)}/odds`);
        return { ...match, ...primaryOdds(odds, match.homeTeam, match.awayTeam) };
      } catch {
        return match;
      }
    }));
    return [...enriched, ...normalized.slice(30)];
  }

  async function loadMatches() {
    setLoading(true);
    const sports = activeSport === 'all' ? DATA_SPORTS : [activeSport];
    const results = await Promise.all(sports.map(loadSportFeed));
    setMatches(results.flatMap(result => result));
    setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setLoading(false);
  }

  useEffect(() => {
    void loadMatches();
    const refreshTimer = window.setInterval(() => void loadMatches(), 30_000);
    return () => window.clearInterval(refreshTimer);
  }, [activeSport]);

  const visible = useMemo(() => {
    const unique = new Map<string, MatchRow>();
    for (const match of matches) unique.set(match.id, match);
    return Array.from(unique.values()).filter(match => {
      const matchSport = String(match.sport || '').trim().toLowerCase();
      if (activeSport !== 'all' && matchSport !== activeSport) return false;
      if (isFinishedMatch(match)) return false;
      return true;
    }).sort((a, b) => {
      if (isLiveStatus(a.status) !== isLiveStatus(b.status)) return isLiveStatus(a.status) ? -1 : 1;
      if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
      return new Date(a.kickoffAt || 0).getTime() - new Date(b.kickoffAt || 0).getTime();
    });
  }, [activeSport, matches]);
  const groupedCount = new Set(visible.map(match => match.sport)).size;

  return <section className="aurora-page">
    <header className="aurora-page-head"><div><span className="aurora-eyebrow">LUCKYSTAKE SPORTSBOOK</span><h1>Every game. <b>One pulse.</b></h1><p>Match fixtures and markets across every sport, presented in one clear board.</p></div><div className="aurora-head-status"><span>{activeSport === 'all' ? 'ALL SPORTS' : SPORT_CHOICES.find(choice => choice.key === activeSport)?.label.toUpperCase()}</span><small>{lastUpdated ? `Updated ${lastUpdated}` : 'Loading markets'}</small></div></header>
    <nav className="aurora-sport-rail" aria-label="Sports"><div className="aurora-rail-label">SPORTS</div>{SPORT_CHOICES.map(choice => <button key={choice.key} className={activeSport === choice.key ? 'active' : ''} onClick={() => setActiveSport(choice.key)}><span>{choice.icon}</span><b>{choice.label}</b><small>{choice.key === 'all' ? visible.length : visible.filter(match => match.sport === choice.key).length || '—'}</small></button>)}</nav>
    <section className="aurora-feed-section"><div className="aurora-section-heading"><div><h2>{activeSport === 'all' ? 'Popular fixtures' : `${SPORT_CHOICES.find(choice => choice.key === activeSport)?.label} fixtures`}</h2></div><span>{groupedCount} sport{groupedCount === 1 ? '' : 's'} · {visible.length} events</span></div>{loading ? <div className="aurora-empty"><span className="aurora-spinner" />Loading markets…</div> : visible.length === 0 ? <div className="aurora-empty"><strong>No active games right now.</strong><span>Live games update automatically.</span></div> : <div className="aurora-match-grid">{visible.slice(0, 30).map(match => <MatchCard key={match.id} match={match} />)}</div>}</section>
  </section>;
}
