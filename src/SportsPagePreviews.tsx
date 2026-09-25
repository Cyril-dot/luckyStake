import { useMemo, useState } from 'react';

type Sport = { key: string; label: string; icon: string; count: number };
type Match = { league: string; time: string; home: string; away: string; homeOdd: string; drawOdd?: string; awayOdd: string; live?: string; accent: string };

const SPORTS: Sport[] = [
  { key: 'all', label: 'All sports', icon: '✦', count: 128 },
  { key: 'football', label: 'Football', icon: '◉', count: 84 },
  { key: 'basketball', label: 'Basketball', icon: '◌', count: 22 },
  { key: 'tennis', label: 'Tennis', icon: '⌁', count: 14 },
  { key: 'nfl', label: 'NFL', icon: '◇', count: 5 },
  { key: 'mma', label: 'MMA', icon: '✹', count: 3 },
];

const MATCHES: Match[] = [
  { league: 'England · Premier League', time: '18:30', home: 'Arsenal', away: 'Brighton', homeOdd: '1.62', drawOdd: '4.10', awayOdd: '5.70', accent: '#d6ee46' },
  { league: 'Spain · La Liga', time: '20:00', home: 'Real Madrid', away: 'Villarreal', homeOdd: '1.44', drawOdd: '4.80', awayOdd: '6.90', accent: '#a879ff' },
  { league: 'Italy · Serie A', time: '20:45', home: 'Inter Milan', away: 'Napoli', homeOdd: '2.05', drawOdd: '3.40', awayOdd: '3.35', accent: '#6cc4ff' },
  { league: 'NBA · Regular season', time: '21:00', home: 'Boston Celtics', away: 'Miami Heat', homeOdd: '1.76', awayOdd: '2.14', accent: '#ff9b6b' },
  { league: 'ATP · Tokyo Open', time: '22:30', home: 'A. Zverev', away: 'F. Tiafoe', homeOdd: '1.58', awayOdd: '2.38', accent: '#d6ee46' },
];

function Odds({ match, compact = false }: { match: Match; compact?: boolean }) {
  return <div className={`sp-odds${compact ? ' compact' : ''}`}>
    <button><span>1</span><b>{match.homeOdd}</b></button>
    {match.drawOdd && <button><span>X</span><b>{match.drawOdd}</b></button>}
    <button><span>2</span><b>{match.awayOdd}</b></button>
  </div>;
}

function MatchRow({ match, live = false }: { match: Match; live?: boolean }) {
  return <article className={`sp-match-row${live ? ' is-live' : ''}`} style={{ '--match-accent': match.accent } as React.CSSProperties}>
    <div className="sp-match-meta"><span className="sp-league-dot" /> <span>{match.league}</span><small>{live ? <><i className="sp-live-dot" /> {match.live || 'LIVE'}</> : match.time}</small></div>
    <div className="sp-match-main"><div className="sp-team-stack"><b>{match.home}</b><b>{match.away}</b></div><Odds match={match} /></div>
  </article>;
}

function PreviewOne() {
  const live = { ...MATCHES[2], live: "2H · 67'" };
  return <section className="sp-preview sp-preview-aurora">
    <div className="sp-aurora-head"><div><span className="sp-eyebrow">CONCEPT 01 · AURORA LIVE</span><h2>Every game. One pulse.</h2><p>Live-first navigation with fast access to the markets that matter now.</p></div><div className="sp-live-pill"><i className="sp-live-dot" /> 12 live events</div></div>
    <div className="sp-aurora-layout"><aside className="sp-sport-rail">{SPORTS.map((sport, i) => <button className={i === 0 ? 'active' : ''} key={sport.key}><span>{sport.icon}</span><b>{sport.label}</b><small>{sport.count}</small></button>)}</aside><main className="sp-aurora-main"><div className="sp-section-bar"><div><span className="sp-eyebrow">LIVE NOW</span><h3>Watch the action</h3></div><button className="sp-ghost">View all <span>→</span></button></div><div className="sp-live-hero"><div><span className="sp-live-label"><i className="sp-live-dot" /> LIVE · FOOTBALL</span><strong>Inter Milan <em>1</em></strong><strong>Napoli <em>0</em></strong><small>{live.live} · San Siro</small></div><div className="sp-live-score">1 <span>—</span> 0</div><Odds match={live} compact /></div><div className="sp-section-bar"><div><span className="sp-eyebrow">UPCOMING</span><h3>Popular fixtures</h3></div><div className="sp-filter-pills"><button className="active">Today</button><button>Tomorrow</button></div></div>{MATCHES.slice(0, 3).map(match => <MatchRow key={match.home} match={match} />)}</main><aside className="sp-betslip-mini"><span className="sp-eyebrow">BET SLIP <b>2</b></span><h3>Your picks</h3><div className="sp-slip-pick"><small>Premier League · Match result</small><strong>Arsenal <b>1.62</b></strong></div><div className="sp-slip-pick"><small>Serie A · Match result</small><strong>Inter Milan <b>2.05</b></strong></div><div className="sp-slip-total"><span>Potential return</span><strong>€32.80</strong></div><button className="sp-primary">Open bet slip <span>→</span></button></aside></div>
  </section>;
}

function PreviewTwo() {
  return <section className="sp-preview sp-preview-editorial">
    <div className="sp-editorial-top"><div><span className="sp-eyebrow">CONCEPT 02 · EDITORIAL BOARD</span><h2>The daily fixture desk.</h2><p>A calm, content-led sportsbook built for browsing leagues and finding a confident pick.</p></div><div className="sp-editorial-date"><small>THURSDAY</small><strong>24 SEP</strong><span>128 markets today</span></div></div>
    <div className="sp-editorial-tabs"><button className="active">All</button><button>Football</button><button>Basketball</button><button>Tennis</button><button>American sports</button><span /><button className="sp-ghost">⌕ Search matches</button></div>
    <div className="sp-editorial-grid"><main><div className="sp-featured-match"><div className="sp-featured-kicker"><span>FEATURED MATCH</span><small>Premier League · 18:30</small></div><div className="sp-featured-teams"><div><span className="sp-monogram">A</span><strong>Arsenal</strong><small>Home</small></div><div className="sp-featured-vs"><span>VS</span><small>Today</small></div><div><span className="sp-monogram lime">B</span><strong>Brighton</strong><small>Away</small></div></div><div className="sp-featured-odds"><button><small>Arsenal</small><b>1.62</b></button><button><small>Draw</small><b>4.10</b></button><button><small>Brighton</small><b>5.70</b></button></div></div><div className="sp-editorial-heading"><h3>All fixtures</h3><span>Sorted by kickoff</span></div>{MATCHES.slice(1).map(match => <MatchRow key={match.home} match={match} />)}</main><aside className="sp-league-index"><span className="sp-eyebrow">BROWSE BY LEAGUE</span>{['Premier League', 'La Liga', 'Serie A', 'NBA', 'ATP Tour'].map((league, i) => <button key={league} className={i === 0 ? 'active' : ''}><span>{String(i + 1).padStart(2, '0')}</span>{league}<b>→</b></button>)}<div className="sp-editorial-note"><strong>Build your accumulator.</strong><p>Combine picks from different leagues in one simple slip.</p><button className="sp-primary">Explore markets</button></div></aside></div>
  </section>;
}

function PreviewThree() {
  return <section className="sp-preview sp-preview-neon"><div className="sp-neon-header"><div><span className="sp-eyebrow">CONCEPT 03 · NEON GRID</span><h2>Markets at a glance.</h2><p>High-density odds board for experienced bettors who want speed, scanability, and live movement.</p></div><div className="sp-board-status"><span><i className="sp-live-dot" /> Feed online</span><small>Updated 12 sec ago</small></div></div><div className="sp-neon-toolbar"><div className="sp-neon-sports">{SPORTS.slice(0, 5).map((sport, i) => <button className={i === 1 ? 'active' : ''} key={sport.key}>{sport.icon} {sport.label}</button>)}</div><div className="sp-neon-filters"><button className="active">All markets</button><button>Live only</button><button>▤</button></div></div><div className="sp-market-table"><div className="sp-market-table-head"><span>EVENT</span><span>1X2</span><span>DOUBLE CHANCE</span><span>GOALS</span><span>MORE</span></div>{MATCHES.map((match, i) => <div className="sp-market-line" key={match.home}><div className="sp-grid-event"><small>{match.league}</small><strong>{match.home} <em>vs</em> {match.away}</strong><span>{i === 2 ? <><i className="sp-live-dot" /> LIVE · 67'</> : match.time}</span></div><div className="sp-grid-odds"><button><small>1</small>{match.homeOdd}</button>{match.drawOdd && <button><small>X</small>{match.drawOdd}</button>}<button><small>2</small>{match.awayOdd}</button></div><div className="sp-grid-odds"><button>1X <b>1.16</b></button><button>X2 <b>1.42</b></button></div><div className="sp-grid-odds"><button>O 2.5 <b>1.74</b></button><button>U 2.5 <b>2.02</b></button></div><button className="sp-more">+{i + 8}</button></div>)}</div><div className="sp-neon-bottom"><span><b>128</b> events</span><span><b>642</b> markets</span><button className="sp-primary">Open bet slip · 0 picks</button></div></section>;
}

function PreviewFour() {
  const [activeSport, setActiveSport] = useState('all');
  const visible = useMemo(() => activeSport === 'all' ? MATCHES : MATCHES.filter((m) => m.league.toLowerCase().includes(activeSport === 'nfl' ? 'nfl' : activeSport)), [activeSport]);
  return <section className="sp-preview sp-preview-arena"><div className="sp-arena-cover"><div className="sp-arena-copy"><span className="sp-eyebrow">CONCEPT 04 · THE ARENA</span><h2>Pick your side.</h2><p>A bold, tactile match-day experience where each sport feels like its own arena.</p><button className="sp-primary">See live games <span>↗</span></button></div><div className="sp-arena-orbit"><span>LIVE</span><b>+12</b><small>games in play</small></div></div><div className="sp-arena-nav">{SPORTS.map(sport => <button key={sport.key} onClick={() => setActiveSport(sport.key)} className={activeSport === sport.key ? 'active' : ''}><span>{sport.icon}</span>{sport.label}<small>{sport.count}</small></button>)}</div><div className="sp-arena-content"><div className="sp-arena-heading"><div><span className="sp-eyebrow">{activeSport === 'all' ? 'ALL SPORTS' : activeSport.toUpperCase()}</span><h3>Featured matchups</h3></div><button className="sp-ghost">⌁ Filter</button></div><div className="sp-arena-cards">{visible.map((match, i) => <article className="sp-arena-card" key={match.home}><div className="sp-arena-card-top"><span>{match.league}</span>{i === 2 ? <b><i className="sp-live-dot" /> LIVE</b> : <small>{match.time}</small>}</div><div className="sp-arena-teams"><div><span className="sp-arena-crest">{match.home[0]}</span><strong>{match.home}</strong></div><em>VS</em><div><span className="sp-arena-crest alt">{match.away[0]}</span><strong>{match.away}</strong></div></div><Odds match={match} /></article>)}</div></div></section>;
}

export default function SportsPagePreviews() {
  const [active, setActive] = useState('aurora');
  const previews = [
    { key: 'aurora', label: 'Aurora Live', caption: 'Live-first sportsbook', component: <PreviewOne /> },
    { key: 'editorial', label: 'Editorial Board', caption: 'Browse-first sportsbook', component: <PreviewTwo /> },
    { key: 'neon', label: 'Neon Grid', caption: 'High-density odds board', component: <PreviewThree /> },
    { key: 'arena', label: 'The Arena', caption: 'Bold match-day experience', component: <PreviewFour /> },
  ];
  return <section className="sports-preview-page"><header className="sports-preview-intro"><div><span className="sp-eyebrow">LUCKYSTAKE SPORTSBOOK LAB</span><h1>Choose the sports experience.</h1><p>Four directions for the new all-sports page. Each keeps the LuckyStake palette while changing the way bettors discover fixtures, markets, and live action.</p></div><div className="sports-preview-key"><span><i className="key-purple" /> LuckyStake violet</span><span><i className="key-lime" /> Action lime</span><span><i className="key-night" /> Midnight surfaces</span></div></header><nav className="sports-preview-switcher">{previews.map((preview, i) => <button key={preview.key} className={active === preview.key ? 'active' : ''} onClick={() => setActive(preview.key)}><span>0{i + 1}</span><b>{preview.label}</b><small>{preview.caption}</small></button>)}</nav><div className="sports-preview-stage">{previews.find((preview) => preview.key === active)?.component}</div></section>;
}
