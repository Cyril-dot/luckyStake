# Aurora Live Integration Notes

The LuckyStake `/sports` route now uses the Aurora Live sportsbook layout and reads from the connected public sports backend through the existing typed API helper.

## Implemented

- Added `src/AuroraSportsPage.tsx`.
- Replaced `/sports`, `/gh/starting-soon`, `/gh/live`, and `/slip` with the Aurora page route.
- Added all supported sport tabs: All sports, Football, Basketball, Tennis, NFL, Baseball, and MMA.
- Removed the visible feed-tab row entirely; the board loads today’s markets internally while the sport selector remains available.
- Added live match cards, scores, clocks, team logos, kickoff times, odds, match-detail links, and empty states.
- Connected odds buttons to the existing LuckyStake local-storage bet-slip contract and `slip:open`/`slip:update` events.
- Added per-sport error isolation so one failing feed does not blank the whole sportsbook.
- Match-detail links now carry the sport, so baseball and other non-football fixtures open through their correct backend namespace.
- Match details now preserve nested `{ match, odds }` responses and render all available market buckets, bookmaker selections, and prices.
- Odds are now true toggles: clicking the same selected price again removes it from `luckystakeSlip` and dispatches `slip:update`; this works on both sportsbook cards and match-detail market selections.
- The latest public endpoint audit confirmed baseball feeds and odds/detail routes return data. Several other sport feed routes currently return empty arrays, while their declared endpoints are reachable; this is a backend data-availability condition rather than a frontend odds parsing failure.
- Added background auto-refresh every 60 seconds; no manual Refresh control is shown.
- Kept the shared top navigation available while the Aurora board itself stays focused on today’s markets.
- Added verified per-sport feed selection and a Vite development proxy for the sandbox preview.
- Localhost development calls the configured backend URL directly; non-local preview hosts use the proxy to avoid browser CORS failures.

## Verification

- `pnpm build` passed with TypeScript and Vite.
- Local proxy returned real football data from `/api/public/football/matches/today`.
- Browser loaded real fixtures and odds on `/sports`.
- Browser loaded real combined football and baseball fixtures on `/sports`.
- Football tab filtered the board to football fixtures.
- Odds selection opened the existing bet slip with the selected match and price.
- The Live header route opened with the Live tab selected.
- Match details now preserve the sport query and load the full odds payload, including bookmaker 1X2, half-time, correct-score, and handicap markets; the verified football detail rendered 138 selections.

## Preview URL

[Open the integrated Aurora Live sportsbook](https://5173-isojwxe30s5pm5vq7ll61-df38bd92.us4.manus.computer/sports)

## Final follow-up fixes

The all-sports loader uses verified feed choices per sport. Football, baseball, and NFL use `today`; basketball, tennis, and MMA use their working `upcoming` route because their `today` routes currently return backend errors or not-found responses. This prevents browser console failures from those known-invalid requests while keeping the fallback data invisible to the user.

The Aurora header was also opened up visually. The top heading and subheading no longer sit inside a tinted compact container or shadow, the sports rail no longer has the boxed border treatment or visible scrollbar, and the page relies on a quiet background refresh. The final browser check showed 35 combined football/baseball fixtures on the current public feed.
