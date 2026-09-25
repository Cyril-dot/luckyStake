# LuckyStake React + TypeScript

This is the React/Vite/TypeScript version of the standalone LuckyStake frontend. It is separate from the connected PowerBet repository and uses the verified PowerBet API base URL from `src/api.ts`.

## Run locally

```bash
cd blizbet-react
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

For a different port:

```bash
pnpm dev -- --port 5500
```

## Build

```bash
pnpm build
pnpm preview
```

The React app includes endpoint-backed live, today, upcoming, and ended sports feeds; nested match details and odds; authenticated `/api/bets` staking; auth forms; games actions; admin and super-admin panels; and the 501-entry endpoint catalog.

## Games lobby

The `/games` route now includes an enlarged visual lobby using the source sportsbook game-logo assets for Crash, Mines, Blackjack, Wheel, Plinko, Even or Odd, Coin Flip, and Spin the Bottle. Selecting a card fills the game key used by the verified PowerBet routes for current round, play, cashout, and history. The page does not fabricate game results; game records are fetched from `/api/games/history` and authenticated responses determine the available game keys.

## Home page visual sections

The React home page includes the Top leagues strip with league logos, Sports and Casino icon panels, large Top sports image cards, enlarged typography, and PowerBet-backed match cards. Each match card displays the `homeLogo` and `awayLogo` fields returned by the PowerBet feeds with a safe fallback when an upstream logo is unavailable.

## Final sportsbook flow

The header includes a professional utility bar and Google Material Symbols. Navigation is role-aware: admin and super-admin links appear only when the authenticated token contains the corresponding role, and direct restricted routes display an access-denied view. Odds selections receive a visible selected state, populate the bet slip, and persist the selected match in local storage before the verified `/api/bets` request. Match cards open `/match/:id`, which loads the dedicated PowerBet match-detail route. Booking codes are available at `/booking` through `/api/booking/redeem`, and the admin console includes the verified booking-code management route.

## Final UI polish

Visible API labels were removed from the sportsbook content. The Live now panel is rendered only when the live feed contains matches. Odds clicked from the home page or sportsbook are stored in the slip without navigation refresh and open the responsive drawer. The drawer slides from the right on desktop and from the bottom on mobile; its content uses a smaller compact type scale. The home page has a floating slip icon, while the full-width header has the icon-only LuckyStake mark and authenticated account, wallet-balance, and deposit controls.
