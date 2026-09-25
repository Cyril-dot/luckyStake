import { useState } from 'react';

type MatchState = 'today' | 'live' | 'upcoming' | 'featured';

const samples: Record<MatchState, { league: string; home: string; away: string; homeShort: string; awayShort: string; kickoff: string; score?: string; clock?: string; odds: string[] }> = {
  today: { league: 'Premier League · Matchday 12', home: 'Arsenal', away: 'Chelsea', homeShort: 'ARS', awayShort: 'CHE', kickoff: 'Today · 20:00', odds: ['1.52', '3.80', '5.10'] },
  live: { league: 'Premier League · Live', home: 'Arsenal', away: 'Chelsea', homeShort: 'ARS', awayShort: 'CHE', kickoff: 'LIVE', score: '2 — 1', clock: "83'", odds: ['1.18', '6.40', '12.00'] },
  upcoming: { league: 'LaLiga · Tomorrow', home: 'Barcelona', away: 'Valencia', homeShort: 'BAR', awayShort: 'VAL', kickoff: 'Tomorrow · 21:00', odds: ['1.44', '4.60', '6.90'] },
  featured: { league: 'LuckyStake Special · Featured', home: 'Northstar FC', away: 'Capital United', homeShort: 'NS', awayShort: 'CU', kickoff: 'Today · 18:30', odds: ['2.10', '3.20', '2.85'] },
};

const designs = [
  { id: '01', name: 'Broadcast Rail', tag: 'Live-first / dense / professional', className: 'match-design-broadcast', icon: 'radio', note: 'Best for a serious sportsbook: status and time stay in the right rail, while odds remain one tap away.' },
  { id: '02', name: 'Scoreboard Split', tag: 'Score-led / familiar / fast scan', className: 'match-design-scoreboard', icon: 'sports_score', note: 'Best when live scores are the hero: the center scoreboard gives live matches a clear visual priority.' },
  { id: '03', name: 'League Stack', tag: 'Editorial / league-led / compact', className: 'match-design-stack', icon: 'view_agenda', note: 'Best for high-volume feeds: league context anchors the card and the fixture rows stay compact.' },
  { id: '04', name: 'Spotlight Ticket', tag: 'Featured / expressive / premium', className: 'match-design-ticket', icon: 'local_activity', note: 'Best for admin-featured games: a richer ticket treatment distinguishes special fixtures without inventing odds.' },
];

function Crest({ initials, tone }: { initials: string; tone: 'home' | 'away' }) {
  return <span className={`sample-crest sample-crest-${tone}`}>{initials}</span>;
}

function Odds({ values }: { values: string[] }) {
  return <div className="sample-odds">{values.map((value, index) => <button key={value}><small>{['1', 'X', '2'][index]}</small><b>{value}</b></button>)}</div>;
}

function MatchSample({ state, className }: { state: MatchState; className: string }) {
  const match = samples[state];
  const live = state === 'live';
  const featured = state === 'featured';
  return <div className={`match-sample ${className} match-sample-${state}`}>
    <div className="sample-card-top"><span className="sample-league"><span className="material-symbols-rounded">emoji_events</span>{match.league}</span>{featured ? <span className="sample-featured"><span className="material-symbols-rounded">bolt</span> FEATURED</span> : live ? <span className="sample-live"><i /> LIVE</span> : <span className="sample-kickoff">{match.kickoff}</span>}</div>
    <div className="sample-fixture"><div className="sample-team"><Crest initials={match.homeShort} tone="home" /><strong>{match.home}</strong></div><div className="sample-center">{live ? <><b>{match.score}</b><small><span className="material-symbols-rounded">timer</span>{match.clock}</small></> : <><span className="sample-vs">VS</span><small>{match.kickoff}</small></>}</div><div className="sample-team sample-team-away"><Crest initials={match.awayShort} tone="away" /><strong>{match.away}</strong></div></div>
    <div className="sample-market"><span>Match result</span><Odds values={match.odds} /></div>
  </div>;
}

function PreviewOption({ design }: { design: typeof designs[number] }) {
  const [state, setState] = useState<MatchState>('live');
  return <article className={`match-design-option ${design.className}`}><div className="match-design-meta"><span className="match-design-index">{design.id}</span><div><h2>{design.name}</h2><p>{design.tag}</p></div><span className="match-design-icon material-symbols-rounded">{design.icon}</span></div><div className="match-design-canvas"><div className="match-design-context"><span>LUCKYSTAKE MATCH CARD</span><small>Use the state switch to inspect the same design across the feed.</small></div><div className="match-state-switch">{(['today', 'live', 'upcoming', 'featured'] as MatchState[]).map(item => <button key={item} className={state === item ? 'active' : ''} onClick={() => setState(item)}>{item}</button>)}</div><MatchSample state={state} className={design.className} /><p className="match-design-note">{design.note}</p></div></article>;
}

export default function MatchCardDesigns() {
  return <section className="match-designs-page"><div className="match-designs-heading"><div><small>LUCKYSTAKE SPORTSBOOK / FOUR CARD DIRECTIONS</small><h1>One feed.<br /><b>Four ways to scan it.</b></h1><p>These concepts are based on the PowerBet audit: live score and minute, upcoming kickoff at top right, admin-created featured treatment, consistent crest fallbacks, and no stale ended matches in active feed sections.</p></div><div className="match-designs-legend"><span><i className="legend-live" /> Live state</span><span><i className="legend-featured" /> Admin featured</span><span><i className="legend-logo" /> Logo fallback ready</span></div></div><div className="match-design-grid">{designs.map(design => <PreviewOption key={design.id} design={design} />)}</div></section>;
}
