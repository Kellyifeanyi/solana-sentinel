# Solana Sentinel

Premium Solana wallet intelligence for traders, funds, security analysts, and power users. Solana Sentinel combines GoldRush API data with a lightweight risk engine, watchlist alerts, and an x402-style pay-per-insight endpoint.

## Features

- Wallet risk scoring from GoldRush balances and transactions
- Premium wallet report at `/wallet/[address]`
- Watchlist activity feed at `/alerts`
- Evidence-backed wallet indicators
- Portfolio overview with Recharts visualizations
- GoldRush wrapper with retry, timeout, and rate-limit handling
- x402-style premium insight endpoint at `/api/premium-insight/[wallet]`
- App Router, TypeScript, Tailwind, shadcn-style UI primitives, and server components where appropriate

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Create `.env.local`:

```bash
GOLDRUSH_API_KEY=your_goldrush_key
SENTINEL_WATCHLIST=wallet_one,wallet_two,wallet_three
```

Wallet intelligence is fetched from GoldRush when `GOLDRUSH_API_KEY` is present. `SENTINEL_WATCHLIST` is optional but enables the alert feed to derive activity from real watched wallets. If GoldRush data is unavailable, the app returns empty states.

## Local Flow

1. Start on `/` and paste any Solana wallet address.
2. Open the generated wallet report.
3. Review risk score, portfolio exposure, recent activity, indicators, and recommendations.
4. Click `Request x402` in the Premium x402 Insight panel to request the paid insight response when evidence exists.
5. Visit `/alerts` for the watchlist alert feed.

## Architecture

- `app/` contains App Router pages and route handlers.
- `components/` contains reusable UI, home, and dashboard components.
- `lib/goldrush.ts` wraps GoldRush calls, response normalization, retries, timeouts, and rate-limit handling.
- `lib/risk-engine.ts` calculates wallet risk and recommendations.
- `types/` contains shared TypeScript contracts.
- `hooks/` contains small client hooks for interactive flows.

## GoldRush Integration

`lib/goldrush.ts` exposes:

- `getWalletBalances()`
- `getWalletTransactions()`
- `getWalletTokenExposure()`
- `getWalletRiskSignals()`

The wrapper reads `GOLDRUSH_API_KEY` server-side and returns normalized wallet intelligence from `balances_v2` and paged `transactions_v3`. Balance responses provide token metadata and USD pricing; transaction log metadata is used to classify swaps, mints, burns, bridges, and transfers. Failed or rate-limited requests return empty data.

## API Routes

- `GET /api/wallet/[address]` returns a full wallet report.
- `GET /api/alerts` returns watchlist alerts.
- `GET /api/stream` streams Server-Sent Event alert payloads.
- `GET /api/premium-insight/[wallet]` returns a 402-style payment requirement.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
